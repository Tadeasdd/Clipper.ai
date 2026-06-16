/** ffprobe / ffmpeg helpers — every media operation in one place. */
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

function run(cmd, args, { collect = 'stdout' } = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '', err = '';
    p.stdout.on('data', (d) => { out += d; });
    p.stderr.on('data', (d) => { err += d; });
    p.on('error', reject);
    p.on('close', (code) => {
      if (code !== 0) return reject(new Error(`${cmd} exited ${code}: ${err.slice(-800)}`));
      resolve(collect === 'stderr' ? err : out);
    });
  });
}

/** Duration, streams, dimensions. */
export async function probe(path) {
  const out = await run('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', path]);
  const info = JSON.parse(out);
  const video = (info.streams || []).find((s) => s.codec_type === 'video');
  const audio = (info.streams || []).find((s) => s.codec_type === 'audio');
  return {
    durationS: Number(info.format?.duration) || 0,
    hasVideo: !!video,
    hasAudio: !!audio,
    width: video ? Number(video.width) : null,
    height: video ? Number(video.height) : null,
    format: info.format?.format_name || null,
  };
}

/** Extract a 16 kHz mono PCM WAV — the input shape whisper.cpp / faster-whisper
 *  expect. Decodes any container the source ffmpeg can read; downmixes to mono
 *  and resamples to 16 kHz so the ASR model sees exactly what it was trained on. */
export async function extractAudioWav(srcPath, outPath) {
  await run('ffmpeg', ['-hide_banner', '-y', '-i', srcPath,
    '-vn', '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le', outPath], { collect: 'stderr' });
  return outPath;
}

/** Momentary loudness series via ebur128 — one reading every ~100ms.
 *  Returns [{ t, m }] where m is momentary loudness in LUFS. This is the
 *  real signal the analyze stage hunts moments in. */
export async function loudnessSeries(path) {
  const err = await run('ffmpeg', ['-hide_banner', '-nostats', '-i', path,
    '-filter_complex', 'ebur128=metadata=0', '-f', 'null', '-'], { collect: 'stderr' });
  const series = [];
  const re = /t:\s*([\d.]+)\s+TARGET.*?M:\s*(-?[\d.]+)/g;
  let m;
  while ((m = re.exec(err))) {
    const t = Number(m[1]), lufs = Number(m[2]);
    if (Number.isFinite(t) && Number.isFinite(lufs) && lufs > -120) series.push({ t, m: lufs });
  }
  return series;
}

/** Cut [start, end) and render a 9:16 1080x1920 vertical clip.
 *  Video sources: center-crop + scale. Audio-only: solid backdrop + waveform.
 *  When `captionsPath` (an .ass file) is given, word-timed captions are burned
 *  into the frame — short-form clips live or die on on-screen captions. */
export async function renderVertical(srcPath, outPath, { start, end, hasVideo, captionsPath }) {
  const dur = Math.max(0.5, end - start);
  const base = ['-hide_banner', '-y', '-ss', String(start), '-t', String(dur), '-i', srcPath];
  const ass = captionsPath ? `ass=${escapeFilterPath(captionsPath)}` : null;
  const enc = ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '26', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', outPath];
  const args = hasVideo
    ? [...base,
       '-vf', ['scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920', ass].filter(Boolean).join(','),
       ...enc]
    : [...base,
       '-filter_complex',
       '[0:a]showwaves=s=1080x520:mode=cline:colors=0x53fc18[w];color=c=0x0a0a09:s=1080x1920:d=' + dur +
       '[bg];[bg][w]overlay=(W-w)/2:(H-h)/2:shortest=1' + (ass ? '[base];[base]' + ass + '[v]' : '[v]'),
       '-map', '[v]', '-map', '0:a', ...enc];
  await run('ffmpeg', args, { collect: 'stderr' });
}

/** Resolve the client's caption style, applying sensible short-form defaults.
 *  `brand_config.captions` may be `false` (off), or an object overriding any
 *  field; the neon green already used in the waveform card is the default. */
export function captionStyle(brandConfig = {}) {
  const c = brandConfig && typeof brandConfig.captions === 'object' ? brandConfig.captions : {};
  return {
    font: c.font || brandConfig.font || 'Arial',
    fontSize: Number(c.fontSize || 64),
    color: toAssColor(c.color || brandConfig.color || '0x53fc18'),   // text fill (default neon green)
    outline: toAssColor(c.outline || '0x000000'),                    // black outline for legibility
    outlineWidth: Number(c.outlineWidth ?? 3),
    bold: c.bold === false ? 0 : 1,
    marginV: Number(c.marginV ?? 220),                               // lift off the very bottom edge
    wordsPerCue: Math.max(1, Number(c.wordsPerCue || 4)),
    uppercase: c.uppercase === true,
  };
}

/** Captions on unless the client explicitly turns them off. */
export const captionsEnabled = (brandConfig = {}) => brandConfig?.captions !== false;

/** Build an .ass subtitle file for the words spoken within [start,end], offset
 *  to clip-local time and chunked into short cues. Returns the path, or null
 *  when there are no words in range (audio-only podcasts, no ASR). */
export function buildCaptions({ words, start, end, style, outPath }) {
  const inRange = (words || [])
    .filter((w) => Number(w.e) > start && Number(w.s) < end)
    .map((w) => ({ w: String(w.w || ''), s: Number(w.s), e: Number(w.e) }))
    .filter((w) => w.w && Number.isFinite(w.s) && Number.isFinite(w.e));
  if (!inRange.length) return null;

  const cues = [];
  for (let i = 0; i < inRange.length; i += style.wordsPerCue) {
    const chunk = inRange.slice(i, i + style.wordsPerCue);
    const s = Math.max(0, chunk[0].s - start);
    const e = Math.max(s + 0.3, chunk[chunk.length - 1].e - start);
    let text = chunk.map((w) => w.w).join(' ').replace(/\s+([.,!?;:])/g, '$1').trim();
    if (style.uppercase) text = text.toUpperCase();
    cues.push({ s, e, text: assEscape(text) });
  }

  const header = [
    '[Script Info]', 'ScriptType: v4.00+', 'PlayResX: 1080', 'PlayResY: 1920', 'WrapStyle: 2', '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, OutlineColour, BackColour, Bold, Italic, ' +
      'BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    `Style: Clip,${style.font},${style.fontSize},${style.color},${style.outline},&H64000000,` +
      `${style.bold},0,1,${style.outlineWidth},1,2,60,60,${style.marginV},1`, '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
  ].join('\n');
  const events = cues.map((c) => `Dialogue: 0,${assTime(c.s)},${assTime(c.e)},Clip,,0,0,0,,${c.text}`).join('\n');
  writeFileSync(outPath, `${header}\n${events}\n`);
  return outPath;
}

// ffmpeg colours are 0xRRGGBB; ASS wants &HAABBGGRR (alpha + BGR).
function toAssColor(hex) {
  const m = String(hex).replace(/^#/, '').replace(/^0x/i, '').padStart(6, '0').slice(-6);
  const rr = m.slice(0, 2), gg = m.slice(2, 4), bb = m.slice(4, 6);
  return `&H00${bb}${gg}${rr}`.toUpperCase();
}

function assTime(sec) {
  const cs = Math.max(0, Math.round(sec * 100));
  const h = Math.floor(cs / 360000);
  const m = Math.floor((cs % 360000) / 6000);
  const s = Math.floor((cs % 6000) / 100);
  const c = cs % 100;
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(c).padStart(2, '0')}`;
}

const assEscape = (t) => t.replace(/[\r\n]+/g, ' ').replace(/[{}]/g, '');
// Filtergraph paths: escape backslash and the option-separating colon.
const escapeFilterPath = (p) => p.replace(/\\/g, '\\\\').replace(/:/g, '\\:');

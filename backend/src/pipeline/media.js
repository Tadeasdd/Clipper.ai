/** ffprobe / ffmpeg helpers — every media operation in one place. */
import { spawn } from 'node:child_process';

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
 *  Video sources: center-crop + scale. Audio-only: solid backdrop + waveform. */
export async function renderVertical(srcPath, outPath, { start, end, hasVideo }) {
  const dur = Math.max(0.5, end - start);
  const base = ['-hide_banner', '-y', '-ss', String(start), '-t', String(dur), '-i', srcPath];
  const args = hasVideo
    ? [...base,
       '-vf', 'scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920',
       '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '26', '-pix_fmt', 'yuv420p',
       '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', outPath]
    : [...base,
       '-filter_complex',
       '[0:a]showwaves=s=1080x520:mode=cline:colors=0x53fc18[w];color=c=0x0a0a09:s=1080x1920:d=' + dur +
       '[bg];[bg][w]overlay=(W-w)/2:(H-h)/2:shortest=1[v]',
       '-map', '[v]', '-map', '0:a',
       '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '26', '-pix_fmt', 'yuv420p',
       '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', outPath];
  await run('ffmpeg', args, { collect: 'stderr' });
}

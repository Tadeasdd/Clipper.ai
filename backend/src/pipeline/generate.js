/** Stage 5 — generate: render the top candidates into real 9:16 assets.
 *
 *  ffmpeg cuts each winning region and reframes it vertical (center-crop for
 *  video sources; branded waveform card for audio-only), then burns word-timed
 *  captions in the client's brand style (M3) when a transcript exists and the
 *  client hasn't turned captions off. Hooks come from a provider seam: real
 *  LLM variants editors pick from in the F4 desk when LLM_PROVIDER=anthropic
 *  and a transcript exists, an honest labelled placeholder otherwise.
 *  Rendered clips move to 'awaiting_review' — stage B4's queue.
 */
import { mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { q } from '../db/index.js';
import { localPathFor, putFile } from '../storage/index.js';
import { renderVertical, buildCaptions, captionStyle, captionsEnabled } from './media.js';
import { hookVariants } from './llm.js';
import { recordCost } from '../ops/cost-ledger.js';

const TOP_N = Number(process.env.GENERATE_TOP_N || 4);

export async function generate(recordingId) {
  const recQ = await q(
    `SELECT r.storage_key, r.media_info, c.brand_config
     FROM recordings r JOIN clients c ON c.id = r.client_id WHERE r.id = $1`, [recordingId]);
  const rec = recQ.rows[0];
  if (!rec?.storage_key) throw new Error('recording has no media');
  const src = await localPathFor(rec.storage_key);
  const hasVideo = !!rec.media_info?.hasVideo;
  const brand = rec.brand_config || {};
  const style = captionStyle(brand);
  const captionsOn = captionsEnabled(brand);

  const { rows: clips } = await q(
    `SELECT id, t_start_s, t_end_s, score FROM clips
     WHERE recording_id = $1 AND status = 'candidate'
     ORDER BY score DESC LIMIT $2`, [recordingId, TOP_N]);
  if (!clips.length) throw new Error('no candidates to render');

  const transcript = (await q('SELECT words, text FROM transcripts WHERE recording_id = $1', [recordingId])).rows[0];
  const words = transcript?.words || [];
  const tmp = mkdtempSync(path.join(tmpdir(), 'clipper-gen-'));
  let rendered = 0;
  let cpuMs = 0, assetBytes = 0; // E1: render compute + rendered-asset storage
  try {
    for (const [i, clip] of clips.entries()) {
      const start = Number(clip.t_start_s), end = Number(clip.t_end_s);
      const out = path.join(tmp, `${clip.id}.mp4`);

      const captionsPath = captionsOn
        ? buildCaptions({ words, start, end, style, outPath: path.join(tmp, `${clip.id}.ass`) })
        : null;
      const renderStart = Date.now();
      await renderVertical(src, out, { start, end, hasVideo, captionsPath });
      cpuMs += Date.now() - renderStart;
      assetBytes += statSync(out).size;

      const assetKey = `${recordingId}/clips/${clip.id}.mp4`;
      await putFile(assetKey, out);

      const { hook, variants } = await makeHook({ clip, rank: i + 1, spanText: spanText(words, start, end) });
      await q(
        `UPDATE clips
           SET asset_key = $2, format = '9:16', hook = $3,
               signals = COALESCE(signals, '{}'::jsonb) || $4::jsonb,
               status = 'awaiting_review'
         WHERE id = $1`,
        [clip.id, assetKey, hook, JSON.stringify({ hookVariants: variants, captioned: !!captionsPath })]);
      rendered++;
    }
    await recordCost(recordingId, 'generate', [
      { resource: 'cpu_ms', quantity: cpuMs, meta: { clips: rendered } },
      { resource: 'storage_bytes', quantity: assetBytes, meta: { kind: 'rendered' } },
    ]);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
  return { rendered, format: '9:16', captioned: captionsOn };
}

/** Real LLM hook variants when available, an honest placeholder otherwise. The
 *  first variant becomes the working hook; editors pick/adjust the rest in F4. */
async function makeHook({ clip, rank, spanText }) {
  const variants = await hookVariants(spanText, 3); // [] unless anthropic + words
  if (variants.length) return { hook: variants[0], variants };
  // builtin / no-key fallback — a human editor rewrites this in review (B4).
  const dur = Math.round(Number(clip.t_end_s) - Number(clip.t_start_s));
  return {
    hook: `Moment #${rank} · ${fmtClock(clip.t_start_s)}–${fmtClock(clip.t_end_s)} (${dur}s) — hook pending editor`,
    variants: [],
  };
}

/** The transcript text spoken within [start,end]. */
function spanText(words, start, end) {
  return (words || [])
    .filter((w) => Number(w.e) >= start - 0.5 && Number(w.s) <= end + 0.5)
    .map((w) => w.w)
    .join(' ')
    .replace(/\s+([.,!?;:])/g, '$1')
    .trim();
}

const fmtClock = (s) => {
  const n = Math.floor(Number(s));
  return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`;
};

/** Stage 5 — generate: render the top candidates into real 9:16 assets.
 *
 *  ffmpeg cuts each winning region and reframes it vertical (center-crop for
 *  video sources; branded waveform card for audio-only). Hooks come from a
 *  provider seam: builtin templates by default, the Anthropic API when
 *  LLM_PROVIDER=anthropic and a transcript exists (a hook needs words).
 *  Rendered clips move to 'awaiting_review' — stage B4's queue.
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { q } from '../db/index.js';
import { localPathFor, putFile } from '../storage/index.js';
import { renderVertical } from './media.js';

const TOP_N = Number(process.env.GENERATE_TOP_N || 4);

export async function generate(recordingId) {
  const recQ = await q('SELECT storage_key, media_info FROM recordings WHERE id = $1', [recordingId]);
  const rec = recQ.rows[0];
  if (!rec?.storage_key) throw new Error('recording has no media');
  const src = await localPathFor(rec.storage_key);
  const hasVideo = !!rec.media_info?.hasVideo;

  const { rows: clips } = await q(
    `SELECT id, t_start_s, t_end_s, score FROM clips
     WHERE recording_id = $1 AND status = 'candidate'
     ORDER BY score DESC LIMIT $2`, [recordingId, TOP_N]);
  if (!clips.length) throw new Error('no candidates to render');

  const transcript = (await q('SELECT text FROM transcripts WHERE recording_id = $1', [recordingId])).rows[0];
  const tmp = mkdtempSync(path.join(tmpdir(), 'clipper-gen-'));
  let rendered = 0;
  try {
    for (const [i, clip] of clips.entries()) {
      const out = path.join(tmp, `${clip.id}.mp4`);
      await renderVertical(src, out, { start: Number(clip.t_start_s), end: Number(clip.t_end_s), hasVideo });
      const assetKey = `${recordingId}/clips/${clip.id}.mp4`;
      await putFile(assetKey, out);
      const hook = await makeHook({ clip, rank: i + 1, transcriptText: transcript?.text });
      await q(
        `UPDATE clips SET asset_key = $2, format = '9:16', hook = $3, status = 'awaiting_review' WHERE id = $1`,
        [clip.id, assetKey, hook]);
      rendered++;
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
  return { rendered, format: '9:16' };
}

async function makeHook({ clip, rank, transcriptText }) {
  if ((process.env.LLM_PROVIDER || 'builtin') === 'anthropic' && transcriptText) {
    return anthropicHook(clip, transcriptText);
  }
  // builtin: honest placeholder a human editor rewrites in review (B4) —
  // hooks need words, and words need a real ASR + LLM provider.
  const dur = Math.round(Number(clip.t_end_s) - Number(clip.t_start_s));
  return `Moment #${rank} · ${fmtClock(clip.t_start_s)}–${fmtClock(clip.t_end_s)} (${dur}s) — hook pending editor`;
}

async function anthropicHook(clip, transcriptText) {
  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) throw new Error('LLM_PROVIDER=anthropic but LLM_API_KEY is unset');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: process.env.LLM_MODEL || 'claude-haiku-4-5-20251001',
      max_tokens: 60,
      messages: [{
        role: 'user',
        content: `This is a transcript excerpt of a clip from ${fmtClock(clip.t_start_s)} to ${fmtClock(clip.t_end_s)}. Write ONE short-form hook line (max 9 words, no quotes, no hashtags) that makes a viewer stop scrolling. Reply with the hook only.\n\n${String(transcriptText).slice(0, 4000)}`,
      }],
    }),
  });
  if (!res.ok) throw new Error(`anthropic ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  return (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('').trim().slice(0, 120);
}

const fmtClock = (s) => {
  const n = Math.floor(Number(s));
  return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`;
};

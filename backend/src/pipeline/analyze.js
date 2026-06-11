/** Stage 3 — analyze: find candidate moments in the real audio signal.
 *
 *  Today's signal is loudness dynamics (ebur128 momentary LUFS, ~10 Hz):
 *  energetic, dynamic stretches of a conversation are where emphasis,
 *  laughter, and argument live. Each candidate window is scored on energy
 *  vs. the recording's own baseline. When a transcript exists (real ASR
 *  provider), word density joins the signal — the seam is `signals` jsonb,
 *  which downstream stages and the ops UI treat as opaque evidence.
 */
import { q } from '../db/index.js';
import { localPathFor } from '../storage/index.js';
import { loudnessSeries } from './media.js';

const WIN_S = 4;          // scoring window
const MIN_CLIP_S = 12;    // candidate bounds
const MAX_CLIP_S = 55;

export async function analyze(recordingId) {
  const { rows } = await q('SELECT storage_key, duration_s FROM recordings WHERE id = $1', [recordingId]);
  const { storage_key: key, duration_s: durationS } = rows[0] || {};
  if (!key) throw new Error('recording has no media');

  const series = await loudnessSeries(await localPathFor(key));
  if (series.length < 10) throw new Error('audio too short or silent — no loudness signal');

  // Windowed mean loudness → z-score against the whole recording.
  const windows = [];
  for (let t = 0; t + WIN_S <= (durationS || series[series.length - 1].t); t += WIN_S / 2) {
    const xs = series.filter((s) => s.t >= t && s.t < t + WIN_S).map((s) => s.m);
    if (xs.length) windows.push({ t, m: xs.reduce((a, b) => a + b, 0) / xs.length });
  }
  const mean = windows.reduce((a, w) => a + w.m, 0) / windows.length;
  const sd = Math.sqrt(windows.reduce((a, w) => a + (w.m - mean) ** 2, 0) / windows.length) || 1;
  windows.forEach((w) => { w.z = (w.m - mean) / sd; });

  // Greedy peak picking grown to clip-sized regions. Distinct bursts can sit
  // close together, so overlap control is by REGION, not peak distance: a new
  // candidate is clamped against already-accepted regions and only dropped if
  // what remains is too short to be a clip.
  const peaks = [...windows].sort((a, b) => b.z - a.z);
  const moments = [];
  for (const p of peaks) {
    if (moments.length >= 8) break;
    if (p.z < -0.25) break; // below baseline — stop
    if (moments.some((m) => p.t >= m.start - MIN_CLIP_S / 2 && p.t < m.end)) continue; // same burst
    let start = p.t, end = p.t + WIN_S;
    const grow = (t) => (windows.find((w) => w.t === t) || { z: -9 }).z > -0.1;
    while (end - start < MAX_CLIP_S && grow(end)) end += WIN_S / 2;
    while (end - start < MAX_CLIP_S && grow(start - WIN_S / 2)) start -= WIN_S / 2;
    start = Math.max(0, start);
    end = Math.min(durationS || end, Math.max(end, start + MIN_CLIP_S));
    for (const m of moments) {
      if (start < m.end && end > m.start) {            // would overlap an accepted region
        if (p.t >= m.end) start = Math.max(start, m.end);
        else end = Math.min(end, m.start);
      }
    }
    if (end - start < MIN_CLIP_S) continue;
    moments.push({ peakT: p.t, start, end, energyZ: Number(p.z.toFixed(2)) });
  }
  if (!moments.length) throw new Error('no candidate moments found above the energy baseline');

  return { moments, baseline: { meanLufs: Number(mean.toFixed(1)), sdLufs: Number(sd.toFixed(1)) } };
}

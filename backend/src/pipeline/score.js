/** Stage 4 — score: turn analyze's moments into ranked clip candidates (rows).
 *
 *  v1 heuristics, each visible in `signals` so reviewers see the why:
 *   · energy   — loudness z-score of the peak window (the main signal)
 *   · duration — fit to the 20–45 s short-form sweet spot
 *   · position — slight bonus early in the recording (cold-open material)
 *  B6 closed the loop: weights load from scoring_weights (the latest
 *  retrain, evidence attached) and fall back to the defaults below. The
 *  payload records which weights scored this recording — auditable like
 *  everything else in the pipeline.
 */
import { q } from '../db/index.js';
import { id } from '../lib/ids.js';
import { loadWeights } from '../metrics/loop.js';

export async function score(recordingId, payload) {
  const prev = await q(
    `SELECT payload FROM pipeline_jobs WHERE recording_id = $1 AND stage = 'analyze'`, [recordingId]);
  const { moments } = prev.rows[0]?.payload || {};
  if (!moments?.length) throw new Error('analyze produced no moments');
  const { rows } = await q('SELECT duration_s FROM recordings WHERE id = $1', [recordingId]);
  const durationS = rows[0]?.duration_s || 1;

  await q(`DELETE FROM clips WHERE recording_id = $1 AND status = 'candidate'`, [recordingId]);

  const { id: weightsId, weights: W, source: weightsSource } = await loadWeights();
  const scored = moments.map((m) => {
    const len = m.end - m.start;
    const energy = clamp01((m.energyZ + 1) / 3);                       // z -1..2 → 0..1
    const durFit = 1 - clamp01(Math.abs(len - 32) / 32);               // peak at ~32 s
    const position = 1 - clamp01(m.start / durationS) * 0.4;           // mild early bonus
    const total = Math.round(100 * (W.energy * energy + W.durationFit * durFit + W.position * position));
    return { ...m, len, score: total, signals: { energyZ: m.energyZ, durationFit: Number(durFit.toFixed(2)), positionBonus: Number(position.toFixed(2)) } };
  }).sort((a, b) => b.score - a.score);

  for (const c of scored) {
    await q(
      `INSERT INTO clips (id, recording_id, t_start_s, t_end_s, score, signals, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'candidate')`,
      [id('clip'), recordingId, c.start.toFixed(1), c.end.toFixed(1), c.score, c.signals]
    );
  }
  return { candidates: scored.length, top: scored[0].score, weights: W, weightsSource, weightsId };
}

const clamp01 = (x) => Math.max(0, Math.min(1, x));

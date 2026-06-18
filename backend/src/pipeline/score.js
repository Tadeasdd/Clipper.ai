/** Stage 4 — score: turn analyze's moments into ranked clip candidates (rows).
 *
 *  The score blends two layers, each visible in `signals` so reviewers see the
 *  why, not a black box:
 *   · audio    — energy (loudness z), durationFit (20–45 s sweet spot),
 *                position (cold-open bonus): the cheap loudness prior.
 *   · semantic — retention/emotion/controversy/education/story/hookStrength,
 *                from the transcript (the product's actual signal). When no
 *                transcript exists these are zero and `signalsSource` says so.
 *  B6 closed the loop: weights load from scoring_weights (the latest retrain,
 *  evidence attached) and fall back to DEFAULT_WEIGHTS. The payload records
 *  which weights scored this recording — auditable like everything else.
 */
import { q } from '../db/index.js';
import { id } from '../lib/ids.js';
import { loadWeights } from '../metrics/loop.js';
import { SEMANTIC_KEYS } from './llm.js';

export async function score(recordingId, payload) {
  const prev = await q(
    `SELECT payload FROM pipeline_jobs WHERE recording_id = $1 AND stage = 'analyze'`, [recordingId]);
  const { moments, signalsSource = 'audio_only', provenance = null } = prev.rows[0]?.payload || {};
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
    const sem = m.semantic || {};

    // signals: the audio evidence + every semantic field + the why, all opaque
    // jsonb the ops desk renders and the retrain loop correlates.
    const signals = {
      energyZ: m.energyZ,
      durationFit: Number(durFit.toFixed(2)),
      positionBonus: Number(position.toFixed(2)),
      signalsSource,
      source: m.source || 'loudness',
      rationale: sem.rationale || null,
    };
    for (const k of SEMANTIC_KEYS) signals[k] = clamp01(Number(sem[k]) || 0);

    let blend = W.energy * energy + W.durationFit * durFit + W.position * position;
    for (const k of SEMANTIC_KEYS) blend += (W[k] || 0) * signals[k];
    return { ...m, len, score: Math.round(100 * blend), signals };
  }).sort((a, b) => b.score - a.score);

  for (const c of scored) {
    await q(
      `INSERT INTO clips (id, recording_id, t_start_s, t_end_s, score, signals, ai_provenance, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'candidate')`,
      [id('clip'), recordingId, c.start.toFixed(1), c.end.toFixed(1), c.score, c.signals,
        provenance ? JSON.stringify(provenance) : null]
    );
  }
  return { candidates: scored.length, top: scored[0].score, signalsSource, weights: W, weightsSource, weightsId };
}

const clamp01 = (x) => Math.max(0, Math.min(1, x));

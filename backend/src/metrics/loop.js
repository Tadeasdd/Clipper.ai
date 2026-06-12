/** Stage B6.3 — the loop. This is the moat the roadmap names: correlate
 *  clips.score with realized performance, and feed what the audience actually
 *  rewarded back into the scoring weights.
 *
 *  Performance index: latest views per published clip, normalized by the
 *  client's own average — raw views across clients measure audience size,
 *  not clip quality. Correlation: Spearman (scale-free, see lib/stats.js).
 *
 *  Retraining is deliberately conservative:
 *    - gated on a minimum sample (RETRAIN_MIN_SAMPLE, default 8)
 *    - bounded step (LEARNING_RATE toward the evidence, not a jump)
 *    - floored (no signal dies on one noisy cycle)
 *    - append-only history with the evidence basis stored alongside
 *
 *  Under METRICS_DRIVER=local the numbers are simulated independent of the
 *  score, so correlations hover near zero and retraining barely moves — the
 *  honest reading. The machinery is what's being proven; live drivers make
 *  it the model. */
import { q } from '../db/index.js';
import { id } from '../lib/ids.js';
import { spearman } from '../lib/stats.js';

export const DEFAULT_WEIGHTS = { energy: 0.6, durationFit: 0.25, position: 0.15 };
const MIN_SAMPLE = Number(process.env.RETRAIN_MIN_SAMPLE || 8);
const LEARNING_RATE = 0.25;
const FLOOR = 0.05;

/** Latest stored weights, or the defaults when no retrain has run. */
export async function loadWeights() {
  const { rows } = await q('SELECT id, weights FROM scoring_weights ORDER BY created_at DESC LIMIT 1');
  return rows.length ? { id: rows[0].id, weights: rows[0].weights, source: 'retrained' }
                     : { id: null, weights: DEFAULT_WEIGHTS, source: 'default' };
}

/** One row per published clip: score, signals, client-normalized performance. */
async function sample() {
  const { rows } = await q(`
    WITH latest AS (
      SELECT DISTINCT ON (m.publish_id) m.publish_id, m.views
      FROM clip_metrics m ORDER BY m.publish_id, m.captured_at DESC
    ),
    per_clip AS (
      SELECT cl.id, cl.score, cl.signals, rec.client_id,
             max(latest.views) AS views           -- best post per clip
      FROM clips cl
      JOIN recordings rec ON rec.id = cl.recording_id
      JOIN publish_jobs pj ON pj.clip_id = cl.id AND pj.status = 'published'
      JOIN latest ON latest.publish_id = pj.id
      WHERE cl.score IS NOT NULL AND cl.signals IS NOT NULL AND latest.views IS NOT NULL
      GROUP BY cl.id, cl.score, cl.signals, rec.client_id
    )
    SELECT id, score, signals,
           views / GREATEST(avg(views) OVER (PARTITION BY client_id), 1) AS perf
    FROM per_clip`);
  return rows.map((r) => ({
    score: Number(r.score),
    perf: Number(r.perf),
    energy: Number(r.signals.energyZ ?? 0),
    durationFit: Number(r.signals.durationFit ?? 0),
    position: Number(r.signals.positionBonus ?? 0),
  }));
}

/** Read-only correlation pass — what /api/analytics/ops shows. */
export async function computeCorrelation(minSample = MIN_SAMPLE) {
  const s = await sample();
  if (s.length < minSample) {
    return { value: null, sample: s.length, needed: minSample, perSignal: null };
  }
  const perf = s.map((r) => r.perf);
  return {
    value: round(spearman(s.map((r) => r.score), perf)),
    sample: s.length,
    needed: minSample,
    perSignal: {
      energy: round(spearman(s.map((r) => r.energy), perf)),
      durationFit: round(spearman(s.map((r) => r.durationFit), perf)),
      position: round(spearman(s.map((r) => r.position), perf)),
    },
  };
}

/** One retrain cycle. Moves weights a bounded step toward the signals the
 *  audience actually rewarded; appends the new row with its evidence.
 *  Returns null (untouched) below the sample gate. */
export async function retrain(minSample = MIN_SAMPLE, note = null) {
  const corr = await computeCorrelation(minSample);
  if (corr.value === null && corr.sample < minSample) return null;

  const { weights: before } = await loadWeights();
  // Evidence share: positive correlations only (a negative signal earns the
  // floor, not a negative weight), softened by +ε so all-zero still divides.
  const pos = {
    energy: Math.max(0, corr.perSignal.energy ?? 0) + 1e-6,
    durationFit: Math.max(0, corr.perSignal.durationFit ?? 0) + 1e-6,
    position: Math.max(0, corr.perSignal.position ?? 0) + 1e-6,
  };
  const posSum = pos.energy + pos.durationFit + pos.position;
  const stepped = {};
  for (const k of Object.keys(DEFAULT_WEIGHTS)) {
    stepped[k] = before[k] + LEARNING_RATE * (pos[k] / posSum - before[k]);
  }
  // floor, then renormalize to 1
  for (const k of Object.keys(stepped)) stepped[k] = Math.max(FLOOR, stepped[k]);
  const total = Object.values(stepped).reduce((a, v) => a + v, 0);
  const after = Object.fromEntries(Object.entries(stepped).map(([k, v]) => [k, round(v / total)]));

  const row = {
    id: id('wts'),
    weights: after,
    basis: { sample: corr.sample, scoreCorrelation: corr.value, perSignal: corr.perSignal, learningRate: LEARNING_RATE, before },
  };
  await q('INSERT INTO scoring_weights (id, weights, basis, note) VALUES ($1, $2, $3, $4)',
    [row.id, JSON.stringify(row.weights), JSON.stringify(row.basis), note]);
  return row;
}

const round = (v) => (v === null || v === undefined ? null : Number(v.toFixed(3)));

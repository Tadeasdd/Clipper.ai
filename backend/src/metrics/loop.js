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
import { extractLabels, editorAgreement } from './labels.js';

// Audio prior + the six semantic dimensions M2 introduced. Semantics carry the
// majority because the company sells *semantic* clip-finding, not volume; the
// audio prior stays as a cheap, always-available floor. The retrain loop moves
// these toward whatever realized performance actually rewards (under the local
// metrics driver performance is score-independent, so they barely move — the
// honest reading; live drivers at M6 make the move real). Must sum to 1.
export const DEFAULT_WEIGHTS = {
  energy: 0.18, durationFit: 0.10, position: 0.07,
  retention: 0.13, emotion: 0.10, controversy: 0.14, education: 0.13, story: 0.05, hookStrength: 0.10,
};
const MIN_SAMPLE = Number(process.env.RETRAIN_MIN_SAMPLE || 8);
const LEARNING_RATE = 0.25;
const FLOOR = 0.05;

/** Latest stored weights, or the defaults when no retrain has run. A retrain
 *  row that predates the current weight set (e.g. an audio-only row from before
 *  the semantic dimensions existed) is treated as incompatible and ignored —
 *  scoring with a partial vector would silently zero the missing dimensions and
 *  could push the blend past the 0–100 cap. Forward-only: the next retrain
 *  writes a full vector and takes over. */
export async function loadWeights() {
  const { rows } = await q('SELECT id, weights FROM scoring_weights ORDER BY created_at DESC LIMIT 1');
  const stored = rows[0]?.weights;
  const compatible = stored && Object.keys(DEFAULT_WEIGHTS).every((k) => typeof stored[k] === 'number');
  return compatible ? { id: rows[0].id, weights: stored, source: 'retrained' }
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
    ...signalVector(r.signals),
  }));
}

/** Map a clip's opaque `signals` jsonb onto the weight dimensions. The audio
 *  fields keep their historical names (energyZ/durationFit/positionBonus); the
 *  semantic fields are keyed exactly as the weights are. Missing → 0, so clips
 *  scored before M2 (audio-only) correlate as a flat semantic signal. */
function signalVector(signals = {}) {
  return {
    energy: Number(signals.energyZ ?? 0),
    durationFit: Number(signals.durationFit ?? 0),
    position: Number(signals.positionBonus ?? 0),
    retention: Number(signals.retention ?? 0),
    emotion: Number(signals.emotion ?? 0),
    controversy: Number(signals.controversy ?? 0),
    education: Number(signals.education ?? 0),
    story: Number(signals.story ?? 0),
    hookStrength: Number(signals.hookStrength ?? 0),
  };
}

/** Read-only correlation pass — what /api/analytics/ops shows. */
export async function computeCorrelation(minSample = MIN_SAMPLE) {
  const s = await sample();
  if (s.length < minSample) {
    return { value: null, sample: s.length, needed: minSample, perSignal: null };
  }
  const perf = s.map((r) => r.perf);
  const perSignal = {};
  for (const k of Object.keys(DEFAULT_WEIGHTS)) perSignal[k] = round(spearman(s.map((r) => r[k]), perf));
  return {
    value: round(spearman(s.map((r) => r.score), perf)),
    sample: s.length,
    needed: minSample,
    perSignal,
  };
}

/** Q3 — model↔editor agreement: does the score predict what editors keep?
 *  Read-only, a parallel quality signal to the view correlation above. Surfaced
 *  in /api/analytics/ops and recorded in every retrain's basis (so the history
 *  trends it), but deliberately NOT folded into the weight step — the proven
 *  loop stays audience-driven; this watches whether it still tracks human
 *  judgement. */
export async function computeEditorAgreement() {
  return editorAgreement(await extractLabels(q));
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
  const pos = {};
  for (const k of Object.keys(DEFAULT_WEIGHTS)) pos[k] = Math.max(0, corr.perSignal[k] ?? 0) + 1e-6;
  const posSum = Object.values(pos).reduce((a, v) => a + v, 0);
  const stepped = {};
  for (const k of Object.keys(DEFAULT_WEIGHTS)) {
    const b = before[k] ?? DEFAULT_WEIGHTS[k];                 // tolerate pre-M2 weight rows
    stepped[k] = b + LEARNING_RATE * (pos[k] / posSum - b);
  }
  // Enforce the floor without letting normalization push a floored signal back
  // under it (a real risk once there are many dimensions). Clamp up to FLOOR,
  // then reclaim the added mass from the weights that have room above the
  // floor, proportional to that room. Guarantees every weight >= FLOOR and
  // Σ = 1, and preserves the ordering the bounded step produced.
  const after = {};
  for (const k of Object.keys(stepped)) after[k] = Math.max(FLOOR, stepped[k]);
  let excess = Object.values(after).reduce((a, v) => a + v, 0) - 1;
  const room = {};
  let roomSum = 0;
  for (const k of Object.keys(after)) { room[k] = after[k] - FLOOR; roomSum += room[k]; }
  for (const k of Object.keys(after)) {
    if (excess > 0 && roomSum > 0) after[k] -= excess * (room[k] / roomSum);
    after[k] = Number(after[k].toFixed(4));
  }

  const row = {
    id: id('wts'),
    weights: after,
    // Q3: record the editor agreement at this cycle alongside the view evidence
    // — the append-only history then trends model↔editor agreement over time.
    basis: { sample: corr.sample, scoreCorrelation: corr.value, perSignal: corr.perSignal, learningRate: LEARNING_RATE, before, editorAgreement: await computeEditorAgreement() },
  };
  await q('INSERT INTO scoring_weights (id, weights, basis, note) VALUES ($1, $2, $3, $4)',
    [row.id, JSON.stringify(row.weights), JSON.stringify(row.basis), note]);
  return row;
}

const round = (v) => (v === null || v === undefined ? null : Number(v.toFixed(3)));

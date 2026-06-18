/** Q3 — editor decisions as quality labels.
 *
 *  Every approve/reject/changes an editor makes in the review desk is a
 *  gold-standard quality judgement that used to be thrown away. Here it becomes
 *  a label: the model produced a `score` (and the six signals) for a clip; the
 *  editor then kept it, rejected it, or sent it back. `extractLabels` reads the
 *  latest verdict per clip joined to that model output — a labelled corpus that
 *  grows on its own as editors work. `editorAgreement` asks the question the
 *  moat needs answered: does the model rank what editors keep?
 *
 *  Caveat (documented, not hidden): editors mostly review clips the model
 *  already ranked highly, so in steady state the contrast narrows — agreement
 *  is most informative early and whenever low-scored clips are reviewed too.
 *
 *  Pure-ish: extractLabels takes the db `q`; editorAgreement is a pure function.
 */
import { spearman } from '../lib/stats.js';

const VERDICT = { approve: 'kept', reject: 'rejected', changes: 'edited' };
const round = (v) => (v === null || v === undefined ? null : Number(v.toFixed(3)));

const SIGNAL_KEYS = ['energy', 'durationFit', 'position', 'retention', 'emotion', 'controversy', 'education', 'story', 'hookStrength'];
const signalVector = (raw) => { const s = raw || {}; return ({
  energy: Number(s.energyZ ?? 0), durationFit: Number(s.durationFit ?? 0), position: Number(s.positionBonus ?? 0),
  retention: Number(s.retention ?? 0), emotion: Number(s.emotion ?? 0), controversy: Number(s.controversy ?? 0),
  education: Number(s.education ?? 0), story: Number(s.story ?? 0), hookStrength: Number(s.hookStrength ?? 0),
}); };

/** The latest editor verdict per clip (approve/reject/changes — the human
 *  judgement, not the routing steps), with the model's score + signals. */
export async function extractLabels(q) {
  const { rows } = await q(`
    SELECT DISTINCT ON (e.clip_id)
           e.clip_id, e.decision, e.created_at, u.role AS reviewer_role,
           cl.score, cl.signals
    FROM review_events e
    JOIN clips cl ON cl.id = e.clip_id
    JOIN users u ON u.id = e.reviewer_id
    WHERE e.decision IN ('approve','reject','changes') AND cl.score IS NOT NULL
    ORDER BY e.clip_id, e.created_at DESC`);
  return rows.map((r) => ({
    clipId: r.clip_id,
    verdict: VERDICT[r.decision],
    kept: r.decision === 'approve' ? 1 : 0,
    decidedAt: r.created_at,
    reviewerRole: r.reviewer_role,
    score: Number(r.score),
    signals: r.signals,
  }));
}

/** Does the model's score (and each signal) agree with what editors keep?
 *  Binary verdicts only (kept vs rejected); `edited` is counted but excluded
 *  from the correlation. Returns null value when there isn't enough contrast. */
export function editorAgreement(labels) {
  const binary = labels.filter((l) => l.verdict === 'kept' || l.verdict === 'rejected');
  const kept = binary.filter((l) => l.kept);
  const rejected = binary.filter((l) => !l.kept);
  const edited = labels.filter((l) => l.verdict === 'edited').length;
  const base = {
    sample: binary.length, kept: kept.length, rejected: rejected.length, edited,
    value: null, perSignal: null, keptMeanScore: null, rejectedMeanScore: null,
  };
  if (!kept.length || !rejected.length) return base; // no contrast → no agreement to read

  const mean = (xs) => round(xs.reduce((a, b) => a + b, 0) / xs.length);
  const scores = binary.map((l) => l.score);
  const keptFlags = binary.map((l) => l.kept);
  const perSignal = {};
  for (const k of SIGNAL_KEYS) perSignal[k] = round(spearman(binary.map((l) => signalVector(l.signals)[k]), keptFlags));
  return {
    ...base,
    value: round(spearman(scores, keptFlags)),       // model score ↔ editor kept
    perSignal,
    keptMeanScore: mean(kept.map((l) => l.score)),
    rejectedMeanScore: mean(rejected.map((l) => l.score)),
  };
}

/** Stage B6 — Performance measurement + feedback loop into scoring.
 *  F4.6 brought forward the two metrics computable from data that already
 *  exists (review_events, pipeline_jobs). The differentiator — correlating
 *  clips.score with realized performance and retraining the weights — needs
 *  published clips and clip_metrics, so it stays null until B6 proper. */
import { Router } from 'express';
import { q } from '../db/index.js';

const r = Router();

// GET /api/analytics/clients/:id — client-facing report data
r.get('/clients/:id', (req, res) => {
  // TODO(B6): aggregate views/retention/follows per clip → weekly report payload
  res.json({ clientId: req.params.id, period: 'last_30d', clips: [], totals: {} });
});

// GET /api/analytics/ops — internal: QA pass rate, pipeline turnaround, and
// (B6) scoring-model precision vs. published performance.
r.get('/ops', async (_req, res, next) => {
  try {
    // First-pass internal QA: of every verdict by a non-client reviewer,
    // what share approved? (send_to_client / resubmit are routing, not verdicts.)
    const qa = await q(`
      SELECT count(*) FILTER (WHERE e.decision = 'approve')::float AS approvals,
             count(*)::int AS verdicts
      FROM review_events e JOIN users u ON u.id = e.reviewer_id
      WHERE u.role <> 'client' AND e.decision IN ('approve','reject','changes')`);
    const { approvals, verdicts } = qa.rows[0];

    // Pipeline turnaround: ingest start → generate finish, recordings where
    // all five stages completed. Median, in hours.
    const turn = await q(`
      SELECT percentile_cont(0.5) WITHIN GROUP (
               ORDER BY EXTRACT(EPOCH FROM (last_done - first_start)) / 3600.0
             ) AS median_h
      FROM (
        SELECT recording_id, min(started_at) AS first_start, max(finished_at) AS last_done
        FROM pipeline_jobs GROUP BY recording_id
        HAVING count(*) FILTER (WHERE status = 'done') = 5
      ) done_recordings`);

    res.json({
      approvalRate: verdicts ? Number((approvals / verdicts).toFixed(3)) : null,
      verdicts,
      medianTurnaroundHours: turn.rows[0].median_h === null ? null : Number(Number(turn.rows[0].median_h).toFixed(3)),
      scoreCorrelation: null, // B6: needs clip_metrics from published clips
    });
  } catch (e) { next(e); }
});

export default r;

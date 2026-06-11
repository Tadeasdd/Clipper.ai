/** Stage B3 — the ops processing board: per-recording stage timelines + retry. */
import { Router } from 'express';
import { q } from '../db/index.js';
import { retryRecording, STAGES } from '../pipeline/index.js';

const r = Router();

// GET /api/jobs — board: every non-idle recording with its stage statuses.
r.get('/', async (_req, res, next) => {
  try {
    const { rows } = await q(`
      SELECT r.id, r.client_id, c.name AS client_name, r.kind, r.status, r.duration_s, r.created_at,
             COALESCE(json_agg(json_build_object(
               'stage', j.stage, 'status', j.status, 'attempts', j.attempts,
               'error', j.error, 'started_at', j.started_at, 'finished_at', j.finished_at
             ) ORDER BY array_position($1, j.stage)) FILTER (WHERE j.id IS NOT NULL), '[]') AS stages
      FROM recordings r
      JOIN clients c ON c.id = r.client_id
      LEFT JOIN pipeline_jobs j ON j.recording_id = r.id
      GROUP BY r.id, c.name
      ORDER BY r.created_at DESC LIMIT 100`, [STAGES]);
    res.json({ jobs: rows });
  } catch (e) { next(e); }
});

// GET /api/jobs/:recordingId — one recording's stage timeline + clip rollup.
r.get('/:id', async (req, res, next) => {
  try {
    const rec = await q(`
      SELECT r.*, c.name AS client_name FROM recordings r
      JOIN clients c ON c.id = r.client_id WHERE r.id = $1`, [req.params.id]);
    if (!rec.rowCount) return res.status(404).json({ error: 'unknown recording' });
    const stages = await q(
      `SELECT stage, status, attempts, error, payload, started_at, finished_at
       FROM pipeline_jobs WHERE recording_id = $1
       ORDER BY array_position($2, stage)`, [req.params.id, STAGES]);
    const clips = await q(
      `SELECT count(*)::int AS total,
              count(*) FILTER (WHERE status = 'awaiting_review')::int AS awaiting_review
       FROM clips WHERE recording_id = $1`, [req.params.id]);
    res.json({ ...rec.rows[0], stages: stages.rows, clips: clips.rows[0] });
  } catch (e) { next(e); }
});

// POST /api/jobs/:recordingId/retry — re-arm every failed stage.
r.post('/:id/retry', async (req, res, next) => {
  try {
    const n = await retryRecording(req.params.id);
    if (!n) return res.status(409).json({ error: 'no failed stages to retry' });
    res.status(202).json({ recordingId: req.params.id, rearmed: n });
  } catch (e) { next(e); }
});

export default r;

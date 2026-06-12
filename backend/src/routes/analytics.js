/** Stage B6 — Performance measurement + feedback loop into scoring.
 *  F4.6 brought forward the two metrics computable from data that already
 *  exists (review_events, pipeline_jobs). The differentiator — correlating
 *  clips.score with realized performance and retraining the weights — needs
 *  published clips and clip_metrics, so it stays null until B6 proper. */
import { Router } from 'express';
import { q } from '../db/index.js';

const r = Router();

// GET /api/analytics/clients/:id — the client-facing report (F5 renders
// this; B6.2 made it real). Per published clip: the LATEST capture per
// platform post, plus exact totals over the period. Weekly report = this
// payload + a date filter; it generates itself.
r.get('/clients/:id', async (req, res, next) => {
  try {
    const client = await q('SELECT id, name FROM clients WHERE id = $1', [req.params.id]);
    if (!client.rowCount) return res.status(404).json({ error: 'unknown client' });
    const days = Math.min(365, Math.max(1, Number(req.query.days || 30)));
    // latest capture per publish, for this client's posts in the window
    const { rows } = await q(`
      SELECT DISTINCT ON (pj.id)
             pj.id AS publish_id, pj.platform, pj.external_url, pj.published_at,
             cl.id AS clip_id, cl.hook, cl.score,
             m.captured_at, m.views, m.watch_time_s, m.retention, m.likes,
             m.comments, m.shares, m.follows
      FROM publish_jobs pj
      JOIN clips cl ON cl.id = pj.clip_id
      JOIN recordings rec ON rec.id = cl.recording_id
      LEFT JOIN clip_metrics m ON m.publish_id = pj.id
      WHERE rec.client_id = $1 AND pj.status = 'published'
        AND pj.published_at >= now() - ($2 || ' days')::interval
      ORDER BY pj.id, m.captured_at DESC NULLS LAST`,
      [req.params.id, String(days)]);

    const posts = rows.map((p) => ({
      clipId: p.clip_id, publishId: p.publish_id, platform: p.platform,
      externalUrl: p.external_url, publishedAt: p.published_at,
      hook: p.hook, score: p.score === null ? null : Number(p.score),
      capturedAt: p.captured_at,
      views: p.views === null ? null : Number(p.views),
      watchTimeS: p.watch_time_s === null ? null : Number(p.watch_time_s),
      retention: p.retention === null ? null : Number(p.retention),
      likes: p.likes === null ? null : Number(p.likes),
      comments: p.comments === null ? null : Number(p.comments),
      shares: p.shares === null ? null : Number(p.shares),
      follows: p.follows === null ? null : Number(p.follows),
    })).sort((a, b) => (b.views ?? -1) - (a.views ?? -1));

    const sum = (k) => posts.reduce((a, p) => a + (p[k] ?? 0), 0);
    const measured = posts.filter((p) => p.retention !== null && p.views !== null);
    const weighted = measured.reduce((a, p) => a + p.retention * p.views, 0);
    const weights = measured.reduce((a, p) => a + p.views, 0);
    res.json({
      clientId: req.params.id, clientName: client.rows[0].name,
      periodDays: days, posts,
      totals: {
        postsPublished: posts.length,
        clipsPublished: new Set(posts.map((p) => p.clipId)).size,
        views: sum('views'), watchTimeS: sum('watchTimeS'),
        likes: sum('likes'), comments: sum('comments'),
        shares: sum('shares'), follows: sum('follows'),
        // views-weighted: a 10-view post shouldn't drag a 100k-view post's number
        avgRetention: weights ? Number((weighted / weights).toFixed(3)) : null,
      },
    });
  } catch (e) { next(e); }
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

    // Distribution totals: latest capture per published post (B6.2).
    const dist = await q(`
      SELECT count(*)::int AS posts, COALESCE(sum(latest.views), 0)::bigint AS views
      FROM (
        SELECT DISTINCT ON (m.publish_id) m.views
        FROM clip_metrics m
        JOIN publish_jobs pj ON pj.id = m.publish_id AND pj.status = 'published'
        ORDER BY m.publish_id, m.captured_at DESC
      ) latest`);

    res.json({
      approvalRate: verdicts ? Number((approvals / verdicts).toFixed(3)) : null,
      verdicts,
      medianTurnaroundHours: turn.rows[0].median_h === null ? null : Number(Number(turn.rows[0].median_h).toFixed(3)),
      postsMeasured: dist.rows[0].posts,
      totalViews: Number(dist.rows[0].views),
      scoreCorrelation: null, // B6.3: needs the correlation pass over clip_metrics
    });
  } catch (e) { next(e); }
});

export default r;

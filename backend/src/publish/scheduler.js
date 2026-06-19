/** Stage B5 — the publish scheduler. Same runtime shape as the pipeline
 *  queue: publish_jobs IS the queue, claimed with FOR UPDATE SKIP LOCKED,
 *  3-attempt backoff, parked as 'failed' and revivable from the ops queue.
 *  A successful publish moves the clip to 'published' — per-platform truth
 *  stays on the job rows (a clip is 'published' once it's live anywhere). */
import { q } from '../db/index.js';
import { runAdapter } from './index.js';
import { instrumentStage } from '../lib/telemetry.js';

const MAX_ATTEMPTS = 3;
const POLL_MS = Number(process.env.PUBLISH_POLL_MS || 1000);
const VISIBILITY_TIMEOUT_S = Number(process.env.JOB_VISIBILITY_TIMEOUT_S || 300);
const REAP_INTERVAL_MS = Number(process.env.JOB_REAP_INTERVAL_MS || 5000);

/** Visibility-timeout reaper for the publish queue: a job stuck in 'publishing'
 *  (claim set updated_at, worker then died) is returned to 'scheduled', or
 *  dead-lettered once the attempt budget is spent. Same shape as the pipeline. */
export async function reapStuck() {
  const { rows } = await q(
    `UPDATE publish_jobs
       SET status = CASE WHEN attempts >= $2 THEN 'failed' ELSE 'scheduled' END,
           dead_letter = (attempts >= $2),
           error = 'reaped: publisher presumed dead (publishing > ' || $1 || 's with no completion)',
           run_after = now(), updated_at = now()
     WHERE status = 'publishing' AND updated_at < now() - ($1 || ' seconds')::interval
     RETURNING clip_id, platform, status`,
    [String(VISIBILITY_TIMEOUT_S), MAX_ATTEMPTS]);
  for (const j of rows) console.warn(`[publish] reaped stuck ${j.platform} ${j.clip_id} → ${j.status}`);
  return rows.length;
}

async function claim() {
  const { rows } = await q(`
    UPDATE publish_jobs SET status = 'publishing', updated_at = now(), attempts = attempts + 1
    WHERE id = (
      SELECT id FROM publish_jobs
      WHERE status = 'scheduled' AND run_after <= now()
        AND (scheduled_at IS NULL OR scheduled_at <= now())
      ORDER BY scheduled_at NULLS FIRST
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    RETURNING *`);
  return rows[0] || null;
}

async function runOne(job) {
  try {
    const ctx = await q(`
      SELECT cl.id, cl.asset_key, cl.hook, cl.t_start_s, cl.t_end_s, r.id AS recording_id,
             c.id AS client_id, c.name AS client_name,
             pc.id AS conn_id, pc.handle, pc.credentials_enc, pc.status AS conn_status
      FROM clips cl
      JOIN recordings r ON r.id = cl.recording_id
      JOIN clients c ON c.id = r.client_id
      LEFT JOIN platform_connections pc ON pc.id = $2
      WHERE cl.id = $1`, [job.clip_id, job.connection_id]);
    const row = ctx.rows[0];
    if (!row) throw new Error('clip vanished');
    if (!row.conn_id || row.conn_status !== 'active') throw new Error('platform connection missing or revoked');

    // R1: the publish span joins the recording's trace (intake→publish lifecycle).
    const { externalId, url } = await instrumentStage(
      { queue: 'publish', stage: 'publish', recordingId: row.recording_id, attempt: job.attempts },
      () => runAdapter({
        job,
        clip: { id: row.id, asset_key: row.asset_key, hook: row.hook },
        client: { id: row.client_id, name: row.client_name },
        connection: { id: row.conn_id, handle: row.handle, credentials_enc: row.credentials_enc },
      }));

    await q(`
      WITH done AS (
        UPDATE publish_jobs SET status = 'published', published_at = now(),
               external_id = $2, external_url = $3, error = NULL, updated_at = now(),
               metrics_next_at = now()   -- B6: join the capture rotation immediately
        WHERE id = $1 RETURNING clip_id
      )
      UPDATE clips SET status = 'published'
      WHERE id IN (SELECT clip_id FROM done) AND status = 'scheduled'`,
      [job.id, externalId, url]);
    console.log(`[publish] ${job.platform} ${job.clip_id} → ${url}`);
  } catch (e) {
    const parked = job.attempts >= MAX_ATTEMPTS;
    const backoffS = Math.min(60, 2 ** job.attempts * 2);
    console.error(`[publish] ${job.platform} ${job.clip_id} attempt ${job.attempts} failed: ${e.message}`);
    await q(`
      UPDATE publish_jobs SET status = $2, error = $3, dead_letter = $5, updated_at = now(),
             run_after = now() + ($4 || ' seconds')::interval
      WHERE id = $1`,
      [job.id, parked ? 'failed' : 'scheduled', String(e.message).slice(0, 2000), String(backoffS), parked]);
  }
}

let running = false;
let inFlight = 0; // R2: publish jobs currently delivering — drained before shutdown
export function startPublisher(concurrency = Number(process.env.PUBLISH_CONCURRENCY || 1)) {
  if (running) return;
  running = true;
  for (let i = 0; i < concurrency; i++) {
    (async function loop() {
      await new Promise((r) => setTimeout(r, Math.random() * POLL_MS));
      while (running) {
        try {
          const job = await claim();
          if (job) { inFlight++; try { await runOne(job); } finally { inFlight--; } continue; }
        } catch (e) {
          console.error('[publish] loop error:', e.message);
        }
        await new Promise((r) => setTimeout(r, POLL_MS));
      }
    })();
  }
  (async function reaper() {
    while (running) {
      await new Promise((r) => setTimeout(r, REAP_INTERVAL_MS));
      if (!running) break;
      try { await reapStuck(); } catch (e) { console.error('[publish] reaper error:', e.message); }
    }
  })();
  console.log(`[publish] ${concurrency} scheduler loop(s) started (+reaper, visibility ${VISIBILITY_TIMEOUT_S}s)`);
}

export function stopPublisher() { running = false; }

/** R2: stop claiming new publish jobs and let in-flight deliveries finish
 *  (bounded by timeoutMs), so a deploy can't abandon a half-published clip. */
export async function drainPublisher(timeoutMs = Number(process.env.JOB_DRAIN_TIMEOUT_MS || 20000)) {
  running = false;
  const deadline = Date.now() + timeoutMs;
  while (inFlight > 0 && Date.now() < deadline) await new Promise((r) => setTimeout(r, 50));
  return inFlight === 0;
}

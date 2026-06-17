/** Stage B6.1 — metrics ingestion behind one seam.
 *
 *  METRICS_DRIVER=local (default): deterministic simulator — full lifecycle
 *    offline, numbers independent of clips.score by design (see local.js).
 *  METRICS_DRIVER=live: real platform pollers; written so far: youtube.
 *
 *  The poller is the third queue in this codebase and looks like the other
 *  two on purpose: claim a published job whose metrics_next_at has passed
 *  (FOR UPDATE SKIP LOCKED), push the clock forward in the same statement,
 *  capture, append a clip_metrics row. Capture failures just log and retry
 *  next cycle — a missed sample is not an incident, the series self-heals. */
import { q } from '../db/index.js';
import { id } from '../lib/ids.js';
import { decryptJson } from '../lib/crypto.js';
import * as local from './local.js';
import * as youtube from './youtube.js';

const LIVE = { youtube };
const DRIVER = process.env.METRICS_DRIVER || 'local';
const POLL_MS = Number(process.env.METRICS_POLL_MS || 2000);
const INTERVAL_S = Number(process.env.METRICS_CAPTURE_INTERVAL_S || 21600); // 6h

async function runDriver(ctx) {
  if (DRIVER === 'local') return local.capture(ctx);
  const adapter = LIVE[ctx.job.platform];
  if (!adapter) throw new Error(`no live metrics driver for ${ctx.job.platform} yet (METRICS_DRIVER=live)`);
  return adapter.capture({ ...ctx, connection: { ...ctx.connection, credentials: decryptJson(ctx.connection.credentials_enc) } });
}

/** Claim one published job due for a capture; the clock moves forward in the
 *  claim itself, so concurrent pollers can't double-sample. This is also why
 *  the metrics queue needs no visibility-timeout reaper (unlike the pipeline
 *  and publish queues, M5): a worker that dies mid-capture has already pushed
 *  metrics_next_at forward, so the post simply skips one sample and self-heals
 *  on the next interval — a missed capture is not an incident. */
async function claim() {
  const { rows } = await q(`
    UPDATE publish_jobs SET metrics_next_at = now() + ($1 || ' seconds')::interval
    WHERE id = (
      SELECT id FROM publish_jobs
      WHERE status = 'published' AND metrics_next_at IS NOT NULL AND metrics_next_at <= now()
      ORDER BY metrics_next_at
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    RETURNING *`, [String(INTERVAL_S)]);
  return rows[0] || null;
}

async function captureOne(job) {
  const { rows } = await q(`
    SELECT cl.id, cl.t_start_s, cl.t_end_s, cl.hook,
           pc.handle, pc.credentials_enc
    FROM clips cl
    JOIN publish_jobs pj ON pj.clip_id = cl.id
    LEFT JOIN platform_connections pc ON pc.id = pj.connection_id
    WHERE pj.id = $1`, [job.id]);
  const row = rows[0];
  if (!row) throw new Error('clip vanished');
  const m = await runDriver({
    job,
    clip: { id: row.id, t_start_s: row.t_start_s, t_end_s: row.t_end_s, hook: row.hook },
    connection: { handle: row.handle, credentials_enc: row.credentials_enc },
  });
  await q(`
    INSERT INTO clip_metrics (id, publish_id, views, watch_time_s, retention, likes, comments, shares, follows)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [id('met'), job.id, m.views, m.watch_time_s, m.retention, m.likes, m.comments, m.shares, m.follows]);
}

let running = false;
export function startMetricsPoller(concurrency = Number(process.env.METRICS_CONCURRENCY || 1)) {
  if (running) return;
  running = true;
  for (let i = 0; i < concurrency; i++) {
    (async function loop() {
      await new Promise((r) => setTimeout(r, Math.random() * POLL_MS));
      while (running) {
        try {
          const job = await claim();
          if (job) {
            try { await captureOne(job); }
            catch (e) { console.error(`[metrics] capture ${job.platform} ${job.clip_id} failed: ${e.message}`); }
            continue;
          }
        } catch (e) {
          console.error('[metrics] loop error:', e.message);
        }
        await new Promise((r) => setTimeout(r, POLL_MS));
      }
    })();
  }
  console.log(`[metrics] ${concurrency} capture loop(s) started (driver: ${DRIVER}, interval: ${INTERVAL_S}s)`);
}

export function stopMetricsPoller() { running = false; }

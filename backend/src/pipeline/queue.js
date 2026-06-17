/** Stage B3 — the pipeline runtime.
 *
 * pipeline_jobs IS the queue: workers claim pending rows with
 * FOR UPDATE SKIP LOCKED (safe under any number of workers), run the stage,
 * and enqueue the next one. Failures retry with exponential backoff up to
 * MAX_ATTEMPTS, then park as 'failed' — visible on the ops board, revivable
 * via POST /api/jobs/:recordingId/retry.
 *
 * Stage order is the company's operating system:
 *   ingest → transcribe → analyze → score → generate
 */
import { q } from '../db/index.js';
import { id } from '../lib/ids.js';

export const STAGES = ['ingest', 'transcribe', 'analyze', 'score', 'generate'];
const NEXT = Object.fromEntries(STAGES.map((s, i) => [s, STAGES[i + 1] || null]));
const MAX_ATTEMPTS = 3;
const POLL_MS = Number(process.env.PIPELINE_POLL_MS || 1000);
const VISIBILITY_TIMEOUT_S = Number(process.env.JOB_VISIBILITY_TIMEOUT_S || 300);
const REAP_INTERVAL_MS = Number(process.env.JOB_REAP_INTERVAL_MS || 5000);

const handlers = {};
export function register(stage, fn) { handlers[stage] = fn; }

/** Enqueue a stage for a recording (idempotent: re-arms an existing row). */
export async function enqueue(recordingId, stage = 'ingest') {
  await q(
    `INSERT INTO pipeline_jobs (id, recording_id, stage, status, attempts, run_after)
     VALUES ($1, $2, $3, 'pending', 0, now())
     ON CONFLICT (recording_id, stage) DO UPDATE
       SET status = 'pending', run_after = now(), error = NULL, dead_letter = false, updated_at = now()`,
    [id('job'), recordingId, stage]
  );
}

/** Re-arm every failed stage of a recording (the ops retry button). */
export async function retryRecording(recordingId) {
  const { rowCount } = await q(
    `UPDATE pipeline_jobs SET status = 'pending', run_after = now(), error = NULL,
            dead_letter = false, updated_at = now()
     WHERE recording_id = $1 AND status = 'failed'`, [recordingId]);
  if (rowCount) await q(`UPDATE recordings SET status = 'processing' WHERE id = $1`, [recordingId]);
  return rowCount;
}

/** Visibility-timeout reaper: a worker that dies mid-job leaves its row stuck
 *  in 'running' forever — nothing else will claim it. This sweep returns rows
 *  whose started_at is older than the timeout back to 'pending' (so any worker
 *  picks them up), or parks them as dead-letter if the attempt budget is spent.
 *  Cheap, indexed, idempotent — safe to run from every process. */
export async function reapStuck() {
  const { rows } = await q(
    `UPDATE pipeline_jobs
       SET status = CASE WHEN attempts >= $2 THEN 'failed' ELSE 'pending' END,
           dead_letter = (attempts >= $2),
           error = 'reaped: worker presumed dead (running > ' || $1 || 's with no completion)',
           run_after = now(), updated_at = now()
     WHERE status = 'running' AND started_at < now() - ($1 || ' seconds')::interval
     RETURNING recording_id, stage, status`,
    [String(VISIBILITY_TIMEOUT_S), MAX_ATTEMPTS]);
  for (const j of rows) {
    if (j.status === 'failed') await q(`UPDATE recordings SET status = 'failed' WHERE id = $1`, [j.recording_id]);
    console.warn(`[pipeline] reaped stuck ${j.stage} ${j.recording_id} → ${j.status}`);
  }
  return rows.length;
}

async function claim() {
  const { rows } = await q(`
    UPDATE pipeline_jobs SET status = 'running', started_at = now(), updated_at = now(),
                             attempts = attempts + 1
    WHERE id = (
      SELECT id FROM pipeline_jobs
      WHERE status = 'pending' AND run_after <= now()
      ORDER BY run_after
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    RETURNING id, recording_id, stage, attempts, payload`);
  return rows[0] || null;
}

async function runOne(job) {
  const handler = handlers[job.stage];
  try {
    if (!handler) throw new Error(`no handler for stage ${job.stage}`);
    const out = await handler(job.recording_id, job.payload || {});
    await q(`UPDATE pipeline_jobs SET status = 'done', finished_at = now(), updated_at = now(),
             error = NULL, payload = payload || $2 WHERE id = $1`, [job.id, out || {}]);
    const next = NEXT[job.stage];
    if (next) {
      await enqueue(job.recording_id, next);
    } else {
      await q(`UPDATE recordings SET status = 'ready' WHERE id = $1`, [job.recording_id]);
    }
  } catch (e) {
    const parked = job.attempts >= MAX_ATTEMPTS;
    const backoffS = Math.min(60, 2 ** job.attempts * 2);
    console.error(`[pipeline] ${job.stage} ${job.recording_id} attempt ${job.attempts} failed: ${e.message}`);
    await q(
      `UPDATE pipeline_jobs SET status = $2, error = $3, dead_letter = $5, updated_at = now(),
              run_after = now() + ($4 || ' seconds')::interval
       WHERE id = $1`,
      [job.id, parked ? 'failed' : 'pending', String(e.message).slice(0, 2000), String(backoffS), parked]
    );
    if (parked) await q(`UPDATE recordings SET status = 'failed' WHERE id = $1`, [job.recording_id]);
  }
}

let running = false;
/** In-process worker loop. One job at a time per loop; run several loops for
 *  concurrency, or run `npm run worker` as separate processes — SKIP LOCKED
 *  makes both safe. */
export function startWorkers(concurrency = Number(process.env.PIPELINE_CONCURRENCY || 1)) {
  if (running) return;
  running = true;
  for (let i = 0; i < concurrency; i++) {
    (async function loop() {
      // jittered start so loops don't poll in lockstep
      await new Promise((r) => setTimeout(r, Math.random() * POLL_MS));
      while (running) {
        try {
          const job = await claim();
          if (job) { await runOne(job); continue; } // drain without sleeping
        } catch (e) {
          console.error('[pipeline] loop error:', e.message);
        }
        await new Promise((r) => setTimeout(r, POLL_MS));
      }
    })();
  }
  // Reaper: one sweep on its own cadence (decoupled from the staleness timeout)
  // reclaims jobs orphaned by a crashed worker, so the pipeline self-heals.
  (async function reaper() {
    while (running) {
      await new Promise((r) => setTimeout(r, REAP_INTERVAL_MS));
      if (!running) break;
      try { await reapStuck(); } catch (e) { console.error('[pipeline] reaper error:', e.message); }
    }
  })();
  console.log(`[pipeline] ${concurrency} worker loop(s) started (+reaper, visibility ${VISIBILITY_TIMEOUT_S}s)`);
}

export function stopWorkers() { running = false; }

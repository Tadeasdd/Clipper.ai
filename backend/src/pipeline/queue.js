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

const handlers = {};
export function register(stage, fn) { handlers[stage] = fn; }

/** Enqueue a stage for a recording (idempotent: re-arms an existing row). */
export async function enqueue(recordingId, stage = 'ingest') {
  await q(
    `INSERT INTO pipeline_jobs (id, recording_id, stage, status, attempts, run_after)
     VALUES ($1, $2, $3, 'pending', 0, now())
     ON CONFLICT (recording_id, stage) DO UPDATE
       SET status = 'pending', run_after = now(), error = NULL, updated_at = now()`,
    [id('job'), recordingId, stage]
  );
}

/** Re-arm every failed stage of a recording (the ops retry button). */
export async function retryRecording(recordingId) {
  const { rowCount } = await q(
    `UPDATE pipeline_jobs SET status = 'pending', run_after = now(), error = NULL, updated_at = now()
     WHERE recording_id = $1 AND status = 'failed'`, [recordingId]);
  if (rowCount) await q(`UPDATE recordings SET status = 'processing' WHERE id = $1`, [recordingId]);
  return rowCount;
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
             payload = payload || $2 WHERE id = $1`, [job.id, out || {}]);
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
      `UPDATE pipeline_jobs SET status = $2, error = $3, updated_at = now(),
              run_after = now() + ($4 || ' seconds')::interval
       WHERE id = $1`,
      [job.id, parked ? 'failed' : 'pending', String(e.message).slice(0, 2000), String(backoffS)]
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
  console.log(`[pipeline] ${concurrency} worker loop(s) started`);
}

export function stopWorkers() { running = false; }

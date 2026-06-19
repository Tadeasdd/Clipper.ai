/* R5 chaos drill: a worker dies mid-pipeline → the system recovers within RTO.
 *
 *  Injects the wreckage a crashed worker leaves behind — a job stuck in
 *  'running' that nothing will ever claim — then starts the workers with a short
 *  visibility timeout and asserts the M5 reaper reclaims the orphan and drives
 *  the recording to 'ready' within the pipeline RTO, with zero lost work.
 *  Offline + deterministic.
 */
process.env.JOB_VISIBILITY_TIMEOUT_S = '2';   // reclaim orphans fast (prod default 300)
process.env.JOB_REAP_INTERVAL_MS = '400';
process.env.PIPELINE_POLL_MS = '200';

import pg from 'pg';

const assert = (cond, msg) => { if (!cond) { console.error('FAIL:', msg); process.exit(1); } console.log('ok:', msg); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const RTO_S = Number(process.env.CHAOS_RTO_S || 20);

const adminUrl = process.env.DATABASE_URL || 'postgres://clipper:clipper@localhost:5432/clipper';
const TEST_DB = 'clipper_chaos';
{
  const a = new pg.Client({ connectionString: adminUrl }); await a.connect();
  await a.query(`DROP DATABASE IF EXISTS ${TEST_DB} WITH (FORCE)`);
  await a.query(`CREATE DATABASE ${TEST_DB}`); await a.end();
  const u = new URL(adminUrl); u.pathname = `/${TEST_DB}`; process.env.DATABASE_URL = u.toString();
}

const { migrate, q, pool } = await import('../src/db/index.js');
const { register, startWorkers, drainWorkers, STAGES } = await import('../src/pipeline/queue.js');
const { id } = await import('../src/lib/ids.js');
await migrate();

// trivial succeeding handlers — the drill is about recovery, not stage logic
for (const stage of STAGES) register(stage, async () => ({}));

const cli = 'cli_chaos';
await q(`INSERT INTO clients (id, name, plan, cadence) VALUES ($1,'Chaos Co','growth','weekly')`, [cli]);
const rec = 'rec_chaos';
await q(`INSERT INTO recordings (id, client_id, kind, status, duration_s) VALUES ($1,$2,'podcast','processing',60)`, [rec, cli]);

// the wreckage of a crashed worker: an ingest job stuck 'running', started long
// ago, that no live worker will ever claim (claim only takes 'pending').
await q(`INSERT INTO pipeline_jobs (id, recording_id, stage, status, attempts, started_at)
         VALUES ($1,$2,'ingest','running',1, now() - interval '30 seconds')`, [id('job'), rec]);
assert((await q(`SELECT status FROM pipeline_jobs WHERE recording_id=$1`, [rec])).rows[0].status === 'running',
  'a crashed worker left an orphaned running job');

// recover
const t0 = Date.now();
startWorkers(1); // starts the worker loops + the reaper
let status = 'processing';
while ((Date.now() - t0) < RTO_S * 1000) {
  await sleep(300);
  status = (await q(`SELECT status FROM recordings WHERE id=$1`, [rec])).rows[0].status;
  if (status === 'ready' || status === 'failed') break;
}
const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
await drainWorkers(5000);

assert(status === 'ready', `the reaper reclaimed the orphan and the pipeline completed (status=${status})`);
assert(Number(elapsed) < RTO_S, `recovered within the pipeline RTO (${elapsed}s < ${RTO_S}s)`);
const stuck = (await q(`SELECT count(*)::int n FROM pipeline_jobs WHERE status='running'`)).rows[0].n;
assert(stuck === 0, 'no job is left stuck in running — zero lost work');

await pool.end();
console.log(`\nR5 chaos drill passed: a worker crash mid-pipeline self-healed via the reaper, recording reached ready in ${elapsed}s (RTO ${RTO_S}s).`);
process.exit(0);

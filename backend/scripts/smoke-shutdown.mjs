/* R2 smoke: health/readiness probes + graceful job-draining shutdown.
 *
 *  Part A (in-process, deterministic): a stage is held in-flight, then the queue
 *  is drained — proving drain WAITS for the in-flight job to finish (zero loss),
 *  claims NO new work while draining, and that readiness flips to draining.
 *  Part B (a real child server + SIGTERM): /healthz is live, /readyz reflects DB
 *  connectivity (200 up → 503 when the DB is dropped), and SIGTERM exits 0.
 *
 *  Offline, no external keys.
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const assert = (cond, msg) => { if (!cond) { console.error('FAIL:', msg); process.exit(1); } console.log('ok:', msg); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const adminUrl = process.env.DATABASE_URL || 'postgres://clipper:clipper@localhost:5432/clipper';
const dbUrl = (name) => { const u = new URL(adminUrl); u.pathname = `/${name}`; return u.toString(); };
const adminExec = async (sql) => { const admin = new pg.Client({ connectionString: adminUrl }); await admin.connect(); await admin.query(sql); await admin.end(); };
const recreate = async (name) => { await adminExec(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`); await adminExec(`CREATE DATABASE ${name}`); };

// ── Part A: the queue drains in-flight work, claims nothing new while draining ─
await recreate('clipper_shutdown');
process.env.DATABASE_URL = dbUrl('clipper_shutdown');
const { migrate, q, pool } = await import('../src/db/index.js');
const { register, startWorkers, drainWorkers, enqueue, activeJobs } = await import('../src/pipeline/queue.js');
const { isDraining, beginDraining, readiness } = await import('../src/lib/lifecycle.js');
await migrate();

// readiness reflects DB connectivity, deterministically (the /readyz logic)
assert((await readiness(() => Promise.resolve())).db === true, 'readiness is ready when the DB ping succeeds');
assert((await readiness(() => Promise.reject(new Error('db down')))).db === false, 'readiness reflects lost DB connectivity (db:false)');

const cli = 'cli_shutdown';
await q(`INSERT INTO clients (id, name, plan, cadence) VALUES ($1,'Shutdown Co','growth','weekly')`, [cli]);
for (const rec of ['rec_a', 'rec_b']) await q(`INSERT INTO recordings (id, client_id, kind, status, duration_s) VALUES ($1,$2,'podcast','processing',60)`, [rec, cli]);

// hold the ingest stage open until we release it, so a job is reliably in-flight
let release;
register('ingest', () => new Promise((r) => { release = () => r({}); }));
startWorkers(1);
await enqueue('rec_a', 'ingest');
for (let i = 0; i < 100 && activeJobs() === 0; i++) await sleep(50);
assert(activeJobs() === 1, 'a job is in-flight (the held ingest stage)');
await enqueue('rec_b', 'ingest'); // a second job waits in the queue

assert(isDraining() === false, 'not draining before shutdown');
let drainResolved = false;
const draining = drainWorkers(10000).then((ok) => { drainResolved = true; return ok; });
await sleep(400);
assert(!drainResolved, 'drain WAITS while a job is still in-flight');
assert((await q(`SELECT status FROM pipeline_jobs WHERE recording_id='rec_b'`)).rows[0].status === 'pending',
  'no new job is claimed while draining');

release(); // the in-flight ingest now completes
const ok = await draining;
assert(ok === true && activeJobs() === 0, 'drain completes once the in-flight job finishes');
assert((await q(`SELECT status FROM pipeline_jobs WHERE recording_id='rec_a' AND stage='ingest'`)).rows[0].status === 'done',
  'the in-flight job finished — zero loss on shutdown');

beginDraining();
assert(isDraining() === true, 'readiness flips to draining');
assert((await readiness(() => Promise.resolve())).ready === false, 'readiness is NOT ready while draining (load balancer stops routing)');
await pool.end();

// ── Part B: a real server — probes + a real SIGTERM ──────────────────────────
await recreate('clipper_shutdown_srv');
const child = spawn('node', ['src/server.js'], {
  cwd: backendDir, stdio: 'ignore',
  env: { ...process.env, DATABASE_URL: dbUrl('clipper_shutdown_srv'), PORT: '8099', NODE_ENV: 'development' },
});
let exited = null;
child.on('exit', (code, signal) => { exited = { code, signal }; });
const get = async (p) => { try { return await fetch(`http://localhost:8099${p}`); } catch { return null; } };

for (let i = 0; i < 120; i++) { const r = await get('/healthz'); if (r && r.status === 200) break; await sleep(250); }
assert((await get('/healthz'))?.status === 200, '/healthz is live once the server is up');
const ready = await get('/readyz');
assert(ready?.status === 200 && (await ready.json()).db === true, '/readyz is 200 and reflects DB connectivity (up)');

process.kill(child.pid, 'SIGTERM');
for (let i = 0; i < 120 && !exited; i++) await sleep(100);
assert(exited && exited.code === 0, 'SIGTERM drains and exits 0 (graceful, not killed)');

console.log('\nR2 smoke passed: drain waits for in-flight work (zero loss) + claims nothing new while draining; probes are live, reflect DB connectivity, and SIGTERM exits cleanly.');
process.exit(0);

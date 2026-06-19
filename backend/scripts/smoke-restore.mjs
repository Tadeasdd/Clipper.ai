/* R5 smoke: the restore drill reproduces the DB to a point in time.
 *
 *  Snapshot the database at point T, move it on (insert + delete rows), then
 *  restore the T snapshot into a fresh database and assert it is reproduced
 *  EXACTLY to T — the deleted row is back, the rows added after T are absent,
 *  and a related row (a clip) restored too. Portable (no pg_dump): uses the
 *  binary-free logical engine. An untested backup is not a backup.
 */
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const assert = (cond, msg) => { if (!cond) { console.error('FAIL:', msg); process.exit(1); } console.log('ok:', msg); };
const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const adminUrl = process.env.DATABASE_URL || 'postgres://clipper:clipper@localhost:5432/clipper';
const urlFor = (name) => { const u = new URL(adminUrl); u.pathname = `/${name}`; return u.toString(); };
const adminExec = async (sql) => { const a = new pg.Client({ connectionString: adminUrl }); await a.connect(); await a.query(sql); await a.end(); };
const recreate = async (n) => { await adminExec(`DROP DATABASE IF EXISTS ${n} WITH (FORCE)`); await adminExec(`CREATE DATABASE ${n}`); };
const count = async (url, sql, params = []) => { const c = new pg.Client({ connectionString: url }); await c.connect(); try { return (await c.query(sql, params)).rows; } finally { await c.end(); } };

const SRC = 'clipper_dr_src';
const DST = 'clipper_dr_restore';
await recreate(SRC);
await recreate(DST);
const srcUrl = urlFor(SRC);
const dstUrl = urlFor(DST);
process.env.DATABASE_URL = srcUrl;

const { migrate, q, pool } = await import('../src/db/index.js');
const { snapshot, restore, rowCounts } = await import('../ops/backup/snapshot.mjs');
await migrate();

// ── seed point T: a client, 3 recordings, a clip on the first ────────────────
const cli = 'cli_dr';
await q(`INSERT INTO clients (id, name, plan, cadence) VALUES ($1,'DR Co','growth','weekly')`, [cli]);
for (const r of ['rec_keep1', 'rec_keep2', 'rec_del']) await q(`INSERT INTO recordings (id, client_id, kind, status, duration_s) VALUES ($1,$2,'podcast','ready',120)`, [r, cli]);
await q(`INSERT INTO clips (id, recording_id, t_start_s, t_end_s, score, signals, status) VALUES ('clip_dr','rec_keep1',10,40,80,'{}','approved')`);
const snap = await snapshot(srcUrl);
const tCounts = rowCounts(snap);
assert(tCounts.recordings === 3 && tCounts.clips === 1, `snapshot captured point T (3 recordings, 1 clip)`);

// ── move the source on: delete one, add two (so it diverges from T) ──────────
await q(`DELETE FROM clips WHERE recording_id='rec_del'`);
await q(`DELETE FROM recordings WHERE id='rec_del'`);
await q(`INSERT INTO recordings (id, client_id, kind, status, duration_s) VALUES ('rec_new1',$1,'podcast','ready',60),('rec_new2',$1,'podcast','ready',60)`, [cli]);
assert((await count(srcUrl, `SELECT count(*)::int n FROM recordings`))[0].n === 4, 'the source database moved past T (now 4 recordings)');

// ── restore the T snapshot into a fresh, migrated database ───────────────────
execFileSync('node', ['-e', "import('./src/db/index.js').then(m=>m.migrate()).then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1)})"],
  { cwd: backendDir, env: { ...process.env, DATABASE_URL: dstUrl }, stdio: 'pipe' });
await restore(dstUrl, snap);

// ── the restored DB is reproduced exactly to T ───────────────────────────────
assert((await count(dstUrl, `SELECT count(*)::int n FROM recordings`))[0].n === 3, 'the restore reproduced T (3 recordings, not the source\'s 4)');
assert((await count(dstUrl, `SELECT 1 FROM recordings WHERE id='rec_del'`)).length === 1, 'a row deleted after T is present in the restore');
assert((await count(dstUrl, `SELECT 1 FROM recordings WHERE id='rec_new1'`)).length === 0, 'a row created after T is absent from the restore');
assert((await count(dstUrl, `SELECT 1 FROM clips WHERE id='clip_dr'`)).length === 1, 'a related row (the clip) restored too');

await pool.end();
console.log('\nR5 restore drill passed: a snapshot restores the database exactly to its point in time — deletions reappear, later writes are gone, relations intact.');
process.exit(0);

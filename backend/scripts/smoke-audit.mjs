/* O5 smoke: system-wide audit & activity feed.
 *
 *  Offline + deterministic (isolated DB). Writes audit rows across areas and
 *  asserts:
 *   - audit() appends (the log is append-only, newest-first);
 *   - the ops feed returns everything and filters by area + client;
 *   - the client feed is correctly scoped — a client sees only their own
 *     client_visible rows, never internal-only actions or another client's.
 */
import pg from 'pg';

const assert = (cond, msg) => { if (!cond) { console.error('FAIL:', msg); process.exit(1); } console.log('ok:', msg); };
const adminUrl = process.env.DATABASE_URL || 'postgres://clipper:clipper@localhost:5432/clipper';
const TEST_DB = 'clipper_audit';
{
  const admin = new pg.Client({ connectionString: adminUrl });
  await admin.connect();
  await admin.query(`DROP DATABASE IF EXISTS ${TEST_DB} WITH (FORCE)`);
  await admin.query(`CREATE DATABASE ${TEST_DB}`);
  await admin.end();
  const u = new URL(adminUrl); u.pathname = `/${TEST_DB}`;
  process.env.DATABASE_URL = u.toString();
}

const { migrate, q, pool } = await import('../src/db/index.js');
const { id } = await import('../src/lib/ids.js');
const { audit, auditFeed, clientFeed } = await import('../src/lib/audit.js');
await migrate();

const A = id('cli'); const B = id('cli');
await q(`INSERT INTO clients (id, name, cadence) VALUES ($1,'Client A','weekly'),($2,'Client B','weekly')`, [A, B]);
const u1 = id('usr');
await q(`INSERT INTO users (id, email, role) VALUES ($1,'op@clipper.ai','ops')`, [u1]);

// ── write rows across areas ──────────────────────────────────────────────────
await audit('intake', 'content_submitted', { clientId: A, entityType: 'recording', entityId: 'rec_a', summary: 'A submitted content', clientVisible: true });
await audit('admin', 'login_success', { actorId: u1, actorRole: 'ops', clientId: A, entityType: 'user', entityId: u1, summary: 'ops signed in', clientVisible: false });
await audit('publish', 'clip_published', { clientId: B, entityType: 'clip', entityId: 'clip_b', summary: 'B clip published', clientVisible: true });

// ── ops feed: everything, newest first ───────────────────────────────────────
let feed = await auditFeed();
assert(feed.length === 3, 'ops feed returns every audited action (3)');
assert(feed[0].ts >= feed[feed.length - 1].ts, 'feed is newest-first');

// ── ops feed: filter by area + client ────────────────────────────────────────
assert((await auditFeed({ area: 'publish' })).every((e) => e.area === 'publish'), 'ops feed filters by area');
const aFeed = await auditFeed({ clientId: A });
assert(aFeed.length === 2 && aFeed.every((e) => e.client_id === A), 'ops feed filters by client (sees A\'s internal + visible rows)');

// ── client feed: correctly scoped ────────────────────────────────────────────
const aClient = await clientFeed(A);
assert(aClient.length === 1 && aClient[0].action === 'content_submitted', 'client A sees only their client_visible row');
assert(!aClient.some((e) => e.action === 'login_success'), 'client A never sees the internal-only admin row');
const bClient = await clientFeed(B);
assert(bClient.length === 1 && bClient[0].action === 'clip_published', 'client B sees only their own row');
assert(!bClient.some((e) => e.entity_id === 'rec_a'), 'client B never sees client A\'s activity');

// ── append-only: another action grows the log, nothing mutates ───────────────
await audit('billing', 'usage_reported', { clientId: B, entityType: 'usage', entityId: 'bill_b', summary: 'usage reported' });
feed = await auditFeed();
assert(feed.length === 4, 'a new action appends (log grows to 4)');

await pool.end();
console.log('\nO5 smoke passed: every action lands in the append-only audit log, the ops feed filters by area + client, and the client feed is correctly scoped to its own client_visible rows — all offline.');
process.exit(0);

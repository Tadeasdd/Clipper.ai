/* O4 smoke: lifecycle notifications + client comms (NOTIFY_DRIVER=log, offline).
 *
 *  Offline + deterministic (isolated DB). Asserts:
 *   - each lifecycle event records an auditable delivery row (sent, log channel,
 *     with rendered subject);
 *   - opt-out is honored — global opt-out and per-event opt-out both record a
 *     'skipped' row and send nothing, while other events still send;
 *   - the SLA-risk sweep emits one notice per overdue/undelivered recording and
 *     dedups on a second pass;
 *   - notificationsFor returns the client's feed.
 */
import pg from 'pg';

const assert = (cond, msg) => { if (!cond) { console.error('FAIL:', msg); process.exit(1); } console.log('ok:', msg); };
const adminUrl = process.env.DATABASE_URL || 'postgres://clipper:clipper@localhost:5432/clipper';
const TEST_DB = 'clipper_notify';
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
const { notify, notificationsFor, slaWatchTick } = await import('../src/notify/index.js');
await migrate();

const A = id('cli');
await q(`INSERT INTO clients (id, name, plan, cadence) VALUES ($1,'Comms Co','growth','weekly')`, [A]);
const rA = id('rec');
await q(`INSERT INTO recordings (id, client_id, kind, status, duration_s) VALUES ($1,$2,'podcast','ready',180)`, [rA, A]);
const cA = id('clip');
await q(`INSERT INTO clips (id, recording_id, t_start_s, t_end_s, score, signals, status) VALUES ($1,$2,10,40,80,'{}','awaiting_client')`, [cA, rA]);

const latest = async (event) => (await q(`SELECT * FROM notifications WHERE client_id=$1 AND event=$2 ORDER BY created_at DESC LIMIT 1`, [A, event])).rows[0];

// ── each lifecycle event records a delivery row ──────────────────────────────
let res = await notify('content_received', { clientId: A, recordingId: rA });
assert(res.status === 'sent', 'content_received sends');
let row = await latest('content_received');
assert(row && row.channel === 'log' && row.status === 'sent' && row.subject === 'We received your content', 'content_received logged with channel + rendered subject');

res = await notify('ready_for_approval', { clientId: A, clipId: cA });
assert(res.status === 'sent' && (await latest('ready_for_approval')).status === 'sent', 'ready_for_approval sends + logs');

res = await notify('published', { clientId: A, clipId: cA });
assert(res.status === 'sent' && (await latest('published')).status === 'sent', 'published sends + logs');

// unknown event is handled, not thrown
assert((await notify('not_an_event', { clientId: A })).status === 'error', 'an unknown event is rejected, not thrown');

// ── opt-out: global ──────────────────────────────────────────────────────────
await q(`UPDATE clients SET notify_prefs = '{"optOut":true}' WHERE id=$1`, [A]);
res = await notify('published', { clientId: A, clipId: cA });
assert(res.status === 'skipped' && (await latest('published')).status === 'skipped', 'global opt-out records a skipped row, sends nothing');

// ── opt-out: per-event (published off, content_received still on) ────────────
await q(`UPDATE clients SET notify_prefs = '{"events":{"published":false}}' WHERE id=$1`, [A]);
res = await notify('published', { clientId: A, clipId: cA });
assert(res.status === 'skipped', 'per-event opt-out skips that event');
res = await notify('content_received', { clientId: A, recordingId: rA });
assert(res.status === 'sent', 'a non-opted-out event still sends under per-event prefs');

// ── SLA-risk sweep: one notice per overdue/undelivered recording, then dedup ──
const rOverdue = id('rec');
await q(`INSERT INTO recordings (id, client_id, kind, status, duration_s, created_at) VALUES ($1,$2,'podcast','processing',180, now() - interval '100 hours')`, [rOverdue, A]);
const first = await slaWatchTick();
assert(first.emitted === 1, `SLA sweep emits one sla_risk for the overdue recording (${first.emitted})`);
const second = await slaWatchTick();
assert(second.emitted === 0, 'a second sweep emits nothing (deduped via the log)');
const slaRow = (await q(`SELECT * FROM notifications WHERE event='sla_risk' AND recording_id=$1`, [rOverdue])).rows;
assert(slaRow.length === 1 && slaRow[0].subject === 'Delivery is running behind', 'exactly one sla_risk notice, with its subject');

// ── feed ─────────────────────────────────────────────────────────────────────
const feed = await notificationsFor(A);
assert(feed.length >= 5 && feed[0].created_at >= feed[feed.length - 1].created_at, 'notificationsFor returns the client feed, newest first');

await pool.end();
console.log('\nO4 smoke passed: lifecycle events emit logged notifications, opt-out (global + per-event) is honored, and the SLA-risk sweep fires once per overdue recording — all offline under the log driver.');
process.exit(0);

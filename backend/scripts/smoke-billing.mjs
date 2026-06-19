/* E4 smoke: metered outcomes billing (BILLING_DRIVER=dry-run, fully offline).
 *
 *  Proves, end-to-end with zero external keys/network:
 *   - a DELIVERED clip creates a billable usage record at publish time;
 *   - delivery of one clip to TWO platforms bills exactly ONCE (idempotent on
 *     clip_id);
 *   - reconcile reports pending outcomes to the provider (dry-run → labeled
 *     synthetic ref) and is itself idempotent (a second sweep reports zero);
 *   - the per-client outcome rollup is visible on the ops API;
 *   - the webhook verifies its HMAC signature (valid → 200 + stored once;
 *     tampered/missing → 400; replayed event id → 200 but stored once).
 *
 *  Seeds two scheduled publish_jobs for one clip directly (race-free) and lets
 *  the in-process publisher deliver them — the real scheduler path that emits
 *  the billable outcome.
 */
import pg from 'pg';
import { createHmac } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const BASE = process.env.BASE || 'http://localhost:8080';
const STORAGE = process.env.STORAGE_DIR || path.resolve('storage');
// Must match the server's webhook secret. Both default to this dev value when
// BILLING_WEBHOOK_SECRET is unset (the documented, non-secret offline default).
const WEBHOOK_SECRET = process.env.BILLING_WEBHOOK_SECRET
  || 'dev-billing-webhook-secret — set BILLING_WEBHOOK_SECRET in production';

const db = new pg.Pool({ connectionString: process.env.DATABASE_URL || 'postgres://clipper:clipper@localhost:5432/clipper' });
const assert = (cond, msg) => { if (!cond) { console.error('FAIL:', msg); process.exit(1); } console.log('ok:', msg); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const uid = () => Math.random().toString(36).slice(2, 8);

import { opsSession } from './lib-smoke-auth.mjs';
const OPS = await opsSession(BASE);
const j = async (method, p, body, headers = {}) => {
  const res = await fetch(BASE + p, {
    method,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${OPS}`, ...headers },
    body: body === undefined ? undefined : (typeof body === 'string' ? body : JSON.stringify(body)),
  });
  return { status: res.status, data: await res.json().catch(() => ({})) };
};

// ── seed: client, recording, an approved clip with a rendered asset ──────────
const run = uid();
const cli = (await j('POST', '/api/clients', { name: `E4 Billing Co ${run}` })).data.id;
const rec = `rec_bill_${run}`;
await db.query(`INSERT INTO recordings (id, client_id, kind, status, duration_s) VALUES ($1,$2,'podcast','ready',180)`, [rec, cli]);

const clip = `clip_bill_${run}`;
const assetKey = `${rec}/clips/${clip}.mp4`;
mkdirSync(path.join(STORAGE, rec, 'clips'), { recursive: true });
writeFileSync(path.join(STORAGE, assetKey), Buffer.from(`fake-mp4-bytes-${clip}`));
await db.query(
  `INSERT INTO clips (id, recording_id, t_start_s, t_end_s, score, hook, format, asset_key, status)
   VALUES ($1,$2,30,62,88,$3,'9:16',$4,'scheduled')`,
  [clip, rec, `Billing smoke hook ${run}`, assetKey]);

// two active connections → two deliveries of the SAME clip
const mkConn = async (platform) => {
  const r = await j('POST', '/api/publish/connections', { clientId: cli, platform, handle: `@e4_${platform}`, credentials: { refreshToken: `tok-${run}` } });
  assert(r.status === 201, `created ${platform} connection`);
  return r.data.id;
};
const ytConn = await mkConn('youtube');
const ttConn = await mkConn('tiktok');

// seed both scheduled publish_jobs directly (race-free) — the publisher delivers them
for (const [platform, conn] of [['youtube', ytConn], ['tiktok', ttConn]]) {
  await db.query(
    `INSERT INTO publish_jobs (id, clip_id, connection_id, platform, scheduled_at, run_after, status, scheduled_by)
     VALUES ($1,$2,$3,$4, now(), now(), 'scheduled', NULL)`,
    [`pub_${platform}_${run}`, clip, conn, platform]);
}

// ── wait for both deliveries to complete ─────────────────────────────────────
let deadline = Date.now() + 30_000;
for (;;) {
  await sleep(800);
  const { rows } = await db.query(`SELECT status FROM publish_jobs WHERE clip_id=$1`, [clip]);
  if (rows.length === 2 && rows.every((r) => r.status === 'published')) break;
  if (Date.now() > deadline) { console.error('FAIL: both deliveries never completed', rows); process.exit(1); }
}
const clipStatus = (await db.query(`SELECT status FROM clips WHERE id=$1`, [clip])).rows[0].status;
assert(clipStatus === 'published', 'the clip is delivered (published)');

// ── a delivered clip → exactly ONE billable outcome (idempotent on clip_id) ──
// Status is left status-agnostic here: the background reporter may already have
// reported it. The deterministic claim is one outcome per delivered clip.
let usage = (await db.query(`SELECT * FROM billing_usage WHERE clip_id=$1`, [clip])).rows;
assert(usage.length === 1, 'two-platform delivery of one clip created exactly ONE billable outcome');
assert(usage[0].kind === 'clip_delivered' && usage[0].quantity === 1, 'the outcome is a clip_delivered, quantity 1');
assert(usage[0].client_id === cli, 'the outcome rolls up to the client');

// ── reconcile: flush any pending outcomes to the provider (dry-run) ──────────
// reconcile is synchronous, so once it returns the outcome is reported (whether
// by this sweep or the background reporter that already ran).
const rec1 = await j('POST', '/api/billing/reconcile', {});
assert(rec1.status === 200 && typeof rec1.data.reported === 'number', 'reconcile runs and returns reported/failed counts');
usage = (await db.query(`SELECT * FROM billing_usage WHERE clip_id=$1`, [clip])).rows;
assert(usage[0].status === 'reported' && usage[0].provider === 'dry-run' && /^dryrun_/.test(usage[0].provider_ref),
  'the outcome is reported with the dry-run provider and a labeled synthetic ref');
assert(usage[0].reported_at !== null, 'reported_at is stamped');

// ── reconcile is idempotent: a second sweep reports nothing new ──────────────
const before = usage[0].provider_ref;
const rec2 = await j('POST', '/api/billing/reconcile', {});
assert(rec2.status === 200 && rec2.data.reported === 0, 'a second reconcile reports zero (already reported — idempotent)');
const afterRef = (await db.query(`SELECT provider_ref FROM billing_usage WHERE clip_id=$1`, [clip])).rows[0].provider_ref;
assert(afterRef === before, 'the reported outcome is unchanged by re-reconcile');

// ── ops visibility: per-client outcome rollup ────────────────────────────────
const summary = (await j('GET', '/api/billing/usage')).data;
const mine = summary.clients.find((c) => c.client_id === cli);
assert(summary.driver === 'dry-run', 'usage summary reports the active driver');
assert(mine && mine.reported >= 1 && mine.pending === 0, 'the client shows a reported billable outcome and no pending');

// ── webhook: signature verification (offline, deterministic) ─────────────────
const sign = (body, t = Math.floor(Date.now() / 1000)) =>
  `t=${t},v1=${createHmac('sha256', WEBHOOK_SECRET).update(`${t}.${body}`).digest('hex')}`;

const evtId = `evt_${run}`;
const payload = JSON.stringify({ id: evtId, type: 'invoice.finalized', data: { amount_due: 49900 } });

// valid signature → 200, stored once
let wh = await j('POST', '/api/billing/webhook', payload, { 'stripe-signature': sign(payload) });
assert(wh.status === 200 && wh.data.received === true && wh.data.stored === true, 'a validly-signed webhook is accepted and stored');
const evt = (await db.query(`SELECT type FROM billing_events WHERE id=$1`, [evtId])).rows;
assert(evt.length === 1 && evt[0].type === 'invoice.finalized', 'the event lands in billing_events');

// replay the same event id → 200 but NOT stored again (idempotent)
wh = await j('POST', '/api/billing/webhook', payload, { 'stripe-signature': sign(payload) });
assert(wh.status === 200 && wh.data.stored === false, 'a replayed event is acknowledged but stored only once (idempotent)');
const count = (await db.query(`SELECT count(*)::int n FROM billing_events WHERE id=$1`, [evtId])).rows[0].n;
assert(count === 1, 'still exactly one stored event after replay');

// tampered body (signature no longer matches) → 400
wh = await j('POST', '/api/billing/webhook', payload.replace('49900', '1'), { 'stripe-signature': sign(payload) });
assert(wh.status === 400, 'a tampered body fails signature verification (400)');

// missing signature → 400
wh = await j('POST', '/api/billing/webhook', payload);
assert(wh.status === 400, 'a webhook with no signature is rejected (400)');

// stale timestamp (outside the replay window) → 400
wh = await j('POST', '/api/billing/webhook', payload, { 'stripe-signature': sign(payload, Math.floor(Date.now() / 1000) - 100000) });
assert(wh.status === 400, 'a stale signed payload is rejected (replay window)');

await db.end();
console.log('\nE4 smoke passed: delivered clips create one reconciled billable outcome each (idempotent), reconcile is idempotent, and the webhook verifies signatures — all offline under the dry-run driver.');
process.exit(0);

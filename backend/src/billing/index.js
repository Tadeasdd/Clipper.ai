/** E4 — metered outcomes billing, behind one env seam.
 *
 *  BILLING_DRIVER=dry-run (default): record outcomes + mark them reported with a
 *    labeled synthetic reference. Zero keys, zero network — CI and offline dev
 *    stay green.
 *  BILLING_DRIVER=stripe: report delivered outcomes to Stripe's Billing Meter
 *    Events API (additive, same seam).
 *
 *  The billable outcome is a DELIVERED CLIP. recordOutcome lands a `pending`
 *  row at the moment a clip is published (idempotent on clip_id, so multi-
 *  platform delivery bills once); flushPending reports pending rows to the
 *  provider. Two anchors keep it reconcilable and impossible to double-bill:
 *  clip_id is UNIQUE (one outcome per clip) and the provider call carries an
 *  Idempotency-Key of the row id (a retried report is deduped provider-side). */
import { createHmac, timingSafeEqual } from 'node:crypto';
import { q } from '../db/index.js';
import { id } from '../lib/ids.js';
import { log } from '../lib/log.js';
import { audit } from '../lib/audit.js';
import * as dryrun from './dryrun.js';
import * as stripe from './stripe.js';

const DRIVER = process.env.BILLING_DRIVER || 'dry-run';
const driver = () => (DRIVER === 'stripe' ? stripe : dryrun);

// Dev default exists so offline runs and CI are zero-config; like crypto.js's
// key this is NOT a secret — deployments MUST set BILLING_WEBHOOK_SECRET.
const webhookSecret = () =>
  process.env.BILLING_WEBHOOK_SECRET || 'dev-billing-webhook-secret — set BILLING_WEBHOOK_SECRET in production';
const SIG_TOLERANCE_S = Number(process.env.BILLING_WEBHOOK_TOLERANCE_S || 300);

/** A clip was just delivered. Land a pending billable outcome — best-effort and
 *  idempotent: ON CONFLICT (clip_id) DO NOTHING means a clip published to many
 *  platforms (or a retried publish) bills exactly once, and a billing hiccup
 *  never fails the publish (mirrors the E1 cost ledger). */
export async function recordOutcome({ clipId, publishId, clientId }) {
  try {
    const { rows } = await q(
      `INSERT INTO billing_usage (id, client_id, clip_id, publish_id, kind, quantity, status)
       VALUES ($1, $2, $3, $4, 'clip_delivered', 1, 'pending')
       ON CONFLICT (clip_id) DO NOTHING
       RETURNING id`,
      [id('bill'), clientId || null, clipId, publishId || null]);
    return rows[0]?.id || null;
  } catch (e) {
    log.warn('billing outcome record failed', { clipId, publishId, error: e.message });
    return null;
  }
}

/** Report one pending outcome through the active driver, stamping the result.
 *  Reported rows carry the provider + its reference; a driver failure parks the
 *  row as 'failed' with the reason so it's visible and retryable next sweep. */
async function reportOne(row) {
  try {
    let account = null;
    if (DRIVER === 'stripe') {
      const { rows } = await q('SELECT * FROM billing_accounts WHERE client_id = $1', [row.client_id]);
      account = rows[0] || null;
    }
    const { provider, providerRef } = await driver().report(row, account);
    await q(
      `UPDATE billing_usage SET status = 'reported', provider = $2, provider_ref = $3,
              error = NULL, reported_at = now() WHERE id = $1`,
      [row.id, provider, providerRef]);
    await audit('billing', 'usage_reported', { clientId: row.client_id, entityType: 'usage', entityId: row.id, // O5
      summary: `Outcome reported via ${provider}`, meta: { provider, providerRef, clipId: row.clip_id } });
    return { id: row.id, status: 'reported' };
  } catch (e) {
    await q(`UPDATE billing_usage SET status = 'failed', error = $2 WHERE id = $1`,
      [row.id, String(e.message).slice(0, 2000)]);
    log.warn('billing report failed', { usageId: row.id, error: e.message });
    return { id: row.id, status: 'failed', error: e.message };
  }
}

/** Flush pending outcomes to the provider. Reporting moves each row out of
 *  'pending', so this is naturally idempotent — a second pass over the same
 *  data reports zero. Concurrent sweeps can't double-bill: the provider call
 *  carries Idempotency-Key = row id. Returns the reported/failed counts. */
export async function flushPending(limit = Number(process.env.BILLING_FLUSH_BATCH || 100)) {
  const { rows } = await q(
    `SELECT * FROM billing_usage WHERE status = 'pending' ORDER BY created_at LIMIT $1`, [limit]);
  let reported = 0, failed = 0;
  for (const row of rows) {
    const out = await reportOne(row);
    if (out.status === 'reported') reported++; else failed++;
  }
  return { reported, failed };
}

/** Per-client rollup of billable outcomes (pending vs reported) — ops visibility. */
export async function usageSummary() {
  const { rows } = await q(`
    SELECT c.id AS client_id, c.name AS client,
           COALESCE(sum(bu.quantity), 0)::int AS outcomes,
           COALESCE(sum(bu.quantity) FILTER (WHERE bu.status = 'reported'), 0)::int AS reported,
           COALESCE(sum(bu.quantity) FILTER (WHERE bu.status = 'pending'), 0)::int AS pending,
           COALESCE(sum(bu.quantity) FILTER (WHERE bu.status = 'failed'), 0)::int AS failed
    FROM clients c
    JOIN billing_usage bu ON bu.client_id = c.id
    GROUP BY c.id, c.name
    ORDER BY outcomes DESC`);
  return { driver: DRIVER, clients: rows };
}

/* ── webhook signature verification (Stripe `t=…,v1=…` scheme) ─────────────────
 *  Verified over the RAW request body (server.js stashes req.rawBody), the same
 *  HMAC-SHA256 + timing-safe compare pattern as the publish OAuth state guard.
 *  Works fully offline with the dev secret, so the verification path is testable
 *  in CI without Stripe. */
function expectedSig(timestamp, rawBody) {
  return createHmac('sha256', webhookSecret()).update(`${timestamp}.${rawBody}`).digest('hex');
}

/** Verify a Stripe-style signature header against the raw body. Returns the
 *  parsed event on success, or null on any failure (bad format, stale timestamp,
 *  signature mismatch). Never throws — the route maps null → 400. */
export function verifyWebhook(rawBody, signatureHeader) {
  try {
    const body = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody || '');
    const parts = Object.fromEntries(
      String(signatureHeader || '').split(',').map((p) => p.split('=').map((s) => s.trim())));
    const t = Number(parts.t);
    if (!t || !parts.v1) return null;
    if (Math.abs(Math.floor(Date.now() / 1000) - t) > SIG_TOLERANCE_S) return null; // replay window
    const expected = expectedSig(parts.t, body);
    const a = Buffer.from(parts.v1), b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    return JSON.parse(body);
  } catch {
    return null;
  }
}

/** Sign a raw body the way a provider would — used by tests/tooling to exercise
 *  the verification path offline. Returns the `t=…,v1=…` header value. */
export function signWebhook(rawBody, timestamp = Math.floor(Date.now() / 1000)) {
  const body = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody || '');
  return `t=${timestamp},v1=${expectedSig(String(timestamp), body)}`;
}

/** Store an inbound event idempotently (the provider retries deliveries; we
 *  persist once). Returns true if newly stored, false if already seen. */
export async function ingestEvent(event) {
  if (!event?.id || !event?.type) throw new Error('event missing id/type');
  const { rows } = await q(
    `INSERT INTO billing_events (id, type, payload) VALUES ($1, $2, $3)
     ON CONFLICT (id) DO NOTHING RETURNING id`,
    [event.id, event.type, JSON.stringify(event)]);
  return rows.length > 0;
}

/* ── background reporter ───────────────────────────────────────────────────────
 *  A thin loop that flushes pending outcomes on an interval, the same shape as
 *  the metrics poller. Under dry-run it just stamps synthetic refs; a missed
 *  sweep self-heals on the next tick (pending rows stay claimable). */
let timer = null;
const INTERVAL_MS = Number(process.env.BILLING_REPORT_INTERVAL_MS || 5000);

export function startBillingReporter() {
  if (timer) return;
  const tick = async () => {
    try { await flushPending(); }
    catch (e) { log.warn('billing reporter sweep failed', { error: e.message }); }
  };
  timer = setInterval(tick, INTERVAL_MS);
  if (timer.unref) timer.unref();
  log.info('billing reporter started', { driver: DRIVER, intervalMs: INTERVAL_MS });
}

export function stopBillingReporter() {
  if (timer) { clearInterval(timer); timer = null; }
}

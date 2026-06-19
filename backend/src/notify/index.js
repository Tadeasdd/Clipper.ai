/** O4 — lifecycle notifications + client comms, behind one env seam.
 *
 *  NOTIFY_DRIVER=log (default): every notification is RECORDED in the
 *    notifications table — a real, auditable delivery log — with zero network,
 *    so CI and offline dev never reach a provider.
 *  NOTIFY_DRIVER=slack | email: also dispatched to the client's configured
 *    channel (per-client slackWebhook / email in notify_prefs).
 *
 *  Four lifecycle events: content_received, ready_for_approval, published,
 *  sla_risk. Per-client opt-out (global or per-event) is honored — an opted-out
 *  event records a 'skipped' row instead of sending. notify() is best-effort: it
 *  never throws into the pipeline/review/publish path that called it.
 */
import { q } from '../db/index.js';
import { id } from '../lib/ids.js';
import { log as logger } from '../lib/log.js';
import * as slack from './slack.js';
import * as email from './email.js';

const DRIVER = process.env.NOTIFY_DRIVER || 'log';
const LIVE = { slack, email };
const SLA_DEFAULT_HOURS = Number(process.env.SLA_DEFAULT_HOURS || 72);

// Client-facing copy per event. ctx carries clientName + ids.
const RENDER = {
  content_received: (c) => ({ subject: 'We received your content',
    body: `${c.clientName}: your recording ${c.recordingId} arrived and is now in production.` }),
  ready_for_approval: (c) => ({ subject: 'A clip is ready for your approval',
    body: `${c.clientName}: clip ${c.clipId} is awaiting your sign-off in the portal.` }),
  published: (c) => ({ subject: 'Your clip is live',
    body: `${c.clientName}: clip ${c.clipId} has been published.` }),
  sla_risk: (c) => ({ subject: 'Delivery is running behind',
    body: `${c.clientName}: recording ${c.recordingId} is past its delivery SLA and still in production.` }),
};
export const EVENTS = Object.keys(RENDER);

async function loadClient(clientId) {
  const { rows } = await q('SELECT id, name, notify_prefs FROM clients WHERE id = $1', [clientId]);
  return rows[0] || null;
}

/** Which channel + recipient this client gets, given the active driver. A live
 *  channel with no configured recipient falls back to 'log' — honest: the event
 *  is still recorded, never silently dropped or faked as delivered. */
function resolveChannel(prefs) {
  if (DRIVER === 'slack') {
    const recipient = prefs.slackWebhook || process.env.SLACK_WEBHOOK_URL;
    return recipient ? { channel: 'slack', recipient } : { channel: 'log', recipient: 'log' };
  }
  if (DRIVER === 'email') {
    return prefs.email ? { channel: 'email', recipient: prefs.email } : { channel: 'log', recipient: 'log' };
  }
  return { channel: 'log', recipient: 'log' };
}

async function record(row) {
  await q(`INSERT INTO notifications
    (id, client_id, event, channel, recipient, subject, body, status, error, recording_id, clip_id)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [id('ntf'), row.clientId || null, row.event, row.channel, row.recipient || null,
     row.subject || null, row.body || null, row.status, row.error || null,
     row.recordingId || null, row.clipId || null]);
}

/** Emit one lifecycle notification. Best-effort; returns a small status object. */
export async function notify(event, ctx = {}) {
  try {
    if (!EVENTS.includes(event)) throw new Error(`unknown notification event: ${event}`);
    const client = ctx.clientId ? await loadClient(ctx.clientId) : null;
    const prefs = client?.notify_prefs || {};
    const base = { clientId: ctx.clientId, event, recordingId: ctx.recordingId, clipId: ctx.clipId };

    // opt-out: globally or per-event → record a skipped row, send nothing.
    if (prefs.optOut === true || prefs.events?.[event] === false) {
      await record({ ...base, channel: 'log', recipient: 'log', status: 'skipped', error: 'client opted out' });
      return { status: 'skipped' };
    }

    const { subject, body } = RENDER[event]({ clientName: client?.name || ctx.clientId || 'client', ...ctx });
    const { channel, recipient } = resolveChannel(prefs);
    try {
      if (channel !== 'log') await LIVE[channel].send({ recipient, subject, body });
      await record({ ...base, channel, recipient, subject, body, status: 'sent' });
      return { status: 'sent', channel };
    } catch (e) {
      await record({ ...base, channel, recipient, subject, body, status: 'failed', error: String(e.message).slice(0, 2000) });
      logger.warn('notification delivery failed', { event, channel, error: e.message });
      return { status: 'failed', error: e.message };
    }
  } catch (e) {
    logger.warn('notify error', { event, error: e.message });
    return { status: 'error', error: e.message };
  }
}

/** Recent notifications for a client (portal + ops feed). */
export async function notificationsFor(clientId, limit = 50) {
  const { rows } = await q(
    `SELECT id, event, channel, status, subject, body, created_at
     FROM notifications WHERE client_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [clientId, Math.min(200, Math.max(1, limit))]);
  return rows;
}

/** Find recordings past their plan SLA, still undelivered, that haven't already
 *  triggered an sla_risk notice, and emit one each (deduped via the log). */
export async function slaWatchTick() {
  const { rows } = await q(`
    SELECT r.id AS recording_id, r.client_id
    FROM recordings r
    JOIN clients c ON c.id = r.client_id
    LEFT JOIN plans p ON p.name = c.plan
    WHERE r.status <> 'failed'
      AND extract(epoch FROM (now() - r.created_at)) / 3600.0 > COALESCE(p.sla_hours, $1)
      AND NOT EXISTS (SELECT 1 FROM clips cl JOIN publish_jobs pj ON pj.clip_id = cl.id AND pj.status = 'published'
                      WHERE cl.recording_id = r.id)
      AND NOT EXISTS (SELECT 1 FROM notifications n WHERE n.event = 'sla_risk' AND n.recording_id = r.id)
    ORDER BY r.created_at ASC LIMIT 100`, [SLA_DEFAULT_HOURS]);
  let emitted = 0;
  for (const r of rows) { await notify('sla_risk', { clientId: r.client_id, recordingId: r.recording_id }); emitted++; }
  return { emitted };
}

/* ── background SLA-risk sweep (thin, like the billing reporter) ──────────────*/
let timer = null;
const INTERVAL_MS = Number(process.env.NOTIFY_SWEEP_INTERVAL_MS || 10000);

export function startNotifier() {
  if (timer) return;
  timer = setInterval(() => { slaWatchTick().catch((e) => logger.warn('sla watch failed', { error: e.message })); }, INTERVAL_MS);
  if (timer.unref) timer.unref();
  logger.info('notifier started', { driver: DRIVER, intervalMs: INTERVAL_MS });
}
export function stopNotifier() { if (timer) { clearInterval(timer); timer = null; } }

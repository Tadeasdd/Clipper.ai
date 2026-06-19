/** O4 — Slack notification driver (NOTIFY_DRIVER=slack).
 *  Posts to the client's incoming-webhook URL (notify_prefs.slackWebhook, or the
 *  global SLACK_WEBHOOK_URL fallback) through the resilience stack. Throws on a
 *  non-2xx so notify() records the delivery as 'failed' — never faked as sent. */
import { resilientFetch } from '../lib/resilience.js';

const TIMEOUT_MS = Number(process.env.NOTIFY_TIMEOUT_MS || 10000);

export async function send({ recipient, subject, body }) {
  const res = await resilientFetch('notify', recipient, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text: `*${subject}*\n${body}` }),
  }, { timeoutMs: TIMEOUT_MS });
  if (!res.ok) throw new Error(`slack webhook failed (${res.status})`);
}

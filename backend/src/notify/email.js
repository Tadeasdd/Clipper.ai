/** O4 — email notification driver (NOTIFY_DRIVER=email).
 *  Posts to a transactional-email HTTP API (EMAIL_API_URL, optional bearer
 *  EMAIL_API_KEY) through the resilience stack — provider-agnostic. Requires the
 *  URL: without it this throws honestly rather than pretending to have sent. */
import { resilientFetch } from '../lib/resilience.js';

const TIMEOUT_MS = Number(process.env.NOTIFY_TIMEOUT_MS || 10000);

export async function send({ recipient, subject, body }) {
  const url = process.env.EMAIL_API_URL;
  if (!url) throw new Error('EMAIL_API_URL not set (NOTIFY_DRIVER=email needs it)');
  const headers = { 'content-type': 'application/json' };
  if (process.env.EMAIL_API_KEY) headers.authorization = `Bearer ${process.env.EMAIL_API_KEY}`;
  const res = await resilientFetch('notify', url, {
    method: 'POST', headers,
    body: JSON.stringify({ to: recipient, subject, body }),
  }, { timeoutMs: TIMEOUT_MS });
  if (!res.ok) throw new Error(`email send failed (${res.status})`);
}

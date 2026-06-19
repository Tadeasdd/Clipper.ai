/** E4 — the live Stripe billing driver (BILLING_DRIVER=stripe).
 *
 *  Reports a delivered outcome to Stripe's Billing Meter Events API so the
 *  client's metered subscription invoices reflect outcomes actually delivered.
 *  Requires STRIPE_SECRET_KEY and a per-client mapping in billing_accounts
 *  (customer_ref + meter_event_name) — without them it throws an honest error
 *  and the usage row parks as 'failed' (it never silently fakes success).
 *
 *  Idempotency-Key = the billing_usage row id, so a retried report can't
 *  double-bill. The call goes through the resilience stack (timeout, bounded
 *  retry with jitter, circuit breaker) like every other external dependency. */
import { resilientFetch } from '../lib/resilience.js';

const STRIPE_API = 'https://api.stripe.com/v1/billing/meter_events';
const TIMEOUT_MS = Number(process.env.BILLING_TIMEOUT_MS || 15000);

export async function report(row, account) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY not set (BILLING_DRIVER=stripe needs it)');
  if (!account?.customer_ref) {
    throw new Error(`no billing account / customer_ref for client ${row.client_id} — map it in billing_accounts`);
  }
  const eventName = account.meter_event_name || process.env.STRIPE_METER_EVENT_NAME;
  if (!eventName) throw new Error('no Stripe meter event name (billing_accounts.meter_event_name or STRIPE_METER_EVENT_NAME)');

  // Stripe meter events take a flat form body; payload[*] keys carry the
  // customer mapping and the metered value (one delivered clip = quantity).
  const body = new URLSearchParams({
    event_name: eventName,
    'payload[stripe_customer_id]': account.customer_ref,
    'payload[value]': String(row.quantity),
  });
  const res = await resilientFetch('billing', STRIPE_API, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${key}`,
      'content-type': 'application/x-www-form-urlencoded',
      'idempotency-key': row.id, // a retried report can't double-bill
    },
    body,
  }, { timeoutMs: TIMEOUT_MS });

  if (!res.ok) throw new Error(`stripe meter event failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
  const json = await res.json();
  return { provider: 'stripe', providerRef: json.identifier || json.id || row.id };
}

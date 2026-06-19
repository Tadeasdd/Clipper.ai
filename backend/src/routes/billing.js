/** E4 — metered outcomes billing API.
 *
 *  POST /webhook   — provider callbacks (Stripe). PUBLIC by design: there is no
 *                    session, the request is authenticated by an HMAC signature
 *                    over the raw body (server.js stashes req.rawBody). A bad or
 *                    missing signature is a 400; valid events are stored once
 *                    (idempotent on the provider event id).
 *  POST /reconcile — ops: flush pending outcomes to the provider now (the
 *                    background reporter does this on a clock; this forces a
 *                    sweep and reports the counts). Idempotent.
 *  GET  /usage     — internal: per-client billable-outcome rollup (ops board).
 */
import { Router } from 'express';
import { verifyWebhook, ingestEvent, flushPending, usageSummary } from '../billing/index.js';
import { requireAuth, INTERNAL } from '../lib/auth.js';
import { log } from '../lib/log.js';

const r = Router();

// PUBLIC — verified by signature, not a session. The raw body is required for
// the HMAC; server.js's express.json `verify` hook captures it as req.rawBody.
r.post('/webhook', async (req, res, next) => {
  try {
    const sig = req.headers['stripe-signature'] || req.headers['billing-signature'];
    const event = verifyWebhook(req.rawBody ?? JSON.stringify(req.body ?? {}), sig);
    if (!event) {
      log.security('billing.webhook.rejected', { ip: req.ip, requestId: req.id });
      return res.status(400).json({ error: 'invalid signature' });
    }
    const stored = await ingestEvent(event);
    res.json({ received: true, stored }); // stored=false → idempotent replay
  } catch (e) { next(e); }
});

// POST /reconcile — ops forces a flush of pending outcomes to the provider.
r.post('/reconcile', requireAuth('ops'), async (_req, res, next) => {
  try { res.json(await flushPending()); } catch (e) { next(e); }
});

// GET /usage — internal billable-outcome rollup per client.
r.get('/usage', requireAuth(...INTERNAL), async (_req, res, next) => {
  try { res.json(await usageSummary()); } catch (e) { next(e); }
});

export default r;

-- E4 — metered outcomes billing. You sell delivered outcomes, not seats; this
-- turns each delivered clip into a billable, reconcilable usage record that an
-- external billing provider (Stripe metered usage) can invoice. (Plan named
-- this 014; 014/015 were taken by E1/E2, so it lands at 016 — same deviation
-- E2 noted for 013→015.)
--
-- Default driver is 'dry-run': outcomes are recorded and marked reported with a
-- labeled synthetic reference, zero network, so offline dev and CI never reach
-- Stripe. The live driver swaps in behind the same seam.

-- One row per DELIVERED clip — the billable outcome. clip_id is UNIQUE so a clip
-- delivered to several platforms bills exactly once (matches E2's "delivered
-- clips" quota model). Append-only; status walks pending → reported (or failed).
CREATE TABLE IF NOT EXISTS billing_usage (
  id            text PRIMARY KEY,
  client_id     text REFERENCES clients(id),
  clip_id       text REFERENCES clips(id) UNIQUE,   -- idempotency anchor: one outcome per clip
  publish_id    text REFERENCES publish_jobs(id),   -- the delivery that triggered billing
  kind          text NOT NULL DEFAULT 'clip_delivered',
  quantity      integer NOT NULL DEFAULT 1,
  status        text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reported', 'failed')),
  provider      text,                               -- dry-run | stripe (set when reported)
  provider_ref  text,                               -- stripe meter-event id, or dryrun_<id>
  error         text,
  reported_at   timestamptz,
  created_at    timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS billing_usage_client_idx ON billing_usage (client_id);
CREATE INDEX IF NOT EXISTS billing_usage_status_idx ON billing_usage (status);

-- Inbound provider webhook events, keyed on the provider's own event id so a
-- replayed delivery is idempotent (Stripe retries deliveries; we store once).
CREATE TABLE IF NOT EXISTS billing_events (
  id          text PRIMARY KEY,   -- provider event id (e.g. stripe evt_...)
  type        text NOT NULL,
  payload     jsonb,
  received_at timestamptz DEFAULT now()
);

-- Optional client → provider mapping. Empty offline; only the live Stripe driver
-- reads it (so the live path is real, not faked). meter_event_name lets a client
-- map onto a specific Stripe Billing meter.
CREATE TABLE IF NOT EXISTS billing_accounts (
  client_id        text PRIMARY KEY REFERENCES clients(id),
  provider         text NOT NULL DEFAULT 'stripe',
  customer_ref     text,
  meter_event_name text,
  created_at       timestamptz DEFAULT now()
);

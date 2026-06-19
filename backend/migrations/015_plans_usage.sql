-- E2 — plan catalog for usage metering. Each plan sets the volume of outcomes a
-- client buys (delivered clips + minutes processed per billing period) and the
-- behavior at the limit. limit_policy defaults to 'warn' so metering is
-- non-blocking until an operator deliberately tightens a plan — offline dev and
-- CI never get blocked. Usage itself is computed live from clips/recordings.
CREATE TABLE IF NOT EXISTS plans (
  name              text PRIMARY KEY,
  clip_quota        integer NOT NULL,
  minute_quota      integer NOT NULL,
  limit_policy      text NOT NULL DEFAULT 'warn' CHECK (limit_policy IN ('warn', 'queue', 'block')),
  monthly_price_usd numeric NOT NULL DEFAULT 0
);

INSERT INTO plans (name, clip_quota, minute_quota, limit_policy, monthly_price_usd) VALUES
  ('starter', 20,  120,  'warn', 499),
  ('growth',  60,  480,  'warn', 1499),
  ('scale',   200, 1800, 'warn', 4999)
ON CONFLICT (name) DO NOTHING;

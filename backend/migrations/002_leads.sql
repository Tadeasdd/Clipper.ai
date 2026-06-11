-- Stage B2/F3 — lead capture from the marketing site (waitlist / strategy-call
-- requests). Leads are pre-client: the strategy call decides plan + onboarding.
CREATE TABLE leads (
  id           TEXT PRIMARY KEY,
  email        TEXT NOT NULL,
  content_kind TEXT,                  -- what they make (podcast, coaching, ...)
  source       TEXT NOT NULL DEFAULT 'waitlist',  -- waitlist | strategy_call | docs | other
  notes        TEXT,
  meta         JSONB DEFAULT '{}',    -- page, referrer, utm, anything the form sends
  status       TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new','contacted','call_booked','converted','closed')),
  created_at   TIMESTAMPTZ DEFAULT now()
);
-- One row per email per source; resubmits update rather than duplicate.
CREATE UNIQUE INDEX leads_email_source ON leads (lower(email), source);
CREATE INDEX leads_status ON leads (status, created_at);

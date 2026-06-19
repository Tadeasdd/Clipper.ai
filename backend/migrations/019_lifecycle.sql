-- O3 — client health & lifecycle. A client moves through a lifecycle the ops
-- team manages (onboarding → active → at_risk → churned); the stage is an
-- operator-owned workflow field, while the health score and churn signals are
-- computed from real activity (ops/health.js). Forward-safe: new column with a
-- default, so existing clients start in 'onboarding' and an operator advances
-- them after kickoff. onboarded_at stamps when they first reach 'active'.
ALTER TABLE clients ADD COLUMN IF NOT EXISTS lifecycle_stage text NOT NULL DEFAULT 'onboarding'
  CHECK (lifecycle_stage IN ('onboarding', 'active', 'at_risk', 'churned'));
ALTER TABLE clients ADD COLUMN IF NOT EXISTS onboarded_at timestamptz;

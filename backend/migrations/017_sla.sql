-- O1 — SLA / turnaround config. The service's core promise is fast, consistent
-- delivery (submit → published). Each plan carries an SLA target in hours; the
-- ops board flags recordings whose turnaround breaches it. Forward-safe: a new
-- column with a default, then per-tier targets (higher tiers ship faster).
-- Clients with no plan fall back to SLA_DEFAULT_HOURS at read time.
ALTER TABLE plans ADD COLUMN IF NOT EXISTS sla_hours integer NOT NULL DEFAULT 72;

UPDATE plans SET sla_hours = CASE name
  WHEN 'scale'   THEN 24
  WHEN 'growth'  THEN 48
  WHEN 'starter' THEN 72
  ELSE sla_hours
END;

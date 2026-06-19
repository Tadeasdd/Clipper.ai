-- O4 — lifecycle notifications + client comms. The service runs on timely
-- communication, but nothing told a client when their content was received,
-- ready to approve, published, or at SLA risk. This logs every notification
-- (one row per delivery attempt, append-only) so delivery is auditable, and
-- adds per-client preferences so opt-out is honored.
CREATE TABLE IF NOT EXISTS notifications (
  id           text PRIMARY KEY,
  client_id    text REFERENCES clients(id),
  event        text NOT NULL,        -- content_received | ready_for_approval | published | sla_risk
  channel      text NOT NULL,        -- log | slack | email
  recipient    text,                 -- email / webhook / 'log'
  subject      text,
  body         text,
  status       text NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'skipped')),
  error        text,
  -- what the notification is about, for dedup (e.g. one sla_risk per recording)
  recording_id text REFERENCES recordings(id),
  clip_id      text REFERENCES clips(id),
  created_at   timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notifications_client_idx ON notifications (client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_dedup_idx ON notifications (event, recording_id);

-- Per-client comms preferences: { optOut?: bool, events?: { <event>: false },
-- email?: string, slackWebhook?: string }. Empty = notify on the default
-- channel; offline dev/CI send via the 'log' driver with no network.
ALTER TABLE clients ADD COLUMN IF NOT EXISTS notify_prefs jsonb NOT NULL DEFAULT '{}';

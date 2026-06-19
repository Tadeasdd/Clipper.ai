-- O5 — system-wide audit & activity feed. review_events already audits review
-- decisions, but nothing gave a holistic trail across intake, processing,
-- review, publish, billing and admin. audit_log is that append-only feed: one
-- row per material action. client_visible marks the rows a client may see, so
-- the same log powers both the ops feed (everything) and a correctly-scoped
-- client view (their own client_visible rows only). (Plan named this 017;
-- 017–020 were taken, so it lands at 021 — same deviation pattern.)
CREATE TABLE IF NOT EXISTS audit_log (
  id             text PRIMARY KEY,
  ts             timestamptz NOT NULL DEFAULT now(),
  area           text NOT NULL,    -- intake | processing | review | publish | billing | admin
  action         text NOT NULL,    -- content_submitted | recording_ready | review_decision | clip_published | usage_reported | client_created | ...
  actor_id       text REFERENCES users(id),   -- who acted (null = system / pipeline)
  actor_role     text,
  client_id      text REFERENCES clients(id), -- which client it concerns (scopes the client view)
  entity_type    text,             -- recording | clip | client | user | publish | usage
  entity_id      text,
  summary        text,             -- human one-liner for the feed
  meta           jsonb,
  client_visible boolean NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS audit_log_ts_idx ON audit_log (ts DESC);
CREATE INDEX IF NOT EXISTS audit_log_client_idx ON audit_log (client_id, ts DESC);
CREATE INDEX IF NOT EXISTS audit_log_area_idx ON audit_log (area, ts DESC);

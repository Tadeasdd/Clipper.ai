-- P2 — Core Web Vitals (RUM). First-party real-user performance signal beaconed
-- from the marketing/studio surface (lib/perf.jsx → POST /api/rum), the way the
-- U4 feedback widget posts. Privacy-respecting: no identity, no cookies — one row
-- per finalized metric, with only the URL path and coarse device/connection
-- context. meta {ip, ua} is kept for abuse triage, exactly like feedback/leads.
CREATE TABLE IF NOT EXISTS web_vitals (
  id         text PRIMARY KEY,
  metric     text NOT NULL CHECK (metric IN ('lcp', 'inp', 'cls', 'fcp', 'ttfb')),
  value      double precision NOT NULL CHECK (value >= 0),   -- ms (lcp/inp/fcp/ttfb) or unitless (cls)
  rating     text NOT NULL CHECK (rating IN ('good', 'needs-improvement', 'poor')),
  path       text,                                            -- URL pathname only — never query/hash (no PII)
  device     text,                                            -- coarse: 'mobile' | 'desktop'
  conn       text,                                            -- navigator.connection.effectiveType, when exposed
  meta       jsonb NOT NULL DEFAULT '{}',                     -- { ip, ua } for triage
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS web_vitals_metric_created_idx ON web_vitals (metric, created_at DESC);
CREATE INDEX IF NOT EXISTS web_vitals_path_idx ON web_vitals (path, created_at DESC);

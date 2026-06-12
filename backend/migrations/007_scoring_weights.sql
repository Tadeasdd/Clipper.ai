-- Stage B6.3 — the optimization loop.
-- Append-only: every retrain writes a NEW row with the evidence it was based
-- on (sample size, per-signal correlations). The score stage reads the
-- latest row and falls back to the built-in defaults when none exist. Never
-- UPDATE here — being able to answer "what weights scored this clip, and
-- why" is part of the product.
CREATE TABLE scoring_weights (
  id         TEXT PRIMARY KEY,
  weights    JSONB NOT NULL,        -- { energy, durationFit, position } — sums to 1
  basis      JSONB NOT NULL,        -- { sample, scoreCorrelation, perSignal: {...} }
  note       TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX scoring_weights_latest ON scoring_weights (created_at DESC);

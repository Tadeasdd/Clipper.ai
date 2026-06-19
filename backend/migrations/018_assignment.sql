-- O2 — capacity & workload planning. Human editors/reviewers are the
-- constraint, so review work needs to be assignable and balanceable across
-- them. assigned_to is ORTHOGONAL to clips.status: it never participates in a
-- status transition (those stay single atomic CTEs in routes/review.js), it
-- just records who owns the review of a clip. Nullable + forward-safe; the
-- existing review flow is untouched until work is explicitly assigned.
ALTER TABLE clips ADD COLUMN IF NOT EXISTS assigned_to text REFERENCES users(id);

-- The hot path: "open review work owned by reviewer X" and "unassigned backlog".
CREATE INDEX IF NOT EXISTS clips_assignment_idx ON clips (status, assigned_to);

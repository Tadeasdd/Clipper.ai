-- Stage B4 — review workflow.
-- review_events is the audit log (B7 builds on it), so EVERY status-machine
-- transition gets a row — including the two routing actions that aren't
-- verdicts: an editor resubmitting after changes, and an account manager
-- sending an internally-approved clip to the client.
ALTER TABLE review_events DROP CONSTRAINT review_events_decision_check;
ALTER TABLE review_events
  ADD CONSTRAINT review_events_decision_check
  CHECK (decision IN ('approve','reject','changes','resubmit','send_to_client'));

-- The reviewer worklist scans clips by status alone (001 only indexed
-- (recording_id, status)).
CREATE INDEX clips_status ON clips (status);

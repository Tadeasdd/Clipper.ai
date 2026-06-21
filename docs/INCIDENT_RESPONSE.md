# Incident Response

A concise playbook for when something is on fire. For the exact commands, see
[`RUNBOOKS.md`](RUNBOOKS.md).

## Severity

| Sev  | Meaning                                                |
| ---- | ------------------------------------------------------ |
| SEV1 | Customer-facing outage or data-loss/exposure risk      |
| SEV2 | Degraded — working but breaching SLO or partially down |
| SEV3 | Minor — contained, no customer impact                  |

**Response flow:** detect → triage → mitigate → communicate → post-incident review.

## Playbooks

### SLO breach (success rate / p95 turnaround)

- **Signal:** alert fires via `ALERT_WEBHOOK_URL`.
- **First checks:** the SLIs/SLOs and error budget in [`SLO.md`](SLO.md).
- **Mitigation:** identify the breaching stage; throttle or pause new intake while
  it recovers.
- **Test/verify:** `npm run smoke:slo`.
- **Link:** [`docs/SLO.md`](SLO.md).

### Worker crash / jobs stuck

- **Signal:** jobs not progressing; dead-letter rows accumulating.
- **First checks:** the M5 visibility-timeout reaper re-arms abandoned jobs;
  inspect dead-letter rows (`dead_letter=true`).
- **Mitigation:** retry via `POST /api/jobs/:id/retry`.
- **Test/verify:** chaos drill `npm run smoke:chaos`.
- **Link:** recovery objectives in [`docs/DR.md`](DR.md).

### SSRF attempt (rejections on `/api/intake`)

- **Signal:** intake rejections in the logs.
- **First checks:** the guard is `backend/src/lib/safe-fetch.js`; review the
  rejection reason in the logs.
- **Mitigation:** confirm the reject was correct; no bypass needed — the guard
  holds.
- **Test/verify:** `npm run smoke:ssrf`.
- **Link:** [`docs/THREAT_MODEL.md`](THREAT_MODEL.md).

### Auth / suspected IDOR

- **Signal:** unexpected cross-tenant access reports.
- **First checks:** identity is from the session; cross-tenant reads are 404 by
  design.
- **Mitigation:** revoke sessions via `DELETE /api/auth/sessions/:id`.
- **Test/verify:** `npm run smoke:authz`.
- **Link:** audit trail in the O5 audit log.

### Lost/compromised encryption key

- **Signal:** `PUBLISH_TOKEN_KEY` lost or suspected exposed.
- **First checks:** if **lost**, there is no decrypt path for existing blobs.
- **Mitigation:** if lost, restore from backup ([`docs/DR.md`](DR.md)); if
  **compromised**, rotate per [`docs/SECRETS.md`](SECRETS.md) (`npm run rewrap`).
- **Link:** [`docs/SECRETS.md`](SECRETS.md), [`docs/DR.md`](DR.md).

### Database loss

- **Signal:** primary database unavailable or corrupted.
- **First checks:** confirm scope; identify latest good backup / PITR point.
- **Mitigation:** restore from `backend/ops/backup/restore.sh`, or managed-PG PITR.
- **Link:** objectives + drill in [`docs/DR.md`](DR.md).

## After the incident

Run a post-incident review for every SEV1/SEV2: timeline, root cause, what caught
it (or didn't), and the follow-up actions. Commands referenced above live in
[`RUNBOOKS.md`](RUNBOOKS.md).

/** Alert routing (shared by Q5 quality-drift and R4 SLO-breach).
 *
 *  Dry-run by default: the structured security/audit log. When ALERT_WEBHOOK_URL
 *  is set, the alert also POSTs there — point it at Slack/PagerDuty (or Track R's
 *  routing) to page for real. Best-effort: a webhook failure never throws, so
 *  alerting can't take down the path that raised the alert.
 */
import { log } from './log.js';

export async function raiseAlert(kind, detail) {
  log.security(kind, detail);
  const url = process.env.ALERT_WEBHOOK_URL;
  if (!url) return; // dry run — logged, not paged
  try {
    await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind, detail }) });
  } catch (e) { log.warn('alert webhook failed', { error: e.message }); }
}

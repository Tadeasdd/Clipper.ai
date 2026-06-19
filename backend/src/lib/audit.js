/** O5 — system-wide audit & activity feed.
 *
 *  One append-only row per material action across the whole system. audit() is
 *  best-effort: a logging hiccup must never break the action it records, so it
 *  swallows + warns rather than throwing into intake/review/publish/etc.
 *
 *  client_visible marks the rows a client may see; the same log serves the ops
 *  feed (everything) and a correctly-scoped client view (own client_visible
 *  rows only). This complements review_events (the authoritative review audit)
 *  and the structured security log — it is the cross-cutting activity trail.
 */
import { q } from '../db/index.js';
import { id } from './ids.js';
import { log } from './log.js';

/** Record one action. opts: { actorId, actorRole, clientId, entityType,
 *  entityId, summary, meta, clientVisible }. Never throws. */
export async function audit(area, action, opts = {}) {
  try {
    await q(`INSERT INTO audit_log
      (id, area, action, actor_id, actor_role, client_id, entity_type, entity_id, summary, meta, client_visible)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [id('aud'), area, action, opts.actorId || null, opts.actorRole || null, opts.clientId || null,
       opts.entityType || null, opts.entityId || null, opts.summary || null,
       opts.meta ? JSON.stringify(opts.meta) : null, opts.clientVisible === true]);
  } catch (e) {
    log.warn('audit write failed', { area, action, error: e.message });
  }
}

const clamp = (n, def, max) => Math.min(max, Math.max(1, Number(n) || def));

/** Ops feed: every row, newest first, optionally filtered by area / client.
 *  `before` (ISO ts) paginates backwards through time. */
export async function auditFeed({ area, clientId, before, limit } = {}) {
  const params = [];
  const conds = [];
  if (area) { params.push(area); conds.push(`area = $${params.length}`); }
  if (clientId) { params.push(clientId); conds.push(`client_id = $${params.length}`); }
  if (before) { params.push(before); conds.push(`ts < $${params.length}`); }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  params.push(clamp(limit, 100, 500));
  const { rows } = await q(
    `SELECT id, ts, area, action, actor_id, actor_role, client_id, entity_type, entity_id, summary, meta
     FROM audit_log ${where} ORDER BY ts DESC LIMIT $${params.length}`, params);
  return rows;
}

/** Client-scoped feed: only this client's client_visible rows. Internal-only
 *  actions and other clients' rows are never returned. */
export async function clientFeed(clientId, { before, limit } = {}) {
  const params = [clientId];
  let beforeCond = '';
  if (before) { params.push(before); beforeCond = `AND ts < $${params.length}`; }
  params.push(clamp(limit, 100, 500));
  const { rows } = await q(
    `SELECT id, ts, area, action, entity_type, entity_id, summary
     FROM audit_log
     WHERE client_id = $1 AND client_visible = true ${beforeCond}
     ORDER BY ts DESC LIMIT $${params.length}`, params);
  return rows;
}

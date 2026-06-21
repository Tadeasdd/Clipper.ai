/** C1 — content lifecycle: retention sweep + the shared purge used by GDPR erasure.
 *
 * Purging a recording means deleting BOTH the DB rows that descend from it
 * (FK-ordered, in one transaction) AND every storage object it owns (the raw
 * upload, every rendered clip, and every published outbox derivative). The DB
 * commit is the source of truth: objects are deleted AFTER it, so a missed object
 * is a harmless orphan while a missed row would be a dangling reference. Every
 * purge writes an audit row. Offline-safe — no external calls. */
import { q, pool } from '../db/index.js';
import { deleteObject } from '../storage/index.js';
import { audit } from './audit.js';
import { log } from './log.js';

const DAY_MS = 86_400_000;

// Every storage object key owned by a set of recordings.
async function storageKeysFor(recIds) {
  const keys = new Set();
  for (const r of (await q('SELECT storage_key FROM recordings WHERE id = ANY($1)', [recIds])).rows) {
    if (r.storage_key) keys.add(r.storage_key);
  }
  for (const c of (await q('SELECT asset_key FROM clips WHERE recording_id = ANY($1)', [recIds])).rows) {
    if (c.asset_key) keys.add(c.asset_key);
  }
  // Published derivatives: publish/local.js writes outbox/<platform>/<clipId>.{mp4,json}.
  const pubs = await q(
    `SELECT pj.platform, pj.clip_id FROM publish_jobs pj
       JOIN clips c ON c.id = pj.clip_id WHERE c.recording_id = ANY($1)`, [recIds]);
  for (const p of pubs.rows) {
    keys.add(`outbox/${p.platform}/${p.clip_id}.mp4`);
    keys.add(`outbox/${p.platform}/${p.clip_id}.json`);
  }
  return [...keys];
}

// FK-ordered delete of every row descending from a set of recordings.
async function deleteRows(client, recIds) {
  const clipsOf = 'SELECT id FROM clips WHERE recording_id = ANY($1)';
  await client.query(`DELETE FROM clip_metrics WHERE publish_id IN (SELECT id FROM publish_jobs WHERE clip_id IN (${clipsOf}))`, [recIds]);
  await client.query(`DELETE FROM billing_usage WHERE clip_id IN (${clipsOf})`, [recIds]);
  await client.query(`DELETE FROM review_events WHERE clip_id IN (${clipsOf})`, [recIds]);
  await client.query(`DELETE FROM publish_jobs WHERE clip_id IN (${clipsOf})`, [recIds]);
  await client.query('DELETE FROM notifications WHERE recording_id = ANY($1)', [recIds]);
  await client.query('DELETE FROM clips WHERE recording_id = ANY($1)', [recIds]);
  await client.query('DELETE FROM transcripts WHERE recording_id = ANY($1)', [recIds]);
  await client.query('DELETE FROM pipeline_jobs WHERE recording_id = ANY($1)', [recIds]);
  await client.query('DELETE FROM cost_entries WHERE recording_id = ANY($1)', [recIds]);
  await client.query('DELETE FROM recordings WHERE id = ANY($1)', [recIds]);
}

/** Purge a set of recordings (rows + objects + audit). Returns a manifest. */
export async function purgeRecordings(recIds, { reason = 'retention', clientId = null, actorId = null } = {}) {
  if (!recIds.length) return { recordings: 0, objects: 0, keys: [] };
  const keys = await storageKeysFor(recIds);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await deleteRows(client, recIds);
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
  let objects = 0;
  for (const k of keys) { if (await deleteObject(k)) objects++; }
  await audit('admin', reason === 'erasure' ? 'client_content_erased' : 'content_purged', {
    clientId, actorId, entityType: 'recording',
    summary: `${reason === 'erasure' ? 'GDPR erasure' : 'retention purge'}: ${recIds.length} recording(s), ${objects} object(s)`,
    meta: { reason, recordingIds: recIds, objectKeys: keys, objectsDeleted: objects },
  });
  return { recordings: recIds.length, objects, keys };
}

/** Retention sweep: purge every recording past its client's retention window.
 *  Effective window = COALESCE(client.retention_days, CONTENT_RETENTION_DAYS).
 *  An effective window of 0/unset means "keep forever" — those recordings are
 *  skipped, so with no policy set the sweep is a no-op (CI stays green). */
export async function purgeExpired(now = Date.now()) {
  const globalDays = Number(process.env.CONTENT_RETENTION_DAYS || 0) || null;
  const { rows } = await q(
    `SELECT r.id, r.created_at, COALESCE(c.retention_days, $1) AS days
       FROM recordings r JOIN clients c ON c.id = r.client_id`, [globalDays]);
  const expired = rows
    .filter((r) => { const d = Number(r.days || 0); return d > 0 && now - new Date(r.created_at).getTime() > d * DAY_MS; })
    .map((r) => r.id);
  if (!expired.length) return { recordings: 0, objects: 0, keys: [] };
  return purgeRecordings(expired, { reason: 'retention' });
}

/** Start the periodic retention sweep. Off by default (CONTENT_RETENTION_SWEEP_MS
 *  unset/0) so CI and offline dev never purge unexpectedly; set it in prod to run
 *  the sweep on an interval. Returns a stop() handle. */
export function startRetentionSweep() {
  const ms = Number(process.env.CONTENT_RETENTION_SWEEP_MS || 0);
  if (ms <= 0) return () => {};
  const timer = setInterval(() => {
    purgeExpired().catch((e) => log.warn('retention sweep failed', { error: e.message }));
  }, ms);
  timer.unref?.();
  return () => clearInterval(timer);
}

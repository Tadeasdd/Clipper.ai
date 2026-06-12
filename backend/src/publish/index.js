/** Stage B5 — publishing behind one interface.
 *
 *  PUBLISH_DRIVER=local (default): every platform delivers into the storage
 *    outbox — the full lifecycle with zero external credentials.
 *  PUBLISH_DRIVER=live: real platform adapters; written so far: youtube.
 *    The rest throw honestly until their adapters exist.
 *
 *  Also home of the scheduling core, used by both the API and the B4 hook:
 *  the clip's move into 'scheduled' is one atomic statement, so only clips
 *  that actually reached 'approved' can ever be queued — the machine's
 *  guarantee, kept. */
import { q } from '../db/index.js';
import { id } from '../lib/ids.js';
import { decryptJson } from '../lib/crypto.js';
import * as local from './local.js';
import * as youtube from './youtube.js';

export const PLATFORMS = ['youtube', 'tiktok', 'instagram', 'linkedin', 'x'];
const LIVE = { youtube };
const DRIVER = process.env.PUBLISH_DRIVER || 'local';

export async function runAdapter(ctx) {
  if (DRIVER === 'local') return local.publish(ctx);
  const adapter = LIVE[ctx.job.platform];
  if (!adapter) throw new Error(`no live adapter for ${ctx.job.platform} yet (PUBLISH_DRIVER=live)`);
  return adapter.publish({ ...ctx, connection: { ...ctx.connection, credentials: decryptJson(ctx.connection.credentials_enc) } });
}

/** Schedule one clip on one platform. Atomic: the clip moves
 *  approved→scheduled (or stays scheduled when adding a second platform) in
 *  the same statement that proves it was eligible; the job row is upserted so
 *  re-scheduling re-arms instead of duplicating. Returns the job, or null if
 *  the clip wasn't approved/scheduled. */
export async function scheduleClip({ clipId, connectionId, platform, scheduledAt }) {
  const { rows } = await q(`
    WITH eligible AS (
      UPDATE clips SET status = 'scheduled'
      WHERE id = $1 AND status IN ('approved', 'scheduled')
      RETURNING id
    )
    INSERT INTO publish_jobs (id, clip_id, connection_id, platform, scheduled_at, run_after, status)
    SELECT $2, id, $3, $4, $5, $5, 'scheduled' FROM eligible
    ON CONFLICT (clip_id, platform) DO UPDATE
      SET connection_id = EXCLUDED.connection_id, scheduled_at = EXCLUDED.scheduled_at,
          run_after = EXCLUDED.run_after, status = 'scheduled', error = NULL,
          attempts = 0, updated_at = now()
    RETURNING *`,
    [clipId, id('pub'), connectionId, platform, scheduledAt || new Date()]);
  return rows[0] || null;
}

/** The B4 hook: a clip just reached 'approved'. Schedule it now on every
 *  active connection the client has. Best-effort by design — a scheduling
 *  hiccup must never roll back a review decision; failures land in the log
 *  and the clip stays 'approved' for manual scheduling from the ops queue. */
export async function autoScheduleApproved(clipId) {
  try {
    const { rows: conns } = await q(`
      SELECT pc.id, pc.platform
      FROM platform_connections pc
      JOIN recordings r ON r.client_id = pc.client_id
      JOIN clips cl ON cl.recording_id = r.id
      WHERE cl.id = $1 AND pc.status = 'active'`, [clipId]);
    const scheduled = [];
    for (const c of conns) {
      const job = await scheduleClip({ clipId, connectionId: c.id, platform: c.platform });
      if (job) scheduled.push(c.platform);
    }
    return scheduled;
  } catch (e) {
    console.error(`[publish] auto-schedule for ${clipId} failed: ${e.message}`);
    return [];
  }
}

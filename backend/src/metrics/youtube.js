/** Stage B6.1 — YouTube metrics driver (METRICS_DRIVER=live).
 *  Real call: videos.list?part=statistics,contentDetails for the published
 *  video id, using the same connection credentials the publish adapter used.
 *  The Data API has no per-video watch-time/retention (that's the Analytics
 *  API, a separate grant) — those fields stay null rather than guessed. */
import { refreshAccessToken } from '../publish/youtube.js';
import { resilientFetch } from '../lib/resilience.js';

export async function capture({ job, connection }) {
  if (!job.external_id) throw new Error('publish job has no external_id to poll');
  const access_token = await refreshAccessToken(connection.credentials);
  const res = await resilientFetch('metrics',
    `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${encodeURIComponent(job.external_id)}`,
    { headers: { authorization: `Bearer ${access_token}` } },
    { timeoutMs: Number(process.env.METRICS_TIMEOUT_MS || 15000) });
  if (!res.ok) throw new Error(`youtube stats failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
  const { items } = await res.json();
  if (!items?.length) throw new Error(`video ${job.external_id} not found (deleted or private?)`);
  const s = items[0].statistics || {};
  return {
    views: Number(s.viewCount ?? 0),
    watch_time_s: null,   // Analytics API territory — never guessed
    retention: null,
    likes: Number(s.likeCount ?? 0),
    comments: Number(s.commentCount ?? 0),
    shares: null,         // not exposed by the Data API
    follows: null,
  };
}

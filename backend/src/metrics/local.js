/** Stage B6.1 — the local metrics driver (METRICS_DRIVER=local, the default).
 *
 *  Offline there are no real viewers, so this driver SIMULATES a post's
 *  metrics: deterministic per publish (hashed id) with growth curves over
 *  time since publication. It exists to exercise the plumbing — pollers,
 *  series, reports, the correlation math — with the full lifecycle running
 *  on zero external credentials.
 *
 *  One property is load-bearing: the numbers are derived ONLY from the
 *  publish id and elapsed time, NEVER from clips.score. If the simulator
 *  peeked at the score, the B6.3 score↔performance correlation would be
 *  measuring our own simulator and always look great. Under this driver the
 *  correlation hovering near zero is the honest, expected reading; real
 *  numbers come from the live drivers. */

/** Tiny deterministic hash → [0, 1). FNV-1a over the id, then scrambled. */
function unit(id, salt) {
  let h = 0x811c9dc5;
  const s = `${salt}:${id}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return ((h >>> 0) % 100_000) / 100_000;
}

export async function capture({ job, clip }) {
  const elapsedS = Math.max(1, (Date.now() - Date.parse(job.published_at)) / 1000);
  const clipLen = Math.max(1, Number(clip.t_end_s) - Number(clip.t_start_s));

  // Audience size: log-normal-ish spread across posts (50 .. ~80k base).
  const base = Math.round(50 * Math.exp(unit(job.id, 'base') * 7.4));
  // Views grow with diminishing returns; monotonic in elapsed time.
  const views = Math.floor(base * Math.log1p(elapsedS / 60));
  // Retention is a stable property of the post: 25%–85%.
  const retention = Number((0.25 + 0.6 * unit(job.id, 'ret')).toFixed(3));
  const engage = 0.005 + 0.05 * unit(job.id, 'eng');

  return {
    views,
    watch_time_s: Math.floor(views * retention * clipLen),
    retention,
    likes: Math.floor(views * engage),
    comments: Math.floor(views * engage * 0.12),
    shares: Math.floor(views * engage * 0.18),
    follows: Math.floor(views * engage * 0.06),
  };
}

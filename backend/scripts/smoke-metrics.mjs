/* B6.1 smoke: metrics ingestion. Publishes a clip through the real B5 path
   (local driver), then proves the capture machinery:

     publish → first clip_metrics row appears immediately
     claim clock honored: no second capture until metrics_next_at passes
     forced second capture → views monotonic non-decreasing, retention stable
     unpublished jobs are never sampled
     GET /api/clips/:id/metrics returns the per-platform series

   Later phases extend this file: B6.2 report aggregation, B6.3 the loop. */
import pg from 'pg';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const BASE = process.env.BASE || 'http://localhost:8080';
const STORAGE = process.env.STORAGE_DIR || path.resolve('storage');
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL || 'postgres://clipper:clipper@localhost:5432/clipper' });

const j = async (method, p, body) => {
  const res = await fetch(BASE + p, {
    method, headers: { 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json().catch(() => ({})) };
};
const assert = (cond, msg) => { if (!cond) { console.error('FAIL:', msg); process.exit(1); } console.log('ok:', msg); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const uid = () => Math.random().toString(36).slice(2, 8);

// ── seed: client + recording + an approved clip with a stored asset ────────
const run = uid();
const cli = (await j('POST', '/api/clients', { name: `B6 Metrics Co ${run}` })).data.id;
const rec = `rec_met_${run}`;
await db.query(`INSERT INTO recordings (id, client_id, kind, status, duration_s) VALUES ($1,$2,'podcast','ready',180)`, [rec, cli]);
const clip = `clip_met_${run}`;
const assetKey = `${rec}/clips/${clip}.mp4`;
mkdirSync(path.join(STORAGE, rec, 'clips'), { recursive: true });
writeFileSync(path.join(STORAGE, assetKey), Buffer.from(`fake-mp4-${run}`));
await db.query(
  `INSERT INTO clips (id, recording_id, t_start_s, t_end_s, score, hook, format, asset_key, status)
   VALUES ($1,$2,30,62,84,$3,'9:16',$4,'approved')`,
  [clip, rec, `Metrics smoke hook ${run}`, assetKey]);
await j('POST', '/api/publish/connections', { clientId: cli, platform: 'youtube', handle: '@b6smoke', credentials: { t: run } });

// ── publish, then the first capture should land without prodding ───────────
let r = await j('POST', '/api/publish', { clipId: clip, platform: 'youtube' });
assert(r.status === 202, 'clip scheduled');
let pub, deadline = Date.now() + 20_000;
for (;;) {
  await sleep(700);
  pub = (await db.query(`SELECT * FROM publish_jobs WHERE clip_id = $1`, [clip])).rows[0];
  if (pub?.status === 'published') break;
  if (Date.now() > deadline) { console.error('FAIL: publish never completed'); process.exit(1); }
}
deadline = Date.now() + 15_000;
let series;
for (;;) {
  await sleep(700);
  series = (await db.query(`SELECT * FROM clip_metrics WHERE publish_id = $1 ORDER BY captured_at`, [pub.id])).rows;
  if (series.length >= 1) break;
  if (Date.now() > deadline) { console.error('FAIL: first capture never happened'); process.exit(1); }
}
assert(series.length === 1, 'first capture lands immediately after publish');
const m1 = series[0];
assert(m1.views >= 0 && Number(m1.retention) > 0 && Number(m1.retention) < 1 && m1.watch_time_s >= 0,
  `capture is shaped like reality (${m1.views} views, retention ${m1.retention})`);

// ── the claim clock: no re-sample until metrics_next_at passes ──────────────
const clock = (await db.query(`SELECT metrics_next_at > now() + interval '1 hour' AS far FROM publish_jobs WHERE id = $1`, [pub.id])).rows[0];
assert(clock.far === true, 'claim pushed the capture clock a full interval out');
await sleep(2500);
series = (await db.query(`SELECT count(*)::int AS n FROM clip_metrics WHERE publish_id = $1`, [pub.id])).rows;
assert(series[0].n === 1, 'poller leaves the post alone until the clock passes');

// ── force the clock → second capture; growth must be monotonic ──────────────
await db.query(`UPDATE publish_jobs SET metrics_next_at = now() WHERE id = $1`, [pub.id]);
deadline = Date.now() + 15_000;
for (;;) {
  await sleep(700);
  series = (await db.query(`SELECT * FROM clip_metrics WHERE publish_id = $1 ORDER BY captured_at`, [pub.id])).rows;
  if (series.length >= 2) break;
  if (Date.now() > deadline) { console.error('FAIL: second capture never happened'); process.exit(1); }
}
const m2 = series[1];
assert(Number(m2.views) >= Number(m1.views), `views grow monotonically (${m1.views} → ${m2.views})`);
assert(m2.retention === m1.retention, 'retention is a stable property of the post across captures');

// ── unpublished jobs are never sampled ──────────────────────────────────────
const clipParked = `clip_met_park_${run}`;
await db.query(
  `INSERT INTO clips (id, recording_id, t_start_s, t_end_s, score, hook, status)
   VALUES ($1,$2,10,30,70,'parked','approved')`, [clipParked, rec]);
r = await j('POST', '/api/publish', { clipId: clipParked, platform: 'youtube' });
deadline = Date.now() + 30_000;
let parked;
for (;;) {
  await sleep(1200);
  parked = (await db.query(`SELECT * FROM publish_jobs WHERE clip_id = $1`, [clipParked])).rows[0];
  if (parked?.status === 'failed') break;
  if (Date.now() > deadline) { console.error('FAIL: broken publish never parked'); process.exit(1); }
}
const none = (await db.query(`SELECT count(*)::int AS n FROM clip_metrics WHERE publish_id = $1`, [parked.id])).rows[0];
assert(none.n === 0 && parked.metrics_next_at === null, 'failed publishes never enter the capture rotation');

// ── the series endpoint ──────────────────────────────────────────────────────
r = await j('GET', `/api/clips/${clip}/metrics`);
assert(r.status === 200 && r.data.platforms.youtube.series.length === 2
  && r.data.platforms.youtube.series[0].views >= r.data.platforms.youtube.series[1].views,
  'series endpoint returns the per-platform capture history, latest first');
r = await j('GET', '/api/clips/clip_nobody/metrics');
assert(r.status === 404, 'unknown clip rejected');

await db.end();
console.log('\nB6.1 smoke passed: published posts enter the capture rotation and build an honest metrics series.');

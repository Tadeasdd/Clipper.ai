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

// ── B6.2: report aggregation — crafted rows, exact expected numbers ─────────
// Fresh client, two clips: clip A published on two platforms (the per-post
// granularity), clip B with two captures (latest must win), plus a post
// outside the window (must be excluded).
const cli2 = (await j('POST', '/api/clients', { name: `B6 Report Co ${run}` })).data.id;
const rec2 = `rec_rep_${run}`;
await db.query(`INSERT INTO recordings (id, client_id, kind, status) VALUES ($1,$2,'podcast','ready')`, [rec2, cli2]);
const mkClip = async (id, score, hook) => db.query(
  `INSERT INTO clips (id, recording_id, t_start_s, t_end_s, score, hook, status)
   VALUES ($1,$2,0,30,$3,$4,'published')`, [id, rec2, score, hook]);
const mkPub = async (id, clipId, platform, agoDays) => db.query(
  `INSERT INTO publish_jobs (id, clip_id, platform, status, published_at, external_url)
   VALUES ($1,$2,$3,'published', now() - ($4 || ' days')::interval, '/x/'||$1)`, [id, clipId, platform, String(agoDays)]);
const mkCap = async (pubId, views, retention, agoHours) => db.query(
  `INSERT INTO clip_metrics (id, publish_id, views, watch_time_s, retention, likes, comments, shares, follows, captured_at)
   VALUES ('met_'||$1::text||'_'||$4::text, $1, $2::bigint, $2::bigint * 10, $3, 10, 5, 3, 2, now() - ($4::text || ' hours')::interval)`,
  [pubId, views, retention, String(agoHours)]);

await mkClip(`clip_repA_${run}`, 90, 'Report clip A');
await mkClip(`clip_repB_${run}`, 70, 'Report clip B');
await mkPub(`pub_repA_yt_${run}`, `clip_repA_${run}`, 'youtube', 2);
await mkPub(`pub_repA_tt_${run}`, `clip_repA_${run}`, 'tiktok', 2);
await mkPub(`pub_repB_yt_${run}`, `clip_repB_${run}`, 'youtube', 5);
await mkPub(`pub_old_${run}`, `clip_repB_${run}`, 'x', 40); // outside 30d
await mkCap(`pub_repA_yt_${run}`, 1000, 0.5, 1);
await mkCap(`pub_repA_tt_${run}`, 3000, 0.8, 1);
await mkCap(`pub_repB_yt_${run}`, 500, 0.4, 9);   // stale capture…
await mkCap(`pub_repB_yt_${run}`, 2000, 0.4, 1);  // …superseded by this one
await mkCap(`pub_old_${run}`, 999999, 0.9, 1);    // must NOT count

r = await j('GET', `/api/analytics/clients/${cli2}`);
const t = r.data.totals;
assert(r.status === 200 && t.postsPublished === 3 && t.clipsPublished === 2,
  'report counts posts (per platform) and distinct clips in the window');
assert(t.views === 6000, `latest capture per post wins, window respected (views ${t.views} === 6000)`);
// weighted retention: (1000*0.5 + 3000*0.8 + 2000*0.4) / 6000 = 0.6166…
assert(t.avgRetention === 0.617, `retention is views-weighted (${t.avgRetention} === 0.617)`);
assert(r.data.posts[0].views === 3000 && r.data.posts[0].platform === 'tiktok',
  'posts ranked by views, the report leads with the winner');
assert(r.data.posts.every((p) => p.publishId !== `pub_old_${run}`), 'posts outside the window are excluded');
r = await j('GET', `/api/analytics/clients/${cli2}?days=60`);
assert(r.data.totals.postsPublished === 4 && r.data.totals.views === 1005999,
  'the window is a parameter — widen it and the old post returns');
r = await j('GET', '/api/analytics/clients/cli_nobody');
assert(r.status === 404, 'unknown client rejected');

// ops totals ride the same latest-per-post logic
r = await j('GET', '/api/analytics/ops');
assert(r.data.postsMeasured >= 5 && r.data.totalViews >= 6000,
  `ops analytics carries distribution totals (${r.data.postsMeasured} posts, ${r.data.totalViews} views)`);

// ── B6.3: the loop — exact math, the gate, one real retrain cycle ───────────
// Reset loop state so the defaults-first assertions hold on re-runs (CI is
// always fresh; local re-runs start the loop over).
await db.query('DELETE FROM scoring_weights');
// Craft a cohort with a PLANTED relationship (same trick as the pipeline
// smoke's loud bursts): 10 clips for one client where durationFit perfectly
// predicts performance, energy is flat, and position anti-predicts. The loop
// must detect exactly that — and only clips with real signals qualify, so the
// global sample is this cohort plus the few real pipeline clips.
const cli3 = (await j('POST', '/api/clients', { name: `B6 Loop Co ${run}` })).data.id;
const rec3 = `rec_loop_${run}`;
await db.query(`INSERT INTO recordings (id, client_id, kind, status) VALUES ($1,$2,'podcast','ready')`, [rec3, cli3]);
for (let i = 1; i <= 10; i++) {
  const cid = `clip_loop_${run}_${i}`, pid = `pub_loop_${run}_${i}`;
  await db.query(
    `INSERT INTO clips (id, recording_id, t_start_s, t_end_s, score, signals, hook, status)
     VALUES ($1,$2,0,30,$3,$4,'loop cohort','published')`,
    [cid, rec3, 50 + i, JSON.stringify({ energyZ: 1.0, durationFit: i / 10, positionBonus: (11 - i) / 10 })]);
  await db.query(
    `INSERT INTO publish_jobs (id, clip_id, platform, status, published_at, external_url)
     VALUES ($1,$2,'youtube','published', now() - interval '1 day', '/x/'||$1)`, [pid, cid]);
  await db.query(
    `INSERT INTO clip_metrics (id, publish_id, views, retention, captured_at)
     VALUES ('met_'||$1, $1, $2::bigint, 0.5, now())`, [pid, 1000 * i]);
}

const { spearman, ranks } = await import('../src/lib/stats.js');assert(spearman([1, 2, 3, 4], [10, 20, 30, 40]) === 1, 'spearman: perfect monotonic = 1');
assert(spearman([1, 2, 3, 4], [40, 30, 20, 10]) === -1, 'spearman: perfect inverse = -1');
assert(JSON.stringify(ranks([10, 20, 20, 30])) === '[1,2.5,2.5,4]', 'ranks: ties averaged');
assert(spearman([1, 1, 1], [5, 9, 2]) === null && spearman([1], [2]) === null,
  'spearman: constant series and n<2 are honestly undefined');

const { computeCorrelation, retrain: retrainDirect } = await import('../src/metrics/loop.js');
const gated = await computeCorrelation(10_000);
assert(gated.value === null && gated.sample > 0 && gated.needed === 10_000,
  `the sample gate holds (have ${gated.sample}, demanded 10000 → null)`);
assert((await retrainDirect(10_000)) === null, 'retrain refuses to move weights below the gate');

// live correlation over everything captured so far — machinery, not magic:
// under the local driver the value floats near zero by design
r = await j('GET', '/api/analytics/ops');
const corr = r.data.scoreCorrelation;
assert(corr.sample >= 10 && corr.value > 0.5,
  `the loop detects the planted score↔performance relationship (ρ=${corr.value}, n=${corr.sample})`);
assert(corr.perSignal.durationFit > 0.7 && corr.perSignal.position < 0,
  `per-signal correlations find the planted structure (durFit ${corr.perSignal.durationFit}, position ${corr.perSignal.position})`);
assert(r.data.scoringWeights.source === 'default' && r.data.scoringWeights.weights.energy === 0.6,
  'weights start at the defaults before any retrain');

// one real cycle through the API
r = await j('POST', '/api/analytics/retrain', { note: `b6 smoke ${run}` });
assert(r.status === 201 && r.data.id.startsWith('wts_'), 'retrain cycle ran');
const w = r.data.weights;
const sum = Number((w.energy + w.durationFit + w.position).toFixed(3));
assert(Math.abs(sum - 1) < 0.002, `new weights normalized (Σ=${sum})`);
assert(Object.values(w).every((v) => v >= 0.05), 'no signal dies: every weight floored');
assert(r.data.basis.sample === corr.sample && 'scoreCorrelation' in r.data.basis && r.data.basis.before.energy === 0.6,
  'the evidence basis is stored with the weights (sample, correlations, prior)');
const moved = Math.abs(w.energy - 0.6) + Math.abs(w.durationFit - 0.25) + Math.abs(w.position - 0.15);
assert(moved < 0.5 && moved > 0.01, `the step is bounded, not a jump (moved ${moved.toFixed(3)})`);
assert(w.durationFit > 0.25 && w.position < 0.15,
  `the weights moved TOWARD the rewarded signal and away from the punished one (durFit 0.25→${w.durationFit}, position 0.15→${w.position})`);

// the score stage now consumes the stored weights; history is append-only
r = await j('GET', '/api/analytics/ops');
assert(r.data.scoringWeights.source === 'retrained' && r.data.scoringWeights.weights.energy === w.energy,
  'the pipeline scores with the retrained weights from here on');
r = await j('POST', '/api/analytics/retrain', { note: `b6 smoke second ${run}` });
assert(r.status === 201, 'second cycle appends');
const hist = (await db.query(`SELECT count(*)::int AS n FROM scoring_weights`)).rows[0];
assert(hist.n >= 2, `weight history is append-only (${hist.n} rows) — every score is auditable`);

await db.end();
console.log('\nB6.1+B6.2+B6.3 smoke passed: captures roll in, reports aggregate to the digit, and the loop retrains the weights on real cycles — bounded, gated, and audited.');
process.exit(0); // the imported src modules hold their own pg pool open

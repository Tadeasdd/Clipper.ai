/* B5 smoke: publishing. Seeds approved clips directly (the pipeline smoke
   covers real rendering) and proves the publishing layer end-to-end with the
   local driver:

     approved → scheduled → publishing → published      (clip + job + outbox)
     approved → scheduled at T+future  → NOT picked up early
     approve (review API) with connections → auto-scheduled
     no rendered asset → 3 attempts → parked failed → retry re-arms
     scheduled → canceled → clip back to approved

   …plus the guarantees: only approved clips schedule (the sign-off promise),
   credentials encrypted at rest and never returned by the API. */
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

// ── seed: client, recording, clips (with + without a stored asset) ──────────
const run = uid();
const cli = (await j('POST', '/api/clients', { name: `B5 Publish Co ${run}` })).data.id;
const rec = `rec_pub_${run}`;
await db.query(`INSERT INTO recordings (id, client_id, kind, status, duration_s) VALUES ($1,$2,'podcast','ready',180)`, [rec, cli]);

const seedClip = async (status, withAsset) => {
  const id = `clip_pub_${uid()}`;
  let assetKey = null;
  if (withAsset) {
    assetKey = `${rec}/clips/${id}.mp4`;
    mkdirSync(path.join(STORAGE, rec, 'clips'), { recursive: true });
    writeFileSync(path.join(STORAGE, assetKey), Buffer.from(`fake-mp4-bytes-${id}`));
  }
  await db.query(
    `INSERT INTO clips (id, recording_id, t_start_s, t_end_s, score, hook, format, asset_key, status)
     VALUES ($1,$2,30,62,88,$3,'9:16',$4,$5)`,
    [id, rec, `Publish smoke hook ${run}`, assetKey, status]);
  return id;
};

// ── connections: encrypted at rest, never returned ──────────────────────────
let r = await j('POST', '/api/publish/connections', { clientId: cli, platform: 'fax', credentials: { x: 1 } });
assert(r.status === 400, 'unknown platform rejected');
r = await j('POST', '/api/publish/connections', { clientId: 'cli_nobody', platform: 'youtube', credentials: { x: 1 } });
assert(r.status === 404, 'unknown client rejected');
r = await j('POST', '/api/publish/connections', { clientId: cli, platform: 'youtube', credentials: { x: 1 } });
const SECRET = `refresh-token-${run}-very-secret`;
r = await j('POST', '/api/publish/connections', { clientId: cli, platform: 'youtube', handle: '@b5smoke', credentials: { refreshToken: SECRET } });
assert(r.status === 201 && r.data.id.startsWith('conn_') && r.data.credentials_enc === undefined && r.data.credentials === undefined,
  'connection created (re-auth replaced creds); API never returns credentials');
const conn = r.data.id;
const enc = await db.query('SELECT credentials_enc FROM platform_connections WHERE id = $1', [conn]);
assert(!enc.rows[0].credentials_enc.includes(SECRET) && !Buffer.from(enc.rows[0].credentials_enc, 'base64').toString('latin1').includes(SECRET),
  'credentials are encrypted at rest (no plaintext in the row)');
r = await j('GET', `/api/publish/connections?clientId=${cli}`);
assert(r.data.connections.length === 1 && r.data.connections[0].handle === '@b5smoke', 'connections list for the client');

// ── scheduling guards: the sign-off guarantee ───────────────────────────────
const clipUnapproved = await seedClip('awaiting_review', true);
r = await j('POST', '/api/publish', { clipId: clipUnapproved, platform: 'youtube' });
assert(r.status === 409 && /sign-off/.test(r.data.error), 'unapproved clip cannot be scheduled (the machine guarantee)');
const clipNoConn = await seedClip('approved', true);
r = await j('POST', '/api/publish', { clipId: clipNoConn, platform: 'tiktok' });
assert(r.status === 409 && /no active tiktok connection/.test(r.data.error), 'scheduling without a connection refused');
r = await j('POST', '/api/publish', { clipId: 'clip_nobody', platform: 'youtube' });
assert(r.status === 404, 'unknown clip rejected');

// ── the happy path: approved → published, delivered to the outbox ──────────
const clipHappy = await seedClip('approved', true);
r = await j('POST', '/api/publish', { clipId: clipHappy, platform: 'youtube' });
assert(r.status === 202 && r.data.status === 'scheduled', 'approved clip scheduled');
let st = await db.query('SELECT status FROM clips WHERE id = $1', [clipHappy]);
assert(st.rows[0].status === 'scheduled', "clip moved to 'scheduled' atomically with the job");
let job, deadline = Date.now() + 20_000;
for (;;) {
  await sleep(800);
  const queue = (await j('GET', '/api/publish/queue')).data.items;
  job = queue.find((i) => i.clip_id === clipHappy);
  if (job?.status === 'published' || job?.status === 'failed') break;
  if (Date.now() > deadline) { console.error('FAIL: publish never completed'); process.exit(1); }
}
assert(job.status === 'published' && job.external_url && job.client_name.startsWith('B5 Publish Co'),
  `scheduler published it (${job.external_url})`);
st = await db.query('SELECT status FROM clips WHERE id = $1', [clipHappy]);
assert(st.rows[0].status === 'published', "clip is 'published'");
let out = await fetch(BASE + job.external_url);
assert(out.status === 200 && (await out.arrayBuffer()).byteLength > 0, 'outbox serves the delivered file');
out = await fetch(BASE + job.external_url.replace('.mp4', '.json'));
const manifest = await out.json();
assert(manifest.caption === `Publish smoke hook ${run}` && manifest.handle === '@b5smoke',
  'delivery manifest carries the caption and handle');

// ── scheduled_at is honored: future jobs are not picked up early ────────────
const clipLater = await seedClip('approved', true);
const future = new Date(Date.now() + 3600_000).toISOString();
r = await j('POST', '/api/publish', { clipId: clipLater, platform: 'youtube', scheduledAt: future });
assert(r.status === 202, 'future publish scheduled');
await sleep(2500);
let q2 = (await j('GET', '/api/publish/queue')).data.items.find((i) => i.clip_id === clipLater);
assert(q2.status === 'scheduled', 'scheduler leaves future jobs alone (drains at scheduled_at)');

// ── cancel: job canceled, clip back to approved ─────────────────────────────
r = await j('POST', `/api/publish/${q2.id}/cancel`);
assert(r.status === 200 && r.data.status === 'canceled', 'scheduled publish canceled');
st = await db.query('SELECT status FROM clips WHERE id = $1', [clipLater]);
assert(st.rows[0].status === 'approved', "canceled clip returned to 'approved'");
r = await j('POST', `/api/publish/${q2.id}/cancel`);
assert(r.status === 409, 'double-cancel refused');

// ── auto-schedule: the B4 → B5 hook ─────────────────────────────────────────
const clipAuto = await seedClip('awaiting_client', true);
const owner = (await j('POST', '/api/users', { email: `b5owner+${run}@clipper.ai`, role: 'client', clientId: cli })).data.id;
r = await j('POST', `/api/review/${clipAuto}/decision`, { userId: owner, decision: 'approve' });
assert(r.status === 200 && r.data.to === 'approved' && r.data.scheduled.includes('youtube'),
  'client sign-off auto-scheduled the clip on every connected platform');
deadline = Date.now() + 20_000;
for (;;) {
  await sleep(800);
  q2 = (await j('GET', '/api/publish/queue')).data.items.find((i) => i.clip_id === clipAuto);
  if (q2?.status === 'published') break;
  if (Date.now() > deadline) { console.error('FAIL: auto-scheduled publish never completed'); process.exit(1); }
}
assert(q2.status === 'published', 'auto-scheduled clip published end-to-end');

// ── failure path: no rendered asset → retries → parked → retry re-arms ─────
const clipBroken = await seedClip('approved', false);
r = await j('POST', '/api/publish', { clipId: clipBroken, platform: 'youtube' });
assert(r.status === 202, 'broken clip scheduled (failure happens at publish time)');
deadline = Date.now() + 40_000;
for (;;) {
  await sleep(1500);
  q2 = (await j('GET', '/api/publish/queue')).data.items.find((i) => i.clip_id === clipBroken);
  if (q2?.status === 'failed') break;
  if (Date.now() > deadline) { console.error('FAIL: broken publish never parked'); process.exit(1); }
}
assert(q2.attempts === 3 && /no rendered asset/.test(q2.error),
  `parked after 3 attempts with the real error in the ops queue ("${q2.error.slice(0, 40)}…")`);
r = await j('POST', `/api/publish/${q2.id}/retry`);
assert(r.status === 202 && r.data.status === 'scheduled', 'retry re-arms the parked publish');
r = await j('POST', `/api/publish/${q2.id}/retry`);
assert(r.status === 409, 'retry refuses jobs that are not failed');

// ── revoked connections park with a visible error ───────────────────────────
r = await j('POST', `/api/publish/connections/${conn}/revoke`);
assert(r.status === 200 && r.data.status === 'revoked', 'connection revoked');
const clipRevoked = await seedClip('approved', true);
r = await j('POST', '/api/publish', { clipId: clipRevoked, platform: 'youtube' });
assert(r.status === 409 && /no active/.test(r.data.error), 'revoked connection blocks new scheduling');

await db.end();
console.log('\nB5 smoke passed: approved → scheduled → published end-to-end, with sign-off, encryption, retries, and cancel all enforced.');

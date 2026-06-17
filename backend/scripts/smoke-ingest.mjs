/* M4 smoke: robust ingest — direct-file pull, size/type limits, idempotency.
 *
 *  Self-contained: it boots its OWN API on :8099 with a small MAX_UPLOAD_BYTES
 *  (so the 413 case is real without affecting the shared suite server), serves
 *  a fixture media file from a local HTTP server (no network), and asserts:
 *    A. a direct media URL ingests to a probed recording (audio + duration)
 *    B. submitting the same URL twice yields ONE recording (idempotency index)
 *    C. an over-cap upload returns 413 and leaves no partial object
 *    D. a non-AV content-type upload is rejected (415)
 *    E. (gated) a real YouTube URL pulls via yt-dlp — RUN_LIVE_YT=1 + yt-dlp
 *
 *  Needs Postgres + ffmpeg. The live YouTube assertion is gated so offline CI
 *  stays green.
 */
import http from 'node:http';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const PORT = 8099;
const CAP = 262144; // 256 KB
process.env.PORT = String(PORT);
process.env.MAX_UPLOAD_BYTES = String(CAP);
process.env.WORKERS_ENABLED = 'true';
process.env.STORAGE_DIR = process.env.STORAGE_DIR || mkdtempSync(path.join(tmpdir(), 'clipper-ingest-store-'));
// S1 SSRF guard: the direct-pull fixture is served from a local HTTP server, so
// explicitly trust that host (allowlisted hosts skip the private-range check)
// and permit http. Production leaves both unset → https-only, no private IPs.
process.env.INGEST_ALLOW_HTTP = 'true';
process.env.INGEST_HOST_ALLOWLIST = 'localhost,127.0.0.1';

const BASE = `http://localhost:${PORT}`;
const assert = (cond, msg) => { if (!cond) { console.error('FAIL:', msg); process.exit(1); } console.log('ok:', msg); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// S1: run on an ISOLATED database. This smoke self-boots its own server +
// workers and trusts the local fixture host (the INGEST_* vars above); a second
// worker pool sharing the suite database — which does NOT trust that host —
// could otherwise claim our ingest job off the queue and refuse it. A dedicated
// database guarantees only our own worker processes these jobs.
{
  const pgMod = (await import('pg')).default;
  const adminUrl = process.env.DATABASE_URL || 'postgres://clipper:clipper@localhost:5432/clipper';
  const testDb = 'clipper_ingest_smoke';
  const admin = new pgMod.Client({ connectionString: adminUrl });
  await admin.connect();
  await admin.query(`DROP DATABASE IF EXISTS ${testDb} WITH (FORCE)`);
  await admin.query(`CREATE DATABASE ${testDb}`);
  await admin.end();
  const u = new URL(adminUrl);
  u.pathname = `/${testDb}`;
  process.env.DATABASE_URL = u.toString();
}

// Boot our own server (auto-migrates, starts workers) and wait for health.
await import('../src/server.js');
for (let i = 0; i < 40; i++) {
  if (await fetch(`${BASE}/api/health`).then((r) => r.ok).catch(() => false)) break;
  await sleep(250);
}

const pg = (await import('pg')).default;
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL || 'postgres://clipper:clipper@localhost:5432/clipper' });
const { opsSession } = await import('./lib-smoke-auth.mjs');
const OPS = await opsSession(BASE);
const j = async (method, p, body, token, headers = {}) => {
  const res = await fetch(BASE + p, {
    method,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token || OPS}`, ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json().catch(() => ({})) };
};

// ── fixture: a ~6s audio mp4 (well under the 256 KB cap) + an HTTP server ────
const tmp = mkdtempSync(path.join(tmpdir(), 'clipper-ingest-'));
const fixture = path.join(tmp, 'fixture.mp4');
execFileSync('ffmpeg', ['-hide_banner', '-y', '-f', 'lavfi',
  '-i', 'anoisesrc=color=pink:duration=6:amplitude=0.4:seed=11',
  '-c:a', 'aac', '-b:a', '96k', fixture], { stdio: 'pipe' });
const fixtureBytes = readFileSync(fixture);
assert(fixtureBytes.length < CAP, `fixture is under the cap (${(fixtureBytes.length / 1024).toFixed(0)} KB < 256 KB)`);

const fileServer = http.createServer((_req, res) => {
  res.writeHead(200, { 'content-type': 'video/mp4', 'content-length': fixtureBytes.length });
  res.end(fixtureBytes);
});
await new Promise((resolve) => fileServer.listen(8091, resolve));
const FIXTURE_URL = 'http://localhost:8091/fixture.mp4';

const cli = (await j('POST', '/api/clients', { name: `M4 Ingest Co ${Date.now()}` })).data.id;

// ── A. direct media URL ingests through the real pipeline ───────────────────
let r = await j('POST', '/api/intake', { clientId: cli, sourceUrl: FIXTURE_URL, kind: 'podcast' });
assert(r.status === 201 && r.data.status === 'queued', 'direct media URL accepted and queued');
const rec = r.data.recordingId;
let detail, deadline = Date.now() + 60_000;
for (;;) {
  await sleep(1500);
  detail = (await j('GET', `/api/jobs/${rec}`)).data;
  if (detail.status === 'ready' || detail.status === 'failed') break;
  if (Date.now() > deadline) { console.error('FAIL: ingest never finished'); process.exit(1); }
}
const ingestStage = (detail.stages || []).find((s) => s.stage === 'ingest');
assert(ingestStage?.status === 'done', 'ingest pulled the file and probed it');
assert(detail.duration_s >= 5 && detail.duration_s <= 7, `probed real duration (${detail.duration_s}s)`);

// ── B. idempotency: the same URL twice is one recording ─────────────────────
r = await j('POST', '/api/intake', { clientId: cli, sourceUrl: FIXTURE_URL, kind: 'podcast' });
assert(r.status === 200 && r.data.duplicate === true && r.data.recordingId === rec,
  'resubmitting the same URL returns the original recording (duplicate)');
const count = (await db.query(
  'SELECT count(*)::int AS n FROM recordings WHERE client_id = $1 AND source_url = $2', [cli, FIXTURE_URL])).rows[0].n;
assert(count === 1, `the double-submit created exactly one recording (${count})`);

// the explicit Idempotency-Key also dedupes (and validates kind)
r = await j('POST', '/api/intake', { clientId: cli, filename: 'a.mp4', kind: 'nonsense' });
assert(r.status === 400 && /kind must be one of/.test(r.data.error), 'an unknown kind is rejected');
const k1 = await j('POST', '/api/intake', { clientId: cli, filename: 'a.mp4' }, null, { 'Idempotency-Key': 'dupe-key-1' });
const k2 = await j('POST', '/api/intake', { clientId: cli, filename: 'b.mp4' }, null, { 'Idempotency-Key': 'dupe-key-1' });
assert(k1.status === 201 && k2.status === 200 && k2.data.duplicate && k2.data.recordingId === k1.data.recordingId,
  'an explicit Idempotency-Key dedupes a double-click');

// ── C. an over-cap upload returns 413 and leaves no partial object ──────────
r = await j('POST', '/api/intake', { clientId: cli, filename: 'too-big.mp4' });
const bigRec = r.data.recordingId;
const uploadUrl = r.data.upload.uploadUrl;
const big = Buffer.alloc(CAP * 2, 7); // double the cap
const put = await fetch(BASE + uploadUrl, { method: 'PUT', headers: { 'content-type': 'video/mp4', authorization: `Bearer ${OPS}` }, body: big });
assert(put.status === 413, `over-cap upload rejected with 413 (got ${put.status})`);
const stored = (await j('GET', `/api/intake/${bigRec}`)).data.stored;
assert(!stored || stored.bytes === 0, 'no partial object is left behind after a 413');

// ── D. a non-AV content-type is rejected (415) ──────────────────────────────
r = await j('POST', '/api/intake', { clientId: cli, filename: 'not-media.mp4' });
const htmlRec = r.data.recordingId;
const put2 = await fetch(BASE + r.data.upload.uploadUrl, {
  method: 'PUT', headers: { 'content-type': 'text/html', authorization: `Bearer ${OPS}` }, body: '<html>nope</html>' });
assert(put2.status === 415, `non-AV content-type rejected with 415 (got ${put2.status})`);

// ── E. (gated) real YouTube URL via yt-dlp ──────────────────────────────────
const ytAvailable = spawnSync(process.env.YTDLP_BIN || 'yt-dlp', ['--version'], { stdio: 'ignore' }).status === 0;
if (process.env.RUN_LIVE_YT && ytAvailable) {
  const url = process.env.LIVE_YT_URL || 'https://www.youtube.com/watch?v=aqz-KE-bpKQ';
  r = await j('POST', '/api/intake', { clientId: cli, sourceUrl: url });
  assert(r.status === 201, 'YouTube URL accepted');
  let yt, dl = Date.now() + 120_000;
  for (;;) {
    await sleep(2000);
    yt = (await j('GET', `/api/jobs/${r.data.recordingId}`)).data;
    if (yt.status === 'ready' || yt.status === 'failed') break;
    if (Date.now() > dl) { console.error('FAIL: youtube ingest timed out'); process.exit(1); }
  }
  assert(yt.status === 'ready' && yt.duration_s > 5, `yt-dlp ingested a real YouTube video (${yt.duration_s}s)`);
} else {
  console.log('skip: live YouTube ingest (set RUN_LIVE_YT=1 with yt-dlp installed to run it)');
}

await db.end();
fileServer.close();
console.log('\nM4 smoke passed: direct-file pull, size/type limits, and idempotent intake all hold.');
process.exit(0);

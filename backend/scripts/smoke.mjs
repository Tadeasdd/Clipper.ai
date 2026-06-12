/* B2 end-to-end smoke against a real Postgres + local storage:
   client → lead (dedup) → URL intake → file intake → upload → queue → detail. */
const BASE = process.env.BASE || 'http://localhost:8080';
import { opsSession } from './lib-smoke-auth.mjs';
const OPS = await opsSession(BASE); // B7: the API has one door now
const j = async (method, path, body, raw) => {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      ...(raw ? { 'content-type': 'application/octet-stream' } : { 'content-type': 'application/json' }),
      authorization: `Bearer ${OPS}`,
    },
    body: raw ? body : body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
};
const assert = (cond, msg) => { if (!cond) { console.error('FAIL:', msg); process.exit(1); } console.log('ok:', msg); };

// health + db
let r = await j('GET', '/api/health');
assert(r.status === 200 && r.data.db === 'up', 'health: db up');

// client CRUD
r = await j('POST', '/api/clients', { name: 'Smoke Podcast Co', plan: 'growth', cadence: 'weekly' });
assert(r.status === 201 && r.data.id.startsWith('cli_'), 'client created');
const cli = r.data.id;
r = await j('POST', '/api/clients', {});
assert(r.status === 400, 'client without name rejected');

// leads: create, dedup, stats
const email = `smoke+${Date.now()}@clipper.ai`;
r = await j('POST', '/api/leads', { email, contentKind: 'podcast', source: 'waitlist', meta: { page: 'home' } });
assert(r.status === 201 && r.data.position >= 1 && !r.data.duplicate, 'lead created with position');
const firstPos = r.data.position;
r = await j('POST', '/api/leads', { email, source: 'waitlist' });
assert(r.status === 200 && r.data.duplicate && r.data.position === firstPos, 'lead resubmit dedupes, keeps position');
r = await j('POST', '/api/leads', { email: 'not-an-email' });
assert(r.status === 400, 'bad email rejected');
r = await j('GET', '/api/leads/stats');
assert(r.status === 200 && r.data.total >= 1 && r.data.today >= 1, 'lead stats aggregate');

// intake by URL → queued
r = await j('POST', '/api/intake', { clientId: cli, sourceUrl: 'https://example.com/ep1.mp3', kind: 'podcast' });
assert(r.status === 201 && r.data.status === 'queued' && !r.data.upload, 'URL intake queued');

// intake by file → awaiting_upload + target, then upload → queued
r = await j('POST', '/api/intake', { clientId: cli, filename: 'episode 42 (final).mp4', kind: 'podcast' });
assert(r.status === 201 && r.data.status === 'awaiting_upload' && r.data.upload?.mode === 'local', 'file intake returns upload target');
const rec = r.data.recordingId;
const fakeVideo = Buffer.alloc(256 * 1024, 7); // 256 KB stand-in for a podcast file
r = await j('PUT', r.data.upload.uploadUrl, fakeVideo, true);
assert(r.status === 200 && r.data.bytes === fakeVideo.length && r.data.status === 'queued', `upload stored ${fakeVideo.length} bytes, queued`);
r = await j('PUT', `/api/intake/upload/${rec}`, fakeVideo, true);
assert(r.status === 409, 'double upload rejected');

// queue shows both; detail confirms bytes on disk
r = await j('GET', '/api/intake/queue');
const ids = r.data.items.map((i) => i.id);
assert(ids.includes(rec) && r.data.items.every((i) => i.client_name), 'queue lists recordings with client names');
r = await j('GET', `/api/intake/${rec}`);
assert(r.data.stored?.bytes === fakeVideo.length, 'object storage holds the file (B2 done-criterion)');

// unknown client
r = await j('POST', '/api/intake', { clientId: 'cli_nope', sourceUrl: 'https://x.com/a.mp3' });
assert(r.status === 404, 'unknown client rejected');

console.log('\nB2 smoke passed.');

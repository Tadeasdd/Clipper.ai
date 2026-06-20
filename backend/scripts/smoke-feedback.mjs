/* U4 — feedback capture smoke. The FeedbackWidget no longer fakes its submit;
   this proves the real endpoint: a valid rating persists, bad/missing ratings
   are rejected, the ops listing is walled, and the per-IP limiter trips. */
const BASE = process.env.BASE || 'http://localhost:8080';
import { opsSession } from './lib-smoke-auth.mjs';
const OPS = await opsSession(BASE);

const post = async (body) => {
  const res = await fetch(BASE + '/api/feedback', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: res.status, data: await res.json().catch(() => ({})) };
};
const get = async (token) => {
  const res = await fetch(BASE + '/api/feedback', {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
  return { status: res.status, data: await res.json().catch(() => ({})) };
};
const assert = (cond, msg) => { if (!cond) { console.error('FAIL:', msg); process.exit(1); } console.log('ok:', msg); };

// valid ratings persist (with and without the optional fields)
const jobId = `job_smoke_${Date.now()}`;
let r = await post({ rating: 'up', jobId, note: 'tight hooks' });
assert(r.status === 201 && r.data.id?.startsWith('fb_') && r.data.ok, 'thumbs-up persisted');
r = await post({ rating: 'down' });
assert(r.status === 201 && r.data.id?.startsWith('fb_'), 'thumbs-down persisted (no jobId/note)');

// bad shapes rejected (enum + required), CHECK constraint never reached
r = await post({ rating: 'meh' });
assert(r.status === 400, "rating outside up/down rejected");
r = await post({ note: 'no rating' });
assert(r.status === 400, 'missing rating rejected');
r = await post({ rating: 'up', surprise: 'x' });
assert(r.status === 400, 'unknown field rejected (strict validate)');

// ops listing is walled and shows our row
r = await get(null);
assert(r.status === 401 || r.status === 403, 'GET feedback requires auth');
r = await get(OPS);
assert(r.status === 200 && Array.isArray(r.data.feedback), 'ops can list feedback');
assert(r.data.feedback.some((f) => f.job_id === jobId && f.rating === 'up'), 'our row is in the listing');

// the per-IP limiter trips (default 60/min) — loop until a 429, bounded
let tripped = false;
for (let i = 0; i < 80 && !tripped; i++) {
  const res = await post({ rating: 'up', jobId });
  if (res.status === 429) tripped = true;
}
assert(tripped, 'feedback rate limiter trips under a flood');

console.log('\nU4 feedback smoke passed.');

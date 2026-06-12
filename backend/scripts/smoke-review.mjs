/* B4 smoke: the review workflow. Seeds clips directly in Postgres (no ffmpeg
   needed — the pipeline smoke covers rendering) and drives the FULL status
   machine through the API:

     awaiting_review → approved_internal → awaiting_client → approved
     awaiting_review → changes_requested → (edit) → awaiting_review → rejected
     awaiting_review → approved  (auto-publish client skips sign-off)

   …plus the cases that must NOT work: wrong-client users, client users
   skipping the queue, decisions out of order, and double-decisions. */
import pg from 'pg';

const BASE = process.env.BASE || 'http://localhost:8080';
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL || 'postgres://clipper:clipper@localhost:5432/clipper' });

const j = async (method, p, body) => {
  const res = await fetch(BASE + p, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json().catch(() => ({})) };
};
const assert = (cond, msg) => { if (!cond) { console.error('FAIL:', msg); process.exit(1); } console.log('ok:', msg); };
const uid = () => Math.random().toString(36).slice(2, 8);

// ── seed: two clients (one auto-publish), a recording each, three clips ─────
const run = uid();
let r = await j('POST', '/api/clients', { name: `B4 Review Co ${run}` });
const cli = r.data.id;
r = await j('POST', '/api/clients', { name: `B4 AutoPub Co ${run}`, brandConfig: { auto_publish: true } });
const cliAuto = r.data.id;
r = await j('POST', '/api/clients', { name: `B4 Other Co ${run}` });
const cliOther = r.data.id;

const seedRecording = async (clientId) => {
  const id = `rec_smoke_${uid()}`;
  await db.query(`INSERT INTO recordings (id, client_id, kind, status, duration_s) VALUES ($1,$2,'podcast','ready',180)`, [id, clientId]);
  return id;
};
const seedClip = async (recordingId, status = 'awaiting_review') => {
  const id = `clip_smoke_${uid()}`;
  await db.query(
    `INSERT INTO clips (id, recording_id, t_start_s, t_end_s, score, signals, hook, format, status)
     VALUES ($1,$2,30,62,87,'{"energyZ":1.8,"durationFit":0.97,"positionBonus":0.93}','hook pending editor','9:16',$3)`,
    [id, recordingId, status]);
  return id;
};
const recA = await seedRecording(cli);
const recAuto = await seedRecording(cliAuto);
const clipHappy = await seedClip(recA);     // the full happy path
const clipChanges = await seedClip(recA);   // the changes → resubmit → reject loop
const clipAuto = await seedClip(recAuto);   // the auto-publish opt-in
console.log(`seeded: ${clipHappy}, ${clipChanges}, ${clipAuto}`);

// ── users: records + validation (B7 precursor) ──────────────────────────────
r = await j('POST', '/api/users', { email: `qa+${run}@clipper.ai`, role: 'reviewer' });
assert(r.status === 201 && r.data.id.startsWith('usr_'), 'reviewer user created');
const reviewer = r.data.id;
r = await j('POST', '/api/users', { email: `qa+${run}@clipper.ai`, role: 'reviewer' });
assert(r.status === 200 && r.data.id === reviewer, 'user create is idempotent per email');
r = await j('POST', '/api/users', { email: `qa+${run}@clipper.ai`, role: 'ops' });
assert(r.status === 409, 'same email with a different role is a 409');
r = await j('POST', '/api/users', { email: `x+${run}@clipper.ai`, role: 'janitor' });
assert(r.status === 400, 'unknown role rejected');
r = await j('POST', '/api/users', { email: `c+${run}@clipper.ai`, role: 'client' });
assert(r.status === 400, 'client role without clientId rejected');

const mkUser = async (email, role, clientId) =>
  (await j('POST', '/api/users', { email: `${email}+${run}@clipper.ai`, role, clientId })).data.id;
const editor = await mkUser('editor', 'editor');
const am = await mkUser('am', 'account_manager');
const clientUser = await mkUser('client', 'client', cli);
const otherClientUser = await mkUser('intruder', 'client', cliOther);

// ── the worklist ─────────────────────────────────────────────────────────────
r = await j('GET', '/api/review/queue');
const queued = r.data.items.filter((i) => [clipHappy, clipChanges, clipAuto].includes(i.id));
assert(queued.length === 3, `review queue lists the seeded clips (${queued.length}/3)`);
assert(queued.every((i) => i.client_name && i.score !== null && i.signals?.energyZ !== undefined),
  'queue rows carry client, score, and the scoring evidence');
r = await j('GET', '/api/review/queue?status=published');
assert(r.status === 400, 'unreviewable queue status rejected');

// ── guards before the happy path ─────────────────────────────────────────────
r = await j('POST', `/api/review/${clipHappy}/decision`, { userId: 'usr_nobody', decision: 'approve' });
assert(r.status === 404, 'unknown user is a 404');
r = await j('POST', `/api/review/${clipHappy}/decision`, { userId: reviewer, decision: 'ship-it' });
assert(r.status === 400, 'unknown decision is a 400');
r = await j('POST', `/api/review/${clipHappy}/send`, { userId: am });
assert(r.status === 409, 'cannot send to client before internal approval');
r = await j('POST', `/api/review/${clipHappy}/decision`, { userId: clientUser, decision: 'approve' });
assert(r.status === 409, 'client cannot approve while the clip is still in internal review');

// ── happy path: awaiting_review → approved_internal → awaiting_client → approved
r = await j('POST', `/api/review/${clipHappy}/decision`, { userId: reviewer, decision: 'approve', notes: 'clean cut' });
assert(r.status === 200 && r.data.to === 'approved_internal' && !r.data.autoPublished,
  'internal approve → approved_internal (no auto-publish)');
r = await j('POST', `/api/review/${clipHappy}/decision`, { userId: reviewer, decision: 'approve' });
assert(r.status === 409, 'double-decision is a 409 (atomic transition held)');
r = await j('POST', `/api/review/${clipHappy}/send`, { userId: clientUser });
assert(r.status === 403, 'client users cannot perform the send step');
r = await j('POST', `/api/review/${clipHappy}/send`, { userId: am });
assert(r.status === 200 && r.data.to === 'awaiting_client', 'account manager sends → awaiting_client');
r = await j('POST', `/api/review/${clipHappy}/decision`, { userId: otherClientUser, decision: 'approve' });
assert(r.status === 403, "another client's user cannot decide on this clip");
r = await j('POST', `/api/review/${clipHappy}/decision`, { userId: clientUser, decision: 'approve', notes: 'love it' });
assert(r.status === 200 && r.data.to === 'approved', 'client approve → approved (FULL MACHINE TRAVELLED)');

// ── changes loop: changes_requested → edit → resubmit → reject ──────────────
r = await j('POST', `/api/review/${clipChanges}/decision`, { userId: reviewer, decision: 'changes', notes: 'hook is flat' });
assert(r.status === 200 && r.data.to === 'changes_requested', 'changes → changes_requested');
r = await j('GET', '/api/review/queue?status=changes_requested');
assert(r.data.items.some((i) => i.id === clipChanges), 'editor worklist shows the clip');
r = await j('PATCH', `/api/clips/${clipChanges}`, { hook: 'The number nobody in the room expected' });
assert(r.status === 200, 'editor rewrites the hook');
r = await j('POST', `/api/review/${clipChanges}/resubmit`, { userId: clientUser });
assert(r.status === 403, 'client users cannot resubmit');
r = await j('POST', `/api/review/${clipChanges}/resubmit`, { userId: editor });
assert(r.status === 200 && r.data.to === 'awaiting_review', 'resubmit → back in the review queue');
r = await j('POST', `/api/review/${clipChanges}/resubmit`, { userId: editor });
assert(r.status === 409, 'resubmit only works from changes_requested');
r = await j('POST', `/api/review/${clipChanges}/decision`, { userId: reviewer, decision: 'reject', notes: 'still flat' });
assert(r.status === 200 && r.data.to === 'rejected', 'second review can reject');

// ── auto-publish opt-in: the one legal way to skip client sign-off ──────────
r = await j('POST', `/api/review/${clipAuto}/decision`, { userId: reviewer, decision: 'approve' });
assert(r.status === 200 && r.data.to === 'approved' && r.data.autoPublished === true,
  'auto-publish client: internal approve → approved directly');

// ── the audit trail ──────────────────────────────────────────────────────────
r = await j('GET', `/api/review/${clipHappy}/history`);
const decisions = r.data.events.map((e) => e.decision);
assert(decisions.join(',') === 'approve,send_to_client,approve',
  `history records the full journey (${decisions.join(' → ')})`);
assert(r.data.events[0].reviewer_role === 'reviewer' && r.data.events[2].reviewer_role === 'client',
  'every event is attributable to a role');
r = await j('GET', `/api/review/${clipChanges}/history`);
assert(r.data.events.map((e) => e.decision).join(',') === 'changes,resubmit,reject',
  'the changes loop is fully audited');

await db.end();

// ── ops analytics (the F4.6 slice of B6) ────────────────────────────────────
r = await j('GET', '/api/analytics/ops');
assert(r.status === 200 && r.data.approvalRate >= 0 && r.data.approvalRate <= 1 && r.data.verdicts >= 5,
  `approval rate computed from real verdicts (${r.data.approvalRate} over ${r.data.verdicts})`);
assert(r.data.medianTurnaroundHours === null || r.data.medianTurnaroundHours > 0,
  'median turnaround is null (no finished pipelines) or positive');
assert(r.data.scoreCorrelation === null,
  'score correlation stays honestly null until B6 has published performance');

console.log('\nB4 smoke passed: the full status machine travels via the API — with sign-off enforced.');

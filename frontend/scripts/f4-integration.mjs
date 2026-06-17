/* F4 integration: render the BUILT ops dashboard in happy-dom against the
   live backend, click through a real review (approve with a note, then send
   to client), and verify every transition + audit row in Postgres.
   Needs: backend on :8080 with its Postgres (same as the backend smokes).
   NOTE: capture node's raw fetch BEFORE GlobalRegistrator.register() —
   happy-dom's fetch caches GETs and will serve you stale reads. */
const rawFetch = globalThis.fetch.bind(globalThis); // BEFORE happy-dom registers (no cache)
import { GlobalRegistrator } from '@happy-dom/global-registrator';
import { readdirSync } from 'node:fs';
GlobalRegistrator.register({ url: 'http://localhost/ops/review' });
document.body.innerHTML = '<div id="root"></div>';
if (!window.IntersectionObserver) window.IntersectionObserver = class { observe(){} unobserve(){} disconnect(){} };

// B7: sign in for real — bootstrap-or-login the fixed smoke ops account, then
// hand the app the bearer token the way the login screen would.
const OPS_CREDS = { email: 'ops@smoke.clipper.ai', password: 'smoke-ops-password' };
let TOKEN = null;
const api = (m, p, b) => rawFetch('http://localhost:8080' + p, {
  method: m,
  headers: { 'content-type': 'application/json', ...(TOKEN ? { authorization: `Bearer ${TOKEN}` } : {}) },
  body: b ? JSON.stringify(b) : undefined,
}).then((r) => r.json());
await api('POST', '/api/auth/bootstrap', OPS_CREDS); // 201 once, 409 after
TOKEN = (await api('POST', '/api/auth/login', OPS_CREDS)).token;
if (!TOKEN) { console.error('FAIL: could not sign in as the smoke ops account'); process.exit(1); }

// seed: a fresh clip in awaiting_review (decisions are by the ops session)
const stamp = Date.now();
const cli = (await api('POST', '/api/clients', { name: `F4 Desk Co ${stamp}` })).id;
// recording + clip rows via the seeding trick the B4 smoke uses (pg direct)
const { default: pg } = await import('../../backend/node_modules/pg/lib/index.js');
const db = new pg.Pool({ connectionString: 'postgres://clipper:clipper@localhost:5432/clipper' });
const rec = `rec_desk_${stamp}`;
const clip = `clip_desk_${stamp}`;
const hook = `Desk check hook ${stamp}`;
await db.query(`INSERT INTO recordings (id, client_id, kind, status, duration_s) VALUES ($1,$2,'podcast','ready',180)`, [rec, cli]);
await db.query(`INSERT INTO clips (id, recording_id, t_start_s, t_end_s, score, signals, hook, status)
                VALUES ($1,$2,30,62,91,'{"energyZ":2.1,"durationFit":0.97,"positionBonus":0.93}',$3,$4)`, [clip, rec, hook, 'awaiting_review']);

// route app fetches to the live backend, attaching the httpOnly session cookie
// the way a browser would (S2: the app no longer holds the token in JS).
globalThis.fetch = (input, init = {}) => {
  let url = typeof input === 'string' ? input : input.url;
  if (url.startsWith('/api/') || url.startsWith('http://localhost/api/')) url = 'http://localhost:8080' + url.replace('http://localhost', '');
  const headers = { ...(init.headers || {}), ...(TOKEN ? { cookie: `clipper_session=${TOKEN}` } : {}) };
  return rawFetch(url, { ...init, headers });
};
window.fetch = globalThis.fetch;

const entry = readdirSync('dist/assets').find((f) => f.startsWith('index-') && f.endsWith('.js'));
await import('../dist/assets/' + entry);
const settle = (ms) => new Promise((r) => setTimeout(r, ms));
await settle(1800);

const checks = [];
let html = document.getElementById('root').innerHTML;
checks.push(['desk renders the seeded clip', html.includes(`F4 Desk Co ${stamp}`) && html.includes(hook)]);
checks.push(['account badge shows the signed-in ops user', html.includes('ops@smoke.clipper.ai')]);
// S2: the app authenticated entirely on the httpOnly cookie — no token in JS storage.
checks.push(['no session token in localStorage (httpOnly cookie only)', !localStorage.getItem('clipper_session')]);
checks.push(['worklist tabs with counts', /To review.*In edit.*To send.*With client/s.test(html)]);

// type a note, click approve on OUR card (find the card containing our hook)
const cards = [...document.querySelectorAll('section')].filter((s) => s.textContent.includes(hook));
checks.push(['found our review card', cards.length === 1]);
if (cards.length === 1) {
  const card = cards[0];
  const note = card.querySelector('input[placeholder*="notes"]');
  if (note) {
    const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(note), 'value').set;
    setter.call(note, 'approved from the desk UI');
    note.dispatchEvent(new window.Event('input', { bubbles: true }));
    await settle(120);
  }
  const approve = [...card.querySelectorAll('button')].find((b) => b.textContent.trim() === 'approve');
  approve?.click();
  await settle(1200);
  const { rows } = await db.query('SELECT status FROM clips WHERE id = $1', [clip]);
  checks.push(['UI approve → approved_internal in Postgres', rows[0].status === 'approved_internal']);
  const hist = await api('GET', `/api/review/${clip}/history`);
  checks.push(['audit row carries the typed note + the session identity', hist.events[0]?.notes === 'approved from the desk UI' && hist.events[0]?.reviewer_email === 'ops@smoke.clipper.ai']);
  // after refresh, the card leaves "To review" (it's now in "To send")
  await settle(900);
  html = document.getElementById('root').innerHTML;
  checks.push(['card left the To-review worklist after the decision', !html.includes(hook)]);

  // follow the clip: switch to the To-send tab, send it to the client via the UI
  const toSend = [...document.querySelectorAll('button')].find((b) => /To send/.test(b.textContent));
  toSend?.click();
  await settle(1200);
  const sendCards = [...document.querySelectorAll('section')].filter((s) => s.textContent.includes(hook));
  checks.push(['clip arrived in the To-send worklist', sendCards.length === 1]);
  const sendBtn = sendCards[0] && [...sendCards[0].querySelectorAll('button')].find((b) => /send to client/.test(b.textContent));
  sendBtn?.click();
  await settle(1200);
  const after = await db.query('SELECT status FROM clips WHERE id = $1', [clip]);
  checks.push(['UI send → awaiting_client in Postgres', after.rows[0].status === 'awaiting_client']);
  const hist2 = await api('GET', `/api/review/${clip}/history`);
  checks.push(['audit trail: approve then send_to_client', hist2.events.map((e) => e.decision).join(',') === 'approve,send_to_client']);
}

await db.end();
let bad = 0;
for (const [name, ok] of checks) { console.log((ok ? 'ok ' : 'FAIL') + ': ' + name); if (!ok) bad++; }
process.exit(bad ? 1 : 0);

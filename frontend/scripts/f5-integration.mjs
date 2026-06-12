/* F5 integration: render the BUILT client portal in happy-dom against the
   live backend as a real CLIENT session, prove the fence holds in the
   rendered HTML (another client's clip never appears), click through a real
   sign-off (approve with a note), and verify the transition + attribution
   in Postgres. Then walk the other surfaces: submit a URL through the UI,
   and render the report.
   Needs: backend on :8080 with its Postgres (same as the backend smokes).
   NOTE: capture node's raw fetch BEFORE GlobalRegistrator.register() —
   happy-dom's fetch caches GETs and will serve you stale reads. */
const rawFetch = globalThis.fetch.bind(globalThis); // BEFORE happy-dom registers (no cache)
import { GlobalRegistrator } from '@happy-dom/global-registrator';
import { readdirSync } from 'node:fs';
GlobalRegistrator.register({ url: 'http://localhost/portal/review' });
document.body.innerHTML = '<div id="root"></div>';
if (!window.IntersectionObserver) window.IntersectionObserver = class { observe(){} unobserve(){} disconnect(){} };

// B7: ops session creates the world; the portal runs as a minted client user.
const OPS_CREDS = { email: 'ops@smoke.clipper.ai', password: 'smoke-ops-password' };
const stamp = Date.now();
let TOKEN = null;
const api = (m, p, b) => rawFetch('http://localhost:8080' + p, {
  method: m,
  headers: { 'content-type': 'application/json', ...(TOKEN ? { authorization: `Bearer ${TOKEN}` } : {}) },
  body: b ? JSON.stringify(b) : undefined,
}).then((r) => r.json());
await api('POST', '/api/auth/bootstrap', OPS_CREDS); // 201 once, 409 after
TOKEN = (await api('POST', '/api/auth/login', OPS_CREDS)).token;
if (!TOKEN) { console.error('FAIL: could not sign in as the smoke ops account'); process.exit(1); }

// two clients: ours, and a neighbor whose data must never render
const cliA = (await api('POST', '/api/clients', { name: `F5 Portal Co ${stamp}` })).id;
const cliB = (await api('POST', '/api/clients', { name: `F5 Neighbor Co ${stamp}` })).id;
const CLIENT_EMAIL = `portal+${stamp}@client.clipper.ai`;
await api('POST', '/api/users', { email: CLIENT_EMAIL, role: 'client', clientId: cliA, password: 'portal-first-password' });

// seed: one clip awaiting OUR sign-off, one awaiting the neighbor's
const { default: pg } = await import('../../backend/node_modules/pg/lib/index.js');
const db = new pg.Pool({ connectionString: 'postgres://clipper:clipper@localhost:5432/clipper' });
const mkClip = async (cli, suffix, hook) => {
  const rec = `rec_f5_${suffix}_${stamp}`;
  const clip = `clip_f5_${suffix}_${stamp}`;
  await db.query(`INSERT INTO recordings (id, client_id, kind, status, duration_s) VALUES ($1,$2,'podcast','ready',180)`, [rec, cli]);
  await db.query(`INSERT INTO clips (id, recording_id, t_start_s, t_end_s, score, signals, hook, status)
                  VALUES ($1,$2,30,62,91,'{"energyZ":2.1,"durationFit":0.97,"positionBonus":0.93}',$3,'awaiting_client')`, [clip, rec, hook]);
  return clip;
};
const hookA = `Portal sign-off hook ${stamp}`;
const hookB = `NEIGHBOR SECRET hook ${stamp}`;
const clipA = await mkClip(cliA, 'own', hookA);
await mkClip(cliB, 'other', hookB);

// now become the client: this is the session the portal runs as
TOKEN = (await api('POST', '/api/auth/login', { email: CLIENT_EMAIL, password: 'portal-first-password' })).token;
if (!TOKEN) { console.error('FAIL: minted client user could not sign in'); process.exit(1); }
localStorage.setItem('clipper_session', TOKEN);

// route app fetches to the live backend
globalThis.fetch = (input, init) => {
  let url = typeof input === 'string' ? input : input.url;
  if (url.startsWith('/api/') || url.startsWith('http://localhost/api/')) url = 'http://localhost:8080' + url.replace('http://localhost', '');
  return rawFetch(url, init);
};
window.fetch = globalThis.fetch;

const entry = readdirSync('dist/assets').find((f) => f.startsWith('index-') && f.endsWith('.js'));
await import('../dist/assets/' + entry);
const settle = (ms) => new Promise((r) => setTimeout(r, ms));
await settle(1800);

const checks = [];
let html = document.getElementById('root').innerHTML;
checks.push(['portal renders the client sign-off queue', html.includes(hookA)]);
checks.push(['account badge shows the signed-in client user', html.includes(CLIENT_EMAIL)]);
checks.push(["the FENCE in the rendered HTML: the neighbor's clip never appears", !html.includes(hookB)]);
checks.push(['no internal machinery leaks into the portal nav', !/Board|Publish/.test(html)]);

// type a note, click approve on OUR card
const cards = [...document.querySelectorAll('section')].filter((s) => s.textContent.includes(hookA));
checks.push(['found our sign-off card', cards.length === 1]);
if (cards.length === 1) {
  const card = cards[0];
  const note = card.querySelector('input[placeholder*="notes"]');
  if (note) {
    const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(note), 'value').set;
    setter.call(note, 'approved from the client portal');
    note.dispatchEvent(new window.Event('input', { bubbles: true }));
    await settle(120);
  }
  const approve = [...card.querySelectorAll('button')].find((b) => b.textContent.trim() === 'approve');
  approve?.click();
  await settle(1200);
  const { rows } = await db.query('SELECT status FROM clips WHERE id = $1', [clipA]);
  checks.push(['UI approve → approved in Postgres', rows[0].status === 'approved']);
  const hist = await api('GET', `/api/review/${clipA}/history`);
  checks.push(['audit row carries the typed note + the CLIENT session identity',
    hist.events[0]?.notes === 'approved from the client portal' && hist.events[0]?.reviewer_email === CLIENT_EMAIL]);
  // the queue empties after the decision (onDone refresh)
  await settle(1600);
  html = document.getElementById('root').innerHTML;
  checks.push(['card left the sign-off queue after the decision', !html.includes(hookA)]);
}

// surface 3: submit a URL through the UI, see it land in the submissions list
history.pushState({}, '', '/portal/upload');
window.dispatchEvent(new PopStateEvent('popstate'));
await settle(900);
const urlInput = document.querySelector('input[placeholder^="https"]');
checks.push(['submit surface renders the link form', !!urlInput]);
if (urlInput) {
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(urlInput), 'value').set;
  setter.call(urlInput, `https://example.com/f5-episode-${stamp}.mp3`);
  urlInput.dispatchEvent(new window.Event('input', { bubbles: true }));
  await settle(120);
  const submitBtn = [...document.querySelectorAll('button')].find((b) => /submit to the studio/.test(b.textContent));
  submitBtn?.click();
  await settle(1400);
  const rec = await db.query('SELECT status FROM recordings WHERE client_id = $1 AND source_url LIKE $2', [cliA, `%f5-episode-${stamp}%`]);
  checks.push(['UI submit → recordings row queued in Postgres', rec.rowCount === 1]);
  html = document.getElementById('root').innerHTML;
  checks.push(['the submission shows up in the pinned own-client list', html.includes(`f5-episode-${stamp}`)]);
}

// surface 4: the report renders (self-generating from B6; empty window is honest)
history.pushState({}, '', '/portal/report');
window.dispatchEvent(new PopStateEvent('popstate'));
await settle(1200);
html = document.getElementById('root').innerHTML;
checks.push(['report renders the client name + totals frame', html.includes(`F5 Portal Co ${stamp}`) && /posts published/i.test(html)]);

// surface 1: deliverables shows the approved clip
history.pushState({}, '', '/portal');
window.dispatchEvent(new PopStateEvent('popstate'));
await settle(1200);
html = document.getElementById('root').innerHTML;
checks.push(['deliverables shows the approved clip (and never the neighbor\'s)', html.includes(hookA) && !html.includes(hookB)]);

await db.end();
let bad = 0;
for (const [name, ok] of checks) { console.log((ok ? 'ok ' : 'FAIL') + ': ' + name); if (!ok) bad++; }
process.exit(bad ? 1 : 0);

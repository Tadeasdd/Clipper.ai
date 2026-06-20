/* F2 regression smoke: boot the BUILT bundle in happy-dom and visit every route.
   Catches runtime module errors (TDZ, missing imports) that a build can't. */
import { GlobalRegistrator } from '@happy-dom/global-registrator';
import { readdirSync } from 'node:fs';

GlobalRegistrator.register({ url: 'http://localhost/' });
// Mirror the BUILT index.html: its <div id="root"> plus the global stylesheet
// <link> Vite injects. The link matters because Vite's dynamic-import preload
// helper skips preloading a CSS dep whose <link> is already in the document
// (the real-browser case); without it here, lazy route chunks (e.g. /ops) would
// try to fetch the stylesheet — which happy-dom disables — and reject. P1's
// vendor split made route chunks reach that global CSS, exposing the gap.
const cssFile = readdirSync('dist/assets').find((f) => f.startsWith('index-') && f.endsWith('.css'));
document.head.innerHTML = cssFile ? `<link rel="stylesheet" href="/assets/${cssFile}">` : '';
document.body.innerHTML = '<div id="root"></div>';
// happy-dom lacks a couple of APIs the app feature-detects; provide inert stubs.
if (!window.IntersectionObserver) {
  window.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };
}

const errors = [];
window.addEventListener('error', (e) => errors.push('window: ' + e.message));
process.on('unhandledRejection', (e) => errors.push('rejection: ' + (e && e.message)));

const entry = readdirSync('dist/assets').find((f) => f.startsWith('index-') && f.endsWith('.js'));
await import('../dist/assets/' + entry);

const settle = (ms) => new Promise((r) => setTimeout(r, ms));
const routes = ['/', '/product', '/pricing', '/docs', '/status', '/privacy', '/terms', '/company', '/studio', '/'];
await settle(600);

for (const path of routes) {
  history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
  await settle(500);
  const len = document.getElementById('root').innerHTML.length;
  const title = document.title;
  console.log(`${path.padEnd(10)} rendered=${len > 500 ? 'YES' : 'NO (' + len + ' chars)'}  title="${title}"`);
  if (len < 500) errors.push(`route ${path} rendered almost nothing (${len} chars)`);
}

if (errors.length) { console.error('\nFAILURES:'); errors.forEach((e) => console.error(' -', e)); process.exit(1); }

/* ── F4/B7: the ops dashboard ────────────────────────────────────────────
   Unauthenticated (and with NO backend — /api/auth/me fails), every /ops
   route must land on the sign-in screen and render it fully; any unhandled
   rejection fails this smoke. Authenticated surfaces are exercised by
   integration:f4 against the live stack. */
history.pushState({}, '', '/ops');
window.dispatchEvent(new PopStateEvent('popstate'));
await settle(700); // lazy OpsApp chunk
let html = document.getElementById('root').innerHTML;
if (!/sign in|create the first ops account/i.test(html)) errors.push('/ops did not render the sign-in screen');
console.log(`/ops (anon)     login=${/sign in|create the first/i.test(html) ? 'YES' : 'NO'}`);

const opsRoutes = ['/ops', '/ops/review', '/ops/clients', '/ops/publish', '/ops/analytics', '/ops/nowhere'];
for (const path of opsRoutes) {
  history.pushState({}, '', '/');
  window.dispatchEvent(new PopStateEvent('popstate'));
  await settle(150);
  history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
  await settle(500);
  const len = document.getElementById('root').innerHTML.length;
  console.log(`${path.padEnd(15)} rendered=${len > 500 ? 'YES' : 'NO (' + len + ' chars)'}`);
  if (len < 500) errors.push(`ops route ${path} rendered almost nothing (${len} chars)`);
}

if (errors.length) { console.error('\nFAILURES:'); errors.forEach((e) => console.error(' -', e)); process.exit(1); }

/* ── F5/B7: the client portal ────────────────────────────────────────────
   Same contract as /ops: unauthenticated with NO backend, every /portal
   route must land on the client sign-in screen and render it fully.
   Authenticated surfaces are exercised by integration:f5. */
history.pushState({}, '', '/portal');
window.dispatchEvent(new PopStateEvent('popstate'));
await settle(700); // lazy PortalApp chunk
html = document.getElementById('root').innerHTML;
if (!/client portal/i.test(html) || !/sign in/i.test(html)) errors.push('/portal did not render the client sign-in screen');
console.log(`/portal (anon)  login=${/client portal/i.test(html) && /sign in/i.test(html) ? 'YES' : 'NO'}`);

const portalRoutes = ['/portal', '/portal/review', '/portal/upload', '/portal/report', '/portal/nowhere'];
for (const path of portalRoutes) {
  history.pushState({}, '', '/');
  window.dispatchEvent(new PopStateEvent('popstate'));
  await settle(150);
  history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
  await settle(500);
  const len = document.getElementById('root').innerHTML.length;
  console.log(`${path.padEnd(15)} rendered=${len > 500 ? 'YES' : 'NO (' + len + ' chars)'}`);
  if (len < 500) errors.push(`portal route ${path} rendered almost nothing (${len} chars)`);
}

if (errors.length) { console.error('\nFAILURES:'); errors.forEach((e) => console.error(' -', e)); process.exit(1); }
console.log('\nAll routes render. Smoke passed.');
process.exit(0);

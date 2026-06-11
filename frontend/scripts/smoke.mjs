/* F2 regression smoke: boot the BUILT bundle in happy-dom and visit every route.
   Catches runtime module errors (TDZ, missing imports) that a build can't. */
import { GlobalRegistrator } from '@happy-dom/global-registrator';
import { readdirSync } from 'node:fs';

GlobalRegistrator.register({ url: 'http://localhost/' });
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
console.log('\nAll routes render. Smoke passed.');
process.exit(0);

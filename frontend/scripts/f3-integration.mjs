/* F3 integration: render the BUILT site in happy-dom, type into the real
   Waitlist form, click submit, and verify the lead lands in the backend DB. */
import { GlobalRegistrator } from '@happy-dom/global-registrator';
import { readdirSync } from 'node:fs';

GlobalRegistrator.register({ url: 'http://localhost/' });
document.body.innerHTML = '<div id="root"></div>';
if (!window.IntersectionObserver) window.IntersectionObserver = class { observe(){} unobserve(){} disconnect(){} };

// Route /api to the live backend (the site posts same-origin; rewrite here).
const realFetch = globalThis.fetch.bind(globalThis);
globalThis.fetch = (input, init) => {
  let url = typeof input === 'string' ? input : input.url;
  if (url.startsWith('/api/')) url = 'http://localhost:8090' + url;
  return realFetch(url, init);
};
window.fetch = globalThis.fetch;

const entry = readdirSync('dist/assets').find((f) => f.startsWith('index-') && f.endsWith('.js'));
await import('../dist/assets/' + entry);
const settle = (ms) => new Promise((r) => setTimeout(r, ms));
await settle(900); // home route + lazy Landing chunk

const email = `form-test+${Date.now()}@clipper.ai`;
const input = document.querySelector('input[type="email"]');
if (!input) { console.error('FAIL: email input not found'); process.exit(1); }

// React controlled input: use the native setter so the synthetic onChange fires.
const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
setter.call(input, email);
input.dispatchEvent(new window.Event('input', { bubbles: true }));
await settle(80);

// The submit button sits right after the input in the form block.
const buttons = [...document.querySelectorAll('button')];
const btn = buttons.find((b) => /request my call/i.test(b.textContent));
if (!btn) { console.error('FAIL: submit button not found near form'); process.exit(1); }
console.log('clicking:', JSON.stringify(btn.textContent.trim().slice(0, 40)));
btn.click();
await settle(900);

const res = await realFetch('http://localhost:8090/api/leads');
const { leads } = await res.json();
const found = leads.find((l) => l.email === email);
if (!found) { console.error('FAIL: lead not found in backend after form submit'); process.exit(1); }
console.log(`lead stored: ${found.id} source=${found.source} meta=${JSON.stringify(found.meta)}`);
console.log('F3 integration passed: form → POST /api/leads → Postgres.');
process.exit(0);

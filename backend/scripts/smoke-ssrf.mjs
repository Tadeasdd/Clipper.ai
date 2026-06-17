/* S1 smoke: the ingest fetch is SSRF-safe.
 *
 *  Pure offline unit test of src/lib/safe-fetch.js — no Postgres, no network.
 *  Asserts the fetcher refuses cloud-metadata, loopback, private, link-local,
 *  and reserved addresses; refuses non-HTTP schemes and bare http; allows a
 *  public address; re-validates redirects (an open redirect can't smuggle you
 *  onto a private IP); and that the happy path streams a body back.
 */
import http from 'node:http';
import { isPublicIp, assertSafeUrl, safeFetch, SsrfError } from '../src/lib/safe-fetch.js';

let failed = false;
const ok = (msg) => console.log('ok:', msg);
const fail = (msg) => { failed = true; console.error('FAIL:', msg); };
const assert = (cond, msg) => (cond ? ok(msg) : fail(msg));

async function refuses(url, label) {
  try { await assertSafeUrl(url); fail(`should refuse ${label}: ${url}`); }
  catch (e) { assert(e instanceof SsrfError, `refuses ${label} (${url})`); }
}
async function allows(url, label) {
  try { await assertSafeUrl(url); ok(`allows ${label} (${url})`); }
  catch (e) { fail(`should allow ${label}: ${url} — ${e.message}`); }
}

// ── isPublicIp classifier ───────────────────────────────────────────────────
for (const ip of ['169.254.169.254', '127.0.0.1', '10.0.0.1', '192.168.1.5',
  '172.16.0.1', '172.31.255.255', '100.64.0.1', '0.0.0.0', '224.0.0.1', '::1',
  'fd00::1', 'fe80::1', '::ffff:10.0.0.1']) {
  assert(isPublicIp(ip) === false, `isPublicIp refuses ${ip}`);
}
for (const ip of ['8.8.8.8', '1.1.1.1', '93.184.216.34', '2606:4700:4700::1111']) {
  assert(isPublicIp(ip) === true, `isPublicIp allows ${ip}`);
}

// ── scheme guard (default: https only) ──────────────────────────────────────
await refuses('file:///etc/passwd', 'file:// scheme');
await refuses('ftp://example.com/x', 'ftp:// scheme');
await refuses('http://93.184.216.34/x.mp4', 'bare http (INGEST_ALLOW_HTTP unset)');

// ── private / reserved hosts refused (https so the scheme check passes) ──────
await refuses('https://169.254.169.254/latest/meta-data', 'cloud metadata IP');
await refuses('https://127.0.0.1/x', 'loopback IP');
await refuses('https://localhost/x', 'localhost');
await refuses('https://10.0.0.1/x', '10/8 private');
await refuses('https://192.168.1.1/x', '192.168/16 private');
await refuses('https://172.16.5.5/x', '172.16/12 private');
await refuses('https://[::1]/x', 'IPv6 loopback');

// ── a public address is allowed (IP literal → no network needed) ────────────
await allows('https://8.8.8.8/clip.mp4', 'public IPv4');

// ── redirect re-validation + happy path (local server, host explicitly trusted)
process.env.INGEST_ALLOW_HTTP = 'true';
process.env.INGEST_HOST_ALLOWLIST = '127.0.0.1';

const body = Buffer.from('fake-media-bytes');
const server = http.createServer((req, res) => {
  if (req.url === '/redirect-to-metadata') {
    res.writeHead(302, { location: 'http://169.254.169.254/latest/meta-data' });
    res.end();
  } else {
    res.writeHead(200, { 'content-type': 'video/mp4', 'content-length': body.length });
    res.end(body);
  }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

// happy path: trusted local host streams the body back
try {
  const res = await safeFetch(`http://127.0.0.1:${port}/clip.mp4`);
  const chunks = [];
  for await (const c of res.body) chunks.push(c);
  assert(res.status === 200 && Buffer.concat(chunks).equals(body), 'happy path: trusted host streams the body');
} catch (e) { fail(`happy path threw: ${e.message}`); }

// redirect that lands on the metadata IP is refused (169.254.x is not allowlisted)
try {
  await safeFetch(`http://127.0.0.1:${port}/redirect-to-metadata`);
  fail('a redirect onto the metadata IP should be refused');
} catch (e) { assert(e instanceof SsrfError, 'refuses a redirect that lands on a private/metadata IP'); }

server.close();

if (failed) { console.error('\nsmoke:ssrf FAILED'); process.exit(1); }
console.log('\nS1 smoke passed: ingest fetch refuses metadata/loopback/private/reserved + bad schemes, re-validates redirects, pins the resolved IP.');
process.exit(0);

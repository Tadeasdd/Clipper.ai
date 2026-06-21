/* M7 prod-config smoke: boot the API under NODE_ENV=production and assert the
   hardening — secrets fail-fast, CORS lock, security headers, rate limiting.
   Self-contained (spawns its own servers); needs Postgres only for the valid
   boot. Offline CI runs the rest of the suite in dev, untouched by this. */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { redact } from '../src/lib/log.js';

const dir = path.dirname(fileURLToPath(import.meta.url));
const SERVER = path.join(dir, '..', 'src', 'server.js');
const DB = process.env.DATABASE_URL || 'postgres://clipper:clipper@localhost:5432/clipper';
const STRONG_KEY = 'a-strong-prod-secret-value';
const assert = (cond, msg) => { if (!cond) { console.error('FAIL:', msg); process.exit(1); } console.log('ok:', msg); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Boot once and resolve how it exited (for the fail-fast cases).
function bootExit(env) {
  return new Promise((resolve) => {
    const p = spawn('node', [SERVER], { env: { ...process.env, ...env }, stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    p.stderr.on('data', (d) => { err += d; });
    p.on('close', (code) => resolve({ code, err }));
    setTimeout(() => p.kill('SIGKILL'), 5000); // safety net if it ever listens
  });
}

// ── 1. production boot must FAIL FAST on insecure secrets ────────────────────
const STRONG_CONTENT_KEY = 'a-strong-prod-content-value';
let res = await bootExit({ NODE_ENV: 'production', DATABASE_URL: DB, PUBLISH_TOKEN_KEY: '', CONTENT_ENCRYPTION_KEY: STRONG_CONTENT_KEY, PORT: '8096', WORKERS_ENABLED: 'false' });
assert(res.code !== 0 && /PUBLISH_TOKEN_KEY/.test(res.err),
  `boot fails fast in production without PUBLISH_TOKEN_KEY (exit ${res.code})`);
// C3: the content-at-rest key is now equally load-bearing in production.
res = await bootExit({ NODE_ENV: 'production', DATABASE_URL: DB, PUBLISH_TOKEN_KEY: STRONG_KEY, CONTENT_ENCRYPTION_KEY: '', PORT: '8096', WORKERS_ENABLED: 'false' });
assert(res.code !== 0 && /CONTENT_ENCRYPTION_KEY/.test(res.err),
  `boot fails fast in production without CONTENT_ENCRYPTION_KEY (exit ${res.code})`);
res = await bootExit({ NODE_ENV: 'production', DATABASE_URL: '', PUBLISH_TOKEN_KEY: STRONG_KEY, CONTENT_ENCRYPTION_KEY: STRONG_CONTENT_KEY, PORT: '8096', WORKERS_ENABLED: 'false' });
assert(res.code !== 0 && /DATABASE_URL/.test(res.err),
  `boot fails fast in production without DATABASE_URL (exit ${res.code})`);

// ── 2. a strict-but-valid prod server: CORS lock, headers, rate limit ───────
const PORT = 8097, BASE = `http://localhost:${PORT}`;
const srv = spawn('node', [SERVER], {
  env: {
    ...process.env, NODE_ENV: 'production', DATABASE_URL: DB, PUBLISH_TOKEN_KEY: STRONG_KEY,
    CONTENT_ENCRYPTION_KEY: STRONG_CONTENT_KEY,
    CORS_ORIGINS: 'https://app.clipper.ai', PORT: String(PORT), WORKERS_ENABLED: 'false',
    STORAGE_DIR: process.env.STORAGE_DIR || '/tmp/clipper-prod-store', RATELIMIT_LEADS_PER_MIN: '3',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
// S6: capture the server's structured logs (stdout = info/audit, stderr = errors)
// so we can assert the correlation id is logged and secrets are redacted.
let srvLog = '';
srv.stdout.on('data', (d) => { srvLog += d; });
srv.stderr.on('data', (d) => { srvLog += d; });
try {
  for (let i = 0; i < 40; i++) {
    if (await fetch(`${BASE}/api/health`).then((r) => r.ok).catch(() => false)) break;
    await sleep(250);
  }
  assert(await fetch(`${BASE}/api/health`).then((r) => r.ok).catch(() => false), 'strict prod server booted with valid secrets');

  // CORS: the configured origin is echoed, an unlisted one is not.
  const allowed = await fetch(`${BASE}/api/health`, { headers: { origin: 'https://app.clipper.ai' } });
  assert(allowed.headers.get('access-control-allow-origin') === 'https://app.clipper.ai',
    'CORS allows the configured origin');
  // S5: with cookie auth, the allowed origin must also be told credentials are OK.
  assert(allowed.headers.get('access-control-allow-credentials') === 'true',
    'CORS allows credentials for the configured origin (cookie sessions)');
  const denied = await fetch(`${BASE}/api/health`, { headers: { origin: 'https://evil.example.com' } });
  assert(!denied.headers.get('access-control-allow-origin'),
    'CORS rejects an unlisted origin (no Access-Control-Allow-Origin header)');

  // Security headers (helmet-equivalent) are present; X-Powered-By is gone.
  assert(allowed.headers.get('x-content-type-options') === 'nosniff'
    && allowed.headers.get('x-frame-options') === 'DENY'
    && !allowed.headers.get('x-powered-by'),
    'security headers present (nosniff, frame DENY, no X-Powered-By)');
  // S5: HSTS is sent in production.
  assert(/max-age=\d+/.test(allowed.headers.get('strict-transport-security') || ''),
    'HSTS (Strict-Transport-Security) present in production');

  // The public lead door rate-limits a flood (limit set to 3/min for this run).
  let got429 = false;
  for (let i = 0; i < 6; i++) {
    const r = await fetch(`${BASE}/api/leads`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: `prod${i}@clipper.ai`, source: 'waitlist' }),
    });
    if (r.status === 429) got429 = true;
  }
  assert(got429, 'the public lead door rate-limits a flood (429 past the per-IP limit)');

  // ── S6: a forced error returns a generic body + a correlation id; the full
  //    detail lives only in the server log, tied to that id. ──────────────────
  const broke = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: '{ not valid json',
  });
  const brokeBody = await broke.json().catch(() => ({}));
  assert(broke.status === 500 && brokeBody.error === 'internal error' && !brokeBody.stack && brokeBody.requestId,
    `a forced error returns a generic body + correlation id (requestId=${brokeBody.requestId})`);
  await sleep(200); // let the log line flush
  assert(srvLog.includes(brokeBody.requestId),
    'the server log carries the error under the same correlation id (detail stays server-side)');

  // ── S6: the security audit trail records a failed login, and the password
  //    never reaches the log. ───────────────────────────────────────────────
  const PW = 'UNIQUE-secret-pw-zzz9';
  await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'ghost@nowhere.example', password: PW }),
  });
  await sleep(200);
  assert(/"msg":"security"/.test(srvLog) && /auth\.login\.fail/.test(srvLog),
    'security audit trail logs the failed login');
  assert(!srvLog.includes(PW), 'the submitted password never reaches the log (redaction holds)');

  // ── S6: the redactor masks secret-looking fields and Bearer tokens. ─────────
  const red = redact({ password: 'p', token: 't', authorization: 'Bearer abc.def', cookie: 'c', email: 'ok@x.ai' });
  assert(red.password === '[redacted]' && red.token === '[redacted]' && red.authorization === '[redacted]'
    && red.cookie === '[redacted]' && red.email === 'ok@x.ai',
    'redact() masks secret-looking keys but keeps benign fields');
} finally {
  srv.kill('SIGKILL');
}

console.log('\nM7/S5/S6 prod-config smoke passed: secrets fail-fast, CORS+credentials locked, headers+HSTS set, '
  + 'public door rate-limited, errors carry a correlation id, security audit trail records events, secrets redacted.');
process.exit(0);

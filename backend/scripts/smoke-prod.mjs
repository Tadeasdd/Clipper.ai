/* M7 prod-config smoke: boot the API under NODE_ENV=production and assert the
   hardening — secrets fail-fast, CORS lock, security headers, rate limiting.
   Self-contained (spawns its own servers); needs Postgres only for the valid
   boot. Offline CI runs the rest of the suite in dev, untouched by this. */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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
let res = await bootExit({ NODE_ENV: 'production', DATABASE_URL: DB, PUBLISH_TOKEN_KEY: '', PORT: '8096', WORKERS_ENABLED: 'false' });
assert(res.code !== 0 && /PUBLISH_TOKEN_KEY/.test(res.err),
  `boot fails fast in production without PUBLISH_TOKEN_KEY (exit ${res.code})`);
res = await bootExit({ NODE_ENV: 'production', DATABASE_URL: '', PUBLISH_TOKEN_KEY: STRONG_KEY, PORT: '8096', WORKERS_ENABLED: 'false' });
assert(res.code !== 0 && /DATABASE_URL/.test(res.err),
  `boot fails fast in production without DATABASE_URL (exit ${res.code})`);

// ── 2. a strict-but-valid prod server: CORS lock, headers, rate limit ───────
const PORT = 8097, BASE = `http://localhost:${PORT}`;
const srv = spawn('node', [SERVER], {
  env: {
    ...process.env, NODE_ENV: 'production', DATABASE_URL: DB, PUBLISH_TOKEN_KEY: STRONG_KEY,
    CORS_ORIGINS: 'https://app.clipper.ai', PORT: String(PORT), WORKERS_ENABLED: 'false',
    STORAGE_DIR: process.env.STORAGE_DIR || '/tmp/clipper-prod-store', RATELIMIT_LEADS_PER_MIN: '3',
  },
  stdio: ['ignore', 'ignore', 'inherit'],
});
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
  const denied = await fetch(`${BASE}/api/health`, { headers: { origin: 'https://evil.example.com' } });
  assert(!denied.headers.get('access-control-allow-origin'),
    'CORS rejects an unlisted origin (no Access-Control-Allow-Origin header)');

  // Security headers (helmet-equivalent) are present; X-Powered-By is gone.
  assert(allowed.headers.get('x-content-type-options') === 'nosniff'
    && allowed.headers.get('x-frame-options') === 'DENY'
    && !allowed.headers.get('x-powered-by'),
    'security headers present (nosniff, frame DENY, no X-Powered-By)');

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
} finally {
  srv.kill('SIGKILL');
}

console.log('\nM7 prod-config smoke passed: secrets fail-fast, CORS locked, headers set, public door rate-limited.');
process.exit(0);

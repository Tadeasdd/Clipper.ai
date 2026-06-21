/* P5 — k6 load test for the hot read paths. Drives the public health probe plus
 * the authenticated ops analytics/board reads (the queries P5 indexed) at a target
 * concurrency, and asserts p95 latency + error-rate thresholds. The thresholds ARE
 * the documented SLO for these reads; a regression (lost index, pool starvation)
 * fails the run.
 *
 * Offline: talks only to a locally-booted backend + Postgres, no external keys.
 * Run:   k6 run loadtest/read-paths.js
 * Tune:  BASE_URL, VUS, DURATION, P95_MS env vars (see README.md).
 */
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE = __ENV.BASE_URL || 'http://localhost:8080';
const VUS = Number(__ENV.VUS || 20);
const DURATION = __ENV.DURATION || '20s';
const P95_MS = Number(__ENV.P95_MS || 300);

export const options = {
  scenarios: { reads: { executor: 'constant-vus', vus: VUS, duration: DURATION } },
  thresholds: {
    http_req_failed: ['rate<0.01'],          // < 1% errors
    http_req_duration: [`p(95)<${P95_MS}`],  // p95 under the target (default 300ms)
  },
};

const JSON_HEADERS = { 'content-type': 'application/json', 'x-requested-with': 'clipper' };

// The fixed smoke ops account, bootstrapped once (201) then logged in (idempotent).
export function setup() {
  const creds = JSON.stringify({ email: 'ops@smoke.clipper.ai', password: 'smoke-ops-password' });
  http.post(`${BASE}/api/auth/bootstrap`, creds, { headers: JSON_HEADERS }); // 201 once, 409 after
  const res = http.post(`${BASE}/api/auth/login`, creds, { headers: JSON_HEADERS });
  const token = res.json('token');
  if (!token) throw new Error(`ops login failed for load test (status ${res.status})`);
  return { token };
}

// Public probe + the authenticated read endpoints backed by the audited indexes.
const PUBLIC = ['/api/health'];
const AUTHED = ['/api/clients', '/api/analytics/cost', '/api/analytics/margin'];

export default function (data) {
  const authHeaders = { 'x-requested-with': 'clipper', authorization: `Bearer ${data.token}` };
  for (const path of PUBLIC) {
    const res = http.get(`${BASE}${path}`, { headers: { 'x-requested-with': 'clipper' } });
    check(res, { [`GET ${path} → 200`]: (r) => r.status === 200 });
  }
  for (const path of AUTHED) {
    const res = http.get(`${BASE}${path}`, { headers: authHeaders });
    check(res, { [`GET ${path} → 200`]: (r) => r.status === 200 });
  }
  sleep(0.1);
}

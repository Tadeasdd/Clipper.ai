/** D3 contract — the live API honours its documented response shapes.
 *
 *  Runs against a booted server (BASE), exactly like the smokes. The point is
 *  not coverage but a tripwire: if a route drops, renames, or retypes a field
 *  the dashboards/portal depend on, this gate fails before the change ships.
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { opsSession } from '../../scripts/lib-smoke-auth.mjs';
import { CONTRACTS, shapeErrors } from './contract-schema.mjs';

const BASE = process.env.BASE || 'http://localhost:8080';
let OPS;

before(async () => {
  OPS = await opsSession(BASE); // B7: bootstrap/login the founding ops account
});

async function call(method, path, body, raw) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'content-type': raw ? 'application/octet-stream' : 'application/json',
      authorization: `Bearer ${OPS}`,
    },
    body: raw ? body : body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

function conforms(data, schema, label) {
  const errs = shapeErrors(data, schema);
  assert.equal(errs.length, 0, `${label} contract violated: ${errs.join('; ')}`);
}

test('GET /api/health → 200 { ok, service, db }', async () => {
  const r = await call('GET', '/api/health');
  assert.equal(r.status, 200);
  conforms(r.data, CONTRACTS.health, 'health');
  assert.equal(r.data.db, 'up');
});

test('POST /api/clients → 201 client; missing name → 400 error', async () => {
  const r = await call('POST', '/api/clients', {
    name: 'Contract Co',
    plan: 'growth',
    cadence: 'weekly',
  });
  assert.equal(r.status, 201);
  conforms(r.data, CONTRACTS.client, 'client');

  const bad = await call('POST', '/api/clients', {});
  assert.equal(bad.status, 400);
  conforms(bad.data, CONTRACTS.error, 'client-error');
});

test('POST /api/leads → 201 lead; resubmit dedupes → 200; bad email → 400', async () => {
  const email = `contract+${Date.now()}@clipper.ai`;
  const r = await call('POST', '/api/leads', { email, source: 'waitlist' });
  assert.equal(r.status, 201);
  conforms(r.data, CONTRACTS.lead, 'lead');
  assert.equal(r.data.duplicate, false);

  const dup = await call('POST', '/api/leads', { email, source: 'waitlist' });
  assert.equal(dup.status, 200);
  conforms(dup.data, CONTRACTS.lead, 'lead-dup');
  assert.equal(dup.data.duplicate, true);
  assert.equal(dup.data.position, r.data.position);

  const bad = await call('POST', '/api/leads', { email: 'not-an-email' });
  assert.equal(bad.status, 400);
  conforms(bad.data, CONTRACTS.error, 'lead-error');
});

test('GET /api/leads/stats → 200 { total, today }', async () => {
  const r = await call('GET', '/api/leads/stats');
  assert.equal(r.status, 200);
  conforms(r.data, CONTRACTS.leadStats, 'leadStats');
});

test('POST /api/intake URL → 201 queued (no upload target)', async () => {
  const cli = (
    await call('POST', '/api/clients', { name: 'Intake Co', plan: 'growth', cadence: 'weekly' })
  ).data.id;
  const r = await call('POST', '/api/intake', {
    clientId: cli,
    sourceUrl: 'https://example.com/ep1.mp3',
    kind: 'podcast',
  });
  assert.equal(r.status, 201);
  conforms(r.data, CONTRACTS.recording, 'recording');
  assert.equal(r.data.status, 'queued');
  assert.ok(!r.data.upload, 'a URL intake should not return an upload target');
});

test('POST /api/intake file → 201 awaiting_upload with a typed upload target', async () => {
  const cli = (
    await call('POST', '/api/clients', { name: 'Upload Co', plan: 'growth', cadence: 'weekly' })
  ).data.id;
  const r = await call('POST', '/api/intake', {
    clientId: cli,
    filename: 'episode 42.mp4',
    kind: 'podcast',
  });
  assert.equal(r.status, 201);
  conforms(r.data, CONTRACTS.recording, 'recording');
  assert.equal(r.data.status, 'awaiting_upload');
  conforms(r.data.upload, CONTRACTS.uploadTarget, 'uploadTarget');
});

test('POST /api/intake unknown client → 404 error', async () => {
  const r = await call('POST', '/api/intake', {
    clientId: 'cli_nope',
    sourceUrl: 'https://x.com/a.mp3',
  });
  assert.equal(r.status, 404);
  conforms(r.data, CONTRACTS.error, 'intake-error');
});

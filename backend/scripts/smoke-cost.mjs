/* E1 smoke: per-job cost ledger.
 *
 *  Runs a recording through the real pipeline on the suite server, then asserts
 *  GET /api/analytics/cost/:rec shows an ITEMIZED cost across stages (ingest /
 *  transcribe / analyze / generate), a positive SUMMED total (real render CPU +
 *  storage), honest $0 on the unused external APIs (builtin ASR/LLM), and that
 *  the recording's cost ROLLS UP to the client. Needs the suite API + ffmpeg.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const BASE = process.env.BASE || 'http://localhost:8080';
const assert = (cond, msg) => { if (!cond) { console.error('FAIL:', msg); process.exit(1); } console.log('ok:', msg); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const { opsSession } = await import('./lib-smoke-auth.mjs');
const OPS = await opsSession(BASE);
const j = async (m, p, body) => {
  const res = await fetch(BASE + p, { method: m, headers: { 'content-type': 'application/json', authorization: `Bearer ${OPS}` }, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, data: await res.json().catch(() => ({})) };
};

const tmp = mkdtempSync(path.join(tmpdir(), 'clipper-cost-'));
const fixture = path.join(tmp, 'a.mp4');
// unique audio per run so transcribe/analyze always compute (no Q4 cache hit) and
// record their cost, regardless of what a persistent DB already cached.
const seed = Date.now() % 100000;
execFileSync('ffmpeg', ['-hide_banner', '-y', '-f', 'lavfi', '-i', `anoisesrc=color=pink:duration=20:amplitude=0.5:seed=${seed}`, '-c:a', 'aac', '-b:a', '96k', fixture], { stdio: 'pipe' });

const cli = (await j('POST', '/api/clients', { name: `E1 Cost Co ${Date.now()}` })).data.id;
const r = await j('POST', '/api/intake', { clientId: cli, filename: 'cost.mp4', kind: 'podcast' });
const rec = r.data.recordingId;
const put = await fetch(BASE + r.data.upload.uploadUrl, { method: 'PUT', headers: { 'content-type': 'video/mp4', authorization: `Bearer ${OPS}` }, body: readFileSync(fixture) });
assert(put.status === 200, 'fixture uploaded + queued');

let detail, deadline = Date.now() + 60_000;
for (;;) {
  await sleep(1500);
  detail = (await j('GET', `/api/jobs/${rec}`)).data;
  if (detail.status === 'ready' || detail.status === 'failed') break;
  if (Date.now() > deadline) { console.error('FAIL: pipeline never finished'); process.exit(1); }
}
assert(detail.status === 'ready', 'recording processed end-to-end');

// ── itemized cost across stages ──────────────────────────────────────────────
const cost = (await j('GET', `/api/analytics/cost/${rec}`)).data;
const item = (stage, resource) => cost.items.find((i) => i.stage === stage && i.resource === resource);
assert(item('ingest', 'storage_bytes') && item('transcribe', 'asr_seconds') && item('analyze', 'llm_tokens_in') && item('generate', 'cpu_ms') && item('generate', 'storage_bytes'),
  'cost is itemized across ingest / transcribe / analyze / generate');
assert(cost.totalUsd > 0, `the itemized cost sums to a positive total (render CPU + storage): $${cost.totalUsd}`);
assert(item('generate', 'cpu_ms').quantity > 0, 'render CPU time is recorded');
assert(item('ingest', 'storage_bytes').quantity > 0, 'source storage bytes are recorded');

// ── honest $0 on the unused external APIs (builtin defaults) ─────────────────
assert(item('transcribe', 'asr_seconds').quantity === 0, 'builtin ASR is honestly $0 — no provider ran');
assert(item('analyze', 'llm_tokens_in').quantity === 0 && item('analyze', 'llm_tokens_out').quantity === 0, 'builtin LLM is honestly 0 tokens');

// ── rolls up to the client ───────────────────────────────────────────────────
const rollup = (await j('GET', '/api/analytics/cost')).data;
const client = rollup.clients.find((c) => c.clientId === cli);
assert(client && client.totalUsd >= cost.totalUsd, 'the recording cost rolls up to the client');

console.log(`\nE1 smoke passed: a processed recording carries an itemized, summed cost ($${cost.totalUsd}) — honest $0 on unused APIs — and rolls up to the client.`);
process.exit(0);

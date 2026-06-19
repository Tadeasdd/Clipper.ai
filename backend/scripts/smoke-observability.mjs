/* R1 smoke: traces + Prometheus metrics + dashboard wiring.
 *
 *  Runs a recording through the REAL pipeline on the suite server, then asserts:
 *    - a single trace spans the whole lifecycle (ingest → … → generate);
 *    - GET /metrics exposes queue depth + stage-latency quantiles + job counters
 *      in valid Prometheus text;
 *    - the shipped Grafana dashboard references metric families /metrics emits.
 *  Needs the suite API (workers) + ffmpeg; no external keys.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = process.env.BASE || 'http://localhost:8080';
const assert = (cond, msg) => { if (!cond) { console.error('FAIL:', msg); process.exit(1); } console.log('ok:', msg); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const dir = path.dirname(fileURLToPath(import.meta.url));

const { opsSession } = await import('./lib-smoke-auth.mjs');
const OPS = await opsSession(BASE);
const j = async (m, p, body, raw) => {
  const res = await fetch(BASE + p, {
    method: m,
    headers: { ...(raw ? { 'content-type': 'application/octet-stream' } : { 'content-type': 'application/json' }), authorization: `Bearer ${OPS}` },
    body: raw ? body : body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json().catch(() => ({})) };
};

// ── run a small recording through the real pipeline ──────────────────────────
const tmp = mkdtempSync(path.join(tmpdir(), 'clipper-obs-'));
const fixture = path.join(tmp, 'a.mp4');
execFileSync('ffmpeg', ['-hide_banner', '-y', '-f', 'lavfi',
  '-i', 'anoisesrc=color=pink:duration=20:amplitude=0.5:seed=9', '-c:a', 'aac', '-b:a', '96k', fixture], { stdio: 'pipe' });

const cli = (await j('POST', '/api/clients', { name: `R1 Obs Co ${Date.now()}` })).data.id;
let r = await j('POST', '/api/intake', { clientId: cli, filename: 'obs.mp4', kind: 'podcast' });
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

// ── 1. a trace spans the full recording lifecycle ────────────────────────────
const trace = (await j('GET', `/api/analytics/trace/${rec}`)).data;
const names = (trace.spans || []).map((s) => s.name);
const oneTrace = new Set((trace.spans || []).map((s) => s.traceId)).size === 1;
assert(trace.recordingId === rec && oneTrace, 'all spans share one trace id (the recording lifecycle)');
for (const stage of ['ingest', 'transcribe', 'analyze', 'score', 'generate']) {
  assert(names.includes(`pipeline.${stage}`), `the trace has a span for pipeline.${stage}`);
}
assert((await j('GET', '/api/analytics/traces')).data.traces.some((t) => t.recordingId === rec), 'the trace appears in the recent-traces list');

// ── 2. /metrics exposes the queue + latency series in Prometheus format ──────
const metrics = await (await fetch(`${BASE}/metrics`)).text();
assert(/# TYPE clipper_queue_depth gauge/.test(metrics), '/metrics declares the queue-depth gauge');
assert(/clipper_queue_depth\{[^}]*queue="pipeline"[^}]*\} \d+/.test(metrics), '/metrics exposes per-stage pipeline queue depth');
assert(/clipper_stage_duration_seconds\{[^}]*quantile="0.95"[^}]*\}/.test(metrics), '/metrics exposes stage latency quantiles (p95)');
assert(/clipper_jobs_total\{[^}]*stage="generate"[^}]*status="done"[^}]*\} \d+/.test(metrics), '/metrics counts completed jobs');
assert(/clipper_http_requests_total\{/.test(metrics), '/metrics counts HTTP requests');

// ── 3. the shipped dashboard references metrics /metrics actually emits ──────
const dash = JSON.parse(readFileSync(path.join(dir, '..', 'ops', 'dashboards', 'clipper-observability.json'), 'utf8'));
const exprs = dash.panels.flatMap((p) => p.targets.map((t) => t.expr)).join(' ');
const refs = [...new Set(exprs.match(/clipper_[a-z_]+/g) || [])];
assert(refs.length >= 5, `the dashboard references the metric families (${refs.length})`);
for (const core of ['clipper_queue_depth', 'clipper_stage_duration_seconds', 'clipper_jobs_total']) {
  assert(refs.includes(core) && metrics.includes(core), `dashboard panel for ${core} maps to a live metric`);
}

console.log('\nR1 smoke passed: the recording lifecycle is one trace, /metrics serves queue+latency+counters, and the dashboard maps to live metrics.');
process.exit(0);

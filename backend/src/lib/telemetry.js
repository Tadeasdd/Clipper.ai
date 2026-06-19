/** R1 — observability: traces + metrics, dependency-free.
 *
 *  The queue + pipeline are well-built but were blind in production. This adds
 *  the two standard wire formats without an SDK (in the spirit of the rest of
 *  the hardening here — helmet-equivalent headers, the Sentry-over-fetch hook):
 *
 *   · Traces — one trace per recording (traceId derived from the recording id),
 *     a span per pipeline/publish stage, correlated across workers so a single
 *     trace shows the whole lifecycle. Kept in a bounded in-memory ring and
 *     queryable; exported to any OTel collector via OTLP/HTTP when
 *     OTEL_EXPORTER_OTLP_ENDPOINT is set (dry-run/off by default).
 *   · Metrics — counters (jobs, retries, errors), a summary with p50/p95/p99
 *     stage latency, and a scrape-time queue-depth gauge, rendered in the
 *     Prometheus text exposition format at GET /metrics.
 */
import { createHash, randomBytes } from 'node:crypto';

// ── traces ───────────────────────────────────────────────────────────────────
const MAX_TRACES = Number(process.env.TELEMETRY_MAX_TRACES || 200);
const traces = new Map(); // traceId → { traceId, recordingId, spans:[], startMs, endMs }

export const traceIdFor = (recordingId) => createHash('sha256').update(`trace:${recordingId}`).digest('hex').slice(0, 32);

function recordSpan(span) {
  let t = traces.get(span.traceId);
  if (!t) {
    if (traces.size >= MAX_TRACES) traces.delete(traces.keys().next().value); // evict oldest
    t = { traceId: span.traceId, recordingId: span.recordingId, spans: [], startMs: span.startMs, endMs: span.startMs + span.durationMs };
    traces.set(span.traceId, t);
  }
  t.spans.push(span);
  t.endMs = Math.max(t.endMs, span.startMs + span.durationMs);
  exportSpan(span); // best-effort OTLP, off unless configured
}

/** Time `fn` as a span on the recording's trace. Records on success AND failure
 *  (status set accordingly), then re-throws so the caller's error path is
 *  unchanged. */
export async function withSpan({ traceId, name, recordingId, attrs = {} }, fn) {
  const startMs = Date.now();
  const span = { traceId, spanId: randomBytes(8).toString('hex'), name, recordingId, startMs, durationMs: 0, status: 'ok', attrs };
  try {
    return await fn();
  } catch (e) {
    span.status = 'error';
    span.attrs = { ...span.attrs, error: String(e.message || e).slice(0, 200) };
    throw e;
  } finally {
    span.durationMs = Date.now() - startMs;
    recordSpan(span);
  }
}

export const traceFor = (recordingId) => traces.get(traceIdFor(recordingId)) || null;
export function recentTraces(limit = 50) {
  return [...traces.values()]
    .sort((a, b) => b.endMs - a.endMs).slice(0, limit)
    .map((t) => ({ traceId: t.traceId, recordingId: t.recordingId, spans: t.spans.length,
      durationMs: t.endMs - t.startMs, stages: t.spans.map((s) => `${s.name}:${s.status}`) }));
}

async function exportSpan(span) {
  const url = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  if (!url) return; // dry run — kept in memory only
  try {
    await fetch(`${url.replace(/\/$/, '')}/v1/traces`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ resourceSpans: [{ resource: { attributes: [{ key: 'service.name', value: { stringValue: 'clipper-ops' } }] },
        scopeSpans: [{ spans: [{ traceId: span.traceId, spanId: span.spanId, name: span.name,
          startTimeUnixNano: `${span.startMs}000000`, endTimeUnixNano: `${span.startMs + span.durationMs}000000`,
          status: { code: span.status === 'error' ? 2 : 1 } }] }] }] }),
    });
  } catch { /* observability must never take the request down */ }
}

// ── metrics ──────────────────────────────────────────────────────────────────
const SUMMARY_WINDOW = Number(process.env.TELEMETRY_SUMMARY_WINDOW || 500);
const counters = new Map();      // series → number
const summaries = new Map();     // series → number[] (rolling)
const gauges = [];               // { name, help, fn: async () => [{ labels, value }] }
const META = {};                 // name → { type, help }

const labelStr = (labels) => Object.entries(labels).sort().map(([k, v]) => `${k}="${String(v).replace(/"/g, '')}"`).join(',');
const series = (name, labels) => `${name}{${labelStr(labels)}}`;

export function counter(name, help) { META[name] = { type: 'counter', help }; return { inc: (labels = {}, by = 1) => { const k = series(name, labels); counters.set(k, (counters.get(k) || 0) + by); } }; }
export function summary(name, help) { META[name] = { type: 'summary', help }; return { observe: (labels = {}, v) => { const k = series(name, labels); const arr = summaries.get(k) || []; arr.push(v); if (arr.length > SUMMARY_WINDOW) arr.shift(); summaries.set(k, arr); } }; }
export function registerGauge(name, help, fn) { META[name] = { type: 'gauge', help }; gauges.push({ name, fn }); }

const quantile = (sorted, p) => { if (!sorted.length) return 0; const i = Math.min(sorted.length - 1, Math.floor(p * sorted.length)); return sorted[i]; };

/** Render the Prometheus text exposition for everything registered. Async
 *  because gauges (queue depth) are read live from the DB at scrape time. */
export async function renderProm() {
  const lines = [];
  const emitted = new Set();
  const head = (name) => { if (!emitted.has(name)) { emitted.add(name); const m = META[name]; if (m?.help) lines.push(`# HELP ${name} ${m.help}`); if (m?.type) lines.push(`# TYPE ${name} ${m.type}`); } };

  for (const [k, v] of counters) { head(k.split('{')[0]); lines.push(`${k} ${v}`); }

  for (const [k, arr] of summaries) {
    const name = k.split('{')[0]; head(name);
    const inner = k.slice(name.length + 1, -1); // label body
    const sorted = [...arr].sort((a, b) => a - b);
    for (const p of [0.5, 0.95, 0.99]) lines.push(`${name}{${inner ? inner + ',' : ''}quantile="${p}"} ${quantile(sorted, p)}`);
    lines.push(`${name}_sum{${inner}} ${arr.reduce((a, b) => a + b, 0)}`);
    lines.push(`${name}_count{${inner}} ${arr.length}`);
  }

  for (const g of gauges) {
    head(g.name);
    try { for (const { labels, value } of await g.fn()) lines.push(`${series(g.name, labels)} ${value}`); }
    catch { /* a gauge query hiccup must not break the scrape */ }
  }
  return lines.join('\n') + '\n';
}

// ── the registered instruments ───────────────────────────────────────────────
const jobs = counter('clipper_jobs_total', 'pipeline/publish jobs by queue, stage and outcome');
const retries = counter('clipper_job_retries_total', 'job attempts beyond the first, by queue and stage');
const errors = counter('clipper_errors_total', 'stage failures, by queue and stage');
const duration = summary('clipper_stage_duration_seconds', 'stage execution time in seconds, by queue and stage');
const httpReqs = counter('clipper_http_requests_total', 'HTTP requests by method, route and status class');
const httpDur = summary('clipper_http_request_duration_seconds', 'HTTP request time in seconds');

/** Wrap one queue stage: a span on the recording's trace + jobs/retries/errors
 *  counters + the latency summary. Re-throws so the queue's retry logic is
 *  untouched. */
export async function instrumentStage({ queue, stage, recordingId, attempt = 1 }, fn) {
  if (attempt > 1) retries.inc({ queue, stage });
  const startMs = Date.now();
  try {
    const out = await withSpan({ traceId: traceIdFor(recordingId), name: `${queue}.${stage}`, recordingId, attrs: { stage, attempt } }, fn);
    jobs.inc({ queue, stage, status: 'done' });
    return out;
  } catch (e) {
    jobs.inc({ queue, stage, status: 'failed' });
    errors.inc({ queue, stage });
    throw e;
  } finally {
    duration.observe({ queue, stage }, (Date.now() - startMs) / 1000);
  }
}

/** Express middleware: count + time every HTTP request (route metrics). */
export function httpMetrics() {
  return (req, res, next) => {
    const startMs = Date.now();
    res.on('finish', () => {
      const route = req.route?.path ? req.baseUrl + req.route.path : req.path.replace(/\/[0-9a-z_]{6,}/gi, '/:id');
      httpReqs.inc({ method: req.method, route, status: `${Math.floor(res.statusCode / 100)}xx` });
      httpDur.observe({ method: req.method }, (Date.now() - startMs) / 1000);
    });
    next();
  };
}

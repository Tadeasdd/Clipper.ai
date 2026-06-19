/**
 * Clipper.ai — operations backend (Stage B1 skeleton)
 *
 * This server exists to power the INTERNAL operations dashboard first,
 * and the limited client dashboard second (see docs/ARCHITECTURE.md).
 * Customers buy a managed service; this API is the machinery behind it.
 *
 * Every route module maps to one stage of the internal operating system:
 *   ingest → transcribe → analyze → score → generate → review → publish → measure
 */
import express from 'express';
import cors from 'cors';
import { randomUUID } from 'node:crypto';

import intakeRoutes from './routes/intake.js';
import jobsRoutes from './routes/jobs.js';
import clipsRoutes from './routes/clips.js';
import reviewRoutes from './routes/review.js';
import publishRoutes from './routes/publish.js';
import analyticsRoutes from './routes/analytics.js';
import clientsRoutes from './routes/clients.js';
import usersRoutes from './routes/users.js';
import authRoutes from './routes/auth.js';
import leadsRoutes from './routes/leads.js';
import { migrate, q, pool } from './db/index.js';
import { csrfGuard } from './lib/auth.js';
import { startWorkers, drainWorkers } from './pipeline/index.js';
import { startPublisher, drainPublisher } from './publish/scheduler.js';
import { startMetricsPoller, stopMetricsPoller } from './metrics/index.js';
import { startQualityMonitor, stopQualityMonitor } from './metrics/monitor.js';
import { assertProdConfig, corsOptions } from './lib/config.js';
import { log, reportError } from './lib/log.js';
import { httpMetrics, renderProm, registerGauge } from './lib/telemetry.js';
import { isDraining, onShutdown, gracefulShutdown, readiness } from './lib/lifecycle.js';
import { circuitGauge } from './lib/resilience.js';
import { sloGauge } from './ops/slo.js';

// M7: refuse to boot insecurely in production (dev/test are untouched).
assertProdConfig();

const app = express();
app.disable('x-powered-by');
const PROD = process.env.NODE_ENV === 'production';
// M7/S5: baseline security headers (helmet-equivalent, dependency-free). HSTS
// is prod-only — sending it over plain-http dev would pin localhost to HTTPS.
app.use((_req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('X-Frame-Options', 'DENY');
  res.set('Referrer-Policy', 'no-referrer');
  res.set('X-DNS-Prefetch-Control', 'off');
  if (PROD) res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});
app.use(cors(corsOptions())); // M7: locked to CORS_ORIGINS when set, wide-open in dev
// S6: stamp every request with a correlation id (honoring an upstream
// X-Request-Id) so a client-visible error can be tied to the server-side log.
app.use((req, res, next) => {
  req.id = req.headers['x-request-id'] || randomUUID();
  res.set('X-Request-Id', req.id);
  next();
});
app.use(httpMetrics()); // R1: count + time every request
app.use(express.json({ limit: '2mb' }));

// R1: queue depth is read live from the DB at scrape time.
registerGauge('clipper_queue_depth', 'jobs per queue, stage and state', async () => {
  const out = [];
  const pj = await q(`SELECT stage, status, count(*)::int n FROM pipeline_jobs GROUP BY stage, status`);
  for (const r of pj.rows) out.push({ labels: { queue: 'pipeline', stage: r.stage, state: r.status }, value: r.n });
  const pub = await q(`SELECT status, count(*)::int n FROM publish_jobs GROUP BY status`);
  for (const r of pub.rows) out.push({ labels: { queue: 'publish', stage: 'publish', state: r.status }, value: r.n });
  return out;
});

// R3: circuit-breaker state per external dependency (0 closed, 1 open, 2 half-open).
registerGauge('clipper_circuit_state', 'external-dependency circuit breaker state (0 closed, 1 open, 2 half-open)', () => circuitGauge());
// R4: error-budget burn per SLO (>1 means over budget); reflects the last evaluation.
registerGauge('clipper_slo_budget_burn', 'SLO error-budget burn per objective (>1 over budget)', () => sloGauge());

// R1: Prometheus scrape endpoint. Guarded by METRICS_TOKEN when set (a scraper
// presents it as a bearer); open in dev/CI when unset. Outside /api on purpose.
app.get('/metrics', async (req, res) => {
  const token = process.env.METRICS_TOKEN;
  if (token && (req.headers.authorization || '').replace(/^Bearer /, '') !== token && req.query.token !== token) {
    return res.status(401).type('text/plain').send('unauthorized\n');
  }
  try { res.type('text/plain; version=0.0.4').send(await renderProm()); }
  catch (e) { reportError(e, { path: '/metrics', requestId: req.id }); res.status(500).type('text/plain').send('# metrics error\n'); }
});
// NOTE: no body parser touches /api/intake/upload — express.json only consumes
// application/json, so file PUTs stream through untouched and saveStream pipes
// req straight to disk (never buffered in memory).
// S2: CSRF guard — cookie-authenticated state-changing requests must carry a
// custom header (header-only check; safe for the unbuffered upload PUT above).
app.use(csrfGuard);

app.get('/api/health', async (_req, res) => {
  try { await q('SELECT 1'); res.json({ ok: true, service: 'clipper-ops', db: 'up' }); }
  catch { res.status(503).json({ ok: false, service: 'clipper-ops', db: 'down' }); }
});

// R2: k8s-style probes. Liveness (/healthz) stays 200 while the process can
// respond — including during a graceful drain — so the orchestrator doesn't
// SIGKILL us mid-shutdown. Readiness (/readyz) flips to 503 the moment we start
// draining (the load balancer stops routing here) and also reflects live DB
// connectivity, so traffic only arrives when we can actually serve it.
app.get('/healthz', (_req, res) => res.json({ status: 'ok', draining: isDraining() }));
app.get('/readyz', async (_req, res) => {
  const r = await readiness(() => q('SELECT 1'));
  res.status(r.ready ? 200 : 503).json(r);
});

// ── Operating system stages ────────────────────────────────────────────────
app.use('/api/intake', intakeRoutes);       // 1. ingest long-form content
app.use('/api/jobs', jobsRoutes);           // 2–6. pipeline orchestration
app.use('/api/clips', clipsRoutes);         // 5–6. scored candidates + assets
app.use('/api/review', reviewRoutes);       // 7. human QA workflow
app.use('/api/publish', publishRoutes);     // 8. publishing queue
app.use('/api/analytics', analyticsRoutes); // 9–10. performance + feedback loop

// ── Account management + marketing-site lead capture ──────────────────────
app.use('/api/clients', clientsRoutes);
app.use('/api/auth', authRoutes);       // B7: sessions, the only door
app.use('/api/users', usersRoutes);     // B4→B7: account management (ops-gated)
app.use('/api/leads', leadsRoutes);     // F3: waitlist / strategy-call form

// Central error handler — routes call next(e); nothing leaks stack traces.
// M7/S6: structured, redacted logging + a best-effort Sentry report. The client
// gets a generic message + the correlation id; the full detail (stack) lives
// only in the log, tied to that id.
app.use((err, req, res, _next) => {
  reportError(err, { method: req.method, path: req.path, requestId: req.id });
  res.status(500).json({ error: 'internal error', requestId: req.id });
});

const port = process.env.PORT || 8080;
await migrate();
// B3: pipeline workers run in-process by default; set WORKERS_ENABLED=false
// to run them separately via `npm run worker` (SKIP LOCKED makes both safe).
if (process.env.WORKERS_ENABLED !== 'false') {
  startWorkers(); startPublisher(); startMetricsPoller(); startQualityMonitor();
  // R2: on shutdown, the job queues drain in-flight work (zero loss); the
  // metrics poller + calibration monitor just stop (their work self-heals).
  onShutdown(() => drainWorkers());
  onShutdown(() => drainPublisher());
  onShutdown(() => { stopMetricsPoller(); stopQualityMonitor(); });
}
const server = app.listen(port, () => log.info('clipper-ops listening', { port: Number(port), env: process.env.NODE_ENV || 'development' }));

// R2: a deploy/rolling-restart sends SIGTERM. Flip readiness, stop new traffic,
// drain in-flight jobs, then close the DB pool and exit cleanly.
for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, async () => {
    log.info('signal received, shutting down', { signal: sig });
    try { await gracefulShutdown({ server }); } finally { await pool.end().catch(() => {}); process.exit(0); }
  });
}

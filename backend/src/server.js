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
import { migrate, q } from './db/index.js';
import { csrfGuard } from './lib/auth.js';
import { startWorkers } from './pipeline/index.js';
import { startPublisher } from './publish/scheduler.js';
import { startMetricsPoller } from './metrics/index.js';
import { assertProdConfig, corsOptions } from './lib/config.js';
import { log, reportError } from './lib/log.js';

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
app.use(express.json({ limit: '2mb' }));
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
// M7: structured, redacted logging + a best-effort Sentry report.
app.use((err, req, res, _next) => {
  reportError(err, { method: req.method, path: req.path, requestId: req.headers['x-request-id'] });
  res.status(500).json({ error: 'internal error' });
});

const port = process.env.PORT || 8080;
await migrate();
// B3: pipeline workers run in-process by default; set WORKERS_ENABLED=false
// to run them separately via `npm run worker` (SKIP LOCKED makes both safe).
if (process.env.WORKERS_ENABLED !== 'false') { startWorkers(); startPublisher(); startMetricsPoller(); }
app.listen(port, () => log.info('clipper-ops listening', { port: Number(port), env: process.env.NODE_ENV || 'development' }));

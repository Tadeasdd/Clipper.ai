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
import leadsRoutes from './routes/leads.js';
import { migrate, q } from './db/index.js';
import { startWorkers } from './pipeline/index.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));
// NOTE: no body parser touches /api/intake/upload — express.json only consumes
// application/json, so file PUTs stream through untouched and saveStream pipes
// req straight to disk (never buffered in memory).

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
app.use('/api/users', usersRoutes);     // B4: attributable reviews (B7 precursor)
app.use('/api/leads', leadsRoutes);     // F3: waitlist / strategy-call form

// Central error handler — routes call next(e); nothing leaks stack traces.
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'internal error' });
});

const port = process.env.PORT || 8080;
await migrate();
// B3: pipeline workers run in-process by default; set WORKERS_ENABLED=false
// to run them separately via `npm run worker` (SKIP LOCKED makes both safe).
if (process.env.WORKERS_ENABLED !== 'false') startWorkers();
app.listen(port, () => console.log(`clipper-ops listening on :${port}`));

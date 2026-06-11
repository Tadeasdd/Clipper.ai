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

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'clipper-ops' }));

// ── Operating system stages ────────────────────────────────────────────────
app.use('/api/intake', intakeRoutes);       // 1. ingest long-form content
app.use('/api/jobs', jobsRoutes);           // 2–6. pipeline orchestration
app.use('/api/clips', clipsRoutes);         // 5–6. scored candidates + assets
app.use('/api/review', reviewRoutes);       // 7. human QA workflow
app.use('/api/publish', publishRoutes);     // 8. publishing queue
app.use('/api/analytics', analyticsRoutes); // 9–10. performance + feedback loop

// ── Account management (ops + limited client visibility) ──────────────────
app.use('/api/clients', clientsRoutes);

const port = process.env.PORT || 8080;
app.listen(port, () => console.log(`clipper-ops listening on :${port}`));

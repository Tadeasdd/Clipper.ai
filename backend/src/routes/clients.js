/** Stage B2 — Client records. Ops-first; the client portal (B7) reads a slice. */
import { Router } from 'express';
import { q } from '../db/index.js';
import { id } from '../lib/ids.js';
import { requireAuth, INTERNAL } from '../lib/auth.js';
import { validate, paginate } from '../lib/validate.js';
import { meterStatus } from '../lib/metering.js';
import { clientHealth, healthOverview } from '../ops/health.js';
import { audit } from '../lib/audit.js';
import { purgeRecordings } from '../lib/retention.js';

const r = Router();

const LIFECYCLE_STAGES = ['onboarding', 'active', 'at_risk', 'churned'];
const clientSchema = {
  name: { type: 'string', maxLength: 200 },
  plan: { type: 'string', maxLength: 80 },
  cadence: { type: 'string', maxLength: 80 },
  brandConfig: { type: 'object' },
  lifecycleStage: { type: 'string', enum: LIFECYCLE_STAGES },
  notifyPrefs: { type: 'object' }, // O4: opt-out + channel config
};

r.get('/', requireAuth(...INTERNAL), async (req, res, next) => {
  try {
    const { limit, offset } = paginate(req, { def: 200, max: 200 });
    const { rows } = await q(`
      SELECT c.*, count(r.id) FILTER (WHERE r.status NOT IN ('published')) AS open_recordings
      FROM clients c LEFT JOIN recordings r ON r.client_id = c.id
      GROUP BY c.id ORDER BY c.created_at DESC LIMIT $1 OFFSET $2`, [limit, offset]);
    res.json({ clients: rows });
  } catch (e) { next(e); }
});

r.post('/', requireAuth('ops', 'account_manager'),
  validate({ ...clientSchema, name: { type: 'string', required: true, maxLength: 200 } }),
  async (req, res, next) => {
  try {
    const { name, plan, cadence, brandConfig } = req.body || {};
    if (!name || !String(name).trim()) return res.status(400).json({ error: 'name required' });
    const cliId = id('cli');
    const { rows } = await q(
      `INSERT INTO clients (id, name, plan, cadence, brand_config) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [cliId, String(name).trim(), plan || null, cadence || null, brandConfig || {}]
    );
    await audit('admin', 'client_created', { actorId: req.user?.id, actorRole: req.user?.role, // O5
      clientId: cliId, entityType: 'client', entityId: cliId, summary: `Client created: ${String(name).trim()}` });
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
});

// GET /api/clients/health — O3: health + lifecycle for every client (the ops
// panel). At-risk clients sort first. Registered before /:id so 'health' isn't
// read as a client id.
r.get('/health', requireAuth(...INTERNAL), async (_req, res, next) => {
  try { res.json(await healthOverview()); } catch (e) { next(e); }
});

r.get('/:id', requireAuth(), async (req, res, next) => {
  // internal roles see any client; client users see exactly their own (F5).
  // S4: another client's id is a 404, not a 403 — don't confirm it exists.
  if (req.user.role === 'client' && req.user.client_id !== req.params.id) {
    return res.status(404).json({ error: 'unknown client' });
  }
  try {
    const { rows } = await q('SELECT * FROM clients WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'unknown client' });
    res.json({ ...rows[0], meter: await meterStatus(req.params.id) }); // E2: usage vs plan
  } catch (e) { next(e); }
});

// GET /api/clients/:id/usage — E2 metered usage vs the client's plan quota, for
// the ops board. Ops/account roles only.
r.get('/:id/usage', requireAuth(...INTERNAL), async (req, res, next) => {
  try { res.json(await meterStatus(req.params.id)); } catch (e) { next(e); }
});

// GET /api/clients/:id/health — O3: one client's health score, onboarding
// checklist, lifecycle stage, and churn signals.
r.get('/:id/health', requireAuth(...INTERNAL), async (req, res, next) => {
  try {
    const h = await clientHealth(req.params.id);
    if (!h) return res.status(404).json({ error: 'unknown client' });
    res.json(h);
  } catch (e) { next(e); }
});

r.patch('/:id', requireAuth('ops', 'account_manager'), validate(clientSchema), async (req, res, next) => {
  try {
    const { name, plan, cadence, brandConfig, lifecycleStage, notifyPrefs } = req.body || {};
    // O3: advancing into 'active' stamps onboarded_at the first time it happens.
    const { rows } = await q(
      `UPDATE clients SET name = COALESCE($2, name), plan = COALESCE($3, plan),
         cadence = COALESCE($4, cadence), brand_config = COALESCE($5, brand_config),
         lifecycle_stage = COALESCE($6, lifecycle_stage),
         onboarded_at = CASE WHEN $6 = 'active' AND onboarded_at IS NULL THEN now() ELSE onboarded_at END,
         notify_prefs = COALESCE($7, notify_prefs)
       WHERE id = $1 RETURNING *`,
      [req.params.id, name || null, plan || null, cadence || null, brandConfig || null, lifecycleStage || null, notifyPrefs || null]
    );
    if (!rows.length) return res.status(404).json({ error: 'unknown client' });
    await audit('admin', 'client_updated', { actorId: req.user?.id, actorRole: req.user?.role, // O5
      clientId: req.params.id, entityType: 'client', entityId: req.params.id,
      summary: lifecycleStage ? `Lifecycle → ${lifecycleStage}` : 'Client updated', meta: { lifecycleStage } });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

// C1 — GDPR right-to-erasure. Removes ALL of a client's content + derivatives
// (raw media, rendered clips, published outbox objects) and the DB rows that
// descend from them, in one transaction, and records an auditable manifest. The
// client ACCOUNT row and the audit trail survive — erasure is of content, not
// identity, and the deletion itself must remain provable. Ops-only.
r.delete('/:id/content', requireAuth('ops'), async (req, res, next) => {
  try {
    const exists = await q('SELECT id FROM clients WHERE id = $1', [req.params.id]);
    if (!exists.rows.length) return res.status(404).json({ error: 'unknown client' });
    const recs = await q('SELECT id FROM recordings WHERE client_id = $1', [req.params.id]);
    const manifest = await purgeRecordings(recs.rows.map((x) => x.id), {
      reason: 'erasure', clientId: req.params.id, actorId: req.user?.id,
    });
    res.json({ clientId: req.params.id, erased: manifest });
  } catch (e) { next(e); }
});

export default r;

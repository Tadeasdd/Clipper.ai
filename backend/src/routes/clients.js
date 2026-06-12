/** Stage B2 — Client records. Ops-first; the client portal (B7) reads a slice. */
import { Router } from 'express';
import { q } from '../db/index.js';
import { id } from '../lib/ids.js';
import { requireAuth, INTERNAL } from '../lib/auth.js';

const r = Router();

r.get('/', requireAuth(...INTERNAL), async (_req, res, next) => {
  try {
    const { rows } = await q(`
      SELECT c.*, count(r.id) FILTER (WHERE r.status NOT IN ('published')) AS open_recordings
      FROM clients c LEFT JOIN recordings r ON r.client_id = c.id
      GROUP BY c.id ORDER BY c.created_at DESC`);
    res.json({ clients: rows });
  } catch (e) { next(e); }
});

r.post('/', requireAuth('ops', 'account_manager'), async (req, res, next) => {
  try {
    const { name, plan, cadence, brandConfig } = req.body || {};
    if (!name || !String(name).trim()) return res.status(400).json({ error: 'name required' });
    const cliId = id('cli');
    const { rows } = await q(
      `INSERT INTO clients (id, name, plan, cadence, brand_config) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [cliId, String(name).trim(), plan || null, cadence || null, brandConfig || {}]
    );
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
});

r.get('/:id', requireAuth(), async (req, res, next) => {
  // internal roles see any client; client users see exactly their own (F5)
  if (req.user.role === 'client' && req.user.client_id !== req.params.id) {
    return res.status(403).json({ error: 'client users can only see their own account' });
  }
  try {
    const { rows } = await q('SELECT * FROM clients WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'unknown client' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

r.patch('/:id', requireAuth('ops', 'account_manager'), async (req, res, next) => {
  try {
    const { name, plan, cadence, brandConfig } = req.body || {};
    const { rows } = await q(
      `UPDATE clients SET name = COALESCE($2, name), plan = COALESCE($3, plan),
         cadence = COALESCE($4, cadence), brand_config = COALESCE($5, brand_config)
       WHERE id = $1 RETURNING *`,
      [req.params.id, name || null, plan || null, cadence || null, brandConfig || null]
    );
    if (!rows.length) return res.status(404).json({ error: 'unknown client' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

export default r;

/** Stage B4 — user records (B7 precursor).
 *  Review decisions must be attributable to a real person, so the review
 *  workflow needs users rows now. This is records-only: sessions, passwords,
 *  and enforcement arrive with B7 — until then callers pass their userId.
 */
import { Router } from 'express';
import { q } from '../db/index.js';
import { id } from '../lib/ids.js';

const r = Router();
const ROLES = ['ops', 'editor', 'reviewer', 'account_manager', 'client'];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// POST /api/users { email, role, clientId? } — idempotent per email: a
// resubmit with the same role returns the existing row (dev/smoke ergonomics);
// a role mismatch is a 409 (role changes are a deliberate B7 operation).
r.post('/', async (req, res, next) => {
  try {
    const { email, role, clientId } = req.body || {};
    const trimmed = String(email || '').trim().toLowerCase();
    if (!EMAIL.test(trimmed)) return res.status(400).json({ error: 'valid email required' });
    if (!ROLES.includes(role)) return res.status(400).json({ error: `role must be one of ${ROLES.join(' | ')}` });
    if (role === 'client') {
      if (!clientId) return res.status(400).json({ error: 'client role requires clientId' });
      const c = await q('SELECT id FROM clients WHERE id = $1', [clientId]);
      if (!c.rowCount) return res.status(404).json({ error: 'unknown clientId' });
    }
    const existing = await q('SELECT * FROM users WHERE email = $1', [trimmed]);
    if (existing.rowCount) {
      const u = existing.rows[0];
      if (u.role !== role || (role === 'client' && u.client_id !== clientId)) {
        return res.status(409).json({ error: `email exists with role ${u.role}` });
      }
      return res.json(u);
    }
    const { rows } = await q(
      `INSERT INTO users (id, email, role, client_id) VALUES ($1,$2,$3,$4) RETURNING *`,
      [id('usr'), trimmed, role, role === 'client' ? clientId : null]);
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
});

// GET /api/users?role= — pickers in the ops dashboard (B7 puts this behind auth).
r.get('/', async (req, res, next) => {
  try {
    const { role } = req.query;
    const { rows } = role
      ? await q('SELECT * FROM users WHERE role = $1 ORDER BY created_at', [role])
      : await q('SELECT * FROM users ORDER BY created_at');
    res.json({ users: rows });
  } catch (e) { next(e); }
});

export default r;

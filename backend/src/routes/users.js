/** Stage B4 → B7 — user accounts.
 *  B4 made decisions attributable to rows; B7 made the rows real accounts:
 *  ops/account managers create them WITH a password, and the holder signs in
 *  (POST /api/auth/login) and changes it (POST /api/auth/password). */
import { Router } from 'express';
import { q } from '../db/index.js';
import { id } from '../lib/ids.js';
import { requireAuth, INTERNAL, hashPassword } from '../lib/auth.js';

const r = Router();
const ROLES = ['ops', 'editor', 'reviewer', 'account_manager', 'client'];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// POST /api/users { email, role, clientId? } — idempotent per email: a
// resubmit with the same role returns the existing row (dev/smoke ergonomics);
// a role mismatch is a 409 (role changes are a deliberate B7 operation).
r.post('/', requireAuth('ops', 'account_manager'), async (req, res, next) => {
  try {
    const { email, role, clientId, password } = req.body || {};
    if (!password || String(password).length < 8) {
      return res.status(400).json({ error: 'password (≥ 8 characters) required — the account holder changes it after first sign-in' });
    }
    const trimmed = String(email || '').trim().toLowerCase();
    if (!EMAIL.test(trimmed)) return res.status(400).json({ error: 'valid email required' });
    if (!ROLES.includes(role)) return res.status(400).json({ error: `role must be one of ${ROLES.join(' | ')}` });
    if (role === 'client') {
      if (!clientId) return res.status(400).json({ error: 'client role requires clientId' });
      const c = await q('SELECT id FROM clients WHERE id = $1', [clientId]);
      if (!c.rowCount) return res.status(404).json({ error: 'unknown clientId' });
    }
    const existing = await q('SELECT id, email, role, client_id, created_at FROM users WHERE email = $1', [trimmed]);
    if (existing.rowCount) {
      const u = existing.rows[0];
      if (u.role !== role || (role === 'client' && u.client_id !== clientId)) {
        return res.status(409).json({ error: `email exists with role ${u.role}` });
      }
      return res.json(u);
    }
    const { rows } = await q(
      `INSERT INTO users (id, email, role, client_id, password_hash) VALUES ($1,$2,$3,$4,$5)
       RETURNING id, email, role, client_id, created_at`,
      [id('usr'), trimmed, role, role === 'client' ? clientId : null, hashPassword(String(password))]);
    res.status(201).json(rows[0]);
  } catch (e) { next(e); }
});

// GET /api/users?role= — pickers in the ops dashboard (B7 puts this behind auth).
r.get('/', requireAuth(...INTERNAL), async (req, res, next) => {
  try {
    const { role } = req.query;
    const cols = 'id, email, role, client_id, created_at, password_hash IS NOT NULL AS has_credentials';
    const { rows } = role
      ? await q(`SELECT ${cols} FROM users WHERE role = $1 ORDER BY created_at`, [role])
      : await q(`SELECT ${cols} FROM users ORDER BY created_at`);
    res.json({ users: rows });
  } catch (e) { next(e); }
});

export default r;

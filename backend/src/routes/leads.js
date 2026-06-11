/** Stage F3/B2 — Lead capture from the marketing site.
 *  Public POST (the Waitlist form), ops-only listing later (B7 adds auth). */
import { Router } from 'express';
import { q } from '../db/index.js';
import { id } from '../lib/ids.js';

const r = Router();
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// POST /api/leads { email, contentKind?, source?, notes?, meta? }
// Idempotent per (email, source): resubmits refresh the row and return the
// original position, so the form can say "you're already on the list".
r.post('/', async (req, res, next) => {
  try {
    const { email, contentKind, source, notes, meta } = req.body || {};
    const trimmed = String(email || '').trim().toLowerCase();
    if (!EMAIL.test(trimmed)) return res.status(400).json({ error: 'valid email required' });
    const src = ['waitlist', 'strategy_call', 'docs', 'other'].includes(source) ? source : 'waitlist';

    const existing = await q(
      'SELECT id, created_at FROM leads WHERE lower(email) = $1 AND source = $2', [trimmed, src]);
    let leadId, createdAt, duplicate = false;
    if (existing.rowCount) {
      duplicate = true;
      leadId = existing.rows[0].id;
      createdAt = existing.rows[0].created_at;
      await q('UPDATE leads SET content_kind = COALESCE($2, content_kind), notes = COALESCE($3, notes), meta = meta || $4 WHERE id = $1',
        [leadId, contentKind || null, notes || null, meta || {}]);
    } else {
      leadId = id('lead');
      const ins = await q(
        `INSERT INTO leads (id, email, content_kind, source, notes, meta) VALUES ($1,$2,$3,$4,$5,$6) RETURNING created_at`,
        [leadId, trimmed, contentKind || null, src, notes || null, meta || {}]);
      createdAt = ins.rows[0].created_at;
    }
    const pos = await q('SELECT count(*)::int AS n FROM leads WHERE source = $1 AND created_at <= $2', [src, createdAt]);
    res.status(duplicate ? 200 : 201).json({ id: leadId, position: pos.rows[0].n, duplicate });
  } catch (e) { next(e); }
});

// GET /api/leads/stats — public-safe aggregate for the form's social proof.
r.get('/stats', async (_req, res, next) => {
  try {
    const { rows } = await q(`
      SELECT count(*)::int AS total,
             count(*) FILTER (WHERE created_at >= date_trunc('day', now()))::int AS today
      FROM leads`);
    res.json(rows[0]);
  } catch (e) { next(e); }
});

// GET /api/leads — ops listing (B7 puts this behind auth).
r.get('/', async (_req, res, next) => {
  try {
    const { rows } = await q('SELECT * FROM leads ORDER BY created_at DESC LIMIT 200');
    res.json({ leads: rows });
  } catch (e) { next(e); }
});

export default r;

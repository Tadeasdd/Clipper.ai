/** Stage F3/B2 — Lead capture from the marketing site.
 *  Public POST (the Waitlist form), ops-only listing later (B7 adds auth). */
import { Router } from 'express';
import { q } from '../db/index.js';
import { id } from '../lib/ids.js';
import { requireAuth, INTERNAL } from '../lib/auth.js';
import { rateLimit } from '../lib/ratelimit.js';
import { validate, paginate } from '../lib/validate.js';

const r = Router();
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// POST /api/leads { email, contentKind?, source?, notes?, meta? }
// The one public door, so it's rate-limited per IP and shape-validated.
// Idempotent per (email, source): resubmits refresh the row and return the
// original position, so the form can say "you're already on the list".
r.post('/',
  rateLimit({ name: 'leads', max: 60 }),
  validate({
    email: { type: 'string', required: true, maxLength: 200 },
    contentKind: { type: 'string', maxLength: 80 },
    source: { type: 'string', maxLength: 40 },
    notes: { type: 'string', maxLength: 4000 },
    meta: { type: 'object' },
  }),
  async (req, res, next) => {
  try {
    const { email, contentKind, source, notes, meta } = req.body || {};
    const trimmed = String(email || '').trim().toLowerCase();
    if (!EMAIL.test(trimmed)) return res.status(400).json({ error: 'valid email required' });
    const src = ['waitlist', 'strategy_call', 'docs', 'other'].includes(source) ? source : 'waitlist';

    const existing = await q(
      'SELECT id, created_at FROM leads WHERE lower(email) = $1 AND source = $2', [trimmed, src]);
    let leadId, duplicate = false;
    if (existing.rowCount) {
      duplicate = true;
      leadId = existing.rows[0].id;
      await q('UPDATE leads SET content_kind = COALESCE($2, content_kind), notes = COALESCE($3, notes), meta = meta || $4 WHERE id = $1',
        [leadId, contentKind || null, notes || null, meta || {}]);
    } else {
      leadId = id('lead');
      await q(
        `INSERT INTO leads (id, email, content_kind, source, notes, meta) VALUES ($1,$2,$3,$4,$5,$6)`,
        [leadId, trimmed, contentKind || null, src, notes || null, meta || {}]);
    }
    // Position is computed entirely in SQL against the row's own timestamp —
    // round-tripping created_at through a JS Date truncates the microseconds
    // Postgres keeps, which would drop the row from its own count (position 0
    // for the very first lead on an empty table).
    const pos = await q(
      `SELECT count(*)::int AS n FROM leads
       WHERE source = $1 AND created_at <= (SELECT created_at FROM leads WHERE id = $2)`,
      [src, leadId]);
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

// GET /api/leads — ops listing. Holds PII (emails, notes), so it's walled to
// internal roles (S3 authz fix) and paginated with a hard cap.
r.get('/', requireAuth(...INTERNAL), async (req, res, next) => {
  try {
    const { limit, offset } = paginate(req, { def: 200, max: 200 });
    const { rows } = await q('SELECT * FROM leads ORDER BY created_at DESC LIMIT $1 OFFSET $2', [limit, offset]);
    res.json({ leads: rows });
  } catch (e) { next(e); }
});

export default r;

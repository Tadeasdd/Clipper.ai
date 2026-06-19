/** O5 — the activity feed API. Role-aware, single endpoint:
 *   - internal roles read the whole feed (filter by ?area / ?clientId);
 *   - a client user reads ONLY their own client_visible activity (session-fenced;
 *     they never see internal-only actions or another client's rows — S4).
 */
import { Router } from 'express';
import { auditFeed, clientFeed } from '../lib/audit.js';
import { requireAuth } from '../lib/auth.js';

const r = Router();

r.get('/', requireAuth(), async (req, res, next) => {
  try {
    const { area, before, limit } = req.query;
    if (req.user.role === 'client') {
      const events = await clientFeed(req.user.client_id, { before, limit });
      return res.json({ scope: 'client', clientId: req.user.client_id, events });
    }
    const events = await auditFeed({ area, clientId: req.query.clientId, before, limit });
    res.json({ scope: 'ops', events });
  } catch (e) { next(e); }
});

export default r;

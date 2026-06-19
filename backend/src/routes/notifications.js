/** O4 — client-facing notification feed. The portal reads its own client's
 *  recent lifecycle notifications; internal roles can read any client's. Identity
 *  comes from the session — a client user is fenced to their own client_id. */
import { Router } from 'express';
import { notificationsFor } from '../notify/index.js';
import { requireAuth } from '../lib/auth.js';

const r = Router();

// GET /api/notifications?clientId=&limit= — own client (client users) or any
// client (internal). S4: a client user never reads another client's feed.
r.get('/', requireAuth(), async (req, res, next) => {
  try {
    let clientId = req.query.clientId;
    if (req.user.role === 'client') clientId = req.user.client_id;
    if (!clientId) return res.status(400).json({ error: 'clientId required' });
    const notifications = await notificationsFor(clientId, Number(req.query.limit) || 50);
    res.json({ clientId, notifications });
  } catch (e) { next(e); }
});

export default r;

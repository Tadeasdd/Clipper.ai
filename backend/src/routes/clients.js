/** Client management — ops-first; clients get limited visibility (Stage B7 portal). */
import { Router } from 'express';
const r = Router();

r.get('/', (_req, res) => {
  // TODO(B2): list clients with plan, cadence, open deliverables
  res.json({ clients: [] });
});

r.post('/', (req, res) => {
  const { name } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name required' });
  // TODO(B2): create client + default brand settings (fonts, caption style, platforms)
  res.status(201).json({ id: 'cli_stub', name });
});

export default r;

/* F3 — the marketing site's tiny API client.
   Dev: Vite proxies /api → localhost:8080. Prod: same-origin by default, or
   set VITE_API_BASE when the backend lives on another host. */
const API_BASE = (import.meta.env && import.meta.env.VITE_API_BASE) || '';

async function json(method, path, body) {
  const res = await fetch(API_BASE + path, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `request failed (${res.status})`);
  return data;
}

/** POST /api/leads — returns { id, position, duplicate }. */
export const postLead = ({ email, contentKind, source = 'waitlist', notes, meta }) =>
  json('POST', '/api/leads', { email, contentKind, source, notes, meta });

/* F4 — the ops dashboard's API layer.
   Same-origin /api by default (Vite proxies in dev), VITE_API_BASE in prod.
   Every hook catches: the board must render an honest error state when the
   backend is unreachable, never crash (the route smoke runs with no backend). */
import { useCallback, useEffect, useRef, useState } from 'react';

const API_BASE = (import.meta.env && import.meta.env.VITE_API_BASE) || '';

async function json(method, path, body) {
  const res = await fetch(API_BASE + path, {
    method,
    headers: { 'content-type': 'application/json', ...authHeader() },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `request failed (${res.status})`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const ops = {
  // boards
  jobs: () => json('GET', '/api/jobs'),
  job: (id) => json('GET', `/api/jobs/${id}`),
  retry: (id) => json('POST', `/api/jobs/${id}/retry`),
  intakeQueue: () => json('GET', '/api/intake/queue'),
  // clips
  clips: (params) => json('GET', `/api/clips?${new URLSearchParams(params)}`),
  patchClip: (id, body) => json('PATCH', `/api/clips/${id}`, body),
  assetUrl: (id) => `${API_BASE}/api/clips/${id}/asset`,
  // review (B4)
  reviewQueue: (status) => json('GET', `/api/review/queue${status ? `?status=${status}` : ''}`),
  decide: (clipId, body) => json('POST', `/api/review/${clipId}/decision`, body),
  send: (clipId, body) => json('POST', `/api/review/${clipId}/send`, body),
  resubmit: (clipId, body) => json('POST', `/api/review/${clipId}/resubmit`, body),
  history: (clipId) => json('GET', `/api/review/${clipId}/history`),
  // clients + users
  clients: () => json('GET', '/api/clients'),
  client: (id) => json('GET', `/api/clients/${id}`),
  createClient: (body) => json('POST', '/api/clients', body),
  patchClient: (id, body) => json('PATCH', `/api/clients/${id}`, body),
  users: (role) => json('GET', `/api/users${role ? `?role=${role}` : ''}`),
  createUser: (body) => json('POST', '/api/users', body),
  // stubs that fill in with B5/B6 (shaped, honest)
  publishQueue: () => json('GET', '/api/publish/queue'),
  opsAnalytics: () => json('GET', '/api/analytics/ops'),
};

/** Poll an endpoint on an interval. Pauses when the tab is hidden; exposes
 *  { data, error, loading, refresh } so views can render every state. */
export function usePoll(fn, { ms = 3000, deps = [] } = {}) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const alive = useRef(true);
  const tick = useCallback(async () => {
    try {
      const data = await fn();
      if (alive.current) setState({ data, error: null, loading: false });
    } catch (e) {
      if (alive.current) setState((s) => ({ data: s.data, error: e, loading: false }));
    }
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    alive.current = true;
    tick();
    const id = setInterval(() => {
      if (typeof document === 'undefined' || !document.hidden) tick();
    }, ms);
    return () => { alive.current = false; clearInterval(id); };
  }, [tick, ms]);
  return { ...state, refresh: tick };
}

/* ── session (B7) ─────────────────────────────────────────────────────────
   The bearer token rides every API call; the server also sets an httpOnly
   cookie at login, which is what <video src> asset requests authenticate
   with (you can't put a header on a media element). Logout revokes the
   session server-side. */
const TOKEN_KEY = 'clipper_ops_token';
let currentUser = null;

export function authHeader() {
  try {
    const t = localStorage.getItem(TOKEN_KEY);
    return t ? { authorization: `Bearer ${t}` } : {};
  } catch { return {}; }
}
export function setSession(token, user) {
  try { token ? localStorage.setItem(TOKEN_KEY, token) : localStorage.removeItem(TOKEN_KEY); } catch { /* no storage */ }
  currentUser = user || null;
}
export function getUser() { return currentUser; }

export const auth = {
  status: () => json('GET', '/api/auth/status'),
  login: (email, password) => json('POST', '/api/auth/login', { email, password }),
  bootstrap: (email, password) => json('POST', '/api/auth/bootstrap', { email, password }),
  me: () => json('GET', '/api/auth/me'),
  logout: () => json('POST', '/api/auth/logout'),
};

/* ── tiny shared formatters ─────────────────────────────────────────────── */
export const fmtClock = (s) => {
  const n = Math.floor(Number(s) || 0);
  return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`;
};
export const fmtAgo = (iso) => {
  if (!iso) return '—';
  const s = Math.max(0, (Date.now() - Date.parse(iso)) / 1000);
  if (s < 60) return `${Math.floor(s)}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

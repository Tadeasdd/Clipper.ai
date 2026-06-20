/* F4 — the ops dashboard's API layer.
   Same-origin /api by default (Vite proxies in dev), VITE_API_BASE in prod.
   Every hook catches: the board must render an honest error state when the
   backend is unreachable, never crash (the route smoke runs with no backend). */
import { useCallback, useEffect, useRef, useState } from 'react';

const API_BASE = (import.meta.env && import.meta.env.VITE_API_BASE) || '';

export async function json(method, path, body) {
  const res = await fetch(API_BASE + path, {
    method,
    // S2: auth rides the httpOnly session cookie (credentials: include); the
    // X-Requested-With header satisfies the server's CSRF guard on writes.
    credentials: 'include',
    headers: { 'content-type': 'application/json', 'x-requested-with': 'clipper' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = /** @type {Error & { status?: number, data?: any }} */ (new Error(data.error || `request failed (${res.status})`));
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
  opsMargin: () => json('GET', '/api/analytics/margin'),
  opsTurnaround: () => json('GET', '/api/analytics/turnaround'),
  opsCapacity: () => json('GET', '/api/analytics/capacity'),
  balanceReview: () => json('POST', '/api/review/assign/balance', {}),
  opsHealth: () => json('GET', '/api/clients/health'),
  opsAudit: (area) => json('GET', `/api/audit${area ? `?area=${area}` : ''}`),
};

/** Poll an endpoint on an interval. Pauses when the tab is hidden; exposes
 *  { data, error, loading, refresh } so views can render every state. */
export function usePoll(fn, { ms = 3000, deps = [] } = {}) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const alive = useRef(true);
  // U5: hold the latest poll fn in a ref so `tick` stays stable yet never calls
  // a stale closure — callers pass a fresh `fn` (e.g. () => ops.clips()) each
  // render, and the old code captured the first one. This removes the
  // eslint-disable while fixing that latent stale-closure bug.
  const fnRef = useRef(fn);
  useEffect(() => { fnRef.current = fn; });
  const tick = useCallback(async () => {
    try {
      const data = await fnRef.current();
      if (alive.current) setState({ data, error: null, loading: false });
    } catch (e) {
      if (alive.current) setState((s) => ({ data: s.data, error: e, loading: false }));
    }
  }, []);
  // Re-subscribe when the interval or the caller's poll key changes. Serialising
  // `deps` (callers pass primitives) gives the effect a stable, complete dep
  // list — so exhaustive-deps is satisfied with no disable.
  const depsKey = JSON.stringify(deps);
  useEffect(() => {
    alive.current = true;
    tick();
    const id = setInterval(() => {
      if (typeof document === 'undefined' || !document.hidden) tick();
    }, ms);
    return () => { alive.current = false; clearInterval(id); };
  }, [tick, ms, depsKey]);
  return { ...state, refresh: tick };
}

/* ── session (B7 + S2) ──────────────────────────────────────────────────────
   The session token lives ONLY in an httpOnly cookie the server sets at login —
   JS never reads or stores it, so XSS can't exfiltrate it. Every API call rides
   that cookie (credentials: 'include'); <video src> asset requests authenticate
   with it too (you can't put a header on a media element). On load the app calls
   /api/auth/me to recover the user from the cookie. Logout revokes server-side. */
let currentUser = null;

export function setSession(user) { currentUser = user || null; }
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

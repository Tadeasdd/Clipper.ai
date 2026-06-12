/* F4 — the ops dashboard's API layer.
   Same-origin /api by default (Vite proxies in dev), VITE_API_BASE in prod.
   Every hook catches: the board must render an honest error state when the
   backend is unreachable, never crash (the route smoke runs with no backend). */
import { useCallback, useEffect, useRef, useState } from 'react';

const API_BASE = (import.meta.env && import.meta.env.VITE_API_BASE) || '';

async function json(method, path, body) {
  const res = await fetch(API_BASE + path, {
    method,
    headers: { 'content-type': 'application/json' },
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

/* ── identity (B7 placeholder) ────────────────────────────────────────────
   Until sessions exist, the operator picks/creates a users row and we send
   its id with every review action. Trusted identity, real role checks. */
const ID_KEY = 'clipper_ops_identity';

export function getIdentity() {
  try { return JSON.parse(localStorage.getItem(ID_KEY)) || null; } catch { return null; }
}
export function setIdentity(user) {
  try {
    if (user) localStorage.setItem(ID_KEY, JSON.stringify(user));
    else localStorage.removeItem(ID_KEY);
  } catch { /* storage unavailable — identity just won't persist */ }
}

/* ── gate (B7 placeholder) ────────────────────────────────────────────────
   A shared key in sessionStorage. This is NOT auth — it keeps the ops route
   out of casual reach until B7 ships sessions + roles. Deployments must also
   gate /ops at the proxy layer. */
const GATE_KEY = 'clipper_ops_gate';
const EXPECTED = (import.meta.env && import.meta.env.VITE_OPS_KEY) || 'clipper-ops';

export function gateUnlocked() {
  try { return sessionStorage.getItem(GATE_KEY) === EXPECTED; } catch { return false; }
}
export function tryUnlock(key) {
  if (key !== EXPECTED) return false;
  try { sessionStorage.setItem(GATE_KEY, key); } catch { /* still unlocked for this render */ }
  return true;
}

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

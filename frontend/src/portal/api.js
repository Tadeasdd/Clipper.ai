/* F5 — the client portal's API layer.
   Shares the request helper, session store, and poll hook with /ops (one
   httpOnly session cookie — the server decides what a role can see, the
   frontend only decides which surface to show). Every endpoint here is
   client-fenced on the backend: queries are pinned to the session's client,
   so this file can stay naive about scoping. */
import { json, usePoll, auth, setSession, getUser, fmtClock, fmtAgo } from '../ops/api.js';

const API_BASE = (import.meta.env && import.meta.env.VITE_API_BASE) || '';

export const portal = {
  // deliverables — the backend pins the list to the session's client
  clips: (params) => json('GET', `/api/clips?${new URLSearchParams(params || {})}`),
  assetUrl: (id) => `${API_BASE}/api/clips/${id}/asset`, // cookie-authed: <video src> can't carry a header
  clipMetrics: (id) => json('GET', `/api/clips/${id}/metrics`),
  // sign-off — queue is FORCED to status=awaiting_client + own client server-side
  reviewQueue: () => json('GET', '/api/review/queue'),
  decide: (clipId, body) => json('POST', `/api/review/${clipId}/decision`, body),
  history: (clipId) => json('GET', `/api/review/${clipId}/history`),
  // upload — submissions list comes back pinned to own client
  submit: (body) => json('POST', '/api/intake', body),
  uploadUrl: (recordingId) => `${API_BASE}/api/intake/upload/${recordingId}`,
  submissions: () => json('GET', '/api/intake/queue'),
  // report + account
  report: (clientId, days) => json('GET', `/api/analytics/clients/${clientId}?days=${days || 30}`),
  client: (id) => json('GET', `/api/clients/${id}`),
  changePassword: (current, next) => json('POST', '/api/auth/password', { current, next }),
};

/** Raw upload (file body, not JSON) — rides the session cookie like every call;
 *  X-Requested-With clears the CSRF guard on this state-changing PUT. */
export async function uploadFile(recordingId, file) {
  const res = await fetch(portal.uploadUrl(recordingId), {
    method: 'PUT',
    credentials: 'include',
    headers: { 'content-type': 'application/octet-stream', 'x-requested-with': 'clipper' },
    body: file,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `upload failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export { usePoll, auth, setSession, getUser, fmtClock, fmtAgo };

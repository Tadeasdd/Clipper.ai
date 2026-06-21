/* P3 — shared E2E helpers. The journey specs drive the REAL built app in a real
   browser; this module does the out-of-band setup the way the f4/f5 integration
   scripts do: authenticate over the API and seed clips straight into Postgres
   (there is no public "make a clip" endpoint — clips are pipeline output). We
   reuse the backend's own pg dependency rather than adding one to the frontend. */
const API = process.env.PLAYWRIGHT_API_BASE || 'http://localhost:8080';
const DB_URL = process.env.DATABASE_URL || 'postgres://clipper:clipper@localhost:5432/clipper';

export const apiBase = API;

export async function api(method, path, body, token) {
  const res = await fetch(API + path, {
    method,
    headers: {
      'content-type': 'application/json',
      'x-requested-with': 'clipper',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}

// The fixed smoke ops account (bootstrap-or-login, idempotent).
export async function opsLogin() {
  const creds = { email: 'ops@smoke.clipper.ai', password: 'smoke-ops-password' };
  await api('POST', '/api/auth/bootstrap', creds); // 201 once, 409 after
  const { data } = await api('POST', '/api/auth/login', creds);
  if (!data.token) throw new Error('ops login failed');
  return data.token;
}

export async function db() {
  const { default: pg } = await import('../../backend/node_modules/pg/lib/index.js');
  return new pg.Pool({ connectionString: DB_URL });
}

// Seed a clip in a given review status under a fresh client, returning the ids.
// Mirrors the f4/f5 seeding SQL exactly so it tracks the real schema.
export async function seedClip(pool, { token, status, hook, clientName }) {
  const stamp = `${Date.now()}_${Math.floor(performance.now() * 1000) % 1000000}`;
  const clientId = (await api('POST', '/api/clients', { name: `${clientName} ${stamp}` }, token)).data.id;
  const rec = `rec_e2e_${stamp}`;
  const clip = `clip_e2e_${stamp}`;
  await pool.query(
    `INSERT INTO recordings (id, client_id, kind, status, duration_s) VALUES ($1,$2,'podcast','ready',180)`,
    [rec, clientId]);
  await pool.query(
    `INSERT INTO clips (id, recording_id, t_start_s, t_end_s, score, signals, hook, status)
     VALUES ($1,$2,30,62,91,'{"energyZ":2.1,"durationFit":0.97,"positionBonus":0.93}',$3,$4)`,
    [clip, rec, hook, status]);
  return { clientId, rec, clip };
}

// Mint a client user bound to a client, returning a logged-in token + email.
export async function clientLogin(pool, { opsToken, clientId }) {
  const stamp = `${Date.now()}_${Math.floor(performance.now() * 1000) % 1000000}`;
  const email = `e2e+${stamp}@client.clipper.ai`;
  const password = 'portal-first-password';
  await api('POST', '/api/users', { email, role: 'client', clientId, password }, opsToken);
  const { data } = await api('POST', '/api/auth/login', { email, password });
  if (!data.token) throw new Error('client login failed');
  return { token: data.token, email };
}

// The session is an httpOnly cookie whose value is the login token (S2). Set it
// for the BACKEND origin — that's where the app's credentialed /api calls go.
// localhost is one site across ports, so SameSite=Lax rides cross-port fine.
export async function setSessionCookie(context, token) {
  const u = new URL(API);
  await context.addCookies([{
    name: 'clipper_session', value: token,
    domain: u.hostname, path: '/', httpOnly: true, sameSite: 'Lax',
  }]);
}

export async function clipStatus(pool, clipId) {
  const { rows } = await pool.query('SELECT status FROM clips WHERE id = $1', [clipId]);
  return rows[0]?.status || null;
}

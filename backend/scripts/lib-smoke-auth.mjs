/* B7 — shared session plumbing for the smoke scripts. Fixed smoke
   credentials: the first run against a fresh DB bootstraps the ops account,
   every later run logs in. mintUser creates an account (ops session) and
   signs it in, returning a token for that role. */
const OPS = { email: 'ops@smoke.clipper.ai', password: 'smoke-ops-password' };

export async function opsSession(BASE) {
  const post = (p, body) => fetch(BASE + p, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  }).then(async (res) => ({ status: res.status, data: await res.json().catch(() => ({})) }));
  await post('/api/auth/bootstrap', OPS); // 201 first run, 409 after — both fine
  const r = await post('/api/auth/login', OPS);
  if (!r.data.token) throw new Error(`ops login failed (${r.status}): ${JSON.stringify(r.data)}`);
  return r.data.token;
}

export async function mintUser(BASE, opsToken, { email, role, clientId }) {
  const password = 'smoke-first-password';
  const headers = { 'content-type': 'application/json' };
  const create = await fetch(BASE + '/api/users', {
    method: 'POST', headers: { ...headers, authorization: `Bearer ${opsToken}` },
    body: JSON.stringify({ email, role, clientId, password }),
  }).then(async (res) => ({ status: res.status, data: await res.json().catch(() => ({})) }));
  const login = await fetch(BASE + '/api/auth/login', {
    method: 'POST', headers, body: JSON.stringify({ email, password }),
  }).then((res) => res.json());
  if (!login.token) throw new Error(`login as ${email} failed: ${JSON.stringify(login)}`);
  return { id: create.data.id, token: login.token, email };
}

/** M7 — production config guards.
 *
 *  In production the offline-friendly defaults are dangerous: the dev
 *  PUBLISH_TOKEN_KEY makes every stored credential decryptable, and an unset
 *  DATABASE_URL would silently fall back to a local insecure DSN. Fail fast on
 *  boot rather than run insecurely. In dev/test (NODE_ENV !== 'production')
 *  none of this applies, so the smokes and offline dev are untouched.
 */
const DEV_TOKEN_KEY = 'dev-publish-key — set PUBLISH_TOKEN_KEY in production';

export function assertProdConfig(env = process.env) {
  if (env.NODE_ENV !== 'production') return;
  const problems = [];
  const key = env.PUBLISH_TOKEN_KEY;
  if (!key || key === DEV_TOKEN_KEY) problems.push('PUBLISH_TOKEN_KEY is unset or the dev default (stored credentials would be decryptable)');
  else if (key.length < 16) problems.push('PUBLISH_TOKEN_KEY is too short (use a strong random secret, ≥16 chars)');
  if (!env.DATABASE_URL) problems.push('DATABASE_URL is unset (refusing the insecure local fallback in production)');
  if (problems.length) {
    throw new Error(`refusing to boot in production with insecure config:\n  - ${problems.join('\n  - ')}`);
  }
}

/** CORS options for the `cors` middleware. With CORS_ORIGINS set (a comma list)
 *  only those origins are allowed; unset means wide-open, which is fine for dev
 *  but should never be the case in production (assertProdConfig stays focused on
 *  secrets, so this is a soft default — set CORS_ORIGINS to lock it down). */
export function corsOptions(env = process.env) {
  // credentials: true so cross-origin browser requests can carry the session
  // cookie (S2). The `cors` middleware then reflects the specific origin and
  // adds Access-Control-Allow-Credentials — never the wildcard `*`, which is
  // incompatible with credentials.
  const configured = (env.CORS_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!configured.length) return { origin: true, credentials: true }; // dev: reflect any origin
  const allow = new Set(configured);
  return {
    credentials: true,
    origin(origin, cb) {
      // Non-browser callers (curl, server-to-server) send no Origin — allow them;
      // CORS only governs browser cross-origin reads.
      if (!origin || allow.has(origin)) return cb(null, true);
      return cb(null, false); // disallowed → no Access-Control-Allow-Origin header
    },
  };
}

/** M7 — production config guards. C3 — secret-manager-backed boot.
 *
 *  In production the offline-friendly defaults are dangerous: a dev key makes
 *  stored credentials/media decryptable, and an unset DATABASE_URL would silently
 *  fall back to a local insecure DSN. Fail fast on boot rather than run
 *  insecurely. In dev/test (NODE_ENV !== 'production') none of the key/DSN checks
 *  apply, so the smokes and offline dev are untouched.
 *
 *  Keys are resolved through the secret manager (lib/secrets), so a deployment
 *  can source them from a manager instead of env — initSecrets() runs first and
 *  fails fast if the configured manager is unreachable.
 */
import { getSecret, initSecrets } from './secrets.js';
import { DEV_PUBLISH_KEY } from './crypto.js';
import { DEV_CONTENT_KEY } from './content-crypto.js';

const MIN_KEY_LEN = 16;

function checkKey(problems, name, devDefault, risk) {
  const val = getSecret(name);
  if (!val || val === devDefault) problems.push(`${name} is unset or the dev default (${risk})`);
  else if (val.length < MIN_KEY_LEN) problems.push(`${name} is too short (use a strong random secret, ≥${MIN_KEY_LEN} chars)`);
}

export async function assertProdConfig(env = process.env) {
  const provider = await initSecrets(); // fail fast if the secret manager is unreachable
  if (env.NODE_ENV !== 'production') return { provider };
  const problems = [];
  checkKey(problems, 'PUBLISH_TOKEN_KEY', DEV_PUBLISH_KEY, 'stored credentials would be decryptable');
  checkKey(problems, 'CONTENT_ENCRYPTION_KEY', DEV_CONTENT_KEY, 'stored client media would be decryptable');
  if (!env.DATABASE_URL) problems.push('DATABASE_URL is unset (refusing the insecure local fallback in production)');
  if (problems.length) {
    throw new Error(`refusing to boot in production with insecure config:\n  - ${problems.join('\n  - ')}`);
  }
  return { provider };
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

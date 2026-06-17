/** M7 — structured logging + error reporting.
 *
 *  One-line JSON to stdout/stderr (parseable by any log shipper), and an
 *  error-reporting hook that forwards to Sentry only when SENTRY_DSN is set —
 *  no SDK dependency, just the Store endpoint over fetch. Everything is redacted
 *  first so tokens, passwords, and credentials never reach the logs or Sentry.
 */
const REDACT = /(authorization|password|token|secret|refresh_?token|credentials?|api[_-]?key|cookie)/i;

/** Deep-redact secret-looking keys; also masks Bearer tokens in free text. */
export function redact(value, depth = 0) {
  if (depth > 6) return '[truncated]';
  if (typeof value === 'string') return value.replace(/Bearer\s+[\w.\-]+/gi, 'Bearer [redacted]');
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = REDACT.test(k) ? '[redacted]' : redact(v, depth + 1);
    return out;
  }
  return value;
}

function emit(level, msg, fields) {
  const line = JSON.stringify({ level, msg, ...redact(fields || {}), at: new Date().toISOString() });
  (level === 'error' || level === 'warn' ? process.stderr : process.stdout).write(line + '\n');
}

export const log = {
  info: (msg, fields) => emit('info', msg, fields),
  warn: (msg, fields) => emit('warn', msg, fields),
  error: (msg, fields) => emit('error', msg, fields),
  /** Append-only security audit trail: one greppable channel (msg:"security")
   *  for login/bootstrap/logout, rate-limit trips, authz denials, retrains.
   *  Fields are redacted like everything else — log identities, never secrets. */
  security: (event, fields) => emit('info', 'security', { event, ...fields }),
};

/** Report an error to Sentry (best-effort, redacted) when configured. Returns a
 *  promise that never rejects — reporting must not take the request down. */
export async function reportError(err, context = {}) {
  const dsn = process.env.SENTRY_DSN;
  log.error(err?.message || String(err), { stack: err?.stack, ...context });
  if (!dsn) return;
  try {
    // DSN: https://<key>@<host>/<projectId>
    const m = dsn.match(/^https:\/\/([^@]+)@([^/]+)\/(\d+)$/);
    if (!m) return;
    const [, key, host, projectId] = m;
    await fetch(`https://${host}/api/${projectId}/store/`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-sentry-auth': `Sentry sentry_version=7, sentry_key=${key}, sentry_client=clipper/1`,
      },
      body: JSON.stringify(redact({
        level: 'error',
        platform: 'node',
        exception: { values: [{ type: err?.name || 'Error', value: err?.message || String(err) }] },
        extra: context,
      })),
    });
  } catch (e) {
    log.warn('sentry report failed', { error: e.message });
  }
}

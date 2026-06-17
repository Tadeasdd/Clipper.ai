/** M7 — a small per-IP rate limiter, same in-memory shape as the login limiter.
 *
 *  Guards the public doors (lead capture, intake) against floods. Generous,
 *  configurable defaults so legitimate bursts — and the smoke suite — never
 *  trip it; set the per-route env to a low number to tighten. A sliding window
 *  over an in-memory map: fine for a single node, and the right primitive to
 *  swap for a shared store (Redis) if the API ever scales horizontally. */
import { log } from './log.js';

const buckets = new Map(); // `${name}:${ip}` → [timestamps]

const clientIp = (req) =>
  (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.ip || req.socket?.remoteAddress || 'unknown';

export function rateLimit({ name, max, windowMs = 60_000 }) {
  return (req, res, next) => {
    const limit = Number(process.env[`RATELIMIT_${name.toUpperCase()}_PER_MIN`] ?? max);
    if (!limit || limit <= 0) return next(); // 0/unset-to-0 disables (opt-out)
    const ip = clientIp(req);
    const key = `${name}:${ip}`;
    const now = Date.now();
    const recent = (buckets.get(key) || []).filter((t) => now - t < windowMs);
    if (recent.length >= limit) {
      log.security('ratelimit.trip', { name, ip, path: req.path, requestId: req.id });
      res.set('Retry-After', String(Math.ceil(windowMs / 1000)));
      return res.status(429).json({ error: 'too many requests — slow down' });
    }
    recent.push(now);
    buckets.set(key, recent);
    next();
  };
}

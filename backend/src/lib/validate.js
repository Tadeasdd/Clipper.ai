/** M7 — a tiny, dependency-free request-body validator.
 *
 *  Replaces ad-hoc per-route checks with one declarative shape. Not a full
 *  schema library (the repo stays minimal) — just the rules the write routes
 *  actually need: type, required, enum, maxLength, and a custom test. Drop-in
 *  replaceable by zod later; the call sites only depend on `validate(schema)`.
 *
 *  Schema: { field: { type, required?, enum?, maxLength?, min?, max?, test?, message? } }
 *  type ∈ 'string' | 'number' | 'boolean' | 'object' | 'array'
 */
export function checkBody(body, schema, { strict = false } = {}) {
  const errors = [];
  const b = body && typeof body === 'object' ? body : {};
  if (strict) {
    const allowed = new Set(Object.keys(schema));
    for (const key of Object.keys(b)) {
      if (!allowed.has(key)) errors.push(`unexpected field: ${key}`);
    }
  }
  for (const [field, rule] of Object.entries(schema)) {
    const v = b[field];
    const present = v !== undefined && v !== null && !(typeof v === 'string' && v.trim() === '');
    if (!present) {
      if (rule.required) errors.push(`${field} is required`);
      continue;
    }
    if (rule.type) {
      const ok = rule.type === 'array' ? Array.isArray(v)
        : rule.type === 'object' ? (typeof v === 'object' && !Array.isArray(v))
        : typeof v === rule.type;
      if (!ok) { errors.push(`${field} must be a ${rule.type}`); continue; }
    }
    if (rule.enum && !rule.enum.includes(v)) errors.push(`${field} must be one of: ${rule.enum.join(', ')}`);
    if (rule.maxLength && typeof v === 'string' && v.length > rule.maxLength) errors.push(`${field} is too long (max ${rule.maxLength})`);
    if (typeof v === 'number') {
      if (rule.min !== undefined && v < rule.min) errors.push(`${field} must be ≥ ${rule.min}`);
      if (rule.max !== undefined && v > rule.max) errors.push(`${field} must be ≤ ${rule.max}`);
    }
    if (rule.test && !rule.test(v)) errors.push(rule.message || `${field} is invalid`);
  }
  return errors;
}

/** Express middleware: 400 with the first failure(s) on a bad body. Rejects
 *  unknown top-level fields by default (S3) — pass { strict: false } to allow
 *  free-form extras (e.g. an opaque meta object on a route that wants them). */
export function validate(schema, { strict = true } = {}) {
  return (req, res, next) => {
    const errors = checkBody(req.body, schema, { strict });
    if (errors.length) return res.status(400).json({ error: errors[0], errors });
    next();
  };
}

/** Clamp user-supplied paging into a hard range so a list endpoint can never be
 *  asked for an unbounded result set. Returns { limit, offset } ready for SQL. */
export function paginate(req, { def = 50, max = 200 } = {}) {
  const n = (v, d) => { const x = Number(v); return Number.isFinite(x) ? x : d; };
  const limit = Math.min(max, Math.max(1, Math.floor(n(req.query?.limit, def))));
  const offset = Math.max(0, Math.floor(n(req.query?.offset, 0)));
  return { limit, offset };
}

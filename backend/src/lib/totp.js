/** C2 — TOTP (RFC 6238) + recovery codes. No new dependency: HMAC-SHA1 and
 *  random bytes come from node:crypto, exactly as the rest of auth does.
 *
 *  A TOTP secret is a random byte string the holder loads into an authenticator
 *  app (via an otpauth:// URI / QR). Both sides derive the same 6-digit code from
 *  (secret, current 30s time-step) using HOTP. We verify with a ±1 step window so
 *  small clock skew doesn't lock anyone out. The secret is the only sensitive
 *  material; the caller stores it AES-GCM-encrypted (lib/crypto.js). */
import { createHmac, randomBytes, timingSafeEqual, createHash } from 'node:crypto';

export const STEP_S = 30;          // RFC 6238 default time-step
export const DIGITS = 6;
const SKEW = 1;                    // accept the previous/next step (±30s)

/* ── base32 (RFC 4648, no padding) — authenticator apps speak base32 ──────── */
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(buf) {
  let bits = 0, value = 0, out = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(str) {
  const clean = str.toUpperCase().replace(/=+$/, '').replace(/\s/g, '');
  let bits = 0, value = 0;
  const out = [];
  for (const ch of clean) {
    const idx = ALPHABET.indexOf(ch);
    if (idx === -1) throw new Error('invalid base32 character');
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** A fresh 20-byte (160-bit) secret, returned base32-encoded for the app. */
export function generateSecret() {
  return base32Encode(randomBytes(20));
}

/* ── HOTP / TOTP ──────────────────────────────────────────────────────────── */
function hotp(secretBuf, counter) {
  const buf = Buffer.alloc(8);
  // counter is < 2^53; write it as a big-endian 64-bit value (high word first).
  buf.writeUInt32BE(Math.floor(counter / 2 ** 32), 0);
  buf.writeUInt32BE(counter >>> 0, 4);
  const hmac = createHmac('sha1', secretBuf).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const bin = ((hmac[offset] & 0x7f) << 24) | (hmac[offset + 1] << 16)
    | (hmac[offset + 2] << 8) | hmac[offset + 3];
  return String(bin % 10 ** DIGITS).padStart(DIGITS, '0');
}

/** The current code for a base32 secret (used to mint codes in tests/local IdP). */
export function totp(base32Secret, atMs = Date.now()) {
  const counter = Math.floor(atMs / 1000 / STEP_S);
  return hotp(base32Decode(base32Secret), counter);
}

/** Constant-time check of a 6-digit code against a ±1-step window. */
export function verifyTotp(base32Secret, code, atMs = Date.now()) {
  const clean = String(code || '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(clean)) return false;
  const secretBuf = base32Decode(base32Secret);
  const counter = Math.floor(atMs / 1000 / STEP_S);
  for (let w = -SKEW; w <= SKEW; w++) {
    const candidate = hotp(secretBuf, counter + w);
    if (timingSafeEqual(Buffer.from(candidate), Buffer.from(clean))) return true;
  }
  return false;
}

/** otpauth:// URI an authenticator app turns into a QR. label/issuer are cosmetic. */
export function otpauthUri(base32Secret, { label, issuer = 'Clipper.ai' }) {
  const params = new URLSearchParams({ secret: base32Secret, issuer, algorithm: 'SHA1', digits: String(DIGITS), period: String(STEP_S) });
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(label)}?${params}`;
}

/* ── recovery codes — single-use backup, stored as sha256(code) ───────────── */
const sha256 = (s) => createHash('sha256').update(s).digest('hex');

/** Returns { plain: string[], hashed: string[] }. Show `plain` once, store `hashed`. */
export function generateRecoveryCodes(n = 10) {
  const plain = Array.from({ length: n }, () => {
    const raw = randomBytes(5).toString('hex'); // 10 hex chars
    return `${raw.slice(0, 5)}-${raw.slice(5)}`; // grouped for readability
  });
  return { plain, hashed: plain.map((c) => sha256(c.replace(/-/g, ''))) };
}

/** Find a matching unused code; returns the remaining hashes (sans the used one)
 *  or null if no match. Caller persists the returned array (single-use spend). */
export function spendRecoveryCode(hashedCodes, code) {
  const target = sha256(String(code || '').replace(/[-\s]/g, '').toLowerCase());
  const list = Array.isArray(hashedCodes) ? hashedCodes : [];
  const idx = list.indexOf(target);
  if (idx === -1) return null;
  return list.filter((_, i) => i !== idx);
}

export { sha256 as hashRecoveryCode };

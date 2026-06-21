/** C2 — password policy. One place the whole auth surface agrees on what a
 *  password must be, so bootstrap, account creation, and self-service change
 *  can't drift apart. Deliberately modest (length + not-trivially-weak) and
 *  env-tunable; the heavy lifting against guessing is the rate limiter + the
 *  persistent account lockout, not arcane composition rules. */
export const PW_MIN = Number(process.env.PASSWORD_MIN_LENGTH || 8);

// A tiny blocklist of the passwords guessers try first. Not a substitute for
// lockout — just refuses the indefensible.
const COMMON = new Set(['password', 'password1', '12345678', '123456789', 'qwertyui', 'letmein1', 'changeme', 'iloveyou']);

/** Returns an error string if the password is unacceptable, or null if it passes. */
export function passwordError(password) {
  const pw = String(password || '');
  if (pw.length < PW_MIN) return `password must be ≥ ${PW_MIN} characters`;
  if (COMMON.has(pw.toLowerCase())) return 'password is too common — choose something less guessable';
  if (/^(.)\1+$/.test(pw)) return 'password cannot be a single repeated character';
  return null;
}

export function isPasswordAcceptable(password) {
  return passwordError(password) === null;
}

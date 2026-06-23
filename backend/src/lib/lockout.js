/** C2 — persistent per-account lockout.
 *
 *  Distinct from the in-memory per-(email+ip) login rate limiter in lib/auth.js:
 *  that one throttles a burst from one origin and forgets after 15 min. This one
 *  is a durable, account-scoped brake — N consecutive failed sign-ins lock the
 *  *account* for a window, surviving restarts and spanning every origin, so a
 *  distributed guessing attack on one account is stopped even though no single IP
 *  trips the rate limiter. A successful sign-in (or recovery) clears the slate. */
import { q } from '../db/index.js';

// Default below the per-(email+ip) rate-limit cap (lib/auth MAX_ATTEMPTS=10) so a
// focused guessing run locks the *account* before the IP throttle masks it — the
// two brakes are complementary, not redundant. Env-tunable.
export const LOCKOUT_THRESHOLD = Number(process.env.ACCOUNT_LOCKOUT_THRESHOLD || 5);
export const LOCKOUT_MINUTES = Number(process.env.ACCOUNT_LOCKOUT_MINUTES || 15);

/** Is this account currently locked? Returns { locked, until } — until is null
 *  when not locked. A lock that has expired reads as not-locked (lazy expiry). */
export function lockState(user) {
  const until = user?.locked_until ? new Date(user.locked_until) : null;
  if (until && until.getTime() > Date.now()) return { locked: true, until };
  return { locked: false, until: null };
}

/** Record a failed attempt; lock the account once the threshold is reached.
 *  Returns the resulting { locked, until }. */
export async function recordFailure(userId) {
  const { rows } = await q(
    `UPDATE users SET failed_attempts = failed_attempts + 1,
       locked_until = CASE WHEN failed_attempts + 1 >= $2
         THEN now() + ($3 || ' minutes')::interval ELSE locked_until END
     WHERE id = $1
     RETURNING failed_attempts, locked_until`,
    [userId, LOCKOUT_THRESHOLD, String(LOCKOUT_MINUTES)]);
  return lockState(rows[0] || {});
}

/** Success (or a spent recovery code) wipes the failure counter + any lock. */
export async function clearFailures(userId) {
  await q('UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE id = $1', [userId]);
}

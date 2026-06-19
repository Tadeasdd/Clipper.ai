/* R3 smoke: timeouts + circuit breaker + bulkhead on external calls.
 *
 *  Fault-injects stub dependencies (no network, no DB) and asserts:
 *    - a hanging call is aborted by the timeout (not forever);
 *    - repeated failures trip the breaker, after which calls fail FAST;
 *    - after the cooldown a healthy call closes the breaker (recovery);
 *    - a bulkhead caps concurrency and rejects the overflow (no exhaustion);
 *    - a transient failure is recovered by bounded retry.
 */
const assert = (cond, msg) => { if (!cond) { console.error('FAIL:', msg); process.exit(1); } console.log('ok:', msg); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { callDependency, resetBreakers, TimeoutError, CircuitOpenError, BulkheadFullError } = await import('../src/lib/resilience.js');
resetBreakers();

// ── 1. timeout: a hanging call is aborted, not left forever ───────────────────
{
  const t0 = Date.now();
  let err;
  try { await callDependency('hang', () => new Promise(() => {}), { timeoutMs: 80, retries: 0, threshold: 99 }); }
  catch (e) { err = e; }
  const elapsed = Date.now() - t0;
  assert(err instanceof TimeoutError, 'a hanging call rejects with TimeoutError');
  assert(elapsed < 1000, `the timeout fires promptly (~${elapsed}ms, not unbounded)`);
}

// ── 2. breaker trips after repeated failures, then fails FAST ────────────────
{
  const boom = () => { throw new Error('dependency down'); };
  for (let i = 0; i < 3; i++) { try { await callDependency('flap', boom, { timeoutMs: 50, retries: 0, threshold: 3, cooldownMs: 400 }); } catch { /* expected */ } }
  const t0 = Date.now();
  let err;
  try { await callDependency('flap', boom, { timeoutMs: 50, retries: 0, threshold: 3, cooldownMs: 400 }); }
  catch (e) { err = e; }
  const elapsed = Date.now() - t0;
  assert(err instanceof CircuitOpenError, 'after the threshold the breaker is open');
  assert(elapsed < 25, `an open breaker fails fast (~${elapsed}ms, no call attempted)`);

  // ── 3. recovery: after the cooldown a healthy call closes the breaker ──────
  await sleep(450);
  const ok1 = await callDependency('flap', () => 'recovered', { timeoutMs: 50, retries: 0, threshold: 3, cooldownMs: 400 });
  const ok2 = await callDependency('flap', () => 'recovered', { timeoutMs: 50, retries: 0, threshold: 3, cooldownMs: 400 });
  assert(ok1 === 'recovered' && ok2 === 'recovered', 'a healthy call after cooldown closes the breaker (recovery)');
}

// ── 4. bulkhead caps concurrency and rejects the overflow ────────────────────
{
  const slow = () => sleep(150).then(() => 'done');
  const results = await Promise.allSettled(
    Array.from({ length: 5 }, () => callDependency('bh', slow, { maxConcurrent: 2, timeoutMs: 1000, retries: 0, threshold: 99 })));
  const ok = results.filter((r) => r.status === 'fulfilled').length;
  const rejected = results.filter((r) => r.status === 'rejected' && r.reason instanceof BulkheadFullError).length;
  assert(ok === 2, `the bulkhead admits exactly maxConcurrent (${ok} of 5)`);
  assert(rejected === 3, `the overflow is rejected fast — no pile-up (${rejected} shed)`);
}

// ── 5. bounded retry recovers a transient failure ───────────────────────────
{
  let calls = 0;
  const flaky = () => { calls++; if (calls === 1) { const e = new Error('transient'); e.status = 503; throw e; } return 'ok'; };
  const out = await callDependency('retry', flaky, { retries: 2, baseMs: 10, timeoutMs: 200, threshold: 99 });
  assert(out === 'ok' && calls === 2, 'a transient (503) failure is recovered by retry');
}

console.log('\nR3 smoke passed: calls time out, the breaker trips + fails fast + recovers, the bulkhead sheds overflow, and transient faults retry.');
process.exit(0);

/** R3 — resilience for outbound calls.
 *
 *  ASR, LLM, publish and metrics APIs fail, hang and rate-limit. The queue
 *  already retries at the JOB level; this adds per-CALL protection so one sick
 *  dependency can't hang a worker or take the system down:
 *
 *    bulkhead( breaker( retry-with-jitter( per-attempt timeout( fn ) ) ) )
 *
 *  - timeout: every attempt is aborted after timeoutMs (AbortController) — no
 *    unbounded hang.
 *  - retry: transient failures (timeout / 429 / 5xx / network) retry a bounded
 *    number of times with exponential backoff + jitter; 4xx never retries.
 *  - circuit breaker: after N consecutive failures the breaker OPENS and calls
 *    fail fast; after a cooldown one half-open trial decides re-open vs close.
 *  - bulkhead: caps concurrent calls per dependency and rejects the overflow,
 *    so a slow dependency can't exhaust the worker pool.
 *
 *  Offline (builtin/local drivers) makes no outbound calls, so none of this is
 *  exercised by default — it guards the live provider paths only.
 */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const envNum = (k, d) => Number(process.env[k] ?? d);

export class TimeoutError extends Error { constructor(name, ms) { super(`${name} timed out after ${ms}ms`); this.name = 'TimeoutError'; this.retryable = true; } }
export class CircuitOpenError extends Error { constructor(name) { super(`${name} circuit open — failing fast`); this.name = 'CircuitOpenError'; } }
export class BulkheadFullError extends Error { constructor(name, max) { super(`${name} bulkhead full (${max} concurrent) — rejecting`); this.name = 'BulkheadFullError'; } }

const STATE_CODE = { closed: 0, open: 1, 'half-open': 2 };
const registry = new Map(); // name → per-dependency breaker + bulkhead state
function dep(name) {
  if (!registry.has(name)) registry.set(name, { state: 'closed', failures: 0, openUntil: 0, trialInFlight: false, inFlight: 0 });
  return registry.get(name);
}
export const breakerStates = () => [...registry.entries()].map(([name, d]) => ({ name, state: d.state, failures: d.failures, inFlight: d.inFlight }));
export const circuitGauge = () => breakerStates().map((s) => ({ labels: { dependency: s.name }, value: STATE_CODE[s.state] }));
export const resetBreakers = () => registry.clear(); // tests only

function isRetryable(err) {
  if (err instanceof BulkheadFullError || err instanceof CircuitOpenError) return false;
  if (err instanceof TimeoutError) return true;
  if (err?.name === 'AbortError') return true;
  if (typeof err?.status === 'number' && (err.status === 429 || err.status >= 500)) return true;
  if (err instanceof TypeError) return true; // fetch network error
  return !!err?.retryable;
}

/** One attempt, aborted after ms even if the work ignores the signal. */
function attempt(name, ms, fn) {
  const ac = new AbortController();
  let timer;
  const timeout = new Promise((_, rej) => { timer = setTimeout(() => { ac.abort(); rej(new TimeoutError(name, ms)); }, ms); });
  return Promise.race([Promise.resolve().then(() => fn(ac.signal)), timeout]).finally(() => clearTimeout(timer));
}

async function withRetry(name, retries, baseMs, fn) {
  let last;
  for (let i = 0; i <= retries; i++) {
    try { return await fn(); }
    catch (e) {
      last = e;
      if (i === retries || !isRetryable(e)) throw e;
      const backoff = Math.min(5000, baseMs * 2 ** i * (0.5 + Math.random())); // exponential + jitter
      await sleep(backoff);
    }
  }
  throw last;
}

async function breakerExec(d, name, o, fn) {
  if (d.state === 'open') {
    if (Date.now() < d.openUntil) throw new CircuitOpenError(name);
    d.state = 'half-open'; d.trialInFlight = false; // cooldown elapsed: allow one trial
  }
  if (d.state === 'half-open') {
    if (d.trialInFlight) throw new CircuitOpenError(name);
    d.trialInFlight = true;
  }
  try {
    const v = await fn();
    d.failures = 0; d.state = 'closed'; d.trialInFlight = false;
    return v;
  } catch (e) {
    d.trialInFlight = false;
    if (e instanceof BulkheadFullError) throw e; // backpressure, not a dependency failure
    d.failures++;
    if (d.state === 'half-open' || d.failures >= o.threshold) { d.state = 'open'; d.openUntil = Date.now() + o.cooldownMs; }
    throw e;
  }
}

function bulkheadExec(d, name, max, fn) {
  if (d.inFlight >= max) return Promise.reject(new BulkheadFullError(name, max));
  d.inFlight++;
  return Promise.resolve().then(fn).finally(() => { d.inFlight--; });
}

/** Run an async fn (it receives an AbortSignal) with the full resilience stack. */
export function callDependency(name, fn, opts = {}) {
  const o = {
    timeoutMs: opts.timeoutMs ?? envNum('DEP_TIMEOUT_MS', 10000),
    retries: opts.retries ?? envNum('DEP_RETRIES', 2),
    baseMs: opts.baseMs ?? 200,
    threshold: opts.threshold ?? envNum('CIRCUIT_THRESHOLD', 5),
    cooldownMs: opts.cooldownMs ?? envNum('CIRCUIT_COOLDOWN_MS', 15000),
    maxConcurrent: opts.maxConcurrent ?? envNum('BULKHEAD_MAX', 8),
  };
  const d = dep(name);
  return breakerExec(d, name, o, () =>
    bulkheadExec(d, name, o.maxConcurrent, () =>
      withRetry(name, o.retries, o.baseMs, () =>
        attempt(name, o.timeoutMs, (signal) => fn(signal)))));
}

/** fetch() with the resilience stack. 429/5xx become retryable errors (so retry
 *  + the breaker see them); other responses (incl. 4xx) are returned for the
 *  caller's own !res.ok handling. */
export function resilientFetch(name, url, init = {}, opts = {}) {
  return callDependency(name, async (signal) => {
    const res = await fetch(url, { ...init, signal });
    if (res.status === 429 || res.status >= 500) { const e = new Error(`${name} upstream HTTP ${res.status}`); e.status = res.status; throw e; }
    return res;
  }, opts);
}

/** R2 — graceful lifecycle: one draining flag + a shutdown orchestration.
 *
 *  A deploy sends SIGTERM. We must (1) tell the load balancer to stop routing
 *  here (/readyz flips false), (2) stop accepting new HTTP, then (3) let the
 *  in-flight pipeline/publish jobs finish before the process exits, so a rolling
 *  restart loses zero work. Liveness (/healthz) stays up the whole time so the
 *  orchestrator doesn't SIGKILL us mid-drain.
 */
import { log } from './log.js';

let draining = false;
export const isDraining = () => draining;
export const beginDraining = () => { draining = true; };

const hooks = []; // async drain functions, run on shutdown (workers finishing in-flight jobs)
export const onShutdown = (fn) => { hooks.push(fn); };

/** Readiness verdict for /readyz: not ready while draining; otherwise ready iff
 *  the dependency ping (a DB SELECT 1) succeeds — so the probe reflects live DB
 *  connectivity. Pure given `ping`, so it's directly testable. */
export async function readiness(ping) {
  if (draining) return { ready: false, reason: 'draining' };
  try { await ping(); return { ready: true, db: true }; }
  catch { return { ready: false, db: false }; }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let shuttingDown = false;
/** Flip readiness, stop new connections, then drain in-flight work (bounded by
 *  timeoutMs). Idempotent — repeated signals are ignored. Does NOT close the DB
 *  pool or exit; the caller does that after this resolves, so drain hooks still
 *  have the pool while they finish. */
export async function gracefulShutdown({ server, timeoutMs = Number(process.env.SHUTDOWN_TIMEOUT_MS || 25000) } = {}) {
  if (shuttingDown) return;
  shuttingDown = true;
  beginDraining();
  log.info('graceful shutdown: draining', { timeoutMs, hooks: hooks.length });

  if (server) await new Promise((res) => server.close(res)); // stop accepting new connections; in-flight requests finish

  const drained = await Promise.race([
    Promise.allSettled(hooks.map((h) => h())).then(() => true),
    sleep(timeoutMs).then(() => false),
  ]);
  log.info(drained ? 'graceful shutdown: drained cleanly' : 'graceful shutdown: drain timed out, exiting anyway', {});
  return drained;
}

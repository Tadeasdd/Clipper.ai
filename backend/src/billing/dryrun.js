/** E4 — the dry-run billing driver (BILLING_DRIVER=dry-run, the default).
 *
 *  The honest offline default: a delivered outcome is recorded and "reported"
 *  with a clearly-labeled synthetic reference — no Stripe, no network, no keys.
 *  It never pretends a real provider interaction happened (the ref is prefixed
 *  `dryrun_`), it just proves the full lifecycle end-to-end so CI and offline
 *  dev stay green. The live driver (stripe.js) swaps in behind the same seam. */
export async function report(row) {
  return { provider: 'dry-run', providerRef: `dryrun_${row.id}` };
}

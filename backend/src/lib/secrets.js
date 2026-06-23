/** C3 — secret-manager seam.
 *
 *  All key material (encryption keys, signing keys) is resolved through here
 *  rather than read straight from process.env, so a deployment can source
 *  secrets from a manager instead of baking them into the environment.
 *
 *  Provider seam (env-switched, like ASR/LLM/storage). The builtin default is
 *  offline and zero-config so CI and local dev need no manager:
 *    env  (default) — read from process.env.
 *    file           — read a JSON object from SECRETS_FILE (a local "vault";
 *                     proves the manager path offline and in CI).
 *  Cloud managers (AWS Secrets Manager, HashiCorp Vault, GCP Secret Manager)
 *  are additive behind this same getSecret()/initSecrets() seam — fetch + cache
 *  in initSecrets() and resolve from the cache in getSecret().
 */
import { readFileSync } from 'node:fs';

let fileCache = null; // parsed SECRETS_FILE, loaded once

function provider() {
  return (process.env.SECRETS_PROVIDER || 'env').toLowerCase();
}

function loadFileSecrets() {
  if (fileCache) return fileCache;
  const path = process.env.SECRETS_FILE;
  if (!path) throw new Error('secrets: SECRETS_PROVIDER=file requires SECRETS_FILE');
  let raw;
  try { raw = readFileSync(path, 'utf8'); }
  catch (e) { throw new Error(`secrets: cannot read SECRETS_FILE (${path}): ${e.message}`); }
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch { throw new Error(`secrets: SECRETS_FILE is not valid JSON (${path})`); }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('secrets: SECRETS_FILE must be a JSON object of name → secret');
  }
  fileCache = parsed;
  return fileCache;
}

/** Resolve a named secret to a string, or undefined if absent/blank.
 *  With the file provider an explicit process.env value still wins, so a local
 *  override (or CI injection) needs no edit to the vault file. */
export function getSecret(name) {
  const fromEnv = process.env[name];
  if (fromEnv != null && fromEnv !== '') return fromEnv;
  if (provider() === 'file') {
    const v = loadFileSecrets()[name];
    if (v != null && v !== '') return String(v);
  }
  return undefined;
}

/** Boot entry: validate the active provider is reachable and pre-load its cache,
 *  so a misconfigured manager fails fast at boot rather than on first use. Sync
 *  for the builtin providers; async so a cloud manager can fetch. Returns the
 *  provider name (for boot logging). */
export async function initSecrets() {
  const p = provider();
  if (p === 'file') loadFileSecrets(); // throws if unreadable/invalid → fail fast
  else if (p !== 'env') throw new Error(`secrets: unknown SECRETS_PROVIDER "${p}" (expected env|file)`);
  return p;
}

/** Test/rotation hook: drop the file cache so a changed SECRETS_FILE re-reads. */
export function resetSecretsCache() { fileCache = null; }

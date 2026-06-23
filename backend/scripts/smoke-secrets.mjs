/** C3 smoke: secret-manager seam + rotatable envelope encryption + boot guard.
 *
 *  Fully offline and in-process — no DB, no network, no external keys. Proves:
 *    · encrypt/decrypt round-trips and stamps the active key id (v2 format)
 *    · a legacy (pre-C3) bare-base64 blob still decrypts
 *    · PUBLISH_TOKEN_KEY rotates WITHOUT downtime: a blob written under the old
 *      key still decrypts once the old key is retired to *_PREVIOUS, and rewrap()
 *      migrates it onto the new active key
 *    · the `file` secrets provider supplies a key with nothing in process.env
 *    · content-at-rest encryption sources its key through the manager
 *    · the production boot guard fails fast on missing/weak keys (both PUBLISH and
 *      CONTENT) and passes with strong keys
 */
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { scryptSync, createCipheriv, randomBytes } from 'node:crypto';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

import {
  encryptJson, decryptJson, rewrap, activeKeyId, resetKeyring, DEV_PUBLISH_KEY,
} from '../src/lib/crypto.js';
import { encryptTransform, decryptTransform, resetContentKey } from '../src/lib/content-crypto.js';
import { resetSecretsCache, getSecret } from '../src/lib/secrets.js';
import { assertProdConfig } from '../src/lib/config.js';

const assert = (cond, msg) => { if (!cond) { console.error('FAIL:', msg); process.exit(1); } console.log('ok:', msg); };

// Reset every memoized key so a changed env takes effect mid-test (what a real
// process never does, but exactly what rotation verification needs).
function reseed(env) {
  for (const k of ['PUBLISH_TOKEN_KEY', 'PUBLISH_TOKEN_KEY_PREVIOUS', 'CONTENT_ENCRYPTION_KEY', 'SECRETS_PROVIDER', 'SECRETS_FILE']) {
    delete process.env[k];
  }
  Object.assign(process.env, env);
  resetSecretsCache(); resetKeyring(); resetContentKey();
}

async function streamThrough(buf, transform) {
  const chunks = [];
  await pipeline(Readable.from([buf]), transform, async function* (src) { for await (const c of src) chunks.push(c); });
  return Buffer.concat(chunks);
}

const KEY_A = 'rotation-key-AAAA-strong-1234567890';
const KEY_B = 'rotation-key-BBBB-strong-0987654321';
const SALT = 'clipper-publish-v1';
const payload = { clientId: 'c-1', clientSecret: 'shh', refreshToken: 'r-9' };

// ── 1. round-trip + key stamping ─────────────────────────────────────────────
reseed({ PUBLISH_TOKEN_KEY: KEY_A });
const blobA = encryptJson(payload);
assert(/^v2:[0-9a-f]{8}:/.test(blobA), `new blob carries the v2:<keyId> stamp (${blobA.slice(0, 14)}…)`);
assert(blobA.startsWith(`v2:${activeKeyId()}:`), 'blob is stamped with the active key id');
assert(JSON.stringify(decryptJson(blobA)) === JSON.stringify(payload), 'round-trips back to the original object');

// ── 2. legacy (pre-C3) bare-base64 blob still decrypts ───────────────────────
const legacyKey = scryptSync(KEY_A, SALT, 32);
const iv = randomBytes(12);
const cipher = createCipheriv('aes-256-gcm', legacyKey, iv);
const ct = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()]);
const legacyBlob = Buffer.concat([iv, cipher.getAuthTag(), ct]).toString('base64');
assert(!legacyBlob.includes(':'), 'legacy blob is bare base64 (no v2 prefix)');
assert(JSON.stringify(decryptJson(legacyBlob)) === JSON.stringify(payload), 'legacy blob still decrypts under the active key');

// ── 3. rotation WITHOUT downtime ─────────────────────────────────────────────
// New active key B, old key A retired to *_PREVIOUS. The A-written blob must
// still decrypt, and new writes must use B.
reseed({ PUBLISH_TOKEN_KEY: KEY_B, PUBLISH_TOKEN_KEY_PREVIOUS: KEY_A });
const idB = activeKeyId();
assert(JSON.stringify(decryptJson(blobA)) === JSON.stringify(payload), 'a blob written under the retired key still decrypts after rotation');
const blobB = encryptJson(payload);
assert(blobB.startsWith(`v2:${idB}:`) && !blobA.startsWith(`v2:${idB}:`), 'new writes are stamped with the new active key id');

// ── 4. rewrap migrates the old blob onto the active key ──────────────────────
const rewrapped = rewrap(blobA);
assert(rewrapped.startsWith(`v2:${idB}:`), 'rewrap() re-stamps an old blob onto the active key');
assert(JSON.stringify(decryptJson(rewrapped)) === JSON.stringify(payload), 'rewrapped blob still decrypts to the original');
assert(rewrap(rewrapped) === rewrapped, 'rewrap() is idempotent on an already-active blob');

// Once the old key is dropped from *_PREVIOUS, the un-migrated A blob is
// unreadable — which is why rewrap must run before retiring a key.
reseed({ PUBLISH_TOKEN_KEY: KEY_B });
let threw = false;
try { decryptJson(blobA); } catch { threw = true; }
assert(threw, 'after PREVIOUS is dropped, a blob still on the old key fails closed (no silent wrong-key decrypt)');
assert(JSON.stringify(decryptJson(rewrap(blobB))) === JSON.stringify(payload), 'blobs already on the active key are unaffected by dropping PREVIOUS');

// ── 5. `file` secrets provider supplies a key with nothing in process.env ────
const dir = mkdtempSync(path.join(tmpdir(), 'clipper-secrets-'));
const vault = path.join(dir, 'secrets.json');
writeFileSync(vault, JSON.stringify({ PUBLISH_TOKEN_KEY: KEY_A }));
try {
  reseed({ SECRETS_PROVIDER: 'file', SECRETS_FILE: vault });
  assert(getSecret('PUBLISH_TOKEN_KEY') === KEY_A, 'file provider resolves a secret from SECRETS_FILE');
  const fromVault = encryptJson(payload);
  assert(JSON.stringify(decryptJson(fromVault)) === JSON.stringify(payload), 'encryption works with the key sourced from the vault file');
} finally {
  rmSync(dir, { recursive: true, force: true });
}

// ── 6. content-at-rest encryption sources its key through the manager ────────
reseed({ CONTENT_ENCRYPTION_KEY: 'content-key-strong-abcdefghijklmnop' });
const media = Buffer.from('the quick brown fox '.repeat(64));
const enc = await streamThrough(media, encryptTransform());
const dec = await streamThrough(enc, decryptTransform());
assert(dec.equals(media), 'content stream round-trips through encrypt→decrypt with the managed key');
reseed({ CONTENT_ENCRYPTION_KEY: 'a-totally-different-content-key-xyz' });
let contentThrew = false;
try { await streamThrough(enc, decryptTransform()); } catch { contentThrew = true; }
assert(contentThrew, 'content encrypted under one key fails to decrypt under another (key is load-bearing)');

// ── 7. production boot guard: fail fast on missing/weak keys ─────────────────
const PROD = { NODE_ENV: 'production', DATABASE_URL: 'postgres://x/y' };
async function bootProblem(env) {
  reseed(env);
  try { await assertProdConfig(PROD); return null; }
  catch (e) { return e.message; }
}
let msg = await bootProblem({}); // no keys at all
assert(msg && /PUBLISH_TOKEN_KEY/.test(msg) && /CONTENT_ENCRYPTION_KEY/.test(msg),
  'prod boot fails fast when both keys are unset');
msg = await bootProblem({ PUBLISH_TOKEN_KEY: 'short', CONTENT_ENCRYPTION_KEY: 'short' });
assert(msg && /too short/.test(msg), 'prod boot fails fast when keys are too short');
msg = await bootProblem({ PUBLISH_TOKEN_KEY: DEV_PUBLISH_KEY, CONTENT_ENCRYPTION_KEY: KEY_A });
assert(msg && /PUBLISH_TOKEN_KEY/.test(msg) && !/CONTENT_ENCRYPTION_KEY/.test(msg),
  'prod boot rejects the dev-default PUBLISH_TOKEN_KEY (and only flags the offender)');
msg = await bootProblem({ PUBLISH_TOKEN_KEY: KEY_A, CONTENT_ENCRYPTION_KEY: KEY_B });
assert(msg === null, 'prod boot passes with strong keys for both domains');

// dev/test never enforces keys (offline dev stays zero-config)
reseed({});
const devOk = await assertProdConfig({ NODE_ENV: 'development' });
assert(devOk && devOk.provider === 'env', 'dev boot resolves the env provider and skips the key checks');

console.log('\nC3 secrets smoke passed: manager seam (env+file), key-stamped envelope encryption, '
  + 'downtime-free rotation with rewrap, content key via manager, and a fail-fast prod boot guard.');
process.exit(0);

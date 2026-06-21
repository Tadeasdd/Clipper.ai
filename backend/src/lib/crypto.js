/** Stage B5 — credentials at rest. C3 — rotatable envelope encryption.
 *
 *  AES-256-GCM over small JSON blobs (publish/metrics credentials, MFA secrets,
 *  OAuth state). The encryption key comes from a keyring (lib/keyring) built from
 *  PUBLISH_TOKEN_KEY (active) + PUBLISH_TOKEN_KEY_PREVIOUS (retired), resolved
 *  through the secret manager (lib/secrets) — so keys rotate without downtime and
 *  without baking plaintext into the environment.
 *
 *  Blob format is self-describing, so rotation is transparent to callers:
 *    v2:<keyId>:<base64(iv|tag|ct)>  — written by this version, key-stamped
 *    <base64(iv|tag|ct)>             — legacy (pre-C3), decrypted with the active
 *                                      key's material; still readable.
 *  base64 never contains ':', so the prefix is an unambiguous format marker.
 *
 *  The dev default exists so local runs are zero-config, but it is NOT a secret:
 *  deployments MUST set PUBLISH_TOKEN_KEY (assertProdConfig enforces it). */
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { getSecret } from './secrets.js';
import { makeKeyring, parsePrevious } from './keyring.js';

export const DEV_PUBLISH_KEY = 'dev-publish-key — set PUBLISH_TOKEN_KEY in production';
const SALT = 'clipper-publish-v1';
const FORMAT = 'v2';

let ring = null; // memoized; built lazily so it sees secrets resolved at boot
function keyring() {
  if (ring) return ring;
  const active = getSecret('PUBLISH_TOKEN_KEY') || DEV_PUBLISH_KEY;
  ring = makeKeyring(SALT, active, parsePrevious(getSecret('PUBLISH_TOKEN_KEY_PREVIOUS')));
  return ring;
}

/** Drop the memoized keyring so a rotated PUBLISH_TOKEN_KEY takes effect. */
export function resetKeyring() { ring = null; }

/** The id of the key new blobs are stamped with (for telemetry / rewrap progress). */
export function activeKeyId() { return keyring().activeId; }

function seal(key, plaintext) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ct]).toString('base64');
}

function open(key, packedB64) {
  const buf = Buffer.from(packedB64, 'base64');
  const iv = buf.subarray(0, 12), tag = buf.subarray(12, 28), ct = buf.subarray(28);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
}

/** object → "v2:<keyId>:base64(iv|tag|ct)" */
export function encryptJson(obj) {
  const k = keyring();
  return `${FORMAT}:${k.activeId}:${seal(k.activeKey, JSON.stringify(obj))}`;
}

export function decryptJson(blob) {
  const k = keyring();
  const s = String(blob);
  if (s.startsWith(`${FORMAT}:`)) {
    const [, keyId, packed] = s.split(':');
    const key = k.keyById(keyId);
    if (!key) throw new Error(`crypto: no key for id ${keyId} (retire it via PUBLISH_TOKEN_KEY_PREVIOUS?)`);
    return JSON.parse(open(key, packed));
  }
  // legacy (pre-C3) blob: no key id → it was written under the active secret.
  return JSON.parse(open(k.activeKey, s));
}

/** Re-encrypt a blob under the active key. Idempotent: a blob already stamped
 *  with the active id is returned unchanged. Used by scripts/rewrap-secrets to
 *  migrate ciphertext off a retired key so PREVIOUS can eventually be dropped. */
export function rewrap(blob) {
  const k = keyring();
  const s = String(blob);
  if (s.startsWith(`${FORMAT}:${k.activeId}:`)) return s;
  return encryptJson(decryptJson(s));
}

/** C3 — rotatable envelope-encryption keyring.
 *
 *  A keyring holds one ACTIVE key (used for new encryption) plus any number of
 *  PREVIOUS keys retained for decryption. Each ciphertext is stamped with the id
 *  of the key that wrote it, so rotating a secret is downtime-free:
 *
 *    1. set the new secret as active, move the old secret into *_PREVIOUS
 *    2. new writes use the new key; existing blobs still decrypt via the old key
 *    3. re-wrap existing blobs to the active key at leisure (scripts/rewrap-secrets)
 *    4. once nothing references the old id, drop it from *_PREVIOUS
 *
 *  Key material is scrypt-derived from the secret with a per-domain salt — the
 *  SAME derivation the pre-rotation code used, so a given secret yields the same
 *  AES key and historical blobs stay readable. The key id is a short stable hash
 *  of (salt, secret); it leaks nothing about the key and needs no separate store.
 */
import { scryptSync, createHash } from 'node:crypto';
import { getSecret } from './secrets.js';

const KEY_BYTES = 32;
const ID_HEX = 8; // 4 bytes of the digest — ample to distinguish a handful of keys

function deriveKey(secret, salt) { return scryptSync(secret, salt, KEY_BYTES); }
function keyIdOf(secret, salt) {
  return createHash('sha256').update(salt).update('\0').update(secret).digest('hex').slice(0, ID_HEX);
}

/** Build a keyring for a domain from its active + previous secrets.
 *  @param {string}   salt     scrypt salt (domain-versioned, e.g. 'clipper-publish-v1')
 *  @param {string}   active   the active secret material (required)
 *  @param {string[]} previous retired secrets still needed for decryption
 *  @returns {{ activeId: string, activeKey: Buffer, keyById: (id:string)=>Buffer|null, ids: ()=>string[] }}
 */
export function makeKeyring(salt, active, previous = []) {
  if (!active) throw new Error(`keyring(${salt}): no active secret`);
  const byId = new Map();
  const register = (secret) => {
    if (!secret) return undefined;
    const kid = keyIdOf(secret, salt);
    if (!byId.has(kid)) byId.set(kid, deriveKey(secret, salt));
    return kid;
  };
  const activeId = register(active);
  for (const p of previous) register(p);
  return {
    activeId,
    activeKey: byId.get(activeId),
    keyById: (kid) => byId.get(kid) || null,
    ids: () => [...byId.keys()],
  };
}

/** Parse a comma-separated list of previous secrets from a single env value. */
export function parsePrevious(raw) {
  return String(raw || '').split(',').map((s) => s.trim()).filter(Boolean);
}

/** Build a keyring straight from named secrets via the manager. A devDefault
 *  keeps offline/dev zero-config (the active secret falls back to it when unset). */
export function keyringFromSecrets({ salt, activeName, previousName, devDefault }) {
  const active = getSecret(activeName) || devDefault;
  const previous = previousName ? parsePrevious(getSecret(previousName)) : [];
  return makeKeyring(salt, active, previous);
}

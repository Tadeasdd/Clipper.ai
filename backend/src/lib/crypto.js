/** Stage B5 — credentials at rest.
 *  AES-256-GCM; the key is derived (scrypt) from PUBLISH_TOKEN_KEY.
 *  Dev default exists so local runs are zero-config, but it is NOT a secret:
 *  deployments MUST set PUBLISH_TOKEN_KEY or stored tokens are decryptable
 *  by anyone with this source. */
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';

const KEY = scryptSync(
  process.env.PUBLISH_TOKEN_KEY || 'dev-publish-key — set PUBLISH_TOKEN_KEY in production',
  'clipper-publish-v1', 32);

/** object → base64(iv | authTag | ciphertext) */
export function encryptJson(obj) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', KEY, iv);
  const ct = Buffer.concat([cipher.update(JSON.stringify(obj), 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ct]).toString('base64');
}

export function decryptJson(blob) {
  const buf = Buffer.from(blob, 'base64');
  const iv = buf.subarray(0, 12), tag = buf.subarray(12, 28), ct = buf.subarray(28);
  const decipher = createDecipheriv('aes-256-gcm', KEY, iv);
  decipher.setAuthTag(tag);
  return JSON.parse(Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8'));
}

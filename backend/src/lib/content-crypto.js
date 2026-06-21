/** C1 — content-at-rest encryption (streaming).
 *
 * Media objects are large binary streams, not the small JSON blobs lib/crypto.js
 * handles, so this is a separate seam: AES-256-GCM applied as a Transform over a
 * stream. Each object is self-describing — a fixed header (magic + version + iv)
 * precedes the ciphertext and a 16-byte GCM tag trails it — so localPathFor can
 * detect an encrypted object and decrypt it, while legacy/plaintext objects (no
 * magic) read straight through. The key is derived (scrypt) from
 * CONTENT_ENCRYPTION_KEY.
 *
 * The dev default below is NOT a secret: any deployment storing real client media
 * MUST set CONTENT_ENCRYPTION_KEY, or stored objects are decryptable by anyone
 * with this source (same contract as lib/crypto.js / PUBLISH_TOKEN_KEY). */
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';
import { Transform } from 'node:stream';

const KEY = scryptSync(
  process.env.CONTENT_ENCRYPTION_KEY || 'dev-content-key — set CONTENT_ENCRYPTION_KEY in production',
  'clipper-content-v1', 32);

// On-disk layout: MAGIC(4) | VERSION(1) | IV(12) | <ciphertext> | TAG(16).
// The GCM auth tag is only known after the cipher finishes and a stream can't
// seek back, so it rides as a fixed-size trailer rather than in the header.
export const MAGIC = Buffer.from('CLP1');     // CLiPper content v1
const VERSION = 1;
export const HEADER_BYTES = MAGIC.length + 1 + 12; // magic + version + iv
const TAG_BYTES = 16;
// GCM ciphertext length == plaintext length, so an encrypted object is exactly
// this many bytes larger than its content: header + trailer tag. Lets callers
// report the LOGICAL content size from the on-disk size without decrypting.
export const OVERHEAD_BYTES = HEADER_BYTES + TAG_BYTES;

/** A Transform that turns a plaintext media stream into an encrypted at-rest one. */
export function encryptTransform() {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', KEY, iv);
  let headerSent = false;
  const header = () => Buffer.concat([MAGIC, Buffer.from([VERSION]), iv]);
  return new Transform({
    transform(chunk, _enc, cb) {
      try {
        if (!headerSent) { headerSent = true; this.push(header()); }
        this.push(cipher.update(chunk));
        cb();
      } catch (e) { cb(e); }
    },
    flush(cb) {
      try {
        if (!headerSent) this.push(header());
        this.push(cipher.final());
        this.push(cipher.getAuthTag()); // 16-byte trailer
        cb();
      } catch (e) { cb(e); }
    },
  });
}

/** True if the first bytes are our magic header — i.e. the object is encrypted. */
export function isEncrypted(headBuf) {
  return Buffer.isBuffer(headBuf) && headBuf.length >= MAGIC.length && headBuf.subarray(0, MAGIC.length).equals(MAGIC);
}

/** A Transform that decrypts an at-rest stream back to plaintext. Buffers the
 *  trailing 16 bytes as the GCM auth tag (it arrives last and must not be fed to
 *  update()). Strips and validates the header. */
export function decryptTransform() {
  let header = Buffer.alloc(0);
  let decipher = null;
  let carry = Buffer.alloc(0); // holds the last <=16 bytes, the candidate tag
  return new Transform({
    transform(chunk, _enc, cb) {
      try {
        if (!decipher) {
          header = Buffer.concat([header, chunk]);
          if (header.length < HEADER_BYTES) return cb();
          if (!isEncrypted(header)) return cb(new Error('content-crypto: missing magic header'));
          const iv = header.subarray(MAGIC.length + 1, MAGIC.length + 1 + 12);
          decipher = createDecipheriv('aes-256-gcm', KEY, iv);
          chunk = header.subarray(HEADER_BYTES);
        }
        // Keep the final TAG_BYTES buffered; everything before is ciphertext.
        const buf = Buffer.concat([carry, chunk]);
        if (buf.length > TAG_BYTES) {
          const ct = buf.subarray(0, buf.length - TAG_BYTES);
          carry = buf.subarray(buf.length - TAG_BYTES);
          this.push(decipher.update(ct));
        } else {
          carry = buf;
        }
        cb();
      } catch (e) { cb(e); }
    },
    flush(cb) {
      try {
        if (!decipher) return cb(new Error('content-crypto: stream too short to decrypt'));
        if (carry.length !== TAG_BYTES) return cb(new Error('content-crypto: truncated auth tag'));
        decipher.setAuthTag(carry);
        this.push(decipher.final()); // throws if the tag fails (tamper / wrong key)
        cb();
      } catch (e) { cb(e); }
    },
  });
}

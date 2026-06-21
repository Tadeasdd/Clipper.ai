import { createWriteStream, createReadStream, statSync, mkdirSync, unlinkSync, openSync, readSync, closeSync } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Transform } from 'node:stream';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { encryptTransform, decryptTransform, isEncrypted, MAGIC, OVERHEAD_BYTES } from '../lib/content-crypto.js';

const ROOT = process.env.STORAGE_DIR || path.resolve('storage');
mkdirSync(ROOT, { recursive: true });

const safe = (name) => name.replace(/[^\w.\-]+/g, '_').slice(0, 120);

export function createUploadTarget(recordingId, filename) {
  const key = `${recordingId}/${safe(filename || 'upload.bin')}`;
  return {
    mode: 'local',
    key,
    // The frontend PUTs the file body straight to this path.
    uploadUrl: `/api/intake/upload/${recordingId}?filename=${encodeURIComponent(safe(filename || 'upload.bin'))}`,
  };
}

export async function saveStream(key, readable) {
  const dest = path.join(ROOT, key);
  mkdirSync(path.dirname(dest), { recursive: true });
  // MAX_UPLOAD_BYTES (0/unset = unlimited) bounds both client uploads and URL
  // fetches — both arrive here. Count the PLAINTEXT bytes as they stream in and
  // fail closed past the cap, leaving no partial object behind. C1: the bytes are
  // then encrypted at rest (encryptTransform) before they hit the disk.
  const max = Number(process.env.MAX_UPLOAD_BYTES || 0);
  let bytes = 0;
  const meter = new Transform({
    transform(chunk, _enc, cb) {
      bytes += chunk.length;
      if (max && bytes > max) {
        return cb(Object.assign(new Error(`upload exceeds MAX_UPLOAD_BYTES (${max} bytes)`),
          { status: 413, code: 'EUPLOADTOOLARGE' }));
      }
      cb(null, chunk);
    },
  });
  try {
    await pipeline(readable, meter, encryptTransform(), createWriteStream(dest));
  } catch (e) {
    try { unlinkSync(dest); } catch { /* nothing to clean up */ }
    throw e;
  }
  // Report the LOGICAL (plaintext) size the meter counted, not the on-disk
  // encrypted size — callers (intake, cost accounting) mean the content size.
  return { key, bytes };
}

// Does this stored object carry the C1 encryption header?
function storedIsEncrypted(fullPath) {
  let fd;
  try {
    fd = openSync(fullPath, 'r');
    const head = Buffer.alloc(MAGIC.length);
    readSync(fd, head, 0, MAGIC.length, 0);
    return isEncrypted(head);
  } catch { return false; }
  finally { if (fd !== undefined) closeSync(fd); }
}

/** Workers read/process media straight off the disk. C1: if the object is
 *  encrypted at rest, decrypt it to a tmp file and hand back that path — callers
 *  (ffmpeg, res.sendFile, readFileSync) read plaintext transparently. Legacy
 *  plaintext objects (no magic header) are returned as-is, so old data still
 *  reads. */
export async function localPathFor(key) {
  const src = path.join(ROOT, key);
  if (!storedIsEncrypted(src)) return src;
  const dec = path.join(tmpdir(), 'clipper-dec-' + safe(key.replace(/[\\/]/g, '_')));
  await pipeline(createReadStream(src), decryptTransform(), createWriteStream(dec));
  return dec;
}

/** Store a worker-produced file (rendered clip) under a key — encrypted at rest. */
export async function putFile(key, srcPath) {
  const dest = path.join(ROOT, key);
  mkdirSync(path.dirname(dest), { recursive: true });
  await pipeline(createReadStream(srcPath), encryptTransform(), createWriteStream(dest));
  return { key, bytes: statSync(srcPath).size }; // logical size = the source (plaintext) size
}

export function objectInfo(key) {
  try {
    const full = path.join(ROOT, key);
    const onDisk = statSync(full).size;
    // Report the logical content size: encrypted objects carry a fixed overhead
    // (header + GCM tag) over their plaintext; legacy plaintext objects don't.
    const bytes = storedIsEncrypted(full) ? onDisk - OVERHEAD_BYTES : onDisk;
    return { key, bytes };
  } catch { return null; }
}

/** C1: hard-delete an object (retention purge / GDPR erasure). Idempotent —
 *  returns false if it was already gone. */
export async function deleteObject(key) {
  try { unlinkSync(path.join(ROOT, key)); return true; }
  catch { return false; }
}

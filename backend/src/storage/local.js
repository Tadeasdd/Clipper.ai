import { createWriteStream, createReadStream, statSync, mkdirSync, unlinkSync } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Transform } from 'node:stream';
import path from 'node:path';

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
  // fetches — both arrive here. Count as we stream and fail closed past the cap,
  // leaving no partial object behind. Read per-call so it's configurable/testable.
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
    await pipeline(readable, meter, createWriteStream(dest));
  } catch (e) {
    try { unlinkSync(dest); } catch { /* nothing to clean up */ }
    throw e;
  }
  return { key, bytes: statSync(dest).size };
}

/** Workers read/process media straight off the disk. */
export async function localPathFor(key) {
  return path.join(ROOT, key);
}

/** Store a worker-produced file (rendered clip) under a key. */
export async function putFile(key, srcPath) {
  const dest = path.join(ROOT, key);
  mkdirSync(path.dirname(dest), { recursive: true });
  await pipeline(createReadStream(srcPath), createWriteStream(dest));
  return { key, bytes: statSync(dest).size };
}

export function objectInfo(key) {
  try { return { key, bytes: statSync(path.join(ROOT, key)).size }; }
  catch { return null; }
}

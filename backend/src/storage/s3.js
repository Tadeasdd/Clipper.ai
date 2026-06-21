/** S3 driver — presigned PUT, client uploads directly. Loaded only when
 *  STORAGE_DRIVER=s3, so local dev needs no AWS SDK config. */
import { S3Client, PutObjectCommand, HeadObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { createWriteStream, createReadStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const BUCKET = process.env.S3_BUCKET;
const s3 = new S3Client({
  region: process.env.S3_REGION,
  ...(process.env.S3_ENDPOINT ? { endpoint: process.env.S3_ENDPOINT, forcePathStyle: true } : {}),
  credentials: process.env.S3_ACCESS_KEY_ID
    ? { accessKeyId: process.env.S3_ACCESS_KEY_ID, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY }
    : undefined,
});

const safe = (name) => name.replace(/[^\w.\-]+/g, '_').slice(0, 120);

export async function createUploadTarget(recordingId, filename) {
  const key = `recordings/${recordingId}/${safe(filename || 'upload.bin')}`;
  // C1: SSE-S3 (AES256) at rest. The signed URL carries the header so the direct
  // client PUT lands encrypted; bucket-default encryption is the belt to this braces.
  const uploadUrl = await getSignedUrl(s3, new PutObjectCommand({ Bucket: BUCKET, Key: key, ServerSideEncryption: 'AES256' }), { expiresIn: 3600 });
  return { mode: 's3', key, uploadUrl };
}

// With presigned S3 the API never receives bytes; this exists for interface parity.
export async function saveStream() {
  throw new Error('saveStream is not used with the s3 driver — clients upload via the presigned URL');
}

/** Download to a tmp path for ffmpeg to work on (workers can't stream-seek S3). */
export async function localPathFor(key) {
  const dest = path.join(tmpdir(), 'clipper-' + key.replace(/[^\w.\-]/g, '_'));
  const obj = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
  await pipeline(obj.Body, createWriteStream(dest));
  return dest;
}

export async function putFile(key, srcPath) {
  await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: createReadStream(srcPath), ServerSideEncryption: 'AES256' }));
  const head = await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
  return { key, bytes: head.ContentLength };
}

/** C1: hard-delete an object (retention purge / GDPR erasure). Idempotent. */
export async function deleteObject(key) {
  try { await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key })); return true; }
  catch { return false; }
}

export async function objectInfo(key) {
  try {
    const head = await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
    return { key, bytes: head.ContentLength };
  } catch { return null; }
}

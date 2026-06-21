/** Stage B2 — object storage behind one interface.
 *
 * STORAGE_DRIVER=local (default): files live under backend/storage/; the API
 *   itself accepts the upload (PUT /api/intake/upload/:id). Zero-config dev.
 * STORAGE_DRIVER=s3: presigned PUT URLs against S3-compatible storage; the
 *   client uploads directly and the API never touches the bytes.
 */
const driver = process.env.STORAGE_DRIVER === 's3'
  ? await import('./s3.js')
  : await import('./local.js');

export const { createUploadTarget, saveStream, objectInfo, localPathFor, putFile, deleteObject } = driver;

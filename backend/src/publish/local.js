/** Stage B5 — the local publish adapter (PUBLISH_DRIVER=local, the default).
 *
 *  "Publishing" here is a real delivery, not a mock: the rendered asset is
 *  copied into a per-platform outbox in object storage with a sidecar
 *  manifest (caption, times, connection handle), and the returned URL serves
 *  the delivered file. It's the same honest offline pattern as the builtin
 *  ASR provider — the full lifecycle runs with zero external credentials,
 *  and the live adapters swap in per-platform without touching the queue. */
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { localPathFor, putFile } from '../storage/index.js';

export async function publish({ job, clip, client, connection }) {
  if (!clip.asset_key) throw new Error('clip has no rendered asset — only rendered clips can publish');
  const src = await localPathFor(clip.asset_key);
  const baseKey = `outbox/${job.platform}/${clip.id}`;
  await putFile(`${baseKey}.mp4`, src);

  const tmp = mkdtempSync(path.join(tmpdir(), 'clipper-pub-'));
  try {
    const manifest = path.join(tmp, 'manifest.json');
    writeFileSync(manifest, JSON.stringify({
      platform: job.platform,
      clientId: client.id,
      handle: connection.handle || null,
      caption: clip.hook || '',
      scheduledAt: job.scheduled_at,
      deliveredAt: new Date().toISOString(),
    }, null, 2));
    await putFile(`${baseKey}.json`, manifest);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }

  return {
    externalId: `local_${job.platform}_${clip.id}`,
    url: `/api/publish/outbox/${job.platform}/${clip.id}.mp4`,
  };
}

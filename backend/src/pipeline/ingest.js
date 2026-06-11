/** Stage 1 — ingest: get the media into storage and learn what it is.
 *  Uploaded files are already in storage; URL submissions are pulled here.
 *  ffprobe fills duration + stream info the rest of the pipeline relies on. */
import { Readable } from 'node:stream';
import { q } from '../db/index.js';
import { saveStream, localPathFor } from '../storage/index.js';
import { probe } from './media.js';

export async function ingest(recordingId) {
  const { rows } = await q('SELECT * FROM recordings WHERE id = $1', [recordingId]);
  if (!rows.length) throw new Error('unknown recording');
  const rec = rows[0];
  await q(`UPDATE recordings SET status = 'processing' WHERE id = $1`, [recordingId]);

  let key = rec.storage_key;
  if (!key && rec.source_url) {
    const res = await fetch(rec.source_url);
    if (!res.ok) throw new Error(`source fetch failed (${res.status})`);
    key = `${recordingId}/source${guessExt(rec.source_url)}`;
    await saveStream(key, Readable.fromWeb(res.body));
    await q('UPDATE recordings SET storage_key = $1 WHERE id = $2', [key, recordingId]);
  }
  if (!key) throw new Error('no media: neither uploaded file nor source_url');

  const info = await probe(await localPathFor(key));
  if (!info.hasAudio) throw new Error('media has no audio stream — nothing to clip');
  if (info.durationS < 5) throw new Error(`media too short (${info.durationS.toFixed(1)}s)`);
  await q('UPDATE recordings SET duration_s = $1, media_info = $2 WHERE id = $3',
    [Math.round(info.durationS), info, recordingId]);
  return { durationS: info.durationS, hasVideo: info.hasVideo };
}

const guessExt = (url) => {
  const m = String(url).match(/\.(mp4|mp3|m4a|wav|mov|mkv|webm|aac|flac)(\?|$)/i);
  return m ? `.${m[1].toLowerCase()}` : '.bin';
};

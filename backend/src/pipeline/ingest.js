/** Stage 1 — ingest: get the media into storage and learn what it is.
 *  Uploaded files are already in storage; URL submissions are pulled here.
 *  Platform URLs (YouTube etc.) are pulled with yt-dlp — a plain fetch of a
 *  watch page returns HTML, not media; direct media URLs fall back to fetch.
 *  ffprobe fills duration + stream info the rest of the pipeline relies on. */
import { Readable } from 'node:stream';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { q } from '../db/index.js';
import { saveStream, localPathFor, putFile } from '../storage/index.js';
import { probe } from './media.js';

export async function ingest(recordingId) {
  const { rows } = await q('SELECT * FROM recordings WHERE id = $1', [recordingId]);
  if (!rows.length) throw new Error('unknown recording');
  const rec = rows[0];
  await q(`UPDATE recordings SET status = 'processing' WHERE id = $1`, [recordingId]);

  let key = rec.storage_key;
  if (!key && rec.source_url) {
    key = isPlatformUrl(rec.source_url)
      ? await pullWithYtDlp(rec.source_url, recordingId)
      : await pullDirect(rec.source_url, recordingId);
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

/** Direct media URL: stream straight into storage (saveStream caps the size). */
async function pullDirect(sourceUrl, recordingId) {
  const res = await fetch(sourceUrl);
  if (!res.ok) throw new Error(`source fetch failed (${res.status})`);
  const key = `${recordingId}/source${guessExt(sourceUrl)}`;
  await saveStream(key, Readable.fromWeb(res.body));
  return key;
}

/** Platform URL: yt-dlp grabs the best audio (or best A/V) into a temp file,
 *  then we store it. --max-filesize mirrors the upload cap so a huge video
 *  can't slip in via a URL; --no-playlist keeps a single submission single. */
async function pullWithYtDlp(sourceUrl, recordingId) {
  const bin = process.env.YTDLP_BIN || 'yt-dlp';
  const max = Number(process.env.MAX_UPLOAD_BYTES || 0);
  const dir = mkdtempSync(path.join(tmpdir(), 'clipper-ytdlp-'));
  try {
    const args = ['-f', 'bestaudio/best', '--no-playlist', '--no-progress',
      '-o', path.join(dir, 'source.%(ext)s')];
    if (max) args.push('--max-filesize', String(max));
    args.push(sourceUrl);
    await runBin(bin, args);

    const file = readdirSync(dir).find((f) => f.startsWith('source.'));
    if (!file) throw new Error('yt-dlp produced no media (format unavailable or over --max-filesize)');
    const key = `${recordingId}/source${path.extname(file) || '.bin'}`;
    await putFile(key, path.join(dir, file));
    return key;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function runBin(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    p.stderr.on('data', (d) => { err += d; });
    p.on('error', (e) => reject(new Error(
      `${cmd} failed to start (${e.message}) — install yt-dlp or set YTDLP_BIN for platform URLs`)));
    p.on('close', (code) => {
      if (code !== 0) return reject(new Error(`${cmd} exited ${code}: ${err.slice(-400)}`));
      resolve();
    });
  });
}

// Hosts where a URL is a page, not a media file — pull these with yt-dlp.
const PLATFORM = /(?:^|\.)(youtube\.com|youtu\.be|tiktok\.com|vimeo\.com|twitch\.tv|dailymotion\.com|facebook\.com|fb\.watch|instagram\.com)$/i;
export function isPlatformUrl(u) {
  try { return PLATFORM.test(new URL(u).hostname); } catch { return false; }
}

const guessExt = (url) => {
  const m = String(url).match(/\.(mp4|mp3|m4a|wav|mov|mkv|webm|aac|flac)(\?|$)/i);
  return m ? `.${m[1].toLowerCase()}` : '.bin';
};

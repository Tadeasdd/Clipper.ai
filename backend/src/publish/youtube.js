/** Stage B5 — YouTube Shorts adapter (PUBLISH_DRIVER=live).
 *  Real calls: refresh the OAuth token, upload the rendered mp4 via the
 *  Data API's videos.insert. Connection credentials (stored encrypted) need:
 *    { clientId, clientSecret, refreshToken }
 *  Vertical ≤3 min uploads are surfaced as Shorts by YouTube automatically;
 *  the #Shorts tag in the title nudges classification. */
import { readFileSync } from 'node:fs';
import { localPathFor } from '../storage/index.js';
import { resilientFetch } from '../lib/resilience.js';

const PUBLISH_TIMEOUT_MS = Number(process.env.PUBLISH_TIMEOUT_MS || 120000);

/** OAuth refresh → short-lived access token. Shared with the B6 metrics
 *  poller, which reads stats for the same channel with the same grant. */
export async function refreshAccessToken({ clientId, clientSecret, refreshToken } = {}) {
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('youtube connection is missing clientId/clientSecret/refreshToken');
  }
  const tokenRes = await resilientFetch('publish', 'https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId, client_secret: clientSecret,
      refresh_token: refreshToken, grant_type: 'refresh_token',
    }),
  }, { timeoutMs: PUBLISH_TIMEOUT_MS });
  if (!tokenRes.ok) throw new Error(`youtube token refresh failed (${tokenRes.status}): ${(await tokenRes.text()).slice(0, 200)}`);
  return (await tokenRes.json()).access_token;
}

export async function publish({ clip, connection }) {
  if (!clip.asset_key) throw new Error('clip has no rendered asset — only rendered clips can publish');
  const { clientId, clientSecret, refreshToken } = connection.credentials || {};
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('youtube connection is missing clientId/clientSecret/refreshToken');
  }

  // 1. refresh token → access token
  const access_token = await refreshAccessToken(connection.credentials);

  // 2. resumable upload (more robust than multipart for non-trivial files):
  //    initiate a session with the metadata, then PUT the bytes to the session
  //    URL. Short-form clips fit one request, so no chunking/retry-offset dance.
  const media = readFileSync(await localPathFor(clip.asset_key));
  const meta = JSON.stringify({
    snippet: { title: `${(clip.hook || 'New clip').slice(0, 90)} #Shorts`, categoryId: '22' },
    status: { privacyStatus: 'public', selfDeclaredMadeForKids: false },
  });
  const initRes = await resilientFetch('publish',
    'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${access_token}`,
        'content-type': 'application/json; charset=utf-8',
        'X-Upload-Content-Type': 'video/mp4',
        'X-Upload-Content-Length': String(media.length),
      },
      body: meta,
    }, { timeoutMs: PUBLISH_TIMEOUT_MS });
  if (!initRes.ok) throw new Error(`youtube resumable init failed (${initRes.status}): ${(await initRes.text()).slice(0, 300)}`);
  const sessionUrl = initRes.headers.get('location');
  if (!sessionUrl) throw new Error('youtube resumable init returned no upload session URL');

  // retries:0 — re-PUTting a resumable session needs offset negotiation we don't
  // do here; the publish queue's job-level retry owns recovery for the upload.
  const upRes = await resilientFetch('publish', sessionUrl, {
    method: 'PUT',
    headers: { authorization: `Bearer ${access_token}`, 'content-type': 'video/mp4', 'content-length': String(media.length) },
    body: media,
  }, { retries: 0, timeoutMs: PUBLISH_TIMEOUT_MS });
  if (!upRes.ok) throw new Error(`youtube upload failed (${upRes.status}): ${(await upRes.text()).slice(0, 300)}`);
  const { id } = await upRes.json();
  return { externalId: id, url: `https://www.youtube.com/shorts/${id}` };
}

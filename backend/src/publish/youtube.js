/** Stage B5 — YouTube Shorts adapter (PUBLISH_DRIVER=live).
 *  Real calls: refresh the OAuth token, upload the rendered mp4 via the
 *  Data API's videos.insert. Connection credentials (stored encrypted) need:
 *    { clientId, clientSecret, refreshToken }
 *  Vertical ≤3 min uploads are surfaced as Shorts by YouTube automatically;
 *  the #Shorts tag in the title nudges classification. */
import { readFileSync } from 'node:fs';
import { localPathFor } from '../storage/index.js';

export async function publish({ clip, connection }) {
  if (!clip.asset_key) throw new Error('clip has no rendered asset — only rendered clips can publish');
  const { clientId, clientSecret, refreshToken } = connection.credentials || {};
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('youtube connection is missing clientId/clientSecret/refreshToken');
  }

  // 1. refresh token → access token
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId, client_secret: clientSecret,
      refresh_token: refreshToken, grant_type: 'refresh_token',
    }),
  });
  if (!tokenRes.ok) throw new Error(`youtube token refresh failed (${tokenRes.status}): ${(await tokenRes.text()).slice(0, 200)}`);
  const { access_token } = await tokenRes.json();

  // 2. multipart upload: snippet + media
  const media = readFileSync(await localPathFor(clip.asset_key));
  const meta = JSON.stringify({
    snippet: { title: `${(clip.hook || 'New clip').slice(0, 90)} #Shorts`, categoryId: '22' },
    status: { privacyStatus: 'public', selfDeclaredMadeForKids: false },
  });
  const boundary = `clipper-${Date.now()}`;
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\ncontent-type: application/json; charset=utf-8\r\n\r\n${meta}\r\n`),
    Buffer.from(`--${boundary}\r\ncontent-type: video/mp4\r\n\r\n`),
    media,
    Buffer.from(`\r\n--${boundary}--`),
  ]);
  const upRes = await fetch(
    'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=multipart&part=snippet,status', {
      method: 'POST',
      headers: { authorization: `Bearer ${access_token}`, 'content-type': `multipart/related; boundary=${boundary}` },
      body,
    });
  if (!upRes.ok) throw new Error(`youtube upload failed (${upRes.status}): ${(await upRes.text()).slice(0, 300)}`);
  const { id } = await upRes.json();
  return { externalId: id, url: `https://www.youtube.com/shorts/${id}` };
}

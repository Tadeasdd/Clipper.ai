/** Stage 2 — transcribe, behind a provider seam (TRANSCRIPTION_PROVIDER).
 *
 *  builtin (default): no external ASR. Stores an honest empty transcript so
 *    downstream stages and the ops board can see ASR is not configured —
 *    the analyze stage works on audio signal alone until a provider is set.
 *  deepgram: real adapter (pre-recorded API). Needs TRANSCRIPTION_API_KEY.
 *    Written to spec; exercise against a live key before relying on it.
 */
import { q } from '../db/index.js';
import { localPathFor } from '../storage/index.js';
import { createReadStream } from 'node:fs';

export async function transcribe(recordingId) {
  const provider = process.env.TRANSCRIPTION_PROVIDER || 'builtin';
  const { rows } = await q('SELECT storage_key FROM recordings WHERE id = $1', [recordingId]);
  const key = rows[0]?.storage_key;
  if (!key) throw new Error('recording has no media');

  const result = provider === 'deepgram'
    ? await deepgram(await localPathFor(key))
    : { words: [], text: null, note: 'no ASR provider configured (TRANSCRIPTION_PROVIDER=builtin)' };

  await q(
    `INSERT INTO transcripts (recording_id, provider, words, text)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (recording_id) DO UPDATE SET provider = $2, words = $3, text = $4`,
    [recordingId, provider, JSON.stringify(result.words || []), result.text]
  );
  return { provider, words: (result.words || []).length };
}

async function deepgram(filePath) {
  const keyEnv = process.env.TRANSCRIPTION_API_KEY;
  if (!keyEnv) throw new Error('TRANSCRIPTION_PROVIDER=deepgram but TRANSCRIPTION_API_KEY is unset');
  const res = await fetch('https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&utterances=true', {
    method: 'POST',
    headers: { Authorization: `Token ${keyEnv}`, 'Content-Type': 'application/octet-stream' },
    body: createReadStream(filePath),
    duplex: 'half',
  });
  if (!res.ok) throw new Error(`deepgram ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const alt = data.results?.channels?.[0]?.alternatives?.[0];
  return {
    text: alt?.transcript || '',
    words: (alt?.words || []).map((w) => ({ w: w.punctuated_word || w.word, s: w.start, e: w.end })),
  };
}

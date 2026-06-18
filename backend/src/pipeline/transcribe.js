/** Stage 2 — transcribe, behind a provider seam (TRANSCRIPTION_PROVIDER).
 *
 *  whisper: offline, no paid key. Shells out to whisper.cpp on a 16 kHz mono
 *    WAV extracted from the recording and returns real word-level timestamps.
 *    This is the default-recommended substrate — zero marginal ASR cost.
 *  deepgram: cloud scale path (pre-recorded API). Needs TRANSCRIPTION_API_KEY.
 *    Written to spec; exercise against a live key before relying on it.
 *  builtin (default): no external ASR. Stores an honest empty transcript so
 *    downstream stages and the ops board can see ASR is not configured, and
 *    logs that the semantic stages (analyze/score/hooks) run degraded — it
 *    never fabricates words it does not have.
 */
import { q } from '../db/index.js';
import { localPathFor } from '../storage/index.js';
import { extractAudioWav } from './media.js';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync, createReadStream } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

export async function transcribe(recordingId) {
  const provider = process.env.TRANSCRIPTION_PROVIDER || 'builtin';
  const { rows } = await q('SELECT storage_key FROM recordings WHERE id = $1', [recordingId]);
  const key = rows[0]?.storage_key;
  if (!key) throw new Error('recording has no media');

  let result;
  if (provider === 'whisper') {
    result = await whisper(await localPathFor(key));
  } else if (provider === 'deepgram') {
    result = await deepgram(await localPathFor(key));
  } else {
    // builtin: no ASR. Store an honest empty transcript and warn — the
    // loudness-only path still works, but every semantic stage is degraded.
    console.warn(
      `[transcribe] recording ${recordingId}: TRANSCRIPTION_PROVIDER=builtin — no ASR words. ` +
      'Semantic stages (analyze/score/hooks) are degraded; set TRANSCRIPTION_PROVIDER=whisper for offline word timestamps.');
    result = { words: [], text: null, note: 'no ASR provider configured (TRANSCRIPTION_PROVIDER=builtin)' };
  }

  // Q2: stamp the ASR provenance — which provider/model produced these words.
  const provenance = {
    provider,
    model: provider === 'whisper' ? (process.env.WHISPER_MODEL || '').split('/').pop() || 'whisper'
      : provider === 'deepgram' ? 'nova-2'
      : null, // builtin: no ASR model
  };
  await q(
    `INSERT INTO transcripts (recording_id, provider, words, text, ai_provenance)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (recording_id) DO UPDATE SET provider = $2, words = $3, text = $4, ai_provenance = $5`,
    [recordingId, provider, JSON.stringify(result.words || []), result.text, JSON.stringify(provenance)]
  );
  return { provider, words: (result.words || []).length };
}

/** whisper.cpp adapter. Extracts a 16 kHz mono WAV, runs the CLI with one
 *  token per segment (`-ml 1`) so each JSON entry is word-grained, and maps
 *  the millisecond offsets into the {w,s,e} shape the schema expects. */
async function whisper(filePath) {
  const bin = process.env.WHISPER_BIN || 'whisper-cli';
  const model = process.env.WHISPER_MODEL;
  if (!model) throw new Error('TRANSCRIPTION_PROVIDER=whisper but WHISPER_MODEL is unset (path to a ggml model file)');

  const work = mkdtempSync(path.join(tmpdir(), 'clipper-asr-'));
  const wav = path.join(work, 'audio.wav');
  const outPrefix = path.join(work, 'out');
  try {
    await extractAudioWav(filePath, wav);
    const args = ['-m', model, '-f', wav, '-ml', '1', '-oj', '-of', outPrefix, '-nt'];
    if (process.env.WHISPER_LANG) args.push('-l', process.env.WHISPER_LANG);
    await runBin(bin, args);

    const data = JSON.parse(readFileSync(`${outPrefix}.json`, 'utf8'));
    const segments = data.transcription || [];
    const words = segments
      .map((seg) => ({
        w: String(seg.text || '').trim(),
        s: Number(seg.offsets?.from || 0) / 1000,
        e: Number(seg.offsets?.to || 0) / 1000,
      }))
      .filter((x) => x.w.length > 0 && Number.isFinite(x.s) && Number.isFinite(x.e));
    const text = words.map((x) => x.w).join(' ').replace(/\s+([.,!?;:])/g, '$1').trim();
    return { words, text: text || null };
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

function runBin(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let err = '';
    p.stderr.on('data', (d) => { err += d; });
    p.on('error', (e) => reject(new Error(
      `${cmd} failed to start (${e.message}) — install whisper.cpp and set WHISPER_BIN`)));
    p.on('close', (code) => {
      if (code !== 0) return reject(new Error(`${cmd} exited ${code}: ${err.slice(-800)}`));
      resolve();
    });
  });
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

/* M1 smoke: offline whisper ASR produces real word-level timestamps.
 *
 *  A short spoken fixture (synthesised offline with whatever TTS is installed —
 *  espeak-ng on Linux/CI, `say` on macOS) goes through the real transcribe and
 *  analyze stages with TRANSCRIPTION_PROVIDER=whisper and NO paid key. We then
 *  assert the transcript is non-empty, that words carry timestamps, and that
 *  those word timestamps land inside the clip windows analyze produced.
 *
 *  This is a fail-closed offline smoke: it needs ffmpeg + Postgres + a TTS and
 *  the whisper.cpp CLI (WHISPER_BIN) with a model (WHISPER_MODEL). When any of
 *  those is absent it prints a loud SKIP and exits 0, so offline CI that has not
 *  installed the binary stays green — it never fakes a transcript to pass.
 *
 *  Run with, e.g.:
 *    TRANSCRIPTION_PROVIDER=whisper WHISPER_MODEL=/opt/whisper/ggml-tiny.en.bin \
 *    npm run smoke:transcribe
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { migrate, q } from '../src/db/index.js';
import { putFile } from '../src/storage/index.js';
import { id } from '../src/lib/ids.js';
import { transcribe } from '../src/pipeline/transcribe.js';
import { analyze } from '../src/pipeline/analyze.js';

const assert = (cond, msg) => { if (!cond) { console.error('FAIL:', msg); process.exit(1); } console.log('ok:', msg); };
const skip = (msg) => { console.log(`SKIP smoke:transcribe — ${msg}`); process.exit(0); };
const has = (cmd) => spawnSync(cmd, ['--help'], { stdio: 'ignore' }).error == null
  || spawnSync('sh', ['-c', `command -v ${cmd}`], { stdio: 'ignore' }).status === 0;

// ── preconditions: this is the offline-but-real ASR path ────────────────────
if ((process.env.TRANSCRIPTION_PROVIDER || 'builtin') !== 'whisper') {
  skip('set TRANSCRIPTION_PROVIDER=whisper to exercise the offline ASR path');
}
if (!process.env.WHISPER_MODEL || !existsSync(process.env.WHISPER_MODEL)) {
  skip('WHISPER_MODEL is unset or not a file (point it at a ggml model)');
}
const whisperBin = process.env.WHISPER_BIN || 'whisper-cli';
if (!has(whisperBin)) skip(`whisper binary "${whisperBin}" not on PATH (install whisper.cpp)`);
if (!has('ffmpeg')) skip('ffmpeg not installed');

// ── build a spoken fixture offline (no network, no paid key) ────────────────
const tmp = mkdtempSync(path.join(tmpdir(), 'clipper-m1-'));
const sample = path.join(tmp, 'speech.mp4');
const LINES = 'Welcome to the show. Today we discuss a genuinely controversial idea. '
  + 'Education changes everything when you least expect it. Here is the surprising part.';

function synthSpeech() {
  // espeak-ng → wav (Linux/CI). `say` → aiff (macOS). Then mux to mp4 via ffmpeg.
  const raw = path.join(tmp, 'tts');
  if (has('espeak-ng') || has('espeak')) {
    const bin = has('espeak-ng') ? 'espeak-ng' : 'espeak';
    const wav = `${raw}.wav`;
    const r = spawnSync(bin, ['-s', '150', '-w', wav, LINES], { stdio: 'pipe' });
    if (r.status !== 0 || !existsSync(wav)) return null;
    return wav;
  }
  if (has('say')) {
    const aiff = `${raw}.aiff`;
    const r = spawnSync('say', ['-o', aiff, LINES], { stdio: 'pipe' });
    if (r.status !== 0 || !existsSync(aiff)) return null;
    return aiff;
  }
  return null;
}

const spoken = synthSpeech();
if (!spoken) { rmSync(tmp, { recursive: true, force: true }); skip('no offline TTS available (espeak-ng or say)'); }

// Pad to a comfortable length so analyze has a signal to window over.
const mux = spawnSync('ffmpeg', ['-hide_banner', '-y', '-i', spoken,
  '-af', 'apad=pad_dur=2', '-t', '30', '-c:a', 'aac', '-b:a', '96k', sample], { stdio: 'pipe' });
if (mux.status !== 0) { rmSync(tmp, { recursive: true, force: true }); skip('ffmpeg could not build the fixture'); }

// ── seed a recording pointing at the stored fixture ─────────────────────────
let recId, cliId;
try {
  await migrate();
  cliId = id('cli');
  await q('INSERT INTO clients (id, name) VALUES ($1, $2)', [cliId, 'M1 Transcribe Co']);
  recId = id('rec');
  const storageKey = `${recId}/speech.mp4`;
  await putFile(storageKey, sample);
  await q(
    `INSERT INTO recordings (id, client_id, storage_key, duration_s, kind, status)
     VALUES ($1, $2, $3, $4, $5, 'processing')`,
    [recId, cliId, storageKey, 30, 'podcast']);

  // ── the actual ASR + analyze run ──────────────────────────────────────────
  const t = await transcribe(recId);
  assert(t.provider === 'whisper', 'transcribe ran the whisper provider');
  assert(t.words > 0, `whisper produced word timestamps (${t.words} words)`);

  const stored = (await q('SELECT text, words FROM transcripts WHERE recording_id = $1', [recId])).rows[0];
  const words = stored.words || [];
  assert(typeof stored.text === 'string' && stored.text.trim().length > 0,
    `transcripts.text is non-empty ("${stored.text.slice(0, 48)}…")`);
  assert(words.length > 0 && words.every((w) => Number.isFinite(w.s) && Number.isFinite(w.e) && w.e >= w.s),
    'every word carries a well-ordered [s,e] timestamp');
  const maxEnd = Math.max(...words.map((w) => w.e));
  assert(maxEnd <= 31, `word timestamps stay within the recording (last word ends ${maxEnd.toFixed(1)}s)`);

  // ── words must land inside the windows analyze produced ────────────────────
  const { moments } = await analyze(recId);
  assert(moments.length > 0, `analyze found candidate windows (${moments.length})`);
  const wordInWindow = (m) => words.some((w) => w.s >= m.start - 0.5 && w.e <= m.end + 0.5);
  assert(moments.every(wordInWindow),
    'every analyze clip window contains real transcribed words (timestamps align)');

  console.log('\nM1 smoke passed: offline whisper ASR → real word timestamps that land in analyze windows.');
} finally {
  if (recId) {
    await q('DELETE FROM transcripts WHERE recording_id = $1', [recId]).catch(() => {});
    await q('DELETE FROM recordings WHERE id = $1', [recId]).catch(() => {});
  }
  if (cliId) await q('DELETE FROM clients WHERE id = $1', [cliId]).catch(() => {});
  rmSync(tmp, { recursive: true, force: true });
  await import('../src/db/index.js').then((m) => m.pool.end()).catch(() => {});
}

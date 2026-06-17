/* Q1 — golden clip-quality eval + CI regression gate.
 *
 *  Runs the REAL analyze+score pipeline over the labelled corpus (backend/eval)
 *  and measures how well it ranks the human-marked good clips: Precision@K,
 *  Recall@K, nDCG, MAP, plus a per-signal contribution breakdown so you can see
 *  WHY quality moved. Compares to a committed baseline and fails (exit 1) on a
 *  regression beyond tolerance.
 *
 *  Offline + deterministic: ffmpeg loudness + the builtin heuristic semantic
 *  pass + default weights on an ISOLATED database (no retrain rows, no smoke
 *  interference). Zero external keys.
 *
 *    npm run eval                 # measure + gate
 *    npm run eval -- --update     # accept the current run as the new baseline
 *    npm run eval -- --prove-gate # show a loudness-only ranking fails the gate
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { DATASET, labelsFor } from '../eval/dataset.mjs';
import { relevanceBitmap, aggregate, regressed, averagePrecision, round } from '../eval/metrics.mjs';

const dir = path.dirname(fileURLToPath(import.meta.url));
const BASELINE_PATH = path.join(dir, '..', 'eval', 'baseline.json');
const UPDATE = process.argv.includes('--update');
const PROVE = process.argv.includes('--prove-gate');
const DEFAULT_TOLERANCE = 0.05;

// ── isolated database so weights are the defaults and nothing else writes here ─
const adminUrl = process.env.DATABASE_URL || 'postgres://clipper:clipper@localhost:5432/clipper';
const TEST_DB = 'clipper_eval';
{
  const admin = new pg.Client({ connectionString: adminUrl });
  await admin.connect();
  await admin.query(`DROP DATABASE IF EXISTS ${TEST_DB} WITH (FORCE)`);
  await admin.query(`CREATE DATABASE ${TEST_DB}`);
  await admin.end();
  const u = new URL(adminUrl); u.pathname = `/${TEST_DB}`;
  process.env.DATABASE_URL = u.toString();
}
const store = mkdtempSync(path.join(tmpdir(), 'clipper-eval-store-'));
process.env.STORAGE_DIR = store;
process.env.TRANSCRIPTION_PROVIDER = 'builtin';
process.env.LLM_PROVIDER = 'builtin'; // heuristic semantic pass — deterministic, offline

// imports AFTER env is set (db pool + storage dir bind at module load)
const { migrate, q, pool } = await import('../src/db/index.js');
const { putFile } = await import('../src/storage/index.js');
const { id } = await import('../src/lib/ids.js');
const { analyze } = await import('../src/pipeline/analyze.js');
const { score } = await import('../src/pipeline/score.js');
const { loadWeights } = await import('../src/metrics/loop.js');
await migrate();

const tmp = mkdtempSync(path.join(tmpdir(), 'clipper-eval-'));
const fail = (m) => { console.error('FAIL:', m); process.exitCode = 1; };

/** Distribute a segment's text into word timestamps across its span. */
function wordsOver(text, [a, b]) {
  const ws = String(text).split(/\s+/).filter(Boolean);
  const step = (b - a) / Math.max(1, ws.length);
  return ws.map((w, i) => ({ w, s: Number((a + i * step).toFixed(2)), e: Number((a + (i + 1) * step).toFixed(2)) }));
}

/** Synthesize the fixture's audio: pink noise with per-segment loudness. */
function synth(rec, out) {
  const vol = `volume='${rec.baseGain}` +
    rec.segments.map((s) => `+${s.gain}*between(t,${s.span[0]},${s.span[1]})`).join('') +
    `':eval=frame`;
  execFileSync('ffmpeg', ['-hide_banner', '-y', '-f', 'lavfi',
    '-i', `anoisesrc=color=pink:duration=${rec.durationS}:amplitude=0.6:seed=7`,
    '-af', vol, '-c:a', 'aac', '-b:a', '96k', out], { stdio: 'pipe' });
}

const perRec = [];
const W = (await loadWeights()).weights;

for (const rec of DATASET) {
  const cli = id('cli');
  await q(`INSERT INTO clients (id, name, plan, cadence) VALUES ($1,$2,'growth','weekly')`, [cli, `Eval ${rec.id}`]);
  const recId = id('rec');
  const key = `${recId}/source.mp4`;
  const audio = path.join(tmp, `${rec.id}.mp4`);
  synth(rec, audio);
  await putFile(key, audio);
  await q(`INSERT INTO recordings (id, client_id, storage_key, duration_s, kind, status)
           VALUES ($1,$2,$3,$4,'podcast','processing')`, [recId, cli, key, rec.durationS]);
  const words = rec.segments.flatMap((s) => wordsOver(s.text, s.span));
  const text = rec.segments.map((s) => s.text).join(' ');
  await q(`INSERT INTO transcripts (recording_id, provider, words, text) VALUES ($1,'eval-injected',$2,$3)`,
    [recId, JSON.stringify(words), text]);

  const payload = await analyze(recId);
  await q(`INSERT INTO pipeline_jobs (id, recording_id, stage, status, payload) VALUES ($1,$2,'analyze','done',$3)`,
    [id('job'), recId, JSON.stringify(payload)]);
  await score(recId);

  const { rows: clips } = await q(
    `SELECT t_start_s, t_end_s, score, signals FROM clips WHERE recording_id = $1 AND status = 'candidate' ORDER BY score DESC`,
    [recId]);
  const labels = labelsFor(rec);
  const rankedSpans = clips.map((c) => [Number(c.t_start_s), Number(c.t_end_s)]);
  perRec.push({ rec, clips, labels, rankedSpans, rel: relevanceBitmap(rankedSpans, labels) });
}

const metrics = aggregate(perRec);

// ── per-signal contribution: mean weighted term over the RELEVANT (good) clips
//    that the pipeline surfaced — shows which signals are carrying the ranking.
const TERMS = {
  energy: (s) => Math.max(0, Math.min(1, (Number(s.energyZ) + 1) / 3)),
  durationFit: (s) => Number(s.durationFit) || 0,
  position: (s) => Number(s.positionBonus) || 0,
  retention: (s) => Number(s.retention) || 0, emotion: (s) => Number(s.emotion) || 0,
  controversy: (s) => Number(s.controversy) || 0, education: (s) => Number(s.education) || 0,
  story: (s) => Number(s.story) || 0, hookStrength: (s) => Number(s.hookStrength) || 0,
};
const relClips = perRec.flatMap((p) => p.clips.filter((_, i) => p.rel[i]));
const contribution = {};
for (const [term, get] of Object.entries(TERMS)) {
  const w = term === 'energy' ? W.energy : term === 'durationFit' ? W.durationFit : term === 'position' ? W.position : (W[term] || 0);
  const vals = relClips.map((c) => w * get(c.signals));
  contribution[term] = round(vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0);
}

// ── report ───────────────────────────────────────────────────────────────────
const baseline = existsSync(BASELINE_PATH) ? JSON.parse(readFileSync(BASELINE_PATH, 'utf8')) : null;
const tolerance = baseline?.tolerance ?? DEFAULT_TOLERANCE;
console.log(`\nClip-quality eval — ${perRec.length} recordings, ${perRec.reduce((a, p) => a + p.labels.length, 0)} labelled good clips\n`);
const KEYS = ['map', 'ndcg', 'precisionAtK', 'recallAtK'];
for (const k of KEYS) {
  const b = baseline?.[k];
  const delta = b == null ? '' : `  (Δ ${(metrics[k] - b >= 0 ? '+' : '')}${round(metrics[k] - b)} vs baseline ${b})`;
  console.log(`  ${k.padEnd(13)} ${metrics[k]}${delta}`);
}
console.log('\n  per-signal contribution to the good clips (weight × mean value):');
Object.entries(contribution).sort((a, b) => b[1] - a[1])
  .forEach(([k, v]) => console.log(`    ${k.padEnd(13)} ${v}`));
console.log('');

// ── --prove-gate: a loudness-only ranking of the SAME candidates scores worse,
//    and would fail the gate — the harness genuinely discriminates quality. ────
if (PROVE) {
  const control = aggregate(perRec.map((p) => {
    const order = p.clips.map((c, i) => i).sort((a, b) => Number(p.clips[b].signals.energyZ) - Number(p.clips[a].signals.energyZ));
    const rankedSpans = order.map((i) => p.rankedSpans[i]);
    return { rankedSpans, labels: p.labels, rel: relevanceBitmap(rankedSpans, p.labels) };
  }));
  console.log(`  --prove-gate: loudness-only control → MAP ${control.map}, nDCG ${control.ndcg} (real MAP ${metrics.map})`);
  const beatsControl = metrics.map > control.map + 0.05;
  const controlWouldFail = baseline ? regressed(control, baseline, tolerance).length > 0 : control.map < metrics.map;
  if (beatsControl && controlWouldFail) {
    console.log('  ✓ the real pipeline beats loudness-only, and the loudness-only ranking would fail the gate.\n');
  } else {
    fail(`prove-gate: expected real to beat control AND control to fail the gate (beats=${beatsControl}, controlFails=${controlWouldFail})`);
  }
}

// ── baseline update / regression gate ─────────────────────────────────────────
if (UPDATE) {
  const next = { ...metrics, tolerance, generatedAt: new Date().toISOString().slice(0, 10) };
  writeFileSync(BASELINE_PATH, JSON.stringify(next, null, 2) + '\n');
  console.log(`baseline updated → ${path.relative(process.cwd(), BASELINE_PATH)}`);
} else if (baseline) {
  const dropped = regressed(metrics, baseline, tolerance);
  if (dropped.length) fail(`quality regressed beyond tolerance ${tolerance} on: ${dropped.join(', ')}`);
  else console.log(`quality holds vs baseline (tolerance ${tolerance}).`);
} else {
  console.log('no baseline yet — run with --update to create one.');
}

await pool.end();
rmSync(tmp, { recursive: true, force: true });
rmSync(store, { recursive: true, force: true });
if (!process.exitCode) console.log('\neval: OK');
process.exit(process.exitCode || 0);

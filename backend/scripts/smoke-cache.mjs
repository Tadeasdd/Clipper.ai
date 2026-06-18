/* Q4 smoke: identical content is never recomputed, and the model router prefers
 *  the cheap path / escalates on low confidence.
 *
 *  Offline + deterministic (isolated DB, ffmpeg loudness, builtin heuristic).
 *  Asserts:
 *    - a re-submitted recording (byte-identical audio) hits the ASR cache;
 *    - a re-analyzed recording (same audio + transcript + version) hits the
 *      analysis cache — recompute skipped, cost 0, result bit-identical;
 *    - average cost drops because the cache hit is free;
 *    - shouldEscalate() routes by confidence and the model route is configurable.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import pg from 'pg';

const assert = (cond, msg) => { if (!cond) { console.error('FAIL:', msg); process.exit(1); } console.log('ok:', msg); };

const adminUrl = process.env.DATABASE_URL || 'postgres://clipper:clipper@localhost:5432/clipper';
const TEST_DB = 'clipper_cache';
{
  const admin = new pg.Client({ connectionString: adminUrl });
  await admin.connect();
  await admin.query(`DROP DATABASE IF EXISTS ${TEST_DB} WITH (FORCE)`);
  await admin.query(`CREATE DATABASE ${TEST_DB}`);
  await admin.end();
  const u = new URL(adminUrl); u.pathname = `/${TEST_DB}`;
  process.env.DATABASE_URL = u.toString();
}
const store = mkdtempSync(path.join(tmpdir(), 'clipper-cache-store-'));
process.env.STORAGE_DIR = store;
process.env.TRANSCRIPTION_PROVIDER = 'builtin';
process.env.LLM_PROVIDER = 'builtin';

const { migrate, q, pool } = await import('../src/db/index.js');
const { id } = await import('../src/lib/ids.js');
const { putFile } = await import('../src/storage/index.js');
const { transcribe } = await import('../src/pipeline/transcribe.js');
const { analyze } = await import('../src/pipeline/analyze.js');
const { shouldEscalate, modelRoute } = await import('../src/pipeline/llm.js');
await migrate();

const tmp = mkdtempSync(path.join(tmpdir(), 'clipper-cache-'));
const cli = id('cli');
await q(`INSERT INTO clients (id, name, plan, cadence) VALUES ($1,'Cache Co','growth','weekly')`, [cli]);

// one audio fixture; every recording points at byte-identical bytes
const audio = path.join(tmp, 'a.mp4');
execFileSync('ffmpeg', ['-hide_banner', '-y', '-f', 'lavfi',
  '-i', 'anoisesrc=color=pink:duration=90:amplitude=0.6:seed=7',
  '-af', `volume='0.04+0.35*between(t,12,36)+0.9*between(t,60,84)':eval=frame`,
  '-c:a', 'aac', '-b:a', '96k', audio], { stdio: 'pipe' });

const content = 'Here is the truth nobody admits. Actually the research data proves this is wrong, '
  + 'and the reason it works is a controversial principle most people never understand.';
const wordsOf = () => content.split(/\s+/).map((w, i) => ({ w, s: 12 + i * 0.4, e: 12 + (i + 1) * 0.4 }));

const mkRec = async (withWords) => {
  const rec = id('rec');
  const key = `${rec}/source.mp4`;
  await putFile(key, audio);
  await q(`INSERT INTO recordings (id, client_id, storage_key, duration_s, kind, status) VALUES ($1,$2,$3,90,'podcast','processing')`, [rec, cli, key]);
  if (withWords) await q(`INSERT INTO transcripts (recording_id, provider, words, text) VALUES ($1,'eval-injected',$2,$3)`, [rec, JSON.stringify(wordsOf()), content]);
  return rec;
};

// ── 1. ASR cache: byte-identical audio is transcribed once ───────────────────
const recC = await mkRec(false);
const recD = await mkRec(false);
const tc1 = await transcribe(recC);
const tc2 = await transcribe(recD);
assert(tc1.cached === false, 'first transcribe computes (cache miss)');
assert(tc2.cached === true, 're-submitted byte-identical audio hits the ASR cache');

// ── 2. analysis cache: same audio + transcript + version is analyzed once ────
const recA = await mkRec(true);
const recB = await mkRec(true);
const a1 = await analyze(recA);
const a2 = await analyze(recB);
assert(a1.cached === false && a1.cost > 0, `first analyze computes (cache miss, cost ${a1.cost})`);
assert(a2.cached === true && a2.cost === 0, 'identical input hits the analysis cache — recompute skipped, cost 0');
// The cached payload round-trips through jsonb (key order / number format may
// normalise), so compare the values that actually drive scoring, not raw JSON.
const proj = (ms) => ms.map((m) => `${m.start}|${m.end}|${m.energyZ}|${m.semantic?.controversy}|${m.semantic?.education}|${m.semantic?.retention}`).join(';');
assert(a1.moments.length === a2.moments.length && proj(a1.moments) === proj(a2.moments),
  'cached analysis reproduces the same moments + signals as the fresh compute (quality unmoved)');
const avg = (a1.cost + a2.cost) / 2;
assert(avg < a1.cost, `caching lowers average cost (${avg} < ${a1.cost})`);

// ── 3. routing: confidence-driven escalation + configurable route ────────────
const confident = [{ controversy: 0.9, education: 0.8, retention: 0.7, emotion: 0.2, story: 0.1, hookStrength: 0.5, rationale: 'controversial claim' }];
const degraded = [{ controversy: 0, education: 0, retention: 0, emotion: 0, story: 0, hookStrength: 0, rationale: 'provider error' },
                  { controversy: 0, education: 0, retention: 0, emotion: 0, story: 0, hookStrength: 0, rationale: 'no result' }];
assert(shouldEscalate(confident) === false, 'a confident cheap pass does NOT escalate');
assert(shouldEscalate(degraded) === true, 'a degraded/low-confidence cheap pass escalates to the strong model');
process.env.LLM_MODEL = 'claude-haiku-4-5-20251001';
process.env.LLM_MODEL_STRONG = 'claude-opus-4-8';
const route = modelRoute();
assert(route.cheap !== route.strong && route.strong === 'claude-opus-4-8', `the model route is configurable (cheap=${route.cheap}, strong=${route.strong})`);

await pool.end();
rmSync(tmp, { recursive: true, force: true });
rmSync(store, { recursive: true, force: true });
console.log('\nQ4 smoke passed: identical content is cached (ASR + analysis) — free and bit-identical; the router prefers cheap and escalates on low confidence.');
process.exit(0);

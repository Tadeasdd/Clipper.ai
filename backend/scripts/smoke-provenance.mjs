/* Q2 smoke: every AI artifact carries reproducible provenance, prompts are
 *  versioned + hashed, and the version selector is wired for A/B.
 *
 *  Offline + deterministic (isolated DB, ffmpeg loudness, builtin heuristic).
 *  Asserts:
 *    - a transcript carries ASR provenance (provider/model);
 *    - a scored clip carries semantic provenance (provider, prompt version+hash, model);
 *    - the registry has distinct version hashes (v1 ≠ v2);
 *    - the version selector flows into provenance (anthropic+v2 → v2 metadata),
 *      proven WITHOUT a key (semanticProvenance is pure);
 *    - replays are deterministic (same inputs → same provenance hash + signals).
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import pg from 'pg';

const assert = (cond, msg) => { if (!cond) { console.error('FAIL:', msg); process.exit(1); } console.log('ok:', msg); };

// ── isolated database ────────────────────────────────────────────────────────
const adminUrl = process.env.DATABASE_URL || 'postgres://clipper:clipper@localhost:5432/clipper';
const TEST_DB = 'clipper_provenance';
{
  const admin = new pg.Client({ connectionString: adminUrl });
  await admin.connect();
  await admin.query(`DROP DATABASE IF EXISTS ${TEST_DB} WITH (FORCE)`);
  await admin.query(`CREATE DATABASE ${TEST_DB}`);
  await admin.end();
  const u = new URL(adminUrl); u.pathname = `/${TEST_DB}`;
  process.env.DATABASE_URL = u.toString();
}
const store = mkdtempSync(path.join(tmpdir(), 'clipper-prov-store-'));
process.env.STORAGE_DIR = store;
process.env.TRANSCRIPTION_PROVIDER = 'builtin';
process.env.LLM_PROVIDER = 'builtin';

const { migrate, q, pool } = await import('../src/db/index.js');
const { putFile } = await import('../src/storage/index.js');
const { id } = await import('../src/lib/ids.js');
const { transcribe } = await import('../src/pipeline/transcribe.js');
const { analyze } = await import('../src/pipeline/analyze.js');
const { score } = await import('../src/pipeline/score.js');
const { semanticProvenance } = await import('../src/pipeline/llm.js');
const { getPrompt } = await import('../prompts/registry.js');
await migrate();

const tmp = mkdtempSync(path.join(tmpdir(), 'clipper-prov-'));
const cli = id('cli');
await q(`INSERT INTO clients (id, name, plan, cadence) VALUES ($1,'Provenance Co','growth','weekly')`, [cli]);
const recId = id('rec');
const key = `${recId}/source.mp4`;
const audio = path.join(tmp, 'a.mp4');
execFileSync('ffmpeg', ['-hide_banner', '-y', '-f', 'lavfi',
  '-i', 'anoisesrc=color=pink:duration=90:amplitude=0.6:seed=7',
  '-af', `volume='0.04+0.35*between(t,12,36)+0.9*between(t,60,84)':eval=frame`,
  '-c:a', 'aac', '-b:a', '96k', audio], { stdio: 'pipe' });
await putFile(key, audio);
await q(`INSERT INTO recordings (id, client_id, storage_key, duration_s, kind, status)
         VALUES ($1,$2,$3,90,'podcast','processing')`, [recId, cli, key]);

// ── 1. transcribe (builtin) stamps ASR provenance ───────────────────────────
await transcribe(recId);
let t = (await q('SELECT ai_provenance FROM transcripts WHERE recording_id = $1', [recId])).rows[0];
assert(t.ai_provenance && t.ai_provenance.provider === 'builtin' && t.ai_provenance.model === null,
  `transcript carries ASR provenance (${JSON.stringify(t.ai_provenance)})`);

// inject a content transcript so the semantic pass runs (heuristic, offline)
const content = 'Here is the truth nobody admits. Actually the research data proves this is wrong, '
  + 'and the reason it works is a controversial principle most people never understand.';
const ws = content.split(/\s+/).map((w, i) => ({ w, s: 12 + i * 0.5, e: 12 + (i + 1) * 0.5 }));
await q(`UPDATE transcripts SET words = $2, text = $3 WHERE recording_id = $1`, [recId, JSON.stringify(ws), content]);

// ── 2. a scored clip carries semantic provenance ─────────────────────────────
const payload = await analyze(recId);
await q(`INSERT INTO pipeline_jobs (id, recording_id, stage, status, payload) VALUES ($1,$2,'analyze','done',$3)`,
  [id('job'), recId, JSON.stringify(payload)]);
await score(recId);
const clip = (await q(`SELECT ai_provenance, signals FROM clips WHERE recording_id = $1 ORDER BY score DESC LIMIT 1`, [recId])).rows[0];
const prov = clip.ai_provenance;
assert(prov && prov.provider === 'builtin' && prov.model === 'heuristic' && prov.promptVersion === 'v1' && /^[0-9a-f]{16}$/.test(prov.promptHash || ''),
  `scored clip carries semantic provenance (${JSON.stringify(prov)})`);

// ── 3. the registry versions prompts with distinct hashes ────────────────────
const h1 = getPrompt('semantic-signals', 'v1').hash;
const h2 = getPrompt('semantic-signals', 'v2').hash;
assert(/^[0-9a-f]{16}$/.test(h1) && /^[0-9a-f]{16}$/.test(h2) && h1 !== h2,
  `prompt registry versions are distinct (v1 ${h1} ≠ v2 ${h2})`);

// ── 4. the version selector flows into provenance (no key needed) ────────────
process.env.LLM_PROVIDER = 'anthropic';
process.env.LLM_PROMPT_VERSION = 'v2';
const ab = semanticProvenance();
assert(ab.provider === 'anthropic' && ab.promptVersion === 'v2' && ab.promptHash === h2
  && ab.params.temperature === 0 && ab.model,
  `selecting prompt v2 stamps v2 provenance + deterministic params (${JSON.stringify(ab)})`);
process.env.LLM_PROVIDER = 'builtin';
delete process.env.LLM_PROMPT_VERSION;

// ── 5. replays are deterministic: same inputs → same provenance + signals ────
const p2 = await analyze(recId);
assert(JSON.stringify(p2.provenance) === JSON.stringify(payload.provenance),
  'replay: identical provenance for identical inputs/version');
assert(JSON.stringify(p2.moments[0].semantic) === JSON.stringify(payload.moments[0].semantic),
  'replay: identical semantic signals (deterministic offline)');

await pool.end();
rmSync(tmp, { recursive: true, force: true });
rmSync(store, { recursive: true, force: true });
console.log('\nQ2 smoke passed: AI artifacts carry versioned, reproducible provenance; prompts are versioned + hashed; the A/B selector is wired.');
process.exit(0);

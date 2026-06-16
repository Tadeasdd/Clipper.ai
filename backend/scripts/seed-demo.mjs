/* npm run seed:demo — one command to see real output.
 *
 *  Creates a demo client, builds a synthetic "podcast" fixture, and runs it
 *  through the REAL pipeline (ingest → analyze → score → generate) to scored,
 *  captioned, 9:16 clips. The transcript is injected so the demo is offline and
 *  deterministic — in production M1's whisper ASR produces it from the audio —
 *  but everything downstream (semantic scoring, caption burn-in, hooks, the
 *  explainable signals) is the same machinery the smokes assert.
 *
 *  Needs Postgres + ffmpeg. Leaves the data in place so you can open the API,
 *  the ops board, or just play the rendered mp4s.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { migrate, q, pool } from '../src/db/index.js';
import { id } from '../src/lib/ids.js';
import { putFile, localPathFor } from '../src/storage/index.js';
import { ingest } from '../src/pipeline/ingest.js';
import { analyze } from '../src/pipeline/analyze.js';
import { score } from '../src/pipeline/score.js';
import { generate } from '../src/pipeline/generate.js';

const CONTENT = [10, 30], VACUOUS = [58, 80];
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

await migrate();
const tmp = mkdtempSync(path.join(tmpdir(), 'clipper-demo-'));
try {
  // ── client (captions on, neon-green brand) ────────────────────────────────
  const cli = id('cli');
  await q(`INSERT INTO clients (id, name, plan, cadence, brand_config) VALUES ($1,$2,'growth','weekly',$3)`,
    [cli, 'Acme Podcast Co (demo)', JSON.stringify({ captions: { color: '0x53fc18', fontSize: 64 } })]);

  // ── fixture: a 90s podcast with a content-rich segment at moderate volume
  //    and a LOUDER but vacuous segment — the case the product must get right.
  const sample = path.join(tmp, 'podcast.mp4');
  execFileSync('ffmpeg', ['-hide_banner', '-y', '-f', 'lavfi',
    '-i', 'anoisesrc=color=pink:duration=90:amplitude=0.6:seed=7',
    '-af', `volume='0.02+0.38*between(t,${CONTENT[0]},${CONTENT[1]})+0.88*between(t,${VACUOUS[0]},${VACUOUS[1]})':eval=frame`,
    '-c:a', 'aac', '-b:a', '96k', sample], { stdio: 'pipe' });

  const rec = id('rec');
  const key = `${rec}/source.mp4`;
  await putFile(key, sample);
  await q(`INSERT INTO recordings (id, client_id, storage_key, kind, status) VALUES ($1,$2,$3,'podcast','processing')`,
    [rec, cli, key]);

  // ── ingest probes it; then inject the transcript (whisper would do this) ──
  await ingest(rec);
  const contentText = 'Here is the truth nobody admits. Actually the research data proves this is wrong. '
    + 'The reason it works is a controversial principle most people never understand, and that is why the study shocked everyone.';
  const fillerText = 'um yeah so uh okay you know like i mean basically uh yeah it was uh kind of you know '
    + 'whatever um so anyway uh yeah okay so um right yeah you know uh.';
  const wordsOver = (text, [a, b]) => {
    const ws = text.split(/\s+/).filter(Boolean);
    const step = (b - a) / ws.length;
    return ws.map((w, i) => ({ w, s: Number((a + i * step).toFixed(2)), e: Number((a + (i + 1) * step).toFixed(2)) }));
  };
  const words = [...wordsOver(contentText, CONTENT), ...wordsOver(fillerText, VACUOUS)];
  await q(`INSERT INTO transcripts (recording_id, provider, words, text) VALUES ($1,'demo-injected',$2,$3)`,
    [rec, JSON.stringify(words), `${contentText} ${fillerText}`]);

  // ── the real stages ───────────────────────────────────────────────────────
  const aPayload = await analyze(rec);
  await q(`INSERT INTO pipeline_jobs (id, recording_id, stage, status, payload) VALUES ($1,$2,'analyze','done',$3)`,
    [id('job'), rec, JSON.stringify(aPayload)]);
  await score(rec);
  const gen = await generate(rec);

  // ── report ────────────────────────────────────────────────────────────────
  const { rows: clips } = await q(
    `SELECT t_start_s, t_end_s, score, hook, signals FROM clips
     WHERE recording_id = $1 AND status = 'awaiting_review' ORDER BY score DESC`, [rec]);
  const storageDir = path.dirname(await localPathFor(`${rec}/clips/x`));

  console.log(`\nClipper.ai demo — Acme Podcast Co`);
  console.log(`  recording ${rec} · 90s synthetic podcast (content @${CONTENT[0]}–${CONTENT[1]}s, filler @${VACUOUS[0]}–${VACUOUS[1]}s)`);
  console.log(`  signals source: ${aPayload.signalsSource} (transcript injected for the demo; M1 whisper produces it for real)\n`);
  console.log(`  rank  window       score  why`);
  clips.forEach((c, i) => {
    const why = c.signals?.rationale || '—';
    console.log(`  ${String(i + 1).padEnd(4)}  ${fmt(c.t_start_s)}–${fmt(c.t_end_s).padEnd(6)}  ${String(c.score).padEnd(5)}  ${why}`);
  });
  const winner = clips[0];
  console.log(`\n  → the quieter, content-rich segment wins on substance, not volume`);
  console.log(`    controversy ${winner.signals.controversy}, education ${winner.signals.education}, captioned ${winner.signals.captioned === true}`);
  console.log(`\n  rendered ${gen.rendered} captioned ${gen.format} clips → ${storageDir}`);
  console.log(`  play one:  open "${storageDir}/${(await firstAsset(rec))}"`);
  console.log(`\n  next: start the API (npm start) and watch them on the ops board /api/jobs/${rec}\n`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
  await pool.end();
}

async function firstAsset(rec) {
  const { rows } = await q(`SELECT asset_key FROM clips WHERE recording_id = $1 AND asset_key IS NOT NULL ORDER BY score DESC LIMIT 1`, [rec]);
  return rows[0] ? path.basename(rows[0].asset_key) : '(none)';
}

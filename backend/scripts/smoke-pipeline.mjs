/* B3 end-to-end smoke: a synthetic 3-minute "podcast" with engineered loud
   segments goes through intake → ingest → transcribe → analyze → score →
   generate, and we assert real 9:16 mp4 clips exist whose timestamps overlap
   the loud segments we planted. Needs ffmpeg + Postgres + the API w/ workers.

   The audio: quiet noise bed with three louder "heated discussion" bursts at
   30–55s, 90–120s, and 150–170s. analyze should find exactly those regions. */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const BASE = process.env.BASE || 'http://localhost:8080';
const BURSTS = [[30, 55], [90, 120], [150, 170]];

const j = async (method, p, body, raw) => {
  const res = await fetch(BASE + p, {
    method,
    headers: raw ? { 'content-type': 'video/mp4' } : { 'content-type': 'application/json' },
    body: raw ? body : body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json().catch(() => ({})) };
};
const assert = (cond, msg) => { if (!cond) { console.error('FAIL:', msg); process.exit(1); } console.log('ok:', msg); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── build the synthetic podcast (audio-only mp4, 180 s) ─────────────────────
const tmp = mkdtempSync(path.join(tmpdir(), 'clipper-b3-'));
const sample = path.join(tmp, 'podcast.mp4');
const loudExpr = BURSTS.map(([a, b]) => `between(t,${a},${b})`).join('+');
execFileSync('ffmpeg', ['-hide_banner', '-y',
  '-f', 'lavfi', '-i', 'anoisesrc=color=pink:duration=180:amplitude=0.6:seed=42',
  '-af', `volume='0.02+0.9*(${loudExpr})':eval=frame`,
  '-c:a', 'aac', '-b:a', '96k', sample], { stdio: 'pipe' });
const sampleBytes = statSync(sample).size;
console.log(`sample podcast built: 180s, ${(sampleBytes / 1024).toFixed(0)} KB, bursts at ${BURSTS.map((b) => b.join('–')).join(', ')}s`);

// ── intake + upload ──────────────────────────────────────────────────────────
let r = await j('POST', '/api/clients', { name: 'B3 Pipeline Co' });
const cli = r.data.id;
r = await j('POST', '/api/intake', { clientId: cli, filename: 'podcast.mp4', kind: 'podcast' });
assert(r.status === 201 && r.data.upload, 'intake created with upload target');
const rec = r.data.recordingId;
r = await j('PUT', r.data.upload.uploadUrl, readFileSync(sample), true);
assert(r.status === 200 && r.data.status === 'queued', 'upload accepted, pipeline armed');

// ── poll the ops board until the pipeline finishes ──────────────────────────
let detail, deadline = Date.now() + 150_000;
for (;;) {
  await sleep(2000);
  detail = (await j('GET', `/api/jobs/${rec}`)).data;
  const line = (detail.stages || []).map((s) => `${s.stage}:${s.status}`).join(' ');
  process.stdout.write(`  board → ${detail.status} | ${line}\n`);
  if (detail.status === 'ready' || detail.status === 'failed') break;
  if (Date.now() > deadline) { console.error('FAIL: pipeline timed out'); process.exit(1); }
}
assert(detail.status === 'ready', 'recording reached ready');
assert(detail.stages.length === 5 && detail.stages.every((s) => s.status === 'done'),
  'all five stages done on the board');
assert(detail.duration_s >= 178 && detail.duration_s <= 182, `ingest probed duration (${detail.duration_s}s)`);
const analyze = detail.stages.find((s) => s.stage === 'analyze');
console.log(`  analyze baseline: ${JSON.stringify(analyze.payload.baseline)}, moments: ${analyze.payload.moments.length}`);

// ── clips: scored candidates + rendered assets ───────────────────────────────
r = await j('GET', `/api/clips?recordingId=${rec}`);
const clips = r.data.clips;
assert(clips.length >= 3, `clips created (${clips.length})`);
const rendered = clips.filter((c) => c.status === 'awaiting_review' && c.asset_key);
assert(rendered.length >= 3, `rendered to awaiting_review (${rendered.length})`);
assert(rendered.every((c) => c.score >= 0 && c.score <= 100 && c.signals?.energyZ !== undefined),
  'every clip carries a score and energy evidence');

// every rendered clip must overlap a planted loud burst — the signal is real
const overlaps = ([s, e], [a, b]) => Math.min(e, b) - Math.max(s, a) > 2;
for (const c of rendered) {
  const span = [Number(c.t_start_s), Number(c.t_end_s)];
  assert(BURSTS.some((b) => overlaps(span, b)),
    `clip ${span[0]}–${span[1]}s overlaps a planted loud segment`);
}

// the asset is a real playable mp4 of the right duration
const top = rendered[0];
const det = (await j('GET', `/api/intake/${rec}`)).data;
assert(det.stored?.bytes > 0, 'source still in object storage');
const clipRes = await j('GET', `/api/clips?recordingId=${rec}&status=awaiting_review`);
assert(clipRes.data.clips[0].format === '9:16', 'clip format is 9:16');

// editors can adjust the hook (B4 prep)
r = await j('PATCH', `/api/clips/${top.id}`, { hook: 'The moment the room got loud' });
assert(r.status === 200 && r.data.hook === 'The moment the room got loud', 'PATCH updates the hook');

// retry endpoint: nothing failed, so it must refuse
r = await j('POST', `/api/jobs/${rec}/retry`);
assert(r.status === 409, 'retry refuses when nothing failed');

// ── the asset endpoint serves a real playable mp4 ───────────────────────────
const assetRes = await fetch(`${BASE}/api/clips/${top.id}/asset`);
assert(assetRes.status === 200 && assetRes.headers.get('content-type')?.includes('video/mp4'), 'asset endpoint serves video/mp4');
const bytes = Buffer.from(await assetRes.arrayBuffer());
const assetPath = path.join(tmp, 'served.mp4');
await import('node:fs').then((fs) => fs.writeFileSync(assetPath, bytes));
const probed = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_format', assetPath]));
const clipDur = Number(top.t_end_s) - Number(top.t_start_s);
assert(Math.abs(Number(probed.format.duration) - clipDur) < 2,
  `served asset is a playable mp4 of the right length (${Number(probed.format.duration).toFixed(1)}s ≈ ${clipDur.toFixed(1)}s)`);

// ── failure path: bad source URL → 3 attempts → parked failed → retry ───────
r = await j('POST', '/api/intake', { clientId: cli, sourceUrl: 'http://127.0.0.1:9/unreachable.mp3', kind: 'podcast' });
const badRec = r.data.recordingId;
deadline = Date.now() + 60_000;
let bad;
for (;;) {
  await sleep(2000);
  bad = (await j('GET', `/api/jobs/${badRec}`)).data;
  const ing = (bad.stages || []).find((x) => x.stage === 'ingest');
  if (bad.status === 'failed' && ing?.status === 'failed') break;
  if (Date.now() > deadline) { console.error('FAIL: bad recording never parked as failed'); process.exit(1); }
}
const ingStage = bad.stages.find((x) => x.stage === 'ingest');
assert(ingStage.attempts === 3 && /fetch/i.test(ingStage.error || ''),
  `ingest parked after 3 attempts with the real error on the board ("${(ingStage.error || '').slice(0, 40)}…")`);
r = await j('POST', `/api/jobs/${badRec}/retry`);
assert(r.status === 202 && r.data.rearmed === 1, 'retry re-arms the failed stage');
bad = (await j('GET', `/api/jobs/${badRec}`)).data;
assert(bad.status === 'processing', 'recording back to processing after retry');

// ── B4 continuation: the REAL rendered clip travels the full machine ────────
const stamp = Date.now();
const qa = (await j('POST', '/api/users', { email: `b3qa+${stamp}@clipper.ai`, role: 'reviewer' })).data.id;
const mgr = (await j('POST', '/api/users', { email: `b3am+${stamp}@clipper.ai`, role: 'account_manager' })).data.id;
const owner = (await j('POST', '/api/users', { email: `b3client+${stamp}@clipper.ai`, role: 'client', clientId: cli })).data.id;
r = await j('GET', '/api/review/queue');
assert(r.data.items.some((i) => i.id === top.id && i.rendered), 'rendered clip sits in the review queue');
r = await j('POST', `/api/review/${top.id}/decision`, { userId: qa, decision: 'approve', notes: 'real cut, real signal' });
assert(r.status === 200 && r.data.to === 'approved_internal', 'QA approves the rendered clip');
r = await j('POST', `/api/review/${top.id}/send`, { userId: mgr });
assert(r.status === 200 && r.data.to === 'awaiting_client', 'account manager sends it to the client');
r = await j('POST', `/api/review/${top.id}/decision`, { userId: owner, decision: 'approve' });
assert(r.status === 200 && r.data.to === 'approved', 'client signs off → approved');
r = await j('GET', `/api/jobs/${rec}`);
assert(r.data.clips.by_status?.approved === 1, 'board rollup shows the approved clip');

// ── B5 continuation: the approved REAL clip publishes end-to-end ────────────
r = await j('POST', '/api/publish/connections', {
  clientId: cli, platform: 'youtube', handle: '@b3pipeline',
  credentials: { refreshToken: `smoke-${stamp}` },
});
assert(r.status === 201, 'platform connection created');
r = await j('POST', '/api/publish', { clipId: top.id, platform: 'youtube' });
assert(r.status === 202, 'approved clip scheduled for publish');
let pub, pubDeadline = Date.now() + 30_000;
for (;;) {
  await sleep(1000);
  pub = (await j('GET', '/api/publish/queue')).data.items.find((i) => i.clip_id === top.id);
  if (pub?.status === 'published' || pub?.status === 'failed') break;
  if (Date.now() > pubDeadline) { console.error('FAIL: publish never completed'); process.exit(1); }
}
assert(pub.status === 'published' && pub.external_url, `scheduler published the real clip (${pub.external_url})`);
const delivered = await fetch(BASE + pub.external_url);
const deliveredBytes = Buffer.from(await delivered.arrayBuffer());
const deliveredPath = path.join(tmp, 'delivered.mp4');
await import('node:fs').then((fs) => fs.writeFileSync(deliveredPath, deliveredBytes));
const deliveredProbe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_format', deliveredPath]));
assert(Math.abs(Number(deliveredProbe.format.duration) - clipDur) < 2,
  `delivered file is the playable rendered clip (${Number(deliveredProbe.format.duration).toFixed(1)}s)`);
const deliveredManifest = await (await fetch(BASE + pub.external_url.replace('.mp4', '.json'))).json();
assert(deliveredManifest.caption === 'The moment the room got loud',
  'delivery manifest carries the editor-rewritten hook as the caption');
r = await j('GET', `/api/jobs/${rec}`);
assert(r.data.clips.by_status?.published === 1, 'board rollup shows the published clip');

console.log('\nB3+B4+B5 smoke passed: media in → scored, rendered 9:16 clips out → reviewed, signed off → published end-to-end.');

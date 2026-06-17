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

import { opsSession, mintUser } from './lib-smoke-auth.mjs';
const OPS = await opsSession(BASE); // B7: the API has one door now
const j = async (method, p, body, raw, token) => {
  const res = await fetch(BASE + p, {
    method,
    headers: {
      ...(raw ? { 'content-type': 'video/mp4' } : { 'content-type': 'application/json' }),
      authorization: `Bearer ${token || OPS}`,
    },
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
const assetRes = await fetch(`${BASE}/api/clips/${top.id}/asset`, { headers: { authorization: `Bearer ${OPS}` } });
assert(assetRes.status === 200 && assetRes.headers.get('content-type')?.includes('video/mp4'), 'asset endpoint serves video/mp4');
const bytes = Buffer.from(await assetRes.arrayBuffer());
const assetPath = path.join(tmp, 'served.mp4');
await import('node:fs').then((fs) => fs.writeFileSync(assetPath, bytes));
const probed = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_format', assetPath]));
const clipDur = Number(top.t_end_s) - Number(top.t_start_s);
assert(Math.abs(Number(probed.format.duration) - clipDur) < 2,
  `served asset is a playable mp4 of the right length (${Number(probed.format.duration).toFixed(1)}s ≈ ${clipDur.toFixed(1)}s)`);

// ── failure path: bad source URL → 3 attempts → parked failed → retry ───────
// The SSRF guard (S1) refuses this loopback/non-https URL outright; the queue
// still retries 3× and parks it with the real diagnostic on the board.
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
assert(ingStage.attempts === 3 && /scheme not allowed|refusing to fetch|could not resolve|fetch failed/i.test(ingStage.error || ''),
  `ingest parked after 3 attempts with the real error on the board ("${(ingStage.error || '').slice(0, 40)}…")`);
r = await j('POST', `/api/jobs/${badRec}/retry`);
assert(r.status === 202 && r.data.rearmed === 1, 'retry re-arms the failed stage');
bad = (await j('GET', `/api/jobs/${badRec}`)).data;
assert(bad.status === 'processing', 'recording back to processing after retry');

// ── B4 continuation: the REAL rendered clip travels the full machine ────────
const stamp = Date.now();
const qa = (await mintUser(BASE, OPS, { email: `b3qa+${stamp}@clipper.ai`, role: 'reviewer' })).token;
const mgr = (await mintUser(BASE, OPS, { email: `b3am+${stamp}@clipper.ai`, role: 'account_manager' })).token;
const owner = (await mintUser(BASE, OPS, { email: `b3client+${stamp}@clipper.ai`, role: 'client', clientId: cli })).token;
r = await j('GET', '/api/review/queue');
assert(r.data.items.some((i) => i.id === top.id && i.rendered), 'rendered clip sits in the review queue');
r = await j('POST', `/api/review/${top.id}/decision`, { decision: 'approve', notes: 'real cut, real signal' }, false, qa);
assert(r.status === 200 && r.data.to === 'approved_internal', 'QA approves the rendered clip');
r = await j('POST', `/api/review/${top.id}/send`, {}, false, mgr);
assert(r.status === 200 && r.data.to === 'awaiting_client', 'account manager sends it to the client');
r = await j('POST', `/api/review/${top.id}/decision`, { decision: 'approve' }, false, owner);
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
const delivered = await fetch(BASE + pub.external_url, { headers: { authorization: `Bearer ${OPS}` } });
const deliveredBytes = Buffer.from(await delivered.arrayBuffer());
const deliveredPath = path.join(tmp, 'delivered.mp4');
await import('node:fs').then((fs) => fs.writeFileSync(deliveredPath, deliveredBytes));
const deliveredProbe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_format', deliveredPath]));
assert(Math.abs(Number(deliveredProbe.format.duration) - clipDur) < 2,
  `delivered file is the playable rendered clip (${Number(deliveredProbe.format.duration).toFixed(1)}s)`);
const deliveredManifest = await (await fetch(BASE + pub.external_url.replace('.mp4', '.json'), { headers: { authorization: `Bearer ${OPS}` } })).json();
assert(deliveredManifest.caption === 'The moment the room got loud',
  'delivery manifest carries the editor-rewritten hook as the caption');
r = await j('GET', `/api/jobs/${rec}`);
assert(r.data.clips.by_status?.published === 1, 'board rollup shows the published clip');

// ── B6 continuation: the published clip gets measured and reported ─────────
let report, repDeadline = Date.now() + 20_000;
for (;;) {
  await sleep(1000);
  report = (await j('GET', `/api/analytics/clients/${cli}`)).data;
  const post = report.posts.find((p) => p.clipId === top.id);
  if (post && post.views !== null) break;
  if (Date.now() > repDeadline) { console.error('FAIL: published clip never got a metrics capture'); process.exit(1); }
}
const post = report.posts.find((p) => p.clipId === top.id);
assert(post.views >= 0 && post.platform === 'youtube' && post.hook === 'The moment the room got loud',
  `the client report carries the published clip with real captures (${post.views} views)`);
assert(report.totals.postsPublished >= 1 && report.totals.views >= post.views,
  'report totals aggregate the capture (the weekly report generates itself)');
r = await j('GET', `/api/jobs/${rec}`);
const scoreStage = r.data.stages.find((s) => s.stage === 'score');
assert(scoreStage.payload.weightsSource && scoreStage.payload.weights,
  `score stage recorded which weights it used (${scoreStage.payload.weightsSource})`);

// ── M2: the product claim — semantics beat volume ───────────────────────────
// A two-burst recording: a content-rich segment at MODERATE loudness and a
// vacuous filler segment that is LOUDER. The loudness prior finds both; the
// transcript is what separates them. We inject a real transcript (so this is
// deterministic and offline — no ASR/LLM key needed, the builtin heuristic
// runs), then drive analyze + score directly and assert the quieter, content
// segment wins. A clip company that picks by volume would get this backwards.
{
  const pg = (await import('pg')).default;
  const { analyze } = await import('../src/pipeline/analyze.js');
  const { score } = await import('../src/pipeline/score.js');
  const { putFile } = await import('../src/storage/index.js');
  const db = new pg.Pool({ connectionString: process.env.DATABASE_URL || 'postgres://clipper:clipper@localhost:5432/clipper' });

  const CONTENT = [10, 30], VACUOUS = [58, 80];
  const semSample = path.join(tmp, 'semantic.mp4');
  // content burst amp 0.40 (moderate), vacuous burst amp 0.90 (loudest)
  execFileSync('ffmpeg', ['-hide_banner', '-y',
    '-f', 'lavfi', '-i', 'anoisesrc=color=pink:duration=90:amplitude=0.6:seed=7',
    '-af', `volume='0.02+0.38*between(t,${CONTENT[0]},${CONTENT[1]})+0.88*between(t,${VACUOUS[0]},${VACUOUS[1]})':eval=frame`,
    '-c:a', 'aac', '-b:a', '96k', semSample], { stdio: 'pipe' });

  const semCli = (await j('POST', '/api/clients', { name: 'M2 Semantic Co' })).data.id;
  const semRec = `rec_sem_${Date.now()}`;
  const semKey = `${semRec}/source.mp4`;
  await putFile(semKey, semSample);
  await db.query(`INSERT INTO recordings (id, client_id, storage_key, duration_s, kind, status)
                  VALUES ($1,$2,$3,90,'podcast','processing')`, [semRec, semCli, semKey]);

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
  await db.query(`INSERT INTO transcripts (recording_id, provider, words, text)
                  VALUES ($1,'injected',$2,$3)`,
    [semRec, JSON.stringify(words), `${contentText} ${fillerText}`]);

  // The product claim is about the shipped DEFAULT weighting. Score under it,
  // not whatever a prior retrain happened to leave in the table.
  await db.query('DELETE FROM scoring_weights');

  // run the real stages: analyze writes the analyze job payload score reads
  const aPayload = await analyze(semRec);
  assert(aPayload.signalsSource === 'heuristic',
    `semantic pass ran offline on the transcript (signalsSource=${aPayload.signalsSource})`);
  await db.query(
    `INSERT INTO pipeline_jobs (id, recording_id, stage, status, payload)
     VALUES ($1,$2,'analyze','done',$3)`,
    [`job_sem_${Date.now()}`, semRec, JSON.stringify(aPayload)]);
  await score(semRec);

  const semClips = (await db.query(
    `SELECT t_start_s, t_end_s, score, signals FROM clips WHERE recording_id = $1 AND status='candidate'`, [semRec])).rows;
  const overlapsRange = (c, [a, b]) => Math.min(Number(c.t_end_s), b) - Math.max(Number(c.t_start_s), a) > 2;
  const contentClip = semClips.find((c) => overlapsRange(c, CONTENT));
  const vacuousClip = semClips.find((c) => overlapsRange(c, VACUOUS));
  assert(contentClip && vacuousClip, 'both the content and the loud-but-vacuous segments became candidates');
  assert(Number(vacuousClip.signals.energyZ) > Number(contentClip.signals.energyZ),
    `the vacuous segment really is louder (energyZ ${Number(vacuousClip.signals.energyZ).toFixed(2)} > ${Number(contentClip.signals.energyZ).toFixed(2)})`);
  assert(Number(contentClip.score) > Number(vacuousClip.score),
    `the quieter, content-rich segment still scores higher (${contentClip.score} > ${vacuousClip.score}) — semantics beat volume`);
  const SEM = ['retention', 'emotion', 'controversy', 'education', 'story', 'hookStrength'];
  assert(SEM.every((k) => typeof contentClip.signals[k] === 'number') && contentClip.signals.energyZ !== undefined,
    'clips.signals carries all six semantic fields plus the audio fields');
  assert(Number(contentClip.signals.controversy) > 0.5 && Number(contentClip.signals.education) > 0.5,
    `the why is explainable (controversy ${contentClip.signals.controversy}, education ${contentClip.signals.education}): "${contentClip.signals.rationale}"`);

  // ── M3: rendered clips ship with burned, word-timed captions + hook variants
  const { generate } = await import('../src/pipeline/generate.js');
  const { renderVertical, captionsEnabled, captionStyle } = await import('../src/pipeline/media.js');
  const { localPathFor } = await import('../src/storage/index.js');

  await generate(semRec);
  const renderedSem = (await db.query(
    `SELECT id, t_start_s, t_end_s, asset_key, hook, signals FROM clips
     WHERE recording_id = $1 AND status = 'awaiting_review'`, [semRec])).rows;
  assert(renderedSem.length >= 1, `generate rendered the captioned candidates (${renderedSem.length})`);
  const capClip = renderedSem.find((c) => overlapsRange(c, CONTENT)) || renderedSem[0];
  assert(capClip.signals.captioned === true, 'the rendered clip is flagged captioned (a transcript was present)');
  assert(Array.isArray(capClip.signals.hookVariants),
    'hook variants are stored for editors to pick (empty offline, real LLM variants with a key)');
  assert(typeof capClip.hook === 'string' && capClip.hook.length > 0, `the clip carries a hook ("${capClip.hook.slice(0, 40)}…")`);

  // prove the burn is real: the generated (captioned) asset is brighter in the
  // caption band than a plain re-render of the very same span.
  const bandLuma = (f) => {
    const o = execFileSync('ffmpeg', ['-hide_banner', '-i', f, '-vf',
      'crop=1080:500:0:1380,signalstats,metadata=print:file=-', '-f', 'null', '-'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    const ys = [...o.matchAll(/YAVG=([\d.]+)/g)].map((m) => Number(m[1]));
    return ys.reduce((a, b) => a + b, 0) / (ys.length || 1);
  };
  const plainRecut = path.join(tmp, 'plain-recut.mp4');
  await renderVertical(await localPathFor(semKey), plainRecut,
    { start: Number(capClip.t_start_s), end: Number(capClip.t_end_s), hasVideo: false });
  const capLuma = bandLuma(await localPathFor(capClip.asset_key)), plainLuma = bandLuma(plainRecut);
  assert(capLuma > plainLuma + 1.0,
    `captions are burned into the frame (caption band ${capLuma.toFixed(1)} > plain ${plainLuma.toFixed(1)})`);

  // the per-client switch and brand style are real
  assert(captionsEnabled({}) === true && captionsEnabled({ captions: false }) === false,
    'captions are a per-client switch (brand_config.captions === false turns them off)');
  const styled = captionStyle({ captions: { color: '0xffffff', fontSize: 80 } });
  assert(styled.color === '&H00FFFFFF' && styled.fontSize === 80,
    'caption style comes from brand_config with sane defaults');

  // gated: a real hook is a short sentence, not the placeholder, when keyed
  if (process.env.LLM_API_KEY && (process.env.LLM_PROVIDER || '') === 'anthropic') {
    assert(!/hook pending editor/.test(capClip.hook) && capClip.hook.split(/\s+/).length <= 9 && capClip.signals.hookVariants.length >= 1,
      `LLM produced a real hook ≤9 words and variants ("${capClip.hook}")`);
  } else {
    console.log('skip: real-hook assertion (needs LLM_PROVIDER=anthropic + LLM_API_KEY)');
  }

  // ── M5: a worker that dies mid-job is reaped and the work self-heals ────────
  // Simulate a crashed worker: a stage stuck 'running' with a long-past
  // started_at. No live worker will ever claim a 'running' row — only the
  // visibility-timeout reaper can rescue it. Assert the recording completes.
  const reapRec = `rec_reap_${Date.now()}`;
  await db.query(`INSERT INTO recordings (id, client_id, storage_key, duration_s, kind, status)
                  VALUES ($1,$2,$3,90,'podcast','processing')`, [reapRec, semCli, semKey]);
  await db.query(`INSERT INTO pipeline_jobs (id, recording_id, stage, status, attempts, started_at, run_after)
                  VALUES ($1,$2,'ingest','running',1, now() - interval '1 hour', now() - interval '1 hour')`,
    [`job_reap_${Date.now()}`, reapRec]);
  let reaped, reapDeadline = Date.now() + 90_000;
  for (;;) {
    await sleep(2500);
    reaped = (await j('GET', `/api/jobs/${reapRec}`)).data;
    if (reaped.status === 'ready' || reaped.status === 'failed') break;
    if (Date.now() > reapDeadline) { console.error('FAIL: the reaped recording never completed'); process.exit(1); }
  }
  assert(reaped.status === 'ready', 'a worker that died mid-job was reaped and the recording completed');
  const reapedIngest = reaped.stages.find((s) => s.stage === 'ingest');
  assert(reapedIngest.status === 'done' && reapedIngest.attempts >= 2,
    `the orphaned stage was reclaimed and finished (ingest attempts ${reapedIngest.attempts})`);

  // ── M5: an exhausted job is dead-lettered (needs a human), not just 'failed'
  let dr = await j('POST', '/api/intake', { clientId: semCli, sourceUrl: 'http://127.0.0.1:9/dead-letter.mp3', kind: 'podcast' });
  const dlRec = dr.data.recordingId;
  let dlState, dlDeadline = Date.now() + 60_000;
  for (;;) {
    await sleep(2000);
    dlState = (await j('GET', `/api/jobs/${dlRec}`)).data;
    if (dlState.status === 'failed') break;
    if (Date.now() > dlDeadline) { console.error('FAIL: dead-letter recording never parked'); process.exit(1); }
  }
  const dlIngest = dlState.stages.find((s) => s.stage === 'ingest');
  assert(dlIngest.status === 'failed' && dlIngest.dead_letter === true,
    'an exhausted job is flagged dead_letter — the board separates "needs a human" from "retrying"');

  // ── M5: the queue-health endpoint reports correct depth under load ──────────
  const queues = (await j('GET', '/api/analytics/queues')).data;
  assert(Array.isArray(queues.pipeline) && queues.pipeline.some((p) => p.stage === 'generate'),
    'queue health reports per-stage pipeline depth');
  const ingestDepth = queues.pipeline.find((p) => p.stage === 'ingest');
  assert(typeof ingestDepth.done === 'number' && ingestDepth.dead_letter >= 1,
    `per-stage counts are real (ingest done=${ingestDepth.done}, dead_letter=${ingestDepth.dead_letter})`);
  assert(queues.publish && queues.publish.published >= 1 && typeof queues.metrics.tracked === 'number',
    `publish + metrics depth reported (published=${queues.publish.published}, tracked=${queues.metrics.tracked})`);

  await db.end();
}

console.log('\nB3+B4+B5+B6 + M2 + M3 + M5 smoke passed: media in → scored (semantics over volume), captioned, reviewed, signed off, published → measured; crashes self-heal.');
process.exit(0); // imported src modules hold their own pg pool open

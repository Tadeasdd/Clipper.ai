/* Q3 smoke: editor decisions become quality labels, and the model↔editor
 *  agreement reads correctly.
 *
 *  Offline + deterministic (isolated DB). Seeds clips the model scored high and
 *  low, then has an editor keep the high ones and reject the low ones, and
 *  asserts: the verdicts surface as labels (latest verdict wins; 'changes' is
 *  counted as edited), and agreement is positive — the score predicts what the
 *  editor kept (kept mean score > rejected mean score, Spearman > 0).
 */
import pg from 'pg';

const assert = (cond, msg) => { if (!cond) { console.error('FAIL:', msg); process.exit(1); } console.log('ok:', msg); };

const adminUrl = process.env.DATABASE_URL || 'postgres://clipper:clipper@localhost:5432/clipper';
const TEST_DB = 'clipper_labels';
{
  const admin = new pg.Client({ connectionString: adminUrl });
  await admin.connect();
  await admin.query(`DROP DATABASE IF EXISTS ${TEST_DB} WITH (FORCE)`);
  await admin.query(`CREATE DATABASE ${TEST_DB}`);
  await admin.end();
  const u = new URL(adminUrl); u.pathname = `/${TEST_DB}`;
  process.env.DATABASE_URL = u.toString();
}

const { migrate, q } = await import('../src/db/index.js');
const { id } = await import('../src/lib/ids.js');
const { extractLabels, editorAgreement } = await import('../src/metrics/labels.js');
await migrate();

const cli = id('cli');
await q(`INSERT INTO clients (id, name, plan, cadence) VALUES ($1,'Labels Co','growth','weekly')`, [cli]);
const rec = id('rec');
await q(`INSERT INTO recordings (id, client_id, kind, status, duration_s) VALUES ($1,$2,'podcast','ready',180)`, [rec, cli]);
const reviewer = id('usr');
await q(`INSERT INTO users (id, email, role) VALUES ($1,$2,'reviewer')`, [reviewer, `rev-${reviewer}@clipper.ai`]);

// model output: high-scored clips (rich signals) vs low-scored (poor signals)
const richSig = (s) => JSON.stringify({ energyZ: 1.4, durationFit: 0.95, positionBonus: 0.9, retention: 0.8, emotion: 0.6, controversy: 0.85, education: 0.8, story: 0.5, hookStrength: 0.7, ...s });
const poorSig = (s) => JSON.stringify({ energyZ: 0.2, durationFit: 0.4, positionBonus: 0.5, retention: 0.3, emotion: 0.05, controversy: 0.05, education: 0.05, story: 0.05, hookStrength: 0.05, ...s });
const mkClip = async (score, rich) => {
  const c = id('clip');
  await q(`INSERT INTO clips (id, recording_id, t_start_s, t_end_s, score, signals, status)
           VALUES ($1,$2,10,40,$3,$4,'awaiting_review')`, [c, rec, score, rich ? richSig({}) : poorSig({})]);
  return c;
};
const review = async (clipId, decision, secondsAgo) => {
  await q(`INSERT INTO review_events (id, clip_id, reviewer_id, decision, created_at)
           VALUES ($1,$2,$3,$4, now() - ($5 || ' seconds')::interval)`, [id('rev'), clipId, reviewer, decision, String(secondsAgo)]);
};

const high = [];
for (const s of [82, 76, 71]) high.push(await mkClip(s, true));
const low = [];
for (const s of [33, 27, 19]) low.push(await mkClip(s, false));
const editedClip = await mkClip(55, true);
const flipClip = await mkClip(40, false); // approved first, rejected later → latest wins

for (const c of high) await review(c, 'approve', 100);
for (const c of low) await review(c, 'reject', 100);
await review(editedClip, 'changes', 100);
await review(flipClip, 'approve', 200);  // earlier
await review(flipClip, 'reject', 50);    // later → the verdict that counts

// ── labels ───────────────────────────────────────────────────────────────────
const labels = await extractLabels(q);
assert(labels.length === high.length + low.length + 2, `every reviewed clip becomes one label (${labels.length})`);
const byId = Object.fromEntries(labels.map((l) => [l.clipId, l]));
assert(byId[high[0]].verdict === 'kept' && byId[low[0]].verdict === 'rejected', 'approve→kept, reject→rejected');
assert(byId[editedClip].verdict === 'edited', "a 'changes' decision is an 'edited' label");
assert(byId[flipClip].verdict === 'rejected', 'the LATEST verdict wins (approve→reject ⇒ rejected)');

// ── agreement ────────────────────────────────────────────────────────────────
const agree = editorAgreement(labels);
assert(agree.kept === 3 && agree.rejected === 4 && agree.edited === 1, `verdict counts (kept ${agree.kept}, rejected ${agree.rejected}, edited ${agree.edited})`);
assert(agree.value > 0.5, `model↔editor agreement is positive — the score predicts what editors keep (ρ=${agree.value})`);
assert(agree.keptMeanScore > agree.rejectedMeanScore, `kept clips outscore rejected (${agree.keptMeanScore} > ${agree.rejectedMeanScore})`);
assert(agree.perSignal && agree.perSignal.controversy > 0, `per-signal agreement is reported (controversy ${agree.perSignal.controversy})`);

// no-contrast case degrades honestly to null
const noContrast = editorAgreement(labels.filter((l) => l.verdict === 'kept'));
assert(noContrast.value === null && noContrast.kept === 3 && noContrast.rejected === 0,
  'no rejected labels → agreement value is null (no contrast to read), not a fabricated number');

await (await import('../src/db/index.js')).pool.end();
console.log('\nQ3 smoke passed: editor verdicts become quality labels; model↔editor agreement reads true, and is honest (null) without contrast.');
process.exit(0);

/* E3 smoke: per-client margin & profitability.
 *
 *  Seeds two clients on priced plans (growth vs starter), one with editor
 *  activity, then asserts GET /api/analytics/margin computes
 *  margin = revenue − AI cost − editor cost (estimated), returns the result
 *  sorted by profitability, and flags the editor cost as an estimate.
 */
import pg from 'pg';

const BASE = process.env.BASE || 'http://localhost:8080';
const assert = (cond, msg) => { if (!cond) { console.error('FAIL:', msg); process.exit(1); } console.log('ok:', msg); };
const near = (a, b, eps = 0.6) => Math.abs(Number(a) - Number(b)) <= eps;
let _seq = 0;
const uid = (p) => `${p}_${Date.now().toString(36)}${(_seq++).toString(36)}`; // counter → unique even in a tight loop

const { opsSession } = await import('./lib-smoke-auth.mjs');
const OPS = await opsSession(BASE);
const j = async (m, p) => {
  const res = await fetch(BASE + p, { headers: { authorization: `Bearer ${OPS}` } });
  return { status: res.status, data: await res.json().catch(() => ({})) };
};

const db = new pg.Client({ connectionString: process.env.DATABASE_URL || 'postgres://clipper:clipper@localhost:5432/clipper' });
await db.connect();

// client A: growth ($1499), no cost/editor → high margin
const a = uid('cliA');
await db.query(`INSERT INTO clients (id, name, plan, cadence) VALUES ($1,'Margin A','growth','weekly')`, [a]);

// client B: starter ($499) with editor activity → lower margin
const b = uid('cliB'); const recB = uid('rec'); const clipB = uid('clip');
await db.query(`INSERT INTO clients (id, name, plan, cadence) VALUES ($1,'Margin B','starter','weekly')`, [b]);
await db.query(`INSERT INTO recordings (id, client_id, kind, status, duration_s) VALUES ($1,$2,'podcast','ready',180)`, [recB, b]);
await db.query(`INSERT INTO clips (id, recording_id, t_start_s, t_end_s, score, signals, status) VALUES ($1,$2,10,40,80,'{}','approved')`, [clipB, recB]);
const REVIEWS = 12; // editor est = 12 × 4min × $35/60 = $28
const reviewer = (await db.query(`SELECT id FROM users LIMIT 1`)).rows[0]?.id; // the bootstrapped ops user
for (let i = 0; i < REVIEWS; i++) await db.query(`INSERT INTO review_events (id, clip_id, reviewer_id, decision) VALUES ($1,$2,$3,'approve')`, [uid('rev'), clipB, reviewer]);

const editorEst = REVIEWS * 4 * 35 / 60; // 28.00

const { data } = await j('GET', '/api/analytics/margin');
const rowA = data.clients.find((c) => c.clientId === a);
const rowB = data.clients.find((c) => c.clientId === b);
assert(rowA && rowB, 'both clients appear in the margin report');
assert(near(rowA.revenue, 1499) && near(rowB.revenue, 499), 'revenue comes from the plan catalog (growth $1499, starter $499)');
assert(rowB.editorCost > 0 && near(rowB.editorCost, editorEst), `editor cost is estimated from review activity ($${rowB.editorCost} ≈ $${editorEst})`);
assert(rowB.editorCostEstimated === true, 'editor cost is honestly labeled an estimate');
assert(near(rowA.margin, rowA.revenue - rowA.aiCost) && near(rowB.margin, rowB.revenue - rowB.aiCost - rowB.editorCost), 'margin = revenue − AI cost − editor cost');
const ia = data.clients.indexOf(rowA), ib = data.clients.indexOf(rowB);
assert(ia < ib, 'the report is sorted by profitability (higher margin first)');
assert(typeof rowA.marginPct === 'number' && ['up', 'down', 'flat'].includes(rowA.trend), 'each row carries a margin % and a trend');

await db.end();
console.log(`\nE3 smoke passed: per-client margin computes from real cost + plan data ($${rowA.margin} vs $${rowB.margin}), sorted by profitability, editor cost labeled an estimate.`);
process.exit(0);

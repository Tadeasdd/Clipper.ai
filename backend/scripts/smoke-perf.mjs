/* P5 — index audit. Proves every hot query has a usable index for its hot-table
 * access path, by EXPLAINing it with enable_seqscan=off: that forces the planner
 * to use an index wherever one exists, so a remaining `Seq Scan` on the audited
 * table means no usable index exists (the gap P5 closes). EXPLAIN never executes
 * the query, so this needs only the migrated schema — no data, no volume tuning.
 *
 * Offline: Postgres only, no keys/network. Run: `npm run smoke:perf`. */
import { migrate, pool } from '../src/db/index.js';

// Each entry is a real hot-path access pattern; `table` is the relation whose
// scan must be index-backed. Literals (not $1) keep the planner on a plain plan.
const HOT = [
  { name: 'auth: session lookup by token_hash (every authed request)', table: 'sessions',
    sql: `SELECT u.id FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash='x' AND s.revoked_at IS NULL AND s.expires_at>now()` },
  { name: 'auth: revoke-all sessions for a user', table: 'sessions',
    sql: `SELECT token_hash FROM sessions WHERE user_id='x'` },
  { name: 'queue: pipeline job claim (FOR UPDATE SKIP LOCKED)', table: 'pipeline_jobs',
    sql: `SELECT id FROM pipeline_jobs WHERE status='queued' AND run_after<=now() ORDER BY run_after LIMIT 5 FOR UPDATE SKIP LOCKED` },
  { name: 'queue: publish job claim', table: 'publish_jobs',
    sql: `SELECT id FROM publish_jobs WHERE status='scheduled' AND run_after<=now() ORDER BY run_after LIMIT 5 FOR UPDATE SKIP LOCKED` },
  { name: 'queue: publish metrics claim', table: 'publish_jobs',
    sql: `SELECT id FROM publish_jobs WHERE status='published' AND metrics_next_at<=now() ORDER BY metrics_next_at LIMIT 5 FOR UPDATE SKIP LOCKED` },
  { name: 'review: clips by status (review desk / board)', table: 'clips',
    sql: `SELECT id FROM clips WHERE status='awaiting_review'` },
  { name: 'capacity: clips by (status, assigned_to)', table: 'clips',
    sql: `SELECT id FROM clips WHERE status='awaiting_review' AND assigned_to='u1'` },
  { name: 'analytics: review_events by clip_id (margin / sign-off joins)', table: 'review_events',
    sql: `SELECT id FROM review_events WHERE clip_id='c1'` },
  { name: 'capacity/health: review_events by reviewer_id', table: 'review_events',
    sql: `SELECT id FROM review_events WHERE reviewer_id='u1'` },
  { name: 'intake: recordings by (client_id, status)', table: 'recordings',
    sql: `SELECT id FROM recordings WHERE client_id='cl1' AND status='ready'` },
  { name: 'cost: rollup by client_id', table: 'cost_entries',
    sql: `SELECT client_id, sum(cost_usd) FROM cost_entries WHERE client_id='cl1' GROUP BY client_id` },
  { name: 'cost: monthly margin window by created_at', table: 'cost_entries',
    sql: `SELECT client_id, sum(cost_usd) FROM cost_entries WHERE created_at >= date_trunc('month', now()) GROUP BY client_id` },
  { name: 'audit: recent activity feed (ts DESC)', table: 'audit_log',
    sql: `SELECT id FROM audit_log ORDER BY ts DESC LIMIT 50` },
  { name: 'audit: client-scoped feed', table: 'audit_log',
    sql: `SELECT id FROM audit_log WHERE client_id='cl1' ORDER BY ts DESC LIMIT 50` },
];

// Collect the Node Type of every plan node that scans `table`.
function scanTypesFor(node, table, out) {
  if (!node || typeof node !== 'object') return;
  if (node['Relation Name'] === table) out.push(node['Node Type']);
  if (Array.isArray(node.Plans)) for (const p of node.Plans) scanTypesFor(p, table, out);
}

async function main() {
  await migrate();
  const c = await pool.connect();
  try {
    // Force the planner to use any available index — isolates "does an index
    // exist for this access" from "is the table currently big enough to prefer it".
    await c.query('SET enable_seqscan = off');
    const results = [];
    for (const h of HOT) {
      const { rows } = await c.query(`EXPLAIN (FORMAT JSON) ${h.sql}`);
      const plan = rows[0]['QUERY PLAN'][0].Plan;
      const types = [];
      scanTypesFor(plan, h.table, types);
      const seq = types.includes('Seq Scan');
      const ok = types.length > 0 && !seq;
      results.push({ name: h.name, table: h.table, types, ok });
    }

    const pad = (s, n) => (s + ' '.repeat(n)).slice(0, n);
    console.log('\nIndex audit (enable_seqscan=off — a Seq Scan here means no usable index):\n');
    for (const r of results) {
      console.log(`  ${r.ok ? 'ok  ' : 'FAIL'} ${pad(r.table, 16)} ${r.types.join(',') || '(table not in plan)'}  — ${r.name}`);
    }
    const failed = results.filter((r) => !r.ok);
    if (failed.length) {
      console.error(`\n${failed.length} hot quer${failed.length === 1 ? 'y' : 'ies'} miss an index (Seq Scan). Add the index in a migration.`);
      process.exit(1);
    }
    console.log(`\nAll ${results.length} hot queries hit an index. ✓`);
  } finally {
    c.release();
    await pool.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });

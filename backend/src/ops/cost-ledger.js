/** E1 — per-job cost ledger (real USD, not Q4's relative routing units).
 *
 *  Stages report the resources they actually consumed — ASR seconds, LLM tokens
 *  in/out, render CPU ms, stored/egress bytes — and this prices them into the
 *  cost_entries ledger. An itemized recording cost is the sum of its rows; rows
 *  carry client_id so costs roll up per client (E3 margin builds on this).
 *
 *  Offline (builtin ASR / builtin LLM) the external-API line items are honestly
 *  $0 — those providers never ran; the real cost is render CPU + storage.
 *  Recording is best-effort: a ledger hiccup never fails the pipeline.
 */
import { q } from '../db/index.js';
import { id } from '../lib/ids.js';
import { log } from '../lib/log.js';

const round = (v) => Number(Number(v || 0).toFixed(6));
const price = (k, d) => Number(process.env[k] ?? d);

// USD per unit — realistic cloud defaults, all env-tunable.
const prices = () => ({
  asr_seconds: price('COST_ASR_PER_SEC', 0.0001),          // ~$0.006/min managed ASR
  llm_tokens_in: price('COST_LLM_IN_PER_TOK', 0.0000008),  // ~$0.80 / 1M input tokens
  llm_tokens_out: price('COST_LLM_OUT_PER_TOK', 0.000004), // ~$4.00 / 1M output tokens
  cpu_ms: price('COST_CPU_PER_MS', 0.0000000167),          // ~$0.06 / cpu-hour
  storage_bytes: price('COST_STORAGE_PER_BYTE', 0.0000000000211), // ~$0.023 / GB-month
  egress_bytes: price('COST_EGRESS_PER_BYTE', 0.00000000009),     // ~$0.09 / GB
});

/** Record resources a stage consumed. items: [{ resource, quantity, meta? }]. */
export async function recordCost(recordingId, stage, items) {
  try {
    if (!items?.length) return;
    const { rows } = await q('SELECT client_id FROM recordings WHERE id=$1', [recordingId]);
    const clientId = rows[0]?.client_id || null;
    const book = prices();
    for (const it of items) {
      const qty = Number(it.quantity) || 0;
      const unit = book[it.resource] ?? 0;
      await q(
        `INSERT INTO cost_entries (id, recording_id, client_id, stage, resource, quantity, unit_cost_usd, cost_usd, meta)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [id('cost'), recordingId, clientId, stage, it.resource, qty, unit, round(qty * unit), it.meta ? JSON.stringify(it.meta) : null]);
    }
  } catch (e) { log.warn('cost ledger write failed', { recordingId, stage, error: e.message }); }
}

/** Itemized + summed cost for one recording. */
export async function recordingCost(recordingId) {
  const { rows } = await q(
    `SELECT stage, resource, sum(quantity) AS quantity, sum(cost_usd) AS cost_usd
     FROM cost_entries WHERE recording_id=$1 GROUP BY stage, resource ORDER BY stage, resource`, [recordingId]);
  const items = rows.map((r) => ({ stage: r.stage, resource: r.resource, quantity: Number(r.quantity), costUsd: round(r.cost_usd) }));
  return { recordingId, items, totalUsd: round(items.reduce((s, i) => s + i.costUsd, 0)) };
}

/** Total cost rolled up per client (the E3 margin input). */
export async function costRollup() {
  const { rows } = await q(
    `SELECT client_id, sum(cost_usd) AS cost_usd, count(DISTINCT recording_id) AS recordings
     FROM cost_entries WHERE client_id IS NOT NULL GROUP BY client_id ORDER BY cost_usd DESC`);
  return rows.map((r) => ({ clientId: r.client_id, totalUsd: round(r.cost_usd), recordings: Number(r.recordings) }));
}

/** /metrics gauge: total USD spent per stage. */
export async function costGauge() {
  const { rows } = await q(`SELECT stage, sum(cost_usd) AS c FROM cost_entries GROUP BY stage`);
  return rows.map((r) => ({ labels: { stage: r.stage }, value: round(r.c) }));
}

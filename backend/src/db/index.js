/** Stage B2 — Postgres pool + dead-simple forward-only migration runner. */
import pg from 'pg';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const { Pool } = pg;
// P5: pool tuning. The bare pool had no bound or timeouts — one slow/leaky
// dependency could exhaust connections or hang a request indefinitely. Bounded
// size + connect/idle timeouts + a generous statement_timeout (kills a runaway
// query instead of pinning a connection forever) make the single-node ops box
// predictable under load. Every knob is env-overridable; the defaults are safe
// for CI and offline dev (statement_timeout is generous enough for every real
// query + migration). The export shape (pool, q, migrate) is unchanged.
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://clipper:clipper@localhost:5432/clipper',
  max: Number(process.env.PG_POOL_MAX || 10),
  idleTimeoutMillis: Number(process.env.PG_IDLE_TIMEOUT_MS || 30000),
  connectionTimeoutMillis: Number(process.env.PG_CONNECT_TIMEOUT_MS || 5000),
  statement_timeout: Number(process.env.PG_STATEMENT_TIMEOUT_MS || 30000),
  application_name: 'clipper-ops',
});

export const q = (text, params) => pool.query(text, params);

const MIGRATIONS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../migrations');

export async function migrate() {
  await q(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ DEFAULT now()
  )`);
  const applied = new Set((await q('SELECT name FROM schema_migrations')).rows.map((r) => r.name));
  const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();
  for (const f of files) {
    if (applied.has(f)) continue;
    const sql = readFileSync(path.join(MIGRATIONS_DIR, f), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [f]);
      await client.query('COMMIT');
      console.log(`migrated: ${f}`);
    } catch (e) {
      await client.query('ROLLBACK');
      throw new Error(`migration ${f} failed: ${e.message}`);
    } finally {
      client.release();
    }
  }
}

/** R5 — portable logical backup/restore.
 *
 *  A real logical dump that needs no external binaries (unlike pg_dump), so the
 *  automated restore DRILL runs anywhere node + pg run — the container, CI, and
 *  a laptop without postgres client tools. Production backups use pg_dump + WAL
 *  PITR (ops/backup/backup.sh, docs/DR.md); this is the portable engine the
 *  drill exercises to prove a restore reproduces the database to a point in time.
 *
 *  snapshot(connStr) → { createdAt, tables:[{name, columns, rows}] }
 *  restore(connStr, snap) → truncates + reloads those tables (schema assumed
 *    already migrated; FK order sidestepped via session_replication_role).
 */
import pg from 'pg';

const SKIP = new Set(['schema_migrations']); // bookkeeping — a restored DB re-migrates on boot

async function tableNames(c) {
  const { rows } = await c.query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name`);
  return rows.map((r) => r.table_name).filter((n) => !SKIP.has(n));
}

export async function snapshot(connStr) {
  const c = new pg.Client({ connectionString: connStr });
  await c.connect();
  try {
    const tables = [];
    for (const name of await tableNames(c)) {
      const { rows, fields } = await c.query(`SELECT * FROM "${name}"`);
      tables.push({ name, columns: fields.map((f) => f.name), rows });
    }
    return { createdAt: new Date().toISOString(), tables };
  } finally { await c.end(); }
}

export async function restore(connStr, snap) {
  const c = new pg.Client({ connectionString: connStr });
  await c.connect();
  try {
    await c.query('SET session_replication_role = replica'); // disable FK/triggers during the load
    const names = snap.tables.map((t) => `"${t.name}"`).join(', ');
    if (names) await c.query(`TRUNCATE ${names} CASCADE`);
    for (const t of snap.tables) {
      const { rows: cols } = await c.query(
        `SELECT column_name, data_type FROM information_schema.columns WHERE table_name=$1`, [t.name]);
      const jsonCols = new Set(cols.filter((x) => x.data_type === 'jsonb' || x.data_type === 'json').map((x) => x.column_name));
      const list = t.columns.map((x) => `"${x}"`).join(', ');
      const ph = t.columns.map((_, i) => `$${i + 1}`).join(', ');
      for (const row of t.rows) {
        const vals = t.columns.map((col) => (jsonCols.has(col) && row[col] != null ? JSON.stringify(row[col]) : row[col]));
        await c.query(`INSERT INTO "${t.name}" (${list}) VALUES (${ph})`, vals);
      }
    }
    await c.query('SET session_replication_role = DEFAULT');
  } finally { await c.end(); }
}

export const rowCounts = (snap) => Object.fromEntries(snap.tables.map((t) => [t.name, t.rows.length]));

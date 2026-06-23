/** D3 migration — the forward-only chain is clean, gapless, and drift-free.
 *
 *  The repo's migrations are forward-only + transactional by design (CLAUDE.md;
 *  src/db/index.js `migrate()`). There are no down-migrations to test, so
 *  "reversible/forward-safe" is honoured as: every migration applies cleanly on
 *  a fresh database, the filenames are gapless, and a second `migrate()` is a
 *  no-op (the applied set matches the files on disk — no drift).
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const MIG_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../migrations');
const files = readdirSync(MIG_DIR)
  .filter((f) => f.endsWith('.sql'))
  .sort();

const BASE = process.env.DATABASE_URL || 'postgres://clipper:clipper@localhost:5432/clipper';
const TMP_DB = `clipper_migtest_${process.pid}`;
const urlFor = (dbName) => {
  const u = new URL(BASE);
  u.pathname = `/${dbName}`;
  return u.toString();
};

let admin;
let db; // dynamically imported AFTER DATABASE_URL points at the throwaway DB

before(async () => {
  admin = new pg.Client(urlFor('postgres'));
  await admin.connect();
  await admin.query(`DROP DATABASE IF EXISTS ${TMP_DB} WITH (FORCE)`);
  await admin.query(`CREATE DATABASE ${TMP_DB}`);
  process.env.DATABASE_URL = urlFor(TMP_DB);
  db = await import('../../src/db/index.js');
});

after(async () => {
  try {
    await db?.pool.end();
  } catch {
    /* pool may already be closed */
  }
  try {
    await admin.query(`DROP DATABASE IF EXISTS ${TMP_DB} WITH (FORCE)`);
  } finally {
    await admin.end();
  }
});

test('filenames are 3-digit zero-padded, gapless, and strictly increasing', () => {
  assert.ok(files.length > 0, 'expected migration files on disk');
  files.forEach((f, i) => {
    const m = f.match(/^(\d{3})_/);
    assert.ok(m, `migration ${f} must start with a 3-digit zero-padded number`);
    assert.equal(Number(m[1]), i + 1, `expected migration ${i + 1}, found ${f} (gap or duplicate)`);
  });
});

test('migrate() applies every migration cleanly on a fresh database', async () => {
  await db.migrate();
  const { rows } = await db.q('SELECT count(*)::int AS n FROM schema_migrations');
  assert.equal(rows[0].n, files.length, 'every migration file should be recorded as applied');
});

test('migrate() is idempotent — a second run applies nothing (drift-free)', async () => {
  const before = (await db.q('SELECT count(*)::int AS n FROM schema_migrations')).rows[0].n;
  await db.migrate();
  const after = (await db.q('SELECT count(*)::int AS n FROM schema_migrations')).rows[0].n;
  assert.equal(after, before, 'a second migrate() must not apply or duplicate any migration');
  assert.equal(after, files.length, 'applied set must still match the files on disk');
});

/** C3 — re-wrap stored ciphertext onto the active encryption key.
 *
 *  After rotating PUBLISH_TOKEN_KEY (new value active, old value moved to
 *  PUBLISH_TOKEN_KEY_PREVIOUS), existing blobs still decrypt via the retired key
 *  but are stamped with its id. This walks every encrypted column and re-wraps
 *  each blob onto the active key, so once it completes nothing references the old
 *  key and PUBLISH_TOKEN_KEY_PREVIOUS can be dropped.
 *
 *  Safe to run repeatedly: rewrap() is idempotent (a blob already on the active
 *  key is left untouched), and each row is updated only when its ciphertext
 *  actually changes. Requires DATABASE_URL. Run inside the rotation window while
 *  both keys are configured.
 *
 *  Usage: PUBLISH_TOKEN_KEY=<new> PUBLISH_TOKEN_KEY_PREVIOUS=<old> \
 *         node scripts/rewrap-secrets.mjs
 */
import { q, pool } from '../src/db/index.js';
import { rewrap, activeKeyId } from '../src/lib/crypto.js';

// Every place lib/crypto encrypts a JSON blob at rest (table, pk, column).
const TARGETS = [
  { table: 'platform_connections', pk: 'id', col: 'credentials_enc' },
  { table: 'users', pk: 'id', col: 'mfa_secret' },
  { table: 'users', pk: 'id', col: 'mfa_pending_secret' },
];

async function rewrapColumn({ table, pk, col }) {
  const { rows } = await q(`SELECT ${pk} AS id, ${col} AS blob FROM ${table} WHERE ${col} IS NOT NULL`);
  let changed = 0;
  for (const row of rows) {
    const next = rewrap(row.blob);
    if (next !== row.blob) {
      await q(`UPDATE ${table} SET ${col} = $2 WHERE ${pk} = $1`, [row.id, next]);
      changed += 1;
    }
  }
  console.log(`  ${table}.${col}: ${rows.length} scanned, ${changed} re-wrapped`);
  return changed;
}

async function main() {
  console.log(`re-wrapping stored secrets onto active key id ${activeKeyId()}`);
  let total = 0;
  for (const t of TARGETS) total += await rewrapColumn(t);
  console.log(`done — ${total} blob(s) migrated to the active key.`);
  await pool.end();
}

main().catch((e) => { console.error('rewrap failed:', e.message); process.exit(1); });

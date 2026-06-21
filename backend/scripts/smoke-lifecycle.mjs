/* C1 smoke — content lifecycle: at-rest encryption, GDPR erasure, retention purge.
 * Self-contained and offline (Postgres only): uses an isolated STORAGE_DIR and
 * the dev-default content key. Run: `npm run smoke:lifecycle`. */
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';

// Isolate storage BEFORE importing the storage layer (local.js reads ROOT at load).
const STORE = mkdtempSync(path.join(tmpdir(), 'clipper-lifecycle-'));
process.env.STORAGE_DIR = STORE;

const { migrate, q, pool } = await import('../src/db/index.js');
const storage = await import('../src/storage/index.js');
const { purgeRecordings, purgeExpired } = await import('../src/lib/retention.js');
const { id } = await import('../src/lib/ids.js');

let failures = 0;
const ok = (cond, msg) => { console.log(`${cond ? 'ok' : 'FAIL'}: ${msg}`); if (!cond) failures++; };
const putObj = (key, buf) => storage.saveStream(key, Readable.from(buf));
const count = async (sql, params) => Number((await q(sql, params)).rows[0].n);

// Seed a client with one fully-derived recording (raw + clip + publish + review + cost).
async function seedClient({ retentionDays = null, ageDays = 0 } = {}) {
  const cid = id('cl'), rid = id('rec'), clipId = id('clip'), uid = id('usr');
  await q('INSERT INTO clients (id, name, retention_days) VALUES ($1,$2,$3)', [cid, 'Lifecycle Co', retentionDays]);
  await q('INSERT INTO users (id, email, role) VALUES ($1,$2,$3)', [uid, `rev_${uid}@clipper.ai`, 'reviewer']);
  const rawKey = `${rid}/raw.bin`, assetKey = `clips/${clipId}.mp4`;
  await putObj(rawKey, Buffer.from('RAW MEDIA ' + 'a'.repeat(2000)));
  await putObj(assetKey, Buffer.from('RENDERED CLIP ' + 'b'.repeat(2000)));
  await q(`INSERT INTO recordings (id, client_id, kind, status, storage_key, duration_s, created_at)
           VALUES ($1,$2,'podcast','ready',$3,180, now() - ($4 || ' days')::interval)`, [rid, cid, rawKey, String(ageDays)]);
  await q(`INSERT INTO clips (id, recording_id, t_start_s, t_end_s, score, signals, hook, status, asset_key)
           VALUES ($1,$2,30,62,90,'{}','hook',$3,$4)`, [clipId, rid, 'approved', assetKey]);
  const pubId = id('pub');
  await q(`INSERT INTO publish_jobs (id, clip_id, platform, status) VALUES ($1,$2,'youtube','published')`, [pubId, clipId]);
  await putObj(`outbox/youtube/${clipId}.mp4`, Buffer.from('PUBLISHED'));
  await putObj(`outbox/youtube/${clipId}.json`, Buffer.from('{"manifest":true}'));
  await q(`INSERT INTO review_events (id, clip_id, reviewer_id, decision) VALUES ($1,$2,$3,'approve')`, [id('rev'), clipId, uid]);
  await q(`INSERT INTO cost_entries (id, recording_id, client_id, stage, resource, quantity, unit_cost_usd, cost_usd)
           VALUES ($1,$2,$3,'transcribe','asr_seconds',180,0.0001,0.018)`, [id('cost'), rid, cid]);
  return { cid, rid, clipId, rawKey, assetKey, pubId };
}

async function main() {
  await migrate();

  // ── 1. ENCRYPTION AT REST ────────────────────────────────────────────────
  const plaintext = Buffer.from('SECRET CLIENT MEDIA — ' + 'x'.repeat(5000));
  const key = 'rec_enc_test/raw.bin';
  await putObj(key, plaintext);
  const raw = readFileSync(path.join(STORE, key));
  ok(raw.subarray(0, 4).toString() === 'CLP1', 'stored object carries the C1 encryption header (CLP1)');
  ok(!raw.includes(plaintext), 'stored bytes are ciphertext, not the plaintext input');
  ok(raw.length > plaintext.length, 'stored size includes header + auth-tag overhead');
  const decPath = await storage.localPathFor(key);
  ok(readFileSync(decPath).equals(plaintext), 'localPathFor decrypts back to the exact original bytes');

  // ── 2. GDPR ERASURE ──────────────────────────────────────────────────────
  const e = await seedClient();
  const opsId = id('usr');                       // a real actor (the endpoint passes req.user.id)
  await q('INSERT INTO users (id, email, role) VALUES ($1,$2,$3)', [opsId, `ops_${opsId}@clipper.ai`, 'ops']);
  const before = await count('SELECT count(*) n FROM clips WHERE recording_id = $1', [e.rid]);
  ok(before === 1 && !!storage.objectInfo(e.rawKey) && !!storage.objectInfo(e.assetKey), 'erasure fixture seeded (rows + objects present)');
  const manifest = await purgeRecordings([e.rid], { reason: 'erasure', clientId: e.cid, actorId: opsId });
  ok(manifest.recordings === 1 && manifest.objects >= 4, `erasure manifest: ${manifest.recordings} recording, ${manifest.objects} objects`);
  ok(await count('SELECT count(*) n FROM recordings WHERE id = $1', [e.rid]) === 0, 'recording row erased');
  ok(await count('SELECT count(*) n FROM clips WHERE recording_id = $1', [e.rid]) === 0, 'clip rows erased');
  ok(await count('SELECT count(*) n FROM publish_jobs WHERE clip_id = $1', [e.clipId]) === 0, 'publish_jobs erased');
  ok(await count('SELECT count(*) n FROM review_events WHERE clip_id = $1', [e.clipId]) === 0, 'review_events erased');
  ok(await count('SELECT count(*) n FROM cost_entries WHERE recording_id = $1', [e.rid]) === 0, 'cost_entries erased');
  ok(!storage.objectInfo(e.rawKey) && !storage.objectInfo(e.assetKey)
     && !storage.objectInfo(`outbox/youtube/${e.clipId}.mp4`), 'all storage objects (raw + rendered + published) deleted');
  ok(await count('SELECT count(*) n FROM clients WHERE id = $1', [e.cid]) === 1, 'the client account row survives erasure (content-only)');
  ok(await count(`SELECT count(*) n FROM audit_log WHERE action = 'client_content_erased' AND client_id = $1`, [e.cid]) === 1,
    'erasure wrote an auditable client_content_erased row');

  // ── 3. RETENTION PURGE (automatic) ───────────────────────────────────────
  const r = await seedClient({ retentionDays: 1, ageDays: 2 }); // 2 days old, 1-day window → expired
  const fresh = await seedClient({ retentionDays: 30, ageDays: 0 }); // within window → kept
  const swept = await purgeExpired();
  ok(swept.recordings === 1, `retention sweep purged exactly the expired recording (${swept.recordings})`);
  ok(await count('SELECT count(*) n FROM recordings WHERE id = $1', [r.rid]) === 0, 'expired recording auto-purged');
  ok(!storage.objectInfo(r.rawKey), 'expired recording objects auto-deleted');
  ok(await count('SELECT count(*) n FROM recordings WHERE id = $1', [fresh.rid]) === 1, 'in-window recording kept (not over-purged)');
  ok(await count(`SELECT count(*) n FROM audit_log WHERE action = 'content_purged'`) >= 1, 'retention purge is audited (content_purged)');

  console.log(failures ? `\n${failures} check(s) FAILED.` : '\nC1 smoke passed: encrypted at rest, erasable, and auto-purged on retention.');
}

main()
  .catch((e) => { console.error(e); failures++; })
  .finally(async () => { await pool.end(); try { rmSync(STORE, { recursive: true, force: true }); } catch { /* tmp */ } process.exit(failures ? 1 : 0); });

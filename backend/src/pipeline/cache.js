/** Q4 — content-addressed compute cache.
 *
 *  Re-transcribing or re-analyzing byte-identical content burns money and time
 *  for an identical result. Keyed by a hash of the inputs (audio bytes for ASR;
 *  audio + transcript + model/prompt version for analysis), a cache hit returns
 *  the prior result and skips the expensive stage entirely — "identical inputs
 *  are free". Correctness is exact: the stored payload is replayed verbatim, so
 *  a hit is indistinguishable from a fresh compute (the eval quality gate holds).
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { q } from '../db/index.js';

export const hashJson = (obj) => createHash('sha256').update(JSON.stringify(obj)).digest('hex').slice(0, 32);
export const hashFile = (path) => createHash('sha256').update(readFileSync(path)).digest('hex').slice(0, 32);

/** A prior transcript for byte-identical audio, if one exists (cross-recording
 *  ASR reuse). Returns { words, text, ai_provenance } or null. */
export async function findCachedTranscript(contentHash) {
  if (!contentHash) return null;
  // Any prior transcript for this content hash — they're byte-identical inputs,
  // so any match is an exact reuse (transcripts is keyed 1:1 by recording).
  const { rows } = await q(
    `SELECT words, text, ai_provenance FROM transcripts WHERE content_hash = $1 LIMIT 1`, [contentHash]);
  return rows[0] || null;
}

export async function getCache(cacheKey) {
  const { rows } = await q('SELECT payload FROM compute_cache WHERE cache_key = $1', [cacheKey]);
  return rows[0]?.payload || null;
}

export async function putCache(cacheKey, kind, payload) {
  await q(
    `INSERT INTO compute_cache (cache_key, kind, payload) VALUES ($1, $2, $3)
     ON CONFLICT (cache_key) DO NOTHING`,
    [cacheKey, kind, JSON.stringify(payload)]);
}

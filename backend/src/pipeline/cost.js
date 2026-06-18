/** Q4 — relative cost/compute units per AI producer.
 *
 *  A stand-in for real money until E1's cost ledger lands: a stronger model
 *  costs more than a cheap one, a cloud call costs more than local compute, and
 *  a CACHE HIT costs nothing. The router uses the ordering to prefer the cheap
 *  path; the eval reports average units so caching/routing show up as a lower
 *  number. E1 (Track E) replaces these with measured tokens / CPU / $.
 */
const ANALYZE_UNITS = {
  cached: 0,        // a cache hit recomputes nothing
  heuristic: 1,     // local lexical pass — compute only
  audio_only: 1,    // loudness-only (no transcript)
  'llm:cheap': 2,   // a cheap model call
  'llm:strong': 6,  // a strong model call (escalation)
};
const TRANSCRIBE_UNITS = {
  cached: 0,
  builtin: 0,       // no ASR ran
  whisper: 1,       // local compute
  deepgram: 2,      // cloud, per-minute
};

/** Units for one analyze pass given its provenance (+ whether it was a hit). */
export function analyzeCost(provenance, cached) {
  if (cached) return 0;
  if (provenance?.provider === 'anthropic') return provenance.escalated ? ANALYZE_UNITS['llm:strong'] : ANALYZE_UNITS['llm:cheap'];
  if (provenance?.provider === 'audio_only') return ANALYZE_UNITS.audio_only;
  return ANALYZE_UNITS.heuristic;
}

/** Units for one transcribe pass. */
export function transcribeCost(provider, cached) {
  if (cached) return 0;
  return TRANSCRIBE_UNITS[provider] ?? 1;
}

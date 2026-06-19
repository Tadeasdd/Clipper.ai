/** Stage 3 — analyze: find candidate moments from what is said and how it sounds.
 *
 *  Loudness dynamics (ebur128 momentary LUFS, ~10 Hz) remain a cheap, free
 *  *prior*: energetic stretches are where emphasis, laughter, and argument
 *  live. But the company sells *semantic* clip-finding, so when a transcript
 *  exists the loudness candidates are joined by spans the provider nominates
 *  from the words themselves, and every candidate is annotated with the six
 *  semantic signals (retention/emotion/controversy/education/story/hook). The
 *  seam is `signals` jsonb, opaque to downstream stages and the ops UI. With no
 *  transcript the stage degrades honestly to loudness-only (signalsSource =
 *  "audio_only") rather than pretending the semantic pass ran.
 */
import { q } from '../db/index.js';
import { localPathFor } from '../storage/index.js';
import { loudnessSeries } from './media.js';
import { semanticSignals, nominateSpans, semanticSource, semanticProvenance } from './llm.js';
import { hashFile, hashJson, getCache, putCache } from './cache.js';
import { analyzeCost } from './cost.js';
import { recordCost } from '../ops/cost-ledger.js';

const WIN_S = 4;          // scoring window
const MIN_CLIP_S = 12;    // candidate bounds
const MAX_CLIP_S = 55;
const MAX_CANDIDATES = Number(process.env.ANALYZE_MAX_CANDIDATES || 10);

export async function analyze(recordingId) {
  const { rows } = await q('SELECT storage_key, duration_s FROM recordings WHERE id = $1', [recordingId]);
  const { storage_key: key, duration_s: durationS } = rows[0] || {};
  if (!key) throw new Error('recording has no media');

  // Q4: content-addressed analysis cache, checked BEFORE any expensive compute
  // (loudness + the semantic pass). Keyed by the audio bytes + the transcript +
  // the model/prompt version, so byte-identical inputs under the same config
  // replay the prior result for free. The payload is replayed verbatim — a hit
  // is indistinguishable from a fresh run, so the eval quality gate is unmoved.
  const path = await localPathFor(key);
  const cacheWords = (await q('SELECT words FROM transcripts WHERE recording_id = $1', [recordingId])).rows[0]?.words || [];
  const provBase = semanticProvenance();
  const cacheKey = hashJson({ v: 'analyze1', audio: hashFile(path), words: hashJson(cacheWords),
    cfg: { provider: provBase.provider, model: provBase.model, promptHash: provBase.promptHash } });
  const hit = await getCache(cacheKey);
  if (hit) return { ...hit, cached: true, cost: 0 };

  const series = await loudnessSeries(path);
  if (series.length < 10) throw new Error('audio too short or silent — no loudness signal');

  // Windowed mean loudness → z-score against the whole recording.
  const windows = [];
  for (let t = 0; t + WIN_S <= (durationS || series[series.length - 1].t); t += WIN_S / 2) {
    const xs = series.filter((s) => s.t >= t && s.t < t + WIN_S).map((s) => s.m);
    if (xs.length) windows.push({ t, m: xs.reduce((a, b) => a + b, 0) / xs.length });
  }
  const mean = windows.reduce((a, w) => a + w.m, 0) / windows.length;
  const sd = Math.sqrt(windows.reduce((a, w) => a + (w.m - mean) ** 2, 0) / windows.length) || 1;
  windows.forEach((w) => { w.z = (w.m - mean) / sd; });

  // Greedy peak picking grown to clip-sized regions. Distinct bursts can sit
  // close together, so overlap control is by REGION, not peak distance: a new
  // candidate is clamped against already-accepted regions and only dropped if
  // what remains is too short to be a clip.
  const peaks = [...windows].sort((a, b) => b.z - a.z);
  const moments = [];
  for (const p of peaks) {
    if (moments.length >= 8) break;
    if (p.z < -0.25) break; // below baseline — stop
    if (moments.some((m) => p.t >= m.start - MIN_CLIP_S / 2 && p.t < m.end)) continue; // same burst
    let start = p.t, end = p.t + WIN_S;
    const grow = (t) => (windows.find((w) => w.t === t) || { z: -9 }).z > -0.1;
    while (end - start < MAX_CLIP_S && grow(end)) end += WIN_S / 2;
    while (end - start < MAX_CLIP_S && grow(start - WIN_S / 2)) start -= WIN_S / 2;
    start = Math.max(0, start);
    end = Math.min(durationS || end, Math.max(end, start + MIN_CLIP_S));
    for (const m of moments) {
      if (start < m.end && end > m.start) {            // would overlap an accepted region
        if (p.t >= m.end) start = Math.max(start, m.end);
        else end = Math.min(end, m.start);
      }
    }
    if (end - start < MIN_CLIP_S) continue;
    moments.push({ peakT: p.t, start, end, energyZ: Number(p.z.toFixed(2)), source: 'loudness' });
  }
  if (!moments.length) throw new Error('no candidate moments found above the energy baseline');

  // ── semantic layer: nominate spans the loudness prior missed, then annotate
  //    every candidate with the six semantic signals from its transcript span.
  const transcript = (await q('SELECT words FROM transcripts WHERE recording_id = $1', [recordingId])).rows[0];
  const words = transcript?.words || [];
  const hasTranscript = Array.isArray(words) && words.length > 0;
  const signalsSource = semanticSource(hasTranscript);

  if (hasTranscript) {
    const total = durationS || windows[windows.length - 1].t + WIN_S;
    for (const span of await nominateSpans(words)) {
      let { start, end } = clampSpan(span.start, span.end, total);
      if (moments.some((m) => overlap(start, end, m.start, m.end) > 2)) continue; // already covered by loudness
      moments.push({ start, end, energyZ: zOver(windows, start, end), source: 'semantic' });
    }
    // Keep the strongest candidates: loudness peaks plus the richest spans.
    const ranked = moments.slice(0, MAX_CANDIDATES);
    // Q2/Q4: the routed semantic pass returns the signals + the provenance of
    // the model ACTUALLY used (cheap, or strong after escalation).
    const { signals: sigs, provenance, usage } = await semanticSignals(ranked.map((m) => ({ text: spanText(words, m.start, m.end) })));
    ranked.forEach((m, i) => { m.semantic = sigs[i]; });
    // E1: the analysis pass's LLM tokens (in/out) — $0 under the builtin heuristic.
    await recordCost(recordingId, 'analyze', [
      { resource: 'llm_tokens_in', quantity: usage?.in || 0, meta: { provider: provenance.provider } },
      { resource: 'llm_tokens_out', quantity: usage?.out || 0, meta: { provider: provenance.provider } },
    ]);
    const payload = { moments: ranked, baseline: { meanLufs: Number(mean.toFixed(1)), sdLufs: Number(sd.toFixed(1)) }, signalsSource, provenance };
    await putCache(cacheKey, 'analyze', payload); // Q4: free on the next identical input
    return { ...payload, cached: false, cost: analyzeCost(provenance, false) };
  }

  // No words: loudness-only, marked honestly. Neutral semantic so score's blend
  // is well-defined and the ops desk sees zeros, not invented numbers.
  for (const m of moments) m.semantic = NEUTRAL_SEMANTIC;
  const payload = { moments, baseline: { meanLufs: Number(mean.toFixed(1)), sdLufs: Number(sd.toFixed(1)) }, signalsSource, provenance: { provider: 'audio_only', model: null } };
  // E1: audio-only ran no LLM — record the honest $0 AI line so the cost stays itemized.
  await recordCost(recordingId, 'analyze', [
    { resource: 'llm_tokens_in', quantity: 0, meta: { provider: 'audio_only' } },
    { resource: 'llm_tokens_out', quantity: 0, meta: { provider: 'audio_only' } },
  ]);
  await putCache(cacheKey, 'analyze', payload);
  return { ...payload, cached: false, cost: analyzeCost(payload.provenance, false) };
}

const NEUTRAL_SEMANTIC = { retention: 0, emotion: 0, controversy: 0, education: 0, story: 0, hookStrength: 0, rationale: 'no transcript — audio-only' };

/** Mean loudness z over [start,end] from the already-windowed series. */
function zOver(windows, start, end) {
  const xs = windows.filter((w) => w.t >= start && w.t < end).map((w) => w.z);
  return xs.length ? Number((xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(2)) : 0;
}

/** Snap a nominated span to clip-sized bounds within the recording. */
function clampSpan(s, e, total) {
  let start = Math.max(0, s);
  let end = Math.min(total, Math.max(e, start + MIN_CLIP_S));
  if (end - start > MAX_CLIP_S) end = start + MAX_CLIP_S;
  if (end - start < MIN_CLIP_S) start = Math.max(0, end - MIN_CLIP_S);
  return { start: Number(start.toFixed(1)), end: Number(end.toFixed(1)) };
}

const overlap = (s1, e1, s2, e2) => Math.min(e1, e2) - Math.max(s1, s2);

/** The transcript text spoken within [start,end]. */
function spanText(words, start, end) {
  return words
    .filter((w) => Number(w.e) >= start - 0.5 && Number(w.s) <= end + 0.5)
    .map((w) => w.w)
    .join(' ')
    .replace(/\s+([.,!?;:])/g, '$1')
    .trim();
}

/** Shared semantic client behind the LLM_PROVIDER seam.
 *
 *  The product sells *semantic* clip-finding: high-retention moments, emotional
 *  peaks, controversial statements, educational insight, storytelling, hooks.
 *  This module turns a transcript span into those six [0,1] signals plus a
 *  one-line rationale, and (given the full transcript) nominates spans the
 *  loudness prior would miss.
 *
 *  Providers:
 *    builtin (default): offline, zero-key transcript heuristics — real lexical
 *      and structural analysis of the words, never a fabricated number. Honest
 *      and transparent; `signalsSource: "heuristic"`.
 *    anthropic: one batched, JSON-only LLM call over the spans; `"llm"`.
 *  No transcript at all → callers fall back to `signalsSource: "audio_only"`.
 *
 *  Cost guards: spans are capped per recording and each span's text is capped
 *  before it reaches a paid call (CHARS_PER_SPAN), and the whole batch is one
 *  request.
 */

import { createHash } from 'node:crypto';
import { getPrompt, promptMeta } from '../../prompts/registry.js';
import { resilientFetch } from '../lib/resilience.js';

const SIGNAL_KEYS = ['retention', 'emotion', 'controversy', 'education', 'story', 'hookStrength'];
const CHARS_PER_SPAN = Number(process.env.LLM_CHARS_PER_SPAN || 1200);
const MAX_SPANS = Number(process.env.LLM_MAX_SPANS || 12);
const NOMINATE_CHARS = Number(process.env.LLM_NOMINATE_CHARS || 12000);

export const SEMANTIC_KEYS = SIGNAL_KEYS;

// The heuristic isn't a prompt, but it's still a versioned producer of signals —
// stamp it so offline artifacts carry honest, stable provenance too.
const HEURISTIC_VERSION = 'v1';
const HEURISTIC_HASH = createHash('sha256').update(`heuristic:${HEURISTIC_VERSION}`).digest('hex').slice(0, 16);

/** Provider in force, or 'audio_only' when there are no words to read. */
export function semanticSource(hasTranscript) {
  if (!hasTranscript) return 'audio_only';
  return (process.env.LLM_PROVIDER || 'builtin') === 'anthropic' ? 'llm' : 'heuristic';
}

/** Q4 — model routing. Default to a cheap model; escalate to a strong one only
 *  when the cheap pass comes back low-confidence. Both are env-configured; the
 *  quality floor that justifies the cheap default is calibrated by the Q1 eval. */
export function modelRoute() {
  const cheap = process.env.LLM_MODEL || 'claude-haiku-4-5-20251001';
  return { cheap, strong: process.env.LLM_MODEL_STRONG || cheap };
}

const ESCALATE_FRAC = Number(process.env.LLM_ESCALATE_NEUTRAL_FRAC || 0.5);
/** Should we escalate to the strong model? Pure + testable: escalate when too
 *  many spans came back degraded/neutral (an error fallback, or every signal
 *  ~0) — i.e. the cheap pass wasn't confident enough to trust below the floor. */
export function shouldEscalate(scored, frac = ESCALATE_FRAC) {
  if (!Array.isArray(scored) || !scored.length) return false;
  const degraded = scored.filter((s) => !s || /error|no result/.test(s.rationale || '')
    || SIGNAL_KEYS.every((k) => !Number(s[k]))).length;
  return degraded / scored.length >= frac;
}

/** Q2 — provenance of the semantic pass (pure, no API call): who/what/version,
 *  enough to reproduce and to A/B. The cheap model is the pre-call view; the
 *  actual model used (after any escalation) is stamped by semanticSignals. */
export function semanticProvenance() {
  const provider = (process.env.LLM_PROVIDER || 'builtin') === 'anthropic' ? 'anthropic' : 'builtin';
  if (provider === 'builtin') {
    return { provider: 'builtin', model: 'heuristic', promptId: 'heuristic', promptVersion: HEURISTIC_VERSION, promptHash: HEURISTIC_HASH, params: {} };
  }
  return { provider: 'anthropic', model: modelRoute().cheap, escalated: false, ...promptMeta('semantic-signals'), params: { temperature: 0 } };
}

/** Score each span's text into the six semantic signals + a rationale, routing
 *  cheap→strong as needed. Returns { signals, provenance } — provenance records
 *  the model ACTUALLY used (escalated or not) so each clip is stamped truthfully.
 *  Defensive: a provider failure degrades to neutral zeros rather than throwing. */
export async function semanticSignals(spans) {
  const trimmed = spans.slice(0, MAX_SPANS).map((s) => ({ text: String(s.text || '').slice(0, CHARS_PER_SPAN) }));
  const provider = (process.env.LLM_PROVIDER || 'builtin') === 'anthropic' ? 'anthropic' : 'builtin';

  if (provider !== 'anthropic') {
    const scored = trimmed.map((s) => heuristicSignals(s.text));
    return { signals: spans.map((_, i) => scored[i] || neutral('no result')), provenance: semanticProvenance(), usage: { in: 0, out: 0 } };
  }

  const route = modelRoute();
  let scored, model = route.cheap, escalated = false;
  let usage = { in: 0, out: 0 }; // E1: real token usage for the cost ledger
  try {
    const r1 = await anthropicSignals(trimmed, route.cheap);
    scored = r1.signals; usage = { in: r1.usage.in, out: r1.usage.out };
    if (route.strong !== route.cheap && shouldEscalate(scored)) {
      escalated = true; model = route.strong;
      const r2 = await anthropicSignals(trimmed, route.strong);
      scored = r2.signals; usage = { in: usage.in + r2.usage.in, out: usage.out + r2.usage.out };
    }
  } catch (e) {
    console.warn(`[llm] semantic pass failed (${e.message}) — degrading this batch to neutral signals`);
    scored = trimmed.map(() => neutral('provider error'));
  }
  const provenance = { provider: 'anthropic', model, escalated, ...promptMeta('semantic-signals'), params: { temperature: 0 } };
  return { signals: spans.map((_, i) => scored[i] || neutral('no result')), provenance, usage };
}

/** Nominate up to `limit` candidate spans from the full word list — sentence-
 *  grained windows the loudness prior may have missed. Returns
 *  [{ start, end, text }] snapped to sentence boundaries. */
export async function nominateSpans(words, limit = 4) {
  const sentences = sentencesFrom(words);
  if (!sentences.length) return [];
  const provider = (process.env.LLM_PROVIDER || 'builtin') === 'anthropic' ? 'anthropic' : 'builtin';
  try {
    if (provider === 'anthropic') return await anthropicNominate(sentences, limit);
  } catch (e) {
    console.warn(`[llm] nomination failed (${e.message}) — falling back to heuristic nomination`);
  }
  // builtin: rank sentence-windows by their own heuristic score, take the top.
  const ranked = sentences
    .map((s) => ({ ...s, h: heuristicScalar(s.text) }))
    .sort((a, b) => b.h - a.h)
    .filter((s) => s.h > 0.25);
  return ranked.slice(0, limit).map(({ start, end, text }) => ({ start, end, text }));
}

/** Generate up to `count` short-form hook variants (≤ 9 words each) for a clip
 *  from its transcript span. Real hooks need words and a model: `anthropic`
 *  returns variants editors pick from in the F4 desk; `builtin` (or any failure)
 *  returns [] so the caller falls back to an honest, labelled placeholder —
 *  never an invented "hook" pulled from nothing. */
export async function hookVariants(spanText, count = 3) {
  const provider = (process.env.LLM_PROVIDER || 'builtin') === 'anthropic' ? 'anthropic' : 'builtin';
  const text = String(spanText || '').trim();
  if (provider !== 'anthropic' || !text) return [];
  try {
    const data = await anthropicJSON(
      getPrompt('hook-variants').build({ text: text.slice(0, 4000), count }), 256);
    return (Array.isArray(data) ? data : [])
      .map((s) => String(s).trim().replace(/^["']|["']$/g, '').split(/\s+/).slice(0, 9).join(' '))
      .filter(Boolean)
      .slice(0, count);
  } catch (e) {
    console.warn(`[llm] hook generation failed (${e.message}) — falling back to placeholder`);
    return [];
  }
}

// ── builtin heuristics ──────────────────────────────────────────────────────
// Honest, transparent lexical/structural signals. Not a model — a documented
// prior over the words, in the same spirit as loudness being a prior over the
// audio. Marked `signalsSource: "heuristic"` so the ops desk never mistakes it
// for an LLM read.

const LEX = {
  controversy: ['disagree', 'wrong', 'controversial', 'actually', 'unpopular', 'debate', 'lie', 'myth',
    'nobody', 'everybody', 'never', 'always', 'hate', 'truth', 'fraud', 'scam', 'fight', 'argue', 'but'],
  education: ['because', 'reason', 'means', 'understand', 'learn', 'study', 'research', 'data', 'percent',
    'process', 'method', 'principle', 'explain', 'works', 'system', 'theory', 'evidence', 'key', 'important'],
  emotion: ['amazing', 'incredible', 'terrible', 'love', 'hate', 'fear', 'angry', 'cried', 'shocked',
    'unbelievable', 'devastating', 'thrilled', 'heartbreaking', 'wow', 'insane', 'crazy', 'beautiful'],
  story: ['when', 'remember', 'once', 'happened', 'told', 'realized', 'suddenly', 'began', 'story',
    'moment', 'years', 'ago', 'first', 'then', 'finally', 'until'],
};

function heuristicSignals(text) {
  const t = String(text || '').toLowerCase();
  const toks = t.split(/\s+/).filter(Boolean);
  const n = toks.length;
  if (!n) return neutral('empty span');
  const set = new Set(toks.map((w) => w.replace(/[^a-z']/g, '')));
  const hit = (list) => list.reduce((a, w) => a + (set.has(w) ? 1 : 0), 0);

  // density of marker hits → [0,1] with a gentle saturation
  const sat = (count, k) => 1 - Math.exp(-count / k);
  const controversy = sat(hit(LEX.controversy), 2.5);
  const education = sat(hit(LEX.education), 2.5);
  const emotion = sat(hit(LEX.emotion) + (t.match(/!/g) || []).length * 0.5, 2);
  const story = sat(hit(LEX.story), 3);

  // retention proxy: a healthy speaking pace reads as engaged delivery.
  // (analyze owns the real timing; here we read substance, not pace, so this is
  // a mild content-richness proxy — unique-word ratio in a sensible band.)
  const variety = new Set(toks).size / n;                 // lexical variety
  const retention = clamp01(0.3 + variety);

  // hook: a question or a numeric/curiosity opener in the first ~12 words.
  const opener = toks.slice(0, 12).join(' ');
  const hookStrength = clamp01(
    (/[?]/.test(opener) ? 0.5 : 0) +
    (/\b(\d+|why|how|never|secret|nobody|stop|the one|here's)\b/.test(opener) ? 0.4 : 0) +
    Math.max(controversy, emotion) * 0.3);

  const signals = { retention: r(retention), emotion: r(emotion), controversy: r(controversy),
    education: r(education), story: r(story), hookStrength: r(hookStrength) };
  return { ...signals, rationale: rationaleFor(signals) };
}

/** A single [0,1] scalar for ranking nominated sentence-windows. */
function heuristicScalar(text) {
  const s = heuristicSignals(text);
  return clamp01((s.controversy + s.education + s.emotion + s.story + s.hookStrength) / 5 + s.retention * 0.2);
}

function rationaleFor(s) {
  const top = SIGNAL_KEYS
    .filter((k) => k !== 'retention')
    .map((k) => [k, s[k]])
    .sort((a, b) => b[1] - a[1]);
  const label = { emotion: 'emotional peak', controversy: 'controversial claim',
    education: 'educational insight', story: 'storytelling beat', hookStrength: 'strong hook' };
  if (top[0][1] < 0.2) return 'conversational filler — weak on every semantic signal';
  const lead = label[top[0][0]];
  const second = top[1][1] > 0.4 ? ` with a ${label[top[1][0]]}` : '';
  return `${lead}${second}`;
}

// ── anthropic provider ──────────────────────────────────────────────────────
async function anthropicSignals(spans, model) {
  const { data, usage } = await anthropicJSON(getPrompt('semantic-signals').build(spans), 1024, model);
  const arr = Array.isArray(data) ? data : [];
  return { signals: spans.map((_, i) => normalizeSignals(arr[i])), usage };
}

async function anthropicNominate(sentences, limit) {
  // Hand the model the full sentence list with indices; ask for the best spans.
  const joined = sentences.map((s, i) => `[${i}] (${s.start.toFixed(0)}s) ${s.text}`).join('\n').slice(0, NOMINATE_CHARS);
  const { data } = await anthropicJSON(getPrompt('nominate-spans').build({ joined, limit }), 512);
  const out = [];
  for (const r of Array.isArray(data) ? data : []) {
    const a = Math.max(0, Math.min(sentences.length - 1, Number(r.from)));
    const b = Math.max(a, Math.min(sentences.length - 1, Number(r.to ?? r.from)));
    if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
    const slice = sentences.slice(a, b + 1);
    out.push({ start: slice[0].start, end: slice[slice.length - 1].end, text: slice.map((s) => s.text).join(' ') });
    if (out.length >= limit) break;
  }
  return out;
}

async function anthropicJSON(prompt, maxTokens, model) {
  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) throw new Error('LLM_PROVIDER=anthropic but LLM_API_KEY is unset');
  // R3: timeout + bounded retry + circuit breaker on the LLM call. A tripped
  // breaker fails fast; semanticSignals catches and degrades to neutral.
  const res = await resilientFetch('llm', 'https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: model || process.env.LLM_MODEL || 'claude-haiku-4-5-20251001',
      max_tokens: maxTokens,
      temperature: 0, // Q2: deterministic — same prompt version + inputs → same output
      messages: [{ role: 'user', content: prompt }],
    }),
  }, { timeoutMs: Number(process.env.LLM_TIMEOUT_MS || 30000) });
  if (!res.ok) throw new Error(`anthropic ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const body = await res.json();
  const text = (body.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
  // E1: surface token usage for the cost ledger alongside the parsed result.
  return { data: JSON.parse(stripFences(text)), usage: { in: Number(body.usage?.input_tokens) || 0, out: Number(body.usage?.output_tokens) || 0 } };
}

/** The repo's documented "respond ONLY in JSON, strip fences" guard. */
function stripFences(s) {
  let t = s.trim();
  if (t.startsWith('```')) t = t.replace(/^```[a-z]*\s*/i, '').replace(/```\s*$/, '').trim();
  const first = t.search(/[[{]/);
  const last = Math.max(t.lastIndexOf(']'), t.lastIndexOf('}'));
  return first >= 0 && last > first ? t.slice(first, last + 1) : t;
}

function normalizeSignals(obj) {
  if (!obj || typeof obj !== 'object') return neutral('malformed');
  const out = {};
  for (const k of SIGNAL_KEYS) out[k] = r(clamp01(Number(obj[k])));
  out.rationale = String(obj.rationale || rationaleFor(out)).slice(0, 120);
  return out;
}

// ── sentence + helper utilities ─────────────────────────────────────────────
/** Group word timestamps into sentences using terminal punctuation, with a
 *  length cap so a transcript that never punctuates still yields windows. */
function sentencesFrom(words) {
  const out = [];
  let cur = [];
  for (const w of words || []) {
    cur.push(w);
    const tok = String(w.w || '');
    if (/[.!?]$/.test(tok) || cur.length >= 24) {
      out.push(makeSentence(cur));
      cur = [];
    }
  }
  if (cur.length) out.push(makeSentence(cur));
  return out.filter((s) => s.text.length > 0);
}

function makeSentence(ws) {
  return {
    start: Number(ws[0].s) || 0,
    end: Number(ws[ws.length - 1].e) || Number(ws[ws.length - 1].s) || 0,
    text: ws.map((w) => w.w).join(' ').replace(/\s+([.,!?;:])/g, '$1').trim(),
  };
}

const clamp01 = (x) => (Number.isFinite(x) ? Math.max(0, Math.min(1, x)) : 0);
const r = (x) => Number(clamp01(x).toFixed(2));
const neutral = (why) => ({ retention: 0, emotion: 0, controversy: 0, education: 0, story: 0, hookStrength: 0, rationale: why });

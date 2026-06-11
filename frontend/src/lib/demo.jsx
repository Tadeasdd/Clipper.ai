import React from 'react';
import { prefersReducedMotion } from './motion.jsx';

const DEMO_CLIPS = [
  { id: 1, title: 'The moment everything changed', hook: '"I never thought this would actually work..."', duration: 47, virality: 94, score: 94, timestamp: '12:34 - 13:21', platforms: ['TikTok', 'Reels', 'Shorts'], caption: 'The exact moment the bet paid off, and what it taught me about taking the leap. 🎯', onScreenText: ['I never thought…', 'Then everything changed', 'Watch till the end'], reasons: ['High emotional peak', 'Strong narrative hook', 'Quotable moment'], engagement: { hook: 96, retention: 91, shareability: 89 }, scoreExplanation: 'Opens on a vulnerable admission, then pays it off with a clear turning point, the kind of emotional arc that drives shares and full-watch retention.', thumbnail: 'gradient-1' },
  { id: 2, title: 'Counterintuitive insight on growth', hook: '"Most founders get this completely backwards"', duration: 38, virality: 87, score: 87, timestamp: '24:08 - 24:46', platforms: ['TikTok', 'Reels', 'Shorts', 'X'], caption: 'The growth advice everyone repeats is wrong. Here\u2019s what actually moves the needle.', onScreenText: ['Most founders get this', 'completely backwards', 'Here\u2019s why'], reasons: ['Contrarian take', 'Authority signal', 'Pattern interrupt'], engagement: { hook: 92, retention: 84, shareability: 88 }, scoreExplanation: 'A confident contrarian claim in the first 2 seconds creates a curiosity gap viewers want closed, which is what drives comments and saves.', thumbnail: 'gradient-2' },
  { id: 3, title: 'Three frameworks in 60 seconds', hook: '"Steal these three frameworks I use every day"', duration: 58, virality: 82, score: 82, timestamp: '31:45 - 32:43', platforms: ['Reels', 'Shorts', 'LinkedIn'], caption: 'Three frameworks I use every single day. Steal them. Save this one. 📌', onScreenText: ['Framework 1', 'Framework 2', 'Framework 3'], reasons: ['Listicle format', 'Actionable value', 'Save-worthy'], engagement: { hook: 85, retention: 87, shareability: 76 }, scoreExplanation: 'Numbered, actionable payload signals clear value up front, and listicle structure is among the most save-forwarded formats on Reels and Shorts.', thumbnail: 'gradient-3' },
  { id: 4, title: 'The mistake nobody talks about', hook: '"This is the one thing nobody warned me about"', duration: 42, virality: 78, score: 78, timestamp: '08:15 - 08:57', platforms: ['TikTok', 'Reels'], caption: 'Nobody warned me about this part. If you\u2019re just starting out, watch this. 👀', onScreenText: ['Nobody warned me', 'about this', 'Don\u2019t make my mistake'], reasons: ['Vulnerability hook', 'Curiosity gap', 'Relatable struggle'], engagement: { hook: 88, retention: 79, shareability: 71 }, scoreExplanation: 'Vulnerability plus a curiosity gap (\u201cthe one thing\u201d) is highly relatable to an early-stage audience, driving saves and \u201csending this to a friend.\u201d', thumbnail: 'gradient-4' },
  { id: 5, title: 'Quick tactical breakdown', hook: '"Here\'s exactly how we 10x\'d in 90 days"', duration: 52, virality: 73, score: 73, timestamp: '45:22 - 46:14', platforms: ['Shorts', 'LinkedIn', 'X'], caption: 'The exact 90-day playbook that 10x\u2019d our numbers, broken down step by step.', onScreenText: ['10x in 90 days', 'The exact playbook', 'Step by step'], reasons: ['Specific numbers', 'Case study format', 'Tactical depth'], engagement: { hook: 78, retention: 81, shareability: 68 }, scoreExplanation: 'Concrete numbers and a defined timeframe read as credible and specific, which performs well with a professional LinkedIn/X audience.', thumbnail: 'gradient-5' },
];

// The three selectable sample recordings. Each carries the same five analysed
// moments (the studio always ranks them by virality), so the pick honestly
// changes which *source recording* the run is framed around — its filename,
// length, and the results header — without inventing new scores or data.
// The landing demo's picker hands its selection straight to the studio run.

const _CLIP_BY_ID = Object.fromEntries(DEMO_CLIPS.map((c) => [c.id, c]));

const _orderClips = (...ids) => ids.map((id) => _CLIP_BY_ID[id]).filter(Boolean);

const SAMPLE_RECORDINGS = [
  { label: 'Founder Q&A · Ep. 128', source: 'founder-qa-ep128.mp4 · 1h 02m', meta: { name: 'founder-qa-ep128.mp4', size: '512.0' }, clips: _orderClips(1, 2, 3, 4, 5) },
  { label: 'Weekly Team Standup',   source: 'team-standup-2406.mp4 · 34m',  meta: { name: 'team-standup-2406.mp4', size: '288.6' }, clips: _orderClips(3, 5, 2, 4, 1) },
  { label: 'Q4 Earnings Call',      source: 'q4-earnings-call.mp4 · 51m',   meta: { name: 'q4-earnings-call.mp4', size: '402.3' }, clips: _orderClips(2, 5, 4, 1, 3) },
];

// Shared display helpers (mirror the production results UI).

const CLIP_GRADIENTS = {
  'gradient-1': 'from-[#53fc18] via-[#3fd80f] to-emerald-500',
  'gradient-2': 'from-cyan-400 via-blue-500 to-indigo-600',
  'gradient-3': 'from-emerald-400 via-teal-500 to-cyan-600',
  'gradient-4': 'from-[#53fc18] via-emerald-500 to-teal-600',
  'gradient-5': 'from-violet-400 via-purple-500 to-fuchsia-600',
};

const clipScore = (c) => (typeof c.score === 'number' ? c.score : (c.virality || 0));

const fmtClock = (totalSec) => {
  const s = Math.max(0, Math.round(totalSec || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

const fmtCompact = (n) => {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1_000) return Math.round(n / 1_000) + 'K';
  return String(Math.round(n));
};

const scoreTone = (s) => (s >= 90 ? 'text-emerald-400' : s >= 80 ? 'text-[#53fc18]' : 'text-amber-400');

// Pre-seeded showcase shown in the studio history sidebar.

async function fetchShowcase() {
  await new Promise((r) => setTimeout(r, 120));
  const now = Date.now();
  return [
    { id: 'job_seed1', videoMeta: { name: 'Q4 launch keynote.mp4', size: '482.0' }, clips: DEMO_CLIPS, createdAt: new Date(now - 11 * 60000).toISOString(), processedMs: 134000 },
    { id: 'job_seed2', videoMeta: { name: 'Founder podcast - ep. 12.mp4', size: '321.4' }, clips: DEMO_CLIPS.slice(0, 4), createdAt: new Date(now - 2 * 3600000).toISOString(), processedMs: 95000 },
  ];
}

// ── Staged demo pipeline ──────────────────────────────────────────────────────
// Six genuine stages, each weighted to control how long it dwells. Progress is eased
// *within* each stage (smootherstep, zero velocity at the ends) so the global bar
// visibly slows at every hand-off rather than crawling linearly — it reads as discrete
// work, not a fake timer. `momentsFound` accrues only while the "moments" stage runs,
// then holds. One rAF loop drives everything; reduced motion collapses the run to a
// brief fill (no perpetual animation). ~7s wall-clock, watchable end to end.

const PIPELINE_STAGES = [
  { key: 'ingest',     weight: 0.7 },
  { key: 'transcribe', weight: 2.1 },
  { key: 'moments',    weight: 2.2 },
  { key: 'score',      weight: 1.5 },
  { key: 'caption',    weight: 1.7 },
  { key: 'package',    weight: 1.0 },
];

const PIPELINE_MOMENT_TARGET = DEMO_CLIPS.length; // counter climbs to the # of clips shipped

const MOMENTS_STAGE_INDEX = PIPELINE_STAGES.findIndex((s) => s.key === 'moments');
// smootherstep: eased 0→1 with zero velocity at both ends (slow → fast → slow)

const easeStage = (t) => { const x = t < 0 ? 0 : t > 1 ? 1 : t; return x * x * x * (x * (x * 6 - 15) + 10); };

function runDemoPipeline(_input, { onProgress, clips } = {}) {
  const resultClips = Array.isArray(clips) && clips.length ? clips : DEMO_CLIPS;
  return new Promise((resolve) => {
    const reduced = prefersReducedMotion();
    const totalWeight = PIPELINE_STAGES.reduce((a, s) => a + s.weight, 0);
    const total = reduced ? 600 : 7200; // ms
    const start = performance.now();
    let raf = 0;
    const emit = (pct, idx, eased) => {
      if (!onProgress) return;
      let moments = 0;
      if (idx > MOMENTS_STAGE_INDEX) moments = PIPELINE_MOMENT_TARGET;
      else if (idx === MOMENTS_STAGE_INDEX) moments = Math.round(eased * PIPELINE_MOMENT_TARGET);
      onProgress(pct, idx, { momentsFound: moments, stageKey: PIPELINE_STAGES[idx].key, stageLocal: eased });
    };
    const tick = (now) => {
      const t = Math.min(1, (now - start) / total);
      const wt = t * totalWeight; // weighted time consumed so far
      let acc = 0, idx = 0, local = 0;
      for (let i = 0; i < PIPELINE_STAGES.length; i++) {
        const w = PIPELINE_STAGES[i].weight;
        if (wt <= acc + w || i === PIPELINE_STAGES.length - 1) { idx = i; local = Math.min(1, (wt - acc) / w); break; }
        acc += w;
      }
      const eased = easeStage(local);
      // Fractional percent (not rounded) so the fill advances every animation frame
      // instead of stepping in visible 1% jumps. Display sites round for the % text.
      const pct = Math.min(100, ((acc + eased * PIPELINE_STAGES[idx].weight) / totalWeight) * 100);
      emit(pct, idx, eased);
      if (t < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        emit(100, PIPELINE_STAGES.length - 1, 1);
        cancelAnimationFrame(raf);
        resolve({ clips: resultClips, jobId: 'job_' + Math.random().toString(36).slice(2, 6) });
      }
    };
    raf = requestAnimationFrame(tick);
  });
}

// In-memory feedback widget (the Next.js build imports a backed component).

/* ──────────────────────────────────────────────────────────── ANALYZING */
// Checklist row → pipeline stage key. Now 1:1 with runDemoPipeline's six stages,
// so every row gets an authoritative timestamp the first time the run reaches it
// and the per-row clock reflects real per-stage timing.
const STEP_STAGE = { 0: 'ingest', 1: 'transcribe', 2: 'moments', 3: 'score', 4: 'caption', 5: 'package' };

function fmtElapsed(ms) {
  if (!Number.isFinite(ms) || ms < 0) return '';
  if (ms < 60_000) return (ms / 1000).toFixed(1) + 's';
  const s = Math.floor(ms / 1000);
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}

/* Parse "12:34" → seconds. Returns NaN on anything unexpected so callers can fall back. */
const parseClock = (s) => {
  const m = /^(\d+):(\d{2})$/.exec(String(s || '').trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : NaN;
};

export { CLIP_GRADIENTS, DEMO_CLIPS, MOMENTS_STAGE_INDEX, PIPELINE_MOMENT_TARGET, PIPELINE_STAGES, SAMPLE_RECORDINGS, STEP_STAGE, _CLIP_BY_ID, _orderClips, clipScore, easeStage, fetchShowcase, fmtClock, fmtCompact, fmtElapsed, parseClock, runDemoPipeline, scoreTone };

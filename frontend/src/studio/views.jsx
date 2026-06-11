import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ArrowUpRight, CheckCircle2, ChevronRight, Clock, Download, Film, Flame, Globe, Loader2, Mic, Play, Scissors, Search, Sparkles, TrendingUp, Upload, Users, X, Zap } from 'lucide-react';
import { track } from '../lib/analytics.jsx';
import { CLIP_GRADIENTS, STEP_STAGE, clipScore, fmtClock, fmtCompact, fmtElapsed, parseClock, scoreTone } from '../lib/demo.jsx';
import { prefersReducedMotion, useLoopProgress } from '../lib/motion.jsx';

/* ─────────────────────────────────────────────────── STUDIO BACKDROP
   Ambient layer behind the studio: a soft radial glow, a masked grid, and a
   decorative sonar-ring SVG (slow rotation, pulsing blips) that nods to the
   "signals detected" framing. Fixed, pointer-events-none, sits under <main>
   (which is relative z-10); all motion is gated behind reduced-motion. */
function StudioBackdrop() {
  const TICKS = 48;
  return (
    <div aria-hidden className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
      {/* Top ambient glow — anchors the header */}
      <div
        className="absolute -top-44 left-1/2 -translate-x-1/2 w-[960px] h-[520px]"
        style={{ background: 'radial-gradient(ellipse at center, rgba(83,252,24,0.085), transparent 65%)' }}
      />
      {/* Faint grid, fading downward */}
      <div
        className="absolute inset-x-0 top-0 h-[440px] grid-bg"
        style={{
          opacity: 0.14,
          maskImage: 'linear-gradient(to bottom, rgba(0,0,0,0.9), transparent)',
          WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,0.9), transparent)',
        }}
      />

      {/* Sonar rings — decorative signal-scan SVG, top right */}
      <svg
        viewBox="0 0 560 560"
        fill="none"
        className="absolute -top-28 -right-32 w-[560px] h-[560px]"
        style={{ opacity: 0.34 }}
      >
        <defs>
          <radialGradient id="sbGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#53fc18" stopOpacity="0.14" />
            <stop offset="100%" stopColor="#53fc18" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="sbSweep" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#53fc18" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#53fc18" stopOpacity="0" />
          </linearGradient>
        </defs>

        <circle cx="280" cy="280" r="252" fill="url(#sbGlow)" />

        {/* Static rings */}
        <circle cx="280" cy="280" r="96" stroke="#53fc18" strokeOpacity="0.28" strokeWidth="1" />
        <circle cx="280" cy="280" r="156" stroke="#53fc18" strokeOpacity="0.18" strokeWidth="1" strokeDasharray="3 9" />
        <circle cx="280" cy="280" r="216" stroke="#53fc18" strokeOpacity="0.12" strokeWidth="1" />
        {/* Crosshair */}
        <line x1="280" y1="20" x2="280" y2="540" stroke="#53fc18" strokeOpacity="0.08" strokeWidth="1" />
        <line x1="20" y1="280" x2="540" y2="280" stroke="#53fc18" strokeOpacity="0.08" strokeWidth="1" />

        {/* Rotating layer: degree ticks + sweep wedge + blips */}
        <g className="sonar-spin" style={{ transformBox: 'fill-box', transformOrigin: 'center' }}>
          {Array.from({ length: TICKS }).map((_, i) => {
            const a = (i / TICKS) * Math.PI * 2;
            const long = i % 4 === 0;
            const r1 = long ? 232 : 240;
            const x1 = 280 + Math.cos(a) * r1;
            const y1 = 280 + Math.sin(a) * r1;
            const x2 = 280 + Math.cos(a) * 248;
            const y2 = 280 + Math.sin(a) * 248;
            return (
              <line
                key={i}
                x1={x1.toFixed(1)} y1={y1.toFixed(1)}
                x2={x2.toFixed(1)} y2={y2.toFixed(1)}
                stroke="#53fc18" strokeOpacity={long ? 0.3 : 0.15} strokeWidth="1"
              />
            );
          })}
          {/* Sweep arm */}
          <path d="M 280 280 L 528 280 A 248 248 0 0 0 494.7 156 Z" fill="url(#sbSweep)" opacity="0.35" />
          <line x1="280" y1="280" x2="528" y2="280" stroke="#53fc18" strokeOpacity="0.4" strokeWidth="1" />
          {/* Signal blips */}
          <circle className="sonar-blip" cx="356" cy="196" r="2.5" fill="#53fc18" />
          <circle className="sonar-blip" cx="184" cy="332" r="2" fill="#53fc18" style={{ animationDelay: '1.1s' }} />
          <circle className="sonar-blip" cx="412" cy="356" r="1.8" fill="#aaff66" style={{ animationDelay: '2.2s' }} />
        </g>
        <circle cx="280" cy="280" r="3" fill="#53fc18" fillOpacity="0.6" />
      </svg>

      {/* Counterweight glow, bottom-left — echoes the purple in clip art */}
      <div
        className="absolute -bottom-56 -left-44 w-[620px] h-[620px] rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(120,70,190,0.065), transparent 70%)' }}
      />
    </div>
  );
}

/* ──────────────────────────────────────────────────────────── UPLOAD */
function UploadView({ onFile, fileRef, history = [], onLoadRun, onDeleteRun }) {
  const [drag, setDrag] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const relTime = (iso) => {
    if (!iso) return '';
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(iso).toLocaleDateString();
  };

  return (
    <div className="animate-slide-up">
      <div className="flex items-baseline justify-between mb-10">
        <div>
          <div className="text-xs mono text-stone-500 mb-2 tracking-wider">→ NEW PROJECT</div>
          <h1 className="serif text-5xl tracking-tight">Drop your long-form video</h1>
        </div>
        <div className="text-right text-xs mono text-stone-500">
          <div>SUPPORTED</div>
          <div className="text-stone-400 mt-1">.mp4 · .mov · .webm · up to 4GB</div>
        </div>
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); onFile(e.dataTransfer.files[0]); }}
        onClick={() => fileRef.current?.click()}
        className={`relative cursor-pointer rounded-2xl border-2 border-dashed p-16 text-center transition-all ${
          drag ? 'border-[#53fc18] bg-[#53fc18]/5' : 'border-stone-700 hover:border-stone-600 bg-stone-900/30'
        }`}
      >
        <input ref={fileRef} type="file" accept="video/*" className="hidden" onChange={(e) => onFile(e.target.files[0])} />
        <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-[#53fc18]/20 to-[#53fc18]/10 border border-[#53fc18]/30 flex items-center justify-center mb-6">
          <Upload className="w-7 h-7 text-[#53fc18]" />
        </div>
        <div className="serif text-3xl mb-2">Drop a file or click to browse</div>
        <div className="text-stone-500 text-sm mono">Up to 4GB · .mp4 · .mov · .webm</div>
      </div>

      <div className="grid md:grid-cols-3 gap-4 mt-10">
        {[
          { icon: Sparkles, t: 'Smart segmentation', d: 'Identifies self-contained moments instead of loud spikes.' },
          { icon: TrendingUp, t: 'Virality scoring', d: 'Each clip gets a 0-100 score with reasoning.' },
          { icon: Zap, t: 'Platform-ready exports', d: 'TikTok, Reels, Shorts, X, auto-cropped and captioned.' },
        ].map((f) => (
          <div key={f.t} className="p-6 rounded-xl border border-stone-800 bg-stone-900/30">
            <f.icon className="w-5 h-5 text-[#53fc18] mb-4" />
            <div className="font-medium mb-1">{f.t}</div>
            <div className="text-sm text-stone-400 leading-relaxed">{f.d}</div>
          </div>
        ))}
      </div>

      {/* Real history — saved across sessions */}
      {history.length > 0 && (
        <div className="mt-10">
          <div className="flex items-center justify-between mb-4">
            <div className="text-xs mono text-stone-500 tracking-wider flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#53fc18]" style={{ boxShadow: '0 0 6px #53fc18' }} />
              YOUR RECENT RUNS · {history.length}
            </div>
            <div className="text-[10px] mono text-stone-600 tracking-wider">SAVED LOCALLY</div>
          </div>
          <div className="space-y-2">
            {history.slice(0, 6).map((run) => (
              <div
                key={run.id}
                className="group flex items-center gap-4 p-4 rounded-xl border border-stone-800 bg-stone-900/30 hover:border-[#53fc18]/30 hover:bg-[#53fc18]/[0.02] transition cursor-pointer"
                onClick={() => onLoadRun && onLoadRun(run)}
              >
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#53fc18]/20 to-[#53fc18]/5 border border-[#53fc18]/20 flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-4 h-4 text-[#53fc18]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-stone-200 truncate font-medium">
                    {run.videoMeta?.name || 'Untitled run'}
                  </div>
                  <div className="text-[11px] mono text-stone-500 tracking-wider mt-0.5">
                    {run.clips?.length || 0} clips · {run.videoMeta?.size ? `${run.videoMeta.size}MB · ` : ''}{relTime(run.createdAt)}{Number.isFinite(run.processedMs) && run.processedMs > 0 ? ` · ${fmtElapsed(run.processedMs)}` : ''}
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirmDelete === run.id) {
                      onDeleteRun && onDeleteRun(run.id);
                      setConfirmDelete(null);
                    } else {
                      setConfirmDelete(run.id);
                      setTimeout(() => setConfirmDelete(null), 3000);
                    }
                  }}
                  className={`text-[10px] mono tracking-wider px-2.5 py-1.5 rounded-md transition opacity-0 group-hover:opacity-100 ${
                    confirmDelete === run.id
                      ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                      : 'text-stone-500 hover:text-red-400 border border-transparent hover:border-red-500/20'
                  }`}
                >
                  {confirmDelete === run.id ? 'CONFIRM' : 'DELETE'}
                </button>
                <ArrowUpRight className="w-4 h-4 text-stone-600 group-hover:text-[#53fc18] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AnalyzingView({ progress, step, steps, videoMeta, stageHistory = [], momentsFound = 0 }) {
  // Live clock while mounted so the running stage shows elapsed time. This is a
  // clock, not an animation — under reduced motion the whole run completes in
  // ~0.6s, so it ticks at most once.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  // Client fallbacks for any stage the run hasn't stamped yet.
  const mountedAt = useRef(Date.now());
  const stepStartedAt = useRef(Date.now());
  useEffect(() => { stepStartedAt.current = Date.now(); }, [step]);

  // Parse the synthesized stage_history into a clean, time-sorted list. These are
  // authoritative per-stage timestamps (one per pipeline stage now).
  const hist = (Array.isArray(stageHistory) ? stageHistory : [])
    .map((h) => ({ stage: h && h.stage, ms: Date.parse(h && h.at) }))
    .filter((h) => h.stage && Number.isFinite(h.ms))
    .sort((a, b) => a.ms - b.ms);
  const idxByStage = {};
  hist.forEach((h, i) => { if (!(h.stage in idxByStage)) idxByStage[h.stage] = i; });
  // A stage's duration is the gap to the next recorded stage; the latest recorded
  // stage is still running, so it ticks against `now`.
  const stageDuration = (stage) => {
    const i = idxByStage[stage];
    if (i == null) return null;
    const end = i + 1 < hist.length ? hist[i + 1].ms : now;
    return end - hist[i].ms;
  };
  const t0 = hist.length ? hist[0].ms : mountedAt.current;
  const totalElapsed = fmtElapsed(now - t0);
  const rowTime = (i) => {
    const stage = STEP_STAGE[i];
    const d = stage ? stageDuration(stage) : null;
    if (d != null) return fmtElapsed(d);                          // recorded stage
    if (i === step) return fmtElapsed(now - stepStartedAt.current); // client fallback
    return null;
  };

  // ── Source monitor ──────────────────────────────────────────────────────────
  // Everything below is derived purely from `progress`/`step`/`momentsFound`, so it
  // scrubs in lock-step with the (already-eased) pipeline and needs no second
  // animation loop. Reduced motion is handled upstream by the pipeline's fast path.
  const pct = Math.max(0, Math.min(100, progress));
  const frac = pct / 100;

  // Synthetic transcript that deliberately echoes the clips we ship, so the line
  // scrolling past visibly *becomes* the hooks the user sees in the results grid.
  const TRANSCRIPT = [
    'So', 'the', 'thing', 'nobody', 'tells', 'you', 'about', 'pricing', 'is', 'that',
    'cost-plus', 'is', 'a', 'trap.', 'Most', 'founders', 'get', 'this', 'completely',
    'backwards', '\u2014', 'this', 'next', 'part', 'is', 'completely', 'opposite', 'to',
    'what', 'every', 'thread', 'told', 'us.', 'Steal', 'these', 'three', 'frameworks',
    'I', 'use', 'every', 'day.', 'This', 'is', 'the', 'one', 'thing', 'nobody',
    'warned', 'me', 'about.',
  ];
  const wordCount = TRANSCRIPT.length;
  const activeWord = Math.min(wordCount - 1, Math.floor(frac * wordCount));
  const WINDOW = 9;
  const winStart = Math.max(0, Math.min(wordCount - WINDOW, activeWord - 3));
  const windowWords = TRANSCRIPT.slice(winStart, winStart + WINDOW);

  // Waveform: deterministic per-bar heights with a slow progress-driven shimmer.
  const BARS = 54;
  const playhead = frac; // 0..1 across the strip
  // Where the five moments sit on the source timeline (normalized). A marker lights
  // as the counter climbs past it, so the dots pop in in sync with "moments found".
  const MOMENT_POS = [0.13, 0.31, 0.5, 0.69, 0.86];

  const STEP_ICON = [Film, Mic, Search, TrendingUp, Scissors, Download];
  const STEP_DETAIL = [
    'Reading container & audio track',
    'Aligning words to the waveform',
    'Scanning for hooks, peaks & payoffs',
    'Ranking each candidate by virality',
    'Vertical reframe + burned-in captions',
    'Encoding per-platform deliverables',
  ];

  return (
    <div className="animate-slide-up max-w-3xl mx-auto pt-16">
      <div className="text-center mb-8">
        <div className="text-xs mono text-[#53fc18] mb-3 tracking-wider">→ PROCESSING</div>
        <h1 className="serif text-5xl mb-4">Working through your video</h1>
        <div className="text-stone-500 mono text-sm">{videoMeta?.name} · {videoMeta?.size} MB</div>
      </div>

      {/* Source monitor: scrubbing waveform + transcript + live moments counter */}
      <div className="relative rounded-2xl border border-stone-800 bg-stone-900/40 overflow-hidden mb-6">
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <div className="text-[10px] mono uppercase tracking-[0.2em] text-stone-500 flex items-center gap-2">
            <Loader2 className="w-3 h-3 text-[#53fc18] animate-spin" />
            Scanning source
          </div>
          <div role="status" aria-live="polite" className="flex items-baseline gap-1.5">
            <span
              className="serif text-2xl tabular-nums leading-none transition-colors"
              style={{ color: momentsFound > 0 ? '#53fc18' : '#57534e', textShadow: momentsFound > 0 ? '0 0 14px rgba(83,252,24,0.5)' : 'none' }}
            >
              {momentsFound}
            </span>
            <span className="text-[10px] mono uppercase tracking-wider text-stone-500">moments found</span>
          </div>
        </div>

        <div className="relative px-4 pb-3">
          <div className="relative h-24 flex items-end gap-[2px]">
            {Array.from({ length: BARS }).map((_, j) => {
              const u = j / (BARS - 1);
              const raw = 22 + Math.abs(Math.sin(j * 0.5 + frac * 6)) * 70 * (0.5 + 0.5 * Math.sin(j * 1.7 + 1));
              const h = Math.max(8, Math.min(100, raw));
              const played = u <= playhead;
              const nearHead = Math.abs(u - playhead) < 0.04;
              return (
                <div
                  key={j}
                  className="flex-1 rounded-sm"
                  style={{
                    height: `${h}%`,
                    background: nearHead ? '#aaff66' : played ? '#53fc18' : 'rgba(255,255,255,0.18)',
                    boxShadow: nearHead ? '0 0 8px #53fc18' : 'none',
                    transition: 'background 200ms linear',
                  }}
                />
              );
            })}

            {/* playhead */}
            <div
              className="absolute top-0 bottom-0 w-px bg-[#aaff66]"
              style={{ left: `${playhead * 100}%`, boxShadow: '0 0 10px #53fc18' }}
            />

            {/* moment markers — light up as the counter climbs */}
            {MOMENT_POS.map((mp, i) => {
              const lit = i < momentsFound;
              return (
                <div key={i} className="absolute -top-1" style={{ left: `${mp * 100}%`, transform: 'translateX(-50%)' }}>
                  <div
                    className="rounded-full transition-all"
                    style={{
                      width: lit ? 9 : 5,
                      height: lit ? 9 : 5,
                      background: lit ? '#53fc18' : 'rgba(255,255,255,0.25)',
                      boxShadow: lit ? '0 0 10px #53fc18' : 'none',
                    }}
                  />
                </div>
              );
            })}
          </div>

          {/* transcript line — the active word becomes a hook */}
          <div className="mt-3 h-6 overflow-hidden">
            <div className="flex items-center gap-1.5 whitespace-nowrap text-sm justify-center">
              {windowWords.map((w, k) => {
                const idx = winStart + k;
                const isActive = idx === activeWord;
                const isPast = idx < activeWord;
                return (
                  <span
                    key={idx}
                    className="font-medium transition-all"
                    style={{
                      color: isActive ? '#53fc18' : isPast ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.25)',
                      textShadow: isActive ? '0 0 10px rgba(83,252,24,0.6)' : 'none',
                      transform: isActive ? 'scale(1.06)' : 'scale(1)',
                    }}
                  >
                    {w}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Progress bar — fractional width updated every rAF frame (no transition lag) */}
      <div
        className="clip-pbar relative h-2 rounded-full bg-stone-800 overflow-hidden mb-2"
        style={{ boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.55)' }}
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="clip-pbar-fill" style={{ width: `${pct}%` }}>
          <span className="clip-pbar-sheen" aria-hidden="true" />
          <span className="clip-pbar-edge" aria-hidden="true" />
        </div>
      </div>
      <div className="flex justify-between text-xs mono text-stone-500 mb-8">
        <span>{steps[step]}</span>
        <span className="flex items-center gap-3">
          <span className="text-stone-600 inline-flex items-center gap-1"><Clock className="w-3 h-3" />{totalElapsed}</span>
          <span>{Math.round(pct)}%</span>
        </span>
      </div>

      {/* Step checklist */}
      <div className="space-y-3">
        {steps.map((s, i) => {
          const t = rowTime(i);
          const Icon = STEP_ICON[i] || Sparkles;
          const isActive = i === step;
          const isDone = i < step;
          return (
            <div key={s} className={`flex items-center gap-4 p-4 rounded-xl border transition ${
              isDone ? 'border-stone-800 bg-stone-900/30 text-stone-500' :
              isActive ? 'border-[#53fc18]/40 bg-[#53fc18]/5 text-stone-100' :
              'border-stone-800/60 text-stone-600'
            }`}>
              <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0">
                {isDone ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> :
                 isActive ? <Loader2 className="w-5 h-5 text-[#53fc18] animate-spin" /> :
                 <div className="w-2 h-2 rounded-full bg-stone-700" />}
              </div>
              <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-[#53fc18]' : isDone ? 'text-stone-500' : 'text-stone-700'}`} />
              <div className="flex-1 min-w-0">
                <div className="truncate">{s}</div>
                {isActive && (
                  <div className="text-[11px] mono text-stone-500 mt-0.5 truncate">
                    {STEP_DETAIL[i]}{i === 2 && momentsFound > 0 ? ` \u00b7 ${momentsFound} so far` : ''}
                  </div>
                )}
              </div>
              <div className="text-xs mono tabular-nums">
                {isDone ? (t || 'done') : isActive ? (t ? <span className="text-[#53fc18]">{t}</span> : 'running') : 'queued'}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────── RESULTS */

/* Count-up: animates 0 → target on mount (easeOutCubic, rAF). Reduced motion
   lands on the final value immediately. It only animates toward the real derived
   figure the caller passes in — nothing here invents a number. */
function useCountUp(target, durationMs = 1000) {
  const reduced = prefersReducedMotion();
  const [val, setVal] = useState(reduced ? target : 0);
  useEffect(() => {
    const to = Number(target) || 0;
    if (reduced) { setVal(to); return; }
    let raf, start = null;
    const tick = (t) => {
      if (start == null) start = t;
      const p = Math.min(1, (t - start) / durationMs);
      setVal(to * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick); else setVal(to);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs, reduced]);
  return val;
}

/* Display helper so the headline number can count up without adding a hook to
   ResultsView itself (which returns early for the empty state). */
function StatCountUp({ value, fmt = (n) => Math.round(n), durationMs = 900, className, style }) {
  const v = useCountUp(value, durationMs);
  return <span className={className} style={style}>{fmt(v)}</span>;
}

/* ── Stat micro-visualizations ──────────────────────────────────────
   One shared instrument language across all four stat cards: a thin
   track, fine ruler ticks, data drawn as crisp strokes, and a bright
   dot marking the datum that matters. Dots inside stretched viewBoxes
   are zero-ish-length round-cap path segments with non-scaling stroke,
   so they stay perfectly circular at any card width. */

/* Score distribution — ranked lollipops (stem + dot per clip), with a
   dashed reference line at the batch average. */
function ScoreSpark({ scores }) {
  const n = scores.length;
  const X = (i) => (n > 1 ? 5 + (i / (n - 1)) * 90 : 50);
  const Y = (s) => 30 - (s / 100) * 24;
  const avg = scores.reduce((a, b) => a + b, 0) / Math.max(1, n);
  return (
    <svg viewBox="0 0 100 36" preserveAspectRatio="none" className="w-full h-9 block" aria-hidden="true">
      <line x1="0" y1="31" x2="100" y2="31" stroke="rgba(255,255,255,0.10)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      <line x1="0" y1={Y(avg)} x2="100" y2={Y(avg)} stroke="rgba(255,255,255,0.18)" strokeWidth="1" strokeDasharray="1.5 2.5" vectorEffect="non-scaling-stroke" />
      {scores.map((s, i) => {
        const col = s >= 90 ? '#34d399' : s >= 80 ? '#53fc18' : '#fbbf24';
        const x = X(i);
        const y = Y(s);
        return (
          <g key={i}>
            <rect x={x - 1.7} y={y} width="3.4" height={31 - y} fill={col} opacity="0.12" />
            <line x1={x} y1="31" x2={x} y2={y} stroke={col} strokeOpacity="0.55" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
            <path d={`M ${x} ${y} l 0.01 0`} stroke={col} strokeWidth="5" strokeLinecap="round" vectorEffect="non-scaling-stroke" style={{ filter: `drop-shadow(0 0 3px ${col}99)` }} />
          </g>
        );
      })}
    </svg>
  );
}

/* Runtime composition — each clip's true share of the batch on a thin
   track, boundary ticks between cuts, and the real seconds labelled
   under each segment. */
function RuntimeSpark({ durations }) {
  const total = durations.reduce((s, d) => s + d, 0) || 1;
  let acc = 0;
  const segs = durations.map((d) => {
    const a = (acc / total) * 100;
    acc += d;
    return [a, (acc / total) * 100, d];
  });
  return (
    <svg width="100%" height="36" className="block" aria-hidden="true">
      <line x1="0%" y1="14" x2="100%" y2="14" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
      {segs.map(([a, b, d], i) => (
        <g key={i}>
          <line
            x1={`${a + 0.9}%`} y1="14" x2={`${Math.max(a + 0.9, b - 0.9)}%`} y2="14"
            stroke="#53fc18" strokeOpacity={i % 2 ? 0.5 : 0.9} strokeWidth="3.5" strokeLinecap="round"
            style={{ filter: 'drop-shadow(0 0 3px rgba(83,252,24,0.35))' }}
          />
          {i < segs.length - 1 && (
            <line x1={`${b}%`} y1="9" x2={`${b}%`} y2="19" stroke="rgba(255,255,255,0.14)" strokeWidth="1" />
          )}
          <text x={`${(a + b) / 2}%`} y="31" textAnchor="middle" className="mono" fill="#57534e" style={{ fontSize: 8 }}>
            {d}s
          </text>
        </g>
      ))}
    </svg>
  );
}

/* Reach build-up — cumulative projected reach per clip, smallest first,
   so the curve always climbs to the headline number (marked by the end
   dot). Faint gridlines keep it reading as a chart, not a decoration. */
function ReachSpark({ values }) {
  const sorted = [...values].sort((a, b) => a - b);
  let acc = 0;
  const cum = sorted.map((v) => (acc += v));
  const max = cum[cum.length - 1] || 1;
  const n = cum.length;
  const pts = [[0, 33], ...cum.map((v, i) => [((i + 1) / n) * 100, 33 - (v / max) * 27])];
  const line = pts.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
  const [ex, ey] = pts[pts.length - 1];
  return (
    <svg viewBox="0 0 100 36" preserveAspectRatio="none" className="w-full h-9 block" aria-hidden="true">
      <defs>
        <linearGradient id="reachFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#53fc18" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#53fc18" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[13, 23].map((y) => (
        <line key={y} x1="0" y1={y} x2="100" y2={y} stroke="rgba(255,255,255,0.06)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      ))}
      <line x1="0" y1="33" x2="100" y2="33" stroke="rgba(255,255,255,0.10)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      <polygon points={`0,33 ${line} 100,33`} fill="url(#reachFill)" />
      <polyline
        points={line} fill="none" stroke="#53fc18" strokeWidth="1.5"
        strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke"
        style={{ filter: 'drop-shadow(0 0 3px rgba(83,252,24,0.7))' }}
      />
      {pts.slice(1, -1).map(([x, y], i) => (
        <path
          key={i} d={`M ${x.toFixed(2)} ${y.toFixed(2)} l 0.01 0`} stroke="#53fc18" strokeWidth="3"
          strokeLinecap="round" vectorEffect="non-scaling-stroke"
          style={{ filter: 'drop-shadow(0 0 3px rgba(83,252,24,0.7))' }}
        />
      ))}
      <path
        d={`M ${ex.toFixed(2)} ${ey.toFixed(2)} l 0.01 0`} stroke="#aaff66" strokeWidth="4.5" strokeLinecap="round"
        vectorEffect="non-scaling-stroke" style={{ filter: 'drop-shadow(0 0 4px rgba(83,252,24,0.9))' }}
      />
    </svg>
  );
}

/* A neon stat tile: icon chip, count-up value, hover glow, and a data-derived
   micro-visualization passed in as `m.viz`. Boots in staggered: tile rises,
   viz wipes on like a plotter, and the value flashes as its count-up lands.
   Hover gets the same cursor-tracking spotlight as the clip cards. */
function StatCard({ m, index }) {
  const shown = useCountUp(m.raw, 900 + index * 110);
  const [hot, setHot] = useState(false);
  const ref = useRef(null);
  const d = 150 + index * 90; // entrance stagger (ms)
  const onMove = (e) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${(((e.clientX - r.left) / r.width) * 100).toFixed(2)}%`);
    el.style.setProperty('--my', `${(((e.clientY - r.top) / r.height) * 100).toFixed(2)}%`);
  };
  return (
    <div
      ref={ref}
      onMouseEnter={() => setHot(true)}
      onMouseLeave={() => setHot(false)}
      onMouseMove={onMove}
      className="spot-host stat-enter tilt-card group relative p-5 rounded-xl border bg-stone-900/30 overflow-hidden transition-all duration-300"
      style={{
        animationDelay: `${d}ms`,
        borderColor: hot ? 'rgba(83,252,24,0.28)' : 'rgba(255,255,255,0.09)',
        boxShadow: hot ? '0 14px 38px -22px rgba(83,252,24,0.4)' : 'none',
      }}
    >
      <span aria-hidden className="panel-grid" />
      <span aria-hidden className="clip-spot" />
      <span aria-hidden className="clip-ring" />
      <span aria-hidden className="absolute inset-x-0 top-0 h-px" style={{
        background: 'linear-gradient(90deg, transparent, rgba(83,252,24,0.75), transparent)',
        opacity: hot ? 1 : 0.35, transition: 'opacity .3s',
      }} />
      <span aria-hidden className="absolute -top-12 -right-10 w-28 h-28 rounded-full pointer-events-none" style={{
        background: 'radial-gradient(circle, rgba(83,252,24,0.16), transparent 70%)',
        opacity: hot ? 1 : 0, transition: 'opacity .35s',
      }} />
      <div className="relative flex items-center justify-between mb-3">
        <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-[#53fc18]/25 bg-[#53fc18]/[0.06]">
          <m.icon className="w-4 h-4 text-[#53fc18]" />
        </span>
        {m.tag && <span className="text-[9px] mono uppercase tracking-[0.16em] text-stone-600">{m.tag}</span>}
      </div>
      <div className="relative text-xs mono text-stone-500 mb-1">{m.l}</div>
      <div className="relative flex items-baseline gap-1 mb-3">
        <span
          className="val-lock serif text-3xl tabular-nums"
          style={{ animationDelay: `${d + 900 + index * 110}ms`, textShadow: '0 0 22px rgba(83,252,24,0.18)' }}
        >
          {m.fmt(shown)}
        </span>
        <span className="text-xs text-stone-500">{m.s}</span>
      </div>
      <div className="viz-reveal relative" style={{ animationDelay: `${d + 280}ms` }}>{m.viz}</div>
    </div>
  );
}

/* A labelled ruler-meter: tick scale every 5%, thin track, and a round-cap
   fill drawn in via pathLength dash-offset (same mechanic as the gauge),
   landing a bright head dot at the value. Value is a real per-signal average. */
function Meter({ label, value, delay }) {
  const reduced = prefersReducedMotion();
  const [on, setOn] = useState(reduced);
  useEffect(() => {
    if (reduced) { setOn(true); return; }
    const id = requestAnimationFrame(() => setOn(true));
    return () => cancelAnimationFrame(id);
  }, [reduced]);
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-stone-400">{label}</span>
        <StatCountUp value={value} durationMs={1000 + delay} className="text-xs mono text-[#53fc18] tabular-nums" />
      </div>
      <svg width="100%" height="15" className="block" aria-hidden="true">
        {Array.from({ length: 21 }, (_, i) => (
          <line
            key={i} x1={`${i * 5}%`} y1={i % 2 ? 9.5 : 7.5} x2={`${i * 5}%`} y2="12"
            stroke={i * 5 <= value ? 'rgba(83,252,24,0.4)' : 'rgba(255,255,255,0.12)'} strokeWidth="1"
          />
        ))}
        <line x1="0%" y1="5" x2="100%" y2="5" stroke="rgba(255,255,255,0.08)" strokeWidth="2" />
        <line
          x1="0%" y1="5" x2="100%" y2="5" stroke="#53fc18" strokeWidth="3" strokeLinecap="round"
          pathLength="100" strokeDasharray={`${value} 100`} strokeDashoffset={on ? 0 : value}
          style={{
            transition: 'stroke-dashoffset 1s cubic-bezier(.16,1,.3,1)',
            transitionDelay: `${delay}ms`,
            filter: 'drop-shadow(0 0 3px rgba(83,252,24,0.45))',
          }}
        />
        <circle
          cx={`${value}%`} cy="5" r="2.8" fill="#aaff66" className="meter-dot"
          style={{
            opacity: on ? 1 : 0,
            transition: 'opacity .4s ease',
            transitionDelay: `${delay + 750}ms`,
            filter: 'drop-shadow(0 0 4px rgba(83,252,24,0.9))',
          }}
        />
      </svg>
    </div>
  );
}

/* Engagement radar — the three real signal averages plotted as a triangle.
   Rings at 33/66/100, spokes per axis, value polygon scales in with glowing
   vertex dots. Fixed-aspect SVG so the tiny labels never distort. */
function EngagementRadar({ profile }) {
  const C = [60, 58], R = 42;
  const A = [-90, 30, 150].map((d) => (d * Math.PI) / 180);
  const pt = (ai, f) => [C[0] + Math.cos(A[ai]) * R * f, C[1] + Math.sin(A[ai]) * R * f];
  const ring = (f) => A.map((_, i) => pt(i, f).map((n) => n.toFixed(1)).join(',')).join(' ');
  const poly = profile.map((p, i) => pt(i, Math.max(0, Math.min(100, p.v)) / 100));
  const labels = [
    { t: 'HOOK', x: C[0], y: 9, anchor: 'middle' },
    { t: 'RETAIN', x: C[0] + Math.cos(A[1]) * (R + 7), y: C[1] + Math.sin(A[1]) * (R + 7) + 7, anchor: 'middle' },
    { t: 'SHARE', x: C[0] + Math.cos(A[2]) * (R + 7), y: C[1] + Math.sin(A[2]) * (R + 7) + 7, anchor: 'middle' },
  ];
  return (
    <svg viewBox="0 0 120 110" className="block w-[104px] h-[96px]" aria-hidden="true">
      {[0.33, 0.66, 1].map((f) => (
        <polygon key={f} points={ring(f)} fill="none" stroke="rgba(255,255,255,0.09)" strokeWidth="1" />
      ))}
      {A.map((_, i) => {
        const [x, y] = pt(i, 1);
        return <line key={i} x1={C[0]} y1={C[1]} x2={x} y2={y} stroke="rgba(255,255,255,0.07)" strokeWidth="1" />;
      })}
      <g className="radar-in" style={{ animationDelay: '880ms' }}>
        <polygon
          points={poly.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')}
          fill="rgba(83,252,24,0.15)" stroke="#53fc18" strokeWidth="1.5" strokeLinejoin="round"
          style={{ filter: 'drop-shadow(0 0 5px rgba(83,252,24,0.5))' }}
        />
        {poly.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="2.1" fill="#aaff66" style={{ filter: 'drop-shadow(0 0 4px rgba(83,252,24,0.9))' }} />
        ))}
      </g>
      {labels.map((l) => (
        <text key={l.t} x={l.x} y={l.y} textAnchor={l.anchor} className="mono" fill="#57534e" style={{ fontSize: 7, letterSpacing: '0.12em' }}>
          {l.t}
        </text>
      ))}
    </svg>
  );
}

/* Source map — the waveform becomes a map of the recording. A synthesized
   (deterministic, decorative) audio signature draws in mirrored around the
   centerline, then the *real* extracted clip regions land on it as glowing
   bands placed by each clip's true timestamps against the source length.
   Hovering a band reads out which clip was cut there. */
function ResultsWave({ totalSec, sourceEnd, clips = [] }) {
  const [hov, setHov] = useState(null);
  const { top, bottom, body } = useMemo(() => {
    const N = 160, t = [], b = [];
    for (let i = 0; i <= N; i++) {
      const x = ((i / N) * 1200).toFixed(1);
      const env = Math.pow(Math.sin((i / N) * Math.PI), 0.6); // fade at both edges
      const a =
        Math.abs(Math.sin(i * 0.43) * 13 + Math.sin(i * 0.117 + 1.7) * 9 + Math.sin(i * 0.95 + 0.4) * 4) * env + 1.2;
      t.push(`${x},${(40 - a).toFixed(1)}`);
      b.push(`${x},${(40 + a * 0.78).toFixed(1)}`);
    }
    return { top: t.join(' '), bottom: b.join(' '), body: `M ${t.join(' L ')} L ${[...b].reverse().join(' L ')} Z` };
  }, []);

  // Real clip regions, positioned by timestamp against the source length.
  const len = Number.isFinite(sourceEnd) && sourceEnd > 0 ? sourceEnd : 0;
  const regions = len
    ? clips
        .map((c, i) => {
          const [s, e] = String(c.timestamp || '').split('-').map((p) => parseClock(p));
          if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s) return null;
          const x1 = (s / len) * 1200;
          const x2 = Math.max(x1 + 14, (e / len) * 1200);
          return { i, x1, x2, c };
        })
        .filter(Boolean)
    : [];

  return (
    <div aria-hidden className="relative -mt-4 mb-10 select-none">
      <div className="relative overflow-hidden">
        <svg viewBox="0 0 1200 80" preserveAspectRatio="none" className="block w-full h-16">
        <defs>
          <linearGradient id="rwStroke" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#53fc18" stopOpacity="0" />
            <stop offset="16%" stopColor="#53fc18" stopOpacity="0.85" />
            <stop offset="52%" stopColor="#aaff66" stopOpacity="1" />
            <stop offset="84%" stopColor="#53fc18" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#53fc18" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="rwBody" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#53fc18" stopOpacity="0.13" />
            <stop offset="50%" stopColor="#53fc18" stopOpacity="0.05" />
            <stop offset="100%" stopColor="#53fc18" stopOpacity="0.11" />
          </linearGradient>
          <linearGradient id="rwRegion" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#53fc18" stopOpacity="0.22" />
            <stop offset="55%" stopColor="#53fc18" stopOpacity="0.05" />
            <stop offset="100%" stopColor="#53fc18" stopOpacity="0.14" />
          </linearGradient>
        </defs>
        <line x1="0" y1="40" x2="1200" y2="40" stroke="rgba(255,255,255,0.07)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        {/* Mirrored audio body fades in beneath the lead traces. */}
        <path className="wave-fill-in" d={body} fill="url(#rwBody)" />
        {/* Extracted clip regions — real cut positions on the source. */}
        {regions.map(({ i, x1, x2 }) => (
          <g key={i} className="region-in" style={{ animationDelay: `${2.25 + i * 0.13}s` }}>
            <rect
              x={x1} y={6} width={x2 - x1} height={68} rx={2}
              fill="url(#rwRegion)" opacity={hov === i ? 1 : 0.66}
              style={{ transition: 'opacity .25s ease', cursor: 'crosshair' }}
              pointerEvents="auto"
              onMouseEnter={() => setHov(i)}
              onMouseLeave={() => setHov(null)}
            />
            <line x1={x1} y1={6} x2={x1} y2={74} stroke="#53fc18" strokeOpacity={hov === i ? 0.9 : 0.45} strokeWidth="1" vectorEffect="non-scaling-stroke" style={{ transition: 'stroke-opacity .25s ease' }} />
            <line x1={x2} y1={6} x2={x2} y2={74} stroke="#53fc18" strokeOpacity={hov === i ? 0.9 : 0.45} strokeWidth="1" vectorEffect="non-scaling-stroke" style={{ transition: 'stroke-opacity .25s ease' }} />
          </g>
        ))}
        <polyline
          className="wave-draw"
          points={top}
          pathLength="1"
          fill="none"
          stroke="url(#rwStroke)"
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          style={{ filter: 'drop-shadow(0 0 6px rgba(83,252,24,0.55))' }}
        />
        <polyline
          className="wave-draw"
          points={bottom}
          pathLength="1"
          fill="none"
          stroke="#53fc18"
          strokeOpacity="0.35"
          strokeWidth="1"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
        {/* Rank labels above each extracted region (HTML so glyphs never stretch). */}
        {regions.map(({ i, x1, x2 }) => (
          <span
            key={i}
            className="region-in absolute top-0.5 -translate-x-1/2 text-[9px] mono tabular-nums pointer-events-none"
            style={{
              left: `${(((x1 + x2) / 2) / 1200) * 100}%`,
              color: hov === i ? '#aaff66' : 'rgba(134,239,172,0.55)',
              textShadow: hov === i ? '0 0 8px rgba(83,252,24,0.8)' : 'none',
              transition: 'color .25s ease',
              animationDelay: `${2.25 + i * 0.13}s`,
            }}
          >
            {String(i + 1).padStart(2, '0')}
          </span>
        ))}
        {/* Scan-head: a bright vertical beam + soft trail that leads the draw. */}
        <span className="wave-scan" />
        {/* …then a faint radar-style rescan keeps drifting across. */}
        <span className="wave-rescan" />
      </div>
      <div className="flex items-center justify-between mt-1 text-[9px] mono tracking-[0.18em] text-stone-600 uppercase">
        <span>0:00</span>
        {hov != null && clips[hov] ? (
          <span className="text-[#53fc18] normal-case tracking-[0.12em]" style={{ textShadow: '0 0 10px rgba(83,252,24,0.4)' }}>
            №{String(hov + 1).padStart(2, '0')} · {clips[hov].title} · {clips[hov].duration}s · {clips[hov].timestamp}
          </span>
        ) : (
          <span className="text-stone-700">· source waveform · {regions.length ? `${regions.length} segments extracted` : 'analyzed'}</span>
        )}
        <span>{fmtClock(len || totalSec)}</span>
      </div>
    </div>
  );
}

function ResultsView({ clips, onSelect, onReset, videoMeta, processedMs, bookCall }) {
  const [sort, setSort] = useState('virality');
  const [busy, setBusy] = useState(null); // simulated packaging state (demo)

  // Empty state — parity with production (unreachable with the seeded demo data).
  if (!clips.length) {
    return (
      <div className="animate-slide-up max-w-2xl mx-auto pt-16 text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl border border-stone-700 bg-stone-900/40 mb-6">
          <Film className="w-7 h-7 text-stone-500" />
        </div>
        <div className="text-xs mono text-stone-500 mb-3 tracking-wider">→ NO CLIPS FOUND</div>
        <h1 className="serif text-5xl mb-4">Nothing clippable this time</h1>
        <p className="text-stone-400 mb-8">
          We analyzed {videoMeta?.name ? <span className="mono text-stone-300">{videoMeta.name}</span> : 'your video'} but
          didn’t find moments that clear the bar. Longer, conversational source video tends to yield the best clips.
        </p>
        <button onClick={onReset} className="btn-neon px-5 py-3 rounded-lg font-medium">
          Replay sample
        </button>
      </div>
    );
  }

  const sorted = [...clips].sort((a, b) =>
    sort === 'virality' ? clipScore(b) - clipScore(a) : (a.duration || 0) - (b.duration || 0));

  // Real, derived stats (no hardcoded numbers) — mirrors production.
  const scores = clips.map(clipScore);
  const durations = clips.map((c) => c.duration || 0);
  const avg = Math.round(scores.reduce((s, n) => s + n, 0) / scores.length);
  const top = Math.max(...scores);
  const totalSec = durations.reduce((s, d) => s + d, 0);
  // Latest cut-point across the batch ≈ usable length of the source recording;
  // drives each card's mini source-timeline.
  const sourceEnd = Math.max(0, ...clips.map((c) => parseClock(String(c.timestamp || '').split('-')[1])).filter(Number.isFinite));
  const reachParts = clips.map((c) => Math.pow(clipScore(c) / 100, 2) * 60000);
  const totalReach = reachParts.reduce((s, n) => s + n, 0);

  // Best clip (for the top-score card label) + sorted distribution for the spark.
  const topClip = clips.reduce((b, c) => (clipScore(c) > clipScore(b) ? c : b), clips[0]);
  const distScores = [...scores].sort((a, b) => b - a);

  // Engagement profile — averages across each clip's real per-signal scores.
  const eng = clips.map((c) => c.engagement).filter(Boolean);
  const engAvg = (k) => (eng.length ? Math.round(eng.reduce((s, e) => s + (e[k] || 0), 0) / eng.length) : 0);
  const profile = [
    { k: 'Hook strength', v: engAvg('hook') },
    { k: 'Retention', v: engAvg('retention') },
    { k: 'Shareability', v: engAvg('shareability') },
  ];

  // Signals detected — the reason tags the scorer attached, counted across clips.
  const signalCount = {};
  clips.forEach((c) => (c.reasons || []).forEach((r) => { signalCount[r] = (signalCount[r] || 0) + 1; }));
  const signals = Object.entries(signalCount).sort((a, b) => b[1] - a[1]);

  // Platform coverage across the whole batch.
  const platformSet = Array.from(new Set(clips.flatMap((c) => c.platforms || [])));

  const stats = [
    {
      l: 'Avg virality', raw: avg, fmt: (n) => Math.round(n), s: '/100', icon: Flame,
      tag: `${clips.length} clips`, viz: <ScoreSpark scores={distScores} />,
    },
    {
      l: 'Top score', raw: top, fmt: (n) => Math.round(n), s: '/100', icon: TrendingUp, tag: 'best',
      viz: (
        <div>
          {/* 0–100 ruler: ticks every 10, lit up to the score; marker dot at the score. */}
          <svg width="100%" height="18" className="block" aria-hidden="true">
            {Array.from({ length: 11 }, (_, i) => (
              <line
                key={i} x1={`${i * 10}%`} y1={i % 5 ? 10 : 7.5} x2={`${i * 10}%`} y2="14"
                stroke={i * 10 <= top ? 'rgba(83,252,24,0.45)' : 'rgba(255,255,255,0.14)'} strokeWidth="1"
              />
            ))}
            <line x1="0%" y1="5" x2="100%" y2="5" stroke="rgba(255,255,255,0.08)" strokeWidth="2" />
            <line
              x1="0%" y1="5" x2={`${top}%`} y2="5" stroke="#53fc18" strokeWidth="3" strokeLinecap="round"
              style={{ filter: 'drop-shadow(0 0 3px rgba(83,252,24,0.5))' }}
            />
            <circle cx={`${top}%`} cy="5" r="3" fill="#aaff66" style={{ filter: 'drop-shadow(0 0 4px rgba(83,252,24,0.9))' }} />
          </svg>
          <div className="mt-1.5 text-[10px] mono text-stone-600 truncate" title={topClip?.title}>↑ {topClip?.title}</div>
        </div>
      ),
    },
    {
      l: 'Total runtime', raw: totalSec, fmt: (n) => fmtClock(n), s: 'min:sec', icon: Clock,
      tag: `avg ${Math.round(totalSec / clips.length)}s`, viz: <RuntimeSpark durations={durations} />,
    },
    {
      l: 'Est. reach', raw: totalReach, fmt: (n) => fmtCompact(n), s: 'projected', icon: Users,
      tag: `${platformSet.length} platforms`, viz: <ReachSpark values={reachParts} />,
    },
  ];

  // Demo-only: the live app streams a real store-only .zip of rendered clips.
  const downloadAll = () => {
    if (busy) return;
    setBusy('Packaging zip…');
    setTimeout(() => setBusy(null), 1200);
  };

  return (
    <div className="animate-slide-up">
      <div className="flex flex-wrap items-baseline justify-between gap-4 mb-2">
        <div>
          <div className="text-xs mono text-emerald-400 mb-2 tracking-wider flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5" /> ANALYSIS COMPLETE
          </div>
          <h1 className="serif text-5xl tracking-tight">
            <span className="relative inline-block">
              <span aria-hidden className="head-ping" />
              <StatCountUp value={clips.length} className="relative text-[#53fc18] tabular-nums" style={{ textShadow: '0 0 26px rgba(83,252,24,0.55)' }} />
            </span>{' '}
            {clips.length === 1 ? 'clip' : 'clips'} <span className="italic gradient-green">ready to ship</span>
          </h1>
        </div>
        <button onClick={onReset} className="text-sm text-stone-400 hover:text-stone-100 mono">
          ↻ Replay sample
        </button>
      </div>
      <p className="text-stone-500 mb-10">From <span className="mono text-stone-300">{videoMeta?.name || 'your video'}</span> · ranked by viral potential{Number.isFinite(processedMs) && processedMs > 0 ? <> · processed in <span className="mono text-stone-300">{fmtElapsed(processedMs)}</span></> : ''}</p>

      <ResultsWave totalSec={totalSec} sourceEnd={sourceEnd} clips={clips} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        {stats.map((m, i) => (
          <StatCard key={m.l} m={m} index={i} />
        ))}
      </div>

      <div className="grid md:grid-cols-5 gap-4 mb-10">
        {/* Engagement profile — real per-signal averages across the batch. */}
        <div className="vf-corners stat-enter tilt-card relative md:col-span-2 p-5 rounded-xl border border-stone-800 bg-stone-900/30 overflow-hidden" style={{ animationDelay: '540ms' }}>
          <span aria-hidden className="panel-grid" />
          <span aria-hidden className="absolute inset-x-0 top-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(83,252,24,0.6), transparent)' }} />
          <div className="relative flex items-center gap-2 mb-4">
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg border border-[#53fc18]/25 bg-[#53fc18]/[0.06]">
              <Zap className="w-3.5 h-3.5 text-[#53fc18]" />
            </span>
            <span className="text-xs mono text-stone-400 tracking-wider">ENGAGEMENT PROFILE</span>
          </div>
          <div className="relative flex items-center gap-5">
            <div className="hidden sm:block shrink-0">
              <EngagementRadar profile={profile} />
            </div>
            <div className="flex-1 min-w-0 space-y-3.5">
              {profile.map((p, i) => (
                <Meter key={p.k} label={p.k} value={p.v} delay={620 + i * 160} />
              ))}
            </div>
          </div>
        </div>

        {/* Signals detected — the scorer's real reason tags, counted across clips. */}
        <div className="vf-corners stat-enter tilt-card relative md:col-span-3 p-5 rounded-xl border border-stone-800 bg-stone-900/30 overflow-hidden" style={{ animationDelay: '640ms' }}>
          <span aria-hidden className="panel-grid" />
          <span aria-hidden className="absolute inset-x-0 top-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(83,252,24,0.6), transparent)' }} />
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg border border-[#53fc18]/25 bg-[#53fc18]/[0.06]">
                <Sparkles className="w-3.5 h-3.5 text-[#53fc18]" />
              </span>
              <span className="text-xs mono text-stone-400 tracking-wider">SIGNALS DETECTED</span>
            </div>
            <span className="text-[10px] mono text-stone-600">{signals.length} types</span>
          </div>
          <div className="flex flex-wrap gap-2 mb-5">
            {signals.map(([name, count]) => (
              <span key={name} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-[#53fc18]/25 bg-[#53fc18]/[0.05] text-xs text-stone-200">
                <span className="w-1.5 h-1.5 rounded-full bg-[#53fc18]" style={{ boxShadow: '0 0 6px rgba(83,252,24,0.9)' }} />
                {name}
                {count > 1 && <span className="mono text-[10px] text-[#53fc18]">×{count}</span>}
              </span>
            ))}
          </div>
          <div className="pt-4 border-t border-stone-800/80">
            <div className="flex items-center gap-2 mb-2.5">
              <Globe className="w-3.5 h-3.5 text-stone-500" />
              <span className="text-[10px] mono text-stone-500 tracking-wider uppercase">Formatted for</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {platformSet.map((p) => (
                <span key={p} className="px-2.5 py-1 rounded-md border border-stone-700 bg-stone-800/40 text-[11px] mono text-stone-300">
                  {p}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <span className="text-xs mono text-stone-500">SORT</span>
        {['virality', 'duration'].map((k) => (
          <button key={k} onClick={() => setSort(k)} className={`px-3 py-1.5 rounded-md text-xs mono transition ${
            sort === k ? 'bg-stone-100 text-stone-950' : 'text-stone-400 hover:text-stone-100'
          }`}>
            {k}
          </button>
        ))}
        <div className="flex-1" />
        <span className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[#53fc18]/40 bg-[#53fc18]/[0.06] text-[#53fc18] text-xs mono">
          <span className="relative flex w-1.5 h-1.5">
            <span className="motion-safe:animate-ping absolute inline-flex w-full h-full rounded-full bg-[#53fc18] opacity-60" />
            <span className="relative inline-flex w-1.5 h-1.5 rounded-full bg-[#53fc18]" style={{ boxShadow: '0 0 6px rgba(83,252,24,0.9)' }} />
          </span>
          <CheckCircle2 className="w-3.5 h-3.5" />
          Editor-reviewed · delivered to your queue
        </span>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {sorted.map((clip, i) => (
          <ClipCard key={clip.id} clip={clip} rank={i + 1} onSelect={() => onSelect(clip)} sourceEnd={sourceEnd} />
        ))}
      </div>

      <div className="vf-corners relative overflow-hidden mt-12 rounded-2xl border border-[#53fc18]/30 bg-gradient-to-br from-[#53fc18]/[0.07] to-transparent p-8 text-center">
        {/* Decorative concentric rings — anchor the panel's corners */}
        <svg aria-hidden viewBox="0 0 200 200" fill="none" className="absolute -right-16 -top-20 w-72 h-72 pointer-events-none" style={{ opacity: 0.22 }}>
          <circle cx="100" cy="100" r="34" stroke="#53fc18" strokeOpacity="0.55" strokeWidth="1" />
          <circle cx="100" cy="100" r="58" stroke="#53fc18" strokeOpacity="0.35" strokeWidth="1" strokeDasharray="2 7" />
          <circle cx="100" cy="100" r="82" stroke="#53fc18" strokeOpacity="0.22" strokeWidth="1" />
          <circle cx="100" cy="100" r="2.5" fill="#53fc18" fillOpacity="0.7" />
        </svg>
        <svg aria-hidden viewBox="0 0 200 200" fill="none" className="absolute -left-20 -bottom-24 w-64 h-64 pointer-events-none" style={{ opacity: 0.14 }}>
          <circle cx="100" cy="100" r="46" stroke="#53fc18" strokeOpacity="0.5" strokeWidth="1" strokeDasharray="2 7" />
          <circle cx="100" cy="100" r="78" stroke="#53fc18" strokeOpacity="0.28" strokeWidth="1" />
        </svg>

        <div className="relative">
          <div className="text-xs mono text-[#53fc18] mb-3 tracking-wider">→ THIS IS A SAMPLE</div>
          <h2 className="serif text-3xl tracking-tight mb-3">This is a sample of what we'd deliver from a single recording.</h2>
          <p className="text-stone-400 max-w-xl mx-auto mb-7">
            Your account team handles the whole pipeline: strategy, editing, and review. Finished clips land in your queue. No tools to learn.
          </p>
          <button
            onClick={bookCall}
            className="btn-neon cta-glow magnetic-glow group px-6 py-3 rounded-lg font-medium inline-flex items-center gap-2"
          >
            Book a demo
            <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function ClipFrame({ clip, rank, className = '' }) {
  const lines = Array.isArray(clip.onScreenText) ? clip.onScreenText.slice(0, 3) : [];
  const platforms = clip.platforms || [];
  const BARS = 16;
  return (
    <div className={`relative aspect-[9/16] w-full bg-black overflow-hidden ${className}`}>
        <div className={`absolute inset-0 bg-gradient-to-br ${CLIP_GRADIENTS[clip.thumbnail] || CLIP_GRADIENTS['gradient-1']} opacity-25`} />
        <div
          className="absolute inset-0"
          style={{ background: 'radial-gradient(ellipse at 30% 35%, rgba(83,252,24,0.18), transparent 60%), radial-gradient(ellipse at 70% 65%, rgba(150,80,200,0.14), transparent 60%)' }}
        />
        <div className="absolute inset-0 bg-black/30" />

        <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-sm text-[9px] mono text-white/90 leading-none">
          {String(rank).padStart(2, '0')}
        </div>
        {platforms[0] && (
          <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/55 backdrop-blur-sm text-[9px] mono text-[#53fc18] leading-none">
            {platforms[0]}
          </div>
        )}

        <div className="absolute left-0 right-0 top-[38%] -translate-y-1/2 flex items-center justify-center gap-[2px] px-3 h-12">
          {Array.from({ length: BARS }).map((_, j) => {
            const h = 24 + Math.abs(Math.sin(j * 0.7 + clip.id)) * 60;
            const lit = j < BARS * 0.55;
            return (
              <span
                key={j}
                className="w-[2px] rounded-full"
                style={{
                  height: `${h}%`,
                  background: lit ? 'rgba(83,252,24,0.85)' : 'rgba(255,255,255,0.25)',
                  boxShadow: lit ? '0 0 4px rgba(83,252,24,0.55)' : 'none',
                }}
              />
            );
          })}
        </div>

        <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="w-9 h-9 rounded-full bg-black/35 backdrop-blur-md flex items-center justify-center opacity-0 group-hover/pv:opacity-100 transition">
            <Play className="w-4 h-4 text-white fill-white ml-0.5" />
          </span>
        </span>

        {lines.length > 0 && (
          <div className="absolute left-1.5 right-1.5 bottom-7 flex flex-col items-center gap-0.5 text-center">
            {lines.map((t, i) => (
              <span
                key={i}
                className="font-bold leading-tight text-[11px] sm:text-xs"
                style={{
                  color: i === lines.length - 1 ? '#53fc18' : '#ffffff',
                  textShadow:
                    i === lines.length - 1
                      ? '0 0 10px rgba(83,252,24,0.7), 0 2px 4px rgba(0,0,0,0.85)'
                      : '0 2px 4px rgba(0,0,0,0.85)',
                }}
              >
                {t}
              </span>
            ))}
          </div>
        )}

        <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/65 backdrop-blur-sm text-[9px] mono text-white/90 leading-none">
          {fmtClock(clip.duration)}
        </div>
        <div className="absolute bottom-1.5 left-1.5 text-[7px] mono tracking-wider text-white/40 leading-none">
          CLIPPER.AI
        </div>
    </div>
  );
}

/* ScoreGauge — a 270° instrument-style gauge built from real SVG paths.
   Geometry: 64×64 viewBox, center (32,32). The sweep opens at the bottom
   (135° → 405° in screen coords, y-down, clockwise), which leaves a natural
   gap for the VIRALITY micro-label. The number is SVG <text> with
   textAnchor=middle + dominantBaseline=central, so it is centered by the
   renderer itself — no flexbox/baseline guesswork (this fixes the optical
   drift the old HTML-overlay number had).
   Layers, back to front: tinted disc · track arc · tick ring (lit portion
   tinted) · gradient progress arc (pathLength=100, dash-offset draw-in) ·
   head dot at the arc tip · number + label. Reduced motion renders settled. */
const GAUGE_START = 135;

const GAUGE_SWEEP = 270;

const gaugePt = (r, deg) => {
  const a = (deg * Math.PI) / 180;
  return [32 + r * Math.cos(a), 32 + r * Math.sin(a)];
};

const gaugeArc = (r, fromDeg, toDeg) => {
  const [x0, y0] = gaugePt(r, fromDeg);
  const [x1, y1] = gaugePt(r, toDeg);
  const large = toDeg - fromDeg > 180 ? 1 : 0;
  return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
};

function ScoreGauge({ score, gid }) {
  const tone = scoreTone(score);
  const color = score >= 90 ? '#34d399' : score >= 80 ? '#53fc18' : '#fbbf24';
  const colorHi = score >= 90 ? '#6ee7b7' : score >= 80 ? '#aaff66' : '#fde68a';

  const reduced = prefersReducedMotion();
  const [drawn, setDrawn] = useState(reduced);
  useEffect(() => {
    if (reduced) return;
    const id = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(id);
  }, [reduced]);

  const R = 23;            // arc radius — stroke 4 + round cap stays inside 64
  const endDeg = GAUGE_START + GAUGE_SWEEP;
  const track = gaugeArc(R, GAUGE_START, endDeg);

  // Tick ring: one path per state (lit/unlit) keeps this at 2 DOM nodes.
  const TICKS = 28;
  let lit = '';
  let dim = '';
  for (let i = 0; i < TICKS; i++) {
    const t = i / (TICKS - 1);
    const deg = GAUGE_START + t * GAUGE_SWEEP;
    const [x0, y0] = gaugePt(17.5, deg);
    const [x1, y1] = gaugePt(19.5, deg);
    const seg = `M ${x0.toFixed(2)} ${y0.toFixed(2)} L ${x1.toFixed(2)} ${y1.toFixed(2)} `;
    if (t * 100 <= score) lit += seg; else dim += seg;
  }

  const [hx, hy] = gaugePt(R, GAUGE_START + (score / 100) * GAUGE_SWEEP);

  return (
    <svg width="64" height="64" viewBox="0 0 64 64" className="block" role="img" aria-label={`Virality score ${score} out of 100`}>
      <defs>
        <linearGradient id={gid} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor={color} />
          <stop offset="100%" stopColor={colorHi} />
        </linearGradient>
      </defs>
      {/* tinted backing disc */}
      <circle cx="32" cy="32" r="15" fill={color} fillOpacity="0.06" />
      <circle cx="32" cy="32" r="15" fill="none" stroke={color} strokeOpacity="0.12" strokeWidth="1" />
      {/* track + ticks */}
      <path d={track} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4" strokeLinecap="round" />
      <path d={dim} stroke="rgba(255,255,255,0.10)" strokeWidth="1" />
      <path d={lit} stroke={color} strokeOpacity="0.55" strokeWidth="1" />
      {/* progress arc — pathLength normalises the arc to 100 units, so the
          dash math is just the score itself */}
      <path
        d={track}
        fill="none"
        stroke={`url(#${gid})`}
        strokeWidth="4"
        strokeLinecap="round"
        pathLength="100"
        strokeDasharray={`${score} 100`}
        strokeDashoffset={drawn ? 0 : score}
        style={{
          transition: 'stroke-dashoffset 1.2s cubic-bezier(.16,1,.3,1)',
          filter: `drop-shadow(0 0 4px ${color}77)`,
        }}
      />
      {/* head dot at the arc tip — fades in once the draw lands */}
      <circle
        cx={hx.toFixed(2)} cy={hy.toFixed(2)} r="2.4" fill={colorHi}
        style={{
          opacity: drawn ? 1 : 0,
          transition: 'opacity .4s ease 1s',
          filter: `drop-shadow(0 0 4px ${color})`,
        }}
      />
      {/* number — renderer-centered SVG text */}
      <text
        x="32" y="32" textAnchor="middle" dominantBaseline="central"
        className={`serif ${tone}`} fill="currentColor"
        style={{ fontSize: 19, fontStyle: 'italic', letterSpacing: '-0.02em' }}
      >
        {score}
      </text>
      {/* label sits in the gauge's bottom opening */}
      <text
        x="32" y="58.5" textAnchor="middle"
        className="mono" fill="#78716c"
        style={{ fontSize: 5, letterSpacing: '0.22em' }}
      >
        VIRALITY
      </text>
    </svg>
  );
}

function ClipCard({ clip, rank, onSelect, sourceEnd }) {
  const score = clipScore(clip);
  const ringColor = score >= 90 ? '#34d399' : score >= 80 ? '#53fc18' : '#fbbf24';
  const platforms = clip.platforms || [];

  /* ── Delivery materialization ──
     Entrance delay is captured once (initial rank) so re-sorting — which makes
     React move the DOM node and would otherwise replay CSS animations — keeps a
     stable value; `entered` strips the one-shot classes after the sequence so
     reorders never re-trigger it. Reduced motion skips straight to settled. */
  const reduced = prefersReducedMotion();
  const delayRef = useRef(Math.min(rank - 1, 7) * 110);
  const d = delayRef.current;
  const [entered, setEntered] = useState(reduced);
  useEffect(() => {
    if (reduced) return;
    const t = setTimeout(() => setEntered(true), d + 1500);
    return () => clearTimeout(t);
  }, [reduced, d]);

  /* Cursor spotlight — write the pointer position into CSS vars; the .clip-spot
     and .clip-ring overlays render the light. One cheap style write per move. */
  const cardRef = useRef(null);
  const onMove = (e) => {
    const el = cardRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${e.clientX - r.left}px`);
    el.style.setProperty('--my', `${e.clientY - r.top}px`);
  };

  // Locate this clip inside the source recording for the mini timeline.
  const [tsA, tsB] = String(clip.timestamp || '').split('-').map((s) => parseClock(s));
  const hasSpan = Number.isFinite(tsA) && Number.isFinite(tsB) && Number.isFinite(sourceEnd) && sourceEnd > 0;
  const segA = hasSpan ? Math.max(0, Math.min(100, (tsA / sourceEnd) * 100)) : 0;
  const segB = hasSpan ? Math.max(segA + 2.5, Math.min(100, (tsB / sourceEnd) * 100)) : 0;

  return (
    <div
      ref={cardRef}
      onMouseMove={onMove}
      className={`group clip-card tilt-card rounded-xl border border-stone-800 bg-stone-900/30 transition-all duration-300 overflow-hidden flex ${entered ? '' : 'clip-enter'}`}
      style={entered ? undefined : { animationDelay: `${d}ms` }}
    >
      {/* Pointer-tracking light layers (hover only; removed for reduced motion) */}
      <span aria-hidden className="clip-spot" />
      <span aria-hidden className="clip-ring" />

      {/* ── Left: real 9:16 vertical preview (shared ClipFrame) ── */}
      <button
        onClick={onSelect}
        className="relative shrink-0 w-[116px] sm:w-[132px] border-r border-stone-800 block group/pv overflow-hidden"
      >
        <div className={entered ? '' : 'clip-develop'} style={entered ? undefined : { animationDelay: `${d + 120}ms` }}>
          <ClipFrame clip={clip} rank={rank} />
        </div>
        {/* Render sweep — scanline wipes the frame as it lands */}
        {!entered && <span aria-hidden className="clip-sweep" style={{ animationDelay: `${d + 140}ms` }} />}
      </button>

      {/* ── Right: content ── */}
      <div className="p-4 sm:p-5 flex flex-col gap-2.5 flex-1 min-w-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <button onClick={onSelect} className="text-left font-medium block w-full hover:text-[#53fc18] transition line-clamp-2">
              {clip.title}
            </button>
            <div className="serif italic text-stone-400 text-sm line-clamp-1 mt-0.5">{clip.hook}</div>
          </div>
          <div className="shrink-0">
            <ScoreGauge score={score} gid={`vg-${clip.id}`} />
          </div>
        </div>

        {clip.caption && <div className="text-sm text-stone-300 line-clamp-2">{clip.caption}</div>}

        {platforms.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {platforms.map((p, i) => (
              <span key={i} className="px-2 py-0.5 rounded bg-stone-800/60 border border-stone-700/60 text-[10px] mono text-stone-300">
                {p}
              </span>
            ))}
          </div>
        )}

        {/* Mini source timeline — where this cut sits inside the recording.
            Percentage coordinates keep the SVG fluid without viewBox stretch,
            so the round caps and tick widths never distort. */}
        {hasSpan ? (
          <div className="flex items-center gap-2.5">
            <span className="text-[9px] mono text-stone-600 tracking-[0.15em] uppercase shrink-0">Source</span>
            <svg width="100%" height="12" className="block min-w-0 flex-1" aria-hidden>
              <line x1="0%" y1="6" x2="100%" y2="6" stroke="rgba(255,255,255,0.08)" strokeWidth="2" />
              {/* minute ticks along the source */}
              {Array.from({ length: Math.floor(sourceEnd / 600) }, (_, i) => {
                const x = `${(((i + 1) * 600) / sourceEnd) * 100}%`;
                return <line key={i} x1={x} y1="3.5" x2={x} y2="8.5" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />;
              })}
              <line
                x1={`${segA}%`} y1="6" x2={`${segB}%`} y2="6"
                stroke={ringColor} strokeWidth="4" strokeLinecap="round"
                style={{ filter: `drop-shadow(0 0 4px ${ringColor}aa)` }}
              />
            </svg>
            <span className="text-xs mono text-stone-500 shrink-0 tabular-nums">{clip.timestamp}</span>
          </div>
        ) : (
          <div className="text-xs mono text-stone-500">{clip.timestamp}</div>
        )}

        <div className="mt-auto flex items-center gap-2 pt-1">
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[#53fc18]/40 bg-[#53fc18]/[0.06] text-[#53fc18] text-[11px] mono ${entered ? '' : 'clip-stamp'}`}
            style={entered ? undefined : { animationDelay: `${d + 820}ms` }}
          >
            <CheckCircle2 className="w-3.5 h-3.5" /> Editor-reviewed
          </span>
          <div className="flex-1" />
          <button
            onClick={onSelect}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-stone-700 text-stone-300 text-[11px] mono hover:bg-stone-900 transition"
          >
            Details <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────── DETAIL */
function ClipPlaybackStage({ clip }) {
  const reduced = prefersReducedMotion();
  const [playing, setPlaying] = useState(!reduced);

  useEffect(() => { setPlaying(!reduced); }, [clip.id, reduced]);

  // Looping synthetic playback on the shared, time-based rAF engine. The play/pause
  // button gates `playing` (resumes from the same spot); a new clip resets via
  // resetKey; reduced motion holds a single settled frame.
  const progress = useLoopProgress({
    durationMs: 8000,
    playing,
    resetKey: clip.id,
    staticPct: 58,
  });

  const frac = progress / 100;
  const currentTime = frac * (clip.duration || 0);

  // Spoken caption — word tokens derived from the hook line.
  const words = (clip.hook || '').replace(/[\u201c\u201d"]/g, '').trim().split(/\s+/).filter(Boolean);
  const activeWordIdx = words.length ? Math.min(words.length - 1, Math.floor(frac * words.length)) : -1;

  // On-screen text — punchy line swaps across the timeline.
  const lines = Array.isArray(clip.onScreenText) ? clip.onScreenText.filter(Boolean) : [];
  const otIdx = lines.length ? Math.min(lines.length - 1, Math.floor(frac * lines.length)) : -1;
  const otIsPayoff = otIdx === lines.length - 1;

  const grad = CLIP_GRADIENTS[clip.thumbnail] || CLIP_GRADIENTS['gradient-1'];
  const score = clipScore(clip);

  return (
    <div className="relative aspect-[9/16] max-h-[600px] mx-auto w-full max-w-[340px] rounded-[28px] overflow-hidden border-[3px] border-stone-800 bg-black shadow-[0_0_80px_-24px_rgba(83,252,24,0.45)]">
      <div className={`absolute inset-0 bg-gradient-to-br ${grad} opacity-25`} />
      <div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(ellipse at 30% 40%, rgba(83,252,24,0.15) 0%, transparent 50%), radial-gradient(ellipse at 70% 60%, rgba(150,80,200,0.12) 0%, transparent 50%)' }}
      />
      <div className="absolute inset-0 bg-black/35" />

      <button
        onClick={() => { if (!reduced) setPlaying((v) => !v); }}
        aria-label={playing ? 'Pause preview' : 'Play preview'}
        className="absolute inset-0 z-20 flex items-center justify-center"
      >
        <span
          className="w-16 h-16 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center transition-opacity"
          style={{ opacity: playing ? 0 : 1 }}
        >
          <Play className="w-7 h-7 text-white fill-white ml-1" />
        </span>
      </button>

      <div className="absolute top-0 inset-x-0 flex items-center justify-between px-4 pt-3 z-10 text-[10px] mono">
        <span className="px-2 py-0.5 rounded bg-black/45 backdrop-blur-sm text-white/85">CC · Auto-captioned</span>
        {clip.platforms && clip.platforms[0] && (
          <span className="px-2 py-0.5 rounded bg-black/45 backdrop-blur-sm text-[#53fc18]">{clip.platforms[0]}</span>
        )}
      </div>
      <div className="absolute top-12 right-3 z-10 px-1.5 py-0.5 rounded bg-black/45 backdrop-blur text-[8px] mono text-[#53fc18] tracking-wider">
        CLIPPER.AI · {score}
      </div>

      <div className="absolute inset-x-6 top-1/2 -translate-y-16 flex items-end gap-0.5 h-24 z-[1]">
        {Array.from({ length: 38 }).map((_, j) => {
          const distance = Math.abs(j - 19);
          const h = 30 + Math.abs(Math.sin(j * 0.5 + currentTime * 3)) * 70;
          const active = j / 38 < frac;
          return (
            <div
              key={j}
              className="flex-1 rounded-sm h-full"
              style={{
                transform: `scaleY(${h / 100})`,
                transformOrigin: 'bottom',
                background: active ? '#53fc18' : 'rgba(255,255,255,0.28)',
                boxShadow: active && distance < 4 ? '0 0 6px #53fc18' : 'none',
              }}
            />
          );
        })}
      </div>

      {otIdx >= 0 && (
        <div className="absolute inset-x-6 top-[34%] z-10 text-center">
          <div
            key={otIdx}
            className="animate-slide-up font-bold leading-tight text-2xl"
            style={{
              color: otIsPayoff ? '#53fc18' : '#ffffff',
              textShadow: otIsPayoff
                ? '0 0 16px rgba(83,252,24,0.7), 0 2px 6px rgba(0,0,0,0.85)'
                : '0 2px 6px rgba(0,0,0,0.85)',
            }}
          >
            {lines[otIdx]}
          </div>
        </div>
      )}

      {words.length > 0 && (
        <div className="absolute bottom-16 inset-x-4 z-10">
          <div className="flex flex-wrap gap-x-1.5 gap-y-1 justify-center">
            {words.map((w, i) => {
              const isPast = i < activeWordIdx;
              const isActive = i === activeWordIdx;
              return (
                <span
                  key={i}
                  className="text-base font-bold transition-all"
                  style={{
                    color: isActive ? '#53fc18' : isPast ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.4)',
                    textShadow: isActive
                      ? '0 0 12px rgba(83,252,24,0.8), 0 2px 4px rgba(0,0,0,0.8)'
                      : '0 2px 4px rgba(0,0,0,0.8)',
                    transform: isActive ? 'scale(1.08)' : 'scale(1)',
                  }}
                >
                  {w}
                </span>
              );
            })}
          </div>
        </div>
      )}

      <div className="absolute bottom-4 inset-x-4 z-10">
        <div className="relative h-1 rounded-full bg-white/20">
          <div
            className="absolute inset-y-0 left-0 right-0 rounded-full"
            style={{ transform: `scaleX(${frac})`, transformOrigin: 'left', background: 'linear-gradient(90deg,#53fc18,#aaff66)', boxShadow: '0 0 6px #53fc18' }}
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-[#53fc18]"
            style={{ left: `${progress}%`, boxShadow: '0 0 8px #53fc18' }}
          />
        </div>
        <div className="flex items-center justify-between mt-1 text-[9px] mono text-white/60">
          <span>{currentTime.toFixed(1)}s</span>
          <span>{fmtClock(clip.duration)}</span>
        </div>
      </div>
    </div>
  );
}

function ClipDetailView({ clip, onBack, bookCall }) {
  const reduced = prefersReducedMotion();
  const [shownScore, setShownScore] = useState(reduced ? clip.virality : 0);
  const [barsIn, setBarsIn] = useState(reduced);
  useEffect(() => {
    if (reduced) { setShownScore(clip.virality); setBarsIn(true); return; }
    setShownScore(0);
    setBarsIn(false);
    const rafIn = requestAnimationFrame(() => setBarsIn(true));
    const target = clip.virality;
    const start = performance.now();
    const DUR = 900;
    let id;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / DUR);
      const eased = 1 - Math.pow(1 - t, 3);
      setShownScore(Math.round(target * eased));
      if (t < 1) id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(rafIn); if (id) cancelAnimationFrame(id); };
  }, [clip.id, clip.virality, reduced]);

  return (
    <div className="animate-slide-up">
      <button onClick={onBack} className="text-sm text-stone-400 hover:text-stone-100 mono mb-6">
        ← Back to clips
      </button>

      <div className="grid lg:grid-cols-[1.2fr_1fr] gap-8">
        <div>
          <ClipPlaybackStage clip={clip} />

          <div className="grid grid-cols-3 gap-3 mt-4">
            {['9:16', '1:1', '16:9'].map((r, i) => (
              <button key={r} className={`p-3 rounded-lg border text-xs mono transition ${
                i === 0 ? 'border-[#53fc18] bg-[#53fc18]/10 text-[#53fc18]' : 'border-stone-800 text-stone-400 hover:border-stone-700'
              }`}>
                {r} {i === 0 && '· active'}
              </button>
            ))}
          </div>

          {(clip.caption || (Array.isArray(clip.onScreenText) && clip.onScreenText.length > 0)) && (
            <div className="mt-4 p-4 rounded-xl bg-stone-900/40 border border-stone-800 space-y-3">
              {clip.caption && (
                <div>
                  <div className="text-[11px] mono text-stone-500 mb-1.5 tracking-wider">→ SUGGESTED CAPTION</div>
                  <div className="text-sm text-stone-300 leading-relaxed">{clip.caption}</div>
                </div>
              )}
              {Array.isArray(clip.onScreenText) && clip.onScreenText.length > 0 && (
                <div>
                  <div className="text-[11px] mono text-stone-500 mb-1.5 tracking-wider">→ ON-SCREEN TEXT</div>
                  <div className="flex flex-wrap gap-1.5">
                    {clip.onScreenText.filter(Boolean).map((t, i) => (
                      <span key={i} className="px-2.5 py-1 rounded-md bg-stone-800/60 border border-stone-700 text-xs text-stone-200">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div>
            <div className="flex items-center gap-2 text-xs mono text-stone-500 mb-3 tracking-wider">
              <Flame className="w-3.5 h-3.5 text-[#53fc18]" /> VIRALITY BREAKDOWN
            </div>
            <div className="serif text-7xl text-[#53fc18] leading-none mb-2">{shownScore}</div>
            <div className="text-stone-400 text-sm">out of 100 · our model’s predicted reach potential</div>
          </div>

          {clip.scoreExplanation && (
            <div className="p-4 rounded-xl bg-stone-900/40 border border-stone-800">
              <div className="text-xs mono text-stone-500 mb-2 tracking-wider">→ WHY THIS SCORE</div>
              <div className="text-sm text-stone-300 leading-relaxed">{clip.scoreExplanation}</div>
            </div>
          )}

          <div className="space-y-3">
            {Object.entries(clip.engagement).map(([k, v], bi) => (
              <div key={k}>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="capitalize text-stone-300">{k}</span>
                  <span className="mono text-stone-400">{v}</span>
                </div>
                <div className="h-1.5 rounded-full bg-stone-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#53fc18] to-[#aaff66] transition-[width] duration-700 ease-out"
                    style={{ width: barsIn ? `${v}%` : '0%', transitionDelay: `${bi * 120}ms` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div>
            <div className="text-xs mono text-stone-500 mb-3 tracking-wider">→ WHY IT WORKS</div>
            <div className="space-y-2">
              {clip.reasons.map((r) => (
                <div key={r} className="flex items-start gap-2.5 p-3 rounded-lg bg-stone-900/40 border border-stone-800">
                  <Sparkles className="w-4 h-4 text-[#53fc18] mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-stone-300">{r}</div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="text-xs mono text-stone-500 mb-3 tracking-wider">→ RECOMMENDED PLATFORMS</div>
            <div className="flex flex-wrap gap-2">
              {clip.platforms.map((p) => (
                <span key={p} className="px-3 py-1.5 rounded-md border border-stone-700 bg-stone-900/50 text-sm">
                  {p}
                </span>
              ))}
            </div>
          </div>

          <div className="pt-2 space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-[#53fc18]/40 bg-[#53fc18]/[0.06] text-[#53fc18] text-xs mono">
              <CheckCircle2 className="w-3.5 h-3.5" /> Editor-reviewed · delivered to your queue
            </div>
            <button
              onClick={bookCall}
              className="btn-neon w-full py-3 rounded-lg font-medium flex items-center justify-center gap-2"
            >
              Book a demo to do this with your content
            </button>
          </div>
        </div>
      </div>

      <div className="tilt-card mt-8 p-6 rounded-2xl border border-stone-800 bg-stone-900/30">
        <div className="text-xs mono text-stone-500 mb-4 tracking-wider">→ TRANSCRIPT · {clip.timestamp}</div>
        <div className="serif text-xl leading-relaxed text-stone-300 italic">
          "{clip.hook} ...and what we found was completely opposite to what every blog post and Twitter thread told us. The data was unambiguous. The conventional wisdom was just wrong, and the teams that ignored it were winning."
        </div>
      </div>
    </div>
  );
}

export { AnalyzingView, ClipCard, ClipDetailView, ClipFrame, ClipPlaybackStage, EngagementRadar, GAUGE_START, GAUGE_SWEEP, Meter, ReachSpark, ResultsView, ResultsWave, RuntimeSpark, ScoreGauge, ScoreSpark, StatCard, StatCountUp, StudioBackdrop, UploadView, gaugeArc, gaugePt, useCountUp };

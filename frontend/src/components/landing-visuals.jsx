import React, { useState, useRef, useEffect } from 'react';
import { ArrowUpRight, Briefcase, Check, CheckCircle2, Clock, Database, Globe, Heart, MessageCircle, Play, Scissors, Share2, Shield, Sparkles, Zap } from 'lucide-react';
import { GlowOrb, Reveal, useReveal } from './ui.jsx';
import { track } from '../lib/analytics.jsx';
import { postLead } from '../lib/api.js';
import { DEMO_CLIPS, SAMPLE_RECORDINGS } from '../lib/demo.jsx';
import { prefersReducedMotion, useLoopProgress } from '../lib/motion.jsx';
import { ClipFrame } from '../studio/views.jsx';

/* ──────────────────────────────────────────────────────────── STUDIO MOCKUP */
function StudioMockup() {
  return (
    <div className="relative w-full max-w-2xl mx-auto">
      <div className="absolute -inset-8 bg-[#53fc18]/[0.12] blur-3xl rounded-full pointer-events-none" />
      <div className="relative rounded-2xl border border-[#53fc18]/[0.12] bg-black/80 backdrop-blur overflow-hidden">
        {/* Window chrome */}
        <div className="border-b border-white/[0.06] px-4 py-2.5 flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-stone-700" />
          <span className="w-2.5 h-2.5 rounded-full bg-stone-700" />
          <span className="w-2.5 h-2.5 rounded-full bg-stone-700" />
          <div className="ml-4 px-3 py-1 rounded bg-white/[0.04] text-[10px] mono text-stone-500 flex-1 max-w-md">
            clipper.ai/studio/job_a3f9
          </div>
        </div>

        {/* App content */}
        <div className="grid grid-cols-[180px_1fr] divide-x divide-[#53fc18]/[0.08]">
          {/* Sidebar */}
          <div className="p-4 space-y-3">
            <div className="text-[9px] mono text-stone-500 tracking-wider uppercase mb-2">Library</div>
            {[
              { l: 'All clips', n: 12, active: true },
              { l: 'Top scoring', n: 4 },
              { l: 'Drafts', n: 8 },
              { l: 'Published', n: 21 },
            ].map((item) => (
              <div key={item.l} className={`flex items-center justify-between px-2 py-1.5 rounded text-xs ${item.active ? 'bg-[#53fc18]/10 text-[#53fc18]' : 'text-stone-400'}`}>
                <span>{item.l}</span>
                <span className="mono text-[10px] text-stone-500">{item.n}</span>
              </div>
            ))}
            <div className="border-t border-white/[0.12] pt-3 mt-4">
              <div className="text-[9px] mono text-stone-500 tracking-wider uppercase mb-2">Library</div>
              <div className="flex items-center gap-2 px-2 py-1.5 rounded text-xs text-stone-400">
                <span className="w-1 h-1 rounded-full bg-[#53fc18] animate-pulse-soft" />
                <span>23 clips</span>
              </div>
            </div>
          </div>

          {/* Main */}
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="serif text-xl">Q4 launch keynote.mp4</div>
                <div className="text-[10px] mono text-stone-500 mt-0.5">12 clips · ranked by virality</div>
              </div>
              <div className="px-2.5 py-1 rounded bg-[#53fc18]/10 text-[10px] mono text-[#53fc18] tracking-wider uppercase">Ready</div>
            </div>

            <div className="space-y-1.5">
              {[
                { r: '01', t: 'The moment everything changed', score: 94, time: '12:34', dur: '0:47' },
                { r: '02', t: 'Counterintuitive insight on growth', score: 87, time: '24:08', dur: '0:38' },
                { r: '03', t: 'Three frameworks in 60 seconds', score: 82, time: '31:45', dur: '0:58' },
                { r: '04', t: 'The mistake nobody talks about', score: 78, time: '08:15', dur: '0:42' },
              ].map((clip, i) => (
                <div key={i} className="flex items-center gap-3 p-2 rounded hover:bg-[#53fc18]/[0.015]">
                  <div className="mono text-[10px] text-stone-600 w-5">{clip.r}</div>
                  <div className="w-10 h-7 rounded bg-gradient-to-br from-[#53fc18]/40 to-[#3fd80f]/30 flex items-center justify-center">
                    <Play className="w-2.5 h-2.5 text-black fill-black" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs truncate">{clip.t}</div>
                    <div className="text-[10px] mono text-stone-500 mt-0.5">{clip.time} · {clip.dur}</div>
                  </div>
                  <div className="serif text-xl text-[#53fc18]">{clip.score}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────── GLOBAL MAP */
// Simple stylized world map showing global infrastructure footprint
function GlobalMap() {
  // Dot positions roughly approximating land masses on a 800×400 grid
  const dots = [];
  for (let y = 0; y < 30; y++) {
    for (let x = 0; x < 60; x++) {
      // Crude land-mass mask
      const px = x / 60;
      const py = y / 30;
      const inLand =
        (px > 0.05 && px < 0.30 && py > 0.20 && py < 0.55) || // Americas
        (px > 0.42 && px < 0.62 && py > 0.18 && py < 0.55) || // Eu/Africa
        (px > 0.62 && px < 0.92 && py > 0.20 && py < 0.65) || // Asia
        (px > 0.75 && px < 0.92 && py > 0.65 && py < 0.85);   // Australia
      if (inLand && Math.random() > 0.2) {
        dots.push({ x: x * 13.3, y: y * 13.3, opacity: 0.15 + Math.random() * 0.25 });
      }
    }
  }

  const nodes = [
    { x: 130, y: 140, label: 'SFO', live: true },
    { x: 220, y: 160, label: 'NYC', live: false },
    { x: 410, y: 120, label: 'LON', live: false },
    { x: 440, y: 130, label: 'FRA', live: false },
    { x: 690, y: 180, label: 'TYO', live: false },
    { x: 760, y: 290, label: 'SYD', live: false },
    { x: 580, y: 220, label: 'SIN', live: false },
    { x: 250, y: 300, label: 'SAO', live: false },
  ];

  return (
    <div className="relative w-full aspect-[2/1] rounded-2xl border border-[#53fc18]/[0.12] bg-gradient-to-b from-white/[0.02] to-transparent overflow-hidden">
      <svg viewBox="0 0 800 400" className="absolute inset-0 w-full h-full">
        {/* Dot mask of the world */}
        {dots.map((d, i) => (
          <circle key={i} cx={d.x} cy={d.y} r="1.2" fill="rgba(255,255,255,0.4)" opacity={d.opacity} />
        ))}

        {/* Network nodes */}
        {nodes.map((n, i) => (
          <g key={n.label}>
            {n.live && (
              <circle cx={n.x} cy={n.y} r="14" fill="none" stroke="#53fc18" strokeWidth="1" opacity="0.3">
                <animate attributeName="r" values="6;20;6" dur="3s" begin={`${i * 0.4}s`} repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.6;0;0.6" dur="3s" begin={`${i * 0.4}s`} repeatCount="indefinite" />
              </circle>
            )}
            <circle cx={n.x} cy={n.y} r="3.5" fill={n.live ? '#53fc18' : '#78716c'} />
            <text
              x={n.x}
              y={n.y - 12}
              fill={n.live ? '#53fc18' : '#78716c'}
              fontSize="9"
              fontFamily="JetBrains Mono"
              textAnchor="middle"
              letterSpacing="1"
            >
              {n.label}
            </text>
          </g>
        ))}

        {/* Inter-node connections */}
        {[[0, 1], [1, 2], [2, 3], [3, 4], [4, 6], [6, 5], [1, 7]].map(([a, b], i) => (
          <line
            key={i}
            x1={nodes[a].x}
            y1={nodes[a].y}
            x2={nodes[b].x}
            y2={nodes[b].y}
            stroke="rgba(83,252,24,0.15)"
            strokeWidth="0.5"
            strokeDasharray="3 3"
          />
        ))}
      </svg>

      {/* Overlay legend */}
      <div className="absolute top-5 left-5 flex flex-col gap-2 text-[10px] mono text-stone-400 tracking-wider uppercase">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#53fc18]" />
          <span>Primary region · SFO</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-stone-500" />
          <span>Planned regions</span>
        </div>
      </div>
    </div>
  );
}



/* ──────────────────────────────────────────────────────────── PRODUCT DEMO REEL
   The Slice — a single long source-video bar at top, a scanning line that sweeps across
   once, and 6 short vertical clip cards that fall out of the source into a row below as
   the line passes them. Conveys "long video → short clips" in one glance.

   Performance: all motion is pure CSS keyframes on GPU-composited properties (transform,
   opacity). Main thread is idle once the animation starts. Total animated layers: 8. */

// The 6 viral clip moments — each has a position along the source bar (%) and a score chip.
// `enterPct` is the percentage of the loop at which the clip "falls in" — matches when the scan crosses.
const SLICE_DURATION_MS = 6500;

const SLICE_CLIPS = [
  { pos: 11, score: 94, hue: '#aaff66', enterPct: 9,  label: 'HOOK' },
  { pos: 24, score: 88, hue: '#53fc18', enterPct: 16, label: 'TURN' },
  { pos: 40, score: 71, hue: '#53fc18', enterPct: 25, label: 'QUOTE' },
  { pos: 56, score: 81, hue: '#aaff66', enterPct: 34, label: 'LIST' },
  { pos: 71, score: 76, hue: '#53fc18', enterPct: 42, label: 'PUNCH' },
  { pos: 87, score: 65, hue: '#53fc18', enterPct: 51, label: 'CTA' },
];

// Inject the slice animation keyframes once at module load.
// Per-clip stagger is baked into separately named keyframes (sliceFall0..5, sliceMark0..5) so the
// stagger repeats correctly every loop iteration (animation-delay only delays the first iteration).

if (typeof document !== 'undefined' && !document.getElementById('slice-anim-styles')) {
  const style = document.createElement('style');
  style.id = 'slice-anim-styles';

  // Per-clip keyframes — fall in at enterPct, hold, then fade out near the end.
  const perClipKeyframes = SLICE_CLIPS.map((clip, i) => {
    const e = clip.enterPct;       // when the card starts appearing
    const eIn = Math.min(e + 1, 95);   // tiny pre-fade
    const eDown = Math.min(e + 6, 95); // settled into final position
    return `
      @keyframes sliceFall${i} {
        0%        { opacity: 0; transform: translate(-50%, -28px) scale(0.94); }
        ${e}%     { opacity: 0; transform: translate(-50%, -28px) scale(0.94); }
        ${eIn}%   { opacity: 1; transform: translate(-50%, -28px) scale(0.94); }
        ${eDown}% { opacity: 1; transform: translate(-50%, 0) scale(1); }
        88%       { opacity: 1; transform: translate(-50%, 0) scale(1); }
        96%       { opacity: 0; transform: translate(-50%, 0) scale(1); }
        100%      { opacity: 0; transform: translate(-50%, 0) scale(1); }
      }
      @keyframes sliceMark${i} {
        0%        { opacity: 0; transform: translateX(-50%) scaleY(0.4); }
        ${e}%     { opacity: 0; transform: translateX(-50%) scaleY(0.4); }
        ${eIn}%   { opacity: 1; transform: translateX(-50%) scaleY(1); }
        88%       { opacity: 0.7; transform: translateX(-50%) scaleY(1); }
        96%       { opacity: 0; transform: translateX(-50%) scaleY(1); }
        100%      { opacity: 0; transform: translateX(-50%) scaleY(1); }
      }
      @keyframes slicePop${i} {
        0%        { opacity: 0; transform: translateY(10px) scale(0.96); }
        ${e}%     { opacity: 0; transform: translateY(10px) scale(0.96); }
        ${eIn}%   { opacity: 1; transform: translateY(10px) scale(0.96); }
        ${eDown}% { opacity: 1; transform: translateY(0) scale(1); }
        88%       { opacity: 1; transform: translateY(0) scale(1); }
        96%       { opacity: 0; transform: translateY(0) scale(1); }
        100%      { opacity: 0; transform: translateY(0) scale(1); }
      }
    `;
  }).join('\n');

  style.textContent = `
    @keyframes sliceScan {
      0%   { transform: translateX(0); opacity: 0; }
      4%   { opacity: 1; }
      55%  { transform: translateX(100%); opacity: 1; }
      60%  { opacity: 0; }
      100% { transform: translateX(100%); opacity: 0; }
    }
    @keyframes sliceSourcePulse {
      0%, 100% { opacity: 0.85; }
      50% { opacity: 1; }
    }
    ${perClipKeyframes}

    @media (prefers-reduced-motion: reduce) {
      .slice-card-d, .slice-card-m { animation: none !important; opacity: 1 !important; }
      .slice-card-d { transform: translate(-50%, 0) !important; }
      .slice-card-m { transform: none !important; }
      .slice-mark { animation: none !important; opacity: 0.55 !important; transform: translateX(-50%) scaleY(1) !important; }
      .slice-scan { display: none !important; }
      .slice-pulse { animation: none !important; opacity: 1 !important; }
      .lt-marquee { animation: none !important; }
      .animate-pulse-soft { animation: none !important; opacity: 0.85 !important; }
    }
  `;
  document.head.appendChild(style);
}

function SliceClipCard({ clip, i }) {
  return (
    <div className="relative w-full h-full rounded-md border border-[#53fc18]/[0.25] overflow-hidden" style={{
      background: 'linear-gradient(180deg, rgba(83,252,24,0.10), rgba(83,252,24,0.03))',
      boxShadow: `0 4px 20px ${clip.hue}25, 0 0 0 1px ${clip.hue}15 inset`,
    }}>
      {/* Top accent */}
      <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: clip.hue, boxShadow: `0 0 8px ${clip.hue}` }} />
      {/* Mini waveform inside the clip */}
      <div className="absolute inset-x-2 top-3 flex items-center justify-between gap-0.5">
        {Array.from({ length: 14 }).map((_, j) => {
          const h = 4 + ((j * 7 + i * 3) % 10);
          return <div key={j} className="w-0.5 rounded-full" style={{ height: `${h}px`, background: clip.hue, opacity: 0.35 + (j % 4) * 0.15 }} />;
        })}
      </div>
      {/* Score chip */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded-sm bg-black/60 border border-[#53fc18]/30">
        <span className="text-[9px] mono text-[#53fc18] tracking-wider">{clip.score}</span>
      </div>
      {/* Label */}
      <div className="absolute bottom-7 left-1/2 -translate-x-1/2">
        <span className="text-[7px] mono text-stone-400 tracking-[0.2em] uppercase">{clip.label}</span>
      </div>
    </div>
  );
}

function ProductDemoReel({ openApp }) {
  return (
    <section className="relative z-10 max-w-[1400px] mx-auto px-6 md:px-8 py-16 md:py-24 border-t border-white/[0.12]">
      {/* Soft ambient backdrop — static gradient, zero animation cost */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(83,252,24,0.05), transparent 70%)' }} />

      {/* Header */}
      <Reveal>
        <div className="relative flex items-end justify-between mb-12">
          <div>
            <div className="text-[10px] mono text-[#53fc18] tracking-[0.3em] uppercase mb-3">[ HOW IT WORKS ]</div>
            <h2 className="text-5xl md:text-6xl serif tracking-tight text-stone-100">
              One video in.<br /><span className="gradient-green italic">Six viral clips out.</span>
            </h2>
          </div>
          <div className="hidden md:flex items-center gap-3 text-[10px] mono text-stone-500 tracking-[0.25em] uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-[#53fc18] slice-pulse" style={{ animation: 'sliceSourcePulse 2.4s ease-in-out infinite' }} />
            <span>LIVE PIPELINE</span>
          </div>
        </div>
      </Reveal>

      {/* The slice stage */}
      <Reveal delay={120}>
        <div className="relative rounded-2xl border border-[#53fc18]/[0.12] bg-gradient-to-b from-stone-950/80 to-black/90 backdrop-blur-sm overflow-hidden">
          {/* Corner brackets */}
          <div className="absolute top-3 left-3 w-3 h-3 border-l border-t border-[#53fc18]/40 pointer-events-none" />
          <div className="absolute top-3 right-3 w-3 h-3 border-r border-t border-[#53fc18]/40 pointer-events-none" />
          <div className="absolute bottom-3 left-3 w-3 h-3 border-l border-b border-[#53fc18]/40 pointer-events-none" />
          <div className="absolute bottom-3 right-3 w-3 h-3 border-r border-b border-[#53fc18]/40 pointer-events-none" />

          {/* Subtle grid background */}
          <div className="absolute inset-0 opacity-[0.08] pointer-events-none" style={{
            backgroundImage: 'linear-gradient(rgba(83,252,24,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(83,252,24,0.6) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
            maskImage: 'radial-gradient(circle at center, black 30%, transparent 75%)',
            WebkitMaskImage: 'radial-gradient(circle at center, black 30%, transparent 75%)',
          }} />

          <div className="relative px-4 sm:px-8 md:px-16 py-10 md:py-14">
            {/* Metadata row */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-6">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] mono text-stone-500 tracking-[0.2em] uppercase">
                <span className="text-stone-600">SOURCE</span>
                <span className="text-stone-300">podcast-ep47-final.mp4</span>
                <span className="text-stone-700">·</span>
                <span className="text-stone-600">47:22</span>
              </div>
              <div className="text-[10px] mono text-[#53fc18] tracking-[0.2em]">ANALYZING · 6 MOMENTS FOUND</div>
            </div>

            {/* SOURCE VIDEO BAR */}
            <div className="relative h-16 md:h-20 rounded-md overflow-hidden border border-[#53fc18]/[0.15]" style={{
              background: 'linear-gradient(90deg, rgba(83,252,24,0.06), rgba(83,252,24,0.12), rgba(83,252,24,0.06))',
            }}>
              {/* Frame ticks — 24 tiny vertical marks suggesting timeline frames */}
              <div className="absolute inset-0 flex">
                {Array.from({ length: 24 }).map((_, i) => (
                  <div key={i} className="flex-1 border-r border-[#53fc18]/[0.08] last:border-r-0" />
                ))}
              </div>
              {/* Faint waveform shimmer baked in as a static SVG (no animation) */}
              <svg className="absolute inset-0 w-full h-full opacity-30" viewBox="0 0 1000 80" preserveAspectRatio="none">
                <path d="M0 40 L20 30 L40 50 L60 25 L80 55 L100 35 L120 45 L140 20 L160 60 L180 40 L200 30 L220 50 L240 25 L260 55 L280 35 L300 45 L320 30 L340 50 L360 25 L380 55 L400 40 L420 30 L440 50 L460 25 L480 55 L500 35 L520 45 L540 30 L560 50 L580 25 L600 55 L620 40 L640 30 L660 50 L680 25 L700 55 L720 35 L740 45 L760 30 L780 50 L800 25 L820 55 L840 40 L860 30 L880 50 L900 25 L920 55 L940 35 L960 45 L980 30 L1000 40" stroke="#53fc18" strokeWidth="1.5" fill="none" />
              </svg>

              {/* Moment markers — vertical accent lines that flash in at clip positions as the scan crosses.
                  Each marker has its own per-index keyframe with baked-in stagger timing. */}
              {SLICE_CLIPS.map((clip, i) => (
                <div
                  key={i}
                  className="absolute top-0 bottom-0 pointer-events-none slice-mark"
                  style={{
                    left: `${clip.pos}%`,
                    width: '2px',
                    background: clip.hue,
                    boxShadow: `0 0 8px ${clip.hue}, 0 0 16px ${clip.hue}55`,
                    transformOrigin: 'center bottom',
                    animation: `sliceMark${i} ${SLICE_DURATION_MS}ms ease-out infinite`,
                    willChange: 'transform, opacity',
                  }}
                />
              ))}

              {/* THE SCANNING LINE — sweeps left to right once per loop. Pure CSS transform = GPU smooth. */}
              <div
                className="absolute top-0 bottom-0 pointer-events-none slice-scan"
                style={{
                  left: 0,
                  width: '3px',
                  background: 'linear-gradient(to bottom, transparent, #aaff66 20%, #aaff66 80%, transparent)',
                  boxShadow: '0 0 12px rgba(170,255,102,0.9), 0 0 32px rgba(83,252,24,0.6), 0 0 64px rgba(83,252,24,0.3)',
                  animation: `sliceScan ${SLICE_DURATION_MS}ms ease-in-out infinite`,
                  willChange: 'transform, opacity',
                }}
              />
            </div>

            {/* Caption between source and clips */}
            <div className="flex items-center justify-center my-7">
              <div className="flex items-center gap-3 text-[10px] mono text-stone-500 tracking-[0.25em] uppercase">
                <div className="w-12 h-px bg-gradient-to-r from-transparent to-[#53fc18]/40" />
                <span>SLICED INTO</span>
                <div className="w-12 h-px bg-gradient-to-l from-transparent to-[#53fc18]/40" />
              </div>
            </div>

            {/* SHORT CLIPS ROW — desktop: 6 phone-aspect cards that fall in as the scan passes */}
            <div className="relative h-40 md:h-44 hidden md:block">
              {SLICE_CLIPS.map((clip, i) => {
                const posPct = (i + 0.5) * (100 / 6); // evenly spaced across row
                return (
                  <div
                    key={i}
                    className="absolute top-0 slice-card-d"
                    style={{
                      left: `${posPct}%`,
                      width: '88px',
                      height: '100%',
                      transform: 'translate(-50%, -28px)',
                      opacity: 0,
                      animation: `sliceFall${i} ${SLICE_DURATION_MS}ms cubic-bezier(0.16, 1, 0.3, 1) infinite`,
                      willChange: 'transform, opacity',
                    }}
                  >
                    <SliceClipCard clip={clip} i={i} />
                  </div>
                );
              })}
            </div>

            {/* SHORT CLIPS GRID — mobile: the same six clips in a 3x2 grid so nothing overlaps or overflows */}
            <div className="grid grid-cols-3 gap-2.5 md:hidden">
              {SLICE_CLIPS.map((clip, i) => (
                <div
                  key={i}
                  className="relative slice-card-m"
                  style={{
                    aspectRatio: '9 / 16',
                    opacity: 0,
                    animation: `slicePop${i} ${SLICE_DURATION_MS}ms cubic-bezier(0.16, 1, 0.3, 1) infinite`,
                    willChange: 'transform, opacity',
                  }}
                >
                  <SliceClipCard clip={clip} i={i} />
                </div>
              ))}
            </div>

            {/* Footer row — pipeline metrics */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between pt-8 mt-2 border-t border-[#53fc18]/[0.08]">
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[10px] mono text-stone-500 tracking-[0.2em] uppercase">
                <span><span className="text-stone-600">PROCESS TIME</span> <span className="text-stone-200">2m 14s</span></span>
                <span className="text-stone-700">·</span>
                <span><span className="text-stone-600">AVG SCORE</span> <span className="text-stone-200">79.2</span></span>
                <span className="text-stone-700">·</span>
                <span><span className="text-stone-600">PLATFORMS</span> <span className="text-stone-200">TIKTOK · REELS · SHORTS</span></span>
              </div>
              {/* Hand off to the interactive run below rather than duplicating its CTA. */}
              <div className="flex items-center gap-2 text-[10px] mono text-stone-500 tracking-[0.25em] uppercase">
                <span>RUN IT ON A SAMPLE BELOW</span>
                <span aria-hidden="true" className="text-[#53fc18]">↓</span>
              </div>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

/* ──────────────────────────────────────────────────────────── CLIP PREVIEW PLAYER
   Vertical phone frame with synced auto-captions + waveform. Shows what
   the actual clip output looks like across platforms. */
function ClipPreviewPlayer() {
  const [platform, setPlatform] = useState('tiktok'); // tiktok | shorts | reels
  const [activeClipIdx, setActiveClipIdx] = useState(0);

  const clips = [
    {
      title: 'The 47-second framework that changed my Q4',
      caption: [
        { t: 0, w: 'So' }, { t: 0.15, w: 'the' }, { t: 0.3, w: 'thing' }, { t: 0.5, w: 'nobody' },
        { t: 0.75, w: 'tells' }, { t: 0.9, w: 'you' }, { t: 1.0, w: 'about' }, { t: 1.15, w: 'pricing' },
        { t: 1.4, w: 'is' }, { t: 1.55, w: 'that' }, { t: 1.7, w: 'cost-plus' },
        { t: 2.0, w: 'is' }, { t: 2.15, w: 'a' }, { t: 2.3, w: 'trap.' },
      ],
      author: '@maya.builds',
      handle: 'The Build Log · Ep 128',
      score: 94,
      duration: '0:47',
    },
    {
      title: 'When she changed her mind mid-sentence',
      caption: [
        { t: 0, w: 'I' }, { t: 0.15, w: 'used' }, { t: 0.3, w: 'to' }, { t: 0.45, w: 'think' },
        { t: 0.7, w: 'remote' }, { t: 0.95, w: 'work' }, { t: 1.15, w: 'was' }, { t: 1.3, w: 'the' },
        { t: 1.45, w: 'future' }, { t: 1.75, w: 'but' }, { t: 1.9, w: 'actually' },
        { t: 2.2, w: 'wait.' },
      ],
      author: '@deepwork.daily',
      handle: 'Deep Work Daily · Ep 53',
      score: 88,
      duration: '0:38',
    },
    {
      title: 'The framework, condensed',
      caption: [
        { t: 0, w: 'Three' }, { t: 0.2, w: 'questions.' },
        { t: 0.55, w: 'One:' }, { t: 0.8, w: 'who' }, { t: 0.95, w: 'pays?' },
        { t: 1.25, w: 'Two:' }, { t: 1.5, w: 'who' }, { t: 1.65, w: 'wins?' },
        { t: 1.95, w: 'Three:' }, { t: 2.25, w: 'what' }, { t: 2.4, w: 'breaks?' },
      ],
      author: '@the.signal.pod',
      handle: 'The Signal · Ep 207',
      score: 81,
      duration: '0:52',
    },
  ];

  const clip = clips[activeClipIdx];
  const totalCaptionDuration = 2.6;

  // Looping playback on the shared, time-based rAF engine (60fps, self-correcting).
  // The loop period equals the caption timeline, so captions play through and then
  // the next clip is selected. Reduced motion pins a settled frame and never loops.
  const progress = useLoopProgress({
    durationMs: totalCaptionDuration * 1000,
    resetKey: activeClipIdx,
    onLoop: () => setActiveClipIdx((i) => (i + 1) % clips.length),
    staticPct: 60,
  });

  const currentTime = (progress / 100) * totalCaptionDuration;
  const activeWordIdx = clip.caption.findIndex((w, i) => {
    const next = clip.caption[i + 1];
    return currentTime >= w.t && (!next || currentTime < next.t);
  });

  const platforms = [
    { id: 'tiktok', label: 'TikTok', ratio: '9:16', size: { w: 270, h: 480 } },
    { id: 'shorts', label: 'Shorts', ratio: '9:16', size: { w: 270, h: 480 } },
    { id: 'reels', label: 'Reels', ratio: '9:16', size: { w: 270, h: 480 } },
  ];
  const currentPlatform = platforms.find((p) => p.id === platform);

  return (
    <section className="relative z-10 max-w-[1400px] mx-auto px-6 md:px-8 py-16 border-t border-white/[0.12] overflow-hidden">
      <GlowOrb size={500} opacity={0.1} className="right-0 top-1/2 -translate-y-1/2" />
      <Reveal>
        <div className="grid md:grid-cols-[1.4fr_1fr] gap-12 items-center">
          {/* Left: copy */}
          <div>
            <div className="text-[10px] mono text-[#53fc18] mb-4 tracking-[0.2em] uppercase flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[#53fc18]" /> 
              The output
            </div>
            <h2 className="serif text-5xl md:text-6xl leading-[1.02] mb-5">
              Native captions. <span className="italic gradient-green">Native reframes.</span>
            </h2>
            <p className="text-stone-400 leading-relaxed mb-8 max-w-xl text-lg">
              Every clip ships with platform-tuned captions, vertical reframe, and a hook generated specifically for the destination feed. No post-processing. No reformatting. Drop and publish.
            </p>

            {/* Platform tabs */}
            <div className="inline-flex items-center gap-1 p-1 rounded-full border border-[#53fc18]/20 bg-black/40 mb-6">
              {platforms.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPlatform(p.id)}
                  className={`px-4 py-1.5 rounded-full text-[10px] mono tracking-wider uppercase ${platform === p.id ? 'text-black' : 'text-stone-400 hover:text-stone-200'}`}
                  style={platform === p.id ? { backgroundColor: '#53fc18', boxShadow: '0 0 16px rgba(83,252,24,0.4)' } : {}}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Clip selector */}
            <div className="space-y-2 max-w-md">
              {clips.map((c, i) => (
                <button
                  key={i}
                  onClick={() => setActiveClipIdx(i)}
                  className={`w-full text-left p-3 rounded-md border transition-all ${
                    i === activeClipIdx
                      ? 'border-[#53fc18]/40 bg-[#53fc18]/[0.05]'
                      : 'border-[#53fc18]/[0.08] bg-[#53fc18]/[0.01] hover:border-[#53fc18]/20'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <div
                        className="serif text-base"
                        style={i === activeClipIdx ? { color: '#53fc18', textShadow: '0 0 8px rgba(83,252,24,0.4)' } : { color: '#a8a29e' }}
                      >
                        {c.score}
                      </div>
                      <div className="text-[10px] mono text-stone-500 tracking-wider uppercase">virality</div>
                    </div>
                    <div className="text-[10px] mono text-stone-500 tracking-wider">{c.duration}</div>
                  </div>
                  <div className="text-sm text-stone-200 leading-snug">{c.title}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Right: phone frame */}
          <div className="flex justify-center">
            <div
              className="relative rounded-[36px] border-[3px] border-stone-800 bg-black p-2 shadow-[0_0_80px_-20px_rgba(83,252,24,0.4)]"
              style={{ width: currentPlatform.size.w, height: currentPlatform.size.h }}
            >
              {/* Notch */}
              <div className="absolute top-2 left-1/2 -translate-x-1/2 w-16 h-4 rounded-b-2xl bg-stone-900 z-20" />

              {/* Screen */}
              <div className="relative w-full h-full rounded-[28px] overflow-hidden bg-gradient-to-br from-stone-900 via-black to-stone-900">
                {/* Faux video bg — animated gradient */}
                <div
                  className="absolute inset-0"
                  style={{
                    background:
                      'radial-gradient(ellipse at 30% 40%, rgba(83,252,24,0.15) 0%, transparent 50%), radial-gradient(ellipse at 70% 60%, rgba(150,80,200,0.12) 0%, transparent 50%)',
                  }}
                />

                {/* Top status bar */}
                <div className="absolute top-0 inset-x-0 flex items-center justify-between px-4 pt-4 z-10 text-[10px] mono text-white/80">
                  <span>9:41</span>
                  <span className="flex items-center gap-1">
                    <span>●●●●</span>
                    <span>5G</span>
                    <span>100%</span>
                  </span>
                </div>

                {/* Platform UI overlay (top) */}
                <div className="absolute top-10 inset-x-0 flex items-center justify-between px-4 z-10">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#53fc18] to-emerald-500" />
                    <div>
                      <div className="text-xs text-white font-medium">{clip.author}</div>
                      <div className="text-[9px] text-white/60">{clip.handle}</div>
                    </div>
                  </div>
                  <button className="px-2.5 py-1 rounded-md bg-[#53fc18] text-black text-[10px] font-medium">Follow</button>
                </div>

                {/* Animated waveform "video" */}
                <div className="absolute inset-x-6 top-1/2 -translate-y-12 flex items-end gap-0.5 h-24">
                  {Array.from({ length: 38 }).map((_, j) => {
                    const distance = Math.abs(j - 19);
                    const baseHeight = 30 + Math.abs(Math.sin(j * 0.5 + currentTime * 3)) * 70;
                    const isActive = j / 38 < progress / 100;
                    return (
                      <div
                        key={j}
                        className="flex-1 rounded-sm h-full"
                        style={{
                          transform: `scaleY(${baseHeight / 100})`,
                          transformOrigin: 'bottom',
                          background: isActive ? '#53fc18' : 'rgba(255,255,255,0.3)',
                          boxShadow: isActive && distance < 4 ? '0 0 6px #53fc18' : 'none',
                        }}
                      />
                    );
                  })}
                </div>

                {/* Live captions — word-by-word */}
                <div className="absolute bottom-20 inset-x-4 z-10">
                  <div className="flex flex-wrap gap-x-1.5 gap-y-1 justify-center">
                    {clip.caption.map((word, i) => {
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
                          {word.w}
                        </span>
                      );
                    })}
                  </div>
                </div>

                {/* Right rail — engagement */}
                <div className="absolute right-3 bottom-24 z-10 flex flex-col items-center gap-4">
                  <button aria-label="Like" className="flex flex-col items-center text-white/80 hover:text-[#53fc18]">
                    <Heart className="w-6 h-6" />
                  </button>
                  <button aria-label="Comment" className="flex flex-col items-center text-white/80">
                    <MessageCircle className="w-6 h-6" />
                  </button>
                  <button aria-label="Share" className="flex flex-col items-center text-white/80">
                    <Share2 className="w-6 h-6" />
                  </button>
                </div>

                {/* Progress bar */}
                <div className="absolute bottom-3 inset-x-4 z-10">
                  <div className="h-0.5 rounded-full bg-white/20 overflow-hidden">
                    <div
                      className="h-full w-full rounded-full"
                      style={{
                        transform: `scaleX(${progress / 100})`,
                        transformOrigin: 'left',
                        background: 'linear-gradient(90deg, #53fc18, #aaff66)',
                        boxShadow: '0 0 6px #53fc18',
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between mt-1 text-[9px] mono text-white/60">
                    <span>{(currentTime).toFixed(1)}s</span>
                    <span>{clip.duration}</span>
                  </div>
                </div>

                {/* Pulsing "clipper.ai" watermark badge */}
                <div className="absolute top-20 right-3 z-10 px-1.5 py-0.5 rounded bg-black/40 backdrop-blur text-[8px] mono text-[#53fc18] tracking-wider">
                  CLIPPER.AI · {clip.score}
                </div>
              </div>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

/* ──────────────────────────────────────────────────────────── INTERACTIVE DEMO
   Pick a sample recording → the studio opens and runs the real pipeline on it.
   The product *is* the demo. This section used to render its own inline
   "analyzing" console, which meant the site had two different loading screens
   for the same run; now there is exactly one — the studio's AnalyzingView —
   and this card only chooses what gets fed into it. */
function InteractiveDemo({ openApp }) {
  // Sourced from the shared SAMPLE_RECORDINGS so the visitor's pick actually
  // drives which clips lead the studio results.
  const SAMPLES = SAMPLE_RECORDINGS;
  const [picked, setPicked] = useState(0);
  const launch = () => openApp && openApp(SAMPLES[picked]);

  return (
    <section className="relative z-10 max-w-[1400px] mx-auto px-6 md:px-8 py-16 md:py-24 border-t border-white/[0.12]">
      <Reveal>
        <div className="text-center mb-10">
          <div className="text-[10px] mono text-[#53fc18] mb-4 tracking-[0.2em] uppercase flex items-center justify-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#53fc18]" style={{ boxShadow: '0 0 8px #53fc18' }} />
            Watch it work
          </div>
          <h2 className="serif text-4xl md:text-5xl leading-[1.05] mb-3">
            See it run on a <span className="italic gradient-green">real sample.</span>
          </h2>
          <p className="text-stone-400 leading-relaxed max-w-xl mx-auto">
            Pick a sample recording and watch the exact pipeline we'd run on yours, live in the studio, from raw recording to shipped clips.
          </p>
        </div>

        <div className="tilt-card max-w-4xl mx-auto rounded-2xl border border-[#53fc18]/20 bg-gradient-to-b from-[#53fc18]/[0.03] to-transparent overflow-hidden shadow-[0_0_60px_-20px_rgba(83,252,24,0.3)]">
          {/* Console header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-[#53fc18]/[0.10] bg-black/40">
            <div className="flex items-center gap-2 text-[10px] mono text-stone-400 tracking-wider uppercase">
              <span className="flex gap-1">
                <span className="w-2 h-2 rounded-full bg-stone-700" />
                <span className="w-2 h-2 rounded-full bg-stone-700" />
                <span className="w-2 h-2 rounded-full bg-[#53fc18]" style={{ boxShadow: '0 0 6px #53fc18' }} />
              </span>
              <span className="ml-2">clipper.ai / sample run</span>
            </div>
            <div className="text-[10px] mono text-stone-500 tracking-wider">
              READY
            </div>
          </div>

          {/* Pick a sample (no free-text URL: this is a managed service, not self-serve) */}
            <div className="p-8 md:p-10">
              <div className="text-[10px] mono text-stone-500 tracking-wider uppercase mb-3">Pick a sample recording</div>
              <div role="radiogroup" aria-label="Sample recording" className="flex flex-col gap-2 mb-6">
                {SAMPLES.map((s, i) => {
                  const active = i === picked;
                  return (
                    <button
                      key={s.label}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setPicked(i)}
                      className={`group/opt text-left w-full px-4 py-3 rounded-md border flex items-center gap-3 transition ${
                        active
                          ? 'border-[#53fc18] bg-[#53fc18]/10 ring-1 ring-[#53fc18]/40 shadow-[0_0_24px_-10px_rgba(83,252,24,0.6)]'
                          : 'border-white/15 bg-white/[0.02] hover:border-[#53fc18]/40 hover:bg-[#53fc18]/[0.04]'
                      }`}
                    >
                      {/* Radio indicator — unmistakable single-select affordance */}
                      <span
                        aria-hidden="true"
                        className={`shrink-0 w-[18px] h-[18px] rounded-full border flex items-center justify-center transition ${
                          active ? 'border-[#53fc18]' : 'border-white/30 group-hover/opt:border-[#53fc18]/60'
                        }`}
                      >
                        <span className={`w-2.5 h-2.5 rounded-full bg-[#53fc18] transition ${active ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={`block text-sm ${active ? 'text-stone-100' : 'text-stone-300'}`}>{s.label}</span>
                        <span className="block text-[10px] mono text-stone-500 truncate mt-0.5">{s.source}</span>
                      </span>
                      {active && (
                        <span className="shrink-0 inline-flex items-center gap-1 text-[10px] mono uppercase tracking-wider text-[#53fc18]">
                          <Check className="w-3.5 h-3.5" />
                          Selected
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <button
                  onClick={launch}
                  className="btn-neon group w-full sm:w-auto px-6 py-4 rounded-md font-medium flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  Watch the sample run
                  <ArrowUpRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </button>
                <span className="text-xs mono text-stone-500 tracking-wider">
                  Opens the studio and runs the full pipeline live
                </span>
              </div>
            </div>
        </div>
      </Reveal>
    </section>
  );
}

/* ──────────────────────────────────────────────────────────── INTEGRATIONS STRIP
   Logos for the tools Clipper plugs into. Ecosystem proof. */
function IntegrationsStrip() {
  const integrations = [
    { name: 'Zoom', cat: 'Source' },
    { name: 'Riverside', cat: 'Source' },
    { name: 'Descript', cat: 'Editor' },
    { name: 'TikTok', cat: 'Publish' },
    { name: 'Instagram', cat: 'Publish' },
    { name: 'LinkedIn', cat: 'Publish' },
    { name: 'Drive', cat: 'Storage' },
    { name: 'Dropbox', cat: 'Storage' },
    { name: 'Notion', cat: 'Workflow' },
    { name: 'Slack', cat: 'Workflow' },
  ];

  return (
    <section className="relative z-10 max-w-[1400px] mx-auto px-6 md:px-8 py-16 border-t border-white/[0.12]">
      <Reveal>
        <div className="grid md:grid-cols-[1fr_2fr] gap-12 items-start">
          <div>
            <div className="text-[10px] mono text-[#53fc18] mb-4 tracking-[0.2em] uppercase flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[#53fc18]" /> 
              Plays well with everything
            </div>
            <h2 className="serif text-4xl md:text-5xl leading-[1.05] mb-4">
              Drop in. <span className="italic gradient-green">Don't replace.</span>
            </h2>
            <p className="text-stone-400 leading-relaxed mb-6">
              Clipper fits where your content already lives. We pull from wherever you record, work in whatever tools you use, and publish to every platform your audience is on, so you don't change a thing about how you work.
            </p>
            <div className="flex flex-wrap gap-2 text-[10px] mono text-stone-500 tracking-wider uppercase">
              <span className="px-2 py-1 rounded border border-[#53fc18]/15">Any source</span>
              <span className="px-2 py-1 rounded border border-[#53fc18]/15">Any editor</span>
              <span className="px-2 py-1 rounded border border-[#53fc18]/15">Every platform</span>
              <span className="px-2 py-1 rounded border border-[#53fc18]/15">We handle it</span>
            </div>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2.5">
            {integrations.map((it, i) => (
              <div
                key={it.name}
                className="tilt-card group relative p-5 rounded-xl border border-[#53fc18]/[0.10] bg-gradient-to-br from-[#53fc18]/[0.02] to-transparent hover:border-[#53fc18]/40 flex flex-col items-center justify-center aspect-square overflow-hidden cursor-pointer transition-all duration-300"
                style={{ animationDelay: `${i * 30}ms` }}
              >
                {/* Inner glow on hover */}
                <div className="absolute inset-0 bg-gradient-to-br from-[#53fc18]/0 via-[#53fc18]/0 to-[#53fc18]/0 group-hover:from-[#53fc18]/[0.06] group-hover:to-[#53fc18]/0 transition-all duration-500" />
                {/* Corner accent */}
                <div className="absolute top-0 right-0 w-8 h-8 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <div className="absolute top-2 right-2 w-1 h-1 rounded-full bg-[#53fc18]" style={{ boxShadow: '0 0 6px #53fc18' }} />
                </div>
                <div className="relative">
                  <IntegrationGlyph name={it.name} />
                </div>
                <div className="relative text-[10px] mono text-stone-400 group-hover:text-stone-200 tracking-wider mt-3 text-center transition-colors">
                  {it.name}
                </div>
                <div className="absolute bottom-2 left-0 right-0 text-[8px] mono text-[#53fc18]/60 tracking-[0.15em] uppercase text-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  {it.cat}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Reveal>
    </section>
  );
}

/* SVG glyphs for each integration — minimal mark-style, neon-friendly */
function IntegrationGlyph({ name }) {
  const common = "w-8 h-8 text-stone-300 group-hover:text-[#53fc18] transition-all duration-300 group-hover:scale-110";
  switch (name) {
    case 'Zoom':
      // Rounded camera body + lens — video-meeting tool
      return (
        <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round">
          <rect x="2.5" y="6.5" width="13" height="11" rx="3" />
          <path d="M15.5 10.2 L21.5 7.2 v9.6 l-6 -3 z" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'Riverside':
      // Centered waveform — reads as audio recording
      return (
        <svg viewBox="0 0 24 24" className={common} fill="currentColor" stroke="none">
          <rect x="3.2" y="9" width="2" height="6" rx="1" />
          <rect x="6.7" y="6" width="2" height="12" rx="1" />
          <rect x="10.2" y="2.5" width="2" height="19" rx="1" />
          <rect x="13.7" y="6.5" width="2" height="11" rx="1" />
          <rect x="17.2" y="8.5" width="2" height="7" rx="1" />
        </svg>
      );
    case 'Descript':
      // App tile + play — media/transcript editor
      return (
        <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
          <rect x="3" y="3.5" width="18" height="17" rx="4.5" />
          <path d="M10 8.8 L15.5 12 L10 15.2 Z" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'TikTok':
      // Eighth-note glyph with the signature offset
      return (
        <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M13 4 v9.6 a3.6 3.6 0 1 1 -3.6 -3.6" />
          <path d="M13 4 c0 2.6 2.1 4.7 4.8 4.7" />
          <path d="M10.2 4.2 v9.6 a3.6 3.6 0 1 1 -3.6 -3.6" opacity="0.32" />
        </svg>
      );
    case 'Instagram':
      // Rounded frame + lens + flash dot
      return (
        <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.6">
          <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
          <circle cx="12" cy="12" r="4.2" />
          <circle cx="17" cy="7" r="1" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'LinkedIn':
      // The "in" mark
      return (
        <svg viewBox="0 0 24 24" className={common} fill="currentColor">
          <rect x="3" y="9" width="3.2" height="11" rx="0.4" />
          <circle cx="4.6" cy="5.2" r="1.9" />
          <path d="M9.5 9h3v1.7c.6-1 1.8-2 3.6-2 3.4 0 4.4 2.2 4.4 5.1V20h-3.3v-5.4c0-1.3-.3-2.4-1.7-2.4-1.5 0-2 1.1-2 2.4V20H9.5z" />
        </svg>
      );
    case 'Drive':
      // Official Google Drive mark (three blades)
      return (
        <svg viewBox="0 0 24 24" className={common} fill="currentColor">
          <path d="M12.01 1.485c-2.082 0-3.754.02-3.743.047.01.02 1.708 3.001 3.774 6.62l3.76 6.574h3.76c2.081 0 3.753-.02 3.742-.047-.005-.02-1.708-3.001-3.775-6.62l-3.76-6.574zm-4.76 1.73a789.828 789.861 0 0 0-3.63 6.319L0 15.868l1.89 3.298 1.885 3.297 3.62-6.335 3.618-6.33-1.88-3.287C8.1 4.704 7.255 3.22 7.25 3.214zm2.259 12.653-.203.348c-.114.198-.96 1.672-1.88 3.287a423.93 423.948 0 0 1-1.698 2.97c-.01.026 3.24.042 7.222.042h7.244l1.796-3.157c.992-1.734 1.85-3.23 1.906-3.323l.104-.167h-7.249z" />
        </svg>
      );
    case 'Dropbox':
      // Official Dropbox mark (five-facet open box)
      return (
        <svg viewBox="0 0 24 24" className={common} fill="currentColor">
          <path d="M6 1.807L0 5.629l6 3.822 6.001-3.822L6 1.807zM18 1.807l-6 3.822 6 3.822 6-3.822-6-3.822zM0 13.274l6 3.822 6.001-3.822L6 9.452l-6 3.822zM18 9.452l-6 3.822 6 3.822 6-3.822-6-3.822zM6 18.371l6.001 3.822 6-3.822-6-3.822L6 18.371z" />
        </svg>
      );
    case 'Notion':
      // The Notion "N"
      return (
        <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" strokeLinecap="round">
          <rect x="3.5" y="3.5" width="17" height="17" rx="2" />
          <path d="M8.5 17V8l7 8.5V8" />
        </svg>
      );
    case 'Slack':
      // Official Slack hash (eight rounded lozenges)
      return (
        <svg viewBox="0 0 24 24" className={common} fill="currentColor">
          <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
        </svg>
      );
    default:
      return <div className={common + " border border-current rounded-md"} />;
  }
}

/* ──────────────────────────────────────────────────────────── LANDING */
const PL_GLYPHS = (() => {
  // Built once at module load so the six SVGs are never recreated on a render frame.
  const s = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round', strokeLinejoin: 'round' };
  const w = (children) => <svg viewBox="0 0 17 17" width="15" height="15" aria-hidden="true">{children}</svg>;
  return {
    wave: w(<path {...s} d="M1.5 8.5h2L5 3.5l2.2 10L9.5 6l1.4 3.2h4.1" />),
    split: w(<g {...s}><path d="M2 8.5h11.5" /><path d="M6 4.5 9.5 8.5 6 12.5" /><path d="M13.5 4.5v8" /></g>),
    gauge: w(<g {...s}><path d="M2.2 12a6.3 6.3 0 0 1 12.6 0" /><path d="M8.5 12l3.4-3.8" /></g>),
    crop: w(<g {...s}><rect x="1.5" y="5" width="7.5" height="6" rx="1" /><rect x="10" y="2.5" width="4.5" height="11" rx="1" /></g>),
    caption: w(<g {...s}><rect x="1.8" y="3.5" width="13" height="9.5" rx="1.6" /><path d="M4.6 7.2h7M4.6 9.8h4.5" /></g>),
    rank: w(<g {...s}><path d="M2 13h13" /><path d="M3.5 13V8.5M7.3 13V4.5M11 13V9.8M14.6 13V6.8" /></g>),
  };
})();

function PipelineExplorer() {
  const NODES = [
    { n: '01', label: 'Transcribe', g: 'wave', val: 1240, unit: 'words', blurb: 'Speech becomes accurate, word-level text with timestamps.', out: '1,240 words \u00b7 99.2%' },
    { n: '02', label: 'Segment', g: 'split', val: 38, unit: 'segments', blurb: 'Topic and speaker shifts split the audio into candidate moments.', out: '38 segments' },
    { n: '03', label: 'Score', g: 'gauge', val: 92, unit: 'score', blurb: 'Every segment is rated for hook, emotion and pacing.', out: 'top moment: 92' },
    { n: '04', label: 'Reframe', g: 'crop', val: 1850, unit: 'frames', blurb: 'Subject tracking recomposes 16:9 footage into vertical 9:16.', out: '9:16 \u00b7 locked' },
    { n: '05', label: 'Caption', g: 'caption', val: 318, unit: 'cues', blurb: 'Word-level karaoke captions are styled and burned in.', out: 'word-level' },
    { n: '06', label: 'Rank', g: 'rank', val: 6, unit: 'clips', blurb: 'The strongest moments are ranked and exported per platform.', out: '6 clips ready' },
  ];
  const N = NODES.length;
  // Continuous motion is driven imperatively: one CSS var (--p) plus a few textContent
  // writes per frame, so the component does NOT re-render 60x/sec. React state only holds
  // the coarse stage index (changes ~6x per pass) -> smooth, fully GPU-composited.
  const [stage, setStage] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [pinned, setPinned] = useState(null);
  const [hover, setHover] = useState(null);
  const [touched, setTouched] = useState(false);
  const [reduced, setReduced] = useState(false);
  const trackRef = useRef(null);
  const rafRef = useRef(0);
  const startRef = useRef(null);
  const autoRef = useRef(true);
  const dragRef = useRef(false);
  const pRef = useRef(0);
  const stageRef = useRef(0);
  const numRefs = useRef([]);
  const pctRef = useRef(null);
  const resumeRef = useRef(0);

  const fmt = (v) => String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  // Single writer for everything that moves. Called every animation frame AND on scrub.
  const apply = (p) => {
    p = Math.max(0, Math.min(1, p));
    pRef.current = p;
    // Processing (nodes / numbers / stage / mini-bars) completes at 92% of the head's travel,
    // so the finished "06/06" state stays readable for the final glide while the head keeps
    // moving to the very end -- no pause, no backward motion, seamless loop.
    const q = Math.min(p / 0.92, 1);
    const el = trackRef.current;
    // Fade the playhead + rail fill to 0 across a ~240ms window at the loop seam, so the head's
    // wrap from the right edge back to the left (and the fill collapsing) happen while invisible.
    // Auto-play only -- manual scrubbing keeps everything fully lit.
    let seam = 1;
    if (autoRef.current) { const E = 0.02; if (p < E) seam = p / E; else if (p > 1 - E) seam = (1 - p) / E; }
    if (el) { el.style.setProperty('--p', p); el.style.setProperty('--q', q); el.style.setProperty('--seam', seam); } // head+fill use --p, bars use --q, --seam masks the loop seam
    if (pctRef.current) pctRef.current.textContent = Math.round(p * 100) + '%';
    for (let i = 0; i < N; i++) {
      const local = Math.max(0, Math.min(1, q * N - i));
      const r = numRefs.current[i];
      if (r) r.textContent = fmt(Math.round(NODES[i].val * local));
    }
    const sNew = Math.floor(q * N);                               // reaches N during the final glide
    if (sNew !== stageRef.current) { stageRef.current = sNew; setStage(sNew); }
  };

  const stopAuto = () => { autoRef.current = false; cancelAnimationFrame(rafRef.current); clearTimeout(resumeRef.current); };
  const startAuto = () => {
    autoRef.current = true; startRef.current = null;
    cancelAnimationFrame(rafRef.current); clearTimeout(resumeRef.current);
    const LOOP = 12000; // ms for one slow forward pass; loops seamlessly with no pause at the end
    const p0 = pRef.current; // resume from wherever the head currently sits (replay calls apply(0) first)
    const tick = (t) => {
      if (startRef.current == null) startRef.current = t - p0 * LOOP; // continue forward, never snap back to 0
      const p = ((t - startRef.current) % LOOP) / LOOP; // 0 -> 1 forward only, then restart (no hold)
      apply(p);
      if (autoRef.current) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  };
  // After a scrub or a card click, pause briefly to inspect, then glide on again on its own.
  const scheduleResume = () => {
    clearTimeout(resumeRef.current);
    resumeRef.current = setTimeout(() => { setPinned(null); setHover(null); startAuto(); }, 2600);
  };

  useEffect(() => {
    const mq = (typeof window !== 'undefined' && window.matchMedia) ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    const rm = !!(mq && mq.matches);
    setReduced(rm);
    if (rm) { apply(1); return; }
    apply(0);
    startAuto();
    return () => { cancelAnimationFrame(rafRef.current); clearTimeout(resumeRef.current); };
  }, []);

  const setFromX = (clientX) => {
    const el = trackRef.current; if (!el) return;
    const r = el.getBoundingClientRect();
    apply((clientX - r.left) / r.width);
  };
  const onDown = (e) => {
    stopAuto(); setTouched(true); setDragging(true); dragRef.current = true; setPinned(null);
    if (e.currentTarget.setPointerCapture) { try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) {} }
    setFromX(e.clientX);
  };
  const onMove = (e) => { if (!dragRef.current) return; setFromX(e.clientX); };
  const onUp = (e) => {
    setDragging(false); dragRef.current = false;
    if (e.currentTarget.releasePointerCapture) { try { e.currentTarget.releasePointerCapture(e.pointerId); } catch (err) {} }
    scheduleResume();
  };
  const onNode = (i) => { stopAuto(); setTouched(true); setPinned(i); apply((i + 0.5) / N); scheduleResume(); };
  const replay = () => { clearTimeout(resumeRef.current); setPinned(null); setHover(null); setTouched(true); apply(0); startAuto(); };

  const done = Math.min(stage, N);
  const focus = pinned != null ? pinned : (hover != null ? hover : Math.min(stage, N - 1));
  const f = NODES[focus];
  const fState = focus < stage ? 'done' : (focus === stage ? 'active' : 'idle');

  return (
    <div className="pl-stage">
      <div className="pl-panel rounded-2xl border border-[#53fc18]/[0.14] bg-gradient-to-b from-white/[0.03] to-transparent backdrop-blur overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06] text-[10px] mono tracking-wider uppercase text-stone-400">
          <div className="flex items-center gap-2">
            <span className={"inline-block w-1.5 h-1.5 rounded-full bg-[#53fc18] " + (reduced ? "" : "pl-live")} />
            Six-model pipeline
          </div>
          <div className="flex items-center gap-3">
            <span className="text-stone-500">{String(done).padStart(2, '0')}/06 complete</span>
            <button type="button" onClick={replay} className="pl-replay text-stone-400 hover:text-[#53fc18] transition-colors">{'\u21bb'} replay</button>
          </div>
        </div>

        <div className="px-5 md:px-7 pt-7 pb-6">
          {/* spine / scrubber */}
          <div className="flex items-center justify-between text-[9px] mono uppercase tracking-widest text-stone-500 mb-2">
            <span>Source {'\u00b7'} 1h 04m</span>
            <span ref={pctRef}>0%</span>
          </div>
          <div
            ref={trackRef}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            className={"pl-track relative h-9 flex items-center select-none " + (dragging ? "is-grabbing" : "")}
            style={{ touchAction: 'none' }}
          >
            <div className="pl-rail absolute left-0 right-0 h-2 rounded-full bg-white/[0.07] overflow-hidden">
              <div className="pl-fill h-full" />
            </div>
            {NODES.map((nd, i) => {
              const tickOn = i < stage;
              return (
                <span key={i} className={"pl-tick absolute w-px h-3 " + (tickOn ? "pl-tick-on bg-[#53fc18]" : "bg-white/15")} style={{ left: ((i + 1) / N * 100) + '%' }} />
              );
            })}
            <span className="pl-head absolute top-0 bottom-0 left-0 w-full">
              <span className="pl-head-line" />
              <span className="pl-head-cap" />
            </span>
          </div>

          {/* nodes */}
          <div className="grid grid-cols-3 lg:grid-cols-6 gap-2.5 mt-6">
            {NODES.map((nd, i) => {
              const st = i < stage ? 'done' : (i === stage ? 'active' : 'idle');
              const lit = i <= stage;
              const cls = "pl-node relative overflow-hidden text-left rounded-xl border px-3 pt-3 pb-4 " +
                (st === 'idle' ? "border-white/[0.08] bg-white/[0.01] " : "border-[#53fc18]/40 bg-[#53fc18]/[0.05] ") +
                (st === 'done' ? "is-done " : "") +
                (st === 'active' ? "is-active " : "") +
                (focus === i ? "is-focus " : "");
              return (
                <button key={i} type="button" onClick={() => onNode(i)} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} className={cls}>
                  <span className="pl-cnr pl-cnr-tl" aria-hidden="true" />
                  <span className="pl-cnr pl-cnr-br" aria-hidden="true" />
                  <div className="flex items-center justify-between mb-2">
                    <span className={"pl-glyph " + (st === 'idle' ? "text-stone-500" : "text-[#53fc18]")}>{PL_GLYPHS[nd.g]}</span>
                    <span className={"w-1.5 h-1.5 rounded-full " + (st === 'done' ? "bg-[#53fc18]" : st === 'active' ? "bg-[#53fc18] pl-dot" : "bg-stone-600")} />
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className={"mono text-[10px] " + (st === 'idle' ? "text-stone-500" : "text-[#53fc18]")}>{nd.n}</span>
                    <span className={"text-xs font-medium tracking-wide " + (st === 'idle' ? "text-stone-400" : "text-stone-100")}>{nd.label}</span>
                  </div>
                  <div className={"pl-val mono mt-2 leading-none " + (lit ? "text-[#53fc18]" : "text-stone-600")}><span ref={(el) => { numRefs.current[i] = el; }} className="text-[14px] font-semibold tracking-tight">0</span><span className="pl-caret" aria-hidden="true" /><span className="text-[9px] text-stone-500"> {nd.unit}</span></div>
                  <span className="pl-bar absolute left-0 right-0 bottom-0 h-[3px] bg-white/[0.06]">
                    <span className="pl-bar-fill block h-full" style={{ '--i': i }} />
                  </span>
                </button>
              );
            })}
          </div>

          {/* detail */}
          <div className="pl-detail mt-5 rounded-xl border border-white/[0.07] bg-black/30 px-4 py-4 grid grid-cols-[auto_1fr] gap-4 items-start">
            <div className="mono text-3xl leading-none text-[#53fc18]">{f.n}</div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-stone-100">{f.label}</span>
                <span className={"text-[9px] mono uppercase tracking-widest px-1.5 py-[2px] rounded " + (fState === 'idle' ? "text-stone-500 border border-white/10" : "text-[#53fc18] border border-[#53fc18]/30 bg-[#53fc18]/[0.06]")}>{fState === 'done' ? 'complete' : fState === 'active' ? 'running' : 'queued'}</span>
              </div>
              <p className="text-xs text-stone-400 mt-1.5 leading-relaxed">{f.blurb}</p>
              <div className="mt-2 text-[11px] mono text-stone-300">{'>'} {f.out}</div>
            </div>
          </div>

          <div className={"text-center text-[10px] mono uppercase tracking-widest text-stone-600 mt-4 transition-opacity duration-500 " + (touched ? "opacity-0" : "opacity-100")}>
            drag to scrub {'\u00b7'} click a stage to inspect
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────── CONTENT ECONOMICS CALCULATOR
   The page is already heavy on *process* (hero pipeline, the 7-step "how it
   works", the interactive demo). This section deliberately changes the axis:
   instead of showing how the work happens, it lets the visitor reframe the
   service around *outcomes* — set how many recordings you publish a month and
   watch the output multiply, including the editing load we absorb on your
   behalf. Every constant is derived from the real DEMO_CLIPS batch; the two
   estimates (editing minutes per clip, posts = clips × platforms) are stated in
   plain sight. Nothing here is fabricated — the visitor's real numbers come from
   their own content, which the copy says explicitly. */
const CM_EDIT_MIN_PER_CLIP = 45; // transparent assumption, surfaced in the footnote

// Eases a displayed number from its current value to a new target whenever the
// target changes (e.g. as the slider moves), so figures glide instead of snapping.
// Collapses to an instant set under reduced-motion.

function useTween(target, ms = 480) {
  const [val, setVal] = useState(target);
  const valRef = useRef(target);
  valRef.current = val;
  const rafRef = useRef(0);
  useEffect(() => {
    if (prefersReducedMotion()) { setVal(target); return; }
    const from = valRef.current;
    const start = performance.now();
    const ease = (t) => 1 - Math.pow(1 - t, 3);
    const tick = (now) => {
      const t = Math.min(1, (now - start) / ms);
      setVal(from + (target - from) * ease(t));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, ms]);
  return val;
}

function ContentMath({ bookCall }) {
  const [recs, setRecs] = useState(4);

  // Honest per-recording constants pulled straight from the seeded batch.
  const clipsPerRec = DEMO_CLIPS.length;
  const avgPlatforms = DEMO_CLIPS.reduce((a, c) => a + c.platforms.length, 0) / DEMO_CLIPS.length;
  const avgDurSec = DEMO_CLIPS.reduce((a, c) => a + c.duration, 0) / DEMO_CLIPS.length;

  const clips = recs * clipsPerRec;
  const posts = Math.round(clips * avgPlatforms);
  const minutes = Math.round((clips * avgDurSec) / 60);
  const hours = Math.round((clips * CM_EDIT_MIN_PER_CLIP) / 60);
  const perDay = (posts / 30).toFixed(1);

  // Tweened display values — glide between targets as the slider moves.
  const dPosts = Math.round(useTween(posts));
  const dClips = Math.round(useTween(clips));
  const dMinutes = Math.round(useTween(minutes));
  const dHours = Math.round(useTween(hours));

  const min = 1, max = 12;
  const fillPct = ((recs - min) / (max - min)) * 100;

  const tiles = [
    { v: dClips.toLocaleString(), l: 'ship-ready clips' },
    { v: dMinutes.toLocaleString(), l: 'minutes of short-form' },
    { v: dHours.toLocaleString(), l: 'editor-hours we absorb' },
  ];

  return (
    <section className="relative z-10 max-w-[1400px] mx-auto px-6 md:px-8 py-16 border-t border-white/[0.12]">
      <Reveal>
        <div className="max-w-2xl mb-12">
          <div className="text-[10px] mono text-[#53fc18] mb-4 tracking-[0.2em] uppercase flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#53fc18]" style={{ boxShadow: '0 0 8px #53fc18' }} /> Run the numbers
          </div>
          <h2 className="serif text-4xl md:text-6xl leading-[1.02] tracking-tight mb-5">
            One month of recording,<br /><span className="italic gradient-green">multiplied.</span>
          </h2>
          <p className="text-stone-400 leading-relaxed text-lg">
            You don&apos;t buy clips one at a time, you buy a steady output. Drag to set how often you already hit record, and see what we turn it into, plus the editing we take off your plate.
          </p>
        </div>
      </Reveal>

      <Reveal delay={120}>
        <div className="relative rounded-2xl border border-[#53fc18]/[0.14] bg-gradient-to-b from-[#53fc18]/[0.02] to-transparent p-6 md:p-10 overflow-hidden">
          <span aria-hidden className="absolute inset-x-0 top-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(83,252,24,0.6), transparent)' }} />

          <div className="grid lg:grid-cols-[0.85fr_1.15fr] gap-8 lg:gap-12 items-center">
            {/* Control + hero output */}
            <div>
              <label htmlFor="cm-recs" className="block text-[10px] mono text-stone-500 tracking-wider uppercase mb-3">
                Recordings you publish per month
              </label>
              <div className="flex items-end gap-3 mb-5">
                <span className="serif text-6xl text-stone-100 tabular-nums leading-none">{recs}</span>
                <span className="text-sm text-stone-500 mb-1.5">{recs === 1 ? 'recording' : 'recordings'} / mo</span>
              </div>
              <input
                id="cm-recs" type="range" min={min} max={max} step={1} value={recs}
                onChange={(e) => setRecs(Number(e.target.value))}
                className="cm-range" style={{ '--fill': `${fillPct}%` }}
                aria-valuetext={`${recs} recordings per month`}
              />
              <div className="flex justify-between text-[10px] mono text-stone-600 mt-2">
                <span>{min}</span><span>weekly</span><span>{max}+</span>
              </div>

              <div className="cm-hero-glow mt-8 p-5 rounded-xl border border-[#53fc18]/30 bg-[#53fc18]/[0.04]">
                <div className="text-[10px] mono text-[#53fc18] tracking-wider uppercase mb-1.5">Platform-native posts / month</div>
                <div className="flex items-baseline gap-3">
                  <span className="cm-val serif text-6xl md:text-7xl text-[#53fc18] tabular-nums leading-none">{dPosts.toLocaleString()}</span>
                </div>
                <div className="text-xs text-stone-400 mt-3">
                  {clips} clips, each cut for ~{avgPlatforms.toFixed(0)} platforms. That's <span className="text-stone-200">{perDay} posts a day</span>, every day.
                </div>
              </div>
            </div>

            {/* Secondary outputs */}
            <div>
              <div className="grid sm:grid-cols-3 gap-px rounded-xl overflow-hidden border border-stone-800 bg-stone-800 mb-6">
                {tiles.map((t) => (
                  <div key={t.l} className="cm-tile card-lift bg-stone-950/80 p-5">
                    <div className="cm-val serif text-4xl text-stone-100 tabular-nums leading-none">{t.v}</div>
                    <div className="text-[10px] mono text-stone-500 tracking-wider uppercase mt-2 leading-tight">{t.l}</div>
                  </div>
                ))}
              </div>

              <div className="rounded-xl border border-stone-800 bg-stone-900/30 p-5">
                <div className="flex items-start gap-3">
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-[#53fc18]/25 bg-[#53fc18]/[0.06] shrink-0">
                    <Clock className="w-4 h-4 text-[#53fc18]" />
                  </span>
                  <div>
                    <div className="text-sm text-stone-200 leading-snug">
                      That&apos;s roughly <span className="text-[#53fc18] font-medium">{dHours} hours</span> of editing a month you never have to do, scope, or hire for.
                    </div>
                    <div className="text-[11px] text-stone-500 mt-1.5">A human still signs off on every cut before it ships.</div>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-4">
                <button onClick={bookCall} className="btn-neon group px-7 py-4 rounded-md font-medium inline-flex items-center gap-2">
                  Book a demo
                  <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </button>
                <span className="text-xs mono text-stone-500">We scope the real plan on the call.</span>
              </div>
            </div>
          </div>

          <p className="text-[10px] mono text-stone-600 leading-relaxed mt-8 pt-6 border-t border-white/[0.06] max-w-3xl">
            Estimate from our last batch: {clipsPerRec} ship-ready clips per recording, formatted for ~{avgPlatforms.toFixed(0)} platforms each, ~{Math.round(avgDurSec)}s apiece, with editing estimated at {CM_EDIT_MIN_PER_CLIP} min per finished clip. Your real numbers come from your own content.
          </p>
        </div>
      </Reveal>
    </section>
  );
}

/* ──────────────────────────────────────────────────────────── VIRALITY CHART
   Animated bar chart — neon green bars with live data feel */
function ViralityChart() {
  /* Animated SVG scoring console, in the same drawn language as the hero figure.
     Bars grow in staggered when scrolled into view; the 90-point "ready to post"
     threshold draws itself across the chart; peak bars carry score flags; and a
     continuous scan line sweeps the distribution, brightening each bar as it
     passes (each bar's brightness wave is phase-offset to match the sweep, so
     the whole thing stays in sync forever with zero JS per frame).
     Reduced motion: the global guard zeroes the grow-in transitions so bars
     appear fully drawn, and the sweep layer is hidden via media query. */
  const ref = useReveal();
  const N = 36;
  const SWEEP = '8s';
  // Chart geometry (SVG user units)
  const L = 24, R = 1176, TOP = 26, BASE = 252, MAXH = BASE - TOP - 14;
  const W = R - L;
  const slot = W / N;
  const barW = slot - 6;
  // Deterministic pseudo-random distribution, three 90+ peaks
  const bars = Array.from({ length: N }, (_, i) => {
    const peak = i === 9 || i === 19 || i === 29;
    const v = peak
      ? ({ 9: 92, 19: 96, 29: 91 })[i]
      : Math.round(24 + Math.abs(Math.sin(i * 0.53 + 1.2)) * 34 + Math.abs(Math.cos(i * 0.31)) * 18);
    return { v, peak };
  });
  const yFor = (v) => BASE - (v / 100) * MAXH;
  const thresholdY = yFor(90);
  const mono = { fontFamily: "'JetBrains Mono', Menlo, monospace", textTransform: 'uppercase' };

  return (
    <div ref={ref} className="vchart relative rounded-xl border border-[#53fc18]/20 bg-gradient-to-b from-[#53fc18]/[0.04] to-transparent p-5 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between text-[10px] mono text-stone-500 tracking-wider uppercase mb-2">
        <span className="flex items-center gap-1.5">
          <span className="w-1 h-1 rounded-full bg-[#53fc18] animate-pulse-soft" />
          Virality distribution · 24h
        </span>
        <span className="text-[#53fc18]">peak 96</span>
      </div>
      <style>{`
        .vchart .vc-bar {
          transform: scaleY(0);
          transform-box: fill-box;
          transform-origin: bottom;
          transition: transform 0.7s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .vchart.in .vc-bar { transform: scaleY(1); }
        .vchart .vc-draw {
          stroke-dasharray: 1; stroke-dashoffset: 1;
          transition: stroke-dashoffset 1.4s cubic-bezier(0.16, 1, 0.3, 1) 0.9s;
        }
        .vchart.in .vc-draw { stroke-dashoffset: 0; }
        .vchart .vc-meta { opacity: 0; transition: opacity 0.5s ease 1.1s; }
        .vchart.in .vc-meta { opacity: 1; }
        .vchart .vc-flag { opacity: 0; transform: translateY(5px); transform-box: fill-box;
          transition: opacity 0.45s ease, transform 0.45s cubic-bezier(0.16,1,0.3,1); }
        .vchart.in .vc-flag { opacity: 1; transform: translateY(0); }
        @keyframes vcSweep { from { transform: translateX(0); } to { transform: translateX(${W}px); } }
        .vchart .vc-sweep { animation: vcSweep ${SWEEP} linear infinite; }
        @keyframes vcWave { 0%, 7%, 100% { opacity: 0.75; } 2.5% { opacity: 1; } }
        .vchart .vc-bar { animation: vcWave ${SWEEP} linear infinite; }
        @keyframes vcPeakWave {
          0%, 7%, 100% { filter: drop-shadow(0 0 0 rgba(83,252,24,0)); opacity: 0.9; }
          2.5% { filter: drop-shadow(0 0 7px rgba(83,252,24,0.7)); opacity: 1; }
        }
        .vchart .vc-bar.vc-peak { animation-name: vcPeakWave; }
        @media (prefers-reduced-motion: reduce) {
          .vchart .vc-sweep { display: none; }
          .vchart .vc-bar { animation: none; opacity: 0.9; }
        }
      `}</style>
      <svg viewBox="0 0 1200 286" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-auto" aria-hidden>
        <defs>
          <linearGradient id="vcBar" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor="#53fc18" stopOpacity="0.16" />
            <stop offset="1" stopColor="#53fc18" stopOpacity="0.55" />
          </linearGradient>
          <linearGradient id="vcBarPeak" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor="#53fc18" stopOpacity="0.55" />
            <stop offset="1" stopColor="#b8ff7d" stopOpacity="1" />
          </linearGradient>
          <linearGradient id="vcScan" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#53fc18" stopOpacity="0" />
            <stop offset="1" stopColor="#53fc18" stopOpacity="0.10" />
          </linearGradient>
        </defs>

        {/* faint gridlines with axis labels */}
        <g className="vc-meta">
          {[25, 50, 75].map((g) => (
            <g key={g}>
              <path d={`M${L} ${yFor(g)} H${R}`} stroke="#53fc18" strokeOpacity="0.10" strokeWidth="1" strokeDasharray="3 5" />
              <text x={L - 8} y={yFor(g) + 3} textAnchor="end" fill="#57534e" fontSize="9" letterSpacing="1" style={mono}>{g}</text>
            </g>
          ))}
          <path d={`M${L} ${BASE} H${R}`} stroke="#44403c" strokeWidth="1" />
          <text x={L} y={BASE + 22} fill="#57534e" fontSize="10" letterSpacing="2" style={mono}>Clips scored, last 24h</text>
          <text x={R} y={BASE + 22} textAnchor="end" fill="#57534e" fontSize="10" letterSpacing="2" style={mono}>Illustrative</text>
        </g>

        {/* the bars */}
        {bars.map((b, i) => (
          <rect
            key={i}
            className={`vc-bar ${b.peak ? 'vc-peak' : ''}`}
            x={L + i * slot + 3}
            y={yFor(b.v)}
            width={barW}
            height={BASE - yFor(b.v)}
            rx="3"
            fill={b.peak ? 'url(#vcBarPeak)' : 'url(#vcBar)'}
            style={{ transitionDelay: `${i * 28}ms`, animationDelay: `calc(${(i / N).toFixed(4)} * ${SWEEP})` }}
          >
            <title>{`Score ${b.v}`}</title>
          </rect>
        ))}

        {/* score flags on the peaks */}
        {bars.map((b, i) => b.peak ? (
          <text
            key={i}
            className="vc-flag"
            x={L + i * slot + 3 + barW / 2}
            y={yFor(b.v) - 9}
            textAnchor="middle"
            fill="#b8ff7d"
            fontSize="11"
            letterSpacing="1"
            style={{ ...mono, transitionDelay: `${1.2 + i * 0.02}s` }}
          >
            {b.v}
          </text>
        ) : null)}

        {/* the 90-point threshold draws itself across */}
        <path className="vc-draw" pathLength="1" d={`M${L} ${thresholdY} H${R}`}
          stroke="#53fc18" strokeOpacity="0.5" strokeWidth="1" />
        <g className="vc-meta">
          <text x={R} y={thresholdY - 7} textAnchor="end" fill="#53fc18" fillOpacity="0.8" fontSize="10" letterSpacing="1.6" style={mono}>
            90 · ready to post
          </text>
        </g>

        {/* the scan: a sweeping line with a trailing wash, phase-locked to the bar wave */}
        <g className="vc-sweep vc-meta">
          <rect x={L - 56} y={TOP} width="56" height={BASE - TOP} fill="url(#vcScan)" />
          <path d={`M${L} ${TOP} V${BASE}`} stroke="#aaff66" strokeOpacity="0.55" strokeWidth="1" />
        </g>
      </svg>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────── SIGNATURE PATH
   The site's one signature figure, now interactive: a single audio-waveform stroke
   (the long-form recording, with its timecode ruler) runs left to right, passes
   through the analysis node, and fans out into six 9:16 clip frames ranked by
   virality score. It draws itself on first scroll into view, then runs a quiet
   synchronized loop — a spark travels the recording, pings the node, splits into
   six staggered sparks down the branches, and lights each frame as it lands.
   Hover, focus, or tap a clip frame to trace it back: its branch lights up, the
   slice of the recording it was cut from is marked on the waveform, and a console
   readout prints the hook type, timestamps, and score. Keyboard accessible (each
   frame is focusable with a full text label); the ambient loop is never mounted
   under prefers-reduced-motion, and the draw-in transitions are zeroed by the
   global guard, so the figure simply appears fully drawn. */
function SignaturePath() {
  const wrapRef = useRef(null);
  const [inView, setInView] = useState(false);
  const [motionOK, setMotionOK] = useState(false);
  const [hov, setHov] = useState(null);
  useEffect(() => {
    if (!prefersReducedMotion()) setMotionOK(true);
    const el = wrapRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) { setInView(true); obs.disconnect(); } }),
      { threshold: 0.2, rootMargin: '0px 0px -10% 0px' }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Six clips, ranked by score. `src` is the slice of the waveform each was cut
  // from (x-range on the timeline) with matching timestamps for the readout.
  const branches = [
    { x: 660,  y: 20,  score: 94, hook: 'Hook',  src: [188, 200], t: ['00:38:12', '00:38:51'] },
    { x: 770,  y: 50,  score: 88, hook: 'Turn',  src: [96, 108],  t: ['00:16:44', '00:17:21'] },
    { x: 880,  y: 80,  score: 81, hook: 'Quote', src: [312, 324], t: ['01:09:30', '01:10:02'] },
    { x: 990,  y: 110, score: 76, hook: 'List',  src: [408, 420], t: ['01:33:05', '01:33:41'] },
    { x: 1100, y: 140, score: 71, hook: 'Punch', src: [130, 142], t: ['00:26:10', '00:26:48'] },
    { x: 1180, y: 160, score: 65, hook: 'CTA',   src: [345, 357], t: ['01:18:22', '01:18:55'] },
  ];
  const branchD = (b) =>
    `M478 104 C ${478 + (b.x - 478) * 0.4} 104, ${b.x - 70} ${b.y + 31}, ${b.x - 16} ${b.y + 31}`;
  // One shared 7s cycle keeps every spark, ping, and flash in phase.
  const CYC = '7s';
  const f3 = (n) => n.toFixed(3);
  const mono = { fontFamily: "'JetBrains Mono', Menlo, monospace", textTransform: 'uppercase' };
  const readout = hov == null
    ? null
    : `Clip 0${hov + 1} · ${branches[hov].hook} · ${branches[hov].t[0]} → ${branches[hov].t[1]} · Score ${branches[hov].score}`;
  const frameLabel = (b, i) =>
    `Clip ${i + 1}: ${b.hook}, cut at ${b.t[0]} to ${b.t[1]}, virality score ${b.score}`;

  return (
    <div ref={wrapRef} className={`sigpath mt-14 mb-2 hidden md:block ${inView ? 'in' : ''}`}>
      <style>{`
        .sigpath { opacity: 0; transition: opacity 0.8s ease; }
        .sigpath.in { opacity: 1; }
        .sigpath .sig-draw {
          stroke-dasharray: 1; stroke-dashoffset: 1;
          transition: stroke-dashoffset 1.6s cubic-bezier(0.16, 1, 0.3, 1),
                      stroke-opacity 0.25s ease, stroke-width 0.25s ease;
        }
        .sigpath .sig-branch { transition-duration: 1.1s, 0.25s, 0.25s; }
        .sigpath.in .sig-draw { stroke-dashoffset: 0; }
        .sigpath .sig-frame, .sigpath .sig-meta { opacity: 0; transition: opacity 0.5s ease; }
        .sigpath.in .sig-frame, .sigpath.in .sig-meta { opacity: 1; }
        .sigpath.in .sig-branch { transition-delay: 0.9s, 0s, 0s; }
        .sigpath.in .sig-frame { transition-delay: 1.5s; }
        .sigpath.in .sig-meta { transition-delay: 0.6s; }
        .sigpath .sig-chip { opacity: 0; transform: translateY(4px); transition: opacity 0.45s ease, transform 0.45s cubic-bezier(0.16,1,0.3,1), fill-opacity 0.25s ease; }
        .sigpath.in .sig-chip { opacity: 1; transform: translateY(0); }
        .sigpath .sig-hit { cursor: pointer; outline: none; }
        .sigpath .sig-rect { transition: stroke-opacity 0.25s ease, fill-opacity 0.25s ease; }
        .sigpath .sig-band { transition: opacity 0.3s ease; }
        .sigpath .sig-loop { transition: opacity 0.35s ease; }
        .sigpath .sig-readout { transition: opacity 0.25s ease; }
      `}</style>
      <svg
        viewBox="0 0 1240 232"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-auto overflow-visible"
        role="group"
        aria-label="How it works: one long recording goes in, six short clips ranked by virality score come out. Focus a clip to see where it was cut."
        onMouseLeave={() => setHov(null)}
      >
        <defs>
          <linearGradient id="sigStroke" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#53fc18" stopOpacity="0.45" />
            <stop offset="0.8" stopColor="#53fc18" />
            <stop offset="1" stopColor="#b8ff7d" />
          </linearGradient>
          <filter id="sigGlow" x="-300%" y="-300%" width="700%" height="700%">
            <feGaussianBlur stdDeviation="2.6" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* the long-form: one continuous waveform stroke */}
        <path
          id="sigMain"
          className="sig-draw"
          pathLength="1"
          d="M10 104 H80
             l9 -34 l10 68 l9 -50 l10 30 l9 -14
             H170
             l9 -50 l10 82 l9 -60 l10 36 l9 -8
             H300
             l9 -26 l10 46 l9 -36 l10 16
             H400
             l9 -14 l10 24 l9 -10
             H462"
          stroke="url(#sigStroke)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"
        />

        {/* source slice marker — appears when a clip is hovered/focused */}
        {branches.map((b, i) => (
          <g key={i} className="sig-band" opacity={hov === i ? 1 : 0} pointerEvents="none">
            <rect x={b.src[0]} y={46} width={b.src[1] - b.src[0]} height={98} fill="rgba(83,252,24,0.07)" />
            <path d={`M${b.src[0]} 48 V144 M${b.src[1]} 48 V144`}
              stroke="#53fc18" strokeOpacity="0.55" strokeWidth="1" strokeDasharray="3 3" />
            <text x={(b.src[0] + b.src[1]) / 2} y={40} textAnchor="middle"
              fill="#53fc18" fillOpacity="0.8" fontSize="10" letterSpacing="1" style={mono}>
              {b.t[0]}
            </text>
          </g>
        ))}

        {/* timecode ruler under the recording */}
        <g className="sig-meta">
          <path d="M10 144 H462" stroke="#44403c" strokeWidth="1" />
          {Array.from({ length: 9 }, (_, i) => 10 + i * 56.5).map((x) => (
            <path key={x} d={`M${x} 144 v5`} stroke="#57534e" strokeWidth="1" />
          ))}
          <text x="10" y="166" fill="#78716c" fontSize="10" letterSpacing="1.6" style={mono}>00:00:00</text>
          <text x="462" y="166" textAnchor="end" fill="#78716c" fontSize="10" letterSpacing="1.6" style={mono}>01:47:55</text>
          <text x="10" y="192" fill="#57534e" fontSize="10" letterSpacing="2.2" style={mono}>One recording</text>
          <text x="1230" y="14" textAnchor="end" fill="#57534e" fontSize="10" letterSpacing="2.2" style={mono}>A week of clips · ranked by score</text>
        </g>

        {/* console readout — prints the hovered clip's provenance */}
        <g className="sig-readout sig-meta" opacity={inView ? 1 : 0}>
          <text x="520" y="206" fontSize="10" letterSpacing="1.4" style={mono}
            fill={hov == null ? '#57534e' : '#53fc18'} fillOpacity={hov == null ? 1 : 0.9}>
            {hov == null ? '→ Hover a clip to trace it back to the recording' : `→ ${readout}`}
          </text>
        </g>

        {/* the node where moments are found */}
        <circle className="sig-frame" cx="470" cy="104" r="5" fill="none" stroke="#53fc18" strokeWidth="1.5" />
        <circle className="sig-frame" cx="470" cy="104" r="1.8" fill="#53fc18" />

        {/* branches: one curve per clip */}
        {branches.map((b, i) => (
          <path
            key={i}
            className="sig-draw sig-branch"
            pathLength="1"
            id={`sigBr${i}`}
            d={branchD(b)}
            stroke="#53fc18"
            strokeOpacity={hov === i ? 0.95 : (hov == null ? 0.45 - i * 0.04 : 0.14)}
            strokeWidth={hov === i ? 1.75 : 1.25}
            strokeLinecap="round"
          />
        ))}

        {/* the clips: six 9:16 frames with caption ticks, score chips, hit areas */}
        {branches.map((b, i) => {
          const lit = hov === i;
          const dim = hov != null && !lit;
          return (
            <g
              key={i}
              className="sig-hit"
              tabIndex={inView ? 0 : -1}
              role="img"
              aria-label={frameLabel(b, i)}
              onMouseEnter={() => setHov(i)}
              onFocus={() => setHov(i)}
              onBlur={() => setHov(null)}
              onClick={() => setHov(i)}
            >
              {/* generous invisible hit area */}
              <rect x={b.x - 20} y={b.y - 8} width="40" height="74" fill="transparent" pointerEvents="all" />
              <g className="sig-frame">
                <rect className="sig-rect" x={b.x - 13} y={b.y + 8} width="26" height="46" rx="5"
                  stroke="#53fc18"
                  strokeOpacity={lit ? 1 : (dim ? 0.3 : 0.85 - i * 0.1)}
                  strokeWidth={lit ? 1.75 : 1.25}
                  fill="#53fc18"
                  fillOpacity={lit ? 0.14 : 0.04} />
                <path d={`M${b.x - 6} ${b.y + 42} h12 M${b.x - 5} ${b.y + 47} h10`}
                  stroke="#53fc18" strokeOpacity={lit ? 0.9 : (dim ? 0.2 : 0.5 - i * 0.05)} strokeWidth="1" strokeLinecap="round" />
              </g>
              <text className="sig-chip" x={b.x} y={b.y} textAnchor="middle"
                fill="#53fc18" fillOpacity={lit ? 1 : (dim ? 0.3 : 1 - i * 0.11)} fontSize="11" letterSpacing="1"
                style={{ ...mono, transitionDelay: inView ? `${1.7 + i * 0.1}s, ${1.7 + i * 0.1}s, 0s` : '0s' }}>
                {b.score}
              </text>
              {/* hook label appears under the lit frame */}
              <text x={b.x} y={b.y + 68} textAnchor="middle" pointerEvents="none"
                fill="#53fc18" fontSize="10" letterSpacing="1.6" style={mono}
                opacity={lit ? 0.8 : 0} className="sig-band">
                {b.hook}
              </text>
            </g>
          );
        })}

        {/* ── the loop: spark → node ping → branch sparks → frame flashes ──
            All animations share one cycle on the document timeline, so they stay
            in phase no matter when this layer mounts. Dimmed while a clip is
            being inspected; never rendered under prefers-reduced-motion. */}
        {inView && motionOK && (
          <g className="sig-loop" opacity={hov == null ? 1 : 0.2} pointerEvents="none">
            {branches.map((b, i) => {
              const t1 = 0.48 + i * 0.022;
              return (
                <rect key={i} x={b.x - 12} y={b.y + 9} width="24" height="44" rx="4"
                  fill="#53fc18" opacity="0">
                  <animate attributeName="opacity" dur={CYC} repeatCount="indefinite"
                    values="0;0;0.22;0;0"
                    keyTimes={`0;${f3(t1)};${f3(t1 + 0.015)};${f3(t1 + 0.1)};1`} />
                </rect>
              );
            })}
            <circle cx="470" cy="104" fill="none" stroke="#53fc18" strokeWidth="1" r="5" opacity="0">
              <animate attributeName="r" dur={CYC} repeatCount="indefinite"
                values="5;5;5;16;16" keyTimes="0;0.26;0.261;0.4;1" />
              <animate attributeName="opacity" dur={CYC} repeatCount="indefinite"
                values="0;0;0.7;0;0" keyTimes="0;0.26;0.275;0.4;1" />
            </circle>
            <g filter="url(#sigGlow)">
              <circle r="2.8" fill="#d9ffba" opacity="0">
                <animateMotion dur={CYC} repeatCount="indefinite" calcMode="linear"
                  keyPoints="0;1;1" keyTimes="0;0.26;1">
                  <mpath href="#sigMain" />
                </animateMotion>
                <animate attributeName="opacity" dur={CYC} repeatCount="indefinite"
                  values="0;1;1;0;0" keyTimes="0;0.02;0.24;0.265;1" />
              </circle>
              {branches.map((b, i) => {
                const t0 = 0.27 + i * 0.022;
                const t1 = 0.48 + i * 0.022;
                return (
                  <circle key={i} r="2.1" fill="#aaff66" opacity="0">
                    <animateMotion dur={CYC} repeatCount="indefinite" calcMode="linear"
                      keyPoints="0;0;1;1" keyTimes={`0;${f3(t0)};${f3(t1)};1`}>
                      <mpath href={`#sigBr${i}`} />
                    </animateMotion>
                    <animate attributeName="opacity" dur={CYC} repeatCount="indefinite"
                      values="0;0;0.9;0.9;0;0"
                      keyTimes={`0;${f3(t0)};${f3(t0 + 0.012)};${f3(t1 - 0.012)};${f3(t1)};1`} />
                  </circle>
                );
              })}
            </g>
          </g>
        )}
      </svg>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────── MANIFESTO
   One giant statement that lights up word by word as it scrolls through the
   viewport — the Linear/Arc "thesis" moment. Scroll-linked via a passive,
   rAF-throttled handler; reduced motion renders it fully lit. */
function Manifesto() {
  // [text, accent?] — accents glow green when lit.
  const WORDS = [
    ['Every'], ['hour'], ['you'], ['record'], ['hides'], ['a'], ['week'], ['of'],
    ['short-form.', true], ['We'], ['find'], ['it,'], ['cut'], ['it,'], ['score'], ['it,'],
    ['and'], ['ship'], ['it', true], ['while'], ['you'], ['make'], ['the'], ['next'], ['one.'],
  ];
  const ref = useRef(null);
  const [lit, setLit] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setLit(WORDS.length);
      return;
    }
    let raf = 0;
    const measure = () => {
      raf = 0;
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight || 800;
      // Progress 0→1 as the block travels from 88% viewport height up to 38%.
      const p = Math.max(0, Math.min(1, (vh * 0.88 - r.top) / (vh * 0.5)));
      setLit(Math.round(p * WORDS.length));
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(measure); };
    measure();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      cancelAnimationFrame(raf);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section className="relative z-10 max-w-[1400px] mx-auto px-6 md:px-8 py-20 md:py-28 border-t border-white/[0.12]">
      <div className="text-[10px] mono text-[#53fc18] mb-8 tracking-[0.2em] uppercase flex items-center justify-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-[#53fc18]" /> The thesis
      </div>
      <p ref={ref} className="serif text-4xl sm:text-5xl md:text-6xl lg:text-7xl leading-[1.12] tracking-tight max-w-5xl mx-auto text-center">
        {WORDS.map(([w, accent], i) => (
          <span key={i} className={`mf-word ${i < lit ? 'lit' : ''} ${accent ? 'mf-accent' : ''}`}>
            {w}{' '}
          </span>
        ))}
      </p>
    </section>
  );
}

/* ─────────────────────────────────────────────────── BENTO · DELIVERABLES
   The Apple/Vercel-style bento grid: six tiles, each a literal piece of what
   lands in a client's queue, each with its own live micro-visual. Tiles reuse
   the real ClipFrame and real DEMO clip data — nothing invented. All tiles
   tilt + spotlight via the shared engines. */
function BentoDeliverables({ bookCall }) {
  const clip = DEMO_CLIPS[0];
  const hooks = Array.isArray(clip.hooks) && clip.hooks.length >= 3
    ? clip.hooks.slice(0, 3)
    : ['The moment everything changed', 'Nobody expected this answer', 'Watch the room go quiet'];
  const tile = 'tilt-card card-lift relative rounded-2xl border border-[#53fc18]/[0.10] bg-gradient-to-b from-[#53fc18]/[0.02] to-transparent overflow-hidden p-6';
  return (
    <section className="relative z-10 max-w-[1400px] mx-auto px-6 md:px-8 py-12 border-t border-white/[0.12]">
      <Reveal>
        <div className="mb-10">
          <div className="text-[10px] mono text-[#53fc18] mb-4 tracking-[0.2em] uppercase flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#53fc18]" /> The deliverable
          </div>
          <h2 className="serif text-4xl md:text-5xl leading-[1.05] mb-4">
            What lands in <span className="italic gradient-green">your queue.</span>
          </h2>
          <p className="text-stone-400 leading-relaxed max-w-xl">
            Finished, scored, human-checked verticals with hooks and captions written, on a weekly rhythm you never have to think about.
          </p>
        </div>
      </Reveal>

      <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
        {/* 1 · The clip itself — the real ClipFrame the studio ships */}
        <Reveal className="md:col-span-3 bento-tall">
          <div className={`${tile} h-full flex flex-col`}>
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm font-medium">Publish-ready verticals</div>
              <span className="text-[10px] mono text-stone-500 tracking-wider uppercase">9:16 · sample</span>
            </div>
            <div className="flex-1 flex items-center justify-center py-2">
              <div className="bento-frame rounded-xl border border-stone-800 overflow-hidden shadow-[0_0_50px_-18px_rgba(83,252,24,0.35)]">
                <ClipFrame clip={clip} rank={1} />
              </div>
            </div>
            <div className="text-xs text-stone-500 leading-relaxed mt-4">
              Reframed around the speaker, captioned, and formatted per platform. It's the same frame the studio renders.
            </div>
          </div>
        </Reveal>

        {/* 2 · Hooks */}
        <Reveal className="md:col-span-3" delay={60}>
          <div className={tile}>
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm font-medium">Hooks written for the scroll</div>
              <Zap className="w-4 h-4 text-[#53fc18]" />
            </div>
            <div className="relative h-16">
              {hooks.map((h, i) => (
                <div
                  key={i}
                  className="hook-line absolute inset-x-0 top-0 serif text-xl md:text-2xl leading-snug text-stone-200"
                  style={{ animationDelay: `${i * 2.8}s` }}
                >
                  “{h}”
                </div>
              ))}
            </div>
            <div className="text-xs text-stone-500 mt-2">Three first-line variants per clip, ready to A/B.</div>
          </div>
        </Reveal>

        {/* 3 · Human sign-off */}
        <Reveal className="md:col-span-3" delay={120}>
          <div className={tile}>
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm font-medium">A human signs off on every cut</div>
              <span className="stamp-pulse inline-flex items-center justify-center w-7 h-7 rounded-full border border-[#53fc18]/40 bg-[#53fc18]/[0.08]">
                <Check className="w-3.5 h-3.5 text-[#53fc18]" />
              </span>
            </div>
            <p className="text-xs text-stone-500 leading-relaxed">
              AI proposes, an editor approves. Nothing ships on model confidence alone, and every clip you receive carries an editor's name.
            </p>
            <div className="mt-4 inline-flex items-center gap-2 px-2.5 py-1 rounded-md border border-[#53fc18]/25 bg-[#53fc18]/[0.06] text-[10px] mono text-[#aaff66] tracking-wider uppercase">
              <CheckCircle2 className="w-3 h-3" /> Editor reviewed
            </div>
          </div>
        </Reveal>

        {/* 4 · Score */}
        <Reveal className="md:col-span-2" delay={180}>
          <div className={tile}>
            <div className="text-sm font-medium mb-3">Scored 0–100</div>
            <div className="flex items-end gap-3">
              <div className="serif text-5xl text-[#53fc18] leading-none" style={{ textShadow: '0 0 24px rgba(83,252,24,0.4)' }}>{clip.virality}</div>
              <div className="text-[10px] mono text-stone-500 tracking-wider uppercase pb-1">This clip's<br />virality score</div>
            </div>
            <div className="mt-4 h-1 rounded-full bg-white/[0.06] overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${clip.virality}%`, background: '#53fc18', boxShadow: '0 0 10px rgba(83,252,24,0.7)' }} />
            </div>
          </div>
        </Reveal>

        {/* 5 · Cadence */}
        <Reveal className="md:col-span-2" delay={240}>
          <div className={tile}>
            <div className="text-sm font-medium mb-4">A weekly rhythm</div>
            <div className="grid gap-1.5 mb-3" style={{ gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }} aria-hidden="true">
              {Array.from({ length: 28 }).map((_, i) => {
                const on = i % 7 === 1 || i % 7 === 4; // Tue + Fri drops
                const today = i === 25;
                return (
                  <span
                    key={i}
                    className={`h-2 rounded-sm ${today ? 'cal-today' : ''}`}
                    style={{
                      background: on ? 'rgba(83,252,24,0.8)' : 'rgba(255,255,255,0.07)',
                      boxShadow: on ? '0 0 6px rgba(83,252,24,0.5)' : 'none',
                    }}
                  />
                );
              })}
            </div>
            <div className="text-xs text-stone-500">Drops land on schedule every week, even when you skip a recording.</div>
          </div>
        </Reveal>

        {/* 6 · Platforms */}
        <Reveal className="md:col-span-2" delay={300}>
          <div className={tile}>
            <div className="text-sm font-medium mb-4">Five platforms, one recording</div>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {['TikTok', 'Reels', 'Shorts', 'X', 'LinkedIn'].map((p) => (
                <span key={p} className="px-2 py-1 rounded-md border border-[#53fc18]/25 bg-[#53fc18]/[0.06] text-[10px] mono text-[#aaff66]">{p}</span>
              ))}
            </div>
            <button onClick={bookCall} className="text-xs text-[#53fc18] inline-flex items-center gap-1.5 hover:gap-2.5 transition-all">
              Set up your feed <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ──────────────────────────────────────────────────────────── PRE-LAUNCH COMPONENTS */
function Waitlist({ accent = '#53fc18' }) {
  const [email, setEmail] = useState('');
  const [kind, setKind] = useState(''); // optional lead qualifier — what they make
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // F3: submissions go to the operations backend (POST /api/leads) instead of
  // the artifact sandbox's persistent-storage API, which doesn't exist on the real
  // site. The endpoint is idempotent per email, so resubmits succeed quietly
  // rather than erroring.
  const submit = async () => {
    const trimmed = email.trim().toLowerCase();
    setError('');
    if (!trimmed || !trimmed.includes('@') || !trimmed.includes('.')) {
      setError('Please enter a valid email address.');
      return;
    }
    setLoading(true);
    try {
      const lead = await postLead({
        email: trimmed,
        contentKind: kind || undefined,
        source: 'waitlist',
        meta: {
          page: typeof window !== 'undefined' ? window.location.pathname : undefined,
          referrer: typeof document !== 'undefined' ? document.referrer || undefined : undefined,
        },
      });
      track('book_call_requested', { duplicate: !!lead.duplicate, contentKind: kind || undefined });
      setSubmitted(true);
    } catch (e) {
      setError("Something went wrong. Please try again.");
    }
    setLoading(false);
  };

  return (
    <section className="relative z-10 max-w-[1400px] mx-auto px-8 py-16 border-t border-white/[0.12]">
      <Reveal>
        <div className="relative max-w-3xl mx-auto text-center">
          <div className="absolute -inset-20 bg-[#53fc18]/[0.10] blur-3xl rounded-full pointer-events-none" />
          <div className="relative">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#53fc18]/[0.12] bg-[#53fc18]/[0.015] backdrop-blur text-[11px] mono text-stone-300 mb-8 tracking-wider uppercase">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inset-0 rounded-full bg-[#53fc18] animate-ping opacity-60" />
                <span className="relative rounded-full h-1.5 w-1.5 bg-[#53fc18]" />
              </span>
              Now onboarding founding partners · in small batches
            </div>

            <h2 className="serif text-5xl md:text-6xl leading-[1.05] mb-6 text-center">
              Book a <span className="italic gradient-green">demo.</span>
            </h2>
            <p className="text-stone-400 leading-relaxed text-lg mb-10 max-w-xl mx-auto text-center">
              We take on new content partners in small batches so every account gets real attention. Tell us about your show and we'll scope a content engine built around it: turnaround, output, and what we'd publish.
            </p>

            <div className="max-w-2xl mx-auto mb-10">
              <div className="text-[10px] mono text-stone-500 tracking-[0.2em] uppercase mb-4 text-center">What founding partners get</div>
              <div className="grid sm:grid-cols-3 gap-px bg-white/[0.06] rounded-2xl overflow-hidden border border-[#53fc18]/[0.08] text-left">
                {[
                  { t: 'A direct line to the founders', d: 'You work with the people building Clipper, not a ticket queue.' },
                  { t: 'Your input shapes the service', d: 'Early partners set what we prioritize and how the workflow runs.' },
                  { t: 'Full attention on your content', d: 'Small batches mean real focus on every clip, never a backlog.' },
                ].map((b) => (
                  <div key={b.t} className="bg-black p-5">
                    <div className="text-sm text-stone-200 font-medium mb-1.5">{b.t}</div>
                    <div className="text-xs text-stone-500 leading-relaxed">{b.d}</div>
                  </div>
                ))}
              </div>
            </div>

            {!submitted ? (
              <>
                {/* Optional one-tap qualifier — warms the strategy call without
                    adding a form field to type into. */}
                <div className="flex flex-wrap items-center justify-center gap-2 max-w-xl mx-auto mb-4">
                  <span className="text-[10px] mono text-stone-500 tracking-[0.18em] uppercase mr-1">You make</span>
                  {['Podcast', 'Interviews', 'Livestreams', 'Webinars', 'Other'].map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setKind(kind === k ? '' : k)}
                      aria-pressed={kind === k}
                      className={`px-3 py-1.5 rounded-full border text-xs transition-colors ${
                        kind === k
                          ? 'border-[#53fc18]/60 bg-[#53fc18]/[0.1] text-[#aaff66]'
                          : 'border-white/[0.12] text-stone-400 hover:border-[#53fc18]/30 hover:text-stone-200'
                      }`}
                    >
                      {k}
                    </button>
                  ))}
                </div>
                <div className="flex flex-col sm:flex-row gap-2 max-w-xl mx-auto mb-3 justify-center">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setError(''); }}
                    onKeyDown={(e) => e.key === 'Enter' && !loading && submit()}
                    placeholder="you@company.com"
                    aria-label="Work email"
                    aria-invalid={!!error}
                    autoComplete="email"
                    disabled={loading}
                    className="flex-1 min-w-0 px-5 py-4 rounded-md border border-[#53fc18]/30 focus:border-[#53fc18]/60 focus:outline-none text-base placeholder:text-stone-500 disabled:opacity-50"
                    style={{ backgroundColor: 'rgba(20, 20, 18, 0.8)', color: '#e7e5e4' }}
                  />
                  <button
                    onClick={submit}
                    disabled={loading}
                    className="btn-neon group px-6 py-4 rounded-md font-medium flex items-center justify-center gap-2 whitespace-nowrap disabled:opacity-50"
                  >
                    {loading ? 'Sending…' : 'Request my call'}
                    {!loading && <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />}
                  </button>
                </div>
                {error && (
                  <div role="alert" className="text-xs mono text-red-400 text-center mb-3 tracking-wider">{error}</div>
                )}
                {!error && <div className="mb-3" />}
              </>
            ) : (
              <div role="status" className="max-w-lg mx-auto mb-6 p-5 rounded-md border border-[#53fc18]/30 bg-[#53fc18]/[0.08] flex items-center gap-3" style={{ animation: 'blur-in 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}>
                <CheckCircle2 className="w-5 h-5 text-[#53fc18] flex-shrink-0" />
                <div className="text-left flex-1">
                  <div className="font-medium text-sm">Request received.</div>
                  <div className="text-xs text-stone-400 mt-0.5">We'll be in touch within 48 hours to book your demo.</div>
                </div>
              </div>
            )}

            <div className="flex items-center justify-center gap-3 text-xs mono text-stone-500 tracking-wider">
              <span>We reply within 48 hours</span>
              <span className="text-stone-700">·</span>
              <span>No spam, ever</span>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

/* ──────────────────────────────────────────────────────────── WHY CLIPPER
   Honest, qualitative 3-way comparison (DIY tool / hire it out / Clipper).
   No invented prices or competitor stats. The Clipper column and the
   risk-reversal footer reuse only claims already made elsewhere on the site:
   AI scoring + human sign-off, steady weekly cadence, pay per clip we ship,
   "we never train on your content", start with a single recording. */
function WhyClipper({ bookCall }) {
  const cols = [
    {
      k: 'diy', label: 'Do it yourself', sub: 'A clipping tool', neon: false, Icon: Scissors,
      rows: [
        { l: 'Who does the work', v: 'You. Learn the tool, scrub the timeline, cut and caption every clip yourself.' },
        { l: 'Finding the moments', v: 'You hunt for them by hand, recording after recording.' },
        { l: 'Quality control', v: 'Whatever you have time to check before you post.' },
        { l: 'Staying consistent', v: 'Slips the first week you get busy.' },
        { l: 'What it costs', v: 'Your hours, plus the subscription.' },
      ],
    },
    {
      k: 'hire', label: 'Hire it out', sub: 'An editor or agency', neon: false, Icon: Briefcase,
      rows: [
        { l: 'Who does the work', v: 'You recruit, brief, and manage an editor or agency.' },
        { l: 'Finding the moments', v: 'Down to their instincts and how well you direct them.' },
        { l: 'Quality control', v: 'Varies with whoever you hired that month.' },
        { l: 'Staying consistent', v: 'Tied to one person\u2019s schedule and turnaround.' },
        { l: 'What it costs', v: 'A salary or monthly retainer, good output or not.' },
      ],
    },
    {
      k: 'clipper', label: 'Clipper', sub: 'Done for you', neon: true, Icon: Sparkles,
      rows: [
        { l: 'Who does the work', v: 'We do. You record the long-form, we handle everything after.' },
        { l: 'Finding the moments', v: 'AI scores every moment for retention, then a human picks the cut.' },
        { l: 'Quality control', v: 'A human signs off on every clip before it ships. Nothing on autopilot.' },
        { l: 'Staying consistent', v: 'Publish-ready short-form in your queue on a steady weekly cadence.' },
        { l: 'What it costs', v: 'You pay per clip we ship. Approve what you want, skip the rest.' },
      ],
    },
  ];
  // The verdict row pays off the headline: where does the work land?
  const verdicts = ['On you.', 'Still on you.', 'On us.'];
  // Pivot for the desktop matrix: one row per criterion, values aligned across
  // the three options so the reader compares left-to-right instead of
  // re-reading three separate cards.
  const matrix = cols[0].rows.map((r, ri) => ({ l: r.l, vals: cols.map((c) => c.rows[ri].v) }));
  const reassure = [
    { t: 'Pay per clip we ship', d: 'You are billed for clips that actually go out, never for hours or seats.' },
    { t: 'A human signs off on every clip', d: 'Nothing reaches your queue on autopilot.' },
    { t: 'Your content stays yours', d: 'We never train on it. Our systems improve from anonymized aggregate signal, never your videos.' },
    { t: 'Start with one recording', d: 'Send a single link to see what comes back before you scale up.' },
  ];
  return (
    <section className="relative z-10 max-w-[1400px] mx-auto px-6 md:px-8 py-12 border-t border-white/[0.12]">
      <Reveal>
        <div className="max-w-2xl mb-10">
          <div className="text-[10px] mono text-[#53fc18] tracking-[0.2em] uppercase mb-4 flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[#53fc18]" /> The honest comparison</div>
          <h2 className="serif text-3xl md:text-4xl tracking-tight leading-[1.1] mb-4">
            Three ways to turn long-form into clips.<br />
            Only one <span className="italic gradient-green">doesn&rsquo;t land on you.</span>
          </h2>
          <p className="text-stone-400 leading-relaxed text-lg">
            You can run the tools yourself, hire someone to run them, or hand the whole thing over. Here is the honest version of each.
          </p>
        </div>
      </Reveal>

      {/* Desktop: one aligned matrix. A shared label column keeps every
          criterion on a single line of sight across the three options, and the
          Clipper column carries a continuous neon band. Mobile keeps the
          stacked cards below. */}
      <Reveal className="hidden md:block">
        <div className="tilt-card card-lift relative rounded-2xl border border-white/[0.08] bg-white/[0.01] overflow-hidden">
          {/* Header row */}
          <div className="cmp-row">
            <div className="px-6 py-5" />
            {cols.map((c) => {
              const Icon = c.Icon;
              return (
                <div key={c.k} className={`flex items-center gap-3 px-6 py-5 border-l border-white/[0.06] ${c.neon ? 'bg-[#53fc18]/[0.05]' : ''}`}>
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${c.neon ? 'bg-[#53fc18]/15 text-[#53fc18]' : 'bg-white/[0.04] text-stone-400'}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className={`text-base font-medium leading-tight ${c.neon ? 'text-[#53fc18]' : 'text-stone-200'}`}>{c.label}</div>
                    <div className="text-[10px] mono text-stone-500 tracking-[0.18em] uppercase mt-0.5">{c.sub}</div>
                  </div>
                  {c.neon && <span className="ml-auto text-[#53fc18] text-xl leading-none flex-shrink-0">&#10003;</span>}
                </div>
              );
            })}
          </div>
          {/* Criterion rows */}
          {matrix.map((r) => (
            <div key={r.l} className="cmp-row border-t border-white/[0.06] transition-colors hover:bg-white/[0.015]">
              <div className="px-6 py-4 text-[10px] mono text-stone-600 tracking-[0.16em] uppercase leading-snug flex items-center">{r.l}</div>
              {r.vals.map((v, i) => (
                <div key={i} className={`px-6 py-4 text-sm leading-relaxed border-l border-white/[0.06] ${cols[i].neon ? 'bg-[#53fc18]/[0.05] text-stone-200' : 'text-stone-400'}`}>{v}</div>
              ))}
            </div>
          ))}
          {/* Verdict row — pays off the headline */}
          <div className="cmp-row border-t border-white/[0.1]">
            <div className="px-6 py-4 text-[10px] mono text-stone-500 tracking-[0.16em] uppercase flex items-center">Where it lands</div>
            {verdicts.map((v, i) => (
              <div key={i} className={`px-6 py-4 border-l border-white/[0.06] ${cols[i].neon ? 'bg-[#53fc18]/[0.08]' : ''}`}>
                <span className={`serif text-lg ${cols[i].neon ? 'text-[#53fc18]' : 'text-stone-500'}`} style={cols[i].neon ? { textShadow: '0 0 18px rgba(83,252,24,0.45)' } : undefined}>{v}</span>
              </div>
            ))}
          </div>
          {/* Continuous glow over the Clipper column */}
          <span aria-hidden className="absolute inset-y-0 pointer-events-none" style={{ left: 'calc(170px + (100% - 170px) * 2 / 3)', width: 'calc((100% - 170px) / 3)', boxShadow: 'inset 0 0 0 1px rgba(83,252,24,0.35), 0 0 44px -10px rgba(83,252,24,0.35)' }} />
        </div>
      </Reveal>

      {/* Mobile: stacked cards (one option at a time reads better narrow) */}
      <div className="grid grid-cols-1 gap-4 md:hidden">
        {cols.map((c, i) => {
          const Icon = c.Icon;
          return (
          <Reveal key={c.k} delay={i * 80} className="h-full">
            <div
              className={`group relative h-full rounded-2xl border flex flex-col overflow-hidden card-lift tilt-card ${c.neon ? 'border-[#53fc18]/45 bg-[#53fc18]/[0.04]' : 'border-white/[0.08] bg-white/[0.01] hover:border-white/[0.18]'}`}
              style={c.neon ? { boxShadow: '0 0 44px -14px rgba(83,252,24,0.4)' } : undefined}
            >
              {c.neon && <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#53fc18] to-transparent" />}
              <div className="flex items-center gap-3 px-6 pt-6 pb-5 border-b border-white/[0.07]">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${c.neon ? 'bg-[#53fc18]/15 text-[#53fc18]' : 'bg-white/[0.04] text-stone-400'}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className={`text-base font-medium leading-tight ${c.neon ? 'text-[#53fc18]' : 'text-stone-200'}`}>{c.label}</div>
                  <div className="text-[10px] mono text-stone-500 tracking-[0.18em] uppercase mt-0.5">{c.sub}</div>
                </div>
                {c.neon && (
                  <span className="ml-auto text-[#53fc18] text-xl leading-none flex-shrink-0">&#10003;</span>
                )}
              </div>
              <div className="flex-1 px-6 divide-y divide-white/[0.06]">
                {c.rows.map((r) => (
                  <div key={r.l} className="py-4">
                    <div className="text-[10px] mono text-stone-600 tracking-[0.16em] uppercase mb-1.5 leading-snug">{r.l}</div>
                    <div className={`text-sm leading-relaxed ${c.neon ? 'text-stone-200' : 'text-stone-400'}`}>{r.v}</div>
                  </div>
                ))}
                <div className="py-4">
                  <div className="text-[10px] mono text-stone-600 tracking-[0.16em] uppercase mb-1.5 leading-snug">Where it lands</div>
                  <div className={`serif text-lg ${c.neon ? 'text-[#53fc18]' : 'text-stone-500'}`}>{verdicts[i]}</div>
                </div>
              </div>
            </div>
          </Reveal>
          );
        })}
      </div>

      <Reveal delay={260}>
        <div className="mt-10 flex flex-col items-center gap-4 text-center">
          <p className="serif text-xl md:text-2xl text-stone-200 tracking-tight">Ready to hand the whole thing over?</p>
          <button onClick={bookCall} className="btn-neon group px-7 py-4 rounded-md font-medium inline-flex items-center gap-2 whitespace-nowrap">
            Book a demo
            <ArrowUpRight className="w-4 h-4" />
          </button>
        </div>
      </Reveal>

      <Reveal delay={340}>
        <div className="mt-9 rounded-2xl border border-[#53fc18]/25 bg-gradient-to-r from-[#53fc18]/[0.05] to-transparent p-6 md:p-7 grid sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-6">
          {reassure.map((r) => (
            <div key={r.t} className="flex gap-3">
              <span className="w-5 h-5 rounded-full bg-[#53fc18]/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Check className="w-3 h-3 text-[#53fc18]" />
              </span>
              <div>
                <div className="text-sm text-stone-200 font-medium mb-1">{r.t}</div>
                <div className="text-xs text-stone-500 leading-relaxed">{r.d}</div>
              </div>
            </div>
          ))}
        </div>
      </Reveal>
    </section>
  );
}

function TrustStrip() {
  const badges = [
    { icon: Shield, label: 'SOC 2 Type II', sub: 'In progress' },
    { icon: Shield, label: 'GDPR ready', sub: 'EU compliant' },
    { icon: Database, label: 'Your data, your IP', sub: 'Never trained on' },
    { icon: Globe, label: 'US-hosted', sub: 'SFO · primary region' },
  ];
  return (
    <section className="relative z-10 max-w-[1400px] mx-auto px-8 py-12 border-t border-white/[0.12]">
      <Reveal>
        <div className="text-center mb-10">
          <div className="text-[10px] mono text-stone-500 tracking-[0.2em] uppercase">Built for teams that care about how their content is handled</div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-white/[0.06] rounded-2xl overflow-hidden border border-[#53fc18]/[0.08]">
          {badges.map((b, i) => (
            <Reveal key={b.label} delay={i * 60}>
              <div className="bg-black p-7 flex items-start gap-4 h-full">
                <div className="w-9 h-9 rounded-md border border-[#53fc18]/[0.12] flex items-center justify-center flex-shrink-0">
                  <b.icon className="w-4 h-4 text-[#53fc18]" />
                </div>
                <div>
                  <div className="text-sm font-medium mb-1">{b.label}</div>
                  <div className="text-xs mono text-stone-500 tracking-wider uppercase">{b.sub}</div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </Reveal>
    </section>
  );
}

export { BentoDeliverables, CM_EDIT_MIN_PER_CLIP, ClipPreviewPlayer, ContentMath, GlobalMap, IntegrationGlyph, IntegrationsStrip, InteractiveDemo, Manifesto, PL_GLYPHS, PipelineExplorer, ProductDemoReel, SLICE_CLIPS, SLICE_DURATION_MS, SignaturePath, SliceClipCard, StudioMockup, TrustStrip, ViralityChart, Waitlist, WhyClipper, useTween };

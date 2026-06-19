import React, { useState, useRef, useEffect } from 'react';
import { ArrowUpRight, Briefcase, Check, CheckCircle2, Clock, Database, Globe, Heart, MessageCircle, Play, Scissors, Share2, Shield, Sparkles, Zap } from 'lucide-react';
import { GlowOrb, Reveal, useReveal } from '../ui.jsx';
import { track } from '../../lib/analytics.jsx';
import { postLead } from '../../lib/api.js';
import { DEMO_CLIPS, SAMPLE_RECORDINGS } from '../../lib/demo.jsx';
import { prefersReducedMotion, useLoopProgress } from '../../lib/motion.jsx';
import { ClipFrame } from '../../studio/views.jsx';

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
    <div ref={ref} className="vchart relative rounded-xl border border-[var(--color-brand)]/20 bg-gradient-to-b from-[var(--color-brand)]/[0.04] to-transparent p-5 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between text-[10px] mono text-stone-500 tracking-wider uppercase mb-2">
        <span className="flex items-center gap-1.5">
          <span className="w-1 h-1 rounded-full bg-[var(--color-brand)] animate-pulse-soft" />
          Virality distribution · 24h
        </span>
        <span className="text-[var(--color-brand)]">peak 96</span>
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
            <stop offset="0" stopColor="var(--color-brand)" stopOpacity="0.16" />
            <stop offset="1" stopColor="var(--color-brand)" stopOpacity="0.55" />
          </linearGradient>
          <linearGradient id="vcBarPeak" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor="var(--color-brand)" stopOpacity="0.55" />
            <stop offset="1" stopColor="#b8ff7d" stopOpacity="1" />
          </linearGradient>
          <linearGradient id="vcScan" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="var(--color-brand)" stopOpacity="0" />
            <stop offset="1" stopColor="var(--color-brand)" stopOpacity="0.10" />
          </linearGradient>
        </defs>

        {/* faint gridlines with axis labels */}
        <g className="vc-meta">
          {[25, 50, 75].map((g) => (
            <g key={g}>
              <path d={`M${L} ${yFor(g)} H${R}`} stroke="var(--color-brand)" strokeOpacity="0.10" strokeWidth="1" strokeDasharray="3 5" />
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
          stroke="var(--color-brand)" strokeOpacity="0.5" strokeWidth="1" />
        <g className="vc-meta">
          <text x={R} y={thresholdY - 7} textAnchor="end" fill="var(--color-brand)" fillOpacity="0.8" fontSize="10" letterSpacing="1.6" style={mono}>
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

export { ViralityChart };

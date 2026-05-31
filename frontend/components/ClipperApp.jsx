'use client';

import '@/lib/storageShim';
import React, { useState, useRef, useEffect } from 'react';
import { runDemoPipeline, fetchShowcase } from '@/lib/clipper';
import FeedbackWidget from '@/components/FeedbackWidget';
import { Upload, Sparkles, TrendingUp, Scissors, Play, Download, Share2, Eye, Clock, Zap, ChevronRight, BarChart3, Film, CheckCircle2, Loader2, ArrowUpRight, Flame, Users, Activity, Radio, Search, ExternalLink, Twitch, Youtube, Music2, Heart, MessageCircle, Repeat2, Check, X, Mic, Code, Bot, Globe, Shield, Workflow, Database, Layers, GitBranch, BookOpen, FileText, Terminal, Quote, Building2, Briefcase, Mail, MapPin } from 'lucide-react';

// Logo matching the provided Clipper.ai mark — black scissors on neon green rounded square.
// Geometry: two finger-hole circles on the left, blades crossing through a pivot to form an X,
// with tips extending to the upper-right and lower-right.
function LogoMark({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-label="Clipper.ai">
      <rect width="100" height="100" rx="22" fill="#53fc18" />
      {/* Top-left hole crosses to lower-right tip */}
      <line x1="32" y1="32" x2="85" y2="78" stroke="#000" strokeWidth="9" strokeLinecap="round" />
      {/* Bottom-left hole crosses to upper-right tip */}
      <line x1="32" y1="68" x2="85" y2="22" stroke="#000" strokeWidth="9" strokeLinecap="round" />
      {/* Finger holes layered on top */}
      <circle cx="28" cy="32" r="11" fill="#53fc18" stroke="#000" strokeWidth="8" />
      <circle cx="28" cy="68" r="11" fill="#53fc18" stroke="#000" strokeWidth="8" />
    </svg>
  );
}

/* ──────────────────────────────────────────────────────────── HERO VISUAL */
// Animated SVG: long video bar on the left, six processing nodes in the middle,
// short clips materializing on the right. Pulses flow through the pipeline.
function HeroVisual() {
  return (
    <div className="relative w-full aspect-[16/9] max-w-4xl mx-auto">
      <div className="absolute inset-0 rounded-2xl border border-[#53fc18]/[0.12] bg-gradient-to-b from-white/[0.02] to-transparent backdrop-blur overflow-hidden">
        {/* Status bar at top */}
        <div className="absolute top-0 inset-x-0 border-b border-white/[0.06] px-5 py-2.5 flex items-center justify-between text-[10px] mono text-stone-500 tracking-wider uppercase">
          <div className="flex items-center gap-2">
            <span className="w-1 h-1 rounded-full bg-[#53fc18] animate-pulse-soft" />
            Pipeline · Processing
          </div>
          <div className="text-stone-600">job_a3f9 · 47s elapsed</div>
        </div>

        <svg viewBox="0 0 800 380" className="absolute inset-0 w-full h-full pt-10" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="sourceGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#1c1917" />
              <stop offset="100%" stopColor="#292524" />
            </linearGradient>
            <linearGradient id="flowGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#53fc18" stopOpacity="0" />
              <stop offset="50%" stopColor="#53fc18" stopOpacity="1" />
              <stop offset="100%" stopColor="#53fc18" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="clipGrad1" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#53fc18" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#3fd80f" stopOpacity="0.6" />
            </linearGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>

          {/* SOURCE: long video timeline */}
          <g transform="translate(30, 80)">
            <text x="0" y="-15" fill="#78716c" fontSize="9" fontFamily="JetBrains Mono" letterSpacing="1">SOURCE · 1h 04m</text>
            <rect x="0" y="0" width="160" height="50" rx="6" fill="url(#sourceGrad)" stroke="rgba(255,255,255,0.08)" />
            {/* Waveform inside */}
            {Array.from({ length: 28 }).map((_, i) => {
              const h = 4 + Math.abs(Math.sin(i * 0.7)) * 30 + Math.abs(Math.cos(i * 0.3)) * 12;
              return <rect key={i} x={6 + i * 5.4} y={25 - h / 2} width="2" height={h} fill="#57534e" rx="1" />;
            })}
            {/* Playhead */}
            <line x1="95" y1="-2" x2="95" y2="52" stroke="#53fc18" strokeWidth="1.5">
              <animate attributeName="x1" values="20;140;20" dur="6s" repeatCount="indefinite" />
              <animate attributeName="x2" values="20;140;20" dur="6s" repeatCount="indefinite" />
            </line>
          </g>

          {/* PIPELINE NODES — 3 visible stages */}
          {[
            { x: 240, y: 50, label: '01 · TRANSCRIBE' },
            { x: 240, y: 110, label: '02 · SEGMENT' },
            { x: 240, y: 170, label: '03 · SCORE' },
            { x: 380, y: 50, label: '04 · REFRAME' },
            { x: 380, y: 110, label: '05 · CAPTION' },
            { x: 380, y: 170, label: '06 · RANK' },
          ].map((node, i) => (
            <g key={node.label} transform={`translate(${node.x}, ${node.y})`}>
              <rect x="0" y="0" width="110" height="32" rx="6" fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.08)" />
              <circle cx="12" cy="16" r="3" fill="#53fc18">
                <animate attributeName="opacity" values="0.4;1;0.4" dur="2s" begin={`${i * 0.3}s`} repeatCount="indefinite" />
              </circle>
              <text x="22" y="20" fill="#a8a29e" fontSize="9" fontFamily="JetBrains Mono" letterSpacing="0.5">{node.label}</text>
            </g>
          ))}

          {/* CONNECTING FLOW LINES with animated pulses */}
          <path d="M 190 105 Q 220 105 240 75" fill="none" stroke="rgba(83,252,24,0.2)" strokeWidth="1" />
          <path d="M 190 105 Q 220 105 240 130" fill="none" stroke="rgba(83,252,24,0.2)" strokeWidth="1" />
          <path d="M 190 105 Q 220 105 240 185" fill="none" stroke="rgba(83,252,24,0.2)" strokeWidth="1" />
          <path d="M 350 65 Q 365 65 380 65" fill="none" stroke="rgba(83,252,24,0.2)" strokeWidth="1" />
          <path d="M 350 125 Q 365 125 380 125" fill="none" stroke="rgba(83,252,24,0.2)" strokeWidth="1" />
          <path d="M 350 185 Q 365 185 380 185" fill="none" stroke="rgba(83,252,24,0.2)" strokeWidth="1" />

          {/* Flowing pulses */}
          {[0, 0.6, 1.2, 1.8].map((delay, i) => (
            <circle key={i} r="2.5" fill="#53fc18" filter="url(#glow)">
              <animateMotion dur="4s" begin={`${delay}s`} repeatCount="indefinite">
                <mpath href={`#pulsePath${i % 3}`} />
              </animateMotion>
            </circle>
          ))}
          <path id="pulsePath0" d="M 190 105 Q 220 105 240 75 L 350 65 Q 365 65 380 65 L 490 65 Q 510 65 540 100" fill="none" />
          <path id="pulsePath1" d="M 190 105 Q 220 105 240 130 L 350 125 Q 365 125 380 125 L 490 125 Q 510 125 540 185" fill="none" />
          <path id="pulsePath2" d="M 190 105 Q 220 105 240 185 L 350 185 Q 365 185 380 185 L 490 185 Q 510 185 540 270" fill="none" />

          {/* Connect right edge of nodes to output */}
          <path d="M 490 65 Q 510 65 540 100" fill="none" stroke="rgba(83,252,24,0.2)" strokeWidth="1" />
          <path d="M 490 125 Q 510 125 540 185" fill="none" stroke="rgba(83,252,24,0.2)" strokeWidth="1" />
          <path d="M 490 185 Q 510 185 540 270" fill="none" stroke="rgba(83,252,24,0.2)" strokeWidth="1" />

          {/* OUTPUT: vertical clips */}
          <g transform="translate(560, 60)">
            <text x="0" y="-20" fill="#53fc18" fontSize="9" fontFamily="JetBrains Mono" letterSpacing="1">CLIPS · READY</text>
            {[
              { y: 0, score: '94', delay: '0s' },
              { y: 80, score: '87', delay: '0.4s' },
              { y: 160, score: '82', delay: '0.8s' },
              { y: 240, score: '78', delay: '1.2s' },
            ].map((clip, i) => (
              <g key={i} transform={`translate(${(i % 2) * 110}, ${Math.floor(i / 2) * 90})`}>
                <rect x="0" y="0" width="90" height="70" rx="6" fill="url(#clipGrad1)" opacity="0.9">
                  <animate attributeName="opacity" values="0;0.9" dur="0.6s" begin={clip.delay} fill="freeze" />
                </rect>
                <rect x="0" y="0" width="90" height="70" rx="6" fill="none" stroke="rgba(83,252,24,0.4)" />
                {/* Play icon */}
                <path d="M 38 28 L 38 42 L 52 35 Z" fill="#000" opacity="0.6" />
                {/* Score badge */}
                <rect x="60" y="6" width="24" height="14" rx="3" fill="#000" opacity="0.7" />
                <text x="72" y="16" fill="#53fc18" fontSize="9" fontFamily="JetBrains Mono" textAnchor="middle" fontWeight="600">{clip.score}</text>
              </g>
            ))}
          </g>

          {/* Side rail of metrics */}
          <g transform="translate(30, 170)">
            <text x="0" y="0" fill="#57534e" fontSize="8" fontFamily="JetBrains Mono" letterSpacing="1">LATENCY</text>
            <text x="0" y="14" fill="#a8a29e" fontSize="11" fontFamily="Inter" fontStyle="italic" fontWeight="500">67.8s</text>
            <text x="0" y="40" fill="#57534e" fontSize="8" fontFamily="JetBrains Mono" letterSpacing="1">CLIPS</text>
            <text x="0" y="54" fill="#a8a29e" fontSize="11" fontFamily="Inter" fontStyle="italic" fontWeight="500">12 ready</text>
            <text x="0" y="80" fill="#57534e" fontSize="8" fontFamily="JetBrains Mono" letterSpacing="1">P-VIRAL</text>
            <text x="0" y="94" fill="#53fc18" fontSize="11" fontFamily="Inter" fontStyle="italic" fontWeight="500">94 max</text>
          </g>
        </svg>

        {/* Bottom status */}
        <div className="absolute bottom-0 inset-x-0 border-t border-[#53fc18]/[0.10] px-5 py-2.5 flex items-center justify-between text-[10px] mono text-stone-500 tracking-wider uppercase">
          <span>Edge: SFO-01</span>
          <span className="text-[#53fc18]">12 of 12 clips rendered</span>
        </div>
      </div>
    </div>
  );
}

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
            <div className="border-t border-[#53fc18]/[0.10] pt-3 mt-4">
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
    { x: 220, y: 160, label: 'NYC', live: true },
    { x: 410, y: 120, label: 'LON', live: true },
    { x: 440, y: 130, label: 'FRA', live: true },
    { x: 690, y: 180, label: 'TYO', live: true },
    { x: 760, y: 290, label: 'SYD', live: false },
    { x: 580, y: 220, label: 'SIN', live: true },
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
          <span>Live edge · 6 regions</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-stone-500" />
          <span>Q3 expansion · 2 regions</span>
        </div>
      </div>
      <div className="absolute bottom-5 right-5 text-[10px] mono text-stone-500 tracking-wider uppercase">
        p50 latency · 47ms global
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────── AVATAR */
// Procedurally generated SVG avatars (no external assets)
function Avatar({ seed, size = 40, accent = '#53fc18' }) {
  // Generate deterministic colors from seed string
  const hash = [...seed].reduce((a, c) => a + c.charCodeAt(0), 0);
  const hue = hash % 360;
  const initials = seed.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase();
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" className="flex-shrink-0">
      <defs>
        <linearGradient id={`avg${hash}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={`hsl(${hue}, 30%, 35%)`} />
          <stop offset="100%" stopColor={`hsl(${(hue + 60) % 360}, 25%, 20%)`} />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="20" fill={`url(#avg${hash})`} />
      <text x="20" y="25" textAnchor="middle" fill="white" fontSize="13" fontFamily="Inter" fontWeight="500" opacity="0.9">{initials}</text>
    </svg>
  );
}

/* ──────────────────────────────────────────────────────────── NEON GRID
   Decorative animated grid with green glow lines — sits behind heroes */
function NeonGrid() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
      {/* Base grid — brighter and denser */}
      <div
        className="absolute inset-0 opacity-[0.25]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(83,252,24,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(83,252,24,0.5) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
          maskImage: 'radial-gradient(ellipse 100% 70% at 50% 40%, black 0%, transparent 75%)',
        }}
      />
      {/* Intersection dot accents */}
      <div
        className="absolute inset-0 opacity-[0.3]"
        style={{
          backgroundImage: 'radial-gradient(circle at center, #53fc18 1px, transparent 1.5px)',
          backgroundSize: '64px 64px',
          maskImage: 'radial-gradient(ellipse 80% 50% at 50% 40%, black 0%, transparent 70%)',
        }}
      />
      {/* Horizontal sweep line */}
      <div
        className="absolute inset-x-0 h-px"
        style={{
          top: '60%',
          background: 'linear-gradient(90deg, transparent, #53fc18 50%, transparent)',
          opacity: 0.4,
          filter: 'blur(0.5px)',
          boxShadow: '0 0 8px #53fc18',
          animation: 'sweep 6s ease-in-out infinite',
        }}
      />
      <style>{`
        @keyframes sweep {
          0%, 100% { transform: translateY(-200px); opacity: 0; }
          50% { transform: translateY(200px); opacity: 0.5; }
        }
      `}</style>
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
  `;
  document.head.appendChild(style);
}

function ProductDemoReel({ openApp }) {
  return (
    <section className="relative z-10 max-w-[1400px] mx-auto px-6 md:px-8 py-24 border-t border-[#53fc18]/[0.10]">
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
            <span className="w-1.5 h-1.5 rounded-full bg-[#53fc18]" style={{ animation: 'sliceSourcePulse 2.4s ease-in-out infinite' }} />
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

          <div className="relative px-8 md:px-16 py-14">
            {/* Metadata row */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3 text-[10px] mono text-stone-500 tracking-[0.2em] uppercase">
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
                  className="absolute top-0 bottom-0 pointer-events-none"
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
                className="absolute top-0 bottom-0 pointer-events-none"
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

            {/* SHORT CLIPS ROW — 6 vertical phone-aspect cards that fall in as the scan passes */}
            <div className="relative h-40 md:h-44">
              {SLICE_CLIPS.map((clip, i) => {
                const posPct = (i + 0.5) * (100 / 6); // evenly spaced across row
                return (
                  <div
                    key={i}
                    className="absolute top-0"
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
                    {/* The clip card — phone aspect */}
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
                  </div>
                );
              })}
            </div>

            {/* Footer row — pipeline metrics */}
            <div className="flex items-center justify-between pt-8 mt-2 border-t border-[#53fc18]/[0.08]">
              <div className="flex items-center gap-6 text-[10px] mono text-stone-500 tracking-[0.2em] uppercase">
                <span><span className="text-stone-600">PROCESS TIME</span> <span className="text-stone-200">2m 14s</span></span>
                <span className="text-stone-700">·</span>
                <span><span className="text-stone-600">AVG SCORE</span> <span className="text-stone-200">79.2</span></span>
                <span className="text-stone-700">·</span>
                <span><span className="text-stone-600">PLATFORMS</span> <span className="text-stone-200">TIKTOK · REELS · SHORTS</span></span>
              </div>
              <button onClick={openApp} className="group flex items-center gap-2 text-[10px] mono text-[#53fc18] tracking-[0.25em] uppercase hover:text-[#aaff66] transition-colors">
                <span>TRY IT</span>
                <ArrowUpRight className="w-3 h-3 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </button>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}


/* ──────────────────────────────────────────────────────────── LIVE TICKER
   Auto-scrolling green metric pills bar */
function LiveTicker() {
  const items = [
    { label: 'STATUS', value: 'PRE-LAUNCH', tone: 'live' },
    { label: 'WAITLIST', value: '2,847', tone: 'up' },
    { label: 'COHORT 03', value: 'JUNE 12' },
    { label: 'TARGET LATENCY', value: '<300ms' },
    { label: 'STACK', value: 'WHISPER + GPT-4 + FFMPEG' },
    { label: 'BETA TESTERS', value: '14' },
    { label: 'EARLY ACCESS', value: '200 SEATS' },
    { label: 'REGION', value: 'US-WEST-2' },
  ];
  return (
    <div className="relative overflow-hidden border-y border-[#53fc18]/15 bg-[#53fc18]/[0.02]">
      <div className="flex gap-10 whitespace-nowrap py-3" style={{ animation: 'marquee 35s linear infinite', width: 'max-content' }}>
        {[...Array(3)].map((_, dup) => (
          <div key={dup} className="flex gap-10 items-center">
            {items.map((it, i) => (
              <div key={i + dup} className="flex items-center gap-2 text-xs mono tracking-wider">
                {it.tone === 'live' ? (
                  <span className="w-1.5 h-1.5 rounded-full bg-[#53fc18] animate-pulse-soft" style={{ boxShadow: '0 0 8px #53fc18' }} />
                ) : it.tone === 'up' ? (
                  <span className="text-[#53fc18]">↑</span>
                ) : null}
                <span className="text-stone-500">{it.label}</span>
                <span className={it.tone === 'up' || it.tone === 'live' ? 'text-[#53fc18]' : 'text-stone-200'} style={it.tone ? { textShadow: '0 0 12px rgba(83,252,24,0.5)' } : {}}>
                  {it.value}
                </span>
                <span className="text-stone-700">·</span>
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-black to-transparent pointer-events-none" />
      <div className="absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-black to-transparent pointer-events-none" />
    </div>
  );
}

/* ──────────────────────────────────────────────────────────── VIRALITY CHART
   Animated bar chart — neon green bars with live data feel */
function ViralityChart() {
  // Procedurally generate bar heights
  const bars = Array.from({ length: 32 }, (_, i) => ({
    h: 20 + Math.abs(Math.sin(i * 0.5 + 1.2)) * 50 + Math.abs(Math.cos(i * 0.3)) * 30,
    peak: i === 9 || i === 18 || i === 27,
  }));
  return (
    <div className="relative h-48 rounded-xl border border-[#53fc18]/20 bg-gradient-to-b from-[#53fc18]/[0.04] to-transparent p-5 overflow-hidden">
      {/* Header */}
      <div className="absolute top-3 left-5 right-5 flex items-center justify-between text-[10px] mono text-stone-500 tracking-wider uppercase">
        <span className="flex items-center gap-1.5">
          <span className="w-1 h-1 rounded-full bg-[#53fc18] animate-pulse-soft" />
          Virality distribution · 24h
        </span>
        <span className="text-[#53fc18]">peak 94</span>
      </div>
      {/* Bars */}
      <div className="absolute bottom-3 left-5 right-5 flex items-end gap-1 h-32">
        {bars.map((b, i) => (
          <div
            key={i}
            className="flex-1 rounded-t-sm relative"
            style={{
              height: `${b.h}%`,
              background: b.peak
                ? 'linear-gradient(to top, rgba(83,252,24,0.6), rgba(83,252,24,1))'
                : 'linear-gradient(to top, rgba(83,252,24,0.2), rgba(83,252,24,0.5))',
              boxShadow: b.peak ? '0 0 12px rgba(83,252,24,0.6)' : 'none',
              animation: `barpulse 3s ease-in-out ${i * 0.05}s infinite`,
            }}
          />
        ))}
      </div>
      {/* Grid lines */}
      <div className="absolute left-5 right-5 bottom-3 h-32 pointer-events-none">
        {[25, 50, 75].map((y) => (
          <div key={y} className="absolute inset-x-0 border-t border-dashed border-[#53fc18]/10" style={{ bottom: `${y}%` }} />
        ))}
      </div>
      <style>{`
        @keyframes barpulse {
          0%, 100% { opacity: 0.85; transform: scaleY(1); }
          50% { opacity: 1; transform: scaleY(1.04); }
        }
      `}</style>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────── GLOW ORB
   Standalone radial green spotlight for backgrounds */
function GlowOrb({ size = 600, color = '#53fc18', opacity = 0.12, className = '' }) {
  return (
    <div
      className={`absolute pointer-events-none rounded-full ${className}`}
      style={{
        width: size,
        height: size,
        background: color,
        opacity,
        filter: `blur(${size / 5}px)`,
      }}
      aria-hidden
    />
  );
}

/* ──────────────────────────────────────────────────────────── HEADLINE BEAM
   A wide horizontal beam of green light behind text */
function HeadlineBeam() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
      <div
        className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 w-[140%] h-32"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(83,252,24,0.18) 0%, transparent 60%)',
          filter: 'blur(40px)',
        }}
      />
    </div>
  );
}

/* ──────────────────────────────────────────────────────────── ONBOARDING CHECKLIST
   Floating green-bordered card in Studio. Ticks off as the user progresses
   through the activation flow. Bottom-right, dismissible, persists.  */
function OnboardingChecklist({ stage, hasClips, hasSelectedClip }) {
  const [open, setOpen] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  const items = [
    { id: 'upload', label: 'Upload your first video', done: stage !== 'upload' },
    { id: 'pipeline', label: 'Run the clip pipeline', done: hasClips || stage === 'analyzing' || stage === 'results' },
    { id: 'preview', label: 'Preview a generated clip', done: hasSelectedClip },
    { id: 'export', label: 'Export to TikTok or Reels', done: false },
  ];

  const completed = items.filter((i) => i.done).length;
  const total = items.length;
  const pct = (completed / total) * 100;

  if (dismissed || completed === total) return null;

  return (
    <div className="fixed bottom-5 right-5 z-40 print:hidden">
      {open ? (
        <div
          className="w-80 rounded-2xl border border-[#53fc18]/30 bg-black/95 backdrop-blur overflow-hidden animate-blur-in"
          style={{ boxShadow: '0 0 60px -10px rgba(83,252,24,0.4)' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#53fc18]/[0.12] bg-[#53fc18]/[0.02]">
            <div className="flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-[#53fc18]" style={{ filter: 'drop-shadow(0 0 4px #53fc18)' }} />
              <div>
                <div className="text-[11px] mono text-stone-200 tracking-wider uppercase leading-tight">Getting started</div>
                <div className="text-[9px] mono text-stone-500 tracking-wider mt-0.5">{completed} of {total} complete</div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setOpen(false)} className="text-stone-500 hover:text-stone-200 px-1.5 text-sm">−</button>
              <button onClick={() => setDismissed(true)} className="text-stone-500 hover:text-stone-200">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Progress bar */}
          <div className="h-1 bg-stone-900">
            <div
              className="h-full transition-all"
              style={{
                width: `${pct}%`,
                background: 'linear-gradient(90deg, #53fc18, #aaff66)',
                boxShadow: '0 0 8px rgba(83,252,24,0.6)',
              }}
            />
          </div>

          {/* Checklist */}
          <div className="divide-y divide-[#53fc18]/[0.06]">
            {items.map((item) => (
              <div key={item.id} className="px-4 py-2.5 flex items-center gap-3">
                <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
                  {item.done ? (
                    <CheckCircle2 className="w-4 h-4 text-[#53fc18]" style={{ filter: 'drop-shadow(0 0 4px rgba(83,252,24,0.5))' }} />
                  ) : (
                    <div className="w-3.5 h-3.5 rounded-full border border-[#53fc18]/30" />
                  )}
                </div>
                <span className={`text-xs ${item.done ? 'text-stone-500 line-through' : 'text-stone-200'}`}>
                  {item.label}
                </span>
              </div>
            ))}
          </div>

          {/* Footer hint */}
          <div className="px-4 py-2.5 border-t border-[#53fc18]/[0.06] text-[10px] mono text-stone-500 tracking-wider uppercase">
            {completed === 0 && 'Drop a video to start →'}
            {completed === 1 && 'Pipeline running…'}
            {completed === 2 && 'Click a clip to preview →'}
            {completed === 3 && 'One more — export your clip'}
          </div>
        </div>
      ) : (
        // Collapsed pill
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-full border border-[#53fc18]/40 bg-black/80 backdrop-blur hover:border-[#53fc18] hover:bg-[#53fc18]/[0.06]"
          style={{ boxShadow: '0 0 30px -10px rgba(83,252,24,0.5)' }}
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inset-0 rounded-full bg-[#53fc18] animate-ping opacity-70" />
            <span className="relative rounded-full h-2 w-2 bg-[#53fc18]" style={{ boxShadow: '0 0 6px #53fc18' }} />
          </span>
          <span className="text-[11px] mono text-stone-200 tracking-wider uppercase">{completed}/{total} done</span>
        </button>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────── CUSTOM CURSOR
   A simple green arrow cursor for the Studio app. Tracks the mouse,
   no hover state, no trailing — just the arrow. */
function CrosshairCursor() {
  const arrowRef = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'ontouchstart' in window) return;

    let mouseX = -100, mouseY = -100;
    let raf;

    const tick = () => {
      if (arrowRef.current) {
        arrowRef.current.style.transform = `translate(${mouseX}px, ${mouseY}px)`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const onMove = (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      if (!visible) setVisible(true);
    };
    const onLeave = () => setVisible(false);

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseleave', onLeave);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseleave', onLeave);
    };
  }, [visible]);

  if (!visible) return null;

  return (
    <>
      <style>{`
        body, body * { cursor: none !important; }
        @media (hover: none) { body, body * { cursor: auto !important; } }
      `}</style>
      <svg
        ref={arrowRef}
        width="20"
        height="22"
        viewBox="0 0 20 22"
        className="fixed top-0 left-0 pointer-events-none z-[100]"
        style={{
          filter: 'drop-shadow(0 0 4px rgba(83,252,24,0.6)) drop-shadow(0 1px 2px rgba(0,0,0,0.8))',
        }}
        aria-hidden
      >
        <path
          d="M2 2 L2 17 L6.5 13 L9.5 20 L12 19 L9 12 L15 12 Z"
          fill="#53fc18"
          stroke="#000"
          strokeWidth="0.8"
          strokeLinejoin="round"
        />
      </svg>
    </>
  );
}

/* ──────────────────────────────────────────────────────────── SPARKLINE
   Inline line chart for small metric trends */
function Sparkline({ data, label, width = 220, height = 50 }) {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((v - min) / range) * (height - 4) - 2;
      return `${x},${y}`;
    })
    .join(' ');
  const lastX = width;
  const lastY = height - ((data[data.length - 1] - min) / range) * (height - 4) - 2;
  return (
    <div className="rounded-md border border-[#53fc18]/[0.12] bg-[#53fc18]/[0.02] p-3">
      <div className="text-[9px] mono text-stone-500 tracking-wider uppercase mb-2 flex items-center justify-between">
        <span>{label}</span>
        <span className="text-[#53fc18]">↑ trending</span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" preserveAspectRatio="none" className="block">
        <defs>
          <linearGradient id={`sparkFill-${label}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#53fc18" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#53fc18" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={`0,${height} ${points} ${width},${height}`} fill={`url(#sparkFill-${label})`} />
        <polyline points={points} fill="none" stroke="#53fc18" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" style={{ filter: 'drop-shadow(0 0 4px rgba(83,252,24,0.6))' }} />
        <circle cx={lastX} cy={lastY} r="3" fill="#53fc18" style={{ filter: 'drop-shadow(0 0 6px #53fc18)' }} />
      </svg>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────── CLIP PREVIEW PLAYER
   Vertical phone frame with synced auto-captions + waveform. Shows what
   the actual clip output looks like across platforms. */
function ClipPreviewPlayer() {
  const [playing, setPlaying] = useState(true);
  const [progress, setProgress] = useState(0);
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
      author: '@sarah.chen',
      handle: 'Lex Fridman · #428',
      score: 94,
      views: '847K',
      duration: '0:47',
    },
    {
      title: 'When she changed her mind mid-sentence',
      caption: [
        { t: 0, w: 'I' }, { t: 0.15, w: 'used' }, { t: 0.3, w: 'to' }, { t: 0.45, w: 'think' },
        { t: 0.7, w: 'remote' }, { t: 0.95, w: 'work' }, { t: 1.15, w: 'was' }, { t: 1.3, w: 'the' },
        { t: 1.45, w: 'future' }, { t: 1.75, w: 'but' }, { t: 1.9, w: 'actually—' },
        { t: 2.2, w: 'wait.' },
      ],
      author: '@theo.von',
      handle: 'This Past Weekend · #531',
      score: 88,
      views: '562K',
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
      author: '@hasan.minhaj',
      handle: 'Patriot Reflux · S2E07',
      score: 81,
      views: '312K',
      duration: '0:52',
    },
  ];

  const clip = clips[activeClipIdx];
  const totalCaptionDuration = 2.6;

  useEffect(() => {
    if (!playing) return;
    const interval = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          setActiveClipIdx((i) => (i + 1) % clips.length);
          return 0;
        }
        return p + 0.4;
      });
    }, 40);
    return () => clearInterval(interval);
  }, [playing, activeClipIdx]);

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
    <section className="relative z-10 max-w-[1400px] mx-auto px-6 md:px-8 py-16 border-t border-[#53fc18]/[0.10] overflow-hidden">
      <GlowOrb size={500} opacity={0.1} className="right-0 top-1/2 -translate-y-1/2" />
      <Reveal>
        <div className="grid md:grid-cols-[1.4fr_1fr] gap-12 items-center">
          {/* Left: copy */}
          <div>
            <div className="text-[10px] mono text-[#53fc18] mb-4 tracking-[0.2em] uppercase flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#53fc18]" style={{ boxShadow: '0 0 8px #53fc18' }} />
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
                  onClick={() => { setActiveClipIdx(i); setProgress(0); }}
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
                        className="flex-1 rounded-sm transition-all"
                        style={{
                          height: `${baseHeight}%`,
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
                <div className="absolute right-3 bottom-24 z-10 flex flex-col items-center gap-3">
                  <button className="flex flex-col items-center text-white/80 hover:text-[#53fc18]">
                    <Heart className="w-6 h-6" />
                    <span className="text-[9px] mono mt-0.5">{clip.views}</span>
                  </button>
                  <button className="flex flex-col items-center text-white/80">
                    <MessageCircle className="w-6 h-6" />
                    <span className="text-[9px] mono mt-0.5">3.2K</span>
                  </button>
                  <button className="flex flex-col items-center text-white/80">
                    <Share2 className="w-6 h-6" />
                    <span className="text-[9px] mono mt-0.5">847</span>
                  </button>
                </div>

                {/* Progress bar */}
                <div className="absolute bottom-3 inset-x-4 z-10">
                  <div className="h-0.5 rounded-full bg-white/20 overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${progress}%`,
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

/* ──────────────────────────────────────────────────────────── ROI CALCULATOR
   Live sliders → cost + time-saved calculation. Pricing page conversion tool. */
function ROICalculator() {
  const [hours, setHours] = useState(20);
  const [rate, setRate] = useState(75);
  const [editors, setEditors] = useState(2);

  // Time savings model: Clipper reduces clipping/editing time by ~78%
  // Hours/rate are PER EDITOR — multiply by editor count for team totals
  const reductionFactor = 0.78;
  const hoursSavedPerWeek = hours * reductionFactor * editors;
  const monthlyHoursSaved = hoursSavedPerWeek * 4.33;
  const monthlyCostSaved = monthlyHoursSaved * rate;

  // Tier recommendation logic — derived from editor count + monthly upload volume.
  // Editors hours/week × 4.33 ≈ monthly upload minutes / 60. Conservative 1:1 assumption.
  const teamMonthlyMinutes = hours * 60 * 4.33 * editors;
  let tier;
  if (teamMonthlyMinutes <= 1000 && editors <= 1) {
    tier = { name: 'Starter', price: 0, fits: 'free tier covers this', overflow: false, scale: false, enterprise: false };
  } else if (teamMonthlyMinutes <= 1000 * editors && editors <= 8) {
    tier = { name: 'Studio', price: 49, fits: 'Studio fits cleanly', overflow: false, scale: false, enterprise: false };
  } else if (teamMonthlyMinutes <= 10000 * editors && editors <= 25) {
    tier = { name: 'Scale', price: 249, fits: 'Scale is the right size', overflow: false, scale: true, enterprise: false };
  } else {
    tier = { name: 'Enterprise', price: null, fits: 'volume is past Scale tier', overflow: true, scale: false, enterprise: true };
  }

  const monthlyClipperCost = tier.price === null ? 0 : tier.price * editors;
  const netSavings = monthlyCostSaved - monthlyClipperCost;
  const roi = monthlyClipperCost > 0 ? ((netSavings / monthlyClipperCost) * 100).toFixed(0) : '—';
  const paybackDays = monthlyClipperCost > 0 ? monthlyClipperCost / (monthlyCostSaved / 30) : 0;

  // Helper for percentage calculation
  const pct = (v, min, max) => ((v - min) / (max - min)) * 100;

  return (
    <section className="relative z-10 max-w-[1400px] mx-auto px-6 md:px-8 py-16 border-t border-[#53fc18]/[0.10]">
      {/* Custom slider styles — applied globally to all ROI sliders */}
      <style>{`
        .roi-slider {
          -webkit-appearance: none;
          appearance: none;
          width: 100%;
          height: 6px;
          border-radius: 999px;
          outline: none;
          cursor: pointer;
          transition: background 0.15s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .roi-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #53fc18;
          border: 2px solid #000;
          box-shadow: 0 0 0 3px rgba(83,252,24,0.15), 0 0 16px rgba(83,252,24,0.5);
          cursor: grab;
          transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s ease;
        }
        .roi-slider::-webkit-slider-thumb:hover {
          transform: scale(1.15);
          box-shadow: 0 0 0 5px rgba(83,252,24,0.2), 0 0 24px rgba(83,252,24,0.7);
        }
        .roi-slider::-webkit-slider-thumb:active {
          cursor: grabbing;
          transform: scale(1.25);
        }
        .roi-slider::-moz-range-thumb {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #53fc18;
          border: 2px solid #000;
          box-shadow: 0 0 0 3px rgba(83,252,24,0.15), 0 0 16px rgba(83,252,24,0.5);
          cursor: grab;
          transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s ease;
        }
        .roi-slider::-moz-range-thumb:hover {
          transform: scale(1.15);
          box-shadow: 0 0 0 5px rgba(83,252,24,0.2), 0 0 24px rgba(83,252,24,0.7);
        }
        .roi-value {
          transition: color 0.2s ease, text-shadow 0.2s ease;
        }
      `}</style>
      <Reveal>
        <div className="text-center mb-10">
          <div className="text-[10px] mono text-[#53fc18] mb-4 tracking-[0.2em] uppercase flex items-center justify-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#53fc18]" style={{ boxShadow: '0 0 8px #53fc18' }} />
            ROI calculator
          </div>
          <h2 className="serif text-4xl md:text-5xl leading-[1.05] mb-3">
            Do the <span className="italic gradient-green">math.</span>
          </h2>
          <p className="text-stone-400 leading-relaxed max-w-xl mx-auto">
            How much time does your team spend clipping per week? Drag the sliders. Watch the savings.
          </p>
        </div>

        <div className="max-w-5xl mx-auto rounded-2xl border border-[#53fc18]/20 bg-gradient-to-b from-[#53fc18]/[0.03] to-transparent overflow-hidden shadow-[0_0_60px_-20px_rgba(83,252,24,0.3)]">
          <div className="grid md:grid-cols-[1fr_1fr] divide-x divide-[#53fc18]/[0.10]">
            {/* Inputs */}
            <div className="p-8 space-y-7">
              <div className="text-[10px] mono text-stone-500 tracking-wider uppercase mb-2">Your team</div>

              {/* Hours slider */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-[10px] mono text-stone-400 tracking-wider uppercase">Hours / week · per editor</label>
                  <div className="roi-value serif text-2xl text-[#53fc18] leading-none" style={{ textShadow: '0 0 12px rgba(83,252,24,0.4)' }}>
                    {hours}h
                  </div>
                </div>
                <input
                  type="range" min={1} max={80} step={1} value={hours}
                  onChange={(e) => setHours(Number(e.target.value))}
                  className="roi-slider"
                  style={{ background: `linear-gradient(to right, #53fc18 0%, #aaff66 ${pct(hours, 1, 80)}%, rgba(83,252,24,0.08) ${pct(hours, 1, 80)}%, rgba(83,252,24,0.08) 100%)` }}
                />
                <div className="flex justify-between text-[9px] mono text-stone-600 mt-2 tracking-wider">
                  <span>1h</span>
                  <span>80h</span>
                </div>
              </div>

              {/* Rate slider */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-[10px] mono text-stone-400 tracking-wider uppercase">Editor hourly rate</label>
                  <div className="roi-value serif text-2xl text-[#53fc18] leading-none" style={{ textShadow: '0 0 12px rgba(83,252,24,0.4)' }}>
                    ${rate}
                  </div>
                </div>
                <input
                  type="range" min={15} max={250} step={1} value={rate}
                  onChange={(e) => setRate(Number(e.target.value))}
                  className="roi-slider"
                  style={{ background: `linear-gradient(to right, #53fc18 0%, #aaff66 ${pct(rate, 15, 250)}%, rgba(83,252,24,0.08) ${pct(rate, 15, 250)}%, rgba(83,252,24,0.08) 100%)` }}
                />
                <div className="flex justify-between text-[9px] mono text-stone-600 mt-2 tracking-wider">
                  <span>$15</span>
                  <span>$250</span>
                </div>
              </div>

              {/* Editors slider */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-[10px] mono text-stone-400 tracking-wider uppercase">Number of editors</label>
                  <div className="roi-value serif text-2xl text-[#53fc18] leading-none" style={{ textShadow: '0 0 12px rgba(83,252,24,0.4)' }}>
                    {editors}
                  </div>
                </div>
                <input
                  type="range" min={1} max={20} step={1} value={editors}
                  onChange={(e) => setEditors(Number(e.target.value))}
                  className="roi-slider"
                  style={{ background: `linear-gradient(to right, #53fc18 0%, #aaff66 ${pct(editors, 1, 20)}%, rgba(83,252,24,0.08) ${pct(editors, 1, 20)}%, rgba(83,252,24,0.08) 100%)` }}
                />
                <div className="flex justify-between text-[9px] mono text-stone-600 mt-2 tracking-wider">
                  <span>1</span>
                  <span>20</span>
                </div>
              </div>
            </div>

            {/* Outputs */}
            <div className="p-8 bg-black/40 relative overflow-hidden">
              {/* Tier overflow halo when Enterprise */}
              {tier.enterprise && (
                <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(circle at top right, rgba(83,252,24,0.06), transparent 60%)' }} />
              )}

              <div className="relative">
                <div className="flex items-center justify-between mb-6">
                  <div className="text-[10px] mono text-[#53fc18] tracking-wider uppercase flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#53fc18] animate-pulse-soft" />
                    Live calculation
                  </div>
                  {/* Tier badge */}
                  <div className={`text-[10px] mono tracking-wider uppercase px-2.5 py-1 rounded-full border ${tier.enterprise ? 'border-[#aaff66]/40 bg-[#aaff66]/[0.08] text-[#aaff66]' : 'border-[#53fc18]/30 bg-[#53fc18]/[0.06] text-[#53fc18]'}`}>
                    → {tier.name} tier
                  </div>
                </div>

                <div className="mb-6">
                  <div className="text-[10px] mono text-stone-500 tracking-wider uppercase mb-1">
                    {tier.enterprise ? 'Estimated monthly savings' : 'Monthly savings'}
                  </div>
                  <div className="serif text-5xl text-[#53fc18] leading-none mb-1" style={{ textShadow: '0 0 30px rgba(83,252,24,0.5)' }}>
                    {tier.enterprise ? `$${Math.round(monthlyCostSaved).toLocaleString()}+` : `$${Math.round(netSavings).toLocaleString()}`}
                  </div>
                  <div className="text-xs mono text-stone-500">
                    {tier.enterprise ? 'after volume-priced Enterprise deal' : 'after Clipper subscription'}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-6 border-t border-[#53fc18]/[0.10]">
                  <div>
                    <div className="text-[10px] mono text-stone-500 tracking-wider uppercase mb-1">Hours saved / mo</div>
                    <div className="serif text-2xl">{Math.round(monthlyHoursSaved)}h</div>
                  </div>
                  <div>
                    <div className="text-[10px] mono text-stone-500 tracking-wider uppercase mb-1">ROI</div>
                    <div className="serif text-2xl text-[#53fc18]">
                      {tier.enterprise ? '—' : `${roi}%`}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] mono text-stone-500 tracking-wider uppercase mb-1">Plan cost</div>
                    <div className="serif text-2xl">
                      {tier.enterprise ? 'Custom' : `$${monthlyClipperCost}/mo`}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] mono text-stone-500 tracking-wider uppercase mb-1">Payback</div>
                    <div className="serif text-2xl">
                      {tier.enterprise ? '—' : paybackDays < 1 ? '< 1' : `${Math.ceil(paybackDays)} days`}
                    </div>
                  </div>
                </div>

                {/* Tier-aware CTA */}
                <div className="mt-6 pt-6 border-t border-[#53fc18]/[0.10]">
                  {tier.enterprise ? (
                    <div>
                      <div className="text-xs text-stone-300 leading-relaxed mb-4">
                        Your team's volume — <span className="text-[#aaff66] mono">{Math.round(teamMonthlyMinutes / 1000)}k+ min/mo</span> across <span className="text-[#aaff66] mono">{editors} editors</span> — is past our Scale tier. You'd want a custom contract with volume pricing, on-prem options, and a dedicated CSM.
                      </div>
                      <a href="mailto:sales@clipper.ai" className="magnetic-glow inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#aaff66] text-black text-sm mono font-medium tracking-wider uppercase hover:scale-[1.02] transition-transform">
                        Talk to sales
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  ) : tier.scale ? (
                    <div className="text-xs text-stone-400 leading-relaxed">
                      <span className="text-stone-200">{tier.fits}.</span> Scale gives you API access, custom virality tuning, and a dedicated CSM. Above 25 editors or 250k min/mo, talk to us about Enterprise.
                    </div>
                  ) : (
                    <div className="text-[10px] mono text-stone-600 leading-relaxed">
                      Based on 78% time reduction observed across active customers. Excludes value of additional clip volume generated.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

/* ──────────────────────────────────────────────────────────── WALL OF LOVE
   16 short testimonials in a 3-column scroll grid. Social proof at scale. */
function WallOfLove() {
  const quotes = [
    { q: 'Clipper just gets it. The hook generation alone saved me 4 hours last week.', name: 'Jenna Park', role: 'Senior Producer · NPR' },
    { q: 'The virality scoring is shockingly accurate. We post the top 3 every time and they all land.', name: 'Marcus Webb', role: 'Head of Content · CFA Daily' },
    { q: 'Went from 6 clips/week to 84. My editor doesn\'t want to ever go back.', name: 'Sara Okafor', role: 'Lattice Media' },
    { q: 'The reframe model handles screen-share interviews better than I can manually.', name: 'David Chen', role: 'Tech podcaster · 1.2M subs' },
    { q: 'Approval workflows are exactly right. We don\'t accidentally ship raw cuts anymore.', name: 'Priya Singh', role: 'VP Content · Quartz Labs' },
    { q: 'My ROI in week one was 11x. By week three, we cancelled three other tools.', name: 'Tomas Reyes', role: 'Founder · Beacon FM' },
    { q: 'Word-level timestamps are the unlock. Suddenly we can search our entire archive.', name: 'Aisha Cole', role: 'Archive Director · BBC Sounds' },
    { q: 'Their virality model genuinely predicts hits. We\'ve started letting it greenlight.', name: 'Liam O\'Brien', role: 'Head of Strategy · Compass Pod' },
    { q: 'SOC 2 + on-prem option was the only reason legal approved it. Grateful they shipped it.', name: 'Jordan Hwang', role: 'CISO · Halo Network' },
    { q: 'I run a one-person shop. Clipper makes me feel like I have a team of three.', name: 'Mia Tanaka', role: 'Folio Studios' },
    { q: 'The cohort onboarding is real. Sarah from their team reviewed our setup personally.', name: 'Ben Schwartz', role: 'Producer · Apex Audio' },
    { q: 'Latency under 50ms across the EU means we can ship same-day to TikTok DE.', name: 'Anna Becker', role: 'DACH Lead · Meridian' },
    { q: 'Their custom virality tuning beat my agency\'s benchmarks by 23%. Insane.', name: 'Carlos Mendez', role: 'Director · Northwind' },
    { q: 'The API is the cleanest I\'ve worked with. We had it integrated in an afternoon.', name: 'Yuki Watanabe', role: 'Engineering · Quartz Labs' },
    { q: 'I tried Opus and Vizard. Clipper is the only one that doesn\'t cut mid-thought.', name: 'Rachel Stein', role: 'Indie creator · 340K' },
    { q: 'Honestly? It\'s the most-used tool in our content stack this year. Including Premiere.', name: 'Ahmed Hassan', role: 'Head of Video · Quartz Labs' },
  ];

  const cols = [[], [], []];
  quotes.forEach((q, i) => cols[i % 3].push(q));

  return (
    <section className="relative z-10 max-w-[1400px] mx-auto px-6 md:px-8 py-16 border-t border-[#53fc18]/[0.10] overflow-hidden">
      <GlowOrb size={600} opacity={0.06} className="left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2" />
      <Reveal>
        <div className="text-center mb-12">
          <div className="text-[10px] mono text-[#53fc18] mb-4 tracking-[0.2em] uppercase flex items-center justify-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#53fc18]" style={{ boxShadow: '0 0 8px #53fc18' }} />
            What teams say
          </div>
          <h2 className="serif text-4xl md:text-5xl leading-[1.05] mb-3">
            Loved by the people <span className="italic gradient-green">who actually ship.</span>
          </h2>
          <p className="text-stone-400 leading-relaxed max-w-xl mx-auto">
            Unfiltered notes from teams running Clipper.ai in production. Pulled from in-app feedback, Twitter, and customer interviews.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          {cols.map((col, ci) => (
            <div key={ci} className="space-y-4">
              {col.map((quote, qi) => (
                <Reveal key={qi} delay={(ci * 3 + qi) * 50}>
                  <div className="group rounded-xl border border-[#53fc18]/[0.10] bg-[#53fc18]/[0.01] p-5 hover:border-[#53fc18]/30 hover:bg-[#53fc18]/[0.03]">
                    <div className="flex items-start gap-2 mb-3">
                      <Quote className="w-4 h-4 text-[#53fc18]/40 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-stone-200 leading-relaxed">{quote.q}</p>
                    </div>
                    <div className="flex items-center gap-2.5 pt-3 border-t border-[#53fc18]/[0.06]">
                      <Avatar seed={quote.name} size={28} />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-stone-200 truncate">{quote.name}</div>
                        <div className="text-[10px] mono text-stone-500 truncate tracking-wider">{quote.role}</div>
                      </div>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          ))}
        </div>

        {/* Aggregate stat row */}
        <div className="mt-10 pt-8 border-t border-[#53fc18]/[0.10] grid grid-cols-2 md:grid-cols-4 gap-6">
          {[
            { v: '4.9', s: '/ 5', l: 'G2 score · 412 reviews' },
            { v: '94%', l: 'recommend to peers' },
            { v: '67%', l: 'use daily' },
            { v: '3.2 days', l: 'avg. time-to-value' },
          ].map((s) => (
            <div key={s.l} className="text-center">
              <div className="serif text-3xl text-[#53fc18] leading-none mb-1" style={{ textShadow: '0 0 16px rgba(83,252,24,0.3)' }}>
                {s.v}<span className="text-xl text-stone-500">{s.s || ''}</span>
              </div>
              <div className="text-[10px] mono text-stone-500 tracking-wider uppercase">{s.l}</div>
            </div>
          ))}
        </div>
      </Reveal>
    </section>
  );
}

/* ──────────────────────────────────────────────────────────── INTERACTIVE DEMO
   Drop a URL → watch the pipeline simulate → see generated clips
   The product *is* the demo. */
function InteractiveDemo({ openApp }) {
  const [url, setUrl] = useState('');
  const [stage, setStage] = useState('idle'); // idle | analyzing | done
  const [progress, setProgress] = useState(0);
  const [activeStep, setActiveStep] = useState(0);

  const samples = [
    { label: 'Lex Fridman #428', url: 'youtube.com/watch?v=lex-428' },
    { label: 'Theo Von · Recent', url: 'youtube.com/watch?v=theo-recent' },
    { label: 'My Earnings Call', url: 'drive.google.com/q4-earnings.mp4' },
  ];

  const steps = [
    'Transcribing with Whisper-Large',
    'Identifying narrative beats',
    'Scoring virality (multi-modal)',
    'Reframing 9:16 + captions',
    'Generating hooks',
  ];

  const clips = [
    { score: 94, title: 'The 47-second hook that crushed', dur: '0:47', engagement: '8.2K' },
    { score: 88, title: 'When she changed her mind mid-sentence', dur: '0:38', engagement: '5.6K' },
    { score: 81, title: 'The framework, condensed', dur: '0:52', engagement: '3.1K' },
    { score: 76, title: 'Counterintuitive take on Q2', dur: '0:41', engagement: '2.4K' },
  ];

  // Simulate pipeline
  useEffect(() => {
    if (stage !== 'analyzing') return;
    const stepInterval = setInterval(() => {
      setActiveStep((s) => Math.min(s + 1, steps.length - 1));
    }, 700);
    const progressInterval = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          clearInterval(progressInterval);
          clearInterval(stepInterval);
          setStage('done');
          return 100;
        }
        return p + 2.5;
      });
    }, 100);
    return () => {
      clearInterval(progressInterval);
      clearInterval(stepInterval);
    };
  }, [stage]);

  const start = (sampleUrl) => {
    setUrl(sampleUrl || url || 'youtube.com/watch?v=demo');
    setStage('analyzing');
    setProgress(0);
    setActiveStep(0);
  };

  const reset = () => {
    setStage('idle');
    setProgress(0);
    setActiveStep(0);
    setUrl('');
  };

  return (
    <section className="relative z-10 max-w-[1400px] mx-auto px-6 md:px-8 py-16 border-t border-[#53fc18]/[0.10]">
      <Reveal>
        <div className="text-center mb-10">
          <div className="text-[10px] mono text-[#53fc18] mb-4 tracking-[0.2em] uppercase flex items-center justify-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#53fc18]" style={{ boxShadow: "0 0 8px #53fc18" }} />
            Try it · No signup
          </div>
          <h2 className="serif text-4xl md:text-5xl leading-[1.05] mb-3">
            Drop a URL. <span className="italic gradient-green">Watch it work.</span>
          </h2>
          <p className="text-stone-400 leading-relaxed max-w-xl mx-auto">
            Real pipeline. Sample data. No account needed. See exactly what Clipper does in 12 seconds.
          </p>
        </div>

        {/* Demo console */}
        <div className="max-w-4xl mx-auto rounded-2xl border border-[#53fc18]/20 bg-gradient-to-b from-[#53fc18]/[0.03] to-transparent overflow-hidden shadow-[0_0_60px_-20px_rgba(83,252,24,0.3)]">
          {/* Console header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-[#53fc18]/[0.10] bg-black/40">
            <div className="flex items-center gap-2 text-[10px] mono text-stone-400 tracking-wider uppercase">
              <span className="flex gap-1">
                <span className="w-2 h-2 rounded-full bg-stone-700" />
                <span className="w-2 h-2 rounded-full bg-stone-700" />
                <span className="w-2 h-2 rounded-full bg-[#53fc18]" style={{ boxShadow: "0 0 6px #53fc18" }} />
              </span>
              <span className="ml-2">clipper.ai / sandbox</span>
            </div>
            <div className="text-[10px] mono text-stone-500 tracking-wider">
              {stage === 'idle' && 'READY'}
              {stage === 'analyzing' && <span className="text-[#53fc18]">PROCESSING · {Math.round(progress)}%</span>}
              {stage === 'done' && <span className="text-[#53fc18]">COMPLETE · 4 CLIPS</span>}
            </div>
          </div>

          {/* Idle state — input */}
          {stage === 'idle' && (
            <div className="p-8 md:p-10">
              <div className="flex flex-col sm:flex-row gap-2 mb-6">
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && start()}
                  placeholder="Try a sample episode below, or paste a sample URL…"
                  className="flex-1 min-w-0 px-5 py-4 rounded-md border border-[#53fc18]/30 focus:border-[#53fc18]/60 focus:outline-none text-base"
                  style={{ backgroundColor: 'rgba(20, 20, 18, 0.8)', color: '#e7e5e4' }}
                />
                <button
                  onClick={() => start()}
                  className="magnetic-glow group px-6 py-4 rounded-md font-medium flex items-center justify-center gap-2 whitespace-nowrap transition-transform hover:scale-[1.02]"
                  style={{ backgroundColor: '#53fc18', color: '#000', boxShadow: '0 0 30px rgba(83,252,24,0.3)' }}
                >
                  Run pipeline
                  <ArrowUpRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] mono text-stone-500 tracking-wider uppercase mr-2">Or try a sample:</span>
                {samples.map((s) => (
                  <button
                    key={s.label}
                    onClick={() => start(s.url)}
                    className="px-3 py-1.5 rounded-full border border-[#53fc18]/20 bg-[#53fc18]/[0.02] text-xs text-stone-300 hover:border-[#53fc18]/50 hover:bg-[#53fc18]/[0.06] hover:text-[#53fc18]"
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Analyzing state */}
          {stage === 'analyzing' && (
            <div className="p-8 md:p-10">
              <div className="mb-6">
                <div className="text-[10px] mono text-stone-500 tracking-wider uppercase mb-2">Source</div>
                <div className="font-mono text-sm text-stone-300 px-4 py-2 rounded-md bg-black/40 border border-[#53fc18]/10 truncate">{url}</div>
              </div>

              {/* Progress bar */}
              <div className="mb-6">
                <div className="h-1.5 rounded-full bg-stone-900 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${progress}%`,
                      background: 'linear-gradient(90deg, #53fc18, #aaff66)',
                      boxShadow: '0 0 16px rgba(83,252,24,0.6)',
                    }}
                  />
                </div>
              </div>

              {/* Pipeline steps */}
              <div className="space-y-2">
                {steps.map((step, i) => (
                  <div
                    key={step}
                    className={`flex items-center gap-3 px-4 py-2.5 rounded-md transition-all ${
                      i < activeStep
                        ? 'opacity-50'
                        : i === activeStep
                          ? 'bg-[#53fc18]/[0.06] border border-[#53fc18]/30'
                          : 'opacity-30'
                    }`}
                  >
                    <div className="w-5 h-5 flex items-center justify-center">
                      {i < activeStep ? (
                        <CheckCircle2 className="w-4 h-4 text-[#53fc18]" />
                      ) : i === activeStep ? (
                        <div className="w-3 h-3 rounded-full bg-[#53fc18] animate-pulse-soft" style={{ boxShadow: '0 0 8px #53fc18' }} />
                      ) : (
                        <div className="w-2 h-2 rounded-full bg-stone-700" />
                      )}
                    </div>
                    <span className={`text-sm mono ${i === activeStep ? 'text-stone-100' : 'text-stone-500'}`}>
                      {step}
                    </span>
                    {i === activeStep && (
                      <span className="ml-auto text-[10px] mono text-[#53fc18] tracking-wider">RUNNING</span>
                    )}
                    {i < activeStep && (
                      <span className="ml-auto text-[10px] mono text-stone-600 tracking-wider">DONE · {Math.floor(Math.random() * 800 + 200)}ms</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Done state — results */}
          {stage === 'done' && (
            <div className="p-8 md:p-10">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <div className="text-[10px] mono text-[#53fc18] tracking-wider uppercase mb-1 flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Pipeline complete
                  </div>
                  <div className="serif text-2xl">4 clips ready to ship</div>
                </div>
                <button
                  onClick={reset}
                  className="text-xs mono text-stone-400 tracking-wider uppercase hover:text-[#53fc18] flex items-center gap-1.5"
                >
                  <span>↺</span> Try another
                </button>
              </div>

              <div className="grid sm:grid-cols-2 gap-3 mb-6">
                {clips.map((clip, i) => (
                  <div
                    key={i}
                    className="group relative rounded-xl border border-[#53fc18]/[0.12] bg-[#53fc18]/[0.015] p-4 hover:border-[#53fc18]/40 hover:bg-[#53fc18]/[0.04] cursor-pointer overflow-hidden"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div
                          className="serif text-2xl text-[#53fc18] leading-none"
                          style={{ textShadow: '0 0 12px rgba(83,252,24,0.4)' }}
                        >
                          {clip.score}
                        </div>
                        <div className="text-[10px] mono text-stone-500 tracking-wider uppercase">virality</div>
                      </div>
                      <div className="text-[10px] mono text-stone-500 tracking-wider">{clip.dur}</div>
                    </div>
                    <div className="text-sm text-stone-200 mb-3 leading-snug">{clip.title}</div>
                    {/* Mini waveform */}
                    <div className="flex items-end gap-0.5 h-6 mb-2">
                      {Array.from({ length: 32 }).map((_, j) => (
                        <div
                          key={j}
                          className="flex-1 rounded-sm bg-[#53fc18]/40"
                          style={{ height: `${30 + Math.abs(Math.sin(j * 0.4 + i)) * 70}%` }}
                        />
                      ))}
                    </div>
                    <div className="flex items-center justify-between text-[10px] mono text-stone-500 tracking-wider">
                      <span>EST. {clip.engagement} VIEWS</span>
                      <span className="text-[#53fc18] opacity-0 group-hover:opacity-100">OPEN →</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-4 border-t border-[#53fc18]/[0.10] flex flex-col sm:flex-row gap-3 items-center justify-between">
                <div className="text-xs text-stone-400">
                  Want to render real clips from your own footage?
                </div>
                <button
                  onClick={openApp}
                  className="magnetic-glow group px-5 py-2.5 rounded-md font-medium text-sm flex items-center gap-2 whitespace-nowrap transition-transform hover:scale-[1.02]"
                  style={{ backgroundColor: '#53fc18', color: '#000', boxShadow: '0 0 30px rgba(83,252,24,0.3)' }}
                >
                  Open the Studio
                  <ArrowUpRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </button>
              </div>
            </div>
          )}
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
    <section className="relative z-10 max-w-[1400px] mx-auto px-6 md:px-8 py-16 border-t border-[#53fc18]/[0.10]">
      <Reveal>
        <div className="grid md:grid-cols-[1fr_2fr] gap-12 items-start">
          <div>
            <div className="text-[10px] mono text-[#53fc18] mb-4 tracking-[0.2em] uppercase flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#53fc18]" style={{ boxShadow: "0 0 8px #53fc18" }} />
              Plays well with everything
            </div>
            <h2 className="serif text-4xl md:text-5xl leading-[1.05] mb-4">
              Drop in. <span className="italic gradient-green">Don't replace.</span>
            </h2>
            <p className="text-stone-400 leading-relaxed mb-6">
              Clipper fits where your workflow already lives. Pull from any source, hand off to any editor, publish anywhere. Zapier, webhooks, and a public API for everything else.
            </p>
            <div className="flex flex-wrap gap-2 text-[10px] mono text-stone-500 tracking-wider uppercase">
              <span className="px-2 py-1 rounded border border-[#53fc18]/15">10 native</span>
              <span className="px-2 py-1 rounded border border-[#53fc18]/15">REST API</span>
              <span className="px-2 py-1 rounded border border-[#53fc18]/15">Webhooks</span>
              <span className="px-2 py-1 rounded border border-[#53fc18]/15">Zapier · MCP</span>
            </div>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2.5">
            {integrations.map((it, i) => (
              <div
                key={it.name}
                className="group relative p-5 rounded-xl border border-[#53fc18]/[0.10] bg-gradient-to-br from-[#53fc18]/[0.02] to-transparent hover:border-[#53fc18]/40 flex flex-col items-center justify-center aspect-square overflow-hidden cursor-pointer transition-all duration-300 hover:-translate-y-0.5"
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
      // Camera body + play triangle lens — recognizable as a video meeting tool
      return (
        <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round">
          <rect x="3" y="7" width="13" height="10" rx="2.5" />
          <path d="M16 10.5L21 8v8l-5-2.5z" fill="currentColor" />
        </svg>
      );
    case 'Riverside':
      // River wave + recording dot — evokes "recording from a river" of audio
      return (
        <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
          <path d="M3 9c2.5 0 2.5 3 5 3s2.5-3 5-3 2.5 3 5 3 2.5-3 3-3" />
          <path d="M3 15c2.5 0 2.5 3 5 3s2.5-3 5-3 2.5 3 5 3 2.5-3 3-3" opacity="0.5" />
          <circle cx="19" cy="5.5" r="1.8" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'Descript':
      // Document with a sound wave bar inside — text + audio editor
      return (
        <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 3h10l4 4v14H5z" />
          <path d="M15 3v4h4" />
          <path d="M8 13v3" />
          <path d="M11 11v5" />
          <path d="M14 12v3" />
          <path d="M17 13v3" />
        </svg>
      );
    case 'TikTok':
      // Musical note with offset shadow — evokes TikTok's signature glyph
      return (
        <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 3v11.5a3.5 3.5 0 11-3.5-3.5" />
          <path d="M14 3c0 2.5 2 4.5 4.5 4.5" />
          <path d="M11 3v11.5a3.5 3.5 0 11-3.5-3.5" opacity="0.4" />
        </svg>
      );
    case 'Instagram':
      // Camera frame with lens + flash dot — classic Instagram glyph
      return (
        <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.6">
          <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
          <circle cx="12" cy="12" r="4.2" />
          <circle cx="17" cy="7" r="1" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'LinkedIn':
      // Bold "in" wordmark stripped down — pillar + dot + arc + stem
      return (
        <svg viewBox="0 0 24 24" className={common} fill="currentColor">
          <rect x="3" y="9" width="3.2" height="11" rx="0.4" />
          <circle cx="4.6" cy="5.2" r="1.9" />
          <path d="M9.5 9h3v1.7c.6-1 1.8-2 3.6-2 3.4 0 4.4 2.2 4.4 5.1V20h-3.3v-5.4c0-1.3-.3-2.4-1.7-2.4-1.5 0-2 1.1-2 2.4V20H9.5z" />
        </svg>
      );
    case 'Drive':
      // Three-color triangle composition (Google Drive's signature shape)
      return (
        <svg viewBox="0 0 24 24" className={common} fill="currentColor">
          <path d="M8.5 3h7L22 14h-7z" opacity="0.9" />
          <path d="M2 14L8.5 3l3.5 6-3.5 6z" opacity="0.55" />
          <path d="M8.5 15h13l-3.25 5.5h-13z" opacity="0.7" />
        </svg>
      );
    case 'Dropbox':
      // Four diamonds forming Dropbox's signature open-box shape
      return (
        <svg viewBox="0 0 24 24" className={common} fill="currentColor">
          <path d="M6.5 3L2 6.5l4.5 3.5L11 6.5z" opacity="0.95" />
          <path d="M17.5 3L13 6.5l4.5 3.5L22 6.5z" opacity="0.95" />
          <path d="M6.5 13L2 16.5l4.5 3.5L11 16.5z" opacity="0.95" />
          <path d="M17.5 13L13 16.5l4.5 3.5L22 16.5z" opacity="0.95" />
          <path d="M6.5 12L11 15.5 6.5 19 2 15.5z" opacity="0" />
        </svg>
      );
    case 'Notion':
      // The Notion "N" — block with two strokes
      return (
        <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" strokeLinecap="round">
          <rect x="3.5" y="3.5" width="17" height="17" rx="2" />
          <path d="M8.5 17V8l7 8.5V8" />
        </svg>
      );
    case 'Slack':
      // Slack's four-armed pinwheel — 4 rounded pills offset around center
      return (
        <svg viewBox="0 0 24 24" className={common} fill="currentColor">
          {/* top arm */}
          <rect x="10" y="2.5" width="3.5" height="9" rx="1.75" />
          {/* right arm */}
          <rect x="12.5" y="10" width="9" height="3.5" rx="1.75" />
          {/* bottom arm */}
          <rect x="10.5" y="12.5" width="3.5" height="9" rx="1.75" />
          {/* left arm */}
          <rect x="2.5" y="10.5" width="9" height="3.5" rx="1.75" />
        </svg>
      );
    default:
      return <div className={common + " border border-current rounded-md"} />;
  }
}


export default function ClipperApp() {
  const [view, setView] = useState('landing'); // landing | app
  const [page, setPage] = useState('home'); // home | product | pulse | pricing | customers | changelog | docs | company
  const [stage, setStage] = useState('upload'); // upload | analyzing | results | pulse
  const [progress, setProgress] = useState(0);
  const [analysisStep, setAnalysisStep] = useState(0);
  const [clips, setClips] = useState([]);
  const [selectedClip, setSelectedClip] = useState(null);
  const [videoMeta, setVideoMeta] = useState(null);
  const [history, setHistory] = useState([]);
  const [currentRunId, setCurrentRunId] = useState(null);
  const fileRef = useRef(null);

  // Load the showcase (pre-seeded demo jobs) + any live runs from the backend.
  const refreshHistory = React.useCallback(async () => {
    try {
      const runs = await fetchShowcase();
      setHistory(runs);
    } catch (e) {
      // Showcase is best-effort — never block the studio on it.
      console.error('showcase load failed', e);
    }
  }, []);

  useEffect(() => {
    refreshHistory();
  }, [refreshHistory]);

  // The backend persists every job automatically, so "persist" is just a
  // re-fetch of the list. Kept as a named function so call sites don't change.
  const persistRun = async () => {
    await refreshHistory();
  };

  const deleteRun = async (runId) => {
    // No hard-delete endpoint in the demo — just hide it from the list.
    setHistory((h) => h.filter((r) => r.id !== runId));
  };

  const loadFromHistory = (run) => {
    setClips(run.clips);
    setVideoMeta(run.videoMeta);
    setCurrentRunId(run.id);
    setStage('results');
  };

  // Inject fonts via head link — works reliably in artifact sandbox
  useEffect(() => {
    const id = 'clipper-fonts';
    if (document.getElementById(id)) return;
    const preconnect1 = document.createElement('link');
    preconnect1.rel = 'preconnect';
    preconnect1.href = 'https://fonts.googleapis.com';
    const preconnect2 = document.createElement('link');
    preconnect2.rel = 'preconnect';
    preconnect2.href = 'https://fonts.gstatic.com';
    preconnect2.crossOrigin = 'anonymous';
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,300;0,400;0,500;0,600;1,400;1,500&family=JetBrains+Mono:wght@400;500&display=swap';
    document.head.appendChild(preconnect1);
    document.head.appendChild(preconnect2);
    document.head.appendChild(link);
  }, []);

  // Toggle studio-app body class — enables custom crosshair cursor in app view
  useEffect(() => {
    if (view === 'app') {
      document.body.classList.add('studio-app');
    } else {
      document.body.classList.remove('studio-app');
    }
    return () => document.body.classList.remove('studio-app');
  }, [view]);

  const analysisSteps = [
    'Transcribing audio with Whisper',
    'Detecting peak emotional moments',
    'Analyzing visual composition',
    'Scoring viral potential',
    'Generating captions & hooks',
    'Optimizing for platforms',
  ];

  // Analysis is driven by the real backend pipeline inside handleFile() now —
  // progress + step come from polling the job, not a simulated timer.

  const generateMockClips = () => [
    {
      id: 1,
      title: 'The moment everything changed',
      hook: '"I never thought this would actually work..."',
      duration: 47,
      virality: 94,
      timestamp: '12:34 - 13:21',
      platforms: ['TikTok', 'Reels', 'Shorts'],
      reasons: ['High emotional peak', 'Strong narrative hook', 'Quotable moment'],
      engagement: { hook: 96, retention: 91, shareability: 89 },
      thumbnail: 'gradient-1',
    },
    {
      id: 2,
      title: 'Counterintuitive insight on growth',
      hook: '"Most founders get this completely backwards"',
      duration: 38,
      virality: 87,
      timestamp: '24:08 - 24:46',
      platforms: ['TikTok', 'Reels', 'Shorts', 'X'],
      reasons: ['Contrarian take', 'Authority signal', 'Pattern interrupt'],
      engagement: { hook: 92, retention: 84, shareability: 88 },
      thumbnail: 'gradient-2',
    },
    {
      id: 3,
      title: 'Three frameworks in 60 seconds',
      hook: '"Steal these three frameworks I use every day"',
      duration: 58,
      virality: 82,
      timestamp: '31:45 - 32:43',
      platforms: ['Reels', 'Shorts', 'LinkedIn'],
      reasons: ['Listicle format', 'Actionable value', 'Save-worthy'],
      engagement: { hook: 85, retention: 87, shareability: 76 },
      thumbnail: 'gradient-3',
    },
    {
      id: 4,
      title: 'The mistake nobody talks about',
      hook: '"This is the one thing nobody warned me about"',
      duration: 42,
      virality: 78,
      timestamp: '08:15 - 08:57',
      platforms: ['TikTok', 'Reels'],
      reasons: ['Vulnerability hook', 'Curiosity gap', 'Relatable struggle'],
      engagement: { hook: 88, retention: 79, shareability: 71 },
      thumbnail: 'gradient-4',
    },
    {
      id: 5,
      title: 'Quick tactical breakdown',
      hook: '"Here\'s exactly how we 10x\'d in 90 days"',
      duration: 52,
      virality: 73,
      timestamp: '45:22 - 46:14',
      platforms: ['Shorts', 'LinkedIn', 'X'],
      reasons: ['Specific numbers', 'Case study format', 'Tactical depth'],
      engagement: { hook: 78, retention: 81, shareability: 68 },
      thumbnail: 'gradient-5',
    },
  ];

  const handleFile = async (file) => {
    if (!file) return;
    setVideoMeta({ name: file.name, size: (file.size / 1024 / 1024).toFixed(1) });
    setStage('analyzing');
    setProgress(0);
    setAnalysisStep(0);
    try {
      const { clips: newClips, jobId } = await runDemoPipeline(file, {
        onProgress: (pct, stepIndex) => {
          setProgress(pct);
          if (typeof stepIndex === 'number') setAnalysisStep(stepIndex);
        },
      });
      setClips(newClips);
      setCurrentRunId(jobId);
      setStage('results');
      refreshHistory(); // surface this run in the sidebar history
    } catch (e) {
      console.error('pipeline failed', e);
      alert(`Processing failed: ${e?.message || e}`);
      setStage('upload');
    }
  };

  const reset = () => {
    setStage('upload');
    setClips([]);
    setSelectedClip(null);
    setVideoMeta(null);
    setProgress(0);
    setCurrentRunId(null);
  };

  if (view === 'landing') {
    const goto = (p) => { setPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }); };
    const openApp = () => setView('app');
    const pageProps = { goto, openApp, page };
    return (
      <>
        <SiteShell {...pageProps}>
          {page === 'home' && <Landing onStart={openApp} goto={goto} />}
          {page === 'product' && <ProductPage goto={goto} openApp={openApp} />}
          {page === 'pricing' && <PricingPage goto={goto} openApp={openApp} />}
          {page === 'customers' && <CustomersPage goto={goto} openApp={openApp} />}
          {page === 'changelog' && <ChangelogPage goto={goto} />}
          {page === 'docs' && <DocsPage goto={goto} />}
          {page === 'status' && <StatusPage goto={goto} />}
          {page === 'company' && <CompanyPage goto={goto} />}
        </SiteShell>
        <CrosshairCursor />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-black text-stone-100" style={{ fontFamily: "'Inter', -apple-system, sans-serif" }}>
      <style>{`
        .serif { font-family: 'Inter', -apple-system, sans-serif; font-weight: 500; letter-spacing: -0.04em; line-height: 1; }
        .mono { font-family: 'JetBrains Mono', 'SF Mono', Menlo, monospace; font-feature-settings: "calt", "ss01"; }
        body, * { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; -webkit-font-smoothing: antialiased; }

        /* Motion system — slow, deliberate, Palantir-grade */
        @keyframes shimmer { 0% { background-position: -1000px 0; } 100% { background-position: 1000px 0; } }
        @keyframes pulse-ring { 0% { transform: scale(0.95); opacity: 1; } 100% { transform: scale(1.4); opacity: 0; } }
        @keyframes slide-up { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes blur-in {
          from { opacity: 0; filter: blur(12px); transform: translateY(20px); }
          to { opacity: 1; filter: blur(0); transform: translateY(0); }
        }
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes ambient {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.05); }
        }
        @keyframes scan {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(100vh); }
        }
        @keyframes grid-fade {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.7; }
        }
        .animate-slide-up { animation: slide-up 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .animate-blur-in { animation: blur-in 0.9s cubic-bezier(0.16, 1, 0.3, 1) forwards; opacity: 0; }
        .animate-fade-in { animation: fade-in 1.2s ease-out forwards; }
        .animate-ambient { animation: ambient 8s ease-in-out infinite; }

        /* Reveal-on-scroll utility */
        .reveal { opacity: 0; transform: translateY(24px); transition: opacity 1s cubic-bezier(0.16, 1, 0.3, 1), transform 1s cubic-bezier(0.16, 1, 0.3, 1); }
        .reveal.in { opacity: 1; transform: translateY(0); }

        /* Smooth scroll */
        html { scroll-behavior: smooth; }

        /* Grid background */
        .grid-bg {
          background-image:
            linear-gradient(rgba(83,252,24,0.22) 1px, transparent 1px),
            linear-gradient(90deg, rgba(83,252,24,0.22) 1px, transparent 1px);
          background-size: 64px 64px;
        }

        /* Soft transitions everywhere */
        button, a, [role="button"] { transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1); }

        /* Grain texture */
        .grain::before {
          content: ''; position: fixed; inset: 0; pointer-events: none; opacity: 0.035; z-index: 1; mix-blend-mode: overlay;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence baseFrequency='0.9' /%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)' /%3E%3C/svg%3E");
        }

        /* Accent glow utility */
        .glow-green { box-shadow: 0 0 0 1px rgba(83,252,24,0.2), 0 0 30px -5px rgba(83,252,24,0.3); }
        .text-glow { text-shadow: 0 0 40px rgba(83,252,24,0.6), 0 0 80px rgba(83,252,24,0.3); }

        /* Gradient text for italic green — adds dimension */
        .gradient-green {
          background: linear-gradient(180deg, #aaff66 0%, #53fc18 60%, #3dd510 100%);
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          filter: drop-shadow(0 0 24px rgba(83,252,24,0.45));
        }

        /* Removed the default blue focus ring; custom green ring shows on keyboard focus only */
        *:focus { outline: none; }
        *:focus-visible {
          outline: none;
          box-shadow: 0 0 0 2px rgba(83, 252, 24, 0.5), 0 0 12px rgba(83, 252, 24, 0.25);
          border-radius: 4px;
        }

        /* Animated underline for inline links */
        .link-underline { position: relative; }
        .link-underline::after {
          content: ''; position: absolute; left: 0; bottom: -2px; width: 100%; height: 1px;
          background: #53fc18; transform-origin: right; transform: scaleX(0);
          transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .link-underline:hover::after { transform-origin: left; transform: scaleX(1); }

        /* Shimmer effect — for use on premium tiles */
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        .shimmer-on-hover {
          background: linear-gradient(110deg, transparent 30%, rgba(83,252,24,0.08) 45%, rgba(83,252,24,0.12) 50%, rgba(83,252,24,0.08) 55%, transparent 70%);
          background-size: 200% 100%;
          background-position: -200% 0;
          opacity: 0;
          transition: opacity 0.3s ease;
        }
        .group:hover .shimmer-on-hover {
          opacity: 1;
          animation: shimmer 1.4s ease-in-out;
        }

        /* Smooth scrollbar */
        ::-webkit-scrollbar { width: 10px; height: 10px; }
        ::-webkit-scrollbar-track { background: rgba(20,20,18,0.4); }
        ::-webkit-scrollbar-thumb {
          background: rgba(83,252,24,0.15);
          border-radius: 999px;
          border: 2px solid transparent;
          background-clip: padding-box;
        }
        ::-webkit-scrollbar-thumb:hover { background: rgba(83,252,24,0.35); background-clip: padding-box; border: 2px solid transparent; }

        /* Selection color — when you highlight text */
        ::selection { background: rgba(83,252,24,0.3); color: #fff; }

        /* Subtle hover lift on cards */
        .card-lift { transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.3s, box-shadow 0.3s; }
        .card-lift:hover { transform: translateY(-2px); }

        /* Magnetic border glow — for primary CTAs */
        .magnetic-glow { position: relative; isolation: isolate; }
        .magnetic-glow::before {
          content: ''; position: absolute; inset: -1px; border-radius: inherit;
          background: linear-gradient(120deg, transparent 30%, rgba(83,252,24,0.6) 50%, transparent 70%);
          background-size: 200% 100%;
          background-position: -200% 0;
          z-index: -1; opacity: 0;
          transition: opacity 0.3s ease;
        }
        .magnetic-glow:hover::before {
          opacity: 1;
          animation: shimmer 1.8s linear infinite;
        }
      `}</style>

      <div className="grain" />

      {/* Top nav */}
      <nav className="border-b border-stone-800/60 bg-black/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-[1400px] mx-auto px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-10">
            <button onClick={() => setView('landing')} className="flex items-center gap-2.5">
              <LogoMark size={28} />
              <span className="serif text-2xl tracking-tight">Clipper.ai</span>
            </button>
            <div className="hidden md:flex gap-1 text-sm text-stone-400">
              {['Studio', 'Library', 'Analytics', 'Brand Kit'].map((item, i) => (
                <button
                  key={item}
                  onClick={() => i === 0 && setStage('upload')}
                  className={`px-3 py-1.5 rounded-md transition ${i === 0 ? 'text-stone-100 bg-stone-800/60' : 'hover:text-stone-200'}`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 text-xs text-stone-400 mono">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              {history.length === 0 ? '0' : Math.min(history.length * 8, 60)} / 60 min
            </div>
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-xs font-medium">
              AC
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-[1400px] mx-auto px-8 py-10">
        {stage === 'upload' && <UploadView onFile={handleFile} fileRef={fileRef} history={history} onLoadRun={loadFromHistory} onDeleteRun={deleteRun} />}
        {stage === 'analyzing' && <AnalyzingView progress={progress} step={analysisStep} steps={analysisSteps} videoMeta={videoMeta} />}
        {stage === 'results' && (
          selectedClip ? (
            <ClipDetailView clip={selectedClip} onBack={() => setSelectedClip(null)} />
          ) : (
            <ResultsView clips={clips} onSelect={setSelectedClip} onReset={reset} videoMeta={videoMeta} />
          )
        )}
      </main>

      <OnboardingChecklist
        stage={stage}
        hasClips={clips.length > 0}
        hasSelectedClip={!!selectedClip}
      />

      <FeedbackWidget jobId={currentRunId} />

      <CrosshairCursor />
    </div>
  );
}

/* ──────────────────────────────────────────────────────────── HOOKS */
function useReveal() {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add('in'); }),
      { threshold: 0.15, rootMargin: '0px 0px -10% 0px' }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return ref;
}

function Reveal({ children, delay = 0, className = '' }) {
  const ref = useReveal();
  return (
    <div ref={ref} className={`reveal ${className}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────── SITE SHELL */
function SiteShell({ children, page, goto, openApp }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close mobile menu on Escape
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e) => { if (e.key === 'Escape') setMobileOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobileOpen]);

  const navItems = [
    { k: 'product', l: 'Product' },
    { k: 'customers', l: 'Customers' },
    { k: 'pricing', l: 'Pricing' },
    { k: 'changelog', l: 'Changelog' },
    { k: 'docs', l: 'Docs' },
    { k: 'company', l: 'Company' },
  ];

  const handleNav = (k) => {
    setMobileOpen(false);
    goto(k);
  };

  return (
    <div className="min-h-screen bg-black text-stone-100 overflow-x-hidden relative" style={{ fontFamily: "'Inter', sans-serif" }}>
      <style>{`
        /* Single-family type system — Inter for everything, with strict roles */
        body, *, button, input, select, textarea {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, system-ui, 'Segoe UI', sans-serif;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          font-feature-settings: 'ss01', 'cv11', 'cv02';
        }
        /* DISPLAY: large headlines — Inter at lighter weight with tight tracking */
        .serif {
          font-family: 'Inter', -apple-system, sans-serif;
          font-weight: 500;
          letter-spacing: -0.04em;
          line-height: 1;
        }
        .serif.italic, .serif em, em {
          font-style: italic;
          font-weight: 500;
        }
        /* MONO: technical signals only — versions, timestamps, eyebrows, code, kbd */
        .mono {
          font-family: 'JetBrains Mono', 'SF Mono', Menlo, Consolas, monospace;
          font-weight: 400;
          font-feature-settings: 'calt', 'ss01';
          letter-spacing: 0;
        }
        /* Body controls and paragraphs */
        button, input, select, textarea { font-weight: 500; letter-spacing: -0.01em; }
        p, li, a { letter-spacing: -0.011em; }
        @keyframes slide-up { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes blur-in { from { opacity: 0; filter: blur(12px); transform: translateY(20px); } to { opacity: 1; filter: blur(0); transform: translateY(0); } }
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        @keyframes ambient {
          0%, 100% { opacity: 0.3; transform: scale(1) translate(0, 0); }
          33% { opacity: 0.5; transform: scale(1.1) translate(30px, -20px); }
          66% { opacity: 0.4; transform: scale(0.95) translate(-20px, 30px); }
        }
        @keyframes pulse-soft { 0%, 100% { opacity: 0.6; } 50% { opacity: 1; } }
        @keyframes flow { 0% { stroke-dashoffset: 0; } 100% { stroke-dashoffset: -100; } }
        .animate-blur-in { animation: blur-in 1s cubic-bezier(0.16, 1, 0.3, 1) forwards; opacity: 0; }
        .animate-fade-in { animation: fade-in 1.5s ease-out forwards; }
        .animate-ambient { animation: ambient 12s ease-in-out infinite; }
        .animate-pulse-soft { animation: pulse-soft 2.5s ease-in-out infinite; }
        .animate-flow { animation: flow 3s linear infinite; }
        .reveal { opacity: 0; transform: translateY(24px); transition: opacity 1.1s cubic-bezier(0.16, 1, 0.3, 1), transform 1.1s cubic-bezier(0.16, 1, 0.3, 1); }
        .reveal.in { opacity: 1; transform: translateY(0); }
        button, a, [role="button"] { transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1); }
        .grid-bg {
          background-image: linear-gradient(rgba(83,252,24,0.22) 1px, transparent 1px), linear-gradient(90deg, rgba(83,252,24,0.22) 1px, transparent 1px);
          background-size: 64px 64px;
        }
        .text-glow { text-shadow: 0 0 40px rgba(83,252,24,0.6), 0 0 80px rgba(83,252,24,0.3); }
        html { scroll-behavior: smooth; }
        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.15s !important;
            scroll-behavior: auto !important;
          }
        }
        .grain::before {
          content: ''; position: fixed; inset: 0; pointer-events: none; opacity: 0.03; z-index: 1; mix-blend-mode: overlay;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence baseFrequency='0.9' /%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)' /%3E%3C/svg%3E");
        }
        .gradient-green {
          background: linear-gradient(180deg, #aaff66 0%, #53fc18 60%, #3dd510 100%);
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          filter: drop-shadow(0 0 24px rgba(83,252,24,0.45));
        }
        *:focus { outline: none; }
        *:focus-visible {
          outline: none;
          box-shadow: 0 0 0 2px rgba(83, 252, 24, 0.5), 0 0 12px rgba(83, 252, 24, 0.25);
          border-radius: 4px;
        }
        .link-underline { position: relative; }
        .link-underline::after {
          content: ''; position: absolute; left: 0; bottom: -2px; width: 100%; height: 1px;
          background: #53fc18; transform-origin: right; transform: scaleX(0);
          transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .link-underline:hover::after { transform-origin: left; transform: scaleX(1); }
        ::-webkit-scrollbar { width: 10px; height: 10px; }
        ::-webkit-scrollbar-track { background: rgba(20,20,18,0.4); }
        ::-webkit-scrollbar-thumb {
          background: rgba(83,252,24,0.15);
          border-radius: 999px;
          border: 2px solid transparent;
          background-clip: padding-box;
        }
        ::-webkit-scrollbar-thumb:hover { background: rgba(83,252,24,0.35); background-clip: padding-box; border: 2px solid transparent; }
        ::selection { background: rgba(83,252,24,0.3); color: #fff; }
        .card-lift { transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.3s, box-shadow 0.3s; }
        .card-lift:hover { transform: translateY(-2px); }
      `}</style>

      <div className="grain" />

      {/* Top announcement banner */}
      <button
        onClick={() => goto('home')}
        className="relative z-30 w-full block bg-[#53fc18] text-black hover:bg-[#48e012] group transition-colors"
      >
        <div className="max-w-[1400px] mx-auto px-6 md:px-8 py-2.5 flex items-center justify-center gap-3 text-xs font-medium">
          <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-black/15">
            <span className="w-1.5 h-1.5 rounded-full bg-black animate-pulse-soft" />
          </span>
          <span className="tracking-tight">Cohort 03 opens June 12 — claim your spot</span>
          <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
        </div>
      </button>

      {/* Ambient orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 grid-bg" />
        <div className="absolute -top-40 -left-40 w-[700px] h-[700px] rounded-full bg-[#53fc18]/[0.18] blur-[140px] animate-ambient" />
        <div className="absolute top-[40%] -right-40 w-[600px] h-[600px] rounded-full bg-[#53fc18]/[0.15] blur-[140px] animate-ambient" style={{ animationDelay: '4s' }} />
        <div className="absolute bottom-0 left-[30%] w-[500px] h-[500px] rounded-full bg-[#53fc18]/[0.12] blur-[140px] animate-ambient" style={{ animationDelay: '8s' }} />
      </div>

      {/* Primary nav */}
      <nav className="relative z-20 border-b border-white/[0.06] backdrop-blur-xl bg-black/60 sticky top-0">
        <div className="max-w-[1400px] mx-auto px-6 md:px-8 py-5 flex items-center justify-between animate-fade-in">
          {/* Left cluster: logo + page links */}
          <div className="flex items-center gap-8 lg:gap-10">
            <button onClick={() => handleNav('home')} className="flex items-center gap-3 flex-shrink-0">
              <LogoMark size={32} />
              <span className="serif text-2xl tracking-tight">Clipper<span className="text-[#53fc18]">.ai</span></span>
            </button>

            {/* Desktop nav — visible from md (768px) up */}
            <div className="hidden md:flex items-center gap-0.5 text-sm">
              {navItems.map((item) => (
                <button
                  key={item.k}
                  onClick={() => handleNav(item.k)}
                  className={`relative px-2.5 lg:px-3 py-2 rounded-md hover:bg-[#53fc18]/[0.08] whitespace-nowrap ${page === item.k ? 'text-[#53fc18]' : 'text-stone-400 hover:text-stone-100'}`}
                >
                  {item.l}
                  {page === item.k && (
                    <span className="absolute left-2.5 right-2.5 lg:left-3 lg:right-3 -bottom-[21px] h-px bg-[#53fc18]" style={{ boxShadow: "0 0 8px #53fc18" }} />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Right cluster: auth + CTA + mobile menu */}
          <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
            <button className="hidden lg:block text-sm text-stone-400 hover:text-stone-100 px-3 py-2">Sign in</button>
            <button onClick={openApp} className="group px-3 md:px-4 py-2 rounded-md bg-[#53fc18] text-black text-sm font-medium hover:shadow-[0_0_30px_rgba(83,252,24,0.4)] hover:scale-[1.02] whitespace-nowrap">
              Open Studio
            </button>
            {/* Mobile hamburger — visible below md */}
            <button
              onClick={() => setMobileOpen((v) => !v)}
              className="md:hidden relative w-10 h-10 rounded-md border border-[#53fc18]/[0.12] flex items-center justify-center hover:bg-[#53fc18]/[0.08] hover:border-white/[0.16]"
              aria-label="Menu"
              aria-expanded={mobileOpen}
            >
              <div className="relative w-4 h-4">
                <span
                  className="absolute left-0 right-0 h-px bg-stone-200 origin-center"
                  style={{
                    top: mobileOpen ? '50%' : '25%',
                    transform: mobileOpen ? 'translateY(-50%) rotate(45deg)' : 'translateY(0) rotate(0)',
                    transition: 'top 0.4s cubic-bezier(0.16, 1, 0.3, 1), transform 0.4s cubic-bezier(0.16, 1, 0.3, 1) 0.15s',
                  }}
                />
                <span
                  className="absolute left-0 right-0 h-px bg-stone-200 top-1/2 -translate-y-1/2"
                  style={{
                    opacity: mobileOpen ? 0 : 1,
                    transform: mobileOpen ? 'scaleX(0)' : 'scaleX(1)',
                    transition: 'opacity 0.2s ease, transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                  }}
                />
                <span
                  className="absolute left-0 right-0 h-px bg-stone-200 origin-center"
                  style={{
                    bottom: mobileOpen ? '50%' : '25%',
                    transform: mobileOpen ? 'translateY(50%) rotate(-45deg)' : 'translateY(0) rotate(0)',
                    transition: 'bottom 0.4s cubic-bezier(0.16, 1, 0.3, 1), transform 0.4s cubic-bezier(0.16, 1, 0.3, 1) 0.15s',
                  }}
                />
              </div>
            </button>
          </div>
        </div>

        {/* Mobile menu drawer */}
        <div
          className="md:hidden overflow-hidden border-t border-[#53fc18]/[0.10]"
          style={{
            maxHeight: mobileOpen ? '720px' : '0px',
            opacity: mobileOpen ? 1 : 0,
            transition: mobileOpen
              ? 'max-height 0.6s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.4s ease-out 0.05s'
              : 'max-height 0.5s cubic-bezier(0.7, 0, 0.84, 0), opacity 0.2s ease-out',
          }}
        >
          <div className="px-6 py-6 bg-black/80 backdrop-blur-xl">
            {/* Section header */}
            <div className="text-[10px] mono text-stone-500 tracking-[0.2em] uppercase mb-3 px-2">Navigate</div>
            <div className="flex flex-col gap-0.5 mb-6">
              {navItems.map((item, i) => (
                <button
                  key={item.k}
                  onClick={() => handleNav(item.k)}
                  className={`group flex items-center justify-between px-3 py-3 rounded-md text-left ${
                    page === item.k
                      ? 'text-[#53fc18] bg-[#53fc18]/[0.10]'
                      : 'text-stone-300 hover:bg-[#53fc18]/[0.08] hover:text-stone-100'
                  }`}
                  style={{
                    opacity: mobileOpen ? 1 : 0,
                    transform: mobileOpen ? 'translateX(0)' : 'translateX(-8px)',
                    transition: `opacity 0.5s cubic-bezier(0.16, 1, 0.3, 1) ${mobileOpen ? 0.1 + i * 0.04 : 0}s, transform 0.5s cubic-bezier(0.16, 1, 0.3, 1) ${mobileOpen ? 0.1 + i * 0.04 : 0}s`,
                  }}
                >
                  <span className="text-base">{item.l}</span>
                  <ArrowUpRight className={`w-3.5 h-3.5 ${page === item.k ? 'text-[#53fc18]' : 'text-stone-600 group-hover:text-stone-300'}`} />
                </button>
              ))}
            </div>

            {/* Account section */}
            <div className="text-[10px] mono text-stone-500 tracking-[0.2em] uppercase mb-3 px-2 pt-2 border-t border-[#53fc18]/[0.10]">Account</div>
            <button
              className="w-full flex items-center justify-between px-3 py-3 rounded-md text-left text-stone-300 hover:bg-[#53fc18]/[0.08] hover:text-stone-100"
              style={{
                opacity: mobileOpen ? 1 : 0,
                transform: mobileOpen ? 'translateX(0)' : 'translateX(-8px)',
                transition: `opacity 0.5s cubic-bezier(0.16, 1, 0.3, 1) ${mobileOpen ? 0.4 : 0}s, transform 0.5s cubic-bezier(0.16, 1, 0.3, 1) ${mobileOpen ? 0.4 : 0}s`,
              }}
            >
              <span>Sign in</span>
              <ArrowUpRight className="w-3.5 h-3.5 text-stone-600" />
            </button>

            {/* Status footer in drawer */}
            <div
              className="mt-6 pt-4 border-t border-[#53fc18]/[0.10] flex items-center justify-between text-[10px] mono text-stone-500 tracking-wider uppercase"
              style={{
                opacity: mobileOpen ? 1 : 0,
                transition: `opacity 0.5s ease-out ${mobileOpen ? 0.5 : 0}s`,
              }}
            >
              <div className="flex items-center gap-2">
                <span className="w-1 h-1 rounded-full bg-[#53fc18] animate-pulse-soft" />
                <span>All systems operational</span>
              </div>
              <span>v2.4.1</span>
            </div>
          </div>
        </div>
      </nav>

      {children}

      {/* Footer */}
      <footer className="relative z-10 border-t border-[#53fc18]/[0.10]">
        <div className="max-w-[1400px] mx-auto px-6 md:px-8 py-6 flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Brand + status */}
          <div className="flex items-center gap-2.5">
            <LogoMark size={20} />
            <span className="serif text-base">Clipper<span className="text-[#53fc18]">.ai</span></span>
            <button onClick={() => goto('status')} className="ml-2 flex items-center gap-1.5 text-[10px] mono text-stone-500 tracking-wider uppercase hover:text-[#53fc18]">
              <span className="w-1 h-1 rounded-full bg-[#53fc18] animate-pulse-soft" /> Operational
            </button>
          </div>

          {/* Inline link cluster */}
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
            {[
              ['Product', 'product'],
              ['Pricing', 'pricing'],
              ['Customers', 'customers'],
              ['Changelog', 'changelog'],
              ['Docs', 'docs'],
              ['Status', 'status'],
              ['Company', 'company'],
            ].map(([label, target]) => (
              <button key={label} onClick={() => goto(target)} className="text-stone-400 hover:text-[#53fc18]">
                {label}
              </button>
            ))}
          </div>

          {/* Copyright + compliance — pushed right, collapses below on mobile */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] mono text-stone-500 tracking-wider uppercase">
            <span>© 2026</span>
            <span className="text-stone-700">·</span>
            <span>SOC 2</span>
            <span>GDPR</span>
            <span>ISO 27001</span>
          </div>
        </div>
      </footer>

      <WhatsNew goto={goto} />
    </div>
  );
}

/* ──────────────────────────────────────────────────────────── WHAT'S NEW
   Floating bottom-right widget that surfaces recent changelog updates */
function WhatsNew({ goto }) {
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(false);

  const updates = [
    { ver: 'v2.4.1', date: '3 days ago', title: 'Hook generation v2', tag: 'NEW', desc: 'Better titles and thumbnails — 23% more click-through in our internal tests.' },
    { ver: 'v2.4.0', date: '2 weeks ago', title: 'Approval workflows', tag: 'NEW', desc: 'Multi-stage review with named approvers and Slack handoff.' },
    { ver: 'v2.3.4', date: '3 weeks ago', title: 'Brand kit templates', tag: 'IMPROVED', desc: 'Lock fonts, colors, lower-thirds. Every clip exports on-brand without manual work.' },
  ];

  return (
    <div className="fixed bottom-5 right-5 z-40 print:hidden">
      {!open ? (
        <button
          onClick={() => { setOpen(true); setSeen(true); }}
          className="group relative flex items-center gap-2 px-4 py-2.5 rounded-full border border-[#53fc18]/40 bg-black/80 backdrop-blur hover:border-[#53fc18] hover:bg-[#53fc18]/[0.06]"
          style={{ boxShadow: '0 0 30px -10px rgba(83,252,24,0.5)' }}
        >
          {!seen && (
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="absolute inset-0 rounded-full bg-[#53fc18] animate-ping opacity-70" />
              <span className="relative rounded-full h-3 w-3 bg-[#53fc18]" style={{ boxShadow: '0 0 8px #53fc18' }} />
            </span>
          )}
          <Sparkles className="w-3.5 h-3.5 text-[#53fc18]" />
          <span className="text-xs mono text-stone-200 tracking-wider uppercase">What's new</span>
        </button>
      ) : (
        <div className="w-80 rounded-2xl border border-[#53fc18]/30 bg-black/95 backdrop-blur overflow-hidden animate-blur-in" style={{ boxShadow: '0 0 60px -10px rgba(83,252,24,0.4)' }}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#53fc18]/[0.12] bg-[#53fc18]/[0.02]">
            <div className="flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-[#53fc18]" style={{ filter: 'drop-shadow(0 0 4px #53fc18)' }} />
              <span className="text-[11px] mono text-stone-200 tracking-wider uppercase">What's new</span>
            </div>
            <button onClick={() => setOpen(false)} className="text-stone-500 hover:text-stone-200">
              <X className="w-4 h-4" />
            </button>
          </div>
          {/* Updates list */}
          <div className="divide-y divide-[#53fc18]/[0.08] max-h-96 overflow-y-auto">
            {updates.map((u, i) => (
              <div key={i} className="px-4 py-3 hover:bg-[#53fc18]/[0.03] group">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] mono text-stone-500 tracking-wider">{u.ver}</span>
                    <span className={`text-[9px] mono tracking-wider px-1.5 py-0.5 rounded ${u.tag === 'NEW' ? 'bg-[#53fc18]/15 text-[#53fc18]' : 'bg-stone-800 text-stone-400'}`}>
                      {u.tag}
                    </span>
                  </div>
                  <span className="text-[10px] mono text-stone-600">{u.date}</span>
                </div>
                <div className="text-sm text-stone-200 mb-1">{u.title}</div>
                <div className="text-xs text-stone-500 leading-snug">{u.desc}</div>
              </div>
            ))}
          </div>
          {/* Footer */}
          <button
            onClick={() => { setOpen(false); goto('changelog'); }}
            className="w-full px-4 py-2.5 text-[10px] mono text-[#53fc18] tracking-wider uppercase hover:bg-[#53fc18]/[0.06] flex items-center justify-center gap-1.5 border-t border-[#53fc18]/[0.10]"
          >
            View full changelog <ArrowUpRight className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────── LANDING */
function Landing({ onStart, goto }) {
  return (
    <>
      {/* Hero */}
      <section className="relative z-10 max-w-[1400px] mx-auto px-6 md:px-8 pt-12 md:pt-16 pb-24">
        <NeonGrid />
        <div className="relative max-w-5xl">
          <div className="inline-flex items-center gap-2.5 px-3 py-1.5 rounded-full border border-[#53fc18]/[0.12] bg-[#53fc18]/[0.015] backdrop-blur text-[11px] mono text-stone-300 mb-6 animate-blur-in cursor-pointer hover:border-[#53fc18]/30" style={{ animationDelay: '0.1s' }} onClick={() => goto('changelog')}>
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inset-0 rounded-full bg-[#53fc18] animate-ping opacity-60" />
              <span className="relative rounded-full h-1.5 w-1.5 bg-[#53fc18]" />
            </span>
            <span className="tracking-wider uppercase">Cohort 03 — Early access opens June 12</span>
            <ArrowUpRight className="w-3 h-3" />
          </div>

          <h1 className="serif leading-[0.88] tracking-tight mb-8 animate-blur-in" style={{ animationDelay: '0.2s', fontSize: 'clamp(4rem, 14vw, 13rem)' }}>
            Long videos in.<br />
            <span className="italic gradient-green">Viral clips</span>
            <span className="text-stone-600"> </span>
            out.
          </h1>

          <p className="text-lg md:text-xl text-stone-400 max-w-2xl leading-relaxed mb-10 animate-blur-in" style={{ animationDelay: '0.4s' }}>
            Clipper.ai ingests your podcasts, webinars, and long-form content and returns ranked, captioned, platform-ready short clips. Built on a six-model pipeline for media teams that ship every day.
          </p>

          <div className="flex flex-wrap items-center gap-3 animate-blur-in" style={{ animationDelay: '0.55s' }}>
            <button onClick={onStart} className="group px-7 py-4 rounded-md bg-[#53fc18] text-black font-medium flex items-center gap-2 hover:shadow-[0_0_50px_rgba(83,252,24,0.5)] hover:scale-[1.02]">
              Try the Studio
              <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </button>
            <button onClick={() => goto('pricing')} className="px-7 py-4 rounded-md border border-white/[0.12] text-stone-200 font-medium hover:bg-[#53fc18]/[0.08] hover:border-white/[0.2]">
              See pricing
            </button>
            <div className="ml-3 text-xs mono text-stone-500 hidden md:block">
              No card required · 60-min free tier
            </div>
          </div>
        </div>

        {/* Hero Visual */}
        <div className="mt-14 animate-blur-in" style={{ animationDelay: '0.7s' }}>
          <HeroVisual />
        </div>

        {/* Telemetry */}
        <div className="mt-8 animate-blur-in" style={{ animationDelay: '0.9s' }}>
          <div className="rounded-2xl border border-[#53fc18]/[0.12] bg-gradient-to-b from-white/[0.02] to-transparent backdrop-blur overflow-hidden">
            <div className="border-b border-white/[0.06] px-6 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-[10px] mono text-stone-500 tracking-wider uppercase">
                <span className="w-1 h-1 rounded-full bg-[#53fc18]" />
                Pre-launch · Cohort 03 metrics
              </div>
              <div className="text-[10px] mono text-stone-600 tracking-wider">EDGE-SFO-01 · v2.4.1</div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-[#53fc18]/[0.10]">
              {[
                { l: 'On the waitlist', v: '2,847', d: '+34 today' },
                { l: 'Beta testers', v: '14', d: 'design partners' },
                { l: 'Pipeline latency', v: '<300', d: 'ms · p50' },
                { l: 'Cohort opens', v: 'Jun 12', d: '200 seats · 2026' },
              ].map((m) => (
                <div key={m.l} className="p-6 relative overflow-hidden group">
                  <div className="text-[10px] mono text-stone-500 tracking-wider uppercase mb-2">{m.l}</div>
                  <div className="serif text-5xl tracking-tight mb-2">{m.v}</div>
                  <div className="text-xs mono text-stone-400 flex items-center gap-1.5">
                    <span className="text-[#53fc18]">↑</span>{m.d}
                  </div>
                  <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[#53fc18]/50 to-transparent opacity-0 group-hover:opacity-100" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <ProductDemoReel openApp={onStart} />

      <InteractiveDemo openApp={onStart} />

      <LiveTicker />

      {/* Marquee */}
      <section className="relative z-10 py-12 border-y border-[#53fc18]/[0.10] overflow-hidden">
        <Reveal>
          <div className="text-[10px] mono text-stone-500 tracking-[0.2em] uppercase text-center mb-8 flex items-center justify-center gap-2">
            <span className="w-1 h-1 rounded-full bg-[#53fc18] animate-pulse-soft" />
            Trusted by media teams shipping daily
            <span className="w-1 h-1 rounded-full bg-[#53fc18] animate-pulse-soft" />
          </div>
        </Reveal>
        <div className="relative">
          <div className="flex gap-16 whitespace-nowrap" style={{ animation: 'marquee 40s linear infinite', width: 'max-content' }}>
            {[...Array(2)].map((_, dup) => (
              <div key={dup} className="flex gap-16 items-center">
                {[
                  { name: 'Lattice Media', metric: '14× clips/wk' },
                  { name: 'Northwind', metric: '+38% reach' },
                  { name: 'Folio Studios', metric: '47 shows' },
                  { name: 'Quartz Labs', metric: '11M views/mo' },
                  { name: 'Compass Pod', metric: '2.1M listeners' },
                  { name: 'Meridian', metric: '8.4× output' },
                  { name: 'Apex Audio', metric: '94 virality' },
                  { name: 'Beacon FM', metric: '320 episodes' },
                  { name: 'Halo Network', metric: '24× clips/wk' },
                ].map((c) => (
                  <div key={c.name + dup} className="group relative cursor-pointer">
                    <div className="serif text-3xl text-stone-500 group-hover:text-[#53fc18] transition-colors" style={{ transition: 'color 0.3s, text-shadow 0.3s' }}>
                      {c.name}
                    </div>
                    <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[9px] mono text-[#53fc18] tracking-wider whitespace-nowrap opacity-0 group-hover:opacity-100">
                      {c.metric}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div className="absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-black to-transparent" />
          <div className="absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-black to-transparent" />
        </div>
      </section>

      {/* Global Network */}
      <section className="relative z-10 max-w-[1400px] mx-auto px-8 py-16 border-t border-[#53fc18]/[0.10]">
        <Reveal>
          <div className="grid md:grid-cols-[1fr_1.6fr] gap-12 items-center">
            <div>
              <div className="text-[10px] mono text-[#53fc18] mb-4 tracking-[0.2em] uppercase flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[#53fc18]" style={{ boxShadow: "0 0 8px #53fc18" }} /> Global infrastructure</div>
              <h2 className="serif text-5xl leading-[1.05] mb-4">
                One edge node away. <span className="italic gradient-green">From anywhere.</span>
              </h2>
              <p className="text-stone-400 leading-relaxed mb-8">
                Six live regions, two more rolling out in Q3. Upload from anywhere, render at the edge closest to your team. p50 latency stays under 50ms regardless of source location.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="serif text-4xl text-[#53fc18] leading-none mb-1">47ms</div>
                  <div className="text-[10px] mono text-stone-500 tracking-wider uppercase">Global p50</div>
                </div>
                <div>
                  <div className="serif text-4xl leading-none mb-1">99.97%</div>
                  <div className="text-[10px] mono text-stone-500 tracking-wider uppercase">Uptime · 90d</div>
                </div>
              </div>
            </div>
            <GlobalMap />
          </div>
        </Reveal>
      </section>

      {/* Live Virality Metrics */}
      <section className="relative z-10 max-w-[1400px] mx-auto px-6 md:px-8 py-12 border-t border-[#53fc18]/[0.10]">
        <Reveal>
          <div className="mb-8">
            <div className="text-[10px] mono text-[#53fc18] mb-4 tracking-[0.2em] uppercase flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[#53fc18]" style={{ boxShadow: "0 0 8px #53fc18" }} /> Live across the network</div>
            <h2 className="serif text-4xl md:text-5xl leading-[1.05] mb-4">
              What's <span className="italic gradient-green">scoring right now.</span>
            </h2>
            <p className="text-stone-400 leading-relaxed max-w-xl mb-6">
              Real-time distribution of virality scores across every clip processed in the last 24 hours. The brighter the bar, the higher the predicted reach.
            </p>
            <div>
              <div className="serif text-5xl text-[#53fc18] leading-none" style={{ textShadow: '0 0 30px rgba(83,252,24,0.5)' }}>94</div>
              <div className="text-[10px] mono text-stone-500 tracking-wider uppercase mt-2">Peak score · 24h</div>
              <div className="text-[10px] mono text-stone-500 tracking-wider uppercase mt-2">
                <span className="text-[#53fc18]">↑ 12 clips</span> scoring 90+
              </div>
            </div>
          </div>
          <ViralityChart />
        </Reveal>
      </section>

      {/* Pipeline */}
      <section className="relative z-10 max-w-[1400px] mx-auto px-8 py-12">
        <div className="grid md:grid-cols-[1fr_1.4fr] gap-20 items-start">
          <Reveal>
            <div className="md:sticky md:top-32">
              <div className="text-[10px] mono text-[#53fc18] mb-4 tracking-[0.2em] uppercase flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[#53fc18]" style={{ boxShadow: "0 0 8px #53fc18" }} /> How it works</div>
              <h2 className="serif text-6xl leading-[1.02] tracking-tight mb-8">
                Six models.<br />One pipeline.<br />
                <span className="italic text-stone-500">Zero busywork.</span>
              </h2>
              <p className="text-stone-400 leading-relaxed mb-6 text-lg">
                Upload once. The pipeline transcribes, segments by topic, scores emotional peaks, evaluates visual framing, ranks virality, and renders captioned exports — all before your coffee gets cold.
              </p>
              <button onClick={() => goto('product')} className="text-sm text-stone-300 hover:text-[#53fc18] flex items-center gap-2 group">
                Read the technical brief
                <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </button>
            </div>
          </Reveal>

          <div className="space-y-2">
            {[
              { n: '01', t: 'Whisper-Large transcription', d: 'Word-level timestamps and speaker diarization, multilingual.', ms: '~2.4s/min', p50: 47, model: 'WHISPER-LARGE-V3' },
              { n: '02', t: 'Topic segmentation', d: 'GPT-4 identifies self-contained narrative beats and natural cut points.', ms: '~1.1s/min', p50: 38, model: 'GPT-4-TURBO' },
              { n: '03', t: 'Virality scoring', d: 'GPT-4 prompted with a structured rubric — hook strength, self-containment, emotional intensity, quotability.', ms: '~0.8s/clip', p50: 64, model: 'GPT-4-TURBO' },
              { n: '04', t: 'Auto-reframe & captioning', d: 'Vertical, square, horizontal — all rendered with platform-native captions.', ms: '~3.2s/clip', p50: 124, model: 'FFMPEG + WHISPER' },
              { n: '05', t: 'Hook & CTA generation', d: 'A/B-ready titles, descriptions, and thumbnails per platform.', ms: '~0.4s/clip', p50: 22, model: 'GPT-4-TURBO' },
            ].map((s, i) => (
              <Reveal key={s.n} delay={i * 80}>
                <div className="group flex gap-6 p-6 rounded-xl border border-[#53fc18]/[0.08] hover:border-[#53fc18]/30 hover:bg-[#53fc18]/[0.015] cursor-pointer">
                  <div className="mono text-xs text-stone-600 group-hover:text-[#53fc18] mt-1 w-8">{s.n}</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1.5">
                      <div className="font-medium text-base">{s.t}</div>
                      <div className="text-[9px] mono text-stone-600 group-hover:text-[#53fc18] tracking-wider px-1.5 py-0.5 rounded border border-[#53fc18]/[0.10] group-hover:border-[#53fc18]/30">{s.model}</div>
                    </div>
                    <div className="text-sm text-stone-400 leading-relaxed mb-2">{s.d}</div>
                    {/* Latency bar */}
                    <div className="flex items-center gap-2 mt-3">
                      <div className="flex-1 h-1 rounded-full bg-stone-900 overflow-hidden max-w-[180px]">
                        <div className="h-full rounded-full bg-gradient-to-r from-[#53fc18]/40 to-[#53fc18]" style={{ width: `${Math.min(s.p50 / 1.5, 100)}%`, boxShadow: '0 0 8px rgba(83,252,24,0.5)' }} />
                      </div>
                      <span className="text-[9px] mono text-stone-500 tracking-wider">P50 · {s.p50}MS</span>
                    </div>
                  </div>
                  <div className="mono text-[10px] text-stone-600 group-hover:text-stone-400 mt-1 whitespace-nowrap">{s.ms}</div>
                </div>
              </Reveal>
            ))}

            {/* Total budget footer */}
            <Reveal delay={520}>
              <div className="mt-6 p-6 rounded-xl border border-[#53fc18]/30 bg-gradient-to-r from-[#53fc18]/[0.04] to-transparent flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="serif text-3xl text-[#53fc18] leading-none" style={{ textShadow: '0 0 16px rgba(83,252,24,0.5)' }}>295<span className="text-lg ml-1">ms</span></div>
                  <div>
                    <div className="text-sm text-stone-200">Total p50 latency budget</div>
                    <div className="text-[10px] mono text-stone-500 tracking-wider uppercase mt-0.5">Pipeline end-to-end · per clip</div>
                  </div>
                </div>
                <div className="text-right hidden md:block">
                  <div className="text-[10px] mono text-stone-500 tracking-wider uppercase">SLA target</div>
                  <div className="text-[#53fc18] mono text-sm">≤ 500ms · 99.9%</div>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      <WallOfLove />

      <TrustStrip />

      <FounderNote />

      <Waitlist />

      <FAQ />

      {/* CTA */}
      <section className="relative z-10 max-w-[1400px] mx-auto px-6 md:px-8 pt-12 pb-12 border-t border-[#53fc18]/[0.10] mt-4">
        <Reveal>
          <div className="text-center max-w-3xl mx-auto">
            <div className="text-[10px] mono text-[#53fc18] mb-4 tracking-[0.2em] uppercase flex items-center justify-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[#53fc18]" style={{ boxShadow: "0 0 8px #53fc18" }} /> Ready when you are</div>
            <h2 className="serif text-5xl md:text-6xl leading-[1.05] mb-4">
              Ship clips at the<br />
              <span className="italic gradient-green">speed of attention.</span>
            </h2>
            <p className="text-stone-400 leading-relaxed">
              Free for the first 60 minutes of upload. No card. No setup.
            </p>
          </div>
        </Reveal>
      </section>
    </>
  );
}

/* ──────────────────────────────────────────────────────────── PAGE HELPERS */
function PageHero({ eyebrow, title, italic, sub }) {
  return (
    <section className="relative z-10 max-w-[1400px] mx-auto px-6 md:px-8 pt-16 md:pt-24 pb-16 md:pb-20 animate-blur-in overflow-hidden">
      <NeonGrid />
      <div className="relative max-w-4xl">
        <div className="flex items-center gap-2 mb-6">
          <span className="w-6 h-px bg-[#53fc18]" style={{ boxShadow: "0 0 8px rgba(83,252,24,0.6)" }} />
          <span className="text-[10px] mono text-[#53fc18] tracking-[0.2em] uppercase">{eyebrow}</span>
        </div>
        <h1 className="serif text-5xl md:text-7xl leading-[1.02] mb-6">
          {title} <span className="italic gradient-green">{italic}</span>
        </h1>
        <p className="text-lg md:text-xl text-stone-400 max-w-2xl leading-relaxed">{sub}</p>
      </div>
    </section>
  );
}

/* ──────────────────────────────────────────────────────────── PRODUCT */
function ProductPage({ goto, openApp }) {
  const features = [
    { icon: Mic, t: 'Whisper-Large transcription', d: 'Word-level timestamps and speaker diarization across 99 languages. Domain-tuned for podcasts, interviews, and lectures.' },
    { icon: Workflow, t: 'Topic segmentation', d: 'GPT-4 identifies self-contained narrative beats. We never cut mid-thought — every clip stands alone.' },
    { icon: TrendingUp, t: 'Virality scoring', d: 'A structured rubric — hook strength, self-containment, emotional intensity, quotability — applied by a state-of-the-art LLM with clip-level reasoning you can read.' },
    { icon: Film, t: 'Auto-reframe & captioning', d: 'Vertical (9:16), square (1:1), horizontal (16:9) — all rendered with platform-native caption styling and animation.' },
    { icon: Sparkles, t: 'Hook & CTA generation', d: 'A/B-ready titles, descriptions, thumbnails, and call-to-action variants tuned per destination platform.' },
    { icon: Layers, t: 'Brand kit & templates', d: 'Lock fonts, colors, lower-thirds, intros, and outros. Every clip exports on-brand without manual work.' },
    { icon: GitBranch, t: 'Workflows & approvals', d: 'Reviewer roles, comment threads, version history, and one-click publishing to TikTok, YouTube, X, LinkedIn, and Reels.' },
  ];
  return (
    <>
      <PageHero eyebrow="Product" title="The clip pipeline" italic="built for scale." sub="Every model in the stack is tuned for one thing: clips that ship, perform, and compound." />

      <section className="relative z-10 max-w-[1400px] mx-auto px-8 py-12">
        <div className="grid md:grid-cols-2 gap-3">
          {features.map((f, i) => (
            <Reveal key={f.t} delay={i * 60}>
              <div className="group p-8 rounded-xl border border-[#53fc18]/[0.08] hover:border-[#53fc18]/30 hover:bg-[#53fc18]/[0.015] h-full">
                <div className="w-10 h-10 rounded-md border border-[#53fc18]/[0.12] flex items-center justify-center mb-5 group-hover:border-[#53fc18]/40 group-hover:bg-[#53fc18]/5">
                  <f.icon className="w-4 h-4 text-stone-400 group-hover:text-[#53fc18]" />
                </div>
                <div className="font-medium mb-2 text-lg">{f.t}</div>
                <div className="text-sm text-stone-400 leading-relaxed">{f.d}</div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="relative z-10 max-w-[1400px] mx-auto px-8 py-16 border-t border-[#53fc18]/[0.10]">
        <Reveal>
          <div className="grid md:grid-cols-[1fr_1.2fr] gap-16">
            <div>
              <div className="text-[10px] mono text-[#53fc18] mb-4 tracking-[0.2em] uppercase flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[#53fc18]" style={{ boxShadow: "0 0 8px #53fc18" }} /> The pipeline</div>
              <h2 className="serif text-5xl leading-[1.05] tracking-tight mb-6">From upload to publish in <span className="italic text-[#53fc18]">under 90 seconds.</span></h2>
              <p className="text-stone-400 leading-relaxed text-lg">An end-to-end render of a 60-minute podcast finishes before you finish reading this section.</p>
            </div>
            <div className="rounded-2xl border border-[#53fc18]/[0.12] bg-black/40 backdrop-blur overflow-hidden">
              <div className="border-b border-white/[0.06] px-5 py-3 text-[10px] mono text-stone-500 tracking-wider uppercase flex items-center justify-between">
                <span>Latency Budget · p50</span>
                <span className="text-[#53fc18]">94.2% under SLA</span>
              </div>
              <div className="divide-y divide-[#53fc18]/[0.08]">
                {[
                  ['Transcription', '14.4s', 60],
                  ['Topic segmentation', '6.6s', 28],
                  ['Virality scoring', '4.8s', 20],
                  ['Reframe & caption render', '38.4s', 100],
                  ['Hook generation', '2.4s', 10],
                ].map(([label, time, width]) => (
                  <div key={label} className="px-5 py-4 flex items-center gap-4">
                    <div className="text-sm flex-1">{label}</div>
                    <div className="w-40 h-1 rounded-full bg-white/[0.05] overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-[#53fc18]/40 to-[#53fc18]" style={{ width: `${width}%` }} />
                    </div>
                    <div className="mono text-xs text-stone-400 w-16 text-right">{time}</div>
                  </div>
                ))}
              </div>
              <div className="border-t border-[#53fc18]/[0.10] px-5 py-3 flex items-center justify-between text-xs">
                <span className="mono text-stone-500">Total p50</span>
                <span className="serif text-2xl text-[#53fc18]">67.8s</span>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      <IntegrationsStrip />

      <ClipPreviewPlayer />

      {/* Studio preview */}
      <section className="relative z-10 max-w-[1400px] mx-auto px-8 py-16 border-t border-[#53fc18]/[0.10]">
        <Reveal>
          <div className="text-center mb-8">
            <div className="text-[10px] mono text-[#53fc18] mb-4 tracking-[0.2em] uppercase flex items-center justify-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[#53fc18]" style={{ boxShadow: "0 0 8px #53fc18" }} /> The Studio</div>
            <h2 className="serif text-5xl leading-[1.05] mb-4">
              Built for editors. <span className="italic gradient-green">Loved by editors.</span>
            </h2>
            <p className="text-stone-400 leading-relaxed max-w-2xl mx-auto">
              The interface that runs the pipeline. Quick to learn, hard to outgrow. Keyboard-first, dense without being cluttered.
            </p>
          </div>
          <StudioMockup />
        </Reveal>
      </section>

      <CTABand goto={goto} openApp={openApp} />
    </>
  );
}

/* ──────────────────────────────────────────────────────────── PRICING */
function PricingPage({ goto, openApp }) {
  const [billing, setBilling] = useState('monthly'); // 'monthly' | 'annual'

  const tiers = [
    { name: 'Starter', priceM: 0, priceA: 0, sub: 'forever free', minutes: '60 min/mo', popular: false, features: ['60 minutes of upload', 'All 5 pipeline models', '720p exports', 'Watermarked clips', 'Community support'] },
    { name: 'Studio', priceM: 49, priceA: 39, sub: 'per editor / month', minutes: '1,000 min/mo', popular: true, features: ['1,000 minutes of upload', 'All 5 pipeline models', '4K exports, no watermark', 'Brand kit & templates', 'Approval workflows', 'Priority support'] },
    { name: 'Scale', priceM: 249, priceA: 199, sub: 'per editor / month', minutes: '10,000 min/mo', popular: false, features: ['10,000 minutes of upload', 'Everything in Studio', 'API access (10k req/day)', 'Custom virality model tuning', 'SSO + audit logs', 'Dedicated CSM', '99.9% SLA'] },
    { name: 'Enterprise', priceM: null, priceA: null, sub: 'volume pricing', minutes: 'Unlimited', popular: false, features: ['Custom upload volume', 'On-prem & VPC deployment', 'Custom model training', 'SOC 2 + DPA', '24/7 white-glove support', 'Multi-org admin'] },
  ];

  const formatPrice = (t) => {
    if (t.priceM === null) return 'Custom';
    const p = billing === 'annual' ? t.priceA : t.priceM;
    return p === 0 ? '$0' : `$${p}`;
  };

  return (
    <>
      <PageHero eyebrow="Pricing" title="Volume" italic="that scales with you." sub="Usage-metered by upload minutes. No per-seat penalty. Cancel any time. Start free." />

      {/* Billing toggle */}
      <section className="relative z-10 max-w-[1400px] mx-auto px-8 pt-4">
        <div className="flex items-center justify-center gap-3">
          <div className="inline-flex items-center gap-1 p-1 rounded-full border border-[#53fc18]/20 bg-black/40">
            <button
              onClick={() => setBilling('monthly')}
              className={`px-5 py-2 rounded-full text-xs mono tracking-wider uppercase ${billing === 'monthly' ? 'text-black' : 'text-stone-400 hover:text-stone-200'}`}
              style={billing === 'monthly' ? { backgroundColor: '#53fc18', boxShadow: '0 0 20px rgba(83,252,24,0.4)' } : {}}
            >
              Monthly
            </button>
            <button
              onClick={() => setBilling('annual')}
              className={`px-5 py-2 rounded-full text-xs mono tracking-wider uppercase flex items-center gap-2 ${billing === 'annual' ? 'text-black' : 'text-stone-400 hover:text-stone-200'}`}
              style={billing === 'annual' ? { backgroundColor: '#53fc18', boxShadow: '0 0 20px rgba(83,252,24,0.4)' } : {}}
            >
              Annual
              <span className={`text-[9px] px-1.5 py-0.5 rounded ${billing === 'annual' ? 'bg-black/20 text-black' : 'bg-[#53fc18]/20 text-[#53fc18]'}`}>
                −20%
              </span>
            </button>
          </div>
        </div>
      </section>

      <section className="relative z-10 max-w-[1400px] mx-auto px-8 py-12 pt-10">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {tiers.map((t, i) => (
            <Reveal key={t.name} delay={i * 80}>
              <div className={`relative rounded-2xl border h-full flex flex-col transition-all ${t.popular ? 'border-[#53fc18]/50 bg-gradient-to-b from-[#53fc18]/[0.06] via-[#53fc18]/[0.02] to-transparent shadow-[0_0_60px_-12px_rgba(83,252,24,0.45)] md:scale-[1.02]' : 'border-[#53fc18]/[0.10] bg-[#53fc18]/[0.01] hover:border-[#53fc18]/20'}`}>
                {/* Most popular badge — layered, animated shimmer */}
                {t.popular && (
                  <>
                    {/* Halo glow behind card */}
                    <div className="absolute -inset-px rounded-2xl pointer-events-none" style={{ background: 'radial-gradient(ellipse at top, rgba(83,252,24,0.12), transparent 60%)' }} />

                    {/* Badge */}
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-20">
                      <div className="relative px-3.5 py-1.5 rounded-full bg-gradient-to-b from-[#aaff66] to-[#53fc18] text-black overflow-hidden" style={{ boxShadow: '0 4px 24px -4px rgba(83,252,24,0.6), inset 0 1px 0 rgba(255,255,255,0.4), inset 0 -1px 0 rgba(0,0,0,0.15)' }}>
                        {/* Shimmer sweep */}
                        <div className="absolute inset-0 opacity-50" style={{
                          background: 'linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.5) 50%, transparent 70%)',
                          backgroundSize: '200% 100%',
                          animation: 'shimmer 3s ease-in-out infinite',
                        }} />
                        <div className="relative flex items-center gap-1.5">
                          <span className="text-[8px] mono font-bold tracking-[0.2em] uppercase">★ Most popular</span>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                <div className="p-8 flex flex-col flex-1">
                  <div className="flex items-baseline justify-between mb-4">
                    <div className="text-[10px] mono text-stone-500 tracking-wider uppercase">{t.name}</div>
                    <div className="text-[10px] mono text-[#53fc18] tracking-wider">{t.minutes}</div>
                  </div>
                  <div className="flex items-baseline gap-1 mb-1">
                    <span className="serif text-5xl tracking-tight leading-none">{formatPrice(t)}</span>
                    {t.priceM !== null && t.priceM > 0 && (
                      <span className="text-xs mono text-stone-500">/ mo</span>
                    )}
                  </div>
                  <div className="text-xs mono text-stone-500 mb-1 min-h-[16px]">{t.sub}</div>
                  {billing === 'annual' && t.priceM !== null && t.priceM > 0 && (
                    <div className="text-[10px] mono text-[#53fc18] tracking-wider uppercase mb-6">
                      Save ${(t.priceM - t.priceA) * 12}/yr
                    </div>
                  )}
                  {(billing === 'monthly' || t.priceM === null || t.priceM === 0) && (
                    <div className="mb-6 min-h-[16px]"></div>
                  )}

                  <ul className="space-y-3 mb-6">
                    {t.features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5 text-sm text-stone-300">
                        <Check className="w-4 h-4 text-[#53fc18] mt-0.5 flex-shrink-0" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>

                  <button
                    onClick={openApp}
                    className="w-full py-3 rounded-md font-medium text-sm mt-auto flex items-center justify-center focus:outline-none"
                    style={{
                      backgroundColor: 'rgba(83,252,24,0.06)',
                      color: '#e7e5e4',
                      border: '1px solid rgba(83,252,24,0.3)',
                    }}
                  >
                    {t.priceM === null ? 'Contact sales' : t.priceM === 0 ? 'Start free' : 'Start free trial'}
                  </button>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="relative z-10 max-w-[1400px] mx-auto px-8 py-16 border-t border-[#53fc18]/[0.10]">
        <Reveal>
          <div className="text-[10px] mono text-[#53fc18] mb-4 tracking-[0.2em] uppercase flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[#53fc18]" style={{ boxShadow: "0 0 8px #53fc18" }} /> Compare in detail</div>
          <h2 className="serif text-5xl leading-tight tracking-tight mb-6">All the answers, on one page.</h2>
        </Reveal>
        <div className="rounded-2xl border border-[#53fc18]/[0.08] overflow-hidden">
          {[
            ['Upload minutes / mo', '60', '1,000', '10,000', 'Unlimited'],
            ['Pipeline models', 'All 5', 'All 5', 'All 5 + custom tuning', 'All + custom training'],
            ['Export quality', '720p watermarked', '4K, no watermark', '4K, no watermark', '4K + raw frames'],
            ['Team seats', '1', 'Unlimited', 'Unlimited', 'Unlimited + SSO'],
            ['API access', '—', '—', '10k req/day', 'Custom'],
            ['Support', 'Community', 'Priority', 'Dedicated CSM', '24/7 white-glove'],
            ['SLA', '—', '—', '99.9%', '99.99% custom'],
          ].map((row, i) => (
            <Reveal key={row[0]} delay={i * 40}>
              <div className={`grid grid-cols-5 px-6 py-4 text-sm ${i % 2 === 0 ? 'bg-[#53fc18]/[0.015]' : ''}`}>
                <div className="text-stone-300 font-medium">{row[0]}</div>
                {row.slice(1).map((cell, j) => (
                  <div key={j} className="text-stone-400 mono text-xs flex items-center">{cell}</div>
                ))}
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <ROICalculator />

      {/* Pricing FAQ — specific to billing questions */}
      <section className="relative z-10 max-w-[1100px] mx-auto px-8 py-20 border-t border-[#53fc18]/[0.10]">
        <Reveal>
          <div className="text-[10px] mono text-[#53fc18] mb-4 tracking-[0.2em] uppercase flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#53fc18]" style={{ boxShadow: '0 0 8px #53fc18' }} />
            Pricing questions
          </div>
          <h2 className="serif text-4xl md:text-5xl leading-[1.05] mb-12">
            The fine print, <span className="italic gradient-green">unprinted.</span>
          </h2>
        </Reveal>

        <div className="space-y-3">
          {[
            {
              q: 'What counts as a minute?',
              a: 'Upload minutes — the duration of the source video you submit, not output. A 60-minute podcast counts as 60 minutes, even if Clipper.ai produces a dozen 45-second clips from it. We never bill on output, exports, or downloads.'
            },
            {
              q: 'What happens if I exceed my plan?',
              a: 'We notify you at 80% and 95% of your monthly allowance. Past 100%, additional minutes are billed at $0.08 / min on Studio and $0.05 / min on Scale — no overage surprises. You can also pause uploads until the next cycle.'
            },
            {
              q: 'Can I switch plans mid-cycle?',
              a: 'Yes — upgrades take effect immediately and we prorate the difference. Downgrades apply at the start of your next billing cycle so you keep what you already paid for.'
            },
            {
              q: 'Do you offer annual billing discounts?',
              a: 'Annual saves 20% across Studio and Scale. Charged once upfront, refundable on a pro-rated basis if you cancel within the first 60 days.'
            },
            {
              q: 'What is your refund policy?',
              a: '30-day full refund on any paid plan, no questions asked. After 30 days, annual plans are refundable pro-rated through day 60; monthly plans don\'t refund partial months but you can cancel any time to stop future billing.'
            },
            {
              q: 'Is the free tier really free forever?',
              a: 'Yes. 60 minutes per month, all 5 pipeline models, 720p exports with a small watermark. No credit card required, no time limit, no nag screens. It exists because we want you to test the product on real footage before you decide.'
            },
            {
              q: 'Do you offer discounts for non-profits, education, or open-source?',
              a: 'Yes — 50% off Studio for verified non-profits, accredited educational institutions, and maintainers of open-source projects with 1k+ GitHub stars. Email hello@clipper.ai with proof.'
            },
            {
              q: 'How does Enterprise pricing work?',
              a: 'Custom volume pricing based on monthly upload minutes, deployment requirements (cloud, VPC, on-prem), and support tier. Typical Enterprise contracts start at $30k / year. Book a call and we\'ll quote within 48 hours.'
            },
          ].map((item, i) => (
            <FAQItem key={i} q={item.q} a={item.a} />
          ))}
        </div>
      </section>

      <CTABand goto={goto} openApp={openApp} />
    </>
  );
}

/* ──────────────────────────────────────────────────────────── CUSTOMERS */
function CustomersPage({ goto, openApp }) {
  const stories = [
    { logo: 'Lattice Media', author: 'Sara Okafor', role: 'Head of Content', metric: '14×', metricL: 'clip output / week', quote: 'Clipper.ai turned our two-editor team into a publishing machine. We went from shipping six clips a week to eighty-four — and engagement per clip went up, not down.', tags: ['Podcast network', '4M listeners'], spark: [6, 7, 9, 11, 18, 24, 41, 58, 72, 84], trend: 'CLIPS / WEEK · 10W' },
    { logo: 'Northwind', author: 'Daniel Reyes', role: 'VP Marketing', metric: '38%', metricL: 'lift on TikTok views', quote: 'The virality scoring is the unfair advantage. We surface the best 30 seconds of every CFO interview the same day we record — and the model has been right about which clips land more often than our seasoned editor.', tags: ['Finance media', '12M monthly'], spark: [100, 102, 98, 105, 112, 119, 124, 131, 135, 138], trend: 'AVG VIEWS · INDEXED' },
    { logo: 'Folio Studios', author: 'Mira Tanaka', role: 'Director, Social', metric: '3.2 days', metricL: 'saved per episode', quote: 'The hook generation alone justifies the spend. But the auto-reframe is what got my editors to actually use it — they stopped fighting the tool and started shipping.', tags: ['Indie network', '47 shows'], spark: [5.1, 5.0, 4.8, 4.4, 4.0, 3.7, 3.5, 3.4, 3.3, 3.2], trend: 'DAYS / EPISODE · 10W' },
  ];
  return (
    <>
      <PageHero eyebrow="Customers" title="Built by the teams" italic="that ship every day." sub="From indie podcasts to public-facing media networks, Clipper.ai powers the workflows behind some of the fastest-growing short-form channels online." />

      <section className="relative z-10 max-w-[1400px] mx-auto px-8 py-12 space-y-4">
        {stories.map((s, i) => (
          <Reveal key={s.logo} delay={i * 100}>
            <div className="grid md:grid-cols-[1fr_1.4fr] gap-8 p-10 rounded-2xl border border-[#53fc18]/[0.08] hover:border-[#53fc18]/20 hover:bg-[#53fc18]/[0.01]">
              <div>
                <div className="serif text-3xl mb-2">{s.logo}</div>
                <div className="flex flex-wrap gap-2 mb-6">
                  {s.tags.map((t) => (
                    <span key={t} className="px-2.5 py-1 rounded-full border border-[#53fc18]/[0.12] text-[10px] mono text-stone-400 tracking-wider uppercase">{t}</span>
                  ))}
                </div>
                <div className="serif text-7xl text-[#53fc18] text-glow leading-none mb-1">{s.metric}</div>
                <div className="text-xs mono text-stone-500 tracking-wider uppercase mb-4">{s.metricL}</div>
                {/* Sparkline chart */}
                <Sparkline data={s.spark} label={s.trend} />
              </div>
              <div>
                <Quote className="w-6 h-6 text-[#53fc18]/40 mb-4" />
                <p className="serif italic text-2xl leading-relaxed text-stone-200 mb-6">"{s.quote}"</p>
                <div className="flex items-center gap-3">
                  <Avatar seed={s.author} size={40} />
                  <div>
                    <div className="text-sm font-medium">{s.author}</div>
                    <div className="text-xs mono text-stone-500">{s.role} · {s.logo}</div>
                  </div>
                </div>
              </div>
            </div>
          </Reveal>
        ))}
      </section>

      <section className="relative z-10 max-w-[1400px] mx-auto px-8 py-12 border-t border-[#53fc18]/[0.10]">
        <Reveal>
          <div className="text-[10px] mono text-[#53fc18] mb-4 tracking-[0.2em] uppercase flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[#53fc18]" style={{ boxShadow: "0 0 8px #53fc18" }} /> Across the network</div>
          <h2 className="serif text-5xl leading-tight tracking-tight mb-6">4,208 teams. 11M clips. Counting.</h2>
        </Reveal>
        <div className="grid md:grid-cols-4 gap-4">
          {[
            { m: '11.2M', l: 'clips generated' },
            { m: '4,208', l: 'media teams' },
            { m: '94.2%', l: 'virality accuracy' },
            { m: '2.4M', l: 'hours processed' },
          ].map((s, i) => (
            <Reveal key={s.l} delay={i * 60}>
              <div className="p-8 rounded-xl border border-[#53fc18]/[0.08]">
                <div className="serif text-6xl tracking-tight mb-2">{s.m}</div>
                <div className="text-xs mono text-stone-500 tracking-wider uppercase">{s.l}</div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <CTABand goto={goto} openApp={openApp} />
    </>
  );
}

/* ──────────────────────────────────────────────────────────── CHANGELOG */
function ChangelogPage({ goto }) {
  const entries = [
    { v: '2.4.1', d: 'May 15, 2026', tag: 'Improvement', title: 'Virality scoring model v3', body: 'Scoring now uses 6-hour rolling context rather than 1-hour. Reduces noise from one-off spikes by ~40% while preserving real momentum signal.' },
    { v: '2.4.0', d: 'May 8, 2026', tag: 'Feature', title: 'Hook generation v2', body: 'Auto-generated titles and thumbnails are now A/B-ready by default. 23% lift on click-through in internal testing across 14 customers.' },
    { v: '2.3.7', d: 'Apr 29, 2026', tag: 'Fix', title: 'Caption rendering on Reels', body: 'Resolved an issue where caption animations would drop the first 200ms when exporting to Instagram Reels. Affected ~3% of exports between Apr 14-28.' },
    { v: '2.3.5', d: 'Apr 22, 2026', tag: 'Feature', title: 'Workflows & approvals', body: 'Reviewer roles, threaded comments, version history, and one-click publish to TikTok, YouTube, X, LinkedIn, and Reels.' },
    { v: '2.3.0', d: 'Apr 1, 2026', tag: 'Feature', title: 'Brand kit & templates', body: 'Lock fonts, colors, lower-thirds, intros, and outros at the org level. Every clip respects brand without manual styling.' },
    { v: '2.2.4', d: 'Mar 18, 2026', tag: 'Improvement', title: 'Whisper-Large tuning for podcasts', body: 'Domain-tuned transcription weights for podcast and interview audio. WER drops from 4.2% to 2.8% on benchmark set.' },
    { v: '2.2.0', d: 'Mar 1, 2026', tag: 'Feature', title: 'Hook & CTA generation', body: 'Auto-generated platform-specific titles, descriptions, and CTAs with A/B variants. Tuned per destination.' },
  ];
  const tagColor = (t) => t === 'Feature' ? 'text-[#53fc18] border-[#53fc18]/30 bg-[#53fc18]/5' : t === 'Fix' ? 'text-amber-400 border-amber-400/30 bg-amber-400/5' : 'text-stone-300 border-white/[0.1] bg-[#53fc18]/[0.015]';

  return (
    <>
      <PageHero eyebrow="Changelog" title="What's new" italic="this week." sub="Every shipped change, ordered by release. Subscribe to the RSS feed or follow @clipper_ai for instant updates." />

      <section className="relative z-10 max-w-[1100px] mx-auto px-8 py-12">
        <div className="space-y-4">
          {entries.map((e, i) => (
            <Reveal key={e.v} delay={i * 60}>
              <div className="grid md:grid-cols-[140px_1fr] gap-8 p-8 rounded-xl border border-[#53fc18]/[0.08] hover:border-[#53fc18]/30 hover:bg-[#53fc18]/[0.02] hover:shadow-[0_0_30px_-10px_rgba(83,252,24,0.3)]">
                <div>
                  <div className="serif text-3xl text-[#53fc18]">v{e.v}</div>
                  <div className="text-[10px] mono text-stone-500 tracking-wider uppercase mt-1">{e.d}</div>
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-3">
                    <span className={`px-2 py-0.5 rounded-md border text-[10px] mono tracking-wider uppercase ${tagColor(e.tag)}`}>{e.tag}</span>
                    <h3 className="serif text-2xl">{e.title}</h3>
                  </div>
                  <p className="text-stone-400 leading-relaxed">{e.body}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>
    </>
  );
}

/* ──────────────────────────────────────────────────────────── DOCS */
function DocsPage({ goto }) {
  return (
    <>
      <PageHero eyebrow="Documentation" title="Everything you need" italic="to ship." sub="API references, integration guides, and walkthroughs. Built to be searchable, not browsed." />

      <section className="relative z-10 max-w-[1400px] mx-auto px-8 py-12">
        <Reveal>
          <div className="relative max-w-2xl">
            <Search className="w-4 h-4 text-stone-500 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              placeholder="Search docs · try 'webhooks' or 'reframe API'"
              className="w-full pl-11 pr-4 py-3.5 rounded-md bg-[#53fc18]/[0.015] border border-[#53fc18]/[0.12] focus:border-[#53fc18]/30 focus:outline-none text-sm placeholder:text-stone-500"
            />
            <kbd className="absolute right-4 top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded border border-white/[0.1] text-[10px] mono text-stone-500">⌘K</kbd>
          </div>
        </Reveal>
      </section>

      <section className="relative z-10 max-w-[1400px] mx-auto px-8 py-12">
        <div className="grid md:grid-cols-3 gap-4">
          {[
            { icon: BookOpen, t: 'Getting started', d: 'Connect your account, upload your first video, and ship your first clip in under five minutes.', count: '6 guides' },
            { icon: Code, t: 'API reference', d: 'RESTful endpoints for uploads, jobs, clips, and webhooks. SDKs for Node, Python, and Go.', count: '24 endpoints' },
            { icon: Workflow, t: 'Pipeline internals', d: 'How each model in the stack works, what it expects, and how to tune it for your content type.', count: '8 articles' },
            { icon: Layers, t: 'Brand kit', d: 'Configuring fonts, colors, intros, outros, and caption styles at the org level.', count: '4 articles' },
            { icon: Shield, t: 'Security & compliance', d: 'SOC 2, GDPR, data retention, encryption at rest, VPC deployment options.', count: '7 articles' },
            { icon: GitBranch, t: 'Webhooks & events', d: 'Subscribe to job lifecycle, render completion, and clip status changes.', count: '12 events' },
            { icon: Terminal, t: 'CLI', d: 'Headless clipping from the terminal. Useful for CI pipelines and batch jobs.', count: '15 commands' },
            { icon: Database, t: 'Data export', d: 'Bulk export of clips, transcripts, and virality scores. CSV, JSON, Parquet.', count: '3 guides' },
          ].map((d, i) => (
            <Reveal key={d.t} delay={i * 50}>
              <div className="group p-7 rounded-xl border border-[#53fc18]/[0.08] hover:border-[#53fc18]/30 hover:bg-[#53fc18]/[0.015] cursor-pointer h-full">
                <div className="flex items-start justify-between mb-5">
                  <div className="w-10 h-10 rounded-md border border-[#53fc18]/[0.12] flex items-center justify-center group-hover:border-[#53fc18]/40 group-hover:bg-[#53fc18]/5">
                    <d.icon className="w-4 h-4 text-stone-400 group-hover:text-[#53fc18]" />
                  </div>
                  <span className="text-[10px] mono text-stone-500 tracking-wider uppercase">{d.count}</span>
                </div>
                <div className="font-medium mb-2 text-lg">{d.t}</div>
                <div className="text-sm text-stone-400 leading-relaxed mb-4">{d.d}</div>
                <div className="text-xs text-[#53fc18] flex items-center gap-1.5 opacity-0 group-hover:opacity-100">
                  Browse <ArrowUpRight className="w-3 h-3" />
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="relative z-10 max-w-[1400px] mx-auto px-8 py-16 border-t border-[#53fc18]/[0.10]">
        <Reveal>
          <div className="text-[10px] mono text-[#53fc18] mb-4 tracking-[0.2em] uppercase flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[#53fc18]" style={{ boxShadow: "0 0 8px #53fc18" }} /> Quick start</div>
          <h2 className="serif text-5xl leading-tight tracking-tight mb-6">Your first clip, in code.</h2>
          <div className="rounded-2xl border border-[#53fc18]/[0.12] bg-black/60 backdrop-blur overflow-hidden">
            <div className="border-b border-white/[0.06] px-5 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-[10px] mono text-stone-500 tracking-wider uppercase">
                <Terminal className="w-3.5 h-3.5" /> POST /v1/jobs · Node.js
              </div>
              <button className="text-[10px] mono text-stone-500 hover:text-[#53fc18] tracking-wider uppercase">Copy</button>
            </div>
            <pre className="p-6 text-sm mono leading-relaxed overflow-x-auto"><code><span className="text-stone-500">// Submit a video and stream clips back</span>{'\n'}<span className="text-[#53fc18]">import</span> <span className="text-stone-200">{'{ Clipper }'}</span> <span className="text-[#53fc18]">from</span> <span className="text-amber-300">'@clipper/sdk'</span>{'\n\n'}<span className="text-[#53fc18]">const</span> <span className="text-stone-200">clipper</span> = <span className="text-[#53fc18]">new</span> <span className="text-stone-200">Clipper</span>({'{ '}<span className="text-stone-300">apiKey</span>: <span className="text-stone-200">process.env.CLIPPER_KEY</span>{' }'}){'\n\n'}<span className="text-[#53fc18]">const</span> <span className="text-stone-200">job</span> = <span className="text-[#53fc18]">await</span> <span className="text-stone-200">clipper.jobs.create</span>({'{'}{'\n  '}<span className="text-stone-300">source</span>: <span className="text-amber-300">'https://cdn.example.com/podcast-ep47.mp4'</span>,{'\n  '}<span className="text-stone-300">targets</span>: [<span className="text-amber-300">'tiktok'</span>, <span className="text-amber-300">'reels'</span>, <span className="text-amber-300">'shorts'</span>],{'\n  '}<span className="text-stone-300">minVirality</span>: <span className="text-amber-300">80</span>,{'\n'}{'}'}){'\n\n'}<span className="text-[#53fc18]">for await</span> (<span className="text-[#53fc18]">const</span> <span className="text-stone-200">clip</span> <span className="text-[#53fc18]">of</span> <span className="text-stone-200">clipper.jobs.stream</span>(<span className="text-stone-200">job.id</span>)) {'{'}{'\n  '}<span className="text-stone-200">console.log</span>(<span className="text-stone-200">clip.title</span>, <span className="text-stone-200">clip.viralityScore</span>){'\n'}{'}'}
            </code></pre>
          </div>
        </Reveal>
      </section>
    </>
  );
}

/* ──────────────────────────────────────────────────────────── STATUS */
function StatusPage({ goto }) {
  // 60-day uptime sparkline data — all green except a couple minor blips
  const generateUptime = (seed) => {
    const days = [];
    for (let i = 0; i < 60; i++) {
      // Deterministic-ish: blip on day 23 and 41
      if (i === 23 + seed || i === 41 - seed) days.push(99.92 + Math.random() * 0.05);
      else days.push(100);
    }
    return days;
  };

  const systems = [
    { name: 'API · Core endpoints', status: 'operational', latency: '142ms', uptime: '100.00%', region: 'us-west-2', spark: generateUptime(0) },
    { name: 'Upload pipeline', status: 'operational', latency: '2.4s', uptime: '99.98%', region: 'us-west-2', spark: generateUptime(1) },
    { name: 'Transcription service', status: 'operational', latency: '~8s/min', uptime: '99.97%', region: 'us-west-2', spark: generateUptime(2) },
    { name: 'Virality scoring', status: 'operational', latency: '~0.8s/clip', uptime: '99.99%', region: 'us-west-2', spark: generateUptime(0) },
    { name: 'Render workers (GPU)', status: 'operational', latency: '~12s/clip', uptime: '99.94%', region: 'us-west-2', spark: generateUptime(3) },
    { name: 'Dashboard · clipper.ai', status: 'operational', latency: '38ms', uptime: '100.00%', region: 'edge', spark: generateUptime(0) },
    { name: 'Storage (R2)', status: 'operational', latency: '12ms', uptime: '100.00%', region: 'multi', spark: generateUptime(0) },
    { name: 'Webhooks delivery', status: 'operational', latency: '~340ms', uptime: '99.96%', region: 'us-west-2', spark: generateUptime(2) },
  ];

  const incidents = [
    {
      date: 'May 18, 2026',
      title: 'Brief elevated latency on render workers',
      severity: 'minor',
      duration: '14 min',
      resolved: true,
      body: 'A bad node in our GPU pool caused render jobs to queue longer than normal between 14:32 and 14:46 UTC. Replaced the node; clipper.ai operations resumed normal latency. No data was lost; affected jobs were re-queued automatically.',
    },
    {
      date: 'May 04, 2026',
      title: 'Transcription queue backed up briefly',
      severity: 'minor',
      duration: '8 min',
      resolved: true,
      body: 'An upstream Deepgram API hiccup caused our transcription queue to grow to ~140 jobs deep before recovering. All jobs completed within 12 minutes; no failures.',
    },
  ];

  const Spark = ({ data }) => {
    const max = Math.max(...data);
    const min = 99.85;
    const range = max - min || 1;
    return (
      <svg viewBox="0 0 120 24" className="w-full h-6">
        {data.map((v, i) => {
          const h = ((v - min) / range) * 22 + 2;
          const color = v < 99.95 ? '#fbbf24' : '#53fc18';
          return <rect key={i} x={i * 2} y={24 - h} width={1.4} height={h} fill={color} opacity={0.7} />;
        })}
      </svg>
    );
  };

  return (
    <>
      <PageHero eyebrow="Status · Live" title="All systems" italic="operational." sub="Real-time status, latency, and recent incidents for every component of Clipper.ai. Subscribe to RSS for alerts." />

      {/* Top banner */}
      <section className="relative z-10 max-w-[1400px] mx-auto px-6 md:px-8 pb-10">
        <Reveal>
          <div className="rounded-2xl border border-[#53fc18]/30 bg-[#53fc18]/[0.04] p-8 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="relative">
                <span className="w-3 h-3 rounded-full bg-[#53fc18] block" style={{ boxShadow: '0 0 16px #53fc18' }} />
                <span className="absolute inset-0 w-3 h-3 rounded-full bg-[#53fc18] animate-ping opacity-60" />
              </div>
              <div>
                <div className="serif text-3xl text-[#53fc18]" style={{ textShadow: '0 0 24px rgba(83,252,24,0.5)' }}>All systems operational</div>
                <div className="text-xs mono text-stone-400 tracking-wider mt-1">LAST CHECK · 12 SECONDS AGO · UPDATED EVERY 30S</div>
              </div>
            </div>
            <div className="hidden md:flex items-center gap-8 text-right">
              <div>
                <div className="serif text-3xl text-stone-100">99.98<span className="text-lg text-stone-500">%</span></div>
                <div className="text-[10px] mono text-stone-500 tracking-wider mt-1">90-DAY UPTIME</div>
              </div>
              <div>
                <div className="serif text-3xl text-stone-100">142<span className="text-lg text-stone-500">ms</span></div>
                <div className="text-[10px] mono text-stone-500 tracking-wider mt-1">P50 API LATENCY</div>
              </div>
              <div>
                <div className="serif text-3xl text-stone-100">2</div>
                <div className="text-[10px] mono text-stone-500 tracking-wider mt-1">INCIDENTS · 90D</div>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* Systems table */}
      <section className="relative z-10 max-w-[1400px] mx-auto px-6 md:px-8 pb-16 border-t border-[#53fc18]/[0.10] pt-12">
        <Reveal>
          <div className="flex items-baseline justify-between mb-8">
            <div>
              <div className="text-[10px] mono text-[#53fc18] mb-2 tracking-[0.2em] uppercase flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#53fc18]" style={{ boxShadow: '0 0 8px #53fc18' }} />
                Systems
              </div>
              <h2 className="serif text-4xl">Components</h2>
            </div>
            <div className="text-[10px] mono text-stone-500 tracking-wider">60-DAY UPTIME ·  EACH BAR = 1 DAY</div>
          </div>
          <div className="rounded-2xl border border-[#53fc18]/[0.10] bg-stone-900/30 overflow-hidden divide-y divide-[#53fc18]/[0.08]">
            {systems.map((s, i) => (
              <Reveal key={s.name} delay={i * 30}>
                <div className="px-6 py-5 flex items-center gap-6 hover:bg-[#53fc18]/[0.015]">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#53fc18] flex-shrink-0" style={{ boxShadow: '0 0 6px #53fc18' }} />
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-stone-100">{s.name}</div>
                      <div className="text-[10px] mono text-stone-500 tracking-wider mt-0.5">{s.region.toUpperCase()} · {s.latency}</div>
                    </div>
                  </div>
                  <div className="hidden md:block w-64">
                    <Spark data={s.spark} />
                  </div>
                  <div className="text-right w-20">
                    <div className="text-sm mono text-stone-200">{s.uptime}</div>
                    <div className="text-[10px] mono text-stone-500 tracking-wider mt-0.5">UPTIME</div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </Reveal>
      </section>

      {/* Recent incidents */}
      <section className="relative z-10 max-w-[1400px] mx-auto px-6 md:px-8 pb-20 border-t border-[#53fc18]/[0.10] pt-12">
        <Reveal>
          <div className="flex items-baseline justify-between mb-8">
            <div>
              <div className="text-[10px] mono text-[#53fc18] mb-2 tracking-[0.2em] uppercase flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#53fc18]" style={{ boxShadow: '0 0 8px #53fc18' }} />
                History
              </div>
              <h2 className="serif text-4xl">Recent incidents</h2>
            </div>
            <div className="text-xs mono text-stone-500 tracking-wider">LAST 90 DAYS · 2 RESOLVED</div>
          </div>
          <div className="space-y-3">
            {incidents.map((inc, i) => (
              <Reveal key={inc.date} delay={i * 60}>
                <div className="rounded-xl border border-[#53fc18]/[0.10] bg-stone-900/30 p-6">
                  <div className="flex items-start justify-between gap-6 mb-3">
                    <div className="flex items-baseline gap-3 flex-wrap">
                      <span className="text-xs mono text-stone-500 tracking-wider">{inc.date}</span>
                      <span className="text-[10px] mono px-2 py-0.5 rounded border border-amber-500/30 bg-amber-500/[0.08] text-amber-300 tracking-wider uppercase">{inc.severity}</span>
                      <span className="text-[10px] mono px-2 py-0.5 rounded border border-[#53fc18]/30 bg-[#53fc18]/[0.08] text-[#53fc18] tracking-wider uppercase">Resolved · {inc.duration}</span>
                    </div>
                  </div>
                  <div className="font-medium text-stone-100 mb-2">{inc.title}</div>
                  <div className="text-sm text-stone-400 leading-relaxed">{inc.body}</div>
                </div>
              </Reveal>
            ))}
            <div className="rounded-xl border border-[#53fc18]/[0.10] bg-[#53fc18]/[0.02] p-6 text-center">
              <div className="text-sm text-stone-400">No other incidents in the last 90 days.</div>
              <div className="text-[10px] mono text-stone-600 tracking-wider mt-2">SUBSCRIBE TO STATUS UPDATES → STATUS@CLIPPER.AI</div>
            </div>
          </div>
        </Reveal>
      </section>

      <CTABand goto={goto} openApp={() => goto('home')} />
    </>
  );
}

/* ──────────────────────────────────────────────────────────── COMPANY */
function CompanyPage({ goto }) {
  return (
    <>
      <PageHero eyebrow="Company" title="Built by people who" italic="missed the deadline." sub="Clipper.ai was started in 2024 by a team of media engineers and ML researchers tired of watching great long-form content die because nobody had time to clip it." />

      <section className="relative z-10 max-w-[1400px] mx-auto px-8 py-12">
        <div className="grid md:grid-cols-3 gap-4">
          {[
            { icon: Zap, t: 'Speed compounds', d: 'Every shipped clip teaches you something. Teams that ship more, learn faster. We optimize the pipeline for time-to-ship.' },
            { icon: Shield, t: 'Your data, your IP', d: 'We never train on customer content. Models improve from anonymized aggregate signal — never from your specific videos.' },
            { icon: Globe, t: 'Open by default', d: 'Our pipeline architecture is documented. Our pricing is on the website. Our changelog is public. No hidden floors.' },
          ].map((p, i) => (
            <Reveal key={p.t} delay={i * 80}>
              <div className="p-8 rounded-xl border border-[#53fc18]/[0.08] h-full">
                <p.icon className="w-5 h-5 text-[#53fc18] mb-5" />
                <div className="font-medium mb-2 text-lg">{p.t}</div>
                <div className="text-sm text-stone-400 leading-relaxed">{p.d}</div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="relative z-10 max-w-[1400px] mx-auto px-8 py-16 border-t border-[#53fc18]/[0.10]">
        <Reveal>
          <div className="grid md:grid-cols-[1fr_1.4fr] gap-16">
            <div>
              <div className="text-[10px] mono text-[#53fc18] mb-4 tracking-[0.2em] uppercase flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[#53fc18]" style={{ boxShadow: "0 0 8px #53fc18" }} /> Careers</div>
              <h2 className="serif text-5xl leading-tight tracking-tight mb-6">Come build the<br /><span className="italic">attention layer.</span></h2>
              <p className="text-stone-400 leading-relaxed text-lg mb-6">Small team. Generous comp. Remote-first with hubs in San Francisco and London. We hire for craft, taste, and shipping speed.</p>
              <div className="flex items-center gap-3 text-xs mono text-stone-500">
                <MapPin className="w-3.5 h-3.5" /> SF · London · Remote (US/EU)
              </div>
            </div>
            <div className="space-y-2">
              {[
                { t: 'Staff ML Engineer · Virality models', d: 'San Francisco · Full-time', tag: 'Engineering' },
                { t: 'Senior Product Designer', d: 'Remote (US/EU) · Full-time', tag: 'Design' },
                { t: 'Founding Sales · Media verticals', d: 'New York · Full-time', tag: 'Go-to-market' },
                { t: 'Video Pipeline Engineer', d: 'San Francisco · Full-time', tag: 'Engineering' },
                { t: 'Developer Advocate', d: 'Remote · Full-time', tag: 'Community' },
              ].map((r, i) => (
                <Reveal key={r.t} delay={i * 60}>
                  <div className="group flex items-center justify-between p-5 rounded-xl border border-[#53fc18]/[0.08] hover:border-[#53fc18]/30 hover:bg-[#53fc18]/[0.015] cursor-pointer">
                    <div>
                      <div className="font-medium mb-1">{r.t}</div>
                      <div className="text-xs mono text-stone-500">{r.d}</div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-[10px] mono text-stone-500 tracking-wider uppercase">{r.tag}</span>
                      <ArrowUpRight className="w-4 h-4 text-stone-500 group-hover:text-[#53fc18] group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </Reveal>
      </section>

      <section className="relative z-10 max-w-[1400px] mx-auto px-8 py-16 border-t border-[#53fc18]/[0.10]">
        <div className="grid md:grid-cols-3 gap-8">
          <Reveal>
            <div>
              <div className="text-[10px] mono text-[#53fc18] mb-3 tracking-[0.2em] uppercase flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[#53fc18]" style={{ boxShadow: "0 0 8px #53fc18" }} /> Status</div>
              <h3 className="serif text-3xl mb-4">Where we are</h3>
              <div className="space-y-3 text-sm text-stone-400">
                <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[#53fc18]" style={{ boxShadow: '0 0 6px #53fc18' }} /> 2,847 on the waitlist · Cohort 03 opens June 12</div>
                <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-stone-500" /> 14 design partners actively beta-testing</div>
                <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-stone-500" /> Pre-seed: angel investors from podcasting & media</div>
                <div className="text-xs text-stone-600 pt-2">Press inquiries → press@clipper.ai</div>
              </div>
            </div>
          </Reveal>
          <Reveal delay={80}>
            <div>
              <div className="text-[10px] mono text-[#53fc18] mb-3 tracking-[0.2em] uppercase flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[#53fc18]" style={{ boxShadow: "0 0 8px #53fc18" }} /> Contact</div>
              <h3 className="serif text-3xl mb-4">Get in touch</h3>
              <div className="space-y-2 text-sm text-stone-400">
                <div className="flex items-center gap-2"><Mail className="w-3.5 h-3.5 text-stone-500" /> hello@clipper.ai</div>
                <div className="flex items-center gap-2"><Briefcase className="w-3.5 h-3.5 text-stone-500" /> sales@clipper.ai</div>
                <div className="flex items-center gap-2"><Building2 className="w-3.5 h-3.5 text-stone-500" /> press@clipper.ai</div>
              </div>
            </div>
          </Reveal>
          <Reveal delay={160}>
            <div>
              <div className="text-[10px] mono text-[#53fc18] mb-3 tracking-[0.2em] uppercase flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[#53fc18]" style={{ boxShadow: "0 0 8px #53fc18" }} /> Investors</div>
              <h3 className="serif text-3xl mb-4">Backed by</h3>
              <div className="text-sm text-stone-400 leading-relaxed">Sequoia Capital · Index Ventures · Greylock · plus operators from Spotify, Netflix, The New York Times, and ElevenLabs.</div>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}

/* ──────────────────────────────────────────────────────────── PRE-LAUNCH COMPONENTS */
function Waitlist({ accent = '#53fc18' }) {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [count, setCount] = useState(2847);
  const [position, setPosition] = useState(2848);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [todayCount, setTodayCount] = useState(34);

  // Load real waitlist count on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get('waitlist:meta', true);
        if (res && res.value) {
          const meta = JSON.parse(res.value);
          // Base count of 2847 + real signups
          setCount(2847 + (meta.totalSignups || 0));
          // Count signups from today
          const today = new Date().toISOString().slice(0, 10);
          if (meta.dailySignups && meta.dailySignups[today]) {
            setTodayCount(34 + meta.dailySignups[today]);
          }
        }
      } catch (e) {
        // No existing data — use defaults
      }
    })();
  }, []);

  // Live-counter trickle to feel alive (only used as visual baseline before real data loads)
  useEffect(() => {
    const t = setInterval(() => {
      if (Math.random() > 0.65) setCount((c) => c + 1);
    }, 12000);
    return () => clearInterval(t);
  }, []);

  const submit = async () => {
    const trimmed = email.trim().toLowerCase();
    setError('');
    if (!trimmed || !trimmed.includes('@') || !trimmed.includes('.')) {
      setError('Please enter a valid email address.');
      return;
    }
    setLoading(true);
    try {
      // Check for dedup
      const existingRes = await window.storage.get(`waitlist:email:${trimmed}`, true).catch(() => null);
      if (existingRes && existingRes.value) {
        const existing = JSON.parse(existingRes.value);
        setPosition(existing.position);
        setSubmitted(true);
        setLoading(false);
        return;
      }

      // Load meta
      let meta = { totalSignups: 0, dailySignups: {} };
      try {
        const metaRes = await window.storage.get('waitlist:meta', true);
        if (metaRes && metaRes.value) meta = JSON.parse(metaRes.value);
      } catch (e) {}

      const today = new Date().toISOString().slice(0, 10);
      meta.totalSignups = (meta.totalSignups || 0) + 1;
      meta.dailySignups = meta.dailySignups || {};
      meta.dailySignups[today] = (meta.dailySignups[today] || 0) + 1;

      const newPosition = 2847 + meta.totalSignups;

      // Save email record
      await window.storage.set(`waitlist:email:${trimmed}`, JSON.stringify({
        email: trimmed,
        position: newPosition,
        signedUpAt: new Date().toISOString(),
      }), true);

      // Save meta
      await window.storage.set('waitlist:meta', JSON.stringify(meta), true);

      setCount(newPosition);
      setPosition(newPosition);
      setTodayCount(34 + meta.dailySignups[today]);
      setSubmitted(true);
    } catch (e) {
      setError("Something went wrong. Please try again.");
    }
    setLoading(false);
  };

  return (
    <section className="relative z-10 max-w-[1400px] mx-auto px-8 py-16 border-t border-[#53fc18]/[0.10]">
      <Reveal>
        <div className="relative max-w-3xl mx-auto text-center">
          <div className="absolute -inset-20 bg-[#53fc18]/[0.10] blur-3xl rounded-full pointer-events-none" />
          <div className="relative">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#53fc18]/[0.12] bg-[#53fc18]/[0.015] backdrop-blur text-[11px] mono text-stone-300 mb-8 tracking-wider uppercase">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inset-0 rounded-full bg-[#53fc18] animate-ping opacity-60" />
                <span className="relative rounded-full h-1.5 w-1.5 bg-[#53fc18]" />
              </span>
              Early access · Cohort 03 opens June 12
            </div>

            <h2 className="serif text-5xl md:text-6xl leading-[1.05] mb-6 text-center">
              Join the <span className="italic gradient-green">private beta.</span>
            </h2>
            <p className="text-stone-400 leading-relaxed text-lg mb-10 max-w-xl mx-auto text-center">
              We onboard in cohorts of 200 to keep the pipeline tuned and the support tight. Early users keep their pricing forever and shape what we ship next.
            </p>

            {!submitted ? (
              <>
                <div className="flex flex-col sm:flex-row gap-2 max-w-xl mx-auto mb-3 justify-center">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setError(''); }}
                    onKeyDown={(e) => e.key === 'Enter' && !loading && submit()}
                    placeholder="you@company.com"
                    disabled={loading}
                    className="flex-1 min-w-0 px-5 py-4 rounded-md border border-[#53fc18]/30 focus:border-[#53fc18]/60 focus:outline-none text-base placeholder:text-stone-500 disabled:opacity-50"
                    style={{ backgroundColor: 'rgba(20, 20, 18, 0.8)', color: '#e7e5e4' }}
                  />
                  <button
                    onClick={submit}
                    disabled={loading}
                    className="magnetic-glow group px-6 py-4 rounded-md font-medium flex items-center justify-center gap-2 whitespace-nowrap disabled:opacity-50 transition-transform hover:scale-[1.02]"
                    style={{ backgroundColor: '#53fc18', color: '#000', boxShadow: '0 0 30px rgba(83,252,24,0.3)' }}
                  >
                    {loading ? 'Adding...' : 'Claim my spot'}
                    {!loading && <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />}
                  </button>
                </div>
                {error && (
                  <div className="text-xs mono text-red-400 text-center mb-3 tracking-wider">{error}</div>
                )}
                {!error && <div className="mb-3" />}
              </>
            ) : (
              <div className="max-w-lg mx-auto mb-6 p-5 rounded-md border border-[#53fc18]/30 bg-[#53fc18]/[0.08] flex items-center gap-3" style={{ animation: 'blur-in 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}>
                <CheckCircle2 className="w-5 h-5 text-[#53fc18] flex-shrink-0" />
                <div className="text-left flex-1">
                  <div className="font-medium text-sm">You're in — position #{position.toLocaleString()}</div>
                  <div className="text-xs text-stone-400 mt-0.5">We'll email you when Cohort 03 opens on June 12.</div>
                </div>
              </div>
            )}

            <div className="flex items-center justify-center gap-6 text-xs mono text-stone-500 tracking-wider">
              <div className="flex items-center gap-2">
                <span className="w-1 h-1 rounded-full bg-[#53fc18] animate-pulse-soft" />
                <span><span className="text-stone-300">{count.toLocaleString()}</span> on the list</span>
              </div>
              <span className="text-stone-700">·</span>
              <span><span className="text-stone-300">+{todayCount}</span> today</span>
              <span className="text-stone-700 hidden md:inline">·</span>
              <span className="hidden md:inline">No spam, ever</span>
            </div>
          </div>
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
    <section className="relative z-10 max-w-[1400px] mx-auto px-8 py-12 border-t border-[#53fc18]/[0.10]">
      <Reveal>
        <div className="text-center mb-10">
          <div className="text-[10px] mono text-stone-500 tracking-[0.2em] uppercase">Built for teams that care about how their tools handle data</div>
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

function FounderNote() {
  return (
    <section className="relative z-10 max-w-[1400px] mx-auto px-8 py-16 border-t border-[#53fc18]/[0.10]">
      <Reveal>
        <div className="grid md:grid-cols-[1fr_1.6fr] gap-16 max-w-5xl mx-auto items-start">
          <div>
            <div className="text-[10px] mono text-[#53fc18] mb-4 tracking-[0.2em] uppercase flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[#53fc18]" style={{ boxShadow: "0 0 8px #53fc18" }} /> From the founders</div>

            {/* Company snapshot card — replaces the avatar graphic */}
            <div className="relative rounded-2xl border border-[#53fc18]/[0.12] bg-gradient-to-br from-[#53fc18]/[0.04] via-stone-950 to-black overflow-hidden">
              {/* Header strip */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-[#53fc18]/[0.10] bg-[#53fc18]/[0.02]">
                <div className="flex items-center gap-2 text-[10px] mono text-stone-400 tracking-wider uppercase">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#53fc18] animate-pulse-soft" />
                  Company snapshot
                </div>
                <div className="text-[10px] mono text-stone-500 tracking-wider">EST. 2024</div>
              </div>

              {/* Stat grid */}
              <div className="grid grid-cols-2 divide-x divide-[#53fc18]/[0.08]">
                <div className="p-5 border-b border-[#53fc18]/[0.08]">
                  <div className="text-[10px] mono text-stone-500 tracking-wider uppercase mb-1">Team</div>
                  <div className="serif text-3xl text-stone-100">12</div>
                  <div className="text-[10px] mono text-stone-500 mt-0.5">SF · Remote · NYC</div>
                </div>
                <div className="p-5 border-b border-[#53fc18]/[0.08]">
                  <div className="text-[10px] mono text-stone-500 tracking-wider uppercase mb-1">Raised</div>
                  <div className="serif text-3xl text-stone-100">$14M</div>
                  <div className="text-[10px] mono text-stone-500 mt-0.5">Seed + Series A</div>
                </div>
                <div className="p-5">
                  <div className="text-[10px] mono text-stone-500 tracking-wider uppercase mb-1">Cohorts shipped</div>
                  <div className="serif text-3xl text-[#53fc18]" style={{ textShadow: '0 0 20px rgba(83,252,24,0.4)' }}>02</div>
                  <div className="text-[10px] mono text-stone-500 mt-0.5">Cohort 03 · June 12</div>
                </div>
                <div className="p-5">
                  <div className="text-[10px] mono text-stone-500 tracking-wider uppercase mb-1">Teams onboarded</div>
                  <div className="serif text-3xl text-stone-100">312</div>
                  <div className="text-[10px] mono text-stone-500 mt-0.5">Across 4 continents</div>
                </div>
              </div>

              {/* Founders strip */}
              <div className="px-5 py-4 border-t border-[#53fc18]/[0.10] bg-black/40 flex items-center gap-3">
                <div className="flex -space-x-2">
                  <Avatar seed="Sarah Chen" size={36} />
                  <Avatar seed="Marcus Webb" size={36} />
                </div>
                <div className="flex-1">
                  <div className="text-sm text-stone-200">Sarah Chen <span className="text-stone-600">·</span> Marcus Webb</div>
                  <div className="text-[10px] mono text-stone-500 tracking-wider uppercase">CEO &amp; CTO · Co-founders</div>
                </div>
              </div>
            </div>
          </div>

          <div>
            <h2 className="serif text-5xl leading-[1.05] mb-5">
              We're building Clipper.ai because <span className="italic gradient-green">we needed it ourselves.</span>
            </h2>
            <div className="space-y-5 text-stone-300 leading-relaxed text-lg">
              <p>Before Clipper, Sarah ran content for a 12-show podcast network and Marcus shipped ML pipelines at a streaming platform. Both of us watched great long-form content die in the gap between "we recorded it" and "we promoted it."</p>
              <p>The existing tools were either dumb (chop the loudest moments and ship) or hostile (Adobe-tier complexity for a 30-second clip). Neither matched how modern media teams actually work — fast, iteratively, with a real sense of what's working <em>this week</em>.</p>
              <p>So we built it. The pipeline. The whole stack. We're shipping it carefully — cohorts of 200 — because we want the early product to feel like a craft tool, not a beta.</p>
            </div>
            <div className="mt-8 pt-6 border-t border-[#53fc18]/[0.10] flex items-center gap-4">
              <div className="flex -space-x-2">
                <Avatar seed="Sarah Chen" size={32} />
                <Avatar seed="Marcus Webb" size={32} />
              </div>
              <div className="text-xs mono text-stone-500 tracking-wider uppercase">
                Sarah Chen, CEO <span className="text-stone-700">·</span> Marcus Webb, CTO
              </div>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

/* ──────────────────────────────────────────────────────────── FAQ ITEM
   Reusable accordion row used by both the global FAQ and pricing FAQ */
function FAQItem({ q, a, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div
      className={`rounded-xl border overflow-hidden ${open ? 'border-[#53fc18]/30 bg-[#53fc18]/[0.015]' : 'border-white/[0.06] hover:border-white/[0.12]'}`}
      style={{ transition: 'border-color 0.4s cubic-bezier(0.16, 1, 0.3, 1), background-color 0.4s cubic-bezier(0.16, 1, 0.3, 1)' }}
    >
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-4 p-6 text-left"
      >
        <div className={`text-base font-medium flex-1 ${open ? 'text-stone-100' : 'text-stone-300'}`}>{q}</div>
        <div
          className="w-6 h-6 rounded-full border border-white/[0.1] flex items-center justify-center flex-shrink-0"
          style={{
            transform: open ? 'rotate(45deg)' : 'rotate(0deg)',
            transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
            borderColor: open ? 'rgba(83,252,24,0.4)' : '',
          }}
        >
          <span className="text-stone-400 text-lg leading-none mt-[-2px]">+</span>
        </div>
      </button>
      <div
        style={{
          maxHeight: open ? '400px' : '0px',
          opacity: open ? 1 : 0,
          transition: open
            ? 'max-height 0.5s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease-out 0.1s'
            : 'max-height 0.4s cubic-bezier(0.7, 0, 0.84, 0), opacity 0.2s ease-out',
          overflow: 'hidden',
        }}
      >
        <div className="px-6 pb-6 text-stone-400 leading-relaxed">{a}</div>
      </div>
    </div>
  );
}

function FAQ() {
  const items = [
    {
      q: 'When do I actually get access?',
      a: 'Cohort 03 opens June 12, 2026. We onboard 200 teams per cohort to keep support tight and gather real signal on what to build next. You get an email with your activation link within 24 hours of cohort open.',
    },
    {
      q: 'Does my early signup actually matter?',
      a: "Yes — early access pricing is locked for life (Studio at $39/editor/mo instead of $49), and Cohort 01-03 members get a permanent badge in their workspace and direct Slack access to the founders. We listen disproportionately to early users when shaping the roadmap.",
    },
    {
      q: 'What if I just want to try it before committing?',
      a: 'Every cohort member gets a 14-day full-feature trial. No card required. If it doesn\'t earn its keep, you cancel and walk away — no friction, no retention emails.',
    },
    {
      q: 'How is this different from OpusClip or Vizard?',
      a: "Two things, both honest. (1) Workflow depth — approval flows, brand kits, comment threads, and team seats are first-class, not bolt-ons. The competitors index hard on solo creators; we built for media teams from day one. (2) Reasoning you can read — every clip score comes with a written explanation of why we picked it, so editors can argue with the model and override. Most tools just output ranked clips with a number and hope you trust it.",
    },
    {
      q: 'Do you train on my content?',
      a: 'Never. Our models improve from anonymized aggregate signal — never from your specific videos. You can also opt out of aggregate contribution entirely with one toggle in settings.',
    },
    {
      q: 'What languages do you support?',
      a: "Whisper-Large covers 99 languages for transcription. Our virality scoring and hook generation are currently strongest in English, Spanish, Portuguese, and Mandarin — with French, German, and Japanese in active training for Q3 2026.",
    },
  ];
  const [open, setOpen] = useState(0);

  return (
    <section className="relative z-10 max-w-[1400px] mx-auto px-8 pt-16 pb-10 border-t border-[#53fc18]/[0.10] overflow-hidden">
      <GlowOrb size={500} opacity={0.08} className="-left-32 top-1/2" />
      <Reveal>
        <div className="grid md:grid-cols-[1fr_1.6fr] gap-16">
          <div className="md:sticky md:top-32 self-start">
            <div className="text-[10px] mono text-[#53fc18] mb-4 tracking-[0.2em] uppercase flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[#53fc18]" style={{ boxShadow: "0 0 8px #53fc18" }} /> Frequently asked</div>
            <h2 className="serif text-5xl leading-[1.05] mb-4">
              The answers <span className="italic text-stone-400">to the questions we keep getting.</span>
            </h2>
            <p className="text-stone-400 leading-relaxed">
              Don't see yours? <a className="text-[#53fc18] hover:underline cursor-pointer">Email us</a> — we read everything.
            </p>
          </div>

          <div className="space-y-2">
            {items.map((item, i) => {
              const isOpen = open === i;
              return (
                <div
                  key={item.q}
                  className={`rounded-xl border overflow-hidden ${isOpen ? 'border-[#53fc18]/30 bg-[#53fc18]/[0.015]' : 'border-white/[0.06] hover:border-white/[0.12]'}`}
                  style={{ transition: 'border-color 0.4s cubic-bezier(0.16, 1, 0.3, 1), background-color 0.4s cubic-bezier(0.16, 1, 0.3, 1)' }}
                >
                  <button
                    onClick={() => setOpen(isOpen ? -1 : i)}
                    className="w-full flex items-center justify-between gap-4 p-6 text-left"
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <div className="mono text-xs text-stone-500 w-6">0{i + 1}</div>
                      <div className={`text-base font-medium ${isOpen ? 'text-stone-100' : 'text-stone-300'}`}>{item.q}</div>
                    </div>
                    <div
                      className="w-6 h-6 rounded-full border border-white/[0.1] flex items-center justify-center flex-shrink-0"
                      style={{
                        transform: isOpen ? 'rotate(45deg)' : 'rotate(0deg)',
                        transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                        borderColor: isOpen ? 'rgba(83,252,24,0.4)' : '',
                      }}
                    >
                      <span className="text-stone-400 text-lg leading-none mt-[-2px]">+</span>
                    </div>
                  </button>
                  <div
                    style={{
                      maxHeight: isOpen ? '320px' : '0px',
                      opacity: isOpen ? 1 : 0,
                      transition: isOpen
                        ? 'max-height 0.5s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease-out 0.1s'
                        : 'max-height 0.4s cubic-bezier(0.7, 0, 0.84, 0), opacity 0.2s ease-out',
                      overflow: 'hidden',
                    }}
                  >
                    <div className="px-6 pb-6 pl-16 text-stone-400 leading-relaxed">{item.a}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Reveal>
    </section>
  );
}

/* ──────────────────────────────────────────────────────────── CTA BAND */
function CTABand({ goto, openApp }) {
  return (
    <section className="relative z-10 max-w-[1400px] mx-auto px-6 md:px-8 pt-12 pb-12 border-t border-[#53fc18]/[0.10] mt-4">
      <Reveal>
        <div className="text-center max-w-3xl mx-auto">
          <div className="text-[10px] mono text-[#53fc18] mb-4 tracking-[0.2em] uppercase flex items-center justify-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#53fc18]" style={{ boxShadow: "0 0 8px #53fc18" }} />
            Ready when you are
          </div>
          <h2 className="serif text-4xl md:text-5xl leading-[1.05] mb-4">
            Ready to <span className="italic gradient-green">ship clips</span>?
          </h2>
          <p className="text-stone-400 leading-relaxed mb-7">
            60 free minutes. No card. Open the Studio and drop your first video.
          </p>
          <button
            onClick={openApp}
            className="magnetic-glow group px-7 py-3.5 rounded-md font-medium inline-flex items-center gap-2 transition-transform hover:scale-[1.02]"
            style={{ backgroundColor: '#53fc18', color: '#000', boxShadow: '0 0 40px rgba(83,252,24,0.4)' }}
          >
            Start free trial
            <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </button>
        </div>
      </Reveal>
    </section>
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
          { icon: Sparkles, t: 'Smart segmentation', d: 'Identifies self-contained moments — not just loud spikes.' },
          { icon: TrendingUp, t: 'Virality scoring', d: 'Each clip gets a 0–100 score with reasoning.' },
          { icon: Zap, t: 'Platform-ready exports', d: 'TikTok, Reels, Shorts, X — auto-cropped & captioned.' },
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
                    {run.clips?.length || 0} clips · {run.videoMeta?.size ? `${run.videoMeta.size}MB · ` : ''}{relTime(run.createdAt)}
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

/* ──────────────────────────────────────────────────────────── ANALYZING */
function AnalyzingView({ progress, step, steps, videoMeta }) {
  return (
    <div className="animate-slide-up max-w-3xl mx-auto pt-16">
      <div className="text-center mb-8">
        <div className="text-xs mono text-[#53fc18] mb-3 tracking-wider">→ PROCESSING</div>
        <h1 className="serif text-5xl mb-4">Working through your video</h1>
        <div className="text-stone-500 mono text-sm">{videoMeta?.name} · {videoMeta?.size} MB</div>
      </div>

      <div className="relative h-2 rounded-full bg-stone-800 overflow-hidden mb-2">
        <div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#53fc18] to-[#53fc18] rounded-full transition-all duration-200"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="flex justify-between text-xs mono text-stone-500 mb-8">
        <span>{steps[step]}</span>
        <span>{Math.round(progress)}%</span>
      </div>

      <div className="space-y-3">
        {steps.map((s, i) => (
          <div key={s} className={`flex items-center gap-4 p-4 rounded-xl border transition ${
            i < step ? 'border-stone-800 bg-stone-900/30 text-stone-500' :
            i === step ? 'border-[#53fc18]/40 bg-[#53fc18]/5 text-stone-100' :
            'border-stone-800/60 text-stone-600'
          }`}>
            <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0">
              {i < step ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> :
               i === step ? <Loader2 className="w-5 h-5 text-[#53fc18] animate-spin" /> :
               <div className="w-2 h-2 rounded-full bg-stone-700" />}
            </div>
            <div className="flex-1">{s}</div>
            <div className="text-xs mono">
              {i < step ? 'done' : i === step ? 'running' : 'queued'}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────── RESULTS */
function ResultsView({ clips, onSelect, onReset, videoMeta }) {
  const [sort, setSort] = useState('virality');
  const sorted = [...clips].sort((a, b) => sort === 'virality' ? b.virality - a.virality : a.duration - b.duration);

  return (
    <div className="animate-slide-up">
      <div className="flex flex-wrap items-baseline justify-between gap-4 mb-2">
        <div>
          <div className="text-xs mono text-emerald-400 mb-2 tracking-wider flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5" /> ANALYSIS COMPLETE
          </div>
          <h1 className="serif text-5xl tracking-tight">{clips.length} clips ready to ship</h1>
        </div>
        <button onClick={onReset} className="text-sm text-stone-400 hover:text-stone-100 mono">
          ← New project
        </button>
      </div>
      <p className="text-stone-500 mb-10">From <span className="mono text-stone-300">{videoMeta?.name}</span> · ranked by viral potential</p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        {[
          { l: 'Avg virality', v: '83', s: '/100', icon: Flame },
          { l: 'Top score', v: '94', s: '/100', icon: TrendingUp },
          { l: 'Total runtime', v: '4:17', s: 'minutes', icon: Clock },
          { l: 'Est. reach', v: '2.4M', s: 'projected', icon: Users },
        ].map((m) => (
          <div key={m.l} className="p-5 rounded-xl border border-stone-800 bg-stone-900/30">
            <m.icon className="w-4 h-4 text-stone-500 mb-3" />
            <div className="text-xs mono text-stone-500 mb-1">{m.l}</div>
            <div className="flex items-baseline gap-1">
              <span className="serif text-3xl">{m.v}</span>
              <span className="text-xs text-stone-500">{m.s}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 mb-6">
        <span className="text-xs mono text-stone-500 mr-2">SORT</span>
        {['virality', 'duration'].map((k) => (
          <button key={k} onClick={() => setSort(k)} className={`px-3 py-1.5 rounded-md text-xs mono transition ${
            sort === k ? 'bg-stone-100 text-stone-950' : 'text-stone-400 hover:text-stone-100'
          }`}>
            {k}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {sorted.map((clip, i) => (
          <ClipRow key={clip.id} clip={clip} rank={i + 1} onSelect={() => onSelect(clip)} />
        ))}
      </div>
    </div>
  );
}

function ClipRow({ clip, rank, onSelect }) {
  const gradients = {
    'gradient-1': 'from-[#53fc18] via-[#3fd80f] to-emerald-500',
    'gradient-2': 'from-cyan-400 via-blue-500 to-indigo-600',
    'gradient-3': 'from-emerald-400 via-teal-500 to-cyan-600',
    'gradient-4': 'from-[#53fc18] via-emerald-500 to-teal-600',
    'gradient-5': 'from-violet-400 via-purple-500 to-fuchsia-600',
  };
  const score = clip.virality;
  const tone = score >= 90 ? 'text-emerald-400' : score >= 80 ? 'text-[#53fc18]' : 'text-amber-400';

  return (
    <div
      onClick={onSelect}
      className="group p-5 rounded-xl border border-stone-800 bg-stone-900/30 hover:border-stone-700 hover:bg-stone-900/60 cursor-pointer transition flex items-center gap-5"
    >
      <div className="serif text-2xl text-stone-600 w-8 mono">{String(rank).padStart(2, '0')}</div>

      <div className={`relative w-32 h-20 rounded-lg overflow-hidden bg-gradient-to-br ${gradients[clip.thumbnail]} flex items-center justify-center flex-shrink-0`}>
        <Play className="w-6 h-6 text-white/90 fill-white/90" />
        <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/60 text-[10px] mono text-white">
          0:{clip.duration}
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <div className="font-medium mb-1 truncate">{clip.title}</div>
        <div className="serif italic text-stone-400 text-sm mb-2 truncate">{clip.hook}</div>
        <div className="flex items-center gap-3 text-xs mono text-stone-500">
          <span>{clip.timestamp}</span>
          <span>·</span>
          <span>{clip.platforms.join(' · ')}</span>
        </div>
      </div>

      <div className="text-right">
        <div className={`serif text-4xl ${tone}`}>{clip.virality}</div>
        <div className="text-[10px] mono text-stone-500 tracking-wider">VIRALITY</div>
      </div>

      <ChevronRight className="w-4 h-4 text-stone-600 group-hover:text-stone-300 group-hover:translate-x-0.5 transition" />
    </div>
  );
}

/* ──────────────────────────────────────────────────────────── DETAIL */
function ClipDetailView({ clip, onBack }) {
  const gradients = {
    'gradient-1': 'from-[#53fc18] via-[#3fd80f] to-emerald-500',
    'gradient-2': 'from-cyan-400 via-blue-500 to-indigo-600',
    'gradient-3': 'from-emerald-400 via-teal-500 to-cyan-600',
    'gradient-4': 'from-[#53fc18] via-emerald-500 to-teal-600',
    'gradient-5': 'from-violet-400 via-purple-500 to-fuchsia-600',
  };

  return (
    <div className="animate-slide-up">
      <button onClick={onBack} className="text-sm text-stone-400 hover:text-stone-100 mono mb-6">
        ← Back to clips
      </button>

      <div className="grid lg:grid-cols-[1.2fr_1fr] gap-8">
        <div>
          <div className={`relative aspect-[9/16] max-h-[600px] rounded-2xl overflow-hidden bg-gradient-to-br ${gradients[clip.thumbnail]} flex items-center justify-center`}>
            <button className="w-20 h-20 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center hover:bg-white/30 transition">
              <Play className="w-8 h-8 text-white fill-white ml-1" />
            </button>
            <div className="absolute bottom-6 left-6 right-6">
              <div className="px-3 py-1.5 rounded-md bg-black/40 backdrop-blur-md text-white text-sm font-medium inline-block mb-2">
                CC · Auto-captioned
              </div>
              <div className="text-white serif text-2xl leading-tight drop-shadow-lg">
                {clip.hook}
              </div>
            </div>
            <div className="absolute top-4 right-4 px-2 py-1 rounded bg-black/40 backdrop-blur-md text-white text-xs mono">
              0:{clip.duration}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 mt-4">
            {['9:16', '1:1', '16:9'].map((r, i) => (
              <button key={r} className={`p-3 rounded-lg border text-xs mono transition ${
                i === 0 ? 'border-[#53fc18] bg-[#53fc18]/10 text-[#53fc18]' : 'border-stone-800 text-stone-400 hover:border-stone-700'
              }`}>
                {r} {i === 0 && '· active'}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <div className="flex items-center gap-2 text-xs mono text-stone-500 mb-3 tracking-wider">
              <Flame className="w-3.5 h-3.5 text-[#53fc18]" /> VIRALITY BREAKDOWN
            </div>
            <div className="serif text-7xl text-[#53fc18] leading-none mb-2">{clip.virality}</div>
            <div className="text-stone-400 text-sm">out of 100 — top 6% across all customer clips this month</div>
          </div>

          <div className="space-y-3">
            {Object.entries(clip.engagement).map(([k, v]) => (
              <div key={k}>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="capitalize text-stone-300">{k}</span>
                  <span className="mono text-stone-400">{v}</span>
                </div>
                <div className="h-1.5 rounded-full bg-stone-800 overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-[#53fc18] to-[#53fc18]" style={{ width: `${v}%` }} />
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

          <div className="flex gap-2 pt-2">
            <button className="flex-1 py-3 rounded-lg bg-gradient-to-br from-[#53fc18] to-[#53fc18] text-stone-950 font-medium flex items-center justify-center gap-2 hover:shadow-[0_0_30px_rgba(83,252,24,0.4)] transition">
              <Download className="w-4 h-4" /> Export
            </button>
            <button className="px-4 py-3 rounded-lg border border-stone-700 hover:bg-stone-900 transition">
              <Share2 className="w-4 h-4" />
            </button>
            <button className="px-4 py-3 rounded-lg border border-stone-700 hover:bg-stone-900 transition">
              <Scissors className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="mt-8 p-6 rounded-2xl border border-stone-800 bg-stone-900/30">
        <div className="text-xs mono text-stone-500 mb-4 tracking-wider">→ TRANSCRIPT · {clip.timestamp}</div>
        <div className="serif text-xl leading-relaxed text-stone-300 italic">
          "{clip.hook} ...and what we found was completely opposite to what every blog post and Twitter thread told us. The data was unambiguous — the conventional wisdom was just wrong, and the teams that ignored it were winning."
        </div>
      </div>
    </div>
  );
}


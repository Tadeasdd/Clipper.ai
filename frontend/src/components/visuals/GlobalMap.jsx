import React, { useState, useRef, useEffect } from 'react';
import { ArrowUpRight, Briefcase, Check, CheckCircle2, Clock, Database, Globe, Heart, MessageCircle, Play, Scissors, Share2, Shield, Sparkles, Zap } from 'lucide-react';
import { GlowOrb, Reveal, useReveal } from '../ui.jsx';
import { track } from '../../lib/analytics.jsx';
import { postLead } from '../../lib/api.js';
import { DEMO_CLIPS, SAMPLE_RECORDINGS } from '../../lib/demo.jsx';
import { prefersReducedMotion, useLoopProgress } from '../../lib/motion.jsx';
import { ClipFrame } from '../../studio/views.jsx';

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
    <div className="relative w-full aspect-[2/1] rounded-2xl border border-[var(--color-brand)]/[0.12] bg-gradient-to-b from-white/[0.02] to-transparent overflow-hidden">
      <svg viewBox="0 0 800 400" className="absolute inset-0 w-full h-full">
        {/* Dot mask of the world */}
        {dots.map((d, i) => (
          <circle key={i} cx={d.x} cy={d.y} r="1.2" fill="rgba(255,255,255,0.4)" opacity={d.opacity} />
        ))}

        {/* Network nodes */}
        {nodes.map((n, i) => (
          <g key={n.label}>
            {n.live && (
              <circle cx={n.x} cy={n.y} r="14" fill="none" stroke="var(--color-brand)" strokeWidth="1" opacity="0.3">
                <animate attributeName="r" values="6;20;6" dur="3s" begin={`${i * 0.4}s`} repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.6;0;0.6" dur="3s" begin={`${i * 0.4}s`} repeatCount="indefinite" />
              </circle>
            )}
            <circle cx={n.x} cy={n.y} r="3.5" fill={n.live ? 'var(--color-brand)' : '#78716c'} />
            <text
              x={n.x}
              y={n.y - 12}
              fill={n.live ? 'var(--color-brand)' : '#78716c'}
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
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-brand)]" />
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

export { GlobalMap };

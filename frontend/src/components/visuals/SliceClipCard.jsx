import React, { useState, useRef, useEffect } from 'react';
import { ArrowUpRight, Briefcase, Check, CheckCircle2, Clock, Database, Globe, Heart, MessageCircle, Play, Scissors, Share2, Shield, Sparkles, Zap } from 'lucide-react';
import { GlowOrb, Reveal, useReveal } from '../ui.jsx';
import { track } from '../../lib/analytics.jsx';
import { postLead } from '../../lib/api.js';
import { DEMO_CLIPS, SAMPLE_RECORDINGS } from '../../lib/demo.jsx';
import { prefersReducedMotion, useLoopProgress } from '../../lib/motion.jsx';
import { ClipFrame } from '../../studio/views.jsx';

function SliceClipCard({ clip, i }) {
  return (
    <div className="relative w-full h-full rounded-md border border-[var(--color-brand)]/[0.25] overflow-hidden" style={{
      background: 'linear-gradient(180deg, rgba(83,252,24,0.10), rgba(83,252,24,0.03))',
      boxShadow: `0 4px 20px color-mix(in srgb, ${clip.hue} 14.510%, transparent), 0 0 0 1px color-mix(in srgb, ${clip.hue} 8.235%, transparent) inset`,
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
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded-sm bg-black/60 border border-[var(--color-brand)]/30">
        <span className="text-[9px] mono text-[var(--color-brand)] tracking-wider">{clip.score}</span>
      </div>
      {/* Label */}
      <div className="absolute bottom-7 left-1/2 -translate-x-1/2">
        <span className="text-[7px] mono text-stone-400 tracking-[0.2em] uppercase">{clip.label}</span>
      </div>
    </div>
  );
}


export { SliceClipCard };

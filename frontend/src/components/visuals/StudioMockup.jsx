import React, { useState, useRef, useEffect } from 'react';
import { ArrowUpRight, Briefcase, Check, CheckCircle2, Clock, Database, Globe, Heart, MessageCircle, Play, Scissors, Share2, Shield, Sparkles, Zap } from 'lucide-react';
import { GlowOrb, Reveal, useReveal } from '../ui.jsx';
import { track } from '../../lib/analytics.jsx';
import { postLead } from '../../lib/api.js';
import { DEMO_CLIPS, SAMPLE_RECORDINGS } from '../../lib/demo.jsx';
import { prefersReducedMotion, useLoopProgress } from '../../lib/motion.jsx';
import { ClipFrame } from '../../studio/views.jsx';

function StudioMockup() {
  return (
    <div className="relative w-full max-w-2xl mx-auto">
      <div className="absolute -inset-8 bg-[var(--color-brand)]/[0.12] blur-3xl rounded-full pointer-events-none" />
      <div className="relative rounded-2xl border border-[var(--color-brand)]/[0.12] bg-black/80 backdrop-blur overflow-hidden">
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
        <div className="grid grid-cols-[180px_1fr] divide-x divide-[var(--color-brand)]/[0.08]">
          {/* Sidebar */}
          <div className="p-4 space-y-3">
            <div className="text-[9px] mono text-stone-500 tracking-wider uppercase mb-2">Library</div>
            {[
              { l: 'All clips', n: 12, active: true },
              { l: 'Top scoring', n: 4 },
              { l: 'Drafts', n: 8 },
              { l: 'Published', n: 21 },
            ].map((item) => (
              <div key={item.l} className={`flex items-center justify-between px-2 py-1.5 rounded text-xs ${item.active ? 'bg-[var(--color-brand)]/10 text-[var(--color-brand)]' : 'text-stone-400'}`}>
                <span>{item.l}</span>
                <span className="mono text-[10px] text-stone-500">{item.n}</span>
              </div>
            ))}
            <div className="border-t border-white/[0.12] pt-3 mt-4">
              <div className="text-[9px] mono text-stone-500 tracking-wider uppercase mb-2">Library</div>
              <div className="flex items-center gap-2 px-2 py-1.5 rounded text-xs text-stone-400">
                <span className="w-1 h-1 rounded-full bg-[var(--color-brand)] animate-pulse-soft" />
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
              <div className="px-2.5 py-1 rounded bg-[var(--color-brand)]/10 text-[10px] mono text-[var(--color-brand)] tracking-wider uppercase">Ready</div>
            </div>

            <div className="space-y-1.5">
              {[
                { r: '01', t: 'The moment everything changed', score: 94, time: '12:34', dur: '0:47' },
                { r: '02', t: 'Counterintuitive insight on growth', score: 87, time: '24:08', dur: '0:38' },
                { r: '03', t: 'Three frameworks in 60 seconds', score: 82, time: '31:45', dur: '0:58' },
                { r: '04', t: 'The mistake nobody talks about', score: 78, time: '08:15', dur: '0:42' },
              ].map((clip, i) => (
                <div key={i} className="flex items-center gap-3 p-2 rounded hover:bg-[var(--color-brand)]/[0.015]">
                  <div className="mono text-[10px] text-stone-600 w-5">{clip.r}</div>
                  <div className="w-10 h-7 rounded bg-gradient-to-br from-[var(--color-brand)]/40 to-[#3fd80f]/30 flex items-center justify-center">
                    <Play className="w-2.5 h-2.5 text-black fill-black" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs truncate">{clip.t}</div>
                    <div className="text-[10px] mono text-stone-500 mt-0.5">{clip.time} · {clip.dur}</div>
                  </div>
                  <div className="serif text-xl text-[var(--color-brand)]">{clip.score}</div>
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

export { StudioMockup };

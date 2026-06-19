import React, { useState, useRef, useEffect } from 'react';
import { ArrowUpRight, Briefcase, Check, CheckCircle2, Clock, Database, Globe, Heart, MessageCircle, Play, Scissors, Share2, Shield, Sparkles, Zap } from 'lucide-react';
import { GlowOrb, Reveal, useReveal } from '../ui.jsx';
import { track } from '../../lib/analytics.jsx';
import { postLead } from '../../lib/api.js';
import { DEMO_CLIPS, SAMPLE_RECORDINGS } from '../../lib/demo.jsx';
import { prefersReducedMotion, useLoopProgress } from '../../lib/motion.jsx';
import { ClipFrame } from '../../studio/views.jsx';
import { SliceClipCard } from './SliceClipCard.jsx';
import { SLICE_CLIPS, SLICE_DURATION_MS } from './shared.jsx';

function ProductDemoReel({ openApp }) {
  return (
    <section className="relative z-10 max-w-[1400px] mx-auto px-6 md:px-8 py-16 md:py-24 border-t border-white/[0.12]">
      {/* Soft ambient backdrop — static gradient, zero animation cost */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(83,252,24,0.05), transparent 70%)' }} />

      {/* Header */}
      <Reveal>
        <div className="relative flex items-end justify-between mb-12">
          <div>
            <div className="text-[10px] mono text-[var(--color-brand)] tracking-[0.3em] uppercase mb-3">[ HOW IT WORKS ]</div>
            <h2 className="text-5xl md:text-6xl serif tracking-tight text-stone-100">
              One video in.<br /><span className="gradient-green italic">Six viral clips out.</span>
            </h2>
          </div>
          <div className="hidden md:flex items-center gap-3 text-[10px] mono text-stone-500 tracking-[0.25em] uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-brand)] slice-pulse" style={{ animation: 'sliceSourcePulse 2.4s ease-in-out infinite' }} />
            <span>LIVE PIPELINE</span>
          </div>
        </div>
      </Reveal>

      {/* The slice stage */}
      <Reveal delay={120}>
        <div className="relative rounded-2xl border border-[var(--color-brand)]/[0.12] bg-gradient-to-b from-stone-950/80 to-black/90 backdrop-blur-sm overflow-hidden">
          {/* Corner brackets */}
          <div className="absolute top-3 left-3 w-3 h-3 border-l border-t border-[var(--color-brand)]/40 pointer-events-none" />
          <div className="absolute top-3 right-3 w-3 h-3 border-r border-t border-[var(--color-brand)]/40 pointer-events-none" />
          <div className="absolute bottom-3 left-3 w-3 h-3 border-l border-b border-[var(--color-brand)]/40 pointer-events-none" />
          <div className="absolute bottom-3 right-3 w-3 h-3 border-r border-b border-[var(--color-brand)]/40 pointer-events-none" />

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
              <div className="text-[10px] mono text-[var(--color-brand)] tracking-[0.2em]">ANALYZING · 6 MOMENTS FOUND</div>
            </div>

            {/* SOURCE VIDEO BAR */}
            <div className="relative h-16 md:h-20 rounded-md overflow-hidden border border-[var(--color-brand)]/[0.15]" style={{
              background: 'linear-gradient(90deg, rgba(83,252,24,0.06), rgba(83,252,24,0.12), rgba(83,252,24,0.06))',
            }}>
              {/* Frame ticks — 24 tiny vertical marks suggesting timeline frames */}
              <div className="absolute inset-0 flex">
                {Array.from({ length: 24 }).map((_, i) => (
                  <div key={i} className="flex-1 border-r border-[var(--color-brand)]/[0.08] last:border-r-0" />
                ))}
              </div>
              {/* Faint waveform shimmer baked in as a static SVG (no animation) */}
              <svg className="absolute inset-0 w-full h-full opacity-30" viewBox="0 0 1000 80" preserveAspectRatio="none">
                <path d="M0 40 L20 30 L40 50 L60 25 L80 55 L100 35 L120 45 L140 20 L160 60 L180 40 L200 30 L220 50 L240 25 L260 55 L280 35 L300 45 L320 30 L340 50 L360 25 L380 55 L400 40 L420 30 L440 50 L460 25 L480 55 L500 35 L520 45 L540 30 L560 50 L580 25 L600 55 L620 40 L640 30 L660 50 L680 25 L700 55 L720 35 L740 45 L760 30 L780 50 L800 25 L820 55 L840 40 L860 30 L880 50 L900 25 L920 55 L940 35 L960 45 L980 30 L1000 40" stroke="var(--color-brand)" strokeWidth="1.5" fill="none" />
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
                    boxShadow: `0 0 8px ${clip.hue}, 0 0 16px color-mix(in srgb, ${clip.hue} 33.333%, transparent)`,
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
                <div className="w-12 h-px bg-gradient-to-r from-transparent to-[var(--color-brand)]/40" />
                <span>SLICED INTO</span>
                <div className="w-12 h-px bg-gradient-to-l from-transparent to-[var(--color-brand)]/40" />
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
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between pt-8 mt-2 border-t border-[var(--color-brand)]/[0.08]">
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
                <span aria-hidden="true" className="text-[var(--color-brand)]">↓</span>
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

export { ProductDemoReel };

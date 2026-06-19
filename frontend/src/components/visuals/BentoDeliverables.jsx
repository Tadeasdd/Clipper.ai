import React, { useState, useRef, useEffect } from 'react';
import { ArrowUpRight, Briefcase, Check, CheckCircle2, Clock, Database, Globe, Heart, MessageCircle, Play, Scissors, Share2, Shield, Sparkles, Zap } from 'lucide-react';
import { GlowOrb, Reveal, useReveal } from '../ui.jsx';
import { track } from '../../lib/analytics.jsx';
import { postLead } from '../../lib/api.js';
import { DEMO_CLIPS, SAMPLE_RECORDINGS } from '../../lib/demo.jsx';
import { prefersReducedMotion, useLoopProgress } from '../../lib/motion.jsx';
import { ClipFrame } from '../../studio/views.jsx';

function BentoDeliverables({ bookCall }) {
  const clip = DEMO_CLIPS[0];
  const hooks = Array.isArray(clip.hooks) && clip.hooks.length >= 3
    ? clip.hooks.slice(0, 3)
    : ['The moment everything changed', 'Nobody expected this answer', 'Watch the room go quiet'];
  const tile = 'tilt-card card-lift relative rounded-2xl border border-[var(--color-brand)]/[0.10] bg-gradient-to-b from-[var(--color-brand)]/[0.02] to-transparent overflow-hidden p-6';
  return (
    <section className="relative z-10 max-w-[1400px] mx-auto px-6 md:px-8 py-12 border-t border-white/[0.12]">
      <Reveal>
        <div className="mb-10">
          <div className="text-[10px] mono text-[var(--color-brand)] mb-4 tracking-[0.2em] uppercase flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-brand)]" /> The deliverable
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
              <Zap className="w-4 h-4 text-[var(--color-brand)]" />
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
              <span className="stamp-pulse inline-flex items-center justify-center w-7 h-7 rounded-full border border-[var(--color-brand)]/40 bg-[var(--color-brand)]/[0.08]">
                <Check className="w-3.5 h-3.5 text-[var(--color-brand)]" />
              </span>
            </div>
            <p className="text-xs text-stone-500 leading-relaxed">
              AI proposes, an editor approves. Nothing ships on model confidence alone, and every clip you receive carries an editor's name.
            </p>
            <div className="mt-4 inline-flex items-center gap-2 px-2.5 py-1 rounded-md border border-[var(--color-brand)]/25 bg-[var(--color-brand)]/[0.06] text-[10px] mono text-[#aaff66] tracking-wider uppercase">
              <CheckCircle2 className="w-3 h-3" /> Editor reviewed
            </div>
          </div>
        </Reveal>

        {/* 4 · Score */}
        <Reveal className="md:col-span-2" delay={180}>
          <div className={tile}>
            <div className="text-sm font-medium mb-3">Scored 0–100</div>
            <div className="flex items-end gap-3">
              <div className="serif text-5xl text-[var(--color-brand)] leading-none" style={{ textShadow: '0 0 24px rgba(83,252,24,0.4)' }}>{clip.virality}</div>
              <div className="text-[10px] mono text-stone-500 tracking-wider uppercase pb-1">This clip's<br />virality score</div>
            </div>
            <div className="mt-4 h-1 rounded-full bg-white/[0.06] overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${clip.virality}%`, background: 'var(--color-brand)', boxShadow: '0 0 10px rgba(83,252,24,0.7)' }} />
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
                <span key={p} className="px-2 py-1 rounded-md border border-[var(--color-brand)]/25 bg-[var(--color-brand)]/[0.06] text-[10px] mono text-[#aaff66]">{p}</span>
              ))}
            </div>
            <button onClick={bookCall} className="text-xs text-[var(--color-brand)] inline-flex items-center gap-1.5 hover:gap-2.5 transition-all">
              Set up your feed <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ──────────────────────────────────────────────────────────── PRE-LAUNCH COMPONENTS */

export { BentoDeliverables };

import React, { useState, useRef, useEffect } from 'react';
import { ArrowUpRight, Briefcase, Check, CheckCircle2, Clock, Database, Globe, Heart, MessageCircle, Play, Scissors, Share2, Shield, Sparkles, Zap } from 'lucide-react';
import { GlowOrb, Reveal, useReveal } from '../ui.jsx';
import { track } from '../../lib/analytics.jsx';
import { postLead } from '../../lib/api.js';
import { DEMO_CLIPS, SAMPLE_RECORDINGS } from '../../lib/demo.jsx';
import { prefersReducedMotion, useLoopProgress } from '../../lib/motion.jsx';
import { ClipFrame } from '../../studio/views.jsx';
import { CM_EDIT_MIN_PER_CLIP, useTween } from './shared.jsx';

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
          <div className="text-[10px] mono text-[var(--color-brand)] mb-4 tracking-[0.2em] uppercase flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-brand)]" style={{ boxShadow: '0 0 8px var(--color-brand)' }} /> Run the numbers
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
        <div className="relative rounded-2xl border border-[var(--color-brand)]/[0.14] bg-gradient-to-b from-[var(--color-brand)]/[0.02] to-transparent p-6 md:p-10 overflow-hidden">
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

              <div className="cm-hero-glow mt-8 p-5 rounded-xl border border-[var(--color-brand)]/30 bg-[var(--color-brand)]/[0.04]">
                <div className="text-[10px] mono text-[var(--color-brand)] tracking-wider uppercase mb-1.5">Platform-native posts / month</div>
                <div className="flex items-baseline gap-3">
                  <span className="cm-val serif text-6xl md:text-7xl text-[var(--color-brand)] tabular-nums leading-none">{dPosts.toLocaleString()}</span>
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
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-[var(--color-brand)]/25 bg-[var(--color-brand)]/[0.06] shrink-0">
                    <Clock className="w-4 h-4 text-[var(--color-brand)]" />
                  </span>
                  <div>
                    <div className="text-sm text-stone-200 leading-snug">
                      That&apos;s roughly <span className="text-[var(--color-brand)] font-medium">{dHours} hours</span> of editing a month you never have to do, scope, or hire for.
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

export { ContentMath };

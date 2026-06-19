import React, { useState, useRef, useEffect } from 'react';
import { ArrowUpRight, Briefcase, Check, CheckCircle2, Clock, Database, Globe, Heart, MessageCircle, Play, Scissors, Share2, Shield, Sparkles, Zap } from 'lucide-react';
import { GlowOrb, Reveal, useReveal } from '../ui.jsx';
import { track } from '../../lib/analytics.jsx';
import { postLead } from '../../lib/api.js';
import { DEMO_CLIPS, SAMPLE_RECORDINGS } from '../../lib/demo.jsx';
import { prefersReducedMotion, useLoopProgress } from '../../lib/motion.jsx';
import { ClipFrame } from '../../studio/views.jsx';

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
          <div className="text-[10px] mono text-[var(--color-brand)] tracking-[0.2em] uppercase mb-4 flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[var(--color-brand)]" /> The honest comparison</div>
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
                <div key={c.k} className={`flex items-center gap-3 px-6 py-5 border-l border-white/[0.06] ${c.neon ? 'bg-[var(--color-brand)]/[0.05]' : ''}`}>
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${c.neon ? 'bg-[var(--color-brand)]/15 text-[var(--color-brand)]' : 'bg-white/[0.04] text-stone-400'}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className={`text-base font-medium leading-tight ${c.neon ? 'text-[var(--color-brand)]' : 'text-stone-200'}`}>{c.label}</div>
                    <div className="text-[10px] mono text-stone-500 tracking-[0.18em] uppercase mt-0.5">{c.sub}</div>
                  </div>
                  {c.neon && <span className="ml-auto text-[var(--color-brand)] text-xl leading-none flex-shrink-0">&#10003;</span>}
                </div>
              );
            })}
          </div>
          {/* Criterion rows */}
          {matrix.map((r) => (
            <div key={r.l} className="cmp-row border-t border-white/[0.06] transition-colors hover:bg-white/[0.015]">
              <div className="px-6 py-4 text-[10px] mono text-stone-600 tracking-[0.16em] uppercase leading-snug flex items-center">{r.l}</div>
              {r.vals.map((v, i) => (
                <div key={i} className={`px-6 py-4 text-sm leading-relaxed border-l border-white/[0.06] ${cols[i].neon ? 'bg-[var(--color-brand)]/[0.05] text-stone-200' : 'text-stone-400'}`}>{v}</div>
              ))}
            </div>
          ))}
          {/* Verdict row — pays off the headline */}
          <div className="cmp-row border-t border-white/[0.1]">
            <div className="px-6 py-4 text-[10px] mono text-stone-500 tracking-[0.16em] uppercase flex items-center">Where it lands</div>
            {verdicts.map((v, i) => (
              <div key={i} className={`px-6 py-4 border-l border-white/[0.06] ${cols[i].neon ? 'bg-[var(--color-brand)]/[0.08]' : ''}`}>
                <span className={`serif text-lg ${cols[i].neon ? 'text-[var(--color-brand)]' : 'text-stone-500'}`} style={cols[i].neon ? { textShadow: '0 0 18px rgba(83,252,24,0.45)' } : undefined}>{v}</span>
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
              className={`group relative h-full rounded-2xl border flex flex-col overflow-hidden card-lift tilt-card ${c.neon ? 'border-[var(--color-brand)]/45 bg-[var(--color-brand)]/[0.04]' : 'border-white/[0.08] bg-white/[0.01] hover:border-white/[0.18]'}`}
              style={c.neon ? { boxShadow: '0 0 44px -14px rgba(83,252,24,0.4)' } : undefined}
            >
              {c.neon && <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--color-brand)] to-transparent" />}
              <div className="flex items-center gap-3 px-6 pt-6 pb-5 border-b border-white/[0.07]">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${c.neon ? 'bg-[var(--color-brand)]/15 text-[var(--color-brand)]' : 'bg-white/[0.04] text-stone-400'}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className={`text-base font-medium leading-tight ${c.neon ? 'text-[var(--color-brand)]' : 'text-stone-200'}`}>{c.label}</div>
                  <div className="text-[10px] mono text-stone-500 tracking-[0.18em] uppercase mt-0.5">{c.sub}</div>
                </div>
                {c.neon && (
                  <span className="ml-auto text-[var(--color-brand)] text-xl leading-none flex-shrink-0">&#10003;</span>
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
                  <div className={`serif text-lg ${c.neon ? 'text-[var(--color-brand)]' : 'text-stone-500'}`}>{verdicts[i]}</div>
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
        <div className="mt-9 rounded-2xl border border-[var(--color-brand)]/25 bg-gradient-to-r from-[var(--color-brand)]/[0.05] to-transparent p-6 md:p-7 grid sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-6">
          {reassure.map((r) => (
            <div key={r.t} className="flex gap-3">
              <span className="w-5 h-5 rounded-full bg-[var(--color-brand)]/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Check className="w-3 h-3 text-[var(--color-brand)]" />
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


export { WhyClipper };

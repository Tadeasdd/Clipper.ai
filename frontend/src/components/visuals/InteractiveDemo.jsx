import React, { useState, useRef, useEffect } from 'react';
import { ArrowUpRight, Briefcase, Check, CheckCircle2, Clock, Database, Globe, Heart, MessageCircle, Play, Scissors, Share2, Shield, Sparkles, Zap } from 'lucide-react';
import { GlowOrb, Reveal, useReveal } from '../ui.jsx';
import { track } from '../../lib/analytics.jsx';
import { postLead } from '../../lib/api.js';
import { DEMO_CLIPS, SAMPLE_RECORDINGS } from '../../lib/demo.jsx';
import { prefersReducedMotion, useLoopProgress } from '../../lib/motion.jsx';
import { ClipFrame } from '../../studio/views.jsx';

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
          <div className="text-[10px] mono text-[var(--color-brand)] mb-4 tracking-[0.2em] uppercase flex items-center justify-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-brand)]" style={{ boxShadow: '0 0 8px var(--color-brand)' }} />
            Watch it work
          </div>
          <h2 className="serif text-4xl md:text-5xl leading-[1.05] mb-3">
            See it run on a <span className="italic gradient-green">real sample.</span>
          </h2>
          <p className="text-stone-400 leading-relaxed max-w-xl mx-auto">
            Pick a sample recording and watch the exact pipeline we'd run on yours, live in the studio, from raw recording to shipped clips.
          </p>
        </div>

        <div className="tilt-card max-w-4xl mx-auto rounded-2xl border border-[var(--color-brand)]/20 bg-gradient-to-b from-[var(--color-brand)]/[0.03] to-transparent overflow-hidden shadow-[0_0_60px_-20px_rgba(83,252,24,0.3)]">
          {/* Console header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--color-brand)]/[0.10] bg-black/40">
            <div className="flex items-center gap-2 text-[10px] mono text-stone-400 tracking-wider uppercase">
              <span className="flex gap-1">
                <span className="w-2 h-2 rounded-full bg-stone-700" />
                <span className="w-2 h-2 rounded-full bg-stone-700" />
                <span className="w-2 h-2 rounded-full bg-[var(--color-brand)]" style={{ boxShadow: '0 0 6px var(--color-brand)' }} />
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
                          ? 'border-[var(--color-brand)] bg-[var(--color-brand)]/10 ring-1 ring-[var(--color-brand)]/40 shadow-[0_0_24px_-10px_rgba(83,252,24,0.6)]'
                          : 'border-white/15 bg-white/[0.02] hover:border-[var(--color-brand)]/40 hover:bg-[var(--color-brand)]/[0.04]'
                      }`}
                    >
                      {/* Radio indicator — unmistakable single-select affordance */}
                      <span
                        aria-hidden="true"
                        className={`shrink-0 w-[18px] h-[18px] rounded-full border flex items-center justify-center transition ${
                          active ? 'border-[var(--color-brand)]' : 'border-white/30 group-hover/opt:border-[var(--color-brand)]/60'
                        }`}
                      >
                        <span className={`w-2.5 h-2.5 rounded-full bg-[var(--color-brand)] transition ${active ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={`block text-sm ${active ? 'text-stone-100' : 'text-stone-300'}`}>{s.label}</span>
                        <span className="block text-[10px] mono text-stone-500 truncate mt-0.5">{s.source}</span>
                      </span>
                      {active && (
                        <span className="shrink-0 inline-flex items-center gap-1 text-[10px] mono uppercase tracking-wider text-[var(--color-brand)]">
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

export { InteractiveDemo };

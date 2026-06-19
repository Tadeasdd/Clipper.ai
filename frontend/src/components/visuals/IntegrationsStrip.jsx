import React, { useState, useRef, useEffect } from 'react';
import { ArrowUpRight, Briefcase, Check, CheckCircle2, Clock, Database, Globe, Heart, MessageCircle, Play, Scissors, Share2, Shield, Sparkles, Zap } from 'lucide-react';
import { GlowOrb, Reveal, useReveal } from '../ui.jsx';
import { track } from '../../lib/analytics.jsx';
import { postLead } from '../../lib/api.js';
import { DEMO_CLIPS, SAMPLE_RECORDINGS } from '../../lib/demo.jsx';
import { prefersReducedMotion, useLoopProgress } from '../../lib/motion.jsx';
import { ClipFrame } from '../../studio/views.jsx';
import { IntegrationGlyph } from './IntegrationGlyph.jsx';

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
    <section className="relative z-10 max-w-[1400px] mx-auto px-6 md:px-8 py-16 border-t border-white/[0.12]">
      <Reveal>
        <div className="grid md:grid-cols-[1fr_2fr] gap-12 items-start">
          <div>
            <div className="text-[10px] mono text-[var(--color-brand)] mb-4 tracking-[0.2em] uppercase flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[var(--color-brand)]" /> 
              Plays well with everything
            </div>
            <h2 className="serif text-4xl md:text-5xl leading-[1.05] mb-4">
              Drop in. <span className="italic gradient-green">Don't replace.</span>
            </h2>
            <p className="text-stone-400 leading-relaxed mb-6">
              Clipper fits where your content already lives. We pull from wherever you record, work in whatever tools you use, and publish to every platform your audience is on, so you don't change a thing about how you work.
            </p>
            <div className="flex flex-wrap gap-2 text-[10px] mono text-stone-500 tracking-wider uppercase">
              <span className="px-2 py-1 rounded border border-[var(--color-brand)]/15">Any source</span>
              <span className="px-2 py-1 rounded border border-[var(--color-brand)]/15">Any editor</span>
              <span className="px-2 py-1 rounded border border-[var(--color-brand)]/15">Every platform</span>
              <span className="px-2 py-1 rounded border border-[var(--color-brand)]/15">We handle it</span>
            </div>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2.5">
            {integrations.map((it, i) => (
              <div
                key={it.name}
                className="tilt-card group relative p-5 rounded-xl border border-[var(--color-brand)]/[0.10] bg-gradient-to-br from-[var(--color-brand)]/[0.02] to-transparent hover:border-[var(--color-brand)]/40 flex flex-col items-center justify-center aspect-square overflow-hidden cursor-pointer transition-all duration-300"
                style={{ animationDelay: `${i * 30}ms` }}
              >
                {/* Inner glow on hover */}
                <div className="absolute inset-0 bg-gradient-to-br from-[var(--color-brand)]/0 via-[var(--color-brand)]/0 to-[var(--color-brand)]/0 group-hover:from-[var(--color-brand)]/[0.06] group-hover:to-[var(--color-brand)]/0 transition-all duration-500" />
                {/* Corner accent */}
                <div className="absolute top-0 right-0 w-8 h-8 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <div className="absolute top-2 right-2 w-1 h-1 rounded-full bg-[var(--color-brand)]" style={{ boxShadow: '0 0 6px var(--color-brand)' }} />
                </div>
                <div className="relative">
                  <IntegrationGlyph name={it.name} />
                </div>
                <div className="relative text-[10px] mono text-stone-400 group-hover:text-stone-200 tracking-wider mt-3 text-center transition-colors">
                  {it.name}
                </div>
                <div className="absolute bottom-2 left-0 right-0 text-[8px] mono text-[var(--color-brand)]/60 tracking-[0.15em] uppercase text-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
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

export { IntegrationsStrip };

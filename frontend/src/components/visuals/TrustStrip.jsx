import React, { useState, useRef, useEffect } from 'react';
import { ArrowUpRight, Briefcase, Check, CheckCircle2, Clock, Database, Globe, Heart, MessageCircle, Play, Scissors, Share2, Shield, Sparkles, Zap } from 'lucide-react';
import { GlowOrb, Reveal, useReveal } from '../ui.jsx';
import { track } from '../../lib/analytics.jsx';
import { postLead } from '../../lib/api.js';
import { DEMO_CLIPS, SAMPLE_RECORDINGS } from '../../lib/demo.jsx';
import { prefersReducedMotion, useLoopProgress } from '../../lib/motion.jsx';
import { ClipFrame } from '../../studio/views.jsx';

function TrustStrip() {
  const badges = [
    { icon: Shield, label: 'SOC 2 Type II', sub: 'In progress' },
    { icon: Shield, label: 'GDPR ready', sub: 'EU compliant' },
    { icon: Database, label: 'Your data, your IP', sub: 'Never trained on' },
    { icon: Globe, label: 'US-hosted', sub: 'SFO · primary region' },
  ];
  return (
    <section className="relative z-10 max-w-[1400px] mx-auto px-8 py-12 border-t border-white/[0.12]">
      <Reveal>
        <div className="text-center mb-10">
          <div className="text-[10px] mono text-stone-500 tracking-[0.2em] uppercase">Built for teams that care about how their content is handled</div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-white/[0.06] rounded-2xl overflow-hidden border border-[var(--color-brand)]/[0.08]">
          {badges.map((b, i) => (
            <Reveal key={b.label} delay={i * 60}>
              <div className="bg-black p-7 flex items-start gap-4 h-full">
                <div className="w-9 h-9 rounded-md border border-[var(--color-brand)]/[0.12] flex items-center justify-center flex-shrink-0">
                  <b.icon className="w-4 h-4 text-[var(--color-brand)]" />
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


export { TrustStrip };

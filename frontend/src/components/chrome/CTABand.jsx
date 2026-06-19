import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ArrowUpRight, BookOpen, Building2, Film, Globe, Layers, Play, Search, Workflow } from 'lucide-react';
import { NeonGrid, GlowOrb, LogoMark, Reveal } from '../ui.jsx';
import { track } from '../../lib/analytics.jsx';

function CTABand({ goto, openApp, bookCall }) {
  return (
    <section className="relative z-10 max-w-[1400px] mx-auto px-6 md:px-8 pt-12 pb-12 border-t border-white/[0.12] mt-4">
      <Reveal>
        <div className="text-center max-w-3xl mx-auto">
          <div className="text-[10px] mono text-[var(--color-brand)] mb-4 tracking-[0.2em] uppercase flex items-center justify-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[var(--color-brand)]" /> 
            Ready when you are
          </div>
          <h2 className="serif text-4xl md:text-5xl leading-[1.05] mb-4">
            Turn your content into a <span className="italic gradient-green">growth engine</span>.
          </h2>
          <p className="text-stone-400 leading-relaxed mb-7">
            Book a demo and we'll scope a content engine around your show.
          </p>
          <button
            onClick={bookCall}
            className="btn-neon group px-7 py-3.5 rounded-md font-medium inline-flex items-center gap-2"
          >
            Book a demo
            <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </button>
        </div>
      </Reveal>
    </section>
  );
}


export { CTABand };

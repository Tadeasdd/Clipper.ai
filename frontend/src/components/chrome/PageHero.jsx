import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ArrowUpRight, BookOpen, Building2, Film, Globe, Layers, Play, Search, Workflow } from 'lucide-react';
import { NeonGrid, GlowOrb, LogoMark, Reveal } from '../ui.jsx';
import { track } from '../../lib/analytics.jsx';

function PageHero({ eyebrow, title, italic, sub }) {
  return (
    <section className="relative z-10 max-w-[1400px] mx-auto px-6 md:px-8 pt-16 md:pt-24 pb-16 md:pb-20 animate-blur-in overflow-hidden">
      <NeonGrid />
      <div className="relative max-w-4xl">
        <div className="flex items-center gap-2 mb-6">
          <span className="w-6 h-px bg-[var(--color-brand)]" />
          <span className="text-[10px] mono text-[var(--color-brand)] tracking-[0.2em] uppercase">{eyebrow}</span>
        </div>
        <h1 className="serif text-5xl md:text-7xl leading-[1.02] mb-6">
          {title} <span className="italic gradient-green">{italic}</span>
        </h1>
        <p className="text-lg md:text-xl text-stone-400 max-w-2xl leading-relaxed">{sub}</p>
      </div>
    </section>
  );
}

/* ──────────────────────────────────────────────────────────── CUSTOMERS */
/* ──────────────────────────────────────────────── LEGAL · PRIVACY + TERMS
   Short plain-English pages so the footer carries real legal links before
   launch. Deliberately honest about scope: an email-capture form and a demo,
   not a live data platform yet. */

export { PageHero };

import React, { useState, useRef, useEffect } from 'react';
import { ArrowUpRight, Briefcase, Check, CheckCircle2, Clock, Database, Globe, Heart, MessageCircle, Play, Scissors, Share2, Shield, Sparkles, Zap } from 'lucide-react';
import { GlowOrb, Reveal, useReveal } from '../ui.jsx';
import { track } from '../../lib/analytics.jsx';
import { postLead } from '../../lib/api.js';
import { DEMO_CLIPS, SAMPLE_RECORDINGS } from '../../lib/demo.jsx';
import { prefersReducedMotion, useLoopProgress } from '../../lib/motion.jsx';
import { ClipFrame } from '../../studio/views.jsx';

function Manifesto() {
  // [text, accent?] — accents glow green when lit.
  const WORDS = [
    ['Every'], ['hour'], ['you'], ['record'], ['hides'], ['a'], ['week'], ['of'],
    ['short-form.', true], ['We'], ['find'], ['it,'], ['cut'], ['it,'], ['score'], ['it,'],
    ['and'], ['ship'], ['it', true], ['while'], ['you'], ['make'], ['the'], ['next'], ['one.'],
  ];
  const ref = useRef(null);
  const [lit, setLit] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setLit(WORDS.length);
      return;
    }
    let raf = 0;
    const measure = () => {
      raf = 0;
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight || 800;
      // Progress 0→1 as the block travels from 88% viewport height up to 38%.
      const p = Math.max(0, Math.min(1, (vh * 0.88 - r.top) / (vh * 0.5)));
      setLit(Math.round(p * WORDS.length));
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(measure); };
    measure();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      cancelAnimationFrame(raf);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section className="relative z-10 max-w-[1400px] mx-auto px-6 md:px-8 py-20 md:py-28 border-t border-white/[0.12]">
      <div className="text-[10px] mono text-[var(--color-brand)] mb-8 tracking-[0.2em] uppercase flex items-center justify-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-brand)]" /> The thesis
      </div>
      <p ref={ref} className="serif text-4xl sm:text-5xl md:text-6xl lg:text-7xl leading-[1.12] tracking-tight max-w-5xl mx-auto text-center">
        {WORDS.map(([w, accent], i) => (
          <span key={i} className={`mf-word ${i < lit ? 'lit' : ''} ${accent ? 'mf-accent' : ''}`}>
            {w}{' '}
          </span>
        ))}
      </p>
    </section>
  );
}

/* ─────────────────────────────────────────────────── BENTO · DELIVERABLES
   The Apple/Vercel-style bento grid: six tiles, each a literal piece of what
   lands in a client's queue, each with its own live micro-visual. Tiles reuse
   the real ClipFrame and real DEMO clip data — nothing invented. All tiles
   tilt + spotlight via the shared engines. */

export { Manifesto };

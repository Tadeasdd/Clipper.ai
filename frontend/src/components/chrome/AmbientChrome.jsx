import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ArrowUpRight, BookOpen, Building2, Film, Globe, Layers, Play, Search, Workflow } from 'lucide-react';
import { NeonGrid, GlowOrb, LogoMark, Reveal } from '../ui.jsx';
import { track } from '../../lib/analytics.jsx';

function AmbientChrome() {
  const barRef = useRef(null);
  const glowRef = useRef(null);
  useEffect(() => {
    const bar = barRef.current;
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const h = document.documentElement;
        const max = h.scrollHeight - h.clientHeight;
        const p = max > 0 ? h.scrollTop / max : 0;
        if (bar) bar.style.transform = `scaleX(${p.toFixed(4)})`;
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);
  useEffect(() => {
    const glow = glowRef.current;
    if (!glow || typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(min-width: 768px) and (pointer: fine) and (prefers-reduced-motion: no-preference)');
    if (!mq.matches) return;
    let raf = 0, mx = 0, my = 0;
    const onMove = (e) => {
      mx = e.clientX; my = e.clientY;
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        glow.style.setProperty('--mx', mx + 'px');
        glow.style.setProperty('--my', my + 'px');
        glow.style.opacity = '1';
      });
    };
    const onLeave = () => { glow.style.opacity = '0'; };
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerleave', onLeave);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerleave', onLeave);
    };
  }, []);
  return (
    <>
      <div className="aurora" aria-hidden="true"><span /><span /></div>
      <div className="edge-vignette" aria-hidden="true" />
      <div ref={glowRef} className="grid-glow" aria-hidden="true" />
      <div className="scroll-progress" aria-hidden="true"><span ref={barRef} /></div>
    </>
  );
}


export { AmbientChrome };

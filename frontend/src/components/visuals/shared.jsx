import React, { useState, useRef, useEffect } from 'react';
import { ArrowUpRight, Briefcase, Check, CheckCircle2, Clock, Database, Globe, Heart, MessageCircle, Play, Scissors, Share2, Shield, Sparkles, Zap } from 'lucide-react';
import { GlowOrb, Reveal, useReveal } from '../ui.jsx';
import { track } from '../../lib/analytics.jsx';
import { postLead } from '../../lib/api.js';
import { DEMO_CLIPS, SAMPLE_RECORDINGS } from '../../lib/demo.jsx';
import { prefersReducedMotion, useLoopProgress } from '../../lib/motion.jsx';
import { ClipFrame } from '../../studio/views.jsx';

const SLICE_DURATION_MS = 6500;

const SLICE_CLIPS = [
  { pos: 11, score: 94, hue: '#aaff66', enterPct: 9,  label: 'HOOK' },
  { pos: 24, score: 88, hue: 'var(--color-brand)', enterPct: 16, label: 'TURN' },
  { pos: 40, score: 71, hue: 'var(--color-brand)', enterPct: 25, label: 'QUOTE' },
  { pos: 56, score: 81, hue: '#aaff66', enterPct: 34, label: 'LIST' },
  { pos: 71, score: 76, hue: 'var(--color-brand)', enterPct: 42, label: 'PUNCH' },
  { pos: 87, score: 65, hue: 'var(--color-brand)', enterPct: 51, label: 'CTA' },
];

// Inject the slice animation keyframes once at module load.
// Per-clip stagger is baked into separately named keyframes (sliceFall0..5, sliceMark0..5) so the
// stagger repeats correctly every loop iteration (animation-delay only delays the first iteration).

if (typeof document !== 'undefined' && !document.getElementById('slice-anim-styles')) {
  const style = document.createElement('style');
  style.id = 'slice-anim-styles';

  // Per-clip keyframes — fall in at enterPct, hold, then fade out near the end.
  const perClipKeyframes = SLICE_CLIPS.map((clip, i) => {
    const e = clip.enterPct;       // when the card starts appearing
    const eIn = Math.min(e + 1, 95);   // tiny pre-fade
    const eDown = Math.min(e + 6, 95); // settled into final position
    return `
      @keyframes sliceFall${i} {
        0%        { opacity: 0; transform: translate(-50%, -28px) scale(0.94); }
        ${e}%     { opacity: 0; transform: translate(-50%, -28px) scale(0.94); }
        ${eIn}%   { opacity: 1; transform: translate(-50%, -28px) scale(0.94); }
        ${eDown}% { opacity: 1; transform: translate(-50%, 0) scale(1); }
        88%       { opacity: 1; transform: translate(-50%, 0) scale(1); }
        96%       { opacity: 0; transform: translate(-50%, 0) scale(1); }
        100%      { opacity: 0; transform: translate(-50%, 0) scale(1); }
      }
      @keyframes sliceMark${i} {
        0%        { opacity: 0; transform: translateX(-50%) scaleY(0.4); }
        ${e}%     { opacity: 0; transform: translateX(-50%) scaleY(0.4); }
        ${eIn}%   { opacity: 1; transform: translateX(-50%) scaleY(1); }
        88%       { opacity: 0.7; transform: translateX(-50%) scaleY(1); }
        96%       { opacity: 0; transform: translateX(-50%) scaleY(1); }
        100%      { opacity: 0; transform: translateX(-50%) scaleY(1); }
      }
      @keyframes slicePop${i} {
        0%        { opacity: 0; transform: translateY(10px) scale(0.96); }
        ${e}%     { opacity: 0; transform: translateY(10px) scale(0.96); }
        ${eIn}%   { opacity: 1; transform: translateY(10px) scale(0.96); }
        ${eDown}% { opacity: 1; transform: translateY(0) scale(1); }
        88%       { opacity: 1; transform: translateY(0) scale(1); }
        96%       { opacity: 0; transform: translateY(0) scale(1); }
        100%      { opacity: 0; transform: translateY(0) scale(1); }
      }
    `;
  }).join('\n');

  style.textContent = `
    @keyframes sliceScan {
      0%   { transform: translateX(0); opacity: 0; }
      4%   { opacity: 1; }
      55%  { transform: translateX(100%); opacity: 1; }
      60%  { opacity: 0; }
      100% { transform: translateX(100%); opacity: 0; }
    }
    @keyframes sliceSourcePulse {
      0%, 100% { opacity: 0.85; }
      50% { opacity: 1; }
    }
    ${perClipKeyframes}

    @media (prefers-reduced-motion: reduce) {
      .slice-card-d, .slice-card-m { animation: none !important; opacity: 1 !important; }
      .slice-card-d { transform: translate(-50%, 0) !important; }
      .slice-card-m { transform: none !important; }
      .slice-mark { animation: none !important; opacity: 0.55 !important; transform: translateX(-50%) scaleY(1) !important; }
      .slice-scan { display: none !important; }
      .slice-pulse { animation: none !important; opacity: 1 !important; }
      .lt-marquee { animation: none !important; }
      .animate-pulse-soft { animation: none !important; opacity: 0.85 !important; }
    }
  `;
  document.head.appendChild(style);
}


const PL_GLYPHS = (() => {
  // Built once at module load so the six SVGs are never recreated on a render frame.
  const s = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round', strokeLinejoin: 'round' };
  const w = (children) => <svg viewBox="0 0 17 17" width="15" height="15" aria-hidden="true">{children}</svg>;
  return {
    wave: w(<path {...s} d="M1.5 8.5h2L5 3.5l2.2 10L9.5 6l1.4 3.2h4.1" />),
    split: w(<g {...s}><path d="M2 8.5h11.5" /><path d="M6 4.5 9.5 8.5 6 12.5" /><path d="M13.5 4.5v8" /></g>),
    gauge: w(<g {...s}><path d="M2.2 12a6.3 6.3 0 0 1 12.6 0" /><path d="M8.5 12l3.4-3.8" /></g>),
    crop: w(<g {...s}><rect x="1.5" y="5" width="7.5" height="6" rx="1" /><rect x="10" y="2.5" width="4.5" height="11" rx="1" /></g>),
    caption: w(<g {...s}><rect x="1.8" y="3.5" width="13" height="9.5" rx="1.6" /><path d="M4.6 7.2h7M4.6 9.8h4.5" /></g>),
    rank: w(<g {...s}><path d="M2 13h13" /><path d="M3.5 13V8.5M7.3 13V4.5M11 13V9.8M14.6 13V6.8" /></g>),
  };
})();


const CM_EDIT_MIN_PER_CLIP = 45; // transparent assumption, surfaced in the footnote

// Eases a displayed number from its current value to a new target whenever the
// target changes (e.g. as the slider moves), so figures glide instead of snapping.
// Collapses to an instant set under reduced-motion.

function useTween(target, ms = 480) {
  const [val, setVal] = useState(target);
  const valRef = useRef(target);
  valRef.current = val;
  const rafRef = useRef(0);
  useEffect(() => {
    if (prefersReducedMotion()) { setVal(target); return; }
    const from = valRef.current;
    const start = performance.now();
    const ease = (t) => 1 - Math.pow(1 - t, 3);
    const tick = (now) => {
      const t = Math.min(1, (now - start) / ms);
      setVal(from + (target - from) * ease(t));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, ms]);
  return val;
}


export { SLICE_DURATION_MS, SLICE_CLIPS, PL_GLYPHS, CM_EDIT_MIN_PER_CLIP, useTween };

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ArrowUpRight, BookOpen, Building2, Film, Globe, Layers, Play, Search, Workflow } from 'lucide-react';

import { NeonGrid, GlowOrb, LogoMark, Reveal } from './ui.jsx';
import { track } from '../lib/analytics.jsx';

/* ──────────────────────────────────────────────────────────── SITE SHELL */
/* ─────────────────────────────────────────────────── AMBIENT CHROME (Phase 1)
   Neon scroll-progress bar + cursor-reactive grid glow. Pure DOM; the grid glow
   is desktop + fine-pointer + motion-OK only and disabled under reduced-motion. */
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

function SiteShell({ children, page, goto, openApp, bookCall }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);

  // Global ⌘K / Ctrl+K toggles the command palette from anywhere on the site.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCmdOpen((v) => !v);
        track('cmdk_toggle');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Close mobile menu on Escape
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e) => { if (e.key === 'Escape') setMobileOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobileOpen]);

  const navItems = [
    { k: 'product', l: 'How it works' },
    { k: 'pricing', l: 'Pricing' },
    { k: 'company', l: 'Company' },
  ];

  const handleNav = (k) => {
    track('nav_click', { to: k });
    setMobileOpen(false);
    goto(k);
  };

  // Magnetic pull on primary CTAs (.magnetic-glow) — desktop + motion-OK only.
  // Dependency-free: rAF lerp toward a target offset, eased back to 0 on leave.
  const shellRef = useRef(null);
  useEffect(() => {
    const root = shellRef.current;
    if (!root || typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(min-width: 768px) and (pointer: fine) and (prefers-reduced-motion: no-preference)');
    if (!mq.matches) return;
    const btns = Array.from(root.querySelectorAll('.magnetic-glow'));
    const teardowns = btns.map((btn) => {
      let tx = 0, ty = 0, cx = 0, cy = 0, raf = 0;
      const loop = () => {
        cx += (tx - cx) * 0.18;
        cy += (ty - cy) * 0.18;
        if (Math.abs(tx - cx) < 0.1 && Math.abs(ty - cy) < 0.1) {
          cx = tx; cy = ty; raf = 0;
        }
        btn.style.transform = `translate(${cx.toFixed(2)}px, ${cy.toFixed(2)}px)`;
        if (raf !== 0 || cx !== tx || cy !== ty) raf = requestAnimationFrame(loop);
      };
      const kick = () => { if (!raf) raf = requestAnimationFrame(loop); };
      const onMove = (e) => {
        const r = btn.getBoundingClientRect();
        tx = (e.clientX - (r.left + r.width / 2)) * 0.28;
        ty = (e.clientY - (r.top + r.height / 2)) * 0.4;
        kick();
      };
      const onLeave = () => { tx = 0; ty = 0; kick(); };
      btn.addEventListener('pointermove', onMove);
      btn.addEventListener('pointerleave', onLeave);
      return () => {
        btn.removeEventListener('pointermove', onMove);
        btn.removeEventListener('pointerleave', onLeave);
        cancelAnimationFrame(raf);
        btn.style.transform = '';
      };
    });
    return () => teardowns.forEach((fn) => fn());
  }, [page]);

  // Pointer-reactive spotlight on .card-lift cards (the 3D tilt moved into the
  // shared useTiltEngine hook so the studio gets it too).
  // Desktop + fine pointer + motion-OK only.
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(min-width: 768px) and (pointer: fine) and (prefers-reduced-motion: no-preference)');
    if (!mq.matches) return;
    const onMove = (e) => {
      if (!e.target || !e.target.closest) return;
      const card = e.target.closest('.card-lift');
      if (card) {
        const r = card.getBoundingClientRect();
        card.style.setProperty('--sx', `${(e.clientX - r.left).toFixed(1)}px`);
        card.style.setProperty('--sy', `${(e.clientY - r.top).toFixed(1)}px`);
        card.style.setProperty('--sh', '1');
      }
    };
    const onOut = (e) => {
      const card = e.target && e.target.closest && e.target.closest('.card-lift');
      if (card && !(e.relatedTarget && card.contains(e.relatedTarget))) card.style.setProperty('--sh', '0');
    };
    document.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerout', onOut, { passive: true });
    return () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerout', onOut);
    };
  }, [page]);

  return (
    <div ref={shellRef} className="min-h-screen bg-black text-stone-100 overflow-x-hidden relative" style={{ fontFamily: "'Inter', sans-serif" }}>
      <a href="#main" className="skip-link">Skip to content</a>
      <AmbientChrome />
      <style>{`
        /* Single-family type system — Inter for everything, with strict roles */
        body, *, button, input, select, textarea {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, system-ui, 'Segoe UI', sans-serif;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          font-feature-settings: 'ss01', 'cv11', 'cv02';
        }
        /* DISPLAY: large headlines — Newsreader, an editorial serif (true italics) */
        .serif {
          font-family: 'Newsreader', Georgia, 'Times New Roman', serif;
          font-optical-sizing: auto;
          font-weight: 500;
          letter-spacing: -0.015em;
          line-height: 1.02;
        }
        h1.serif, h2.serif { text-wrap: balance; }
        .serif.italic, .serif em, em {
          font-style: italic;
          font-weight: 500;
        }
        /* MONO: technical signals only — versions, timestamps, eyebrows, code, kbd */
        .mono {
          font-family: 'JetBrains Mono', 'SF Mono', Menlo, Consolas, monospace;
          font-weight: 400;
          font-feature-settings: 'calt', 'ss01';
          letter-spacing: 0;
        }
        /* Body controls and paragraphs */
        button, input, select, textarea { font-weight: 500; letter-spacing: -0.01em; }
        p, li, a { letter-spacing: -0.011em; }
        @keyframes slide-up { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes blur-in { from { opacity: 0; filter: blur(12px); transform: translateY(20px); } to { opacity: 1; filter: blur(0); transform: translateY(0); } }
        /* Headline lines wipe up from behind a mask — reads as typeset reveal, not a fade. */
        @keyframes lineRise {
          from { opacity: 0; transform: translateY(0.5em); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .hero-line {
          display: block;
          clip-path: inset(-30% -10% -10% -10%);
        }
        .hero-line > span,
        .hero-line { will-change: transform, opacity; }
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        @keyframes ambient {
          0%, 100% { opacity: 0.3; transform: scale(1) translate(0, 0); }
          33% { opacity: 0.5; transform: scale(1.1) translate(30px, -20px); }
          66% { opacity: 0.4; transform: scale(0.95) translate(-20px, 30px); }
        }
        @keyframes pulse-soft { 0%, 100% { opacity: 0.6; } 50% { opacity: 1; } }
        @keyframes flow { 0% { stroke-dashoffset: 0; } 100% { stroke-dashoffset: -100; } }
        .animate-blur-in { animation: blur-in 1s cubic-bezier(0.16, 1, 0.3, 1) forwards; opacity: 0; }
        .animate-fade-in { animation: fade-in 1.5s ease-out forwards; }
        .animate-ambient { animation: ambient 12s ease-in-out infinite; }
        .animate-pulse-soft { animation: pulse-soft 2.5s ease-in-out infinite; }
        .animate-flow { animation: flow 3s linear infinite; }
        .reveal { opacity: 0; transform: translateY(24px); transition: opacity 1.1s cubic-bezier(0.16, 1, 0.3, 1), transform 1.1s cubic-bezier(0.16, 1, 0.3, 1); }
        .reveal.in { opacity: 1; transform: translateY(0); }
        button, a, [role="button"] { transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1); }
        .grid-bg {
          background-image: linear-gradient(rgba(83,252,24,0.10) 1px, transparent 1px), linear-gradient(90deg, rgba(83,252,24,0.10) 1px, transparent 1px);
          background-size: 64px 64px;
        }
        .text-glow { text-shadow: 0 0 28px rgba(83,252,24,0.22); }
        html { scroll-behavior: smooth; }
        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.15s !important;
            scroll-behavior: auto !important;
          }
        }
        .grain::before {
          content: ''; position: fixed; inset: 0; pointer-events: none; opacity: 0.03; z-index: 1; mix-blend-mode: overlay;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence baseFrequency='0.9' /%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)' /%3E%3C/svg%3E");
        }
        .gradient-green {
          background: linear-gradient(120deg, #53fc18 0%, #b8ff7d 90%);
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        @keyframes greenFlow { 0%, 100% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } }
        *:focus { outline: none; }
        *:focus-visible {
          outline: none;
          box-shadow: 0 0 0 2px rgba(83, 252, 24, 0.5), 0 0 12px rgba(83, 252, 24, 0.25);
          border-radius: 4px;
        }
        .link-underline { position: relative; }
        .link-underline::after {
          content: ''; position: absolute; left: 0; bottom: -2px; width: 100%; height: 1px;
          background: #53fc18; transform-origin: right; transform: scaleX(0);
          transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .link-underline:hover::after { transform-origin: left; transform: scaleX(1); }
        ::-webkit-scrollbar { width: 10px; height: 10px; }
        ::-webkit-scrollbar-track { background: rgba(20,20,18,0.4); }
        ::-webkit-scrollbar-thumb {
          background: rgba(83,252,24,0.15);
          border-radius: 999px;
          border: 2px solid transparent;
          background-clip: padding-box;
        }
        ::-webkit-scrollbar-thumb:hover { background: rgba(83,252,24,0.35); background-clip: padding-box; border: 2px solid transparent; }
        ::selection { background: rgba(83,252,24,0.3); color: #fff; }
        .card-lift { transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.3s, box-shadow 0.3s; }
        .card-lift:hover { transform: translateY(-2px); box-shadow: 0 18px 50px -24px rgba(83,252,24,0.35); }
        /* Magnetic CTAs — bring the studio shimmer-glow to marketing buttons and
           let GSAP own the transform (no CSS transition fighting the quickTo). */
        @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        .magnetic-glow { position: relative; isolation: isolate; will-change: transform; transition-property: box-shadow, background-color, border-color, color, opacity, filter !important; }
        .magnetic-glow::before {
          content: ''; position: absolute; inset: -1px; border-radius: inherit; pointer-events: none;
          background: linear-gradient(120deg, transparent 30%, rgba(83,252,24,0.55) 50%, transparent 70%);
          background-size: 200% 100%; background-position: -200% 0;
          z-index: -1; opacity: 0; transition: opacity 0.3s ease;
        }
        .magnetic-glow:hover::before { opacity: 1; animation: shimmer 1.8s linear infinite; }

        /* ── Enhancement layer (additive, dependency-free) ────────────── */
        /* Scroll reveals settle in with a hair of scale, not just a rise. */
        .reveal { transform: translateY(24px) scale(0.985); }
        .reveal.in { transform: translateY(0) scale(1); }
        /* Primary CTA "breathing" glow — draws the eye to the main action;
           pauses on hover so the existing hover shadow takes over cleanly. */
        .cta-glow { box-shadow: 0 8px 30px rgba(83,252,24,0.14); }

        /* ── Unified neon button system (uniform + interactive) ─────── */
        .btn-neon { position: relative; overflow: hidden; background: #53fc18; color: #000;
          box-shadow: 0 0 0 1px rgba(83,252,24,0.0), 0 8px 28px rgba(83,252,24,0.20);
          transition: transform .25s cubic-bezier(.16,1,.3,1), box-shadow .35s ease, background-color .25s ease; }
        .btn-neon:hover { transform: translateY(-1px); background: #62ff2b;
          box-shadow: 0 0 0 1px rgba(83,252,24,0.35), 0 10px 30px rgba(83,252,24,0.22); }
        .btn-neon:active { transform: translateY(0) scale(0.99); }
        .btn-neon::after { content: ''; position: absolute; top: 0; left: 0; height: 100%; width: 60%;
          background: linear-gradient(105deg, transparent 0%, rgba(255,255,255,0.35) 50%, transparent 100%);
          transform: translateX(-180%) skewX(-12deg); transition: transform .6s cubic-bezier(.16,1,.3,1); pointer-events: none; }
        .btn-neon:hover::after { transform: translateX(320%) skewX(-12deg); }
        .btn-neon-outline { position: relative; overflow: hidden; background: rgba(83,252,24,0.05); color: #aaff66;
          border: 1px solid rgba(83,252,24,0.35);
          transition: transform .25s cubic-bezier(.16,1,.3,1), box-shadow .35s ease, background-color .25s ease, border-color .25s ease, color .25s ease; }
        .btn-neon-outline:hover { transform: translateY(-1px) scale(1.025); background: rgba(83,252,24,0.12);
          border-color: rgba(83,252,24,0.8); color: #c8ff9e; box-shadow: 0 0 30px rgba(83,252,24,0.32); }
        .btn-neon-outline:active { transform: translateY(0) scale(0.99); }
        @media (prefers-reduced-motion: reduce) {
          .btn-neon, .btn-neon-outline { transition: none; }
          .btn-neon:hover, .btn-neon-outline:hover { transform: none; }
          .btn-neon::after { display: none; }
        }

        /* ── Phase 1 · atmosphere & a11y ─────────────────────────────── */
        .scroll-progress { position: fixed; top: 0; left: 0; right: 0; height: 2px; z-index: 90; pointer-events: none; background: rgba(83,252,24,0.08); }
        .scroll-progress > span { display: block; height: 100%; width: 100%; transform: scaleX(0); transform-origin: 0 50%; background: linear-gradient(90deg, #53fc18, #aaff66); box-shadow: 0 0 12px rgba(83,252,24,0.7); will-change: transform; }
        .grid-glow {
          position: fixed; inset: 0; z-index: 35; pointer-events: none; opacity: 0;
          transition: opacity 0.45s ease; mix-blend-mode: screen;
          --mx: 50%; --my: 50%;
          background-image: linear-gradient(rgba(83,252,24,0.18) 1px, transparent 1px), linear-gradient(90deg, rgba(83,252,24,0.18) 1px, transparent 1px);
          background-size: 64px 64px;
          -webkit-mask-image: radial-gradient(200px circle at var(--mx) var(--my), #000, transparent 70%);
          mask-image: radial-gradient(200px circle at var(--mx) var(--my), #000, transparent 70%);
        }
        :focus-visible { outline: 2px solid rgba(83,252,24,0.7); outline-offset: 2px; border-radius: 4px; }
        @media (prefers-reduced-motion: reduce) { .grid-glow { display: none !important; } }

        /* ── Phase 2 · hero ───────────────────────────── */
        .hero-parallax { will-change: transform; }
        @media (prefers-reduced-motion: reduce) { .hero-parallax { transform: none !important; } }

        /* ── Phase 3 · pricing spotlight sheen ──────────────── */
        .card-sheen {
          position: absolute; inset: 0; border-radius: inherit; pointer-events: none;
          opacity: var(--sheen, 0); transition: opacity 0.4s ease;
          background: radial-gradient(280px circle at var(--sx, 50%) var(--sy, 50%), rgba(83,252,24,0.13), transparent 60%);
        }
        @media (prefers-reduced-motion: reduce) { .card-sheen { display: none !important; } }
        /* Phase 5 -- hero auto-clip reel */
        .autoclip-reel { perspective: 1000px; }
        .ac-bar { flex: 1 1 0; min-width: 3px; border-radius: 2px 2px 0 0; background: rgba(255,255,255,0.10); transform-origin: bottom; }
        .ac-bar.ac-hot { background: linear-gradient(to top, #53fc18, #aaff66); box-shadow: 0 0 10px rgba(83,252,24,0.55); }
        .ac-scan { position: absolute; top: 0; bottom: 0; left: 0; width: 2px; background: linear-gradient(to bottom, transparent, #53fc18, transparent); box-shadow: 0 0 16px rgba(83,252,24,0.9); opacity: 0; pointer-events: none; }
        .ac-status-scan { opacity: 0; }
        .ac-status-done { opacity: 1; }
        .ac-thumb { aspect-ratio: 3 / 4; }
        .autoclip-css .ac-scan { animation: acScan 1.85s cubic-bezier(0.4,0,0.2,1) 0.25s both; }
        @keyframes acScan { 0% { opacity: 0; left: 0; } 8% { opacity: 1; } 86% { opacity: 1; left: calc(100% - 6px); } 100% { opacity: 0; left: calc(100% - 6px); } }
        .autoclip-css .ac-bar.ac-hot { animation: acHot 0.55s ease both; animation-delay: var(--d, 0.8s); }
        @keyframes acHot { 0% { transform: scaleY(0.55); filter: brightness(0.5); } 45% { transform: scaleY(1.12); filter: brightness(1.7); } 100% { transform: scaleY(1); filter: brightness(1); } }
        .autoclip-css .ac-status-scan { animation: acAnalyzing 1.9s ease 0.25s both; }
        @keyframes acAnalyzing { 0% { opacity: 1; } 82% { opacity: 1; } 100% { opacity: 0; } }
        .autoclip-css .ac-status-done { animation: acReady 0.5s cubic-bezier(0.16,1,0.3,1) 2s both; }
        @keyframes acReady { 0% { opacity: 0; transform: translateY(4px); } 100% { opacity: 1; transform: none; } }
        .autoclip-css .ac-card { animation: acCardIn 0.6s cubic-bezier(0.16,1,0.3,1) both; animation-delay: var(--d, 2s); transform-origin: center bottom; }
        @keyframes acCardIn { 0% { opacity: 0; transform: translateY(26px) scale(0.94) rotateX(10deg); } 100% { opacity: 1; transform: none; } }
        .autoclip-css .ac-score { animation: acPop 0.5s cubic-bezier(0.16,1,0.3,1) both; animation-delay: calc(var(--d, 2s) + 0.3s); }
        @keyframes acPop { 0% { opacity: 0; transform: scale(0.4); } 60% { transform: scale(1.14); } 100% { opacity: 1; transform: none; } }
        @media (prefers-reduced-motion: reduce) {
          .autoclip-css .ac-scan, .autoclip-css .ac-bar.ac-hot, .autoclip-css .ac-status-scan,
          .autoclip-css .ac-status-done, .autoclip-css .ac-card, .autoclip-css .ac-score { animation: none !important; }
        }
        /* hero reel polish (clip cards + timeline) */
        .ac-scene { position: absolute; inset: 0; background: radial-gradient(60% 42% at 50% 36%, rgba(83,252,24,0.12), transparent 70%), radial-gradient(46% 34% at 50% 82%, rgba(255,255,255,0.05), transparent 72%); }
        .ac-base { position: absolute; left: 20px; right: 20px; bottom: 10px; height: 1px; background: linear-gradient(90deg, transparent, rgba(83,252,24,0.35), transparent); }
        .ac-tc { position: absolute; bottom: 3px; font-size: 8px; letter-spacing: 0.1em; color: rgba(168,162,158,0.5); }
        .ac-tc-a { left: 20px; }
        .ac-tc-b { right: 20px; }
        .ac-prog { box-shadow: 0 0 8px rgba(83,252,24,0.6); }
        /* hero: interactive pipeline */
        .pl-track { cursor: grab; }
        .pl-track.is-grabbing { cursor: grabbing; }
        .pl-rail { box-shadow: inset 0 0 0 1px rgba(255,255,255,0.04); }
        .pl-fill { transform: scaleX(var(--p, 0)); transform-origin: left center; will-change: transform; background-color: #53fc18; box-shadow: 0 0 10px rgba(83,252,24,0.55), inset 0 0 6px rgba(255,255,255,0.25); opacity: var(--seam, 1); }
        .pl-tick { transition: background-color 0.2s ease, box-shadow 0.2s ease; }
        .pl-tick-on { box-shadow: 0 0 6px rgba(83,252,24,0.85); }
        .pl-head { left: 0; width: 100%; z-index: 5; pointer-events: none; transform: translateX(calc(var(--p, 0) * 100%)); will-change: transform; opacity: var(--seam, 1); }
        .pl-head-line { position: absolute; left: 0; top: 0; bottom: 0; width: 2px; transform: translateX(-1px); border-radius: 1px; background: linear-gradient(to bottom, rgba(83,252,24,0) 0%, #53fc18 28%, #53fc18 72%, rgba(83,252,24,0) 100%); box-shadow: 0 0 8px rgba(83,252,24,0.85); }
        .pl-head-cap { position: absolute; left: 0; top: 50%; width: 11px; height: 11px; transform: translate(-50%, -50%) rotate(45deg); border-radius: 2px; background: #53fc18; box-shadow: 0 0 10px rgba(83,252,24,0.95), 0 0 22px rgba(83,252,24,0.55); animation: plCap 1.6s ease-in-out infinite; }
        .pl-track.is-grabbing .pl-head-cap { transform: translate(-50%, -50%) rotate(45deg) scale(1.18); }
        @keyframes plCap { 0%, 100% { box-shadow: 0 0 10px rgba(83,252,24,0.95), 0 0 22px rgba(83,252,24,0.5); } 50% { box-shadow: 0 0 15px rgba(83,252,24,1), 0 0 30px rgba(83,252,24,0.8); } }
        .pl-node { transition: transform 0.18s ease, border-color 0.25s ease, background-color 0.25s ease, box-shadow 0.25s ease; cursor: pointer; }
        .pl-node:hover { transform: translateY(-2px); }
        .pl-node.is-active { box-shadow: 0 0 0 1px rgba(83,252,24,0.3), 0 0 18px rgba(83,252,24,0.12); }
        .pl-node.is-focus { box-shadow: 0 0 0 1px rgba(83,252,24,0.5), 0 8px 24px rgba(83,252,24,0.10); }
        .pl-glyph { display: inline-flex; transition: color 0.25s ease; }
        .pl-glyph svg { transition: filter 0.25s ease; }
        .pl-node.is-active .pl-glyph svg, .pl-node.is-focus .pl-glyph svg { filter: drop-shadow(0 0 4px rgba(83,252,24,0.55)); }
        .pl-val { font-variant-numeric: tabular-nums; letter-spacing: 0.02em; transition: color 0.25s ease; }
        .pl-bar { border-radius: 0 0 0.5rem 0.5rem; overflow: hidden; }
        .pl-bar-fill { width: 100%; transform-origin: left center; transform: scaleX(clamp(0, calc(var(--q, 0) * 6 - var(--i, 0)), 1)); will-change: transform; background-color: #53fc18; box-shadow: 0 0 8px rgba(83,252,24,0.55), 0 0 2px rgba(83,252,24,0.9); }
        .pl-detail { transition: border-color 0.25s ease; }
        .pl-replay { letter-spacing: 0.1em; }
        @keyframes plLive { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
        .pl-live { animation: plLive 1.8s ease-in-out infinite; }
        @keyframes plDot { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(0.7); } }
        .pl-dot { animation: plDot 1s ease-in-out infinite; }
        .pl-node { isolation: isolate; }
        .pl-node::before { content: ""; position: absolute; inset: 0; z-index: 0; pointer-events: none; border-radius: inherit; opacity: 0.7; background-image: repeating-linear-gradient(0deg, rgba(255,255,255,0.03) 0, rgba(255,255,255,0.03) 1px, transparent 1px, transparent 6px); }
        .pl-node > * { position: relative; z-index: 1; }
        .pl-node.is-active { transform: translateY(-2px); box-shadow: 0 0 0 1px rgba(83,252,24,0.45), 0 10px 26px -14px rgba(83,252,24,0.6); }
        .pl-node.is-active::after { content: ""; position: absolute; top: 0; bottom: 0; left: 0; width: 45%; z-index: 0; pointer-events: none; background: linear-gradient(90deg, transparent, rgba(83,252,24,0.10), transparent); animation: plScan 1.9s linear infinite; }
        @keyframes plScan { 0% { transform: translateX(-110%); } 100% { transform: translateX(330%); } }
        .pl-cnr { position: absolute; width: 9px; height: 9px; pointer-events: none; border: 0 solid currentColor; color: rgba(255,255,255,0.22); opacity: 0.6; transition: color 0.25s ease, opacity 0.25s ease; }
        .pl-cnr-tl { top: 6px; left: 6px; border-top-width: 1.5px; border-left-width: 1.5px; border-top-left-radius: 3px; }
        .pl-cnr-br { bottom: 6px; right: 6px; border-bottom-width: 1.5px; border-right-width: 1.5px; border-bottom-right-radius: 3px; }
        .pl-node.is-done .pl-cnr { color: #53fc18; opacity: 0.8; }
        .pl-node.is-active .pl-cnr, .pl-node.is-focus .pl-cnr { color: #53fc18; opacity: 1; }
        .pl-caret { display: none; width: 2px; height: 12px; margin: 0 1px 0 3px; vertical-align: -1px; border-radius: 1px; background: #53fc18; box-shadow: 0 0 6px rgba(83,252,24,0.9); }
        .pl-node.is-active .pl-caret { display: inline-block; animation: plCaret 1s step-end infinite; }
        @keyframes plCaret { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
        @media (prefers-reduced-motion: reduce) {
          .pl-live, .pl-dot, .pl-head-cap, .pl-node.is-active::after, .pl-caret { animation: none !important; }
          .pl-fill, .pl-node, .pl-tick, .pl-bar-fill, .pl-val, .pl-glyph svg { transition: none !important; }
        }

        /* ── Phase 4 · page transitions ─────────────────── */
        .page-transition { animation: pageIn 0.32s cubic-bezier(0.16, 1, 0.3, 1) both; }
        @keyframes pageIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
        @media (prefers-reduced-motion: reduce) { .page-transition { animation: none !important; } }

        /* ── Command palette (⌘K) — Raycast/Linear-style launcher ─────────
           Glass panel over a dimmed page; instant filter; full keyboard nav. */
        .cmdk-backdrop { position: fixed; inset: 0; z-index: 120; background: rgba(0,0,0,0.6);
          backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
          animation: cmdkFade 0.16s ease-out both; }
        @keyframes cmdkFade { from { opacity: 0; } to { opacity: 1; } }
        .cmdk-panel { position: fixed; left: 50%; top: 18vh; z-index: 121; width: min(620px, calc(100vw - 32px));
          transform: translateX(-50%); border-radius: 14px; overflow: hidden;
          background: rgba(12, 12, 10, 0.92);
          border: 1px solid rgba(83,252,24,0.22);
          box-shadow: 0 0 0 1px rgba(0,0,0,0.6), 0 30px 90px -20px rgba(0,0,0,0.9), 0 0 80px -30px rgba(83,252,24,0.45);
          animation: cmdkPop 0.18s cubic-bezier(0.16, 1, 0.3, 1) both; }
        @keyframes cmdkPop { from { opacity: 0; transform: translateX(-50%) translateY(8px) scale(0.985); }
                             to { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); } }
        .cmdk-item[data-active="true"] { background: rgba(83,252,24,0.08); }
        .cmdk-item[data-active="true"] .cmdk-glyph { color: #53fc18; }
        kbd.kbd { padding: 2px 6px; border-radius: 5px; border: 1px solid rgba(255,255,255,0.14);
          border-bottom-width: 2px; background: rgba(255,255,255,0.04); font-size: 10px;
          font-family: 'JetBrains Mono', monospace; color: #a8a29e; line-height: 1.4; }

        /* ── Hero aurora — slow drifting light field behind the headline ── */
        .aurora { position: absolute; pointer-events: none; filter: blur(70px); opacity: 0.5; will-change: transform; }
        .aurora-a { width: 46rem; height: 26rem; top: -8rem; left: -10rem; border-radius: 9999px;
          background: radial-gradient(ellipse at 30% 40%, rgba(83,252,24,0.20), transparent 65%);
          animation: auroraA 19s ease-in-out infinite alternate; }
        .aurora-b { width: 38rem; height: 22rem; top: 2rem; left: 22rem; border-radius: 9999px;
          background: radial-gradient(ellipse at 60% 50%, rgba(170,255,102,0.10), transparent 60%);
          animation: auroraB 23s ease-in-out infinite alternate; }
        @keyframes auroraA { from { transform: translate3d(0,0,0) scale(1); } to { transform: translate3d(6rem, 2.5rem, 0) scale(1.12); } }
        @keyframes auroraB { from { transform: translate3d(0,0,0) scale(1.05); } to { transform: translate3d(-5rem, -2rem, 0) scale(0.95); } }

        /* ── Manifesto — each word lights as the statement scrolls through ── */
        .mf-word { color: rgba(255,255,255,0.16); transition: color 0.45s ease, text-shadow 0.45s ease; }
        .mf-word.lit { color: #fafaf9; }
        .mf-word.lit.mf-accent { color: #53fc18; text-shadow: 0 0 26px rgba(83,252,24,0.45); }

        /* ── Bento micro-visuals ─────────────────────────────────────── */
        @keyframes hookCycle { 0%, 26% { opacity: 1; transform: none; } 33%, 93% { opacity: 0; transform: translateY(-6px); } 100% { opacity: 1; transform: none; } }
        .hook-line { opacity: 0; animation: hookCycle 8.4s cubic-bezier(0.16,1,0.3,1) infinite; }
        @keyframes stampPulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(83,252,24,0.35); } 50% { box-shadow: 0 0 0 7px rgba(83,252,24,0); } }
        .stamp-pulse { animation: stampPulse 2.6s ease-out infinite; }
        @keyframes todayBlink { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
        .cal-today { animation: todayBlink 2.2s ease-in-out infinite; }

        /* ── Layout classes (plain CSS; arbitrary Tailwind values don't render
           reliably in this environment) ─────────────────────────────── */
        .cmp-row { display: grid; grid-template-columns: 170px 1fr 1fr 1fr; }
        .score-head { display: grid; gap: 2rem; }
        @media (min-width: 768px) { .score-head { grid-template-columns: 1fr auto; align-items: end; } }
        @media (min-width: 768px) { .score-range-panel { min-width: 220px; } }
        .bento-frame { width: 200px; }
        @media (min-width: 640px) { .bento-frame { width: 230px; } }
        @media (min-width: 768px) { .bento-tall { grid-row: span 2 / span 2; } }
        .cmdk-list { max-height: 46vh; overflow-y: auto; }

        @media (prefers-reduced-motion: reduce) {
          .cmdk-backdrop, .cmdk-panel { animation: none !important; }
          .aurora-a, .aurora-b { animation: none !important; }
          .mf-word { transition: none !important; color: #fafaf9; }
          .mf-word.mf-accent { color: #53fc18; }
          .hook-line, .stamp-pulse, .cal-today { animation: none !important; }
          .hook-line { opacity: 0; }
          .hook-line:first-child { opacity: 1; }
        }

        /* Dependency-free stand-in for the pricing card's motion hover. */
        .pricing-card-hover { transition: transform 0.3s cubic-bezier(0.16,1,0.3,1); }
        .pricing-card-hover:hover { transform: translateY(-6px); }
        .pricing-card-hover:active { transform: scale(0.99); }
        @media (prefers-reduced-motion: reduce) {
          .cta-glow { animation: none !important; }
          .reveal { transform: none; }
        }

        .cm-range { -webkit-appearance: none; appearance: none; width: 100%; height: 4px; border-radius: 999px;
          background: linear-gradient(90deg, #53fc18 var(--fill, 30%), rgba(255,255,255,0.10) var(--fill, 30%)); outline: none; }
        .cm-range::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 20px; height: 20px; border-radius: 50%;
          background: #53fc18; border: 3px solid #0a0a0a; box-shadow: 0 0 0 1px rgba(83,252,24,0.6), 0 0 16px rgba(83,252,24,0.8); cursor: grab; transition: transform 0.15s ease; }
        .cm-range::-webkit-slider-thumb:active { cursor: grabbing; transform: scale(1.12); }
        .cm-range::-moz-range-thumb { width: 20px; height: 20px; border-radius: 50%; background: #53fc18; border: 3px solid #0a0a0a;
          box-shadow: 0 0 0 1px rgba(83,252,24,0.6), 0 0 16px rgba(83,252,24,0.8); cursor: grab; }
        .cm-val { transition: color 0.2s ease; will-change: contents; }
        .cm-tile { transition: border-color 0.3s ease, background-color 0.3s ease; }
        .cm-hero-glow { animation: cmBreathe 6s ease-in-out infinite; }
        @keyframes cmBreathe {
          0%, 100% { box-shadow: 0 0 0 1px rgba(83,252,24,0.12), 0 0 26px -10px rgba(83,252,24,0.35); }
          50% { box-shadow: 0 0 0 1px rgba(83,252,24,0.3), 0 0 50px -6px rgba(83,252,24,0.6); }
        }

        /* ── Wow layer (additive — same layout, same palette) ──────────
           1 · Living headlines: every .gradient-green now breathes. The light
           travels through the gradient instead of sitting still, with a faint
           neon halo so the green reads as emitted light, not flat ink. */
        .gradient-green {
          background: linear-gradient(110deg, #53fc18 0%, #d9ffb0 26%, #53fc18 50%, #b8ff7d 76%, #53fc18 100%);
          background-size: 240% 240%;
          -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
          animation: greenFlow 8s ease-in-out infinite;
          filter: drop-shadow(0 0 22px rgba(83,252,24,0.18));
        }
        /* 2 · Aurora canopy: two counter-rotating conic washes pinned to the
           top of the viewport, masked downward — cinematic depth behind every
           page without touching a single section. */
        .aurora {
          position: fixed; top: -22vh; left: -10vw; right: -10vw; height: 76vh;
          z-index: 0; pointer-events: none; overflow: hidden; opacity: 0.55;
          -webkit-mask-image: linear-gradient(to bottom, #000 30%, transparent 100%);
          mask-image: linear-gradient(to bottom, #000 30%, transparent 100%);
        }
        .aurora > span {
          position: absolute; left: 50%; top: 40%; width: 135vmax; height: 135vmax;
          border-radius: 50%; mix-blend-mode: screen; will-change: transform;
          background: conic-gradient(from 0deg,
            transparent 0deg, rgba(83,252,24,0.055) 60deg, transparent 130deg,
            rgba(170,255,102,0.04) 210deg, transparent 290deg);
          transform: translate(-50%, -50%); filter: blur(56px);
          animation: auroraSpin 48s linear infinite;
        }
        .aurora > span:nth-child(2) { animation-duration: 70s; animation-direction: reverse; opacity: 0.75; }
        @keyframes auroraSpin { to { transform: translate(-50%, -50%) rotate(360deg); } }
        /* Soft cinematic vignette so edges fall away and the neon pops. */
        .edge-vignette {
          position: fixed; inset: 0; z-index: 1; pointer-events: none;
          background: radial-gradient(120% 95% at 50% 28%, transparent 58%, rgba(0,0,0,0.5) 100%);
        }
        /* 3 · Section seams: every existing divider gains a glowing neon
           center — the borders are untouched, the light is layered on top. */
        section.border-t::before {
          content: ''; position: absolute; top: -1px; left: 12%; right: 12%; height: 1px;
          pointer-events: none; opacity: 0.55;
          background: linear-gradient(90deg, transparent, rgba(83,252,24,0.45), transparent);
          filter: drop-shadow(0 0 6px rgba(83,252,24,0.4));
        }
        /* 4 · Reveals now settle out of a soft blur — same rise, more cinema. */
        .reveal {
          filter: blur(8px);
          transition: opacity 1.1s cubic-bezier(0.16, 1, 0.3, 1),
                      transform 1.1s cubic-bezier(0.16, 1, 0.3, 1),
                      filter 1.0s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .reveal.in { filter: blur(0); }
        /* 5 · Card spotlight: .card-lift cards carry a pointer-tracked pool
           of light (vars set by a delegated listener in the shell). */
        .card-lift { position: relative; }
        .card-lift::after {
          content: ''; position: absolute; inset: 0; border-radius: inherit; pointer-events: none;
          opacity: var(--sh, 0); transition: opacity 0.35s ease;
          background: radial-gradient(320px circle at var(--sx, 50%) var(--sy, 50%), rgba(83,252,24,0.10), transparent 65%);
        }
        /* 6 · 3D tilt: the hero visual AND every .tilt-card panel lean toward
           the cursor (shared engine: useTiltEngine). The transition-property
           override stops utility/hover transitions fighting the per-frame
           transform the engine writes. */
        .tilt-wrap { perspective: 1300px; }
        .tilt-3d { transform-style: preserve-3d; will-change: transform; }
        .tilt-card { will-change: transform;
          transition-property: border-color, box-shadow, background-color, color, opacity, filter !important; }
        /* 7 · Announcement banner: a slow light sweep across the neon bar. */
        .banner-sheen { position: relative; overflow: hidden; }
        .banner-sheen::after {
          content: ''; position: absolute; top: 0; bottom: 0; left: -45%; width: 34%;
          pointer-events: none; transform: skewX(-14deg);
          background: linear-gradient(105deg, transparent, rgba(255,255,255,0.4), transparent);
          animation: bannerSweep 5.5s cubic-bezier(0.7, 0, 0.3, 1) infinite;
        }
        @keyframes bannerSweep { 0% { left: -45%; } 55% { left: 115%; } 100% { left: 115%; } }
        /* 8 · Sticky nav: neon hairline glow along the bottom edge. */
        nav.sticky::after {
          content: ''; position: absolute; left: 0; right: 0; bottom: -1px; height: 1px;
          pointer-events: none; opacity: 0.6;
          background: linear-gradient(90deg, transparent 4%, rgba(83,252,24,0.4) 50%, transparent 96%);
        }
        /* 9 · Logo: the scissors snap to attention on hover. */
        .logo-btn svg { transition: transform 0.55s cubic-bezier(0.16, 1, 0.3, 1), filter 0.4s ease; }
        .logo-btn:hover svg { transform: rotate(-12deg) scale(1.07); filter: drop-shadow(0 0 12px rgba(83,252,24,0.55)); }
        /* 10 · Footer watermark: a giant gradient wordmark fading into black. */
        .footer-watermark {
          display: block; width: 100%; text-align: center; pointer-events: none; user-select: none;
          font-size: clamp(56px, 11.5vw, 176px); line-height: 0.86; letter-spacing: -0.04em;
          padding-top: 34px; margin-bottom: -0.12em;
          background: linear-gradient(to bottom, rgba(83,252,24,0.20), rgba(83,252,24,0.02) 80%);
          -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
          -webkit-mask-image: linear-gradient(to bottom, #000 25%, transparent 96%);
          mask-image: linear-gradient(to bottom, #000 25%, transparent 96%);
        }
        @media (prefers-reduced-motion: reduce) {
          .gradient-green, .aurora > span, .banner-sheen::after { animation: none !important; }
          .reveal { filter: none !important; }
          .card-lift::after { display: none !important; }
          .tilt-3d, .tilt-card { transform: none !important; }
          .logo-btn:hover svg { transform: none; }
        }
      `}</style>

      <div className="grain" />

      {/* Top announcement banner */}
      <button
        onClick={bookCall}
        className="banner-sheen relative z-30 w-full block bg-[#53fc18] text-black hover:bg-[#48e012] group transition-colors"
      >
        <div className="max-w-[1400px] mx-auto px-6 md:px-8 py-2.5 flex items-center justify-center gap-3 text-xs font-medium">
          <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-black/15">
            <span className="w-1.5 h-1.5 rounded-full bg-black animate-pulse-soft" />
          </span>
          <span className="tracking-tight">Now onboarding our first content partners · book a demo</span>
          <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
        </div>
      </button>

      {/* Ambient orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 grid-bg" />
        <div className="absolute -top-40 -left-40 w-[700px] h-[700px] rounded-full bg-[#53fc18]/[0.06] blur-[160px] animate-ambient" />
        <div className="absolute top-[40%] -right-40 w-[600px] h-[600px] rounded-full bg-[#53fc18]/[0.04] blur-[160px] animate-ambient" style={{ animationDelay: '4s' }} />
        <div className="absolute bottom-0 left-[30%] w-[500px] h-[500px] rounded-full bg-[#53fc18]/[0.02] blur-[160px] animate-ambient" style={{ animationDelay: '8s' }} />
      </div>

      {/* Primary nav */}
      <nav className="relative z-20 border-b border-white/[0.06] backdrop-blur-xl bg-black/60 sticky top-0">
        <div className="max-w-[1400px] mx-auto px-6 md:px-8 py-5 flex items-center justify-between animate-fade-in">
          {/* Left: logo + boxed nav links grouped together */}
          <div className="flex items-center gap-4 lg:gap-7">
            <button onClick={() => handleNav('home')} className="logo-btn flex items-center gap-3 flex-shrink-0">
              <LogoMark size={32} />
              <span className="serif text-2xl tracking-tight">Clipper<span className="text-[#53fc18]">.ai</span></span>
            </button>

            {/* Desktop nav — quiet text links; the CTA owns the neon */}
            <div className="hidden md:flex items-center gap-1 lg:gap-2 text-sm">
              {navItems.map((item) => (
                <button
                  key={item.k}
                  onClick={() => handleNav(item.k)}
                  className={`relative px-4 lg:px-5 py-2.5 rounded-lg whitespace-nowrap transition-colors duration-300 group ${page === item.k ? 'text-[#53fc18]' : 'text-stone-400 hover:text-stone-100'}`}
                >
                  {item.l}
                  <span
                    className={`absolute left-4 right-4 lg:left-5 lg:right-5 bottom-1.5 h-px bg-[#53fc18] origin-left transition-transform duration-300 ${page === item.k ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100'}`}
                    style={{ boxShadow: '0 0 8px rgba(83,252,24,0.7)' }}
                    aria-hidden="true"
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Right cluster: auth + CTA + mobile menu */}
          <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
            <button
              onClick={() => setCmdOpen(true)}
              aria-label="Open command palette"
              className="hidden md:inline-flex items-center gap-2 px-3 py-2 rounded-md border border-white/[0.1] text-xs mono text-stone-400 hover:text-stone-100 hover:border-[#53fc18]/30 transition-colors"
            >
              <Search className="w-3.5 h-3.5" />
              <kbd className="kbd">⌘K</kbd>
            </button>
            <button onClick={bookCall} className="btn-neon group px-3 md:px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap">
              Book a demo
            </button>
            {/* Mobile hamburger — visible below md */}
            <button
              onClick={() => setMobileOpen((v) => !v)}
              className="md:hidden relative w-10 h-10 rounded-md border border-[#53fc18]/[0.12] flex items-center justify-center hover:bg-[#53fc18]/[0.08] hover:border-white/[0.16]"
              aria-label="Menu"
              aria-expanded={mobileOpen}
            >
              <div className="relative w-4 h-4">
                <span
                  className="absolute left-0 right-0 h-px bg-stone-200 origin-center"
                  style={{
                    top: mobileOpen ? '50%' : '25%',
                    transform: mobileOpen ? 'translateY(-50%) rotate(45deg)' : 'translateY(0) rotate(0)',
                    transition: 'top 0.4s cubic-bezier(0.16, 1, 0.3, 1), transform 0.4s cubic-bezier(0.16, 1, 0.3, 1) 0.15s',
                  }}
                />
                <span
                  className="absolute left-0 right-0 h-px bg-stone-200 top-1/2 -translate-y-1/2"
                  style={{
                    opacity: mobileOpen ? 0 : 1,
                    transform: mobileOpen ? 'scaleX(0)' : 'scaleX(1)',
                    transition: 'opacity 0.2s ease, transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                  }}
                />
                <span
                  className="absolute left-0 right-0 h-px bg-stone-200 origin-center"
                  style={{
                    bottom: mobileOpen ? '50%' : '25%',
                    transform: mobileOpen ? 'translateY(50%) rotate(-45deg)' : 'translateY(0) rotate(0)',
                    transition: 'bottom 0.4s cubic-bezier(0.16, 1, 0.3, 1), transform 0.4s cubic-bezier(0.16, 1, 0.3, 1) 0.15s',
                  }}
                />
              </div>
            </button>
          </div>
        </div>

        {/* Mobile menu drawer */}
        <div
          className="md:hidden overflow-hidden border-t border-white/[0.12]"
          style={{
            maxHeight: mobileOpen ? '720px' : '0px',
            opacity: mobileOpen ? 1 : 0,
            transition: mobileOpen
              ? 'max-height 0.6s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.4s ease-out 0.05s'
              : 'max-height 0.5s cubic-bezier(0.7, 0, 0.84, 0), opacity 0.2s ease-out',
          }}
        >
          <div className="px-6 py-6 bg-black/80 backdrop-blur-xl">
            {/* Section header */}
            <div className="text-[10px] mono text-stone-500 tracking-[0.2em] uppercase mb-3 px-2">Navigate</div>
            <div className="flex flex-col gap-0.5 mb-6">
              {navItems.map((item, i) => (
                <button
                  key={item.k}
                  onClick={() => handleNav(item.k)}
                  className={`group flex items-center justify-between px-3 py-3 rounded-md text-left ${
                    page === item.k
                      ? 'text-[#53fc18] bg-[#53fc18]/[0.10]'
                      : 'text-stone-300 hover:bg-[#53fc18]/[0.08] hover:text-stone-100'
                  }`}
                  style={{
                    opacity: mobileOpen ? 1 : 0,
                    transform: mobileOpen ? 'translateX(0)' : 'translateX(-8px)',
                    transition: `opacity 0.5s cubic-bezier(0.16, 1, 0.3, 1) ${mobileOpen ? 0.1 + i * 0.04 : 0}s, transform 0.5s cubic-bezier(0.16, 1, 0.3, 1) ${mobileOpen ? 0.1 + i * 0.04 : 0}s`,
                  }}
                >
                  <span className="text-base">{item.l}</span>
                  <ArrowUpRight className={`w-3.5 h-3.5 ${page === item.k ? 'text-[#53fc18]' : 'text-stone-600 group-hover:text-stone-300'}`} />
                </button>
              ))}
            </div>

            {/* Get started section */}
            <div className="text-[10px] mono text-stone-500 tracking-[0.2em] uppercase mb-3 px-2 pt-2 border-t border-white/[0.12]">Start here</div>
            <button
              onClick={() => { setMobileOpen(false); bookCall(); }}
              className="w-full flex items-center justify-between px-3 py-3 rounded-md text-left bg-[#53fc18] text-black font-medium hover:bg-[#48e012]"
              style={{
                opacity: mobileOpen ? 1 : 0,
                transform: mobileOpen ? 'translateX(0)' : 'translateX(-8px)',
                transition: `opacity 0.5s cubic-bezier(0.16, 1, 0.3, 1) ${mobileOpen ? 0.4 : 0}s, transform 0.5s cubic-bezier(0.16, 1, 0.3, 1) ${mobileOpen ? 0.4 : 0}s`,
              }}
            >
              <span>Book a demo</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>

            {/* Status footer in drawer — honest pre-launch posture, links to the real status page */}
            <button
              onClick={() => handleNav('status')}
              className="mt-6 pt-4 border-t border-white/[0.12] w-full flex items-center justify-between text-[10px] mono text-stone-500 tracking-wider uppercase hover:text-stone-300"
              style={{
                opacity: mobileOpen ? 1 : 0,
                transition: `opacity 0.5s ease-out ${mobileOpen ? 0.5 : 0}s`,
              }}
            >
              <div className="flex items-center gap-2">
                <span className="w-1 h-1 rounded-full bg-[#53fc18] animate-pulse-soft" />
                <span>Pre-launch · onboarding first partners</span>
              </div>
              <span>Status →</span>
            </button>
          </div>
        </div>
      </nav>

      <main id="main">{children}</main>

      <CommandPalette
        open={cmdOpen}
        onClose={() => setCmdOpen(false)}
        goto={goto}
        bookCall={bookCall}
        openApp={openApp}
      />

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/[0.12] overflow-hidden">
        <div className="footer-watermark serif" aria-hidden="true">Clipper.ai</div>
        <div className="max-w-[1400px] mx-auto px-6 md:px-8 py-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Brand */}
          <div className="flex items-center gap-2.5">
            <LogoMark size={20} />
            <span className="serif text-base">Clipper<span className="text-[#53fc18]">.ai</span></span>
            <span className="hidden lg:inline text-xs text-stone-600 ml-2">Long videos in. Viral clips out.</span>
          </div>

          {/* Inline link cluster — every page on the site is reachable from here */}
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
            {[
              ['How it works', 'product'],
              ['Pricing', 'pricing'],
              ['Company', 'company'],
              ['Resources', 'docs'],
              ['Status', 'status'],
            ].map(([label, target]) => (
              <button key={label} onClick={() => goto(target)} className="text-stone-400 hover:text-[#53fc18]">
                {label}
              </button>
            ))}
          </div>

          {/* Copyright + honest posture line — no certifications are claimed
              that the TrustStrip doesn't already qualify. */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] mono text-stone-500 tracking-wider uppercase">
            <span>© 2026 Clipper.ai</span>
            <span className="text-stone-700">·</span>
            <button onClick={() => goto('privacy')} className="hover:text-stone-300 uppercase tracking-wider">Privacy</button>
            <button onClick={() => goto('terms')} className="hover:text-stone-300 uppercase tracking-wider">Terms</button>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ──────────────────────────────────────────────────────── COMMAND PALETTE
   ⌘K launcher in the Raycast/Linear mold: every page and primary action one
   keystroke away. Opens from the nav chip or the keyboard; filter-as-you-type;
   full arrow/enter/escape support. Rendered by SiteShell so it works on every
   marketing page. */
function CommandPalette({ open, onClose, goto, bookCall, openApp }) {
  const [q, setQ] = useState('');
  const [idx, setIdx] = useState(0);
  const inputRef = useRef(null);

  const actions = useMemo(() => [
    { group: 'Actions', icon: ArrowUpRight, label: 'Book a demo', hint: 'Talk to us', run: () => bookCall && bookCall() },
    { group: 'Actions', icon: Play, label: 'Watch the sample run', hint: 'Live pipeline', run: () => openApp && openApp() },
    { group: 'Go to', icon: Film, label: 'Home', run: () => goto('home') },
    { group: 'Go to', icon: Workflow, label: 'How it works', run: () => goto('product') },
    { group: 'Go to', icon: Layers, label: 'Pricing', run: () => goto('pricing') },
    { group: 'Go to', icon: Building2, label: 'Company', run: () => goto('company') },
    { group: 'Go to', icon: BookOpen, label: 'Resources', run: () => goto('docs') },
    { group: 'Go to', icon: Globe, label: 'Status', run: () => goto('status') },
  ], [goto, bookCall, openApp]);

  const norm = q.trim().toLowerCase();
  const shown = norm ? actions.filter((a) => (a.group + ' ' + a.label + ' ' + (a.hint || '')).toLowerCase().includes(norm)) : actions;

  // Reset + focus on open.
  useEffect(() => {
    if (!open) return;
    setQ('');
    setIdx(0);
    const t = setTimeout(() => inputRef.current && inputRef.current.focus(), 30);
    return () => clearTimeout(t);
  }, [open]);
  useEffect(() => { setIdx(0); }, [norm]);

  // Keyboard nav while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); setIdx((i) => Math.min(shown.length - 1, i + 1)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((i) => Math.max(0, i - 1)); }
      else if (e.key === 'Enter') {
        e.preventDefault();
        const a = shown[idx];
        if (a) { onClose(); a.run(); track('cmdk_run', { label: a.label }); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, shown, idx, onClose]);

  if (!open) return null;

  let lastGroup = null;
  return (
    <>
      <div className="cmdk-backdrop" onClick={onClose} />
      <div className="cmdk-panel" role="dialog" aria-modal="true" aria-label="Command palette">
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/[0.08]">
          <Search className="w-4 h-4 text-stone-500 flex-shrink-0" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Where to?"
            aria-label="Search pages and actions"
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-stone-600 text-stone-100"
          />
          <kbd className="kbd">esc</kbd>
        </div>
        <div className="cmdk-list py-2">
          {shown.length === 0 && (
            <div className="px-4 py-6 text-sm text-stone-500">Nothing matches “{q.trim()}”.</div>
          )}
          {shown.map((a, i) => {
            const header = a.group !== lastGroup ? a.group : null;
            lastGroup = a.group;
            return (
              <div key={a.label}>
                {header && (
                  <div className="px-4 pt-2 pb-1 text-[10px] mono tracking-[0.18em] uppercase text-stone-600">{header}</div>
                )}
                <button
                  data-active={i === idx}
                  onMouseEnter={() => setIdx(i)}
                  onClick={() => { onClose(); a.run(); track('cmdk_run', { label: a.label }); }}
                  className="cmdk-item w-full flex items-center gap-3 px-4 py-2.5 text-left"
                >
                  <a.icon className="cmdk-glyph w-4 h-4 text-stone-500 flex-shrink-0" />
                  <span className="text-sm text-stone-200 flex-1">{a.label}</span>
                  {a.hint && <span className="text-[10px] mono text-stone-600 tracking-wider uppercase">{a.hint}</span>}
                  {i === idx && <kbd className="kbd">↵</kbd>}
                </button>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-3 px-4 py-2.5 border-t border-white/[0.08] text-[10px] mono text-stone-600 tracking-wider">
          <span className="flex items-center gap-1.5"><kbd className="kbd">↑↓</kbd> navigate</span>
          <span className="flex items-center gap-1.5"><kbd className="kbd">↵</kbd> select</span>
        </div>
      </div>
    </>
  );
}

/* ──────────────────────────────────────────────────────────── PAGE HELPERS */
function PageHero({ eyebrow, title, italic, sub }) {
  return (
    <section className="relative z-10 max-w-[1400px] mx-auto px-6 md:px-8 pt-16 md:pt-24 pb-16 md:pb-20 animate-blur-in overflow-hidden">
      <NeonGrid />
      <div className="relative max-w-4xl">
        <div className="flex items-center gap-2 mb-6">
          <span className="w-6 h-px bg-[#53fc18]" />
          <span className="text-[10px] mono text-[#53fc18] tracking-[0.2em] uppercase">{eyebrow}</span>
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
function LegalSection({ title, children }) {
  return (
    <div className="mb-10">
      <h2 className="serif text-2xl mb-3">{title}</h2>
      <div className="text-sm text-stone-400 leading-relaxed space-y-3">{children}</div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────── FAQ ITEM
   Reusable accordion row used by both the global FAQ and pricing FAQ */
function FAQItem({ q, a, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div
      className={`rounded-xl border overflow-hidden ${open ? 'border-[#53fc18]/30 bg-[#53fc18]/[0.015]' : 'border-white/[0.06] hover:border-white/[0.12]'}`}
      style={{ transition: 'border-color 0.4s cubic-bezier(0.16, 1, 0.3, 1), background-color 0.4s cubic-bezier(0.16, 1, 0.3, 1)' }}
    >
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-4 p-6 text-left"
      >
        <div className={`text-base font-medium flex-1 ${open ? 'text-stone-100' : 'text-stone-300'}`}>{q}</div>
        <div
          className="w-6 h-6 rounded-full border border-white/[0.1] flex items-center justify-center flex-shrink-0"
          style={{
            transform: open ? 'rotate(45deg)' : 'rotate(0deg)',
            transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
            borderColor: open ? 'rgba(83,252,24,0.4)' : '',
          }}
        >
          <svg className="text-stone-400" width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M6 1.5v9M1.5 6h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
        </div>
      </button>
      <div
        style={{
          maxHeight: open ? '400px' : '0px',
          opacity: open ? 1 : 0,
          transition: open
            ? 'max-height 0.5s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease-out 0.1s'
            : 'max-height 0.4s cubic-bezier(0.7, 0, 0.84, 0), opacity 0.2s ease-out',
          overflow: 'hidden',
        }}
      >
        <div className="px-6 pb-6 text-stone-400 leading-relaxed">{a}</div>
      </div>
    </div>
  );
}

function FAQ() {
  const items = [
    {
      q: 'What\u2019s the turnaround?',
      a: "Your first batch of clips typically lands within 48\u201372 hours of us receiving a recording. After that, we keep a steady weekly stream running behind your show so there\u2019s always something to post.",
    },
    {
      q: 'Do I keep approval over what gets published?',
      a: "Always. Nothing goes out without your sign-off unless you explicitly ask us to publish on your behalf. You can approve clips as-is, request changes, or have us post on your schedule. The level of control is yours to set.",
    },
    {
      q: 'What do I actually need to send you?',
      a: "Just your long-form: a podcast, interview, livestream, webinar, or YouTube link. Drop a file or a URL and we handle transcription, clip selection, editing, formatting, and captions from there. No software for you to learn, no timeline to touch.",
    },
    {
      q: 'How is this different from hiring an editor or an agency?',
      a: "An editor gives you one person\u2019s hours. An agency gives you a slower, pricier version of the same. We pair AI systems that surface and cut the strongest moments at scale with human editors who review every clip, so you get an agency-grade output at a fraction of the cost and turnaround, every week.",
    },
  ];
  const [open, setOpen] = useState(0);

  return (
    <section id="faq" className="relative z-10 max-w-[1400px] mx-auto px-8 pt-16 pb-10 border-t border-white/[0.12] overflow-hidden">
      <GlowOrb size={500} opacity={0.08} className="-left-32 top-1/2" />
      <Reveal>
        <div className="grid md:grid-cols-[1fr_1.6fr] gap-16">
          <div className="md:sticky md:top-32 self-start">
            <div className="text-[10px] mono text-[#53fc18] mb-4 tracking-[0.2em] uppercase flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[#53fc18]" /> Frequently asked</div>
            <h2 className="serif text-5xl leading-[1.05] mb-4">
              The answers <span className="italic text-stone-400">to the questions we keep getting.</span>
            </h2>
            <p className="text-stone-400 leading-relaxed">
              Don't see yours? <a className="text-[#53fc18] hover:underline cursor-pointer">Email us</a>. We read everything.
            </p>
          </div>

          <div className="space-y-2">
            {items.map((item, i) => {
              const isOpen = open === i;
              return (
                <div
                  key={item.q}
                  className={`rounded-xl border overflow-hidden ${isOpen ? 'border-[#53fc18]/30 bg-[#53fc18]/[0.015]' : 'border-white/[0.06] hover:border-white/[0.12]'}`}
                  style={{ transition: 'border-color 0.4s cubic-bezier(0.16, 1, 0.3, 1), background-color 0.4s cubic-bezier(0.16, 1, 0.3, 1)' }}
                >
                  <button
                    onClick={() => setOpen(isOpen ? -1 : i)}
                    className="w-full flex items-center justify-between gap-4 p-6 text-left"
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <div className="mono text-xs text-stone-500 w-6">0{i + 1}</div>
                      <div className={`text-base font-medium ${isOpen ? 'text-stone-100' : 'text-stone-300'}`}>{item.q}</div>
                    </div>
                    <div
                      className="w-6 h-6 rounded-full border border-white/[0.1] flex items-center justify-center flex-shrink-0"
                      style={{
                        transform: isOpen ? 'rotate(45deg)' : 'rotate(0deg)',
                        transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                        borderColor: isOpen ? 'rgba(83,252,24,0.4)' : '',
                      }}
                    >
                      <svg className="text-stone-400" width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M6 1.5v9M1.5 6h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
                    </div>
                  </button>
                  <div
                    style={{
                      maxHeight: isOpen ? '320px' : '0px',
                      opacity: isOpen ? 1 : 0,
                      transition: isOpen
                        ? 'max-height 0.5s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease-out 0.1s'
                        : 'max-height 0.4s cubic-bezier(0.7, 0, 0.84, 0), opacity 0.2s ease-out',
                      overflow: 'hidden',
                    }}
                  >
                    <div className="px-6 pb-6 pl-16 text-stone-400 leading-relaxed">{item.a}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Reveal>
    </section>
  );
}

/* ──────────────────────────────────────────────────────────── CTA BAND */
function CTABand({ goto, openApp, bookCall }) {
  return (
    <section className="relative z-10 max-w-[1400px] mx-auto px-6 md:px-8 pt-12 pb-12 border-t border-white/[0.12] mt-4">
      <Reveal>
        <div className="text-center max-w-3xl mx-auto">
          <div className="text-[10px] mono text-[#53fc18] mb-4 tracking-[0.2em] uppercase flex items-center justify-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[#53fc18]" /> 
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

export { AmbientChrome, CTABand, CommandPalette, FAQ, FAQItem, LegalSection, PageHero, SiteShell };

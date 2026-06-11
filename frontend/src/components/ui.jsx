import React, { useState, useRef, useEffect } from 'react';
import { CheckCircle2, MessageCircle } from 'lucide-react';
import { track } from '../lib/analytics.jsx';
import { prefersReducedMotion } from '../lib/motion.jsx';

function FeedbackWidget({ jobId }) {
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const [rating, setRating] = useState(null);
  const [note, setNote] = useState('');
  const submit = () => {
    setSent(true);
    setTimeout(() => { setOpen(false); setSent(false); setRating(null); setNote(''); }, 1400);
  };
  return (
    <div className="fixed bottom-5 right-5 z-[80] flex flex-col items-end">
      {open && (
        <div className="mb-3 w-72 rounded-xl border border-stone-800 bg-stone-950/95 backdrop-blur p-4 shadow-[0_20px_60px_rgba(0,0,0,0.6)] animate-slide-up">
          {sent ? (
            <div className="flex items-center justify-center gap-2 text-sm text-[#53fc18] py-4">
              <CheckCircle2 className="w-4 h-4" /> Thanks for the feedback
            </div>
          ) : (
            <>
              <div className="text-[10px] mono text-stone-500 tracking-wider uppercase mb-3">Rate these clips</div>
              <div className="flex gap-2 mb-3">
                <button onClick={() => setRating('up')} className={`flex-1 py-2 rounded-lg border text-sm transition ${rating === 'up' ? 'border-[#53fc18] bg-[#53fc18]/10 text-[#53fc18]' : 'border-stone-800 text-stone-400 hover:border-stone-700'}`}>Good</button>
                <button onClick={() => setRating('down')} className={`flex-1 py-2 rounded-lg border text-sm transition ${rating === 'down' ? 'border-amber-400 bg-amber-400/10 text-amber-400' : 'border-stone-800 text-stone-400 hover:border-stone-700'}`}>Off</button>
              </div>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional note\u2026" rows={2} className="w-full rounded-lg bg-stone-900/60 border border-stone-800 px-3 py-2 text-sm text-stone-200 placeholder:text-stone-600 focus:border-stone-600 resize-none mb-3" />
              <button onClick={submit} disabled={!rating} className="w-full py-2 rounded-lg bg-[#53fc18] text-black text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed transition">Send</button>
            </>
          )}
        </div>
      )}
      <button onClick={() => setOpen((o) => !o)} aria-label="Send feedback" className="flex items-center gap-2 px-4 py-2.5 rounded-full border border-stone-800 bg-stone-950/90 backdrop-blur text-sm text-stone-300 hover:border-[#53fc18]/40 hover:text-[#53fc18] transition shadow-lg">
        <MessageCircle className="w-4 h-4" /> Feedback
      </button>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────── COUNT-UP
   Animates a number from 0 to its value once it scrolls into view.
   SSR-safe (renders the final value first) and reduced-motion aware. */
function CountUp({ value, prefix = '', suffix = '', className = '' }) {
  const ref = useRef(null);
  const format = (n) => prefix + Math.round(n).toLocaleString() + suffix;
  // Dependency-free: count from 0 -> value once, when scrolled into view.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (prefersReducedMotion()) { el.textContent = format(value); return; }
    el.textContent = format(0);
    let raf = 0, started = false;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting && !started) {
          started = true;
          const dur = 1200, t0 = performance.now();
          const step = (t) => {
            const p = Math.min(1, (t - t0) / dur);
            const eased = 1 - Math.pow(1 - p, 2); // power2.out
            el.textContent = format(value * eased);
            if (p < 1) raf = requestAnimationFrame(step);
          };
          raf = requestAnimationFrame(step);
          io.disconnect();
        }
      });
    }, { threshold: 0, rootMargin: '0px 0px -12% 0px' });
    io.observe(el);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, [value]);
  return <span ref={ref} className={className}>{format(value)}</span>;
}

// Logo matching the provided Clipper.ai mark — black scissors on neon green rounded square.
// Geometry: two finger-hole circles on the left, blades crossing through a pivot to form an X,
// with tips extending to the upper-right and lower-right.

function LogoMark({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-label="Clipper.ai">
      <rect width="100" height="100" rx="22" fill="#53fc18" />
      {/* Top-left hole crosses to lower-right tip */}
      <line x1="32" y1="32" x2="85" y2="78" stroke="#000" strokeWidth="9" strokeLinecap="round" />
      {/* Bottom-left hole crosses to upper-right tip */}
      <line x1="32" y1="68" x2="85" y2="22" stroke="#000" strokeWidth="9" strokeLinecap="round" />
      {/* Finger holes layered on top */}
      <circle cx="28" cy="32" r="11" fill="#53fc18" stroke="#000" strokeWidth="8" />
      <circle cx="28" cy="68" r="11" fill="#53fc18" stroke="#000" strokeWidth="8" />
    </svg>
  );
}

/* ──────────────────────────────────────────────────────────── GLOW ORB
   Standalone radial green spotlight for backgrounds */
function GlowOrb({ size = 600, color = '#53fc18', opacity = 0.12, className = '' }) {
  return (
    <div
      className={`absolute pointer-events-none rounded-full ${className}`}
      style={{
        width: size,
        height: size,
        background: color,
        opacity,
        filter: `blur(${size / 5}px)`,
      }}
      aria-hidden
    />
  );
}

/* ──────────────────────────────────────────────────────────── HEADLINE BEAM
   A wide horizontal beam of green light behind text */
function HeadlineBeam() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
      <div
        className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 w-[140%] h-32"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(83,252,24,0.18) 0%, transparent 60%)',
          filter: 'blur(40px)',
        }}
      />
    </div>
  );
}

/* ──────────────────────────────────────────────────────────── CUSTOM CURSOR
   A simple green arrow cursor for the Studio app. Tracks the mouse,
   no hover state, no trailing — just the arrow. */
function CrosshairCursor() {
  const arrowRef = useRef(null);
  const gridRef = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'ontouchstart' in window) return;

    let mouseX = -100, mouseY = -100;
    let raf;

    const tick = () => {
      if (arrowRef.current) {
        arrowRef.current.style.transform = `translate(${mouseX}px, ${mouseY}px)`;
      }
      if (gridRef.current) {
        gridRef.current.style.setProperty('--mx', `${mouseX}px`);
        gridRef.current.style.setProperty('--my', `${mouseY}px`);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const onMove = (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      if (!visible) setVisible(true);
    };
    const onLeave = () => setVisible(false);

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseleave', onLeave);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseleave', onLeave);
    };
  }, [visible]);

  if (!visible) return null;

  return (
    <>
      <style>{`
        body, body * { cursor: none !important; }
        @media (hover: none) { body, body * { cursor: auto !important; } }
      `}</style>
      <div
        ref={gridRef}
        aria-hidden
        className="fixed pointer-events-none"
        style={{
          inset: 0,
          zIndex: 90,
          mixBlendMode: 'screen',
          backgroundImage:
            'linear-gradient(rgba(83,252,24,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(83,252,24,0.3) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
          WebkitMaskImage:
            'radial-gradient(circle 78px at var(--mx) var(--my), #000 0%, #000 28%, transparent 72%)',
          maskImage:
            'radial-gradient(circle 78px at var(--mx) var(--my), #000 0%, #000 28%, transparent 72%)',
          '--mx': '-9999px',
          '--my': '-9999px',
        }}
      />
      <svg
        ref={arrowRef}
        width="20"
        height="22"
        viewBox="0 0 20 22"
        className="fixed top-0 left-0 pointer-events-none z-[100]"
        style={{
          filter: 'drop-shadow(0 0 4px rgba(83,252,24,0.6)) drop-shadow(0 1px 2px rgba(0,0,0,0.8))',
        }}
        aria-hidden
      >
        <path
          d="M2 2 L2 17 L6.5 13 L9.5 20 L12 19 L9 12 L15 12 Z"
          fill="#53fc18"
          stroke="#000"
          strokeWidth="0.8"
          strokeLinejoin="round"
        />
      </svg>
    </>
  );
}

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error) { try { track('app_error', { message: String((error && error.message) || error) }); } catch (e) {} }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: '100vh', background: '#000', color: '#e7e5e4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Inter', sans-serif", padding: '24px' }}>
          <div style={{ maxWidth: 420, textAlign: 'center' }}>
            <div style={{ fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#78716c', marginBottom: 12 }}>Something went wrong</div>
            <h1 style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-0.03em', marginBottom: 12, lineHeight: 1.1 }}>This page hit an unexpected error.</h1>
            <p style={{ color: '#a8a29e', lineHeight: 1.6, marginBottom: 24 }}>Reloading usually clears it. If it keeps happening, let us know and we will take a look.</p>
            <button onClick={() => { if (typeof window !== 'undefined') window.location.reload(); }} style={{ background: '#53fc18', color: '#000', border: 'none', padding: '10px 22px', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>Reload</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

/* ──────────────────────────────────────────────────────────── HOOKS */
function useReveal() {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add('in'); }),
      { threshold: 0.15, rootMargin: '0px 0px -10% 0px' }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return ref;
}

function Reveal({ children, delay = 0, className = '' }) {
  const ref = useReveal();
  return (
    <div ref={ref} className={`reveal ${className}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────── NEON GRID
   Decorative animated grid with green glow lines — sits behind heroes */
function NeonGrid() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
      {/* No own grid lines: the uniform page-wide grid (.grid-bg, 64px) shows through
          here. This layer only adds a soft focal glow so the headline area has depth,
          without introducing a second, differently-sized grid that would interfere. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 50% 38%, rgba(83,252,24,0.07), transparent 70%)',
        }}
      />
    </div>
  );
}

export { NeonGrid, CountUp, CrosshairCursor, ErrorBoundary, FeedbackWidget, GlowOrb, HeadlineBeam, LogoMark, Reveal, useReveal };

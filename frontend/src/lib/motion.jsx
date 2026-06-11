import React, { useState, useRef, useEffect } from 'react';

/* ─────────────────────────────────────────────────────────────────────────────
   SELF-CONTAINED SANDBOX BUILD (dependency-free preview port of the Next.js source)
   The Next.js build animates with gsap + motion. Here those are replicated with
   CSS + IntersectionObserver + requestAnimationFrame so this file renders with zero
   external animation deps. All motion respects prefers-reduced-motion. Backend calls
   (runDemoPipeline, fetchShowcase) are simulated in-memory; nothing is persisted.
───────────────────────────────────────────────────────────────────────────── */

// Passthrough so <MotionConfig> markup from the Next.js source still works here.
const MotionConfig = ({ children }) => <>{children}</>;

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* One shared rAF engine for the looping clip players (the InteractiveDemo phone
   and the detail-view canvas). Returns a 0→100 progress number.
   - Time-based: advances by elapsed delta, so it is a true 60fps loop that
     self-corrects for frame timing instead of a fixed-step setInterval.
   - Resumes from the current value when `playing` toggles, so pause/play is seamless.
   - Resets to the start when `resetKey` changes (e.g. a different clip is selected).
   - Reduced motion: never starts the loop and pins a single settled frame
     (`staticPct`) so the UI shows a representative still, not motion.
   Only transform/opacity are animated by consumers, so the per-frame cost is a
   single state update driving compositor-friendly styles. */
function useLoopProgress({ durationMs, playing = true, resetKey, onLoop, staticPct = 58 }) {
  const reduced = prefersReducedMotion();
  const [pct, setPct] = useState(reduced ? staticPct : 0);
  const pctRef = useRef(reduced ? staticPct : 0);
  const onLoopRef = useRef(onLoop);
  onLoopRef.current = onLoop;

  // Snap back to the start (or the static frame) whenever the source changes.
  useEffect(() => {
    const v = reduced ? staticPct : 0;
    pctRef.current = v;
    setPct(v);
  }, [resetKey, reduced, staticPct]);

  // The loop itself. Deliberately excludes resetKey: a reset re-seeds pctRef and
  // this keeps ticking from there, which is what auto-advance between clips wants.
  useEffect(() => {
    if (reduced || !playing) return;
    let raf = 0;
    let last = 0;
    const tick = (t) => {
      if (last) {
        let next = pctRef.current + ((t - last) / durationMs) * 100;
        if (next >= 100) { next -= 100; if (onLoopRef.current) onLoopRef.current(); }
        pctRef.current = next;
        setPct(next);
      }
      last = t;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduced, playing, durationMs]);

  return pct;
}

// ── Demo data (mirrors the inline generateMockClips fixture) ──────────────────

export { MotionConfig, prefersReducedMotion, useLoopProgress };

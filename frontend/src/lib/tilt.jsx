import React, { useEffect } from 'react';

/* Shared 3D tilt engine — every `.tilt-card` panel (and the hero `.tilt-3d`
   visual) leans toward the cursor like a physical pane of glass, exactly like
   the pipeline explorer. ONE delegated listener for the whole document — it
   covers the marketing site AND the studio — and one rAF lerp. Amplitude
   scales down as panels get wider, so the huge hero stays subtle while small
   tiles feel tactile. The transform carries its own perspective(), so no
   wrapper is required, and `--tilt-scale` lets a card keep a resting scale
   (the popular pricing tier).

   Hardened against the "works sometimes" failure modes:
   · The media gate (desktop + fine pointer + motion-OK) is LIVE — if the
     window/iframe starts narrow and is later widened, the engine attaches
     itself the moment the query flips, instead of staying dead until reload.
   · `s.raf` is cleared at the TOP of each frame, so a kick() can always
     reschedule and no anomaly mid-frame can strand the loop with a stale id.
   · Switching cards starts the new card from flat instead of inheriting the
     previous card's pose.
   · Scrolling relaxes any held tilt (the card under a wheel-scrolled pointer
     gets no pointermove, so it would otherwise stay frozen mid-lean). */
function useTiltEngine() {
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(min-width: 768px) and (pointer: fine) and (prefers-reduced-motion: no-preference)');
    const s = { el: null, tx: 0, ty: 0, cx: 0, cy: 0, raf: 0, on: false };

    const apply = () => {
      s.raf = 0; // cleared first: kick() can always re-arm, even if this frame misbehaves
      s.cx += (s.tx - s.cx) * 0.12;
      s.cy += (s.ty - s.cy) * 0.12;
      const settled = Math.abs(s.tx - s.cx) < 0.02 && Math.abs(s.ty - s.cy) < 0.02;
      if (s.el) {
        try {
          s.el.style.transform = settled && s.tx === 0 && s.ty === 0
            ? ''
            : `perspective(1100px) rotateX(${s.cx.toFixed(2)}deg) rotateY(${s.cy.toFixed(2)}deg) scale(var(--tilt-scale, 1))`;
        } catch (e) { /* detached node — drop it */ s.el = null; }
      }
      if (!settled) s.raf = requestAnimationFrame(apply);
      else if (s.tx === 0 && s.ty === 0) s.el = null;
    };
    const kick = () => { if (!s.raf) s.raf = requestAnimationFrame(apply); };
    const relax = () => { if (s.el) { s.tx = 0; s.ty = 0; kick(); } };

    const onMove = (e) => {
      if (!e.target || !e.target.closest) return;
      const t = e.target.closest('.tilt-3d, .tilt-card');
      if (t) {
        if (s.el !== t) {
          if (s.el) s.el.style.transform = '';
          s.el = t;
          s.cx = 0; s.cy = 0; // new card eases up from flat
        }
        const r = t.getBoundingClientRect();
        const px = (e.clientX - r.left) / Math.max(1, r.width) - 0.5;
        const py = (e.clientY - r.top) / Math.max(1, r.height) - 0.5;
        const amp = Math.min(6.5, Math.max(2.4, (950 / Math.max(1, r.width)) * 2.1));
        s.tx = -py * amp;
        s.ty = px * amp * 1.25;
        kick();
      } else {
        relax();
      }
    };

    const enable = () => {
      if (s.on) return;
      s.on = true;
      document.addEventListener('pointermove', onMove, { passive: true });
      document.documentElement.addEventListener('pointerleave', relax);
      window.addEventListener('scroll', relax, { passive: true });
    };
    const disable = () => {
      if (!s.on) return;
      s.on = false;
      document.removeEventListener('pointermove', onMove);
      document.documentElement.removeEventListener('pointerleave', relax);
      window.removeEventListener('scroll', relax);
      cancelAnimationFrame(s.raf);
      s.raf = 0;
      if (s.el) { try { s.el.style.transform = ''; } catch { /* best-effort */ } }
      s.el = null; s.tx = 0; s.ty = 0; s.cx = 0; s.cy = 0;
    };

    // LIVE media gate — attach/detach as the environment changes (window
    // resize, artifact panel widened, pointer plugged in, motion pref toggled).
    const sync = () => (mq.matches ? enable() : disable());
    sync();
    if (mq.addEventListener) mq.addEventListener('change', sync);
    else if (mq.addListener) mq.addListener(sync);
    // Belt-and-braces for environments whose matchMedia never emits 'change'
    // for iframe resizes: re-check on window resize too (cheap boolean).
    window.addEventListener('resize', sync, { passive: true });

    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', sync);
      else if (mq.removeListener) mq.removeListener(sync);
      window.removeEventListener('resize', sync);
      disable();
    };
  }, []);
}

export { useTiltEngine };

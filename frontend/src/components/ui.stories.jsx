import React from 'react';
import { NeonGrid, CountUp, CrosshairCursor, ErrorBoundary, FeedbackWidget, GlowOrb, HeadlineBeam, LogoMark, Reveal } from './ui.jsx';

/* P4 — the marketing/site primitives from ui.jsx, each rendered on the brand
   canvas. Decorative layers (NeonGrid, GlowOrb, HeadlineBeam) are absolute, so
   they get a relative Stage to sit in. */

const Stage = ({ children, h = 160 }) => (
  <div style={{ position: 'relative', height: h, width: 420, border: '1px solid rgba(255,255,255,0.14)', borderRadius: 10, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    {children}
  </div>
);

export default { title: 'Design system/Marketing primitives' };

export const Logo = () => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
    <LogoMark size={28} /><LogoMark size={44} /><LogoMark size={64} />
  </div>
);

export const Counter = () => (
  <div style={{ fontSize: 48, fontWeight: 600, color: 'var(--color-brand)' }}>
    <CountUp value={1240} suffix="+" />
  </div>
);

export const NeonGridGlow = () => (
  <Stage><NeonGrid /><span style={{ position: 'relative', color: '#e7e5e4' }}>NeonGrid focal glow</span></Stage>
);

export const Orb = () => (
  <Stage><GlowOrb size={240} /><span style={{ position: 'relative', color: '#e7e5e4' }}>GlowOrb spotlight</span></Stage>
);

export const Beam = () => (
  <Stage><HeadlineBeam /><h2 style={{ position: 'relative', fontSize: 28, color: '#ffffff', margin: 0 }}>Headline beam</h2></Stage>
);

export const RevealOnScroll = () => (
  <Reveal>
    <div style={{ color: '#e7e5e4', maxWidth: 420 }}>
      Reveal wraps content and fades it in when it scrolls into view (via the useReveal hook).
    </div>
  </Reveal>
);

export const Feedback = () => (
  <div style={{ width: 420, minHeight: 120, color: '#a8a29e' }}>
    The floating feedback widget — pinned bottom-right in the app. Click it to open the rating popover.
    <FeedbackWidget jobId="demo" />
  </div>
);

export const Cursor = () => (
  <div style={{ width: 420, color: '#a8a29e' }}>
    CrosshairCursor is the Studio app&apos;s custom green arrow + grid spotlight. It mounts globally and
    appears on mouse-move (renders nothing until then).
    <CrosshairCursor />
  </div>
);

const Boom = () => { throw new Error('Demo render error — this is intentional'); };
export const ErrorFallback = () => (
  <div style={{ width: 540 }}>
    <ErrorBoundary><Boom /></ErrorBoundary>
  </div>
);

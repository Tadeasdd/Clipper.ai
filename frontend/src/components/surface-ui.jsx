/* U3 — shared inline-style primitives for the two product surfaces (/ops and
   /portal). Both apps previously re-declared this set byte-for-byte; the portal
   did so deliberately to avoid dragging the ops surfaces into its bundle.

   This module imports ONLY React, so it stays a leaf: /portal can compose these
   without pulling /ops/Board, /ops/ReviewDesk, etc. into its chunk. Surfaces
   that genuinely differ between the two apps (Dot's animation name, StatusChip's
   client-facing labels, ErrorBand copy, Empty, PageTitle, the STATUS_COLOR maps)
   stay declared per-app — only the identical primitives live here. */
import React from 'react';

/* ── design tokens (one place) ────────────────────────────────────────── */
export const T = {
  line: 'rgba(255,255,255,0.08)',
  lineSoft: 'rgba(255,255,255,0.05)',
  dim: '#71717a',
  text: '#e7e5e4',
  green: 'var(--color-brand)',
  amber: '#fbbf24',
  red: '#f87171',
  panel: 'rgba(255,255,255,0.022)',
};

export const Mono = ({ children, className = '', style }) => (
  <span className={`mono ${className}`} style={style}>{children}</span>
);
export const Label = ({ children, style }) => (
  <div className="mono uppercase" style={{ fontSize: 10, letterSpacing: '0.18em', color: T.dim, ...style }}>{children}</div>
);
export const Panel = ({ children, className = '', style }) => (
  <section className={className || undefined} style={{ border: `1px solid ${T.line}`, background: T.panel, borderRadius: 10, ...style }}>
    {children}
  </section>
);
export const PanelHead = ({ title, right }) => (
  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '12px 16px', borderBottom: `1px solid ${T.lineSoft}` }}>
    <Label>{title}</Label>
    {right}
  </div>
);
export const btnStyle = (accent) => ({
  fontSize: 11, padding: '5px 12px', borderRadius: 6, cursor: 'pointer',
  // U1: alpha composed via color-mix (byte-identical to the old hex +'55'/+'14':
  // 0x55=33.333%, 0x14=7.843%) so it works with the var(--color-brand) token too.
  border: `1px solid ${accent ? `color-mix(in srgb, ${accent} 33.333%, transparent)` : T.line}`,
  color: accent || T.text, background: accent ? `color-mix(in srgb, ${accent} 7.843%, transparent)` : 'transparent',
});
export const field = {
  width: '100%', boxSizing: 'border-box', fontSize: 13, padding: '10px 14px',
  background: 'rgba(255,255,255,0.04)', border: `1px solid ${T.line}`,
  borderRadius: 8, color: T.text, outline: 'none',
};

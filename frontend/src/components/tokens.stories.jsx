import React from 'react';
import { T } from './surface-ui.jsx';

/* P4 — design tokens documented from the live sources: the CSS `@theme` block in
   src/index.css (brand palette) and the `T` object in surface-ui.jsx (ops/portal
   surface tokens). Swatches read the resolved CSS values at render, so the doc can
   never drift from the code. */

const CSS_TOKENS = ['--color-brand', '--color-brand-bright', '--color-brand-deep', '--color-ink', '--color-stone-500'];

function resolved(varName) {
  if (typeof window === 'undefined') return '';
  return getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
}

function Swatch({ name, value, swatchColor }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <div style={{ width: 56, height: 40, borderRadius: 8, background: swatchColor, border: '1px solid rgba(255,255,255,0.14)', flexShrink: 0 }} />
      <div>
        <div style={{ fontFamily: 'monospace', fontSize: 12, color: '#e7e5e4' }}>{name}</div>
        <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#a8a29e' }}>{value}</div>
      </div>
    </div>
  );
}

const Grid = ({ children }) => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 18, maxWidth: 760 }}>{children}</div>
);

export default { title: 'Design system/Tokens' };

export const BrandPalette = () => (
  <Grid>
    {CSS_TOKENS.map((v) => <Swatch key={v} name={v} value={resolved(v) || 'var'} swatchColor={`var(${v})`} />)}
  </Grid>
);

export const SurfaceTokens = () => (
  <Grid>
    {Object.entries(T).map(([k, v]) => <Swatch key={k} name={`T.${k}`} value={v} swatchColor={v} />)}
  </Grid>
);

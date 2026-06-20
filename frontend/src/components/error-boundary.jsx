/* U4 — route-level error boundary. Wrap a route's content so a thrown render
   error shows a contained fallback (and keeps the surrounding shell + nav alive)
   instead of taking down the whole app the way the single top-level boundary
   does. Imports only React + analytics, so it composes into ops, portal, or
   marketing without dragging any surface along. When healthy it returns its
   children verbatim — no wrapper element, so it never changes the happy path. */
import React from 'react';
import { track } from '../lib/analytics.jsx';

export class RouteErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error) {
    try { track('app_error', { scope: this.props.scope || 'route', message: String((error && error.message) || error) }); } catch { /* analytics is best-effort */ }
  }
  render() {
    if (!this.state.hasError) return this.props.children;
    // Contained fallback in the shared ops/portal palette (hairline border, the
    // faint panel fill, var(--color-brand) accent). retry clears the error in place.
    return (
      <div style={{ border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.022)', borderRadius: 10, padding: '22px 18px', margin: '8px 0' }}>
        <div className="mono" style={{ fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#71717a', marginBottom: 8 }}>Something went wrong</div>
        <div style={{ fontSize: 14, color: '#e7e5e4', lineHeight: 1.6, marginBottom: 14 }}>
          This view hit an unexpected error. The rest of the console is unaffected — reload or head back.
        </div>
        <button onClick={() => this.setState({ hasError: false })} className="mono"
          style={{ fontSize: 11, padding: '6px 14px', borderRadius: 6, cursor: 'pointer',
                   border: '1px solid color-mix(in srgb, var(--color-brand) 33.333%, transparent)',
                   color: 'var(--color-brand)', background: 'color-mix(in srgb, var(--color-brand) 7.843%, transparent)' }}>
          retry
        </button>
      </div>
    );
  }
}

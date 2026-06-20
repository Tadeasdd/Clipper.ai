import React from 'react';
import { _seoUpsertMeta } from './seo.jsx';

/* Load performance: declare a dark color-scheme (correct native control/scrollbar
   rendering) and preconnect to the PostHog EU origin the analytics snippet loads from.
   Honest hints only — these are the exact hosts the runtime uses. */
const injectPerfHints = () => {
  if (typeof document === 'undefined' || !document.head) return;
  try { _seoUpsertMeta('name', 'color-scheme', 'dark'); } catch { /* best-effort */ }
  /* Display face: Newsreader (an editorial serif drawn for news media — on-subject for a
     content-operations company, and its true italics carry the accent spans the headlines
     already use). Falls back to Georgia if the stylesheet doesn't load. */
  if (!document.getElementById('clipper-display-font')) {
    [
      { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
      { rel: 'preconnect', href: 'https://fonts.gstatic.com', cross: true },
    ].forEach(({ rel, href, cross }) => {
      if (document.head.querySelector('link[rel="' + rel + '"][href="' + href + '"]')) return;
      const l = document.createElement('link');
      l.rel = rel; l.href = href; if (cross) l.crossOrigin = '';
      document.head.appendChild(l);
    });
    const f = document.createElement('link');
    f.id = 'clipper-display-font';
    f.rel = 'stylesheet';
    f.href = 'https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400..600;1,6..72,400..600&display=swap';
    document.head.appendChild(f);
  }
  ['https://eu.i.posthog.com', 'https://eu-assets.i.posthog.com'].forEach((href) => {
    if (document.head.querySelector('link[rel="preconnect"][href="' + href + '"]')) return;
    const l = document.createElement('link');
    l.rel = 'preconnect'; l.href = href; l.crossOrigin = '';
    document.head.appendChild(l);
  });
};

/* P2 — Core Web Vitals (RUM). Dependency-free, first-party collection: real
   PerformanceObserver measurements (LCP, CLS, INP) plus FCP + TTFB, beaconed
   ONCE per page lifecycle to our own /api/rum at the first page-hide — when
   those metrics are final. Privacy-respecting: honors Do-Not-Track / Global
   Privacy Control (collects nothing), sends no identity or cookies, only metric
   values + the URL pathname + coarse device/connection hints. Renders no DOM,
   so it can't change any pixel. Internal surfaces (/ops, /portal) are excluded
   from the beacon — RUM is the public product's signal, not staff sessions. */
const _observe = (type, cb, opts) => {
  try {
    const po = new PerformanceObserver((list) => cb(list.getEntries()));
    po.observe({ type, buffered: true, ...opts });
  } catch { /* entry type unsupported in this browser — skip that metric */ }
};
const _round = (name, v) => (name === 'cls' ? Number(v.toFixed(4)) : Math.round(v));
const _deviceClass = () => (typeof matchMedia === 'function' && matchMedia('(max-width: 768px)').matches ? 'mobile' : 'desktop');
const _connType = () => { try { const c = navigator.connection; return c && typeof c.effectiveType === 'string' ? c.effectiveType.slice(0, 20) : null; } catch { return null; } };

const initWebVitals = () => {
  if (typeof window === 'undefined' || typeof PerformanceObserver === 'undefined') return;
  const nav = navigator;
  // Privacy: opt out entirely under Do-Not-Track or Global Privacy Control.
  if (nav.doNotTrack === '1' || window.doNotTrack === '1' || nav.msDoNotTrack === '1' || nav.globalPrivacyControl === true) return;
  if (window.__clipperVitals) return; // once per page
  window.__clipperVitals = true;

  const values = {}; // metric -> latest value
  const set = (name, value) => { if (Number.isFinite(value) && value >= 0) values[name] = value; };

  // LCP — keep the last largest-contentful-paint before the page hides.
  _observe('largest-contentful-paint', (es) => { const last = es[es.length - 1]; if (last) set('lcp', last.renderTime || last.loadTime || last.startTime); });
  // CLS — running sum of layout shifts without recent user input.
  let cls = 0;
  _observe('layout-shift', (es) => { for (const e of es) if (!e.hadRecentInput) cls += e.value; set('cls', cls); });
  // INP (approx) — the worst interaction latency seen (Event Timing). Honest
  // simplification of web-vitals' p98; labeled as such on the dashboard.
  let inp = 0;
  _observe('event', (es) => { for (const e of es) if (e.interactionId && e.duration > inp) inp = e.duration; if (inp) set('inp', inp); }, { durationThreshold: 40 });
  // FCP — first contentful paint.
  _observe('paint', (es) => { const f = es.find((e) => e.name === 'first-contentful-paint'); if (f) set('fcp', f.startTime); });
  // TTFB — navigation responseStart (time to first byte).
  try { const n = performance.getEntriesByType('navigation')[0]; if (n && n.responseStart > 0) set('ttfb', n.responseStart); } catch { /* best-effort */ }

  let sent = false;
  const send = (force) => {
    if (sent || (!force && document.visibilityState !== 'hidden')) return;
    // Exclude internal surfaces — RUM measures the public product, not staff.
    if (/^\/(ops|portal)(\/|$)/.test(location.pathname)) return;
    const metrics = Object.entries(values).map(([name, value]) => ({ name, value: _round(name, value) }));
    if (!metrics.length) return;
    sent = true;
    const payload = { metrics, path: location.pathname, device: _deviceClass() };
    const conn = _connType();
    if (conn) payload.conn = conn; // omit when absent — the server validator is strict
    const body = JSON.stringify(payload);
    const url = ((import.meta.env && import.meta.env.VITE_API_BASE) || '') + '/api/rum';
    try {
      if (nav.sendBeacon) nav.sendBeacon(url, new Blob([body], { type: 'application/json' }));
      else fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body, keepalive: true });
    } catch { /* a beacon must never break the page */ }
  };
  // Report at the first background/unload — when LCP, CLS and INP are final.
  // visibilitychange is the recommended trigger; pagehide covers bfcache evict.
  addEventListener('visibilitychange', () => send(false), { capture: true });
  addEventListener('pagehide', () => send(true), { capture: true });
};

export { injectPerfHints, initWebVitals };

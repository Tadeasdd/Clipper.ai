import React from 'react';
import { _seoUpsertMeta } from './seo.jsx';

/* Load performance: declare a dark color-scheme (correct native control/scrollbar
   rendering) and preconnect to the PostHog EU origin the analytics snippet loads from.
   Honest hints only — these are the exact hosts the runtime uses. */
const injectPerfHints = () => {
  if (typeof document === 'undefined' || !document.head) return;
  try { _seoUpsertMeta('name', 'color-scheme', 'dark'); } catch (e) {}
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

export { injectPerfHints };

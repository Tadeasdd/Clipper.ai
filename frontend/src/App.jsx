import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Upload, Sparkles, TrendingUp, Scissors, Play, Download, Share2, Clock, Zap, ChevronRight, Film, CheckCircle2, Loader2, ArrowUpRight, Flame, Users, Search, Heart, MessageCircle, Check, X, Mic, Code, Globe, Shield, Workflow, Database, Layers, GitBranch, BookOpen, Terminal, Building2, Briefcase, Mail } from 'lucide-react';
/* PostHog (EU cloud), loaded via the official browser snippet at runtime so there is no
   build-time import to bundle (works in any host, including this preview). Runs once on the
   client; SSR-guarded. Any capture() calls made through track() before the SDK finishes
   downloading are queued by the stub and replayed automatically once it loads. */
if (typeof window !== 'undefined' && !window.__clipperPHInit) {
  window.__clipperPHInit = true;
  /* Hardened: the official snippet assumes an existing <script> tag to insert
     before; if the host page has none (module preload, exotic embeds, tests),
     that would throw at module scope and take the whole app down with it.
     Analytics must never be able to do that, so the bootstrap is fully fenced. */
  try {
    !function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0])?r.parentNode.insertBefore(p,r):(t.head||t.documentElement).appendChild(p);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="init capture register register_once register_for_session unregister unregister_for_session getFeatureFlag getFeatureFlagPayload isFeatureEnabled reloadFeatureFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSessionId getSurveys getActiveMatchingSurveys renderSurvey canRenderSurvey getNextSurveyStep identify setPersonProperties group resetGroups setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags reset get_distinct_id getGroups get_session_id get_session_replay_url alias set_config startSessionRecording stopSessionRecording sessionRecordingStarted captureException loadToolbar get_property getSessionProperty createPersonProfile opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing clear_opt_in_out_capturing debug getPageViewId captureTraceFeedback captureTraceMetric".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);
    window.posthog.init('phc_ttc6fGPaBCLNYQfsRNTCeAZZt9oojcnfYrA52XtBmSN6', {
      api_host: 'https://eu.i.posthog.com',
      defaults: '2026-05-30',
    });
  } catch (e) { /* analytics must never break the site */ }
}

/* Phase 1 analytics. Captures REAL events through PostHog when its snippet is
   loaded on the page (window.posthog). Safe no-op until then. Never fabricates data. */
const track = (event, props) => {
  try {
    if (typeof window !== 'undefined' && window.posthog && typeof window.posthog.capture === 'function') {
      window.posthog.capture(event, props || {});
    }
  } catch (e) { /* analytics must never break the UI */ }
};

/* ──────────────────────────────────────────────────────────── SEO / DISCOVERABILITY
   Per-page document title + meta (description, Open Graph, Twitter) and JSON-LD
   structured data (Organization, WebSite, Service, FAQPage). Applied at runtime via
   the DOM, so it is framework-agnostic and adds no build dependency, and it is a safe
   no-op during SSR. URLs are read from window.location instead of being hardcoded, and
   the FAQ schema reuses the FAQ already shown on the home page verbatim. Nothing here
   invents a domain, rating, or metric. */
const SEO_BRAND = 'Clipper.ai';
const SEO_BY_PAGE = {
  privacy: { t: 'Privacy', d: 'How Clipper.ai handles your email, your recordings, and your IP. Plain English, no surprises.' },
  terms: { t: 'Terms', d: 'The short, honest terms for working with Clipper.ai during early access.' },
  home:    { t: 'Done-for-you short-form content, from your long-form', d: 'We turn your podcasts, interviews, and videos into publish-ready short-form every week. AI systems find the strongest moments, human editors refine every clip. You record, we ship.' },
  product: { t: 'How it works', d: 'Send one recording. Our AI systems and human editors turn it into publish-ready short-form, reviewed and on-brand, delivered every week. No software for you to run.' },
  pricing: { t: 'Pricing', d: 'Managed short-form content, scoped on a strategy call and priced on finished output, never seats or minutes. You pay per clip we ship.' },
  docs:    { t: 'Resources', d: 'How to send us your content, what comes back, how fast, and how much you control. The practical stuff, not technical manuals.' },
  status:  { t: 'Status', d: 'Current operational status for Clipper.ai content operations.' },
  company: { t: 'Company', d: 'Clipper.ai is an AI-native content operations company. We help creators, podcasts, founders, and brands turn long-form into high-performing short-form at scale.' },
  studio:  { t: 'Studio', d: 'A look at how Clipper.ai turns one long-form recording into a batch of scored, publish-ready short-form clips.' },
};

const _seoUpsertMeta = (kind, key, content) => {
  if (typeof document === 'undefined' || !document.head) return;
  let el = document.head.querySelector('meta[' + kind + '="' + key + '"]');
  if (!el) { el = document.createElement('meta'); el.setAttribute(kind, key); document.head.appendChild(el); }
  el.setAttribute('content', content);
};
const _seoUpsertLink = (rel, href) => {
  if (typeof document === 'undefined' || !document.head) return;
  let el = document.head.querySelector('link[rel="' + rel + '"]');
  if (!el) { el = document.createElement('link'); el.setAttribute('rel', rel); document.head.appendChild(el); }
  el.setAttribute('href', href);
};

const applySeo = (page, view) => {
  if (typeof document === 'undefined') return;
  try { document.documentElement.lang = 'en'; } catch (e) {}
  _seoUpsertMeta('name', 'theme-color', '#000000');
  const key = view === 'app' ? 'studio' : (page || 'home');
  const e = SEO_BY_PAGE[key] || SEO_BY_PAGE.home;
  const title = key === 'home' ? (SEO_BRAND + ' \u2014 ' + e.t) : (e.t + ' \u2014 ' + SEO_BRAND);
  document.title = title;
  const url = (typeof window !== 'undefined' && window.location) ? (window.location.origin + window.location.pathname) : '';
  _seoUpsertMeta('name', 'description', e.d);
  if (url) _seoUpsertLink('canonical', url);
  _seoUpsertMeta('property', 'og:type', 'website');
  _seoUpsertMeta('property', 'og:site_name', SEO_BRAND);
  _seoUpsertMeta('property', 'og:title', title);
  _seoUpsertMeta('property', 'og:description', e.d);
  if (url) _seoUpsertMeta('property', 'og:url', url);
  _seoUpsertMeta('name', 'twitter:card', 'summary_large_image');
  _seoUpsertMeta('name', 'twitter:title', title);
  _seoUpsertMeta('name', 'twitter:description', e.d);
};

const injectJsonLd = () => {
  if (typeof document === 'undefined' || !document.head) return;
  if (document.getElementById('clipper-jsonld')) return;
  const origin = (typeof window !== 'undefined' && window.location) ? window.location.origin : '';
  const faqs = [
    { q: 'What\u2019s the turnaround?', a: 'Your first batch of clips typically lands within 48\u201372 hours of us receiving a recording. After that, we keep a steady weekly stream running behind your show so there\u2019s always something to post.' },
    { q: 'Do I keep approval over what gets published?', a: 'Always. Nothing goes out without your sign-off unless you explicitly ask us to publish on your behalf. You can approve clips as-is, request changes, or have us post on your schedule. The level of control is yours to set.' },
    { q: 'What do I actually need to send you?', a: 'Just your long-form: a podcast, interview, livestream, webinar, or YouTube link. Drop a file or a URL and we handle transcription, clip selection, editing, formatting, and captions from there. No software for you to learn, no timeline to touch.' },
    { q: 'How is this different from hiring an editor or an agency?', a: 'An editor gives you one person\u2019s hours. An agency gives you a slower, pricier version of the same. We pair AI systems that surface and cut the strongest moments at scale with human editors who review every clip, so you get an agency-grade output at a fraction of the cost and turnaround, every week.' },
  ];
  const graph = [
    { '@type': 'Organization', '@id': origin + '#organization', name: SEO_BRAND, url: origin || undefined, description: 'AI-native content operations company that turns long-form content into high-performing short-form at scale.' },
    { '@type': 'WebSite', '@id': origin + '#website', name: SEO_BRAND, url: origin || undefined, publisher: { '@id': origin + '#organization' } },
    { '@type': 'Service', name: 'Managed short-form content production', serviceType: 'Short-form video production and content repurposing', provider: { '@id': origin + '#organization' }, areaServed: 'Worldwide', description: 'Done-for-you short-form content: AI systems find the strongest moments in your long-form, human editors refine every clip, and publish-ready short-form is delivered every week.' },
    { '@type': 'FAQPage', '@id': origin + '#faq', mainEntity: faqs.map(function (faq) { return { '@type': 'Question', name: faq.q, acceptedAnswer: { '@type': 'Answer', text: faq.a } }; }) },
  ];
  try {
    const node = document.createElement('script');
    node.type = 'application/ld+json';
    node.id = 'clipper-jsonld';
    node.textContent = JSON.stringify({ '@context': 'https://schema.org', '@graph': graph });
    document.head.appendChild(node);
  } catch (err) { /* never break the UI */ }
};

/* artifact shim: realize Tailwind arbitrary-value classes (this runtime has no JIT) */
const NEON_SHIM_CSS = `.-bottom-\[21px\] { bottom: -21px !important; }
.aspect-\[16\/9\] { aspect-ratio: 16/9 !important; }
.aspect-\[2\/1\] { aspect-ratio: 2/1 !important; }
.aspect-\[9\/16\] { aspect-ratio: 9/16 !important; }
.bg-\[\#53fc18\] { background-color: rgb(83 252 24) !important; }
.bg-\[\#53fc18\]\/10 { background-color: rgb(83 252 24 / 0.1) !important; }
.bg-\[\#53fc18\]\/40 { background-color: rgb(83 252 24 / 0.4) !important; }
.bg-\[\#53fc18\]\/\[0\.015\] { background-color: rgb(83 252 24 / 0.015) !important; }
.bg-\[\#53fc18\]\/\[0\.02\] { background-color: rgb(83 252 24 / 0.02) !important; }
.bg-\[\#53fc18\]\/\[0\.04\] { background-color: rgb(83 252 24 / 0.04) !important; }
.bg-\[\#53fc18\]\/\[0\.06\] { background-color: rgb(83 252 24 / 0.06) !important; }
.bg-\[\#53fc18\]\/\[0\.08\] { background-color: rgb(83 252 24 / 0.08) !important; }
.bg-\[\#53fc18\]\/\[0\.10\] { background-color: rgb(83 252 24 / 0.10) !important; }
.bg-\[\#53fc18\]\/\[0\.12\] { background-color: rgb(83 252 24 / 0.12) !important; }
.bg-\[\#53fc18\]\/\[0\.15\] { background-color: rgb(83 252 24 / 0.15) !important; }
.bg-\[\#53fc18\]\/\[0\.18\] { background-color: rgb(83 252 24 / 0.18) !important; }
.bg-\[\#aaff66\] { background-color: rgb(170 255 102) !important; }
.bg-white\/\[0\.04\] { background-color: rgb(255 255 255 / 0.04) !important; }
.bg-white\/\[0\.05\] { background-color: rgb(255 255 255 / 0.05) !important; }
.bg-white\/\[0\.06\] { background-color: rgb(255 255 255 / 0.06) !important; }
.bg-white\/\[0\.07\] { background-color: rgb(255 255 255 / 0.07) !important; }
.blur-\[140px\] { filter: blur(140px) !important; }
.blur-\[160px\] { filter: blur(160px) !important; }
.border-\[\#53fc18\]\/10 { border-color: rgb(83 252 24 / 0.1) !important; }
.border-\[\#53fc18\]\/15 { border-color: rgb(83 252 24 / 0.15) !important; }
.border-\[\#53fc18\]\/20 { border-color: rgb(83 252 24 / 0.2) !important; }
.border-\[\#53fc18\]\/30 { border-color: rgb(83 252 24 / 0.3) !important; }
.border-\[\#53fc18\]\/40 { border-color: rgb(83 252 24 / 0.4) !important; }
.border-\[\#53fc18\]\/\[0\.06\] { border-color: rgb(83 252 24 / 0.06) !important; }
.border-\[\#53fc18\]\/\[0\.08\] { border-color: rgb(83 252 24 / 0.08) !important; }
.border-\[\#53fc18\]\/\[0\.10\] { border-color: rgb(83 252 24 / 0.10) !important; }
.border-\[\#53fc18\]\/\[0\.12\] { border-color: rgb(83 252 24 / 0.12) !important; }
.border-\[\#53fc18\]\/\[0\.14\] { border-color: rgb(83 252 24 / 0.14) !important; }
.border-\[\#53fc18\]\/\[0\.15\] { border-color: rgb(83 252 24 / 0.15) !important; }
.border-\[\#53fc18\]\/\[0\.25\] { border-color: rgb(83 252 24 / 0.25) !important; }
.border-\[3px\] { border-width: 3px !important; }
.border-white\/\[0\.06\] { border-color: rgb(255 255 255 / 0.06) !important; }
.border-white\/\[0\.07\] { border-color: rgb(255 255 255 / 0.07) !important; }
.border-white\/\[0\.12\] { border-color: rgb(255 255 255 / 0.12) !important; }
.border-white\/\[0\.1\] { border-color: rgb(255 255 255 / 0.1) !important; }
.divide-\[\#53fc18\]\/\[0\.06\] > :not([hidden]) ~ :not([hidden]) { border-color: rgb(83 252 24 / 0.06) !important; }
.divide-\[\#53fc18\]\/\[0\.08\] > :not([hidden]) ~ :not([hidden]) { border-color: rgb(83 252 24 / 0.08) !important; }
.divide-\[\#53fc18\]\/\[0\.10\] > :not([hidden]) ~ :not([hidden]) { border-color: rgb(83 252 24 / 0.10) !important; }
.focus\:border-\[\#53fc18\]\/30:focus { border-color: rgb(83 252 24 / 0.3) !important; }
.focus\:border-\[\#53fc18\]\/60:focus { border-color: rgb(83 252 24 / 0.6) !important; }
.from-\[\#53fc18\] { --tw-gradient-from: rgb(83 252 24); --tw-gradient-to: rgb(0 0 0 / 0); --tw-gradient-stops: var(--tw-gradient-from), var(--tw-gradient-to); }
.from-\[\#53fc18\]\/0 { --tw-gradient-from: rgb(83 252 24 / 0.0); --tw-gradient-to: rgb(0 0 0 / 0); --tw-gradient-stops: var(--tw-gradient-from), var(--tw-gradient-to); }
.from-\[\#53fc18\]\/20 { --tw-gradient-from: rgb(83 252 24 / 0.2); --tw-gradient-to: rgb(0 0 0 / 0); --tw-gradient-stops: var(--tw-gradient-from), var(--tw-gradient-to); }
.from-\[\#53fc18\]\/40 { --tw-gradient-from: rgb(83 252 24 / 0.4); --tw-gradient-to: rgb(0 0 0 / 0); --tw-gradient-stops: var(--tw-gradient-from), var(--tw-gradient-to); }
.from-\[\#53fc18\]\/\[0\.02\] { --tw-gradient-from: rgb(83 252 24 / 0.02); --tw-gradient-to: rgb(0 0 0 / 0); --tw-gradient-stops: var(--tw-gradient-from), var(--tw-gradient-to); }
.from-\[\#53fc18\]\/\[0\.03\] { --tw-gradient-from: rgb(83 252 24 / 0.03); --tw-gradient-to: rgb(0 0 0 / 0); --tw-gradient-stops: var(--tw-gradient-from), var(--tw-gradient-to); }
.from-\[\#53fc18\]\/\[0\.04\] { --tw-gradient-from: rgb(83 252 24 / 0.04); --tw-gradient-to: rgb(0 0 0 / 0); --tw-gradient-stops: var(--tw-gradient-from), var(--tw-gradient-to); }
.from-\[\#aaff66\] { --tw-gradient-from: rgb(170 255 102); --tw-gradient-to: rgb(0 0 0 / 0); --tw-gradient-stops: var(--tw-gradient-from), var(--tw-gradient-to); }
.from-white\/\[0\.02\] { --tw-gradient-from: rgb(255 255 255 / 0.02); --tw-gradient-to: rgb(0 0 0 / 0); --tw-gradient-stops: var(--tw-gradient-from), var(--tw-gradient-to); }
.from-white\/\[0\.03\] { --tw-gradient-from: rgb(255 255 255 / 0.03); --tw-gradient-to: rgb(0 0 0 / 0); --tw-gradient-stops: var(--tw-gradient-from), var(--tw-gradient-to); }
.grid-cols-\[180px_1fr\] { grid-template-columns: 180px 1fr !important; }
.grid-cols-\[auto_1fr\] { grid-template-columns: auto 1fr !important; }
.group:hover .group-hover\:bg-\[\#53fc18\]\/5 { background-color: rgb(83 252 24 / 0.05) !important; }
.group:hover .group-hover\:border-\[\#53fc18\]\/30 { border-color: rgb(83 252 24 / 0.3) !important; }
.group:hover .group-hover\:border-\[\#53fc18\]\/40 { border-color: rgb(83 252 24 / 0.4) !important; }
.group:hover .group-hover\:from-\[\#53fc18\]\/\[0\.06\] { --tw-gradient-from: rgb(83 252 24 / 0.06); --tw-gradient-to: rgb(0 0 0 / 0); --tw-gradient-stops: var(--tw-gradient-from), var(--tw-gradient-to); }
.group:hover .group-hover\:text-\[\#53fc18\] { color: rgb(83 252 24) !important; }
.group:hover .group-hover\:to-\[\#53fc18\]\/0 { --tw-gradient-to: rgb(83 252 24 / 0.0); }
.h-\[3px\] { height: 3px !important; }
.h-\[500px\] { height: 500px !important; }
.h-\[600px\] { height: 600px !important; }
.h-\[700px\] { height: 700px !important; }
.h-\[800px\] { height: 800px !important; }
.hover\:bg-\[\#48e012\]:hover { background-color: rgb(72 224 18) !important; }
.hover\:bg-\[\#53fc18\]\/\[0\.015\]:hover { background-color: rgb(83 252 24 / 0.015) !important; }
.hover\:bg-\[\#53fc18\]\/\[0\.02\]:hover { background-color: rgb(83 252 24 / 0.02) !important; }
.hover\:bg-\[\#53fc18\]\/\[0\.04\]:hover { background-color: rgb(83 252 24 / 0.04) !important; }
.hover\:bg-\[\#53fc18\]\/\[0\.06\]:hover { background-color: rgb(83 252 24 / 0.06) !important; }
.hover\:bg-\[\#53fc18\]\/\[0\.08\]:hover { background-color: rgb(83 252 24 / 0.08) !important; }
.hover\:border-\[\#53fc18\]:hover { border-color: rgb(83 252 24) !important; }
.hover\:border-\[\#53fc18\]\/30:hover { border-color: rgb(83 252 24 / 0.3) !important; }
.hover\:border-\[\#53fc18\]\/40:hover { border-color: rgb(83 252 24 / 0.4) !important; }
.hover\:border-\[\#53fc18\]\/50:hover { border-color: rgb(83 252 24 / 0.5) !important; }
.hover\:border-white\/\[0\.16\]:hover { border-color: rgb(255 255 255 / 0.16) !important; }
.hover\:border-white\/\[0\.2\]:hover { border-color: rgb(255 255 255 / 0.2) !important; }
.hover\:scale-\[1\.02\]:hover { transform: scale(1.02) !important; }
.hover\:shadow-\[0_0_30px_rgba\(83\,252\,24\,0\.4\)\]:hover { box-shadow: 0 0 30px rgba(83,252,24,0.4) !important; }
.hover\:shadow-\[0_0_50px_rgba\(83\,252\,24\,0\.5\)\]:hover { box-shadow: 0 0 50px rgba(83,252,24,0.5) !important; }
.hover\:text-\[\#53fc18\]:hover { color: rgb(83 252 24) !important; }
.hover\:text-\[\#aaff66\]:hover { color: rgb(170 255 102) !important; }
.leading-\[0\.88\] { line-height: 0.88 !important; }
.leading-\[1\.02\] { line-height: 1.02 !important; }
.leading-\[1\.05\] { line-height: 1.05 !important; }
.left-\[30\%\] { left: 30% !important; }
@media (min-width:1024px) { .lg\:grid-cols-\[1\.2fr_1fr\] { grid-template-columns: 1.2fr 1fr !important; } }
.max-h-\[600px\] { max-height: 600px !important; }
.max-w-\[1100px\] { max-width: 1100px !important; }
.max-w-\[1400px\] { max-width: 1400px !important; }
.max-w-\[180px\] { max-width: 180px !important; }
@media (min-width:768px) { .md\:grid-cols-\[1\.4fr_1fr\] { grid-template-columns: 1.4fr 1fr !important; } }
@media (min-width:768px) { .md\:grid-cols-\[1fr_1\.2fr\] { grid-template-columns: 1fr 1.2fr !important; } }
@media (min-width:768px) { .md\:grid-cols-\[1fr_1\.4fr\] { grid-template-columns: 1fr 1.4fr !important; } }
@media (min-width:768px) { .md\:grid-cols-\[1fr_1\.6fr\] { grid-template-columns: 1fr 1.6fr !important; } }
@media (min-width:768px) { .md\:grid-cols-\[1fr_1fr\] { grid-template-columns: 1fr 1fr !important; } }
@media (min-width:768px) { .md\:grid-cols-\[1fr_auto\] { grid-template-columns: 1fr auto !important; } }
@media (min-width:768px) { .md\:grid-cols-\[170px_1fr_1fr_1fr\] { grid-template-columns: 170px 1fr 1fr 1fr !important; } }
@media (min-width:768px) { .md\:grid-cols-\[1fr_2fr\] { grid-template-columns: 1fr 2fr !important; } }
.min-h-\[16px\] { min-height: 16px !important; }
.opacity-\[0\.08\] { opacity: 0.08 !important; }
.opacity-\[0\.25\] { opacity: 0.25 !important; }
.opacity-\[0\.3\] { opacity: 0.3 !important; }
.py-\[2px\] { padding-top: 2px !important; padding-bottom: 2px !important; }
.rounded-\[28px\] { border-radius: 28px !important; }
.rounded-\[36px\] { border-radius: 36px !important; }
.shadow-\[0_0_60px_-20px_rgba\(83\,252\,24\,0\.3\)\] { box-shadow: 0 0 60px -20px rgba(83,252,24,0.3) !important; }
.shadow-\[0_0_80px_-20px_rgba\(83\,252\,24\,0\.4\)\] { box-shadow: 0 0 80px -20px rgba(83,252,24,0.4) !important; }
.shadow-\[0_20px_60px_rgba\(0\,0\,0\,0\.6\)\] { box-shadow: 0 20px 60px rgba(0,0,0,0.6) !important; }
.text-\[\#53fc18\] { color: rgb(83 252 24) !important; }
.text-\[\#53fc18\]\/60 { color: rgb(83 252 24 / 0.6) !important; }
.text-\[\#aaff66\] { color: rgb(170 255 102) !important; }
.text-\[10px\] { font-size: 10px !important; }
.text-\[11px\] { font-size: 11px !important; }
.text-\[14px\] { font-size: 14px !important; }
.text-\[7px\] { font-size: 7px !important; }
.text-\[8px\] { font-size: 8px !important; }
.text-\[9px\] { font-size: 9px !important; }
.to-\[\#3fd80f\]\/30 { --tw-gradient-to: rgb(63 216 15 / 0.3); }
.to-\[\#53fc18\] { --tw-gradient-to: rgb(83 252 24); }
.to-\[\#53fc18\]\/0 { --tw-gradient-to: rgb(83 252 24 / 0.0); }
.to-\[\#53fc18\]\/10 { --tw-gradient-to: rgb(83 252 24 / 0.1); }
.to-\[\#53fc18\]\/40 { --tw-gradient-to: rgb(83 252 24 / 0.4); }
.to-\[\#53fc18\]\/5 { --tw-gradient-to: rgb(83 252 24 / 0.05); }
.top-\[40\%\] { top: 40% !important; }
.tracking-\[0\.15em\] { letter-spacing: 0.15em !important; }
.tracking-\[0\.25em\] { letter-spacing: 0.25em !important; }
.tracking-\[0\.2em\] { letter-spacing: 0.2em !important; }
.tracking-\[0\.3em\] { letter-spacing: 0.3em !important; }
.via-\[\#53fc18\]\/0 { --tw-gradient-to: rgb(0 0 0 / 0); --tw-gradient-stops: var(--tw-gradient-from), rgb(83 252 24 / 0.0), var(--tw-gradient-to); }
.via-\[\#53fc18\]\/50 { --tw-gradient-to: rgb(0 0 0 / 0); --tw-gradient-stops: var(--tw-gradient-from), rgb(83 252 24 / 0.5), var(--tw-gradient-to); }
.w-\[140\%\] { width: 140% !important; }
.w-\[500px\] { width: 500px !important; }
.w-\[600px\] { width: 600px !important; }
.w-\[700px\] { width: 700px !important; }
.w-\[800px\] { width: 800px !important; }
.z-\[100\] { z-index: 100 !important; }
.z-\[1\] { z-index: 1 !important; }
.z-\[80\] { z-index: 80 !important; }`;
if (typeof document !== 'undefined' && !document.getElementById('neon-shim')) {
  const __s = document.createElement('style'); __s.id = 'neon-shim';
  __s.textContent = NEON_SHIM_CSS; document.head.appendChild(__s);
}

/* ── Accessibility: site-wide reduced-motion guard + skip-to-content link.
   MotionConfig handles framer-motion; this neutralizes the CSS keyframe animations,
   reveal transitions, and smooth scroll it doesn't govern. Injected globally with
   !important so it wins regardless of component <style> order. */
const A11Y_CSS = `
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.001ms !important;
    scroll-behavior: auto !important;
  }
  html { scroll-behavior: auto !important; }
  .reveal { opacity: 1 !important; transform: none !important; }
}
.skip-link {
  position: fixed; top: 0; left: 0; z-index: 100; margin: 8px; padding: 10px 16px;
  background: #53fc18; color: #000; font-weight: 600; font-size: 14px;
  border-radius: 8px; text-decoration: none; transform: translateY(-150%);
  transition: transform 0.2s ease;
}
.skip-link:focus { transform: translateY(0); outline: none; box-shadow: 0 0 0 2px rgba(83,252,24,0.6); }
`;
if (typeof document !== 'undefined' && !document.getElementById('clipper-a11y')) {
  const __a = document.createElement('style'); __a.id = 'clipper-a11y';
  __a.textContent = A11Y_CSS; document.head.appendChild(__a);
}

/* Progress-bar polish shared by the demo pipeline bars (landing InteractiveDemo +
   studio AnalyzingView): a soft sheen that sweeps across the fill plus a bright
   leading edge that travels with it. The sweep is a pure transform animation, so the
   reduced-motion guard above freezes it (jumps off-frame and is clipped → no motion). */
const PROGRESS_CSS = `
@keyframes clipperSheen { 0% { transform: translateX(-185%); } 100% { transform: translateX(185%); } }
.clip-pbar-fill {
  position: relative; height: 100%; border-radius: 9999px; overflow: hidden;
  background: linear-gradient(90deg, #2fcf0c 0%, #53fc18 58%, #a6ff63 100%);
  box-shadow: 0 0 14px rgba(83,252,24,0.5), 0 0 4px rgba(83,252,24,0.9);
  transition: none;
}
.clip-pbar-sheen {
  position: absolute; inset: 0; pointer-events: none; border-radius: inherit;
  background: linear-gradient(100deg, transparent 38%, rgba(255,255,255,0.5) 50%, transparent 62%);
  animation: clipperSheen 1.5s linear infinite; will-change: transform;
}
.clip-pbar-edge {
  position: absolute; top: 0; bottom: 0; right: 0; width: 9px; pointer-events: none; border-radius: 9999px;
  background: linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.85) 100%);
}
`;
if (typeof document !== 'undefined' && !document.getElementById('clipper-progress')) {
  const __p = document.createElement('style'); __p.id = 'clipper-progress';
  __p.textContent = PROGRESS_CSS; document.head.appendChild(__p);
}

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
const DEMO_CLIPS = [
  { id: 1, title: 'The moment everything changed', hook: '"I never thought this would actually work..."', duration: 47, virality: 94, score: 94, timestamp: '12:34 - 13:21', platforms: ['TikTok', 'Reels', 'Shorts'], caption: 'The exact moment the bet paid off, and what it taught me about taking the leap. 🎯', onScreenText: ['I never thought…', 'Then everything changed', 'Watch till the end'], reasons: ['High emotional peak', 'Strong narrative hook', 'Quotable moment'], engagement: { hook: 96, retention: 91, shareability: 89 }, scoreExplanation: 'Opens on a vulnerable admission, then pays it off with a clear turning point, the kind of emotional arc that drives shares and full-watch retention.', thumbnail: 'gradient-1' },
  { id: 2, title: 'Counterintuitive insight on growth', hook: '"Most founders get this completely backwards"', duration: 38, virality: 87, score: 87, timestamp: '24:08 - 24:46', platforms: ['TikTok', 'Reels', 'Shorts', 'X'], caption: 'The growth advice everyone repeats is wrong. Here\u2019s what actually moves the needle.', onScreenText: ['Most founders get this', 'completely backwards', 'Here\u2019s why'], reasons: ['Contrarian take', 'Authority signal', 'Pattern interrupt'], engagement: { hook: 92, retention: 84, shareability: 88 }, scoreExplanation: 'A confident contrarian claim in the first 2 seconds creates a curiosity gap viewers want closed, which is what drives comments and saves.', thumbnail: 'gradient-2' },
  { id: 3, title: 'Three frameworks in 60 seconds', hook: '"Steal these three frameworks I use every day"', duration: 58, virality: 82, score: 82, timestamp: '31:45 - 32:43', platforms: ['Reels', 'Shorts', 'LinkedIn'], caption: 'Three frameworks I use every single day. Steal them. Save this one. 📌', onScreenText: ['Framework 1', 'Framework 2', 'Framework 3'], reasons: ['Listicle format', 'Actionable value', 'Save-worthy'], engagement: { hook: 85, retention: 87, shareability: 76 }, scoreExplanation: 'Numbered, actionable payload signals clear value up front, and listicle structure is among the most save-forwarded formats on Reels and Shorts.', thumbnail: 'gradient-3' },
  { id: 4, title: 'The mistake nobody talks about', hook: '"This is the one thing nobody warned me about"', duration: 42, virality: 78, score: 78, timestamp: '08:15 - 08:57', platforms: ['TikTok', 'Reels'], caption: 'Nobody warned me about this part. If you\u2019re just starting out, watch this. 👀', onScreenText: ['Nobody warned me', 'about this', 'Don\u2019t make my mistake'], reasons: ['Vulnerability hook', 'Curiosity gap', 'Relatable struggle'], engagement: { hook: 88, retention: 79, shareability: 71 }, scoreExplanation: 'Vulnerability plus a curiosity gap (\u201cthe one thing\u201d) is highly relatable to an early-stage audience, driving saves and \u201csending this to a friend.\u201d', thumbnail: 'gradient-4' },
  { id: 5, title: 'Quick tactical breakdown', hook: '"Here\'s exactly how we 10x\'d in 90 days"', duration: 52, virality: 73, score: 73, timestamp: '45:22 - 46:14', platforms: ['Shorts', 'LinkedIn', 'X'], caption: 'The exact 90-day playbook that 10x\u2019d our numbers, broken down step by step.', onScreenText: ['10x in 90 days', 'The exact playbook', 'Step by step'], reasons: ['Specific numbers', 'Case study format', 'Tactical depth'], engagement: { hook: 78, retention: 81, shareability: 68 }, scoreExplanation: 'Concrete numbers and a defined timeframe read as credible and specific, which performs well with a professional LinkedIn/X audience.', thumbnail: 'gradient-5' },
];

// The three selectable sample recordings. Each carries the same five analysed
// moments (the studio always ranks them by virality), so the pick honestly
// changes which *source recording* the run is framed around — its filename,
// length, and the results header — without inventing new scores or data.
// The landing demo's picker hands its selection straight to the studio run.
const _CLIP_BY_ID = Object.fromEntries(DEMO_CLIPS.map((c) => [c.id, c]));
const _orderClips = (...ids) => ids.map((id) => _CLIP_BY_ID[id]).filter(Boolean);
const SAMPLE_RECORDINGS = [
  { label: 'Founder Q&A · Ep. 128', source: 'founder-qa-ep128.mp4 · 1h 02m', meta: { name: 'founder-qa-ep128.mp4', size: '512.0' }, clips: _orderClips(1, 2, 3, 4, 5) },
  { label: 'Weekly Team Standup',   source: 'team-standup-2406.mp4 · 34m',  meta: { name: 'team-standup-2406.mp4', size: '288.6' }, clips: _orderClips(3, 5, 2, 4, 1) },
  { label: 'Q4 Earnings Call',      source: 'q4-earnings-call.mp4 · 51m',   meta: { name: 'q4-earnings-call.mp4', size: '402.3' }, clips: _orderClips(2, 5, 4, 1, 3) },
];

// Shared display helpers (mirror the production results UI).
const CLIP_GRADIENTS = {
  'gradient-1': 'from-[#53fc18] via-[#3fd80f] to-emerald-500',
  'gradient-2': 'from-cyan-400 via-blue-500 to-indigo-600',
  'gradient-3': 'from-emerald-400 via-teal-500 to-cyan-600',
  'gradient-4': 'from-[#53fc18] via-emerald-500 to-teal-600',
  'gradient-5': 'from-violet-400 via-purple-500 to-fuchsia-600',
};
const clipScore = (c) => (typeof c.score === 'number' ? c.score : (c.virality || 0));
const fmtClock = (totalSec) => {
  const s = Math.max(0, Math.round(totalSec || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
const fmtCompact = (n) => {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1_000) return Math.round(n / 1_000) + 'K';
  return String(Math.round(n));
};
const scoreTone = (s) => (s >= 90 ? 'text-emerald-400' : s >= 80 ? 'text-[#53fc18]' : 'text-amber-400');

// Pre-seeded showcase shown in the studio history sidebar.
async function fetchShowcase() {
  await new Promise((r) => setTimeout(r, 120));
  const now = Date.now();
  return [
    { id: 'job_seed1', videoMeta: { name: 'Q4 launch keynote.mp4', size: '482.0' }, clips: DEMO_CLIPS, createdAt: new Date(now - 11 * 60000).toISOString(), processedMs: 134000 },
    { id: 'job_seed2', videoMeta: { name: 'Founder podcast - ep. 12.mp4', size: '321.4' }, clips: DEMO_CLIPS.slice(0, 4), createdAt: new Date(now - 2 * 3600000).toISOString(), processedMs: 95000 },
  ];
}

// ── Staged demo pipeline ──────────────────────────────────────────────────────
// Six genuine stages, each weighted to control how long it dwells. Progress is eased
// *within* each stage (smootherstep, zero velocity at the ends) so the global bar
// visibly slows at every hand-off rather than crawling linearly — it reads as discrete
// work, not a fake timer. `momentsFound` accrues only while the "moments" stage runs,
// then holds. One rAF loop drives everything; reduced motion collapses the run to a
// brief fill (no perpetual animation). ~7s wall-clock, watchable end to end.
const PIPELINE_STAGES = [
  { key: 'ingest',     weight: 0.7 },
  { key: 'transcribe', weight: 2.1 },
  { key: 'moments',    weight: 2.2 },
  { key: 'score',      weight: 1.5 },
  { key: 'caption',    weight: 1.7 },
  { key: 'package',    weight: 1.0 },
];
const PIPELINE_MOMENT_TARGET = DEMO_CLIPS.length; // counter climbs to the # of clips shipped
const MOMENTS_STAGE_INDEX = PIPELINE_STAGES.findIndex((s) => s.key === 'moments');
// smootherstep: eased 0→1 with zero velocity at both ends (slow → fast → slow)
const easeStage = (t) => { const x = t < 0 ? 0 : t > 1 ? 1 : t; return x * x * x * (x * (x * 6 - 15) + 10); };

function runDemoPipeline(_input, { onProgress, clips } = {}) {
  const resultClips = Array.isArray(clips) && clips.length ? clips : DEMO_CLIPS;
  return new Promise((resolve) => {
    const reduced = prefersReducedMotion();
    const totalWeight = PIPELINE_STAGES.reduce((a, s) => a + s.weight, 0);
    const total = reduced ? 600 : 7200; // ms
    const start = performance.now();
    let raf = 0;
    const emit = (pct, idx, eased) => {
      if (!onProgress) return;
      let moments = 0;
      if (idx > MOMENTS_STAGE_INDEX) moments = PIPELINE_MOMENT_TARGET;
      else if (idx === MOMENTS_STAGE_INDEX) moments = Math.round(eased * PIPELINE_MOMENT_TARGET);
      onProgress(pct, idx, { momentsFound: moments, stageKey: PIPELINE_STAGES[idx].key, stageLocal: eased });
    };
    const tick = (now) => {
      const t = Math.min(1, (now - start) / total);
      const wt = t * totalWeight; // weighted time consumed so far
      let acc = 0, idx = 0, local = 0;
      for (let i = 0; i < PIPELINE_STAGES.length; i++) {
        const w = PIPELINE_STAGES[i].weight;
        if (wt <= acc + w || i === PIPELINE_STAGES.length - 1) { idx = i; local = Math.min(1, (wt - acc) / w); break; }
        acc += w;
      }
      const eased = easeStage(local);
      // Fractional percent (not rounded) so the fill advances every animation frame
      // instead of stepping in visible 1% jumps. Display sites round for the % text.
      const pct = Math.min(100, ((acc + eased * PIPELINE_STAGES[idx].weight) / totalWeight) * 100);
      emit(pct, idx, eased);
      if (t < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        emit(100, PIPELINE_STAGES.length - 1, 1);
        cancelAnimationFrame(raf);
        resolve({ clips: resultClips, jobId: 'job_' + Math.random().toString(36).slice(2, 6) });
      }
    };
    raf = requestAnimationFrame(tick);
  });
}

// In-memory feedback widget (the Next.js build imports a backed component).
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

/* ──────────────────────────────────────────────────────────── STUDIO MOCKUP */
function StudioMockup() {
  return (
    <div className="relative w-full max-w-2xl mx-auto">
      <div className="absolute -inset-8 bg-[#53fc18]/[0.12] blur-3xl rounded-full pointer-events-none" />
      <div className="relative rounded-2xl border border-[#53fc18]/[0.12] bg-black/80 backdrop-blur overflow-hidden">
        {/* Window chrome */}
        <div className="border-b border-white/[0.06] px-4 py-2.5 flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-stone-700" />
          <span className="w-2.5 h-2.5 rounded-full bg-stone-700" />
          <span className="w-2.5 h-2.5 rounded-full bg-stone-700" />
          <div className="ml-4 px-3 py-1 rounded bg-white/[0.04] text-[10px] mono text-stone-500 flex-1 max-w-md">
            clipper.ai/studio/job_a3f9
          </div>
        </div>

        {/* App content */}
        <div className="grid grid-cols-[180px_1fr] divide-x divide-[#53fc18]/[0.08]">
          {/* Sidebar */}
          <div className="p-4 space-y-3">
            <div className="text-[9px] mono text-stone-500 tracking-wider uppercase mb-2">Library</div>
            {[
              { l: 'All clips', n: 12, active: true },
              { l: 'Top scoring', n: 4 },
              { l: 'Drafts', n: 8 },
              { l: 'Published', n: 21 },
            ].map((item) => (
              <div key={item.l} className={`flex items-center justify-between px-2 py-1.5 rounded text-xs ${item.active ? 'bg-[#53fc18]/10 text-[#53fc18]' : 'text-stone-400'}`}>
                <span>{item.l}</span>
                <span className="mono text-[10px] text-stone-500">{item.n}</span>
              </div>
            ))}
            <div className="border-t border-white/[0.12] pt-3 mt-4">
              <div className="text-[9px] mono text-stone-500 tracking-wider uppercase mb-2">Library</div>
              <div className="flex items-center gap-2 px-2 py-1.5 rounded text-xs text-stone-400">
                <span className="w-1 h-1 rounded-full bg-[#53fc18] animate-pulse-soft" />
                <span>23 clips</span>
              </div>
            </div>
          </div>

          {/* Main */}
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="serif text-xl">Q4 launch keynote.mp4</div>
                <div className="text-[10px] mono text-stone-500 mt-0.5">12 clips · ranked by virality</div>
              </div>
              <div className="px-2.5 py-1 rounded bg-[#53fc18]/10 text-[10px] mono text-[#53fc18] tracking-wider uppercase">Ready</div>
            </div>

            <div className="space-y-1.5">
              {[
                { r: '01', t: 'The moment everything changed', score: 94, time: '12:34', dur: '0:47' },
                { r: '02', t: 'Counterintuitive insight on growth', score: 87, time: '24:08', dur: '0:38' },
                { r: '03', t: 'Three frameworks in 60 seconds', score: 82, time: '31:45', dur: '0:58' },
                { r: '04', t: 'The mistake nobody talks about', score: 78, time: '08:15', dur: '0:42' },
              ].map((clip, i) => (
                <div key={i} className="flex items-center gap-3 p-2 rounded hover:bg-[#53fc18]/[0.015]">
                  <div className="mono text-[10px] text-stone-600 w-5">{clip.r}</div>
                  <div className="w-10 h-7 rounded bg-gradient-to-br from-[#53fc18]/40 to-[#3fd80f]/30 flex items-center justify-center">
                    <Play className="w-2.5 h-2.5 text-black fill-black" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs truncate">{clip.t}</div>
                    <div className="text-[10px] mono text-stone-500 mt-0.5">{clip.time} · {clip.dur}</div>
                  </div>
                  <div className="serif text-xl text-[#53fc18]">{clip.score}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────── GLOBAL MAP */
// Simple stylized world map showing global infrastructure footprint
function GlobalMap() {
  // Dot positions roughly approximating land masses on a 800×400 grid
  const dots = [];
  for (let y = 0; y < 30; y++) {
    for (let x = 0; x < 60; x++) {
      // Crude land-mass mask
      const px = x / 60;
      const py = y / 30;
      const inLand =
        (px > 0.05 && px < 0.30 && py > 0.20 && py < 0.55) || // Americas
        (px > 0.42 && px < 0.62 && py > 0.18 && py < 0.55) || // Eu/Africa
        (px > 0.62 && px < 0.92 && py > 0.20 && py < 0.65) || // Asia
        (px > 0.75 && px < 0.92 && py > 0.65 && py < 0.85);   // Australia
      if (inLand && Math.random() > 0.2) {
        dots.push({ x: x * 13.3, y: y * 13.3, opacity: 0.15 + Math.random() * 0.25 });
      }
    }
  }

  const nodes = [
    { x: 130, y: 140, label: 'SFO', live: true },
    { x: 220, y: 160, label: 'NYC', live: false },
    { x: 410, y: 120, label: 'LON', live: false },
    { x: 440, y: 130, label: 'FRA', live: false },
    { x: 690, y: 180, label: 'TYO', live: false },
    { x: 760, y: 290, label: 'SYD', live: false },
    { x: 580, y: 220, label: 'SIN', live: false },
    { x: 250, y: 300, label: 'SAO', live: false },
  ];

  return (
    <div className="relative w-full aspect-[2/1] rounded-2xl border border-[#53fc18]/[0.12] bg-gradient-to-b from-white/[0.02] to-transparent overflow-hidden">
      <svg viewBox="0 0 800 400" className="absolute inset-0 w-full h-full">
        {/* Dot mask of the world */}
        {dots.map((d, i) => (
          <circle key={i} cx={d.x} cy={d.y} r="1.2" fill="rgba(255,255,255,0.4)" opacity={d.opacity} />
        ))}

        {/* Network nodes */}
        {nodes.map((n, i) => (
          <g key={n.label}>
            {n.live && (
              <circle cx={n.x} cy={n.y} r="14" fill="none" stroke="#53fc18" strokeWidth="1" opacity="0.3">
                <animate attributeName="r" values="6;20;6" dur="3s" begin={`${i * 0.4}s`} repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.6;0;0.6" dur="3s" begin={`${i * 0.4}s`} repeatCount="indefinite" />
              </circle>
            )}
            <circle cx={n.x} cy={n.y} r="3.5" fill={n.live ? '#53fc18' : '#78716c'} />
            <text
              x={n.x}
              y={n.y - 12}
              fill={n.live ? '#53fc18' : '#78716c'}
              fontSize="9"
              fontFamily="JetBrains Mono"
              textAnchor="middle"
              letterSpacing="1"
            >
              {n.label}
            </text>
          </g>
        ))}

        {/* Inter-node connections */}
        {[[0, 1], [1, 2], [2, 3], [3, 4], [4, 6], [6, 5], [1, 7]].map(([a, b], i) => (
          <line
            key={i}
            x1={nodes[a].x}
            y1={nodes[a].y}
            x2={nodes[b].x}
            y2={nodes[b].y}
            stroke="rgba(83,252,24,0.15)"
            strokeWidth="0.5"
            strokeDasharray="3 3"
          />
        ))}
      </svg>

      {/* Overlay legend */}
      <div className="absolute top-5 left-5 flex flex-col gap-2 text-[10px] mono text-stone-400 tracking-wider uppercase">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#53fc18]" />
          <span>Primary region · SFO</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-stone-500" />
          <span>Planned regions</span>
        </div>
      </div>
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

/* ──────────────────────────────────────────────────────────── PRODUCT DEMO REEL
   The Slice — a single long source-video bar at top, a scanning line that sweeps across
   once, and 6 short vertical clip cards that fall out of the source into a row below as
   the line passes them. Conveys "long video → short clips" in one glance.

   Performance: all motion is pure CSS keyframes on GPU-composited properties (transform,
   opacity). Main thread is idle once the animation starts. Total animated layers: 8. */

// The 6 viral clip moments — each has a position along the source bar (%) and a score chip.
// `enterPct` is the percentage of the loop at which the clip "falls in" — matches when the scan crosses.
const SLICE_DURATION_MS = 6500;
const SLICE_CLIPS = [
  { pos: 11, score: 94, hue: '#aaff66', enterPct: 9,  label: 'HOOK' },
  { pos: 24, score: 88, hue: '#53fc18', enterPct: 16, label: 'TURN' },
  { pos: 40, score: 71, hue: '#53fc18', enterPct: 25, label: 'QUOTE' },
  { pos: 56, score: 81, hue: '#aaff66', enterPct: 34, label: 'LIST' },
  { pos: 71, score: 76, hue: '#53fc18', enterPct: 42, label: 'PUNCH' },
  { pos: 87, score: 65, hue: '#53fc18', enterPct: 51, label: 'CTA' },
];

// Inject the slice animation keyframes once at module load.
// Per-clip stagger is baked into separately named keyframes (sliceFall0..5, sliceMark0..5) so the
// stagger repeats correctly every loop iteration (animation-delay only delays the first iteration).
if (typeof document !== 'undefined' && !document.getElementById('slice-anim-styles')) {
  const style = document.createElement('style');
  style.id = 'slice-anim-styles';

  // Per-clip keyframes — fall in at enterPct, hold, then fade out near the end.
  const perClipKeyframes = SLICE_CLIPS.map((clip, i) => {
    const e = clip.enterPct;       // when the card starts appearing
    const eIn = Math.min(e + 1, 95);   // tiny pre-fade
    const eDown = Math.min(e + 6, 95); // settled into final position
    return `
      @keyframes sliceFall${i} {
        0%        { opacity: 0; transform: translate(-50%, -28px) scale(0.94); }
        ${e}%     { opacity: 0; transform: translate(-50%, -28px) scale(0.94); }
        ${eIn}%   { opacity: 1; transform: translate(-50%, -28px) scale(0.94); }
        ${eDown}% { opacity: 1; transform: translate(-50%, 0) scale(1); }
        88%       { opacity: 1; transform: translate(-50%, 0) scale(1); }
        96%       { opacity: 0; transform: translate(-50%, 0) scale(1); }
        100%      { opacity: 0; transform: translate(-50%, 0) scale(1); }
      }
      @keyframes sliceMark${i} {
        0%        { opacity: 0; transform: translateX(-50%) scaleY(0.4); }
        ${e}%     { opacity: 0; transform: translateX(-50%) scaleY(0.4); }
        ${eIn}%   { opacity: 1; transform: translateX(-50%) scaleY(1); }
        88%       { opacity: 0.7; transform: translateX(-50%) scaleY(1); }
        96%       { opacity: 0; transform: translateX(-50%) scaleY(1); }
        100%      { opacity: 0; transform: translateX(-50%) scaleY(1); }
      }
      @keyframes slicePop${i} {
        0%        { opacity: 0; transform: translateY(10px) scale(0.96); }
        ${e}%     { opacity: 0; transform: translateY(10px) scale(0.96); }
        ${eIn}%   { opacity: 1; transform: translateY(10px) scale(0.96); }
        ${eDown}% { opacity: 1; transform: translateY(0) scale(1); }
        88%       { opacity: 1; transform: translateY(0) scale(1); }
        96%       { opacity: 0; transform: translateY(0) scale(1); }
        100%      { opacity: 0; transform: translateY(0) scale(1); }
      }
    `;
  }).join('\n');

  style.textContent = `
    @keyframes sliceScan {
      0%   { transform: translateX(0); opacity: 0; }
      4%   { opacity: 1; }
      55%  { transform: translateX(100%); opacity: 1; }
      60%  { opacity: 0; }
      100% { transform: translateX(100%); opacity: 0; }
    }
    @keyframes sliceSourcePulse {
      0%, 100% { opacity: 0.85; }
      50% { opacity: 1; }
    }
    ${perClipKeyframes}

    @media (prefers-reduced-motion: reduce) {
      .slice-card-d, .slice-card-m { animation: none !important; opacity: 1 !important; }
      .slice-card-d { transform: translate(-50%, 0) !important; }
      .slice-card-m { transform: none !important; }
      .slice-mark { animation: none !important; opacity: 0.55 !important; transform: translateX(-50%) scaleY(1) !important; }
      .slice-scan { display: none !important; }
      .slice-pulse { animation: none !important; opacity: 1 !important; }
      .lt-marquee { animation: none !important; }
      .animate-pulse-soft { animation: none !important; opacity: 0.85 !important; }
    }
  `;
  document.head.appendChild(style);
}

function SliceClipCard({ clip, i }) {
  return (
    <div className="relative w-full h-full rounded-md border border-[#53fc18]/[0.25] overflow-hidden" style={{
      background: 'linear-gradient(180deg, rgba(83,252,24,0.10), rgba(83,252,24,0.03))',
      boxShadow: `0 4px 20px ${clip.hue}25, 0 0 0 1px ${clip.hue}15 inset`,
    }}>
      {/* Top accent */}
      <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: clip.hue, boxShadow: `0 0 8px ${clip.hue}` }} />
      {/* Mini waveform inside the clip */}
      <div className="absolute inset-x-2 top-3 flex items-center justify-between gap-0.5">
        {Array.from({ length: 14 }).map((_, j) => {
          const h = 4 + ((j * 7 + i * 3) % 10);
          return <div key={j} className="w-0.5 rounded-full" style={{ height: `${h}px`, background: clip.hue, opacity: 0.35 + (j % 4) * 0.15 }} />;
        })}
      </div>
      {/* Score chip */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded-sm bg-black/60 border border-[#53fc18]/30">
        <span className="text-[9px] mono text-[#53fc18] tracking-wider">{clip.score}</span>
      </div>
      {/* Label */}
      <div className="absolute bottom-7 left-1/2 -translate-x-1/2">
        <span className="text-[7px] mono text-stone-400 tracking-[0.2em] uppercase">{clip.label}</span>
      </div>
    </div>
  );
}

function ProductDemoReel({ openApp }) {
  return (
    <section className="relative z-10 max-w-[1400px] mx-auto px-6 md:px-8 py-16 md:py-24 border-t border-white/[0.12]">
      {/* Soft ambient backdrop — static gradient, zero animation cost */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(83,252,24,0.05), transparent 70%)' }} />

      {/* Header */}
      <Reveal>
        <div className="relative flex items-end justify-between mb-12">
          <div>
            <div className="text-[10px] mono text-[#53fc18] tracking-[0.3em] uppercase mb-3">[ HOW IT WORKS ]</div>
            <h2 className="text-5xl md:text-6xl serif tracking-tight text-stone-100">
              One video in.<br /><span className="gradient-green italic">Six viral clips out.</span>
            </h2>
          </div>
          <div className="hidden md:flex items-center gap-3 text-[10px] mono text-stone-500 tracking-[0.25em] uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-[#53fc18] slice-pulse" style={{ animation: 'sliceSourcePulse 2.4s ease-in-out infinite' }} />
            <span>LIVE PIPELINE</span>
          </div>
        </div>
      </Reveal>

      {/* The slice stage */}
      <Reveal delay={120}>
        <div className="relative rounded-2xl border border-[#53fc18]/[0.12] bg-gradient-to-b from-stone-950/80 to-black/90 backdrop-blur-sm overflow-hidden">
          {/* Corner brackets */}
          <div className="absolute top-3 left-3 w-3 h-3 border-l border-t border-[#53fc18]/40 pointer-events-none" />
          <div className="absolute top-3 right-3 w-3 h-3 border-r border-t border-[#53fc18]/40 pointer-events-none" />
          <div className="absolute bottom-3 left-3 w-3 h-3 border-l border-b border-[#53fc18]/40 pointer-events-none" />
          <div className="absolute bottom-3 right-3 w-3 h-3 border-r border-b border-[#53fc18]/40 pointer-events-none" />

          {/* Subtle grid background */}
          <div className="absolute inset-0 opacity-[0.08] pointer-events-none" style={{
            backgroundImage: 'linear-gradient(rgba(83,252,24,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(83,252,24,0.6) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
            maskImage: 'radial-gradient(circle at center, black 30%, transparent 75%)',
            WebkitMaskImage: 'radial-gradient(circle at center, black 30%, transparent 75%)',
          }} />

          <div className="relative px-4 sm:px-8 md:px-16 py-10 md:py-14">
            {/* Metadata row */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-6">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] mono text-stone-500 tracking-[0.2em] uppercase">
                <span className="text-stone-600">SOURCE</span>
                <span className="text-stone-300">podcast-ep47-final.mp4</span>
                <span className="text-stone-700">·</span>
                <span className="text-stone-600">47:22</span>
              </div>
              <div className="text-[10px] mono text-[#53fc18] tracking-[0.2em]">ANALYZING · 6 MOMENTS FOUND</div>
            </div>

            {/* SOURCE VIDEO BAR */}
            <div className="relative h-16 md:h-20 rounded-md overflow-hidden border border-[#53fc18]/[0.15]" style={{
              background: 'linear-gradient(90deg, rgba(83,252,24,0.06), rgba(83,252,24,0.12), rgba(83,252,24,0.06))',
            }}>
              {/* Frame ticks — 24 tiny vertical marks suggesting timeline frames */}
              <div className="absolute inset-0 flex">
                {Array.from({ length: 24 }).map((_, i) => (
                  <div key={i} className="flex-1 border-r border-[#53fc18]/[0.08] last:border-r-0" />
                ))}
              </div>
              {/* Faint waveform shimmer baked in as a static SVG (no animation) */}
              <svg className="absolute inset-0 w-full h-full opacity-30" viewBox="0 0 1000 80" preserveAspectRatio="none">
                <path d="M0 40 L20 30 L40 50 L60 25 L80 55 L100 35 L120 45 L140 20 L160 60 L180 40 L200 30 L220 50 L240 25 L260 55 L280 35 L300 45 L320 30 L340 50 L360 25 L380 55 L400 40 L420 30 L440 50 L460 25 L480 55 L500 35 L520 45 L540 30 L560 50 L580 25 L600 55 L620 40 L640 30 L660 50 L680 25 L700 55 L720 35 L740 45 L760 30 L780 50 L800 25 L820 55 L840 40 L860 30 L880 50 L900 25 L920 55 L940 35 L960 45 L980 30 L1000 40" stroke="#53fc18" strokeWidth="1.5" fill="none" />
              </svg>

              {/* Moment markers — vertical accent lines that flash in at clip positions as the scan crosses.
                  Each marker has its own per-index keyframe with baked-in stagger timing. */}
              {SLICE_CLIPS.map((clip, i) => (
                <div
                  key={i}
                  className="absolute top-0 bottom-0 pointer-events-none slice-mark"
                  style={{
                    left: `${clip.pos}%`,
                    width: '2px',
                    background: clip.hue,
                    boxShadow: `0 0 8px ${clip.hue}, 0 0 16px ${clip.hue}55`,
                    transformOrigin: 'center bottom',
                    animation: `sliceMark${i} ${SLICE_DURATION_MS}ms ease-out infinite`,
                    willChange: 'transform, opacity',
                  }}
                />
              ))}

              {/* THE SCANNING LINE — sweeps left to right once per loop. Pure CSS transform = GPU smooth. */}
              <div
                className="absolute top-0 bottom-0 pointer-events-none slice-scan"
                style={{
                  left: 0,
                  width: '3px',
                  background: 'linear-gradient(to bottom, transparent, #aaff66 20%, #aaff66 80%, transparent)',
                  boxShadow: '0 0 12px rgba(170,255,102,0.9), 0 0 32px rgba(83,252,24,0.6), 0 0 64px rgba(83,252,24,0.3)',
                  animation: `sliceScan ${SLICE_DURATION_MS}ms ease-in-out infinite`,
                  willChange: 'transform, opacity',
                }}
              />
            </div>

            {/* Caption between source and clips */}
            <div className="flex items-center justify-center my-7">
              <div className="flex items-center gap-3 text-[10px] mono text-stone-500 tracking-[0.25em] uppercase">
                <div className="w-12 h-px bg-gradient-to-r from-transparent to-[#53fc18]/40" />
                <span>SLICED INTO</span>
                <div className="w-12 h-px bg-gradient-to-l from-transparent to-[#53fc18]/40" />
              </div>
            </div>

            {/* SHORT CLIPS ROW — desktop: 6 phone-aspect cards that fall in as the scan passes */}
            <div className="relative h-40 md:h-44 hidden md:block">
              {SLICE_CLIPS.map((clip, i) => {
                const posPct = (i + 0.5) * (100 / 6); // evenly spaced across row
                return (
                  <div
                    key={i}
                    className="absolute top-0 slice-card-d"
                    style={{
                      left: `${posPct}%`,
                      width: '88px',
                      height: '100%',
                      transform: 'translate(-50%, -28px)',
                      opacity: 0,
                      animation: `sliceFall${i} ${SLICE_DURATION_MS}ms cubic-bezier(0.16, 1, 0.3, 1) infinite`,
                      willChange: 'transform, opacity',
                    }}
                  >
                    <SliceClipCard clip={clip} i={i} />
                  </div>
                );
              })}
            </div>

            {/* SHORT CLIPS GRID — mobile: the same six clips in a 3x2 grid so nothing overlaps or overflows */}
            <div className="grid grid-cols-3 gap-2.5 md:hidden">
              {SLICE_CLIPS.map((clip, i) => (
                <div
                  key={i}
                  className="relative slice-card-m"
                  style={{
                    aspectRatio: '9 / 16',
                    opacity: 0,
                    animation: `slicePop${i} ${SLICE_DURATION_MS}ms cubic-bezier(0.16, 1, 0.3, 1) infinite`,
                    willChange: 'transform, opacity',
                  }}
                >
                  <SliceClipCard clip={clip} i={i} />
                </div>
              ))}
            </div>

            {/* Footer row — pipeline metrics */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between pt-8 mt-2 border-t border-[#53fc18]/[0.08]">
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[10px] mono text-stone-500 tracking-[0.2em] uppercase">
                <span><span className="text-stone-600">PROCESS TIME</span> <span className="text-stone-200">2m 14s</span></span>
                <span className="text-stone-700">·</span>
                <span><span className="text-stone-600">AVG SCORE</span> <span className="text-stone-200">79.2</span></span>
                <span className="text-stone-700">·</span>
                <span><span className="text-stone-600">PLATFORMS</span> <span className="text-stone-200">TIKTOK · REELS · SHORTS</span></span>
              </div>
              {/* Hand off to the interactive run below rather than duplicating its CTA. */}
              <div className="flex items-center gap-2 text-[10px] mono text-stone-500 tracking-[0.25em] uppercase">
                <span>RUN IT ON A SAMPLE BELOW</span>
                <span aria-hidden="true" className="text-[#53fc18]">↓</span>
              </div>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
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

/* ──────────────────────────────────────────────────────────── CLIP PREVIEW PLAYER
   Vertical phone frame with synced auto-captions + waveform. Shows what
   the actual clip output looks like across platforms. */
function ClipPreviewPlayer() {
  const [platform, setPlatform] = useState('tiktok'); // tiktok | shorts | reels
  const [activeClipIdx, setActiveClipIdx] = useState(0);

  const clips = [
    {
      title: 'The 47-second framework that changed my Q4',
      caption: [
        { t: 0, w: 'So' }, { t: 0.15, w: 'the' }, { t: 0.3, w: 'thing' }, { t: 0.5, w: 'nobody' },
        { t: 0.75, w: 'tells' }, { t: 0.9, w: 'you' }, { t: 1.0, w: 'about' }, { t: 1.15, w: 'pricing' },
        { t: 1.4, w: 'is' }, { t: 1.55, w: 'that' }, { t: 1.7, w: 'cost-plus' },
        { t: 2.0, w: 'is' }, { t: 2.15, w: 'a' }, { t: 2.3, w: 'trap.' },
      ],
      author: '@maya.builds',
      handle: 'The Build Log · Ep 128',
      score: 94,
      duration: '0:47',
    },
    {
      title: 'When she changed her mind mid-sentence',
      caption: [
        { t: 0, w: 'I' }, { t: 0.15, w: 'used' }, { t: 0.3, w: 'to' }, { t: 0.45, w: 'think' },
        { t: 0.7, w: 'remote' }, { t: 0.95, w: 'work' }, { t: 1.15, w: 'was' }, { t: 1.3, w: 'the' },
        { t: 1.45, w: 'future' }, { t: 1.75, w: 'but' }, { t: 1.9, w: 'actually' },
        { t: 2.2, w: 'wait.' },
      ],
      author: '@deepwork.daily',
      handle: 'Deep Work Daily · Ep 53',
      score: 88,
      duration: '0:38',
    },
    {
      title: 'The framework, condensed',
      caption: [
        { t: 0, w: 'Three' }, { t: 0.2, w: 'questions.' },
        { t: 0.55, w: 'One:' }, { t: 0.8, w: 'who' }, { t: 0.95, w: 'pays?' },
        { t: 1.25, w: 'Two:' }, { t: 1.5, w: 'who' }, { t: 1.65, w: 'wins?' },
        { t: 1.95, w: 'Three:' }, { t: 2.25, w: 'what' }, { t: 2.4, w: 'breaks?' },
      ],
      author: '@the.signal.pod',
      handle: 'The Signal · Ep 207',
      score: 81,
      duration: '0:52',
    },
  ];

  const clip = clips[activeClipIdx];
  const totalCaptionDuration = 2.6;

  // Looping playback on the shared, time-based rAF engine (60fps, self-correcting).
  // The loop period equals the caption timeline, so captions play through and then
  // the next clip is selected. Reduced motion pins a settled frame and never loops.
  const progress = useLoopProgress({
    durationMs: totalCaptionDuration * 1000,
    resetKey: activeClipIdx,
    onLoop: () => setActiveClipIdx((i) => (i + 1) % clips.length),
    staticPct: 60,
  });

  const currentTime = (progress / 100) * totalCaptionDuration;
  const activeWordIdx = clip.caption.findIndex((w, i) => {
    const next = clip.caption[i + 1];
    return currentTime >= w.t && (!next || currentTime < next.t);
  });

  const platforms = [
    { id: 'tiktok', label: 'TikTok', ratio: '9:16', size: { w: 270, h: 480 } },
    { id: 'shorts', label: 'Shorts', ratio: '9:16', size: { w: 270, h: 480 } },
    { id: 'reels', label: 'Reels', ratio: '9:16', size: { w: 270, h: 480 } },
  ];
  const currentPlatform = platforms.find((p) => p.id === platform);

  return (
    <section className="relative z-10 max-w-[1400px] mx-auto px-6 md:px-8 py-16 border-t border-white/[0.12] overflow-hidden">
      <GlowOrb size={500} opacity={0.1} className="right-0 top-1/2 -translate-y-1/2" />
      <Reveal>
        <div className="grid md:grid-cols-[1.4fr_1fr] gap-12 items-center">
          {/* Left: copy */}
          <div>
            <div className="text-[10px] mono text-[#53fc18] mb-4 tracking-[0.2em] uppercase flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[#53fc18]" /> 
              The output
            </div>
            <h2 className="serif text-5xl md:text-6xl leading-[1.02] mb-5">
              Native captions. <span className="italic gradient-green">Native reframes.</span>
            </h2>
            <p className="text-stone-400 leading-relaxed mb-8 max-w-xl text-lg">
              Every clip ships with platform-tuned captions, vertical reframe, and a hook generated specifically for the destination feed. No post-processing. No reformatting. Drop and publish.
            </p>

            {/* Platform tabs */}
            <div className="inline-flex items-center gap-1 p-1 rounded-full border border-[#53fc18]/20 bg-black/40 mb-6">
              {platforms.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPlatform(p.id)}
                  className={`px-4 py-1.5 rounded-full text-[10px] mono tracking-wider uppercase ${platform === p.id ? 'text-black' : 'text-stone-400 hover:text-stone-200'}`}
                  style={platform === p.id ? { backgroundColor: '#53fc18', boxShadow: '0 0 16px rgba(83,252,24,0.4)' } : {}}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Clip selector */}
            <div className="space-y-2 max-w-md">
              {clips.map((c, i) => (
                <button
                  key={i}
                  onClick={() => setActiveClipIdx(i)}
                  className={`w-full text-left p-3 rounded-md border transition-all ${
                    i === activeClipIdx
                      ? 'border-[#53fc18]/40 bg-[#53fc18]/[0.05]'
                      : 'border-[#53fc18]/[0.08] bg-[#53fc18]/[0.01] hover:border-[#53fc18]/20'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <div
                        className="serif text-base"
                        style={i === activeClipIdx ? { color: '#53fc18', textShadow: '0 0 8px rgba(83,252,24,0.4)' } : { color: '#a8a29e' }}
                      >
                        {c.score}
                      </div>
                      <div className="text-[10px] mono text-stone-500 tracking-wider uppercase">virality</div>
                    </div>
                    <div className="text-[10px] mono text-stone-500 tracking-wider">{c.duration}</div>
                  </div>
                  <div className="text-sm text-stone-200 leading-snug">{c.title}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Right: phone frame */}
          <div className="flex justify-center">
            <div
              className="relative rounded-[36px] border-[3px] border-stone-800 bg-black p-2 shadow-[0_0_80px_-20px_rgba(83,252,24,0.4)]"
              style={{ width: currentPlatform.size.w, height: currentPlatform.size.h }}
            >
              {/* Notch */}
              <div className="absolute top-2 left-1/2 -translate-x-1/2 w-16 h-4 rounded-b-2xl bg-stone-900 z-20" />

              {/* Screen */}
              <div className="relative w-full h-full rounded-[28px] overflow-hidden bg-gradient-to-br from-stone-900 via-black to-stone-900">
                {/* Faux video bg — animated gradient */}
                <div
                  className="absolute inset-0"
                  style={{
                    background:
                      'radial-gradient(ellipse at 30% 40%, rgba(83,252,24,0.15) 0%, transparent 50%), radial-gradient(ellipse at 70% 60%, rgba(150,80,200,0.12) 0%, transparent 50%)',
                  }}
                />

                {/* Top status bar */}
                <div className="absolute top-0 inset-x-0 flex items-center justify-between px-4 pt-4 z-10 text-[10px] mono text-white/80">
                  <span>9:41</span>
                  <span className="flex items-center gap-1">
                    <span>●●●●</span>
                    <span>5G</span>
                    <span>100%</span>
                  </span>
                </div>

                {/* Platform UI overlay (top) */}
                <div className="absolute top-10 inset-x-0 flex items-center justify-between px-4 z-10">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#53fc18] to-emerald-500" />
                    <div>
                      <div className="text-xs text-white font-medium">{clip.author}</div>
                      <div className="text-[9px] text-white/60">{clip.handle}</div>
                    </div>
                  </div>
                  <button className="px-2.5 py-1 rounded-md bg-[#53fc18] text-black text-[10px] font-medium">Follow</button>
                </div>

                {/* Animated waveform "video" */}
                <div className="absolute inset-x-6 top-1/2 -translate-y-12 flex items-end gap-0.5 h-24">
                  {Array.from({ length: 38 }).map((_, j) => {
                    const distance = Math.abs(j - 19);
                    const baseHeight = 30 + Math.abs(Math.sin(j * 0.5 + currentTime * 3)) * 70;
                    const isActive = j / 38 < progress / 100;
                    return (
                      <div
                        key={j}
                        className="flex-1 rounded-sm h-full"
                        style={{
                          transform: `scaleY(${baseHeight / 100})`,
                          transformOrigin: 'bottom',
                          background: isActive ? '#53fc18' : 'rgba(255,255,255,0.3)',
                          boxShadow: isActive && distance < 4 ? '0 0 6px #53fc18' : 'none',
                        }}
                      />
                    );
                  })}
                </div>

                {/* Live captions — word-by-word */}
                <div className="absolute bottom-20 inset-x-4 z-10">
                  <div className="flex flex-wrap gap-x-1.5 gap-y-1 justify-center">
                    {clip.caption.map((word, i) => {
                      const isPast = i < activeWordIdx;
                      const isActive = i === activeWordIdx;
                      return (
                        <span
                          key={i}
                          className="text-base font-bold transition-all"
                          style={{
                            color: isActive ? '#53fc18' : isPast ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.4)',
                            textShadow: isActive
                              ? '0 0 12px rgba(83,252,24,0.8), 0 2px 4px rgba(0,0,0,0.8)'
                              : '0 2px 4px rgba(0,0,0,0.8)',
                            transform: isActive ? 'scale(1.08)' : 'scale(1)',
                          }}
                        >
                          {word.w}
                        </span>
                      );
                    })}
                  </div>
                </div>

                {/* Right rail — engagement */}
                <div className="absolute right-3 bottom-24 z-10 flex flex-col items-center gap-4">
                  <button aria-label="Like" className="flex flex-col items-center text-white/80 hover:text-[#53fc18]">
                    <Heart className="w-6 h-6" />
                  </button>
                  <button aria-label="Comment" className="flex flex-col items-center text-white/80">
                    <MessageCircle className="w-6 h-6" />
                  </button>
                  <button aria-label="Share" className="flex flex-col items-center text-white/80">
                    <Share2 className="w-6 h-6" />
                  </button>
                </div>

                {/* Progress bar */}
                <div className="absolute bottom-3 inset-x-4 z-10">
                  <div className="h-0.5 rounded-full bg-white/20 overflow-hidden">
                    <div
                      className="h-full w-full rounded-full"
                      style={{
                        transform: `scaleX(${progress / 100})`,
                        transformOrigin: 'left',
                        background: 'linear-gradient(90deg, #53fc18, #aaff66)',
                        boxShadow: '0 0 6px #53fc18',
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between mt-1 text-[9px] mono text-white/60">
                    <span>{(currentTime).toFixed(1)}s</span>
                    <span>{clip.duration}</span>
                  </div>
                </div>

                {/* Pulsing "clipper.ai" watermark badge */}
                <div className="absolute top-20 right-3 z-10 px-1.5 py-0.5 rounded bg-black/40 backdrop-blur text-[8px] mono text-[#53fc18] tracking-wider">
                  CLIPPER.AI · {clip.score}
                </div>
              </div>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

/* ──────────────────────────────────────────────────────────── INTERACTIVE DEMO
   Pick a sample recording → the studio opens and runs the real pipeline on it.
   The product *is* the demo. This section used to render its own inline
   "analyzing" console, which meant the site had two different loading screens
   for the same run; now there is exactly one — the studio's AnalyzingView —
   and this card only chooses what gets fed into it. */
function InteractiveDemo({ openApp }) {
  // Sourced from the shared SAMPLE_RECORDINGS so the visitor's pick actually
  // drives which clips lead the studio results.
  const SAMPLES = SAMPLE_RECORDINGS;
  const [picked, setPicked] = useState(0);
  const launch = () => openApp && openApp(SAMPLES[picked]);

  return (
    <section className="relative z-10 max-w-[1400px] mx-auto px-6 md:px-8 py-16 md:py-24 border-t border-white/[0.12]">
      <Reveal>
        <div className="text-center mb-10">
          <div className="text-[10px] mono text-[#53fc18] mb-4 tracking-[0.2em] uppercase flex items-center justify-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#53fc18]" style={{ boxShadow: '0 0 8px #53fc18' }} />
            Watch it work
          </div>
          <h2 className="serif text-4xl md:text-5xl leading-[1.05] mb-3">
            See it run on a <span className="italic gradient-green">real sample.</span>
          </h2>
          <p className="text-stone-400 leading-relaxed max-w-xl mx-auto">
            Pick a sample recording and watch the exact pipeline we'd run on yours, live in the studio, from raw recording to shipped clips.
          </p>
        </div>

        <div className="tilt-card max-w-4xl mx-auto rounded-2xl border border-[#53fc18]/20 bg-gradient-to-b from-[#53fc18]/[0.03] to-transparent overflow-hidden shadow-[0_0_60px_-20px_rgba(83,252,24,0.3)]">
          {/* Console header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-[#53fc18]/[0.10] bg-black/40">
            <div className="flex items-center gap-2 text-[10px] mono text-stone-400 tracking-wider uppercase">
              <span className="flex gap-1">
                <span className="w-2 h-2 rounded-full bg-stone-700" />
                <span className="w-2 h-2 rounded-full bg-stone-700" />
                <span className="w-2 h-2 rounded-full bg-[#53fc18]" style={{ boxShadow: '0 0 6px #53fc18' }} />
              </span>
              <span className="ml-2">clipper.ai / sample run</span>
            </div>
            <div className="text-[10px] mono text-stone-500 tracking-wider">
              READY
            </div>
          </div>

          {/* Pick a sample (no free-text URL: this is a managed service, not self-serve) */}
            <div className="p-8 md:p-10">
              <div className="text-[10px] mono text-stone-500 tracking-wider uppercase mb-3">Pick a sample recording</div>
              <div role="radiogroup" aria-label="Sample recording" className="flex flex-col gap-2 mb-6">
                {SAMPLES.map((s, i) => {
                  const active = i === picked;
                  return (
                    <button
                      key={s.label}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setPicked(i)}
                      className={`group/opt text-left w-full px-4 py-3 rounded-md border flex items-center gap-3 transition ${
                        active
                          ? 'border-[#53fc18] bg-[#53fc18]/10 ring-1 ring-[#53fc18]/40 shadow-[0_0_24px_-10px_rgba(83,252,24,0.6)]'
                          : 'border-white/15 bg-white/[0.02] hover:border-[#53fc18]/40 hover:bg-[#53fc18]/[0.04]'
                      }`}
                    >
                      {/* Radio indicator — unmistakable single-select affordance */}
                      <span
                        aria-hidden="true"
                        className={`shrink-0 w-[18px] h-[18px] rounded-full border flex items-center justify-center transition ${
                          active ? 'border-[#53fc18]' : 'border-white/30 group-hover/opt:border-[#53fc18]/60'
                        }`}
                      >
                        <span className={`w-2.5 h-2.5 rounded-full bg-[#53fc18] transition ${active ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={`block text-sm ${active ? 'text-stone-100' : 'text-stone-300'}`}>{s.label}</span>
                        <span className="block text-[10px] mono text-stone-500 truncate mt-0.5">{s.source}</span>
                      </span>
                      {active && (
                        <span className="shrink-0 inline-flex items-center gap-1 text-[10px] mono uppercase tracking-wider text-[#53fc18]">
                          <Check className="w-3.5 h-3.5" />
                          Selected
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <button
                  onClick={launch}
                  className="btn-neon group w-full sm:w-auto px-6 py-4 rounded-md font-medium flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  Watch the sample run
                  <ArrowUpRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </button>
                <span className="text-xs mono text-stone-500 tracking-wider">
                  Opens the studio and runs the full pipeline live
                </span>
              </div>
            </div>
        </div>
      </Reveal>
    </section>
  );
}

/* ──────────────────────────────────────────────────────────── INTEGRATIONS STRIP
   Logos for the tools Clipper plugs into. Ecosystem proof. */
function IntegrationsStrip() {
  const integrations = [
    { name: 'Zoom', cat: 'Source' },
    { name: 'Riverside', cat: 'Source' },
    { name: 'Descript', cat: 'Editor' },
    { name: 'TikTok', cat: 'Publish' },
    { name: 'Instagram', cat: 'Publish' },
    { name: 'LinkedIn', cat: 'Publish' },
    { name: 'Drive', cat: 'Storage' },
    { name: 'Dropbox', cat: 'Storage' },
    { name: 'Notion', cat: 'Workflow' },
    { name: 'Slack', cat: 'Workflow' },
  ];

  return (
    <section className="relative z-10 max-w-[1400px] mx-auto px-6 md:px-8 py-16 border-t border-white/[0.12]">
      <Reveal>
        <div className="grid md:grid-cols-[1fr_2fr] gap-12 items-start">
          <div>
            <div className="text-[10px] mono text-[#53fc18] mb-4 tracking-[0.2em] uppercase flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[#53fc18]" /> 
              Plays well with everything
            </div>
            <h2 className="serif text-4xl md:text-5xl leading-[1.05] mb-4">
              Drop in. <span className="italic gradient-green">Don't replace.</span>
            </h2>
            <p className="text-stone-400 leading-relaxed mb-6">
              Clipper fits where your content already lives. We pull from wherever you record, work in whatever tools you use, and publish to every platform your audience is on, so you don't change a thing about how you work.
            </p>
            <div className="flex flex-wrap gap-2 text-[10px] mono text-stone-500 tracking-wider uppercase">
              <span className="px-2 py-1 rounded border border-[#53fc18]/15">Any source</span>
              <span className="px-2 py-1 rounded border border-[#53fc18]/15">Any editor</span>
              <span className="px-2 py-1 rounded border border-[#53fc18]/15">Every platform</span>
              <span className="px-2 py-1 rounded border border-[#53fc18]/15">We handle it</span>
            </div>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2.5">
            {integrations.map((it, i) => (
              <div
                key={it.name}
                className="tilt-card group relative p-5 rounded-xl border border-[#53fc18]/[0.10] bg-gradient-to-br from-[#53fc18]/[0.02] to-transparent hover:border-[#53fc18]/40 flex flex-col items-center justify-center aspect-square overflow-hidden cursor-pointer transition-all duration-300"
                style={{ animationDelay: `${i * 30}ms` }}
              >
                {/* Inner glow on hover */}
                <div className="absolute inset-0 bg-gradient-to-br from-[#53fc18]/0 via-[#53fc18]/0 to-[#53fc18]/0 group-hover:from-[#53fc18]/[0.06] group-hover:to-[#53fc18]/0 transition-all duration-500" />
                {/* Corner accent */}
                <div className="absolute top-0 right-0 w-8 h-8 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <div className="absolute top-2 right-2 w-1 h-1 rounded-full bg-[#53fc18]" style={{ boxShadow: '0 0 6px #53fc18' }} />
                </div>
                <div className="relative">
                  <IntegrationGlyph name={it.name} />
                </div>
                <div className="relative text-[10px] mono text-stone-400 group-hover:text-stone-200 tracking-wider mt-3 text-center transition-colors">
                  {it.name}
                </div>
                <div className="absolute bottom-2 left-0 right-0 text-[8px] mono text-[#53fc18]/60 tracking-[0.15em] uppercase text-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  {it.cat}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Reveal>
    </section>
  );
}

/* SVG glyphs for each integration — minimal mark-style, neon-friendly */
function IntegrationGlyph({ name }) {
  const common = "w-8 h-8 text-stone-300 group-hover:text-[#53fc18] transition-all duration-300 group-hover:scale-110";
  switch (name) {
    case 'Zoom':
      // Rounded camera body + lens — video-meeting tool
      return (
        <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round">
          <rect x="2.5" y="6.5" width="13" height="11" rx="3" />
          <path d="M15.5 10.2 L21.5 7.2 v9.6 l-6 -3 z" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'Riverside':
      // Centered waveform — reads as audio recording
      return (
        <svg viewBox="0 0 24 24" className={common} fill="currentColor" stroke="none">
          <rect x="3.2" y="9" width="2" height="6" rx="1" />
          <rect x="6.7" y="6" width="2" height="12" rx="1" />
          <rect x="10.2" y="2.5" width="2" height="19" rx="1" />
          <rect x="13.7" y="6.5" width="2" height="11" rx="1" />
          <rect x="17.2" y="8.5" width="2" height="7" rx="1" />
        </svg>
      );
    case 'Descript':
      // App tile + play — media/transcript editor
      return (
        <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
          <rect x="3" y="3.5" width="18" height="17" rx="4.5" />
          <path d="M10 8.8 L15.5 12 L10 15.2 Z" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'TikTok':
      // Eighth-note glyph with the signature offset
      return (
        <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M13 4 v9.6 a3.6 3.6 0 1 1 -3.6 -3.6" />
          <path d="M13 4 c0 2.6 2.1 4.7 4.8 4.7" />
          <path d="M10.2 4.2 v9.6 a3.6 3.6 0 1 1 -3.6 -3.6" opacity="0.32" />
        </svg>
      );
    case 'Instagram':
      // Rounded frame + lens + flash dot
      return (
        <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.6">
          <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
          <circle cx="12" cy="12" r="4.2" />
          <circle cx="17" cy="7" r="1" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'LinkedIn':
      // The "in" mark
      return (
        <svg viewBox="0 0 24 24" className={common} fill="currentColor">
          <rect x="3" y="9" width="3.2" height="11" rx="0.4" />
          <circle cx="4.6" cy="5.2" r="1.9" />
          <path d="M9.5 9h3v1.7c.6-1 1.8-2 3.6-2 3.4 0 4.4 2.2 4.4 5.1V20h-3.3v-5.4c0-1.3-.3-2.4-1.7-2.4-1.5 0-2 1.1-2 2.4V20H9.5z" />
        </svg>
      );
    case 'Drive':
      // Official Google Drive mark (three blades)
      return (
        <svg viewBox="0 0 24 24" className={common} fill="currentColor">
          <path d="M12.01 1.485c-2.082 0-3.754.02-3.743.047.01.02 1.708 3.001 3.774 6.62l3.76 6.574h3.76c2.081 0 3.753-.02 3.742-.047-.005-.02-1.708-3.001-3.775-6.62l-3.76-6.574zm-4.76 1.73a789.828 789.861 0 0 0-3.63 6.319L0 15.868l1.89 3.298 1.885 3.297 3.62-6.335 3.618-6.33-1.88-3.287C8.1 4.704 7.255 3.22 7.25 3.214zm2.259 12.653-.203.348c-.114.198-.96 1.672-1.88 3.287a423.93 423.948 0 0 1-1.698 2.97c-.01.026 3.24.042 7.222.042h7.244l1.796-3.157c.992-1.734 1.85-3.23 1.906-3.323l.104-.167h-7.249z" />
        </svg>
      );
    case 'Dropbox':
      // Official Dropbox mark (five-facet open box)
      return (
        <svg viewBox="0 0 24 24" className={common} fill="currentColor">
          <path d="M6 1.807L0 5.629l6 3.822 6.001-3.822L6 1.807zM18 1.807l-6 3.822 6 3.822 6-3.822-6-3.822zM0 13.274l6 3.822 6.001-3.822L6 9.452l-6 3.822zM18 9.452l-6 3.822 6 3.822 6-3.822-6-3.822zM6 18.371l6.001 3.822 6-3.822-6-3.822L6 18.371z" />
        </svg>
      );
    case 'Notion':
      // The Notion "N"
      return (
        <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" strokeLinecap="round">
          <rect x="3.5" y="3.5" width="17" height="17" rx="2" />
          <path d="M8.5 17V8l7 8.5V8" />
        </svg>
      );
    case 'Slack':
      // Official Slack hash (eight rounded lozenges)
      return (
        <svg viewBox="0 0 24 24" className={common} fill="currentColor">
          <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
        </svg>
      );
    default:
      return <div className={common + " border border-current rounded-md"} />;
  }
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

export default function ClipperApp() {
  return (
    <ErrorBoundary>
      <ClipperAppInner />
    </ErrorBoundary>
  );
}

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
      if (s.el) { try { s.el.style.transform = ''; } catch (e) {} }
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

function ClipperAppInner() {
  const [view, setView] = useState('landing'); // landing | app
  const [page, setPage] = useState('home'); // home | product | pricing | docs | status | company
  const [stage, setStage] = useState('upload'); // upload | analyzing | results | pulse
  const [progress, setProgress] = useState(0);
  const [analysisStep, setAnalysisStep] = useState(0);
  const [momentsFound, setMomentsFound] = useState(0); // live counter during the "moments" stage
  const [stageHistory, setStageHistory] = useState([]); // [{ stage, at }] synthesized as the demo runs
  const [processedMs, setProcessedMs] = useState(null); // end-to-end demo run time, surfaced on results
  const [clips, setClips] = useState([]);
  const [selectedClip, setSelectedClip] = useState(null);
  const [videoMeta, setVideoMeta] = useState(null);
  const [history, setHistory] = useState([]);
  const [currentRunId, setCurrentRunId] = useState(null);
  const fileRef = useRef(null);

  // One tilt engine for the whole product (marketing pages + studio).
  useTiltEngine();

  // Load the showcase (pre-seeded demo jobs) + any live runs from the backend.
  const refreshHistory = React.useCallback(async () => {
    try {
      const runs = await fetchShowcase();
      setHistory(runs);
    } catch (e) {
      // Showcase is best-effort — never block the studio on it.
      console.error('showcase load failed', e);
    }
  }, []);

  useEffect(() => {
    refreshHistory();
  }, [refreshHistory]);

  // The backend persists every job automatically, so "persist" is just a
  // re-fetch of the list. Kept as a named function so call sites don't change.
  const persistRun = async () => {
    await refreshHistory();
  };

  const deleteRun = async (runId) => {
    // No hard-delete endpoint in the demo — just hide it from the list.
    setHistory((h) => h.filter((r) => r.id !== runId));
  };

  // Prepend a just-finished run so demo runs accumulate with their timing.
  const rememberRun = (run) => {
    if (!run || !run.id) return;
    setHistory((h) => [run, ...h.filter((r) => r.id !== run.id)].slice(0, 12));
  };

  const loadFromHistory = (run) => {
    setClips(run.clips);
    setVideoMeta(run.videoMeta);
    setProcessedMs(Number.isFinite(run.processedMs) ? run.processedMs : null);
    setCurrentRunId(run.id);
    setStage('results');
  };

  // Inject fonts via head link — works reliably in artifact sandbox
  useEffect(() => {
    const id = 'clipper-fonts';
    if (document.getElementById(id)) return;
    const preconnect1 = document.createElement('link');
    preconnect1.rel = 'preconnect';
    preconnect1.href = 'https://fonts.googleapis.com';
    const preconnect2 = document.createElement('link');
    preconnect2.rel = 'preconnect';
    preconnect2.href = 'https://fonts.gstatic.com';
    preconnect2.crossOrigin = 'anonymous';
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,300;0,400;0,500;0,600;1,400;1,500&family=JetBrains+Mono:wght@400;500&display=swap';
    document.head.appendChild(preconnect1);
    document.head.appendChild(preconnect2);
    document.head.appendChild(link);
  }, []);

  // Toggle studio-app body class — enables custom crosshair cursor in app view
  useEffect(() => {
    if (view === 'app') {
      document.body.classList.add('studio-app');
    } else {
      document.body.classList.remove('studio-app');
    }
    return () => document.body.classList.remove('studio-app');
  }, [view]);

  // Scroll to the top on every top-level transition. Switching between the
  // marketing site and the studio (and between studio stages / clip detail)
  // swaps the whole page body, but the window keeps its old scroll offset — so
  // without this the new view opens wherever the previous one was scrolled
  // (e.g. mid-page, since the triggering buttons sit far down). One place to own
  // it instead of scattering scrollTo() across every handler. rAF so it lands
  // after the new view paints (scrolling before the layout change gets undone).
  // A handler can opt out for one transition (skipTopScroll) when it performs
  // its own targeted scroll — e.g. bookCall jumping to the booking section.
  const skipTopScroll = useRef(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (skipTopScroll.current) { skipTopScroll.current = false; return; }
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    const id = requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: 'auto' }));
    return () => cancelAnimationFrame(id);
  }, [view, page, stage, selectedClip]);

  const analysisSteps = [
    'Ingesting the recording',
    'Transcribing the audio',
    'Finding the strongest moments',
    'Scoring each candidate',
    'Reframing & writing captions',
    'Packaging your clips',
  ];

  // Analysis is driven by runDemoPipeline (one eased rAF engine). Progress, the
  // active step, and the live moments-found counter all arrive via onProgress;
  // we stamp each stage the first time we reach it so the timeline shows real
  // per-stage timing — exactly as the backend's stage_history would.

  // Shared driver for both the uploaded-file path and the passive sample run.
  // `meta` is { name, size }; `input` is forwarded to the pipeline (unused by
  // the demo); `sampleClips` (optional) selects which clip ordering comes back,
  // so the visitor's sample pick on the landing page carries into the studio.
  // It owns every stage transition end to end.
  const runPipeline = async (meta, input, sampleClips) => {
    setVideoMeta(meta);
    setSelectedClip(null);
    setClips([]);
    setStage('analyzing');
    setProgress(0);
    setAnalysisStep(0);
    setMomentsFound(0);
    setStageHistory([]);
    setProcessedMs(null);
    const hist = [];
    const seen = new Set();
    try {
      const { clips: newClips, jobId } = await runDemoPipeline(input, {
        clips: Array.isArray(sampleClips) && sampleClips.length ? sampleClips : undefined,
        onProgress: (pct, stepIndex, info) => {
          setProgress(pct);
          if (typeof stepIndex === 'number') setAnalysisStep(stepIndex);
          if (info && typeof info.momentsFound === 'number') setMomentsFound(info.momentsFound);
          const stage = STEP_STAGE[stepIndex];
          if (stage && !seen.has(stage)) {
            seen.add(stage);
            hist.push({ stage, at: new Date().toISOString() });
            setStageHistory([...hist]);
          }
        },
      });
      setClips(newClips);
      const ms = hist.length ? Date.now() - Date.parse(hist[0].at) : null;
      setProcessedMs(ms);
      setCurrentRunId(jobId);
      setStage('results');
      // Surface this run in the sidebar with its timing (newest first).
      rememberRun({ id: jobId, clips: newClips, videoMeta: meta, createdAt: new Date().toISOString(), processedMs: ms });
    } catch (e) {
      console.error('pipeline failed', e);
      setStage('upload');
    }
  };

  const handleFile = async (file) => {
    if (!file) return;
    const meta = { name: file.name, size: (file.size / 1024 / 1024).toFixed(1) };
    await runPipeline(meta, file);
  };

  const reset = () => {
    setStage('upload');
    setClips([]);
    setSelectedClip(null);
    setVideoMeta(null);
    setProgress(0);
    setAnalysisStep(0);
    setMomentsFound(0);
    setStageHistory([]);
    setProcessedMs(null);
    setCurrentRunId(null);
  };

  // ── Step 4: passive sample walkthrough ──────────────────────────────────
  // The studio is no longer a self-serve tool. The only path "into" it is a
  // guided sample run: we auto-play one recording through the same pipeline so a
  // visitor can WATCH what we'd deliver. Nobody uploads anything, and the run
  // ends on "book a strategy call." No public CTA ever opens an empty studio.
  //
  // There is exactly ONE loading screen in the product — the studio's
  // AnalyzingView. Every "run/watch the sample" CTA on the site funnels here
  // (the landing demo used to render its own inline analyzing console; it now
  // hands its picked sample to this same run instead).
  const lastSample = useRef(null);
  const isSample = (s) => s && typeof s === 'object' && Array.isArray(s.clips) && s.meta;
  const runSample = (sample) => {
    const s = isSample(sample) ? sample : (lastSample.current || SAMPLE_RECORDINGS[0]);
    lastSample.current = s;
    runPipeline({ ...s.meta }, null, s.clips);
  };
  // Open the studio purely as that passive sample run. Tolerates being used as a
  // bare onClick handler (the click event is not a sample → falls back sensibly).
  // Scroll-to-top is handled centrally by the transition effect above.
  const watchSample = (sample) => {
    track('sample_play_click', isSample(sample) ? { sample: sample.meta.name } : undefined);
    setView('app');
    runSample(sample);
  };

  // Hoisted so both the marketing site and the sample walkthrough can use it.
  const bookCall = () => {
    track('cta_book_call_click');
    skipTopScroll.current = true; // we scroll to the booking section ourselves
    setView('landing');
    setPage('home');
    setTimeout(() => {
      const el = document.getElementById('book-call');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      else window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 80);
  };

  // Phase 1: fire a real page_view on mount and on every in-app navigation.
  useEffect(() => { track('page_view', { page }); }, [page]);
  useEffect(() => { applySeo(page, view); }, [page, view]);
  useEffect(() => { injectJsonLd(); }, []);
  useEffect(() => { injectPerfHints(); }, []);

  // Conversion funnel — scroll-depth milestones, once each per page. rAF-throttled, passive.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const fired = { 25: false, 50: false, 75: false, 100: false };
    let ticking = false;
    const check = () => {
      ticking = false;
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      if (scrollable <= 0) return;
      const pct = Math.min(100, Math.round((window.scrollY / scrollable) * 100));
      [25, 50, 75, 100].forEach((m) => {
        if (!fired[m] && pct >= m) { fired[m] = true; track('scroll_depth', { depth: m, page }); }
      });
    };
    const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(check); } };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [page]);

  // Conversion funnel — fire once when a key section first enters view.
  useEffect(() => {
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) return;
    const seen = new Set();
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting && e.target.id && !seen.has(e.target.id)) {
          seen.add(e.target.id);
          track('section_view', { section: e.target.id, page });
        }
      });
    }, { threshold: 0.3 });
    const raf = requestAnimationFrame(() => {
      ['book-call', 'faq'].forEach((id) => { const el = document.getElementById(id); if (el) io.observe(el); });
    });
    return () => { cancelAnimationFrame(raf); io.disconnect(); };
  }, [page]);

  if (view === 'landing') {
    const goto = (p) => { setPage(p); };
    // openApp now opens the studio as a passive sample run (see watchSample),
    // never an empty self-serve tool. bookCall + watchSample are hoisted above.
    const pageProps = { goto, openApp: watchSample, bookCall, page };
    return (
      <MotionConfig reducedMotion="user">
        <SiteShell {...pageProps}>
          <div key={page} className="page-transition">
          {page === 'home' && <Landing onStart={watchSample} goto={goto} bookCall={bookCall} />}
          {page === 'product' && <ProductPage goto={goto} openApp={watchSample} bookCall={bookCall} />}
          {page === 'pricing' && <PricingPage goto={goto} openApp={watchSample} bookCall={bookCall} />}
          {page === 'docs' && <DocsPage goto={goto} bookCall={bookCall} />}
          {page === 'status' && <StatusPage goto={goto} bookCall={bookCall} />}
          {page === 'privacy' && <PrivacyPage goto={goto} />}
          {page === 'terms' && <TermsPage goto={goto} />}
          {page === 'company' && <CompanyPage goto={goto} bookCall={bookCall} />}
          </div>
        </SiteShell>
        <CrosshairCursor />
      </MotionConfig>
    );
  }

  return (
    <div className="min-h-screen bg-black text-stone-100" style={{ fontFamily: "'Inter', -apple-system, sans-serif" }}>
      <style>{`
        .serif { font-family: 'Newsreader', Georgia, 'Times New Roman', serif; font-optical-sizing: auto; font-weight: 500; letter-spacing: -0.015em; line-height: 1.04; }
        .serif.italic, .serif em, em { font-style: italic; font-weight: 500; }
        .mono { font-family: 'JetBrains Mono', 'SF Mono', Menlo, monospace; font-feature-settings: "calt", "ss01"; }
        body, * { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; -webkit-font-smoothing: antialiased; }

        /* Motion system — slow, deliberate, Palantir-grade */
        @keyframes shimmer { 0% { background-position: -1000px 0; } 100% { background-position: 1000px 0; } }
        @keyframes pulse-ring { 0% { transform: scale(0.95); opacity: 1; } 100% { transform: scale(1.4); opacity: 0; } }
        @keyframes slide-up { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes blur-in {
          from { opacity: 0; filter: blur(12px); transform: translateY(20px); }
          to { opacity: 1; filter: blur(0); transform: translateY(0); }
        }
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes ambient {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.05); }
        }
        @keyframes scan {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(100vh); }
        }
        @keyframes grid-fade {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.7; }
        }
        .animate-slide-up { animation: slide-up 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .animate-blur-in { animation: blur-in 0.9s cubic-bezier(0.16, 1, 0.3, 1) forwards; opacity: 0; }
        .animate-fade-in { animation: fade-in 1.2s ease-out forwards; }
        .animate-ambient { animation: ambient 8s ease-in-out infinite; }

        /* Reveal-on-scroll utility */
        .reveal { opacity: 0; transform: translateY(24px); transition: opacity 1s cubic-bezier(0.16, 1, 0.3, 1), transform 1s cubic-bezier(0.16, 1, 0.3, 1); }
        .reveal.in { opacity: 1; transform: translateY(0); }

        /* Smooth scroll */
        html { scroll-behavior: smooth; }

        /* Grid background */
        .grid-bg {
          background-image:
            linear-gradient(rgba(83,252,24,0.10) 1px, transparent 1px),
            linear-gradient(90deg, rgba(83,252,24,0.10) 1px, transparent 1px);
          background-size: 64px 64px;
        }

        /* Soft transitions everywhere */
        button, a, [role="button"] { transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1); }

        /* Grain texture */
        .grain::before {
          content: ''; position: fixed; inset: 0; pointer-events: none; opacity: 0.035; z-index: 1; mix-blend-mode: overlay;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence baseFrequency='0.9' /%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)' /%3E%3C/svg%3E");
        }

        /* Accent glow utility */
        .glow-green { box-shadow: 0 0 0 1px rgba(83,252,24,0.2), 0 0 30px -5px rgba(83,252,24,0.3); }
        .text-glow { text-shadow: 0 0 28px rgba(83,252,24,0.22); }

        /* Gradient text for italic green — adds dimension */
        .gradient-green {
          background: linear-gradient(120deg, #53fc18 0%, #b8ff7d 90%);
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        @keyframes greenFlow { 0%, 100% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } }

        /* Removed the default blue focus ring; custom green ring shows on keyboard focus only */
        *:focus { outline: none; }
        *:focus-visible {
          outline: none;
          box-shadow: 0 0 0 2px rgba(83, 252, 24, 0.5), 0 0 12px rgba(83, 252, 24, 0.25);
          border-radius: 4px;
        }

        /* Animated underline for inline links */
        .link-underline { position: relative; }
        .link-underline::after {
          content: ''; position: absolute; left: 0; bottom: -2px; width: 100%; height: 1px;
          background: #53fc18; transform-origin: right; transform: scaleX(0);
          transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .link-underline:hover::after { transform-origin: left; transform: scaleX(1); }

        /* Shimmer effect — for use on premium tiles */
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        .shimmer-on-hover {
          background: linear-gradient(110deg, transparent 30%, rgba(83,252,24,0.08) 45%, rgba(83,252,24,0.12) 50%, rgba(83,252,24,0.08) 55%, transparent 70%);
          background-size: 200% 100%;
          background-position: -200% 0;
          opacity: 0;
          transition: opacity 0.3s ease;
        }
        .group:hover .shimmer-on-hover {
          opacity: 1;
          animation: shimmer 1.4s ease-in-out;
        }

        /* Smooth scrollbar */
        ::-webkit-scrollbar { width: 10px; height: 10px; }
        ::-webkit-scrollbar-track { background: rgba(20,20,18,0.4); }
        ::-webkit-scrollbar-thumb {
          background: rgba(83,252,24,0.15);
          border-radius: 999px;
          border: 2px solid transparent;
          background-clip: padding-box;
        }
        ::-webkit-scrollbar-thumb:hover { background: rgba(83,252,24,0.35); background-clip: padding-box; border: 2px solid transparent; }

        /* Selection color — when you highlight text */
        ::selection { background: rgba(83,252,24,0.3); color: #fff; }

        /* Subtle hover lift on cards */
        .card-lift { transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.3s, box-shadow 0.3s; }
        .card-lift:hover { transform: translateY(-2px); }

        /* Magnetic border glow — for primary CTAs */
        .magnetic-glow { position: relative; isolation: isolate; }
        .magnetic-glow::before {
          content: ''; position: absolute; inset: -1px; border-radius: inherit;
          background: linear-gradient(120deg, transparent 30%, rgba(83,252,24,0.6) 50%, transparent 70%);
          background-size: 200% 100%;
          background-position: -200% 0;
          z-index: -1; opacity: 0;
          transition: opacity 0.3s ease;
        }
        .magnetic-glow:hover::before {
          opacity: 1;
          animation: shimmer 1.8s linear infinite;
        }

        /* ── Studio wow layer (additive, dependency-free) ─────────────── */
        /* Unified neon button system — mirrors the marketing site so the
           studio's CTAs read as real buttons, not bare text. */
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
        .cta-glow { box-shadow: 0 8px 30px rgba(83,252,24,0.14); }

        /* Neon hairline under the studio nav — matches the marketing chrome. */
        .studio-nav::after {
          content: ''; position: absolute; left: 0; right: 0; bottom: -1px; height: 1px;
          background: linear-gradient(90deg, transparent 10%, rgba(83,252,24,0.45) 50%, transparent 90%);
          pointer-events: none;
        }

        /* Viewfinder corner brackets — camera-framing detail on data panels. */
        .vf-corners { position: relative; }
        .vf-corners::before, .vf-corners::after {
          content: ''; position: absolute; width: 14px; height: 14px; pointer-events: none;
          border: 1px solid rgba(83,252,24,0.30); transition: border-color .35s ease;
        }
        .vf-corners::before { top: 8px; left: 8px; border-right: 0; border-bottom: 0; border-top-left-radius: 5px; }
        .vf-corners::after { bottom: 8px; right: 8px; border-left: 0; border-top: 0; border-bottom-right-radius: 5px; }
        .vf-corners:hover::before, .vf-corners:hover::after { border-color: rgba(83,252,24,0.7); }

        /* Sonar backdrop — slow rotation for the decorative ring SVG. */
        @keyframes sonarSpin { to { transform: rotate(360deg); } }
        .sonar-spin { animation: sonarSpin 80s linear infinite; transform-origin: center; }
        @keyframes blipPulse { 0%, 100% { opacity: 0.15; } 50% { opacity: 0.9; } }
        .sonar-blip { animation: blipPulse 3.2s ease-in-out infinite; }

        /* Results waveform — draws itself in once on mount. */
        @keyframes waveDraw { to { stroke-dashoffset: 0; } }
        .wave-draw { stroke-dasharray: 1; stroke-dashoffset: 1;
          animation: waveDraw 2.4s cubic-bezier(.16,1,.3,1) 0.25s forwards; }

        /* Clip cards — neon hairline + green tint on hover. */
        .clip-card { position: relative; }
        .clip-card::before {
          content: ''; position: absolute; inset: 0 0 auto 0; height: 1px; z-index: 1;
          background: linear-gradient(90deg, transparent, rgba(83,252,24,0.7), transparent);
          opacity: 0; transition: opacity .35s ease; pointer-events: none;
        }
        .clip-card:hover { border-color: rgba(83,252,24,0.35) !important;
          box-shadow: 0 18px 50px -24px rgba(83,252,24,0.4); }
        .clip-card:hover::before { opacity: 1; }

        /* Living gradient text — same breathing flow as the marketing site. */
        .gradient-green {
          background: linear-gradient(120deg, #53fc18 0%, #b8ff7d 30%, #53fc18 55%, #d2ff9e 80%, #53fc18 100%);
          background-size: 240% 240%;
          -webkit-background-clip: text; background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: greenFlow 8s ease-in-out infinite;
        }

        /* ── Delivery materialization — the shipped-clips wow sequence ──────
           Cards arrive staggered (blur-rise), a render-sweep scanline wipes
           each 9:16 preview while the frame "develops" from dark to lit, and
           the Editor-reviewed pill stamps in last. All one-shot, backwards
           fill (so hover transforms still win after entry), classes removed
           by ClipCard once the sequence completes (so re-sorting the grid
           never replays it). */
        @keyframes clipMaterialize {
          0%   { opacity: 0; transform: translateY(26px) scale(0.97); filter: blur(10px); }
          55%  { filter: blur(0); }
          100% { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
        }
        .clip-enter { animation: clipMaterialize .85s cubic-bezier(.16,1,.3,1) backwards; }

        @keyframes clipSweep {
          0%   { transform: translateY(-140%); opacity: 0; }
          12%  { opacity: 1; }
          80%  { opacity: 1; }
          100% { transform: translateY(440%); opacity: 0; }
        }
        .clip-sweep {
          position: absolute; left: -10%; right: -10%; top: 0; height: 26%;
          pointer-events: none; z-index: 3; opacity: 0;
          background: linear-gradient(to bottom,
            transparent,
            rgba(83,252,24,0.14) 40%,
            rgba(170,255,102,0.85) 50%,
            rgba(83,252,24,0.14) 60%,
            transparent);
          animation: clipSweep 1.05s cubic-bezier(.55,.06,.35,1) backwards;
        }
        @keyframes clipDevelop {
          from { filter: brightness(0.22) saturate(0.35); }
          to   { filter: brightness(1) saturate(1); }
        }
        .clip-develop { animation: clipDevelop 1s ease-out backwards; }

        @keyframes clipStamp {
          0%   { opacity: 0; transform: scale(1.45); }
          62%  { opacity: 1; transform: scale(0.96); }
          100% { opacity: 1; transform: scale(1); }
        }
        .clip-stamp { animation: clipStamp .45s cubic-bezier(.34,1.56,.64,1) backwards; }

        /* Cursor spotlight — a soft green light + border glint that track the
           pointer across each clip card (CSS vars set from one mousemove). */
        .clip-spot {
          position: absolute; inset: 0; z-index: 1; pointer-events: none; opacity: 0;
          transition: opacity .45s ease; border-radius: inherit;
          background: radial-gradient(240px circle at var(--mx, 50%) var(--my, 40%),
            rgba(83,252,24,0.11), transparent 65%);
        }
        .clip-card:hover .clip-spot { opacity: 1; }
        .clip-ring {
          position: absolute; inset: 0; z-index: 2; pointer-events: none; opacity: 0;
          transition: opacity .45s ease; border-radius: inherit; padding: 1px;
          background: radial-gradient(190px circle at var(--mx, 50%) var(--my, 40%),
            rgba(170,255,102,0.85), transparent 70%);
          -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
          -webkit-mask-composite: xor;
          mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
          mask-composite: exclude;
        }
        .clip-card:hover .clip-ring { opacity: 1; }
        /* Spotlight is reusable: any .spot-host (stat tiles, panels) gets it too. */
        .spot-host:hover .clip-spot, .spot-host:hover .clip-ring { opacity: 1; }
        /* 3D tilt cards — same shared engine (useTiltEngine) as the marketing
           site, so studio panels lean toward the cursor identically. */
        .tilt-card { will-change: transform;
          transition-property: border-color, box-shadow, background-color, color, opacity, filter !important; }

        /* ── Analytics boot sequence — the stats deck powers on ────────────
           The waveform draws in behind a moving scan-head, stat tiles rise in
           staggered, each tile's micro-viz wipes on left→right like a plotter,
           and the big numbers "lock in" with a flash as their count-up lands.
           All one-shot; the meter head-dots keep a faint instrument breathing. */
        .stat-enter { animation: clipMaterialize .7s cubic-bezier(.16,1,.3,1) backwards; }

        @keyframes vizReveal {
          from { clip-path: inset(0 100% 0 0); opacity: 0.35; }
          to   { clip-path: inset(0 -8% 0 0); opacity: 1; }
        }
        .viz-reveal { animation: vizReveal .9s cubic-bezier(.3,.7,.3,1) backwards; }

        @keyframes valLock {
          0%   { text-shadow: 0 0 22px rgba(83,252,24,0); }
          40%  { text-shadow: 0 0 26px rgba(83,252,24,0.85), 0 0 58px rgba(83,252,24,0.35); }
          100% { text-shadow: 0 0 22px rgba(83,252,24,0.18); }
        }
        .val-lock { animation: valLock .7s ease-out backwards; }

        /* Scan-head riding the waveform draw: an inset-0 layer whose right edge
           carries the beam, translated -100% → 0 (pure transform). */
        @keyframes waveScan { from { transform: translateX(-100%); } to { transform: translateX(0); } }
        .wave-scan {
          position: absolute; inset: 0; pointer-events: none; opacity: 1;
          background:
            linear-gradient(to right, transparent calc(100% - 90px), rgba(83,252,24,0.10) calc(100% - 8px), transparent),
            linear-gradient(to right, transparent calc(100% - 2px), rgba(190,255,130,0.9) calc(100% - 1px));
          animation: waveScan 2.4s cubic-bezier(.16,1,.3,1) 0.25s backwards,
                     waveFade .3s linear 2.55s forwards;
        }
        @keyframes waveFade { from { opacity: 1; } to { opacity: 0; } }

        /* One-shot ping ring behind the headline clip count. */
        @keyframes headPing {
          0%   { opacity: 0.9; transform: translate(-50%,-50%) scale(0.35); }
          100% { opacity: 0;   transform: translate(-50%,-50%) scale(2.4); }
        }
        .head-ping {
          position: absolute; left: 50%; top: 50%; width: 1.6em; height: 1.6em;
          border-radius: 9999px; border: 1.5px solid rgba(83,252,24,0.8);
          box-shadow: 0 0 18px rgba(83,252,24,0.5); pointer-events: none;
          animation: headPing 1.1s cubic-bezier(.16,1,.3,1) .2s backwards;
          opacity: 0;
        }

        /* Faint instrument breathing on meter head-dots after they land. */
        @keyframes dotBreathe { 0%, 100% { opacity: 0.75; } 50% { opacity: 1; } }
        .meter-dot { animation: dotBreathe 3.4s ease-in-out 2.2s infinite; }

        /* ── Source map layer ───────────────────────────────────────────
           The waveform doubles as a map of the source recording: a mirrored
           audio body fades in under the draw, then the extracted clip regions
           land staggered as glowing bands. A faint radar-style rescan beam
           keeps drifting across afterwards so the instrument feels live. */
        @keyframes waveFillIn { from { opacity: 0; } to { opacity: 1; } }
        .wave-fill-in { animation: waveFillIn 1.4s ease-out 0.7s backwards; }
        @keyframes regionIn {
          0%   { opacity: 0; transform: scaleY(0.2); }
          100% { opacity: 1; transform: scaleY(1); }
        }
        .region-in {
          transform-origin: center; transform-box: fill-box;
          animation: regionIn .55s cubic-bezier(.16,1,.3,1) backwards;
        }
        @keyframes waveRescan {
          0%   { transform: translateX(-100%); opacity: 0; }
          3%   { opacity: 0.45; }
          26%  { opacity: 0.45; }
          30%  { transform: translateX(0); opacity: 0; }
          100% { transform: translateX(0); opacity: 0; }
        }
        .wave-rescan {
          position: absolute; inset: 0; pointer-events: none; opacity: 0;
          background:
            linear-gradient(to right, transparent calc(100% - 70px), rgba(83,252,24,0.07) calc(100% - 6px), transparent),
            linear-gradient(to right, transparent calc(100% - 2px), rgba(190,255,130,0.55) calc(100% - 1px));
          animation: waveRescan 11s linear 4s infinite;
        }

        /* Engagement radar — the triangle plot scales in once. */
        @keyframes radarIn { from { opacity: 0; transform: scale(0.5); } to { opacity: 1; transform: scale(1); } }
        .radar-in { transform-origin: center; transform-box: fill-box;
          animation: radarIn .8s cubic-bezier(.16,1,.3,1) backwards; }

        /* Blueprint grid — faint engineering-paper texture inside data tiles,
           fading out toward the bottom so content stays the focus. */
        .panel-grid {
          position: absolute; inset: 0; pointer-events: none;
          background:
            repeating-linear-gradient(to right, rgba(83,252,24,0.05) 0 1px, transparent 1px 26px),
            repeating-linear-gradient(to bottom, rgba(83,252,24,0.05) 0 1px, transparent 1px 26px);
          -webkit-mask-image: linear-gradient(160deg, rgba(0,0,0,0.9), transparent 62%);
          mask-image: linear-gradient(160deg, rgba(0,0,0,0.9), transparent 62%);
        }

        @media (prefers-reduced-motion: reduce) {
          .sonar-spin, .sonar-blip, .gradient-green { animation: none !important; }
          .wave-draw { animation: none !important; stroke-dashoffset: 0; }
          .btn-neon::after { display: none; }
          .clip-enter, .clip-develop, .clip-stamp { animation: none !important; }
          .clip-sweep, .clip-spot, .clip-ring { display: none !important; }
          .stat-enter, .viz-reveal, .val-lock, .meter-dot { animation: none !important; }
          .wave-scan, .head-ping { display: none !important; }
          .wave-fill-in, .region-in, .radar-in { animation: none !important; }
          .wave-rescan { display: none !important; }
          .tilt-card { transform: none !important; }
        }
      `}</style>

      <div className="grain" />
      <StudioBackdrop />

      {/* Top bar — passive sample walkthrough, not a self-serve studio */}
      <nav className="studio-nav border-b border-stone-800/60 bg-black/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-[1400px] mx-auto px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-5">
            <button onClick={() => setView('landing')} className="flex items-center gap-2.5">
              <LogoMark size={28} />
              <span className="serif text-2xl tracking-tight">Clipper.ai</span>
            </button>
            <span className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/[0.12] bg-white/[0.04] text-[11px] mono tracking-wider text-stone-300">
              <span className="w-1.5 h-1.5 rounded-full bg-[#53fc18]" />
              SAMPLE RUN · WHAT WE'D DELIVER
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setView('landing')}
              className="text-sm text-stone-400 hover:text-stone-100 transition-colors"
            >
              ← Back to site
            </button>
            <button
              onClick={bookCall}
              className="btn-neon px-4 py-2 rounded-md font-medium text-sm"
            >
              Book a demo
            </button>
          </div>
        </div>
      </nav>

      <main className="relative z-10 max-w-[1400px] mx-auto px-8 py-10">
        {stage === 'upload' && <UploadView onFile={handleFile} fileRef={fileRef} history={history} onLoadRun={loadFromHistory} onDeleteRun={deleteRun} />}
        {stage === 'analyzing' && <AnalyzingView progress={progress} step={analysisStep} steps={analysisSteps} videoMeta={videoMeta} stageHistory={stageHistory} momentsFound={momentsFound} />}
        {stage === 'results' && (
          selectedClip ? (
            <ClipDetailView clip={selectedClip} onBack={() => setSelectedClip(null)} bookCall={bookCall} />
          ) : (
            <ResultsView clips={clips} onSelect={setSelectedClip} onReset={watchSample} videoMeta={videoMeta} processedMs={processedMs} bookCall={bookCall} />
          )
        )}
      </main>

      <CrosshairCursor />
    </div>
  );
}

/* ─────────────────────────────────────────────────── STUDIO BACKDROP
   Ambient layer behind the studio: a soft radial glow, a masked grid, and a
   decorative sonar-ring SVG (slow rotation, pulsing blips) that nods to the
   "signals detected" framing. Fixed, pointer-events-none, sits under <main>
   (which is relative z-10); all motion is gated behind reduced-motion. */
function StudioBackdrop() {
  const TICKS = 48;
  return (
    <div aria-hidden className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
      {/* Top ambient glow — anchors the header */}
      <div
        className="absolute -top-44 left-1/2 -translate-x-1/2 w-[960px] h-[520px]"
        style={{ background: 'radial-gradient(ellipse at center, rgba(83,252,24,0.085), transparent 65%)' }}
      />
      {/* Faint grid, fading downward */}
      <div
        className="absolute inset-x-0 top-0 h-[440px] grid-bg"
        style={{
          opacity: 0.14,
          maskImage: 'linear-gradient(to bottom, rgba(0,0,0,0.9), transparent)',
          WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,0.9), transparent)',
        }}
      />

      {/* Sonar rings — decorative signal-scan SVG, top right */}
      <svg
        viewBox="0 0 560 560"
        fill="none"
        className="absolute -top-28 -right-32 w-[560px] h-[560px]"
        style={{ opacity: 0.34 }}
      >
        <defs>
          <radialGradient id="sbGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#53fc18" stopOpacity="0.14" />
            <stop offset="100%" stopColor="#53fc18" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="sbSweep" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#53fc18" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#53fc18" stopOpacity="0" />
          </linearGradient>
        </defs>

        <circle cx="280" cy="280" r="252" fill="url(#sbGlow)" />

        {/* Static rings */}
        <circle cx="280" cy="280" r="96" stroke="#53fc18" strokeOpacity="0.28" strokeWidth="1" />
        <circle cx="280" cy="280" r="156" stroke="#53fc18" strokeOpacity="0.18" strokeWidth="1" strokeDasharray="3 9" />
        <circle cx="280" cy="280" r="216" stroke="#53fc18" strokeOpacity="0.12" strokeWidth="1" />
        {/* Crosshair */}
        <line x1="280" y1="20" x2="280" y2="540" stroke="#53fc18" strokeOpacity="0.08" strokeWidth="1" />
        <line x1="20" y1="280" x2="540" y2="280" stroke="#53fc18" strokeOpacity="0.08" strokeWidth="1" />

        {/* Rotating layer: degree ticks + sweep wedge + blips */}
        <g className="sonar-spin" style={{ transformBox: 'fill-box', transformOrigin: 'center' }}>
          {Array.from({ length: TICKS }).map((_, i) => {
            const a = (i / TICKS) * Math.PI * 2;
            const long = i % 4 === 0;
            const r1 = long ? 232 : 240;
            const x1 = 280 + Math.cos(a) * r1;
            const y1 = 280 + Math.sin(a) * r1;
            const x2 = 280 + Math.cos(a) * 248;
            const y2 = 280 + Math.sin(a) * 248;
            return (
              <line
                key={i}
                x1={x1.toFixed(1)} y1={y1.toFixed(1)}
                x2={x2.toFixed(1)} y2={y2.toFixed(1)}
                stroke="#53fc18" strokeOpacity={long ? 0.3 : 0.15} strokeWidth="1"
              />
            );
          })}
          {/* Sweep arm */}
          <path d="M 280 280 L 528 280 A 248 248 0 0 0 494.7 156 Z" fill="url(#sbSweep)" opacity="0.35" />
          <line x1="280" y1="280" x2="528" y2="280" stroke="#53fc18" strokeOpacity="0.4" strokeWidth="1" />
          {/* Signal blips */}
          <circle className="sonar-blip" cx="356" cy="196" r="2.5" fill="#53fc18" />
          <circle className="sonar-blip" cx="184" cy="332" r="2" fill="#53fc18" style={{ animationDelay: '1.1s' }} />
          <circle className="sonar-blip" cx="412" cy="356" r="1.8" fill="#aaff66" style={{ animationDelay: '2.2s' }} />
        </g>
        <circle cx="280" cy="280" r="3" fill="#53fc18" fillOpacity="0.6" />
      </svg>

      {/* Counterweight glow, bottom-left — echoes the purple in clip art */}
      <div
        className="absolute -bottom-56 -left-44 w-[620px] h-[620px] rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(120,70,190,0.065), transparent 70%)' }}
      />
    </div>
  );
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

/* ──────────────────────────────────────────────────────────── LANDING */
const PL_GLYPHS = (() => {
  // Built once at module load so the six SVGs are never recreated on a render frame.
  const s = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round', strokeLinejoin: 'round' };
  const w = (children) => <svg viewBox="0 0 17 17" width="15" height="15" aria-hidden="true">{children}</svg>;
  return {
    wave: w(<path {...s} d="M1.5 8.5h2L5 3.5l2.2 10L9.5 6l1.4 3.2h4.1" />),
    split: w(<g {...s}><path d="M2 8.5h11.5" /><path d="M6 4.5 9.5 8.5 6 12.5" /><path d="M13.5 4.5v8" /></g>),
    gauge: w(<g {...s}><path d="M2.2 12a6.3 6.3 0 0 1 12.6 0" /><path d="M8.5 12l3.4-3.8" /></g>),
    crop: w(<g {...s}><rect x="1.5" y="5" width="7.5" height="6" rx="1" /><rect x="10" y="2.5" width="4.5" height="11" rx="1" /></g>),
    caption: w(<g {...s}><rect x="1.8" y="3.5" width="13" height="9.5" rx="1.6" /><path d="M4.6 7.2h7M4.6 9.8h4.5" /></g>),
    rank: w(<g {...s}><path d="M2 13h13" /><path d="M3.5 13V8.5M7.3 13V4.5M11 13V9.8M14.6 13V6.8" /></g>),
  };
})();

function PipelineExplorer() {
  const NODES = [
    { n: '01', label: 'Transcribe', g: 'wave', val: 1240, unit: 'words', blurb: 'Speech becomes accurate, word-level text with timestamps.', out: '1,240 words \u00b7 99.2%' },
    { n: '02', label: 'Segment', g: 'split', val: 38, unit: 'segments', blurb: 'Topic and speaker shifts split the audio into candidate moments.', out: '38 segments' },
    { n: '03', label: 'Score', g: 'gauge', val: 92, unit: 'score', blurb: 'Every segment is rated for hook, emotion and pacing.', out: 'top moment: 92' },
    { n: '04', label: 'Reframe', g: 'crop', val: 1850, unit: 'frames', blurb: 'Subject tracking recomposes 16:9 footage into vertical 9:16.', out: '9:16 \u00b7 locked' },
    { n: '05', label: 'Caption', g: 'caption', val: 318, unit: 'cues', blurb: 'Word-level karaoke captions are styled and burned in.', out: 'word-level' },
    { n: '06', label: 'Rank', g: 'rank', val: 6, unit: 'clips', blurb: 'The strongest moments are ranked and exported per platform.', out: '6 clips ready' },
  ];
  const N = NODES.length;
  // Continuous motion is driven imperatively: one CSS var (--p) plus a few textContent
  // writes per frame, so the component does NOT re-render 60x/sec. React state only holds
  // the coarse stage index (changes ~6x per pass) -> smooth, fully GPU-composited.
  const [stage, setStage] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [pinned, setPinned] = useState(null);
  const [hover, setHover] = useState(null);
  const [touched, setTouched] = useState(false);
  const [reduced, setReduced] = useState(false);
  const trackRef = useRef(null);
  const rafRef = useRef(0);
  const startRef = useRef(null);
  const autoRef = useRef(true);
  const dragRef = useRef(false);
  const pRef = useRef(0);
  const stageRef = useRef(0);
  const numRefs = useRef([]);
  const pctRef = useRef(null);
  const resumeRef = useRef(0);

  const fmt = (v) => String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  // Single writer for everything that moves. Called every animation frame AND on scrub.
  const apply = (p) => {
    p = Math.max(0, Math.min(1, p));
    pRef.current = p;
    // Processing (nodes / numbers / stage / mini-bars) completes at 92% of the head's travel,
    // so the finished "06/06" state stays readable for the final glide while the head keeps
    // moving to the very end -- no pause, no backward motion, seamless loop.
    const q = Math.min(p / 0.92, 1);
    const el = trackRef.current;
    // Fade the playhead + rail fill to 0 across a ~240ms window at the loop seam, so the head's
    // wrap from the right edge back to the left (and the fill collapsing) happen while invisible.
    // Auto-play only -- manual scrubbing keeps everything fully lit.
    let seam = 1;
    if (autoRef.current) { const E = 0.02; if (p < E) seam = p / E; else if (p > 1 - E) seam = (1 - p) / E; }
    if (el) { el.style.setProperty('--p', p); el.style.setProperty('--q', q); el.style.setProperty('--seam', seam); } // head+fill use --p, bars use --q, --seam masks the loop seam
    if (pctRef.current) pctRef.current.textContent = Math.round(p * 100) + '%';
    for (let i = 0; i < N; i++) {
      const local = Math.max(0, Math.min(1, q * N - i));
      const r = numRefs.current[i];
      if (r) r.textContent = fmt(Math.round(NODES[i].val * local));
    }
    const sNew = Math.floor(q * N);                               // reaches N during the final glide
    if (sNew !== stageRef.current) { stageRef.current = sNew; setStage(sNew); }
  };

  const stopAuto = () => { autoRef.current = false; cancelAnimationFrame(rafRef.current); clearTimeout(resumeRef.current); };
  const startAuto = () => {
    autoRef.current = true; startRef.current = null;
    cancelAnimationFrame(rafRef.current); clearTimeout(resumeRef.current);
    const LOOP = 12000; // ms for one slow forward pass; loops seamlessly with no pause at the end
    const p0 = pRef.current; // resume from wherever the head currently sits (replay calls apply(0) first)
    const tick = (t) => {
      if (startRef.current == null) startRef.current = t - p0 * LOOP; // continue forward, never snap back to 0
      const p = ((t - startRef.current) % LOOP) / LOOP; // 0 -> 1 forward only, then restart (no hold)
      apply(p);
      if (autoRef.current) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  };
  // After a scrub or a card click, pause briefly to inspect, then glide on again on its own.
  const scheduleResume = () => {
    clearTimeout(resumeRef.current);
    resumeRef.current = setTimeout(() => { setPinned(null); setHover(null); startAuto(); }, 2600);
  };

  useEffect(() => {
    const mq = (typeof window !== 'undefined' && window.matchMedia) ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    const rm = !!(mq && mq.matches);
    setReduced(rm);
    if (rm) { apply(1); return; }
    apply(0);
    startAuto();
    return () => { cancelAnimationFrame(rafRef.current); clearTimeout(resumeRef.current); };
  }, []);

  const setFromX = (clientX) => {
    const el = trackRef.current; if (!el) return;
    const r = el.getBoundingClientRect();
    apply((clientX - r.left) / r.width);
  };
  const onDown = (e) => {
    stopAuto(); setTouched(true); setDragging(true); dragRef.current = true; setPinned(null);
    if (e.currentTarget.setPointerCapture) { try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) {} }
    setFromX(e.clientX);
  };
  const onMove = (e) => { if (!dragRef.current) return; setFromX(e.clientX); };
  const onUp = (e) => {
    setDragging(false); dragRef.current = false;
    if (e.currentTarget.releasePointerCapture) { try { e.currentTarget.releasePointerCapture(e.pointerId); } catch (err) {} }
    scheduleResume();
  };
  const onNode = (i) => { stopAuto(); setTouched(true); setPinned(i); apply((i + 0.5) / N); scheduleResume(); };
  const replay = () => { clearTimeout(resumeRef.current); setPinned(null); setHover(null); setTouched(true); apply(0); startAuto(); };

  const done = Math.min(stage, N);
  const focus = pinned != null ? pinned : (hover != null ? hover : Math.min(stage, N - 1));
  const f = NODES[focus];
  const fState = focus < stage ? 'done' : (focus === stage ? 'active' : 'idle');

  return (
    <div className="pl-stage">
      <div className="pl-panel rounded-2xl border border-[#53fc18]/[0.14] bg-gradient-to-b from-white/[0.03] to-transparent backdrop-blur overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06] text-[10px] mono tracking-wider uppercase text-stone-400">
          <div className="flex items-center gap-2">
            <span className={"inline-block w-1.5 h-1.5 rounded-full bg-[#53fc18] " + (reduced ? "" : "pl-live")} />
            Six-model pipeline
          </div>
          <div className="flex items-center gap-3">
            <span className="text-stone-500">{String(done).padStart(2, '0')}/06 complete</span>
            <button type="button" onClick={replay} className="pl-replay text-stone-400 hover:text-[#53fc18] transition-colors">{'\u21bb'} replay</button>
          </div>
        </div>

        <div className="px-5 md:px-7 pt-7 pb-6">
          {/* spine / scrubber */}
          <div className="flex items-center justify-between text-[9px] mono uppercase tracking-widest text-stone-500 mb-2">
            <span>Source {'\u00b7'} 1h 04m</span>
            <span ref={pctRef}>0%</span>
          </div>
          <div
            ref={trackRef}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            className={"pl-track relative h-9 flex items-center select-none " + (dragging ? "is-grabbing" : "")}
            style={{ touchAction: 'none' }}
          >
            <div className="pl-rail absolute left-0 right-0 h-2 rounded-full bg-white/[0.07] overflow-hidden">
              <div className="pl-fill h-full" />
            </div>
            {NODES.map((nd, i) => {
              const tickOn = i < stage;
              return (
                <span key={i} className={"pl-tick absolute w-px h-3 " + (tickOn ? "pl-tick-on bg-[#53fc18]" : "bg-white/15")} style={{ left: ((i + 1) / N * 100) + '%' }} />
              );
            })}
            <span className="pl-head absolute top-0 bottom-0 left-0 w-full">
              <span className="pl-head-line" />
              <span className="pl-head-cap" />
            </span>
          </div>

          {/* nodes */}
          <div className="grid grid-cols-3 lg:grid-cols-6 gap-2.5 mt-6">
            {NODES.map((nd, i) => {
              const st = i < stage ? 'done' : (i === stage ? 'active' : 'idle');
              const lit = i <= stage;
              const cls = "pl-node relative overflow-hidden text-left rounded-xl border px-3 pt-3 pb-4 " +
                (st === 'idle' ? "border-white/[0.08] bg-white/[0.01] " : "border-[#53fc18]/40 bg-[#53fc18]/[0.05] ") +
                (st === 'done' ? "is-done " : "") +
                (st === 'active' ? "is-active " : "") +
                (focus === i ? "is-focus " : "");
              return (
                <button key={i} type="button" onClick={() => onNode(i)} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} className={cls}>
                  <span className="pl-cnr pl-cnr-tl" aria-hidden="true" />
                  <span className="pl-cnr pl-cnr-br" aria-hidden="true" />
                  <div className="flex items-center justify-between mb-2">
                    <span className={"pl-glyph " + (st === 'idle' ? "text-stone-500" : "text-[#53fc18]")}>{PL_GLYPHS[nd.g]}</span>
                    <span className={"w-1.5 h-1.5 rounded-full " + (st === 'done' ? "bg-[#53fc18]" : st === 'active' ? "bg-[#53fc18] pl-dot" : "bg-stone-600")} />
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className={"mono text-[10px] " + (st === 'idle' ? "text-stone-500" : "text-[#53fc18]")}>{nd.n}</span>
                    <span className={"text-xs font-medium tracking-wide " + (st === 'idle' ? "text-stone-400" : "text-stone-100")}>{nd.label}</span>
                  </div>
                  <div className={"pl-val mono mt-2 leading-none " + (lit ? "text-[#53fc18]" : "text-stone-600")}><span ref={(el) => { numRefs.current[i] = el; }} className="text-[14px] font-semibold tracking-tight">0</span><span className="pl-caret" aria-hidden="true" /><span className="text-[9px] text-stone-500"> {nd.unit}</span></div>
                  <span className="pl-bar absolute left-0 right-0 bottom-0 h-[3px] bg-white/[0.06]">
                    <span className="pl-bar-fill block h-full" style={{ '--i': i }} />
                  </span>
                </button>
              );
            })}
          </div>

          {/* detail */}
          <div className="pl-detail mt-5 rounded-xl border border-white/[0.07] bg-black/30 px-4 py-4 grid grid-cols-[auto_1fr] gap-4 items-start">
            <div className="mono text-3xl leading-none text-[#53fc18]">{f.n}</div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-stone-100">{f.label}</span>
                <span className={"text-[9px] mono uppercase tracking-widest px-1.5 py-[2px] rounded " + (fState === 'idle' ? "text-stone-500 border border-white/10" : "text-[#53fc18] border border-[#53fc18]/30 bg-[#53fc18]/[0.06]")}>{fState === 'done' ? 'complete' : fState === 'active' ? 'running' : 'queued'}</span>
              </div>
              <p className="text-xs text-stone-400 mt-1.5 leading-relaxed">{f.blurb}</p>
              <div className="mt-2 text-[11px] mono text-stone-300">{'>'} {f.out}</div>
            </div>
          </div>

          <div className={"text-center text-[10px] mono uppercase tracking-widest text-stone-600 mt-4 transition-opacity duration-500 " + (touched ? "opacity-0" : "opacity-100")}>
            drag to scrub {'\u00b7'} click a stage to inspect
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────── CONTENT ECONOMICS CALCULATOR
   The page is already heavy on *process* (hero pipeline, the 7-step "how it
   works", the interactive demo). This section deliberately changes the axis:
   instead of showing how the work happens, it lets the visitor reframe the
   service around *outcomes* — set how many recordings you publish a month and
   watch the output multiply, including the editing load we absorb on your
   behalf. Every constant is derived from the real DEMO_CLIPS batch; the two
   estimates (editing minutes per clip, posts = clips × platforms) are stated in
   plain sight. Nothing here is fabricated — the visitor's real numbers come from
   their own content, which the copy says explicitly. */
const CM_EDIT_MIN_PER_CLIP = 45; // transparent assumption, surfaced in the footnote

// Eases a displayed number from its current value to a new target whenever the
// target changes (e.g. as the slider moves), so figures glide instead of snapping.
// Collapses to an instant set under reduced-motion.
function useTween(target, ms = 480) {
  const [val, setVal] = useState(target);
  const valRef = useRef(target);
  valRef.current = val;
  const rafRef = useRef(0);
  useEffect(() => {
    if (prefersReducedMotion()) { setVal(target); return; }
    const from = valRef.current;
    const start = performance.now();
    const ease = (t) => 1 - Math.pow(1 - t, 3);
    const tick = (now) => {
      const t = Math.min(1, (now - start) / ms);
      setVal(from + (target - from) * ease(t));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, ms]);
  return val;
}

function ContentMath({ bookCall }) {
  const [recs, setRecs] = useState(4);

  // Honest per-recording constants pulled straight from the seeded batch.
  const clipsPerRec = DEMO_CLIPS.length;
  const avgPlatforms = DEMO_CLIPS.reduce((a, c) => a + c.platforms.length, 0) / DEMO_CLIPS.length;
  const avgDurSec = DEMO_CLIPS.reduce((a, c) => a + c.duration, 0) / DEMO_CLIPS.length;

  const clips = recs * clipsPerRec;
  const posts = Math.round(clips * avgPlatforms);
  const minutes = Math.round((clips * avgDurSec) / 60);
  const hours = Math.round((clips * CM_EDIT_MIN_PER_CLIP) / 60);
  const perDay = (posts / 30).toFixed(1);

  // Tweened display values — glide between targets as the slider moves.
  const dPosts = Math.round(useTween(posts));
  const dClips = Math.round(useTween(clips));
  const dMinutes = Math.round(useTween(minutes));
  const dHours = Math.round(useTween(hours));

  const min = 1, max = 12;
  const fillPct = ((recs - min) / (max - min)) * 100;

  const tiles = [
    { v: dClips.toLocaleString(), l: 'ship-ready clips' },
    { v: dMinutes.toLocaleString(), l: 'minutes of short-form' },
    { v: dHours.toLocaleString(), l: 'editor-hours we absorb' },
  ];

  return (
    <section className="relative z-10 max-w-[1400px] mx-auto px-6 md:px-8 py-16 border-t border-white/[0.12]">
      <Reveal>
        <div className="max-w-2xl mb-12">
          <div className="text-[10px] mono text-[#53fc18] mb-4 tracking-[0.2em] uppercase flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#53fc18]" style={{ boxShadow: '0 0 8px #53fc18' }} /> Run the numbers
          </div>
          <h2 className="serif text-4xl md:text-6xl leading-[1.02] tracking-tight mb-5">
            One month of recording,<br /><span className="italic gradient-green">multiplied.</span>
          </h2>
          <p className="text-stone-400 leading-relaxed text-lg">
            You don&apos;t buy clips one at a time, you buy a steady output. Drag to set how often you already hit record, and see what we turn it into, plus the editing we take off your plate.
          </p>
        </div>
      </Reveal>

      <Reveal delay={120}>
        <div className="relative rounded-2xl border border-[#53fc18]/[0.14] bg-gradient-to-b from-[#53fc18]/[0.02] to-transparent p-6 md:p-10 overflow-hidden">
          <span aria-hidden className="absolute inset-x-0 top-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(83,252,24,0.6), transparent)' }} />

          <div className="grid lg:grid-cols-[0.85fr_1.15fr] gap-8 lg:gap-12 items-center">
            {/* Control + hero output */}
            <div>
              <label htmlFor="cm-recs" className="block text-[10px] mono text-stone-500 tracking-wider uppercase mb-3">
                Recordings you publish per month
              </label>
              <div className="flex items-end gap-3 mb-5">
                <span className="serif text-6xl text-stone-100 tabular-nums leading-none">{recs}</span>
                <span className="text-sm text-stone-500 mb-1.5">{recs === 1 ? 'recording' : 'recordings'} / mo</span>
              </div>
              <input
                id="cm-recs" type="range" min={min} max={max} step={1} value={recs}
                onChange={(e) => setRecs(Number(e.target.value))}
                className="cm-range" style={{ '--fill': `${fillPct}%` }}
                aria-valuetext={`${recs} recordings per month`}
              />
              <div className="flex justify-between text-[10px] mono text-stone-600 mt-2">
                <span>{min}</span><span>weekly</span><span>{max}+</span>
              </div>

              <div className="cm-hero-glow mt-8 p-5 rounded-xl border border-[#53fc18]/30 bg-[#53fc18]/[0.04]">
                <div className="text-[10px] mono text-[#53fc18] tracking-wider uppercase mb-1.5">Platform-native posts / month</div>
                <div className="flex items-baseline gap-3">
                  <span className="cm-val serif text-6xl md:text-7xl text-[#53fc18] tabular-nums leading-none">{dPosts.toLocaleString()}</span>
                </div>
                <div className="text-xs text-stone-400 mt-3">
                  {clips} clips, each cut for ~{avgPlatforms.toFixed(0)} platforms. That's <span className="text-stone-200">{perDay} posts a day</span>, every day.
                </div>
              </div>
            </div>

            {/* Secondary outputs */}
            <div>
              <div className="grid sm:grid-cols-3 gap-px rounded-xl overflow-hidden border border-stone-800 bg-stone-800 mb-6">
                {tiles.map((t) => (
                  <div key={t.l} className="cm-tile card-lift bg-stone-950/80 p-5">
                    <div className="cm-val serif text-4xl text-stone-100 tabular-nums leading-none">{t.v}</div>
                    <div className="text-[10px] mono text-stone-500 tracking-wider uppercase mt-2 leading-tight">{t.l}</div>
                  </div>
                ))}
              </div>

              <div className="rounded-xl border border-stone-800 bg-stone-900/30 p-5">
                <div className="flex items-start gap-3">
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-[#53fc18]/25 bg-[#53fc18]/[0.06] shrink-0">
                    <Clock className="w-4 h-4 text-[#53fc18]" />
                  </span>
                  <div>
                    <div className="text-sm text-stone-200 leading-snug">
                      That&apos;s roughly <span className="text-[#53fc18] font-medium">{dHours} hours</span> of editing a month you never have to do, scope, or hire for.
                    </div>
                    <div className="text-[11px] text-stone-500 mt-1.5">A human still signs off on every cut before it ships.</div>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-4">
                <button onClick={bookCall} className="btn-neon group px-7 py-4 rounded-md font-medium inline-flex items-center gap-2">
                  Book a demo
                  <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </button>
                <span className="text-xs mono text-stone-500">We scope the real plan on the call.</span>
              </div>
            </div>
          </div>

          <p className="text-[10px] mono text-stone-600 leading-relaxed mt-8 pt-6 border-t border-white/[0.06] max-w-3xl">
            Estimate from our last batch: {clipsPerRec} ship-ready clips per recording, formatted for ~{avgPlatforms.toFixed(0)} platforms each, ~{Math.round(avgDurSec)}s apiece, with editing estimated at {CM_EDIT_MIN_PER_CLIP} min per finished clip. Your real numbers come from your own content.
          </p>
        </div>
      </Reveal>
    </section>
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

/* ──────────────────────────────────────────────────────────── VIRALITY CHART
   Animated bar chart — neon green bars with live data feel */
function ViralityChart() {
  /* Animated SVG scoring console, in the same drawn language as the hero figure.
     Bars grow in staggered when scrolled into view; the 90-point "ready to post"
     threshold draws itself across the chart; peak bars carry score flags; and a
     continuous scan line sweeps the distribution, brightening each bar as it
     passes (each bar's brightness wave is phase-offset to match the sweep, so
     the whole thing stays in sync forever with zero JS per frame).
     Reduced motion: the global guard zeroes the grow-in transitions so bars
     appear fully drawn, and the sweep layer is hidden via media query. */
  const ref = useReveal();
  const N = 36;
  const SWEEP = '8s';
  // Chart geometry (SVG user units)
  const L = 24, R = 1176, TOP = 26, BASE = 252, MAXH = BASE - TOP - 14;
  const W = R - L;
  const slot = W / N;
  const barW = slot - 6;
  // Deterministic pseudo-random distribution, three 90+ peaks
  const bars = Array.from({ length: N }, (_, i) => {
    const peak = i === 9 || i === 19 || i === 29;
    const v = peak
      ? ({ 9: 92, 19: 96, 29: 91 })[i]
      : Math.round(24 + Math.abs(Math.sin(i * 0.53 + 1.2)) * 34 + Math.abs(Math.cos(i * 0.31)) * 18);
    return { v, peak };
  });
  const yFor = (v) => BASE - (v / 100) * MAXH;
  const thresholdY = yFor(90);
  const mono = { fontFamily: "'JetBrains Mono', Menlo, monospace", textTransform: 'uppercase' };

  return (
    <div ref={ref} className="vchart relative rounded-xl border border-[#53fc18]/20 bg-gradient-to-b from-[#53fc18]/[0.04] to-transparent p-5 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between text-[10px] mono text-stone-500 tracking-wider uppercase mb-2">
        <span className="flex items-center gap-1.5">
          <span className="w-1 h-1 rounded-full bg-[#53fc18] animate-pulse-soft" />
          Virality distribution · 24h
        </span>
        <span className="text-[#53fc18]">peak 96</span>
      </div>
      <style>{`
        .vchart .vc-bar {
          transform: scaleY(0);
          transform-box: fill-box;
          transform-origin: bottom;
          transition: transform 0.7s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .vchart.in .vc-bar { transform: scaleY(1); }
        .vchart .vc-draw {
          stroke-dasharray: 1; stroke-dashoffset: 1;
          transition: stroke-dashoffset 1.4s cubic-bezier(0.16, 1, 0.3, 1) 0.9s;
        }
        .vchart.in .vc-draw { stroke-dashoffset: 0; }
        .vchart .vc-meta { opacity: 0; transition: opacity 0.5s ease 1.1s; }
        .vchart.in .vc-meta { opacity: 1; }
        .vchart .vc-flag { opacity: 0; transform: translateY(5px); transform-box: fill-box;
          transition: opacity 0.45s ease, transform 0.45s cubic-bezier(0.16,1,0.3,1); }
        .vchart.in .vc-flag { opacity: 1; transform: translateY(0); }
        @keyframes vcSweep { from { transform: translateX(0); } to { transform: translateX(${W}px); } }
        .vchart .vc-sweep { animation: vcSweep ${SWEEP} linear infinite; }
        @keyframes vcWave { 0%, 7%, 100% { opacity: 0.75; } 2.5% { opacity: 1; } }
        .vchart .vc-bar { animation: vcWave ${SWEEP} linear infinite; }
        @keyframes vcPeakWave {
          0%, 7%, 100% { filter: drop-shadow(0 0 0 rgba(83,252,24,0)); opacity: 0.9; }
          2.5% { filter: drop-shadow(0 0 7px rgba(83,252,24,0.7)); opacity: 1; }
        }
        .vchart .vc-bar.vc-peak { animation-name: vcPeakWave; }
        @media (prefers-reduced-motion: reduce) {
          .vchart .vc-sweep { display: none; }
          .vchart .vc-bar { animation: none; opacity: 0.9; }
        }
      `}</style>
      <svg viewBox="0 0 1200 286" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-auto" aria-hidden>
        <defs>
          <linearGradient id="vcBar" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor="#53fc18" stopOpacity="0.16" />
            <stop offset="1" stopColor="#53fc18" stopOpacity="0.55" />
          </linearGradient>
          <linearGradient id="vcBarPeak" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor="#53fc18" stopOpacity="0.55" />
            <stop offset="1" stopColor="#b8ff7d" stopOpacity="1" />
          </linearGradient>
          <linearGradient id="vcScan" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#53fc18" stopOpacity="0" />
            <stop offset="1" stopColor="#53fc18" stopOpacity="0.10" />
          </linearGradient>
        </defs>

        {/* faint gridlines with axis labels */}
        <g className="vc-meta">
          {[25, 50, 75].map((g) => (
            <g key={g}>
              <path d={`M${L} ${yFor(g)} H${R}`} stroke="#53fc18" strokeOpacity="0.10" strokeWidth="1" strokeDasharray="3 5" />
              <text x={L - 8} y={yFor(g) + 3} textAnchor="end" fill="#57534e" fontSize="9" letterSpacing="1" style={mono}>{g}</text>
            </g>
          ))}
          <path d={`M${L} ${BASE} H${R}`} stroke="#44403c" strokeWidth="1" />
          <text x={L} y={BASE + 22} fill="#57534e" fontSize="10" letterSpacing="2" style={mono}>Clips scored, last 24h</text>
          <text x={R} y={BASE + 22} textAnchor="end" fill="#57534e" fontSize="10" letterSpacing="2" style={mono}>Illustrative</text>
        </g>

        {/* the bars */}
        {bars.map((b, i) => (
          <rect
            key={i}
            className={`vc-bar ${b.peak ? 'vc-peak' : ''}`}
            x={L + i * slot + 3}
            y={yFor(b.v)}
            width={barW}
            height={BASE - yFor(b.v)}
            rx="3"
            fill={b.peak ? 'url(#vcBarPeak)' : 'url(#vcBar)'}
            style={{ transitionDelay: `${i * 28}ms`, animationDelay: `calc(${(i / N).toFixed(4)} * ${SWEEP})` }}
          >
            <title>{`Score ${b.v}`}</title>
          </rect>
        ))}

        {/* score flags on the peaks */}
        {bars.map((b, i) => b.peak ? (
          <text
            key={i}
            className="vc-flag"
            x={L + i * slot + 3 + barW / 2}
            y={yFor(b.v) - 9}
            textAnchor="middle"
            fill="#b8ff7d"
            fontSize="11"
            letterSpacing="1"
            style={{ ...mono, transitionDelay: `${1.2 + i * 0.02}s` }}
          >
            {b.v}
          </text>
        ) : null)}

        {/* the 90-point threshold draws itself across */}
        <path className="vc-draw" pathLength="1" d={`M${L} ${thresholdY} H${R}`}
          stroke="#53fc18" strokeOpacity="0.5" strokeWidth="1" />
        <g className="vc-meta">
          <text x={R} y={thresholdY - 7} textAnchor="end" fill="#53fc18" fillOpacity="0.8" fontSize="10" letterSpacing="1.6" style={mono}>
            90 · ready to post
          </text>
        </g>

        {/* the scan: a sweeping line with a trailing wash, phase-locked to the bar wave */}
        <g className="vc-sweep vc-meta">
          <rect x={L - 56} y={TOP} width="56" height={BASE - TOP} fill="url(#vcScan)" />
          <path d={`M${L} ${TOP} V${BASE}`} stroke="#aaff66" strokeOpacity="0.55" strokeWidth="1" />
        </g>
      </svg>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────── SIGNATURE PATH
   The site's one signature figure, now interactive: a single audio-waveform stroke
   (the long-form recording, with its timecode ruler) runs left to right, passes
   through the analysis node, and fans out into six 9:16 clip frames ranked by
   virality score. It draws itself on first scroll into view, then runs a quiet
   synchronized loop — a spark travels the recording, pings the node, splits into
   six staggered sparks down the branches, and lights each frame as it lands.
   Hover, focus, or tap a clip frame to trace it back: its branch lights up, the
   slice of the recording it was cut from is marked on the waveform, and a console
   readout prints the hook type, timestamps, and score. Keyboard accessible (each
   frame is focusable with a full text label); the ambient loop is never mounted
   under prefers-reduced-motion, and the draw-in transitions are zeroed by the
   global guard, so the figure simply appears fully drawn. */
function SignaturePath() {
  const wrapRef = useRef(null);
  const [inView, setInView] = useState(false);
  const [motionOK, setMotionOK] = useState(false);
  const [hov, setHov] = useState(null);
  useEffect(() => {
    if (!prefersReducedMotion()) setMotionOK(true);
    const el = wrapRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) { setInView(true); obs.disconnect(); } }),
      { threshold: 0.2, rootMargin: '0px 0px -10% 0px' }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Six clips, ranked by score. `src` is the slice of the waveform each was cut
  // from (x-range on the timeline) with matching timestamps for the readout.
  const branches = [
    { x: 660,  y: 20,  score: 94, hook: 'Hook',  src: [188, 200], t: ['00:38:12', '00:38:51'] },
    { x: 770,  y: 50,  score: 88, hook: 'Turn',  src: [96, 108],  t: ['00:16:44', '00:17:21'] },
    { x: 880,  y: 80,  score: 81, hook: 'Quote', src: [312, 324], t: ['01:09:30', '01:10:02'] },
    { x: 990,  y: 110, score: 76, hook: 'List',  src: [408, 420], t: ['01:33:05', '01:33:41'] },
    { x: 1100, y: 140, score: 71, hook: 'Punch', src: [130, 142], t: ['00:26:10', '00:26:48'] },
    { x: 1180, y: 160, score: 65, hook: 'CTA',   src: [345, 357], t: ['01:18:22', '01:18:55'] },
  ];
  const branchD = (b) =>
    `M478 104 C ${478 + (b.x - 478) * 0.4} 104, ${b.x - 70} ${b.y + 31}, ${b.x - 16} ${b.y + 31}`;
  // One shared 7s cycle keeps every spark, ping, and flash in phase.
  const CYC = '7s';
  const f3 = (n) => n.toFixed(3);
  const mono = { fontFamily: "'JetBrains Mono', Menlo, monospace", textTransform: 'uppercase' };
  const readout = hov == null
    ? null
    : `Clip 0${hov + 1} · ${branches[hov].hook} · ${branches[hov].t[0]} → ${branches[hov].t[1]} · Score ${branches[hov].score}`;
  const frameLabel = (b, i) =>
    `Clip ${i + 1}: ${b.hook}, cut at ${b.t[0]} to ${b.t[1]}, virality score ${b.score}`;

  return (
    <div ref={wrapRef} className={`sigpath mt-14 mb-2 hidden md:block ${inView ? 'in' : ''}`}>
      <style>{`
        .sigpath { opacity: 0; transition: opacity 0.8s ease; }
        .sigpath.in { opacity: 1; }
        .sigpath .sig-draw {
          stroke-dasharray: 1; stroke-dashoffset: 1;
          transition: stroke-dashoffset 1.6s cubic-bezier(0.16, 1, 0.3, 1),
                      stroke-opacity 0.25s ease, stroke-width 0.25s ease;
        }
        .sigpath .sig-branch { transition-duration: 1.1s, 0.25s, 0.25s; }
        .sigpath.in .sig-draw { stroke-dashoffset: 0; }
        .sigpath .sig-frame, .sigpath .sig-meta { opacity: 0; transition: opacity 0.5s ease; }
        .sigpath.in .sig-frame, .sigpath.in .sig-meta { opacity: 1; }
        .sigpath.in .sig-branch { transition-delay: 0.9s, 0s, 0s; }
        .sigpath.in .sig-frame { transition-delay: 1.5s; }
        .sigpath.in .sig-meta { transition-delay: 0.6s; }
        .sigpath .sig-chip { opacity: 0; transform: translateY(4px); transition: opacity 0.45s ease, transform 0.45s cubic-bezier(0.16,1,0.3,1), fill-opacity 0.25s ease; }
        .sigpath.in .sig-chip { opacity: 1; transform: translateY(0); }
        .sigpath .sig-hit { cursor: pointer; outline: none; }
        .sigpath .sig-rect { transition: stroke-opacity 0.25s ease, fill-opacity 0.25s ease; }
        .sigpath .sig-band { transition: opacity 0.3s ease; }
        .sigpath .sig-loop { transition: opacity 0.35s ease; }
        .sigpath .sig-readout { transition: opacity 0.25s ease; }
      `}</style>
      <svg
        viewBox="0 0 1240 232"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-auto overflow-visible"
        role="group"
        aria-label="How it works: one long recording goes in, six short clips ranked by virality score come out. Focus a clip to see where it was cut."
        onMouseLeave={() => setHov(null)}
      >
        <defs>
          <linearGradient id="sigStroke" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#53fc18" stopOpacity="0.45" />
            <stop offset="0.8" stopColor="#53fc18" />
            <stop offset="1" stopColor="#b8ff7d" />
          </linearGradient>
          <filter id="sigGlow" x="-300%" y="-300%" width="700%" height="700%">
            <feGaussianBlur stdDeviation="2.6" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* the long-form: one continuous waveform stroke */}
        <path
          id="sigMain"
          className="sig-draw"
          pathLength="1"
          d="M10 104 H80
             l9 -34 l10 68 l9 -50 l10 30 l9 -14
             H170
             l9 -50 l10 82 l9 -60 l10 36 l9 -8
             H300
             l9 -26 l10 46 l9 -36 l10 16
             H400
             l9 -14 l10 24 l9 -10
             H462"
          stroke="url(#sigStroke)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"
        />

        {/* source slice marker — appears when a clip is hovered/focused */}
        {branches.map((b, i) => (
          <g key={i} className="sig-band" opacity={hov === i ? 1 : 0} pointerEvents="none">
            <rect x={b.src[0]} y={46} width={b.src[1] - b.src[0]} height={98} fill="rgba(83,252,24,0.07)" />
            <path d={`M${b.src[0]} 48 V144 M${b.src[1]} 48 V144`}
              stroke="#53fc18" strokeOpacity="0.55" strokeWidth="1" strokeDasharray="3 3" />
            <text x={(b.src[0] + b.src[1]) / 2} y={40} textAnchor="middle"
              fill="#53fc18" fillOpacity="0.8" fontSize="10" letterSpacing="1" style={mono}>
              {b.t[0]}
            </text>
          </g>
        ))}

        {/* timecode ruler under the recording */}
        <g className="sig-meta">
          <path d="M10 144 H462" stroke="#44403c" strokeWidth="1" />
          {Array.from({ length: 9 }, (_, i) => 10 + i * 56.5).map((x) => (
            <path key={x} d={`M${x} 144 v5`} stroke="#57534e" strokeWidth="1" />
          ))}
          <text x="10" y="166" fill="#78716c" fontSize="10" letterSpacing="1.6" style={mono}>00:00:00</text>
          <text x="462" y="166" textAnchor="end" fill="#78716c" fontSize="10" letterSpacing="1.6" style={mono}>01:47:55</text>
          <text x="10" y="192" fill="#57534e" fontSize="10" letterSpacing="2.2" style={mono}>One recording</text>
          <text x="1230" y="14" textAnchor="end" fill="#57534e" fontSize="10" letterSpacing="2.2" style={mono}>A week of clips · ranked by score</text>
        </g>

        {/* console readout — prints the hovered clip's provenance */}
        <g className="sig-readout sig-meta" opacity={inView ? 1 : 0}>
          <text x="520" y="206" fontSize="10" letterSpacing="1.4" style={mono}
            fill={hov == null ? '#57534e' : '#53fc18'} fillOpacity={hov == null ? 1 : 0.9}>
            {hov == null ? '→ Hover a clip to trace it back to the recording' : `→ ${readout}`}
          </text>
        </g>

        {/* the node where moments are found */}
        <circle className="sig-frame" cx="470" cy="104" r="5" fill="none" stroke="#53fc18" strokeWidth="1.5" />
        <circle className="sig-frame" cx="470" cy="104" r="1.8" fill="#53fc18" />

        {/* branches: one curve per clip */}
        {branches.map((b, i) => (
          <path
            key={i}
            className="sig-draw sig-branch"
            pathLength="1"
            id={`sigBr${i}`}
            d={branchD(b)}
            stroke="#53fc18"
            strokeOpacity={hov === i ? 0.95 : (hov == null ? 0.45 - i * 0.04 : 0.14)}
            strokeWidth={hov === i ? 1.75 : 1.25}
            strokeLinecap="round"
          />
        ))}

        {/* the clips: six 9:16 frames with caption ticks, score chips, hit areas */}
        {branches.map((b, i) => {
          const lit = hov === i;
          const dim = hov != null && !lit;
          return (
            <g
              key={i}
              className="sig-hit"
              tabIndex={inView ? 0 : -1}
              role="img"
              aria-label={frameLabel(b, i)}
              onMouseEnter={() => setHov(i)}
              onFocus={() => setHov(i)}
              onBlur={() => setHov(null)}
              onClick={() => setHov(i)}
            >
              {/* generous invisible hit area */}
              <rect x={b.x - 20} y={b.y - 8} width="40" height="74" fill="transparent" pointerEvents="all" />
              <g className="sig-frame">
                <rect className="sig-rect" x={b.x - 13} y={b.y + 8} width="26" height="46" rx="5"
                  stroke="#53fc18"
                  strokeOpacity={lit ? 1 : (dim ? 0.3 : 0.85 - i * 0.1)}
                  strokeWidth={lit ? 1.75 : 1.25}
                  fill="#53fc18"
                  fillOpacity={lit ? 0.14 : 0.04} />
                <path d={`M${b.x - 6} ${b.y + 42} h12 M${b.x - 5} ${b.y + 47} h10`}
                  stroke="#53fc18" strokeOpacity={lit ? 0.9 : (dim ? 0.2 : 0.5 - i * 0.05)} strokeWidth="1" strokeLinecap="round" />
              </g>
              <text className="sig-chip" x={b.x} y={b.y} textAnchor="middle"
                fill="#53fc18" fillOpacity={lit ? 1 : (dim ? 0.3 : 1 - i * 0.11)} fontSize="11" letterSpacing="1"
                style={{ ...mono, transitionDelay: inView ? `${1.7 + i * 0.1}s, ${1.7 + i * 0.1}s, 0s` : '0s' }}>
                {b.score}
              </text>
              {/* hook label appears under the lit frame */}
              <text x={b.x} y={b.y + 68} textAnchor="middle" pointerEvents="none"
                fill="#53fc18" fontSize="10" letterSpacing="1.6" style={mono}
                opacity={lit ? 0.8 : 0} className="sig-band">
                {b.hook}
              </text>
            </g>
          );
        })}

        {/* ── the loop: spark → node ping → branch sparks → frame flashes ──
            All animations share one cycle on the document timeline, so they stay
            in phase no matter when this layer mounts. Dimmed while a clip is
            being inspected; never rendered under prefers-reduced-motion. */}
        {inView && motionOK && (
          <g className="sig-loop" opacity={hov == null ? 1 : 0.2} pointerEvents="none">
            {branches.map((b, i) => {
              const t1 = 0.48 + i * 0.022;
              return (
                <rect key={i} x={b.x - 12} y={b.y + 9} width="24" height="44" rx="4"
                  fill="#53fc18" opacity="0">
                  <animate attributeName="opacity" dur={CYC} repeatCount="indefinite"
                    values="0;0;0.22;0;0"
                    keyTimes={`0;${f3(t1)};${f3(t1 + 0.015)};${f3(t1 + 0.1)};1`} />
                </rect>
              );
            })}
            <circle cx="470" cy="104" fill="none" stroke="#53fc18" strokeWidth="1" r="5" opacity="0">
              <animate attributeName="r" dur={CYC} repeatCount="indefinite"
                values="5;5;5;16;16" keyTimes="0;0.26;0.261;0.4;1" />
              <animate attributeName="opacity" dur={CYC} repeatCount="indefinite"
                values="0;0;0.7;0;0" keyTimes="0;0.26;0.275;0.4;1" />
            </circle>
            <g filter="url(#sigGlow)">
              <circle r="2.8" fill="#d9ffba" opacity="0">
                <animateMotion dur={CYC} repeatCount="indefinite" calcMode="linear"
                  keyPoints="0;1;1" keyTimes="0;0.26;1">
                  <mpath href="#sigMain" />
                </animateMotion>
                <animate attributeName="opacity" dur={CYC} repeatCount="indefinite"
                  values="0;1;1;0;0" keyTimes="0;0.02;0.24;0.265;1" />
              </circle>
              {branches.map((b, i) => {
                const t0 = 0.27 + i * 0.022;
                const t1 = 0.48 + i * 0.022;
                return (
                  <circle key={i} r="2.1" fill="#aaff66" opacity="0">
                    <animateMotion dur={CYC} repeatCount="indefinite" calcMode="linear"
                      keyPoints="0;0;1;1" keyTimes={`0;${f3(t0)};${f3(t1)};1`}>
                      <mpath href={`#sigBr${i}`} />
                    </animateMotion>
                    <animate attributeName="opacity" dur={CYC} repeatCount="indefinite"
                      values="0;0;0.9;0.9;0;0"
                      keyTimes={`0;${f3(t0)};${f3(t0 + 0.012)};${f3(t1 - 0.012)};${f3(t1)};1`} />
                  </circle>
                );
              })}
            </g>
          </g>
        )}
      </svg>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────── MANIFESTO
   One giant statement that lights up word by word as it scrolls through the
   viewport — the Linear/Arc "thesis" moment. Scroll-linked via a passive,
   rAF-throttled handler; reduced motion renders it fully lit. */
function Manifesto() {
  // [text, accent?] — accents glow green when lit.
  const WORDS = [
    ['Every'], ['hour'], ['you'], ['record'], ['hides'], ['a'], ['week'], ['of'],
    ['short-form.', true], ['We'], ['find'], ['it,'], ['cut'], ['it,'], ['score'], ['it,'],
    ['and'], ['ship'], ['it', true], ['while'], ['you'], ['make'], ['the'], ['next'], ['one.'],
  ];
  const ref = useRef(null);
  const [lit, setLit] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setLit(WORDS.length);
      return;
    }
    let raf = 0;
    const measure = () => {
      raf = 0;
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight || 800;
      // Progress 0→1 as the block travels from 88% viewport height up to 38%.
      const p = Math.max(0, Math.min(1, (vh * 0.88 - r.top) / (vh * 0.5)));
      setLit(Math.round(p * WORDS.length));
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(measure); };
    measure();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      cancelAnimationFrame(raf);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section className="relative z-10 max-w-[1400px] mx-auto px-6 md:px-8 py-20 md:py-28 border-t border-white/[0.12]">
      <div className="text-[10px] mono text-[#53fc18] mb-8 tracking-[0.2em] uppercase flex items-center justify-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-[#53fc18]" /> The thesis
      </div>
      <p ref={ref} className="serif text-4xl sm:text-5xl md:text-6xl lg:text-7xl leading-[1.12] tracking-tight max-w-5xl mx-auto text-center">
        {WORDS.map(([w, accent], i) => (
          <span key={i} className={`mf-word ${i < lit ? 'lit' : ''} ${accent ? 'mf-accent' : ''}`}>
            {w}{' '}
          </span>
        ))}
      </p>
    </section>
  );
}

/* ─────────────────────────────────────────────────── BENTO · DELIVERABLES
   The Apple/Vercel-style bento grid: six tiles, each a literal piece of what
   lands in a client's queue, each with its own live micro-visual. Tiles reuse
   the real ClipFrame and real DEMO clip data — nothing invented. All tiles
   tilt + spotlight via the shared engines. */
function BentoDeliverables({ bookCall }) {
  const clip = DEMO_CLIPS[0];
  const hooks = Array.isArray(clip.hooks) && clip.hooks.length >= 3
    ? clip.hooks.slice(0, 3)
    : ['The moment everything changed', 'Nobody expected this answer', 'Watch the room go quiet'];
  const tile = 'tilt-card card-lift relative rounded-2xl border border-[#53fc18]/[0.10] bg-gradient-to-b from-[#53fc18]/[0.02] to-transparent overflow-hidden p-6';
  return (
    <section className="relative z-10 max-w-[1400px] mx-auto px-6 md:px-8 py-12 border-t border-white/[0.12]">
      <Reveal>
        <div className="mb-10">
          <div className="text-[10px] mono text-[#53fc18] mb-4 tracking-[0.2em] uppercase flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#53fc18]" /> The deliverable
          </div>
          <h2 className="serif text-4xl md:text-5xl leading-[1.05] mb-4">
            What lands in <span className="italic gradient-green">your queue.</span>
          </h2>
          <p className="text-stone-400 leading-relaxed max-w-xl">
            Finished, scored, human-checked verticals with hooks and captions written, on a weekly rhythm you never have to think about.
          </p>
        </div>
      </Reveal>

      <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
        {/* 1 · The clip itself — the real ClipFrame the studio ships */}
        <Reveal className="md:col-span-3 bento-tall">
          <div className={`${tile} h-full flex flex-col`}>
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm font-medium">Publish-ready verticals</div>
              <span className="text-[10px] mono text-stone-500 tracking-wider uppercase">9:16 · sample</span>
            </div>
            <div className="flex-1 flex items-center justify-center py-2">
              <div className="bento-frame rounded-xl border border-stone-800 overflow-hidden shadow-[0_0_50px_-18px_rgba(83,252,24,0.35)]">
                <ClipFrame clip={clip} rank={1} />
              </div>
            </div>
            <div className="text-xs text-stone-500 leading-relaxed mt-4">
              Reframed around the speaker, captioned, and formatted per platform. It's the same frame the studio renders.
            </div>
          </div>
        </Reveal>

        {/* 2 · Hooks */}
        <Reveal className="md:col-span-3" delay={60}>
          <div className={tile}>
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm font-medium">Hooks written for the scroll</div>
              <Zap className="w-4 h-4 text-[#53fc18]" />
            </div>
            <div className="relative h-16">
              {hooks.map((h, i) => (
                <div
                  key={i}
                  className="hook-line absolute inset-x-0 top-0 serif text-xl md:text-2xl leading-snug text-stone-200"
                  style={{ animationDelay: `${i * 2.8}s` }}
                >
                  “{h}”
                </div>
              ))}
            </div>
            <div className="text-xs text-stone-500 mt-2">Three first-line variants per clip, ready to A/B.</div>
          </div>
        </Reveal>

        {/* 3 · Human sign-off */}
        <Reveal className="md:col-span-3" delay={120}>
          <div className={tile}>
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm font-medium">A human signs off on every cut</div>
              <span className="stamp-pulse inline-flex items-center justify-center w-7 h-7 rounded-full border border-[#53fc18]/40 bg-[#53fc18]/[0.08]">
                <Check className="w-3.5 h-3.5 text-[#53fc18]" />
              </span>
            </div>
            <p className="text-xs text-stone-500 leading-relaxed">
              AI proposes, an editor approves. Nothing ships on model confidence alone, and every clip you receive carries an editor's name.
            </p>
            <div className="mt-4 inline-flex items-center gap-2 px-2.5 py-1 rounded-md border border-[#53fc18]/25 bg-[#53fc18]/[0.06] text-[10px] mono text-[#aaff66] tracking-wider uppercase">
              <CheckCircle2 className="w-3 h-3" /> Editor reviewed
            </div>
          </div>
        </Reveal>

        {/* 4 · Score */}
        <Reveal className="md:col-span-2" delay={180}>
          <div className={tile}>
            <div className="text-sm font-medium mb-3">Scored 0–100</div>
            <div className="flex items-end gap-3">
              <div className="serif text-5xl text-[#53fc18] leading-none" style={{ textShadow: '0 0 24px rgba(83,252,24,0.4)' }}>{clip.virality}</div>
              <div className="text-[10px] mono text-stone-500 tracking-wider uppercase pb-1">This clip's<br />virality score</div>
            </div>
            <div className="mt-4 h-1 rounded-full bg-white/[0.06] overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${clip.virality}%`, background: '#53fc18', boxShadow: '0 0 10px rgba(83,252,24,0.7)' }} />
            </div>
          </div>
        </Reveal>

        {/* 5 · Cadence */}
        <Reveal className="md:col-span-2" delay={240}>
          <div className={tile}>
            <div className="text-sm font-medium mb-4">A weekly rhythm</div>
            <div className="grid gap-1.5 mb-3" style={{ gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }} aria-hidden="true">
              {Array.from({ length: 28 }).map((_, i) => {
                const on = i % 7 === 1 || i % 7 === 4; // Tue + Fri drops
                const today = i === 25;
                return (
                  <span
                    key={i}
                    className={`h-2 rounded-sm ${today ? 'cal-today' : ''}`}
                    style={{
                      background: on ? 'rgba(83,252,24,0.8)' : 'rgba(255,255,255,0.07)',
                      boxShadow: on ? '0 0 6px rgba(83,252,24,0.5)' : 'none',
                    }}
                  />
                );
              })}
            </div>
            <div className="text-xs text-stone-500">Drops land on schedule every week, even when you skip a recording.</div>
          </div>
        </Reveal>

        {/* 6 · Platforms */}
        <Reveal className="md:col-span-2" delay={300}>
          <div className={tile}>
            <div className="text-sm font-medium mb-4">Five platforms, one recording</div>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {['TikTok', 'Reels', 'Shorts', 'X', 'LinkedIn'].map((p) => (
                <span key={p} className="px-2 py-1 rounded-md border border-[#53fc18]/25 bg-[#53fc18]/[0.06] text-[10px] mono text-[#aaff66]">{p}</span>
              ))}
            </div>
            <button onClick={bookCall} className="text-xs text-[#53fc18] inline-flex items-center gap-1.5 hover:gap-2.5 transition-all">
              Set up your feed <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function Landing({ onStart, goto, bookCall }) {
  // Phase 2 — subtle scroll parallax on the hero visual (dependency-free).
  useEffect(() => {
    if (prefersReducedMotion()) return;
    const el = document.querySelector('.hero-parallax');
    if (!el) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      const prog = Math.min(1, Math.max(0, (vh - r.top) / (vh + r.height)));
      el.style.transform = `translateY(${(-12 * prog).toFixed(2)}%)`;
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);
  return (
    <>
      {/* Hero */}
      <section className="relative z-10 max-w-[1400px] mx-auto px-6 md:px-8 pt-12 md:pt-16 pb-24">
        <NeonGrid />
        {/* Slow-drifting light field behind the headline (Stripe-style, in brand),
            clipped in its own layer so the drift can never cause page overflow. */}
        <div aria-hidden="true" className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="aurora aurora-a" />
          <div className="aurora aurora-b" />
        </div>
        <div className="relative max-w-5xl">
          <div className="inline-flex items-center gap-2.5 px-3 py-1.5 rounded-full border border-[#53fc18]/[0.12] bg-[#53fc18]/[0.015] backdrop-blur text-[11px] mono text-stone-300 mb-6 animate-blur-in" style={{ animationDelay: '0.05s' }}>
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inset-0 rounded-full bg-[#53fc18] animate-ping opacity-60" />
              <span className="relative rounded-full h-1.5 w-1.5 bg-[#53fc18]" />
            </span>
            <span className="tracking-wider uppercase">Done-for-you content operations · AI-native</span>
          </div>

          <h1 className="serif leading-[0.96] tracking-tight mb-8" style={{ fontSize: 'clamp(2.75rem, 10.5vw, 9.5rem)' }}>
            <span className="hero-line" style={{ animation: 'lineRise 0.9s cubic-bezier(0.16,1,0.3,1) 0.18s both' }}>Long videos in.</span>
            <span className="hero-line" style={{ animation: 'lineRise 0.9s cubic-bezier(0.16,1,0.3,1) 0.34s both' }}>
              <span className="italic gradient-green">Viral clips</span> out.
            </span>
          </h1>

          <p className="text-lg md:text-xl text-stone-400 max-w-2xl leading-relaxed mb-10 animate-blur-in" style={{ animationDelay: '0.62s' }}>
            You record the long-form. Our AI cuts the strongest moments, a human signs off on every clip, and finished verticals land in your queue each week. You approve, we ship.
          </p>

          <div className="flex flex-wrap items-center gap-3 animate-blur-in" style={{ animationDelay: '0.76s' }}>
            <button onClick={bookCall} className="btn-neon cta-glow magnetic-glow group px-7 py-4 rounded-md font-medium flex items-center gap-2">
              Book a demo
              <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </button>
            <button onClick={() => goto('product')} className="btn-neon-outline magnetic-glow group px-7 py-4 rounded-md font-medium">
              See how it works
            </button>
            <div className="ml-3 text-xs mono text-stone-500 hidden md:block">
              Pay per clip we ship
            </div>
          </div>

          {/* Input → output: what goes in, where it comes out. Reinforces the
              core promise and bridges into the pipeline visual below. */}
          <div className="mt-10 flex flex-wrap items-center gap-x-2.5 gap-y-3 animate-blur-in" style={{ animationDelay: '0.86s' }}>
            <span className="text-[10px] mono tracking-[0.22em] uppercase text-stone-600 mr-1">In</span>
            {['Podcasts', 'Interviews', 'Livestreams', 'Webinars', 'YouTube'].map((s) => (
              <span key={s} className="px-2.5 py-1 rounded-md border border-white/[0.1] bg-white/[0.02] text-[11px] mono text-stone-400 whitespace-nowrap">
                {s}
              </span>
            ))}
            <ChevronRight className="w-4 h-4 text-[#53fc18] mx-1 flex-shrink-0" />
            <span className="text-[10px] mono tracking-[0.22em] uppercase text-[#53fc18]/60 mr-1">Out</span>
            {['TikTok', 'Reels', 'Shorts', 'X', 'LinkedIn'].map((s) => (
              <span key={s} className="px-2.5 py-1 rounded-md border border-[#53fc18]/25 bg-[#53fc18]/[0.06] text-[11px] mono text-[#aaff66] whitespace-nowrap">
                {s}
              </span>
            ))}
          </div>
        </div>

        {/* Signature figure: the business as one drawn line, bridging hero copy
            into the live pipeline visual below. */}
        <SignaturePath />

        {/* Hero Visual */}
        <div className="mt-10 md:mt-2 animate-blur-in" style={{ animationDelay: '1.0s' }}>
          <div className="hero-parallax tilt-wrap">
            <div className="tilt-3d"><PipelineExplorer /></div>
          </div>
        </div>
      </section>

      {/* Single "watch the pipeline" moment. The previous passive ProductDemoReel
          loop sat directly above this and replayed the same one-video→six-clips
          concept, which read as the demo running twice — removed in favour of the
          one interactive demo the visitor actually controls. */}
      <InteractiveDemo openApp={onStart} />

      <Manifesto />

      <ContentMath bookCall={bookCall} />

      {/* Live Virality Metrics */}
      <section className="relative z-10 max-w-[1400px] mx-auto px-6 md:px-8 py-12 border-t border-white/[0.12]">
        <Reveal>
          <div className="score-head mb-10">
            <div>
              <div className="text-[10px] mono text-[#53fc18] mb-4 tracking-[0.2em] uppercase flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[#53fc18]" /> How scoring works</div>
              <h2 className="serif text-4xl md:text-5xl leading-[1.05] mb-4">
                Every clip gets a <span className="italic gradient-green">virality score.</span>
              </h2>
              <p className="text-stone-400 leading-relaxed max-w-xl">
                Each clip is rated 0-100 on hook strength, self-containment, emotional intensity, and quotability, so the strongest moments rise to the top before an editor signs off. The distribution below is illustrative; your real scores come from your content.
              </p>
            </div>
            <div className="tilt-card card-lift rounded-2xl border border-[#53fc18]/[0.12] bg-gradient-to-b from-[#53fc18]/[0.03] to-transparent p-6 md:p-7 score-range-panel">
              <div className="serif text-5xl text-[#53fc18] leading-none" style={{ textShadow: '0 0 24px rgba(83,252,24,0.35)' }}>0-100</div>
              <div className="text-[10px] mono text-stone-500 tracking-wider uppercase mt-3">Virality score range</div>
              <div className="text-[10px] mono text-stone-500 tracking-wider uppercase mt-2">
                <span className="text-[#53fc18]">90+</span> = ready to post
              </div>
            </div>
          </div>
          <ViralityChart />
        </Reveal>
      </section>

      <BentoDeliverables bookCall={bookCall} />

      <WhyClipper bookCall={bookCall} />

      <TrustStrip />

      <div id="book-call"><Waitlist /></div>

      <FAQ />

      {/* Closing CTA — the last thing on the page carries the two actions */}
      <section className="relative z-10 max-w-[1400px] mx-auto px-6 md:px-8 pt-12 pb-16 border-t border-white/[0.12] mt-4">
        <Reveal>
          <div className="text-center max-w-3xl mx-auto">
            <div className="text-[10px] mono text-[#53fc18] mb-4 tracking-[0.2em] uppercase flex items-center justify-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[#53fc18]" /> Start this week</div>
            <h2 className="serif text-5xl md:text-6xl leading-[1.05] mb-4">
              Ship clips at the<br />
              <span className="italic gradient-green">speed of attention.</span>
            </h2>
            <p className="text-stone-400 leading-relaxed mb-8">
              One strategy call, and a content engine starts running behind your show, every week.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button onClick={bookCall} className="btn-neon cta-glow magnetic-glow group px-7 py-4 rounded-md font-medium inline-flex items-center gap-2">
                Book a demo
                <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </button>
              <button onClick={onStart} className="btn-neon-outline magnetic-glow px-7 py-4 rounded-md font-medium inline-flex items-center gap-2">
                Watch a sample run
              </button>
            </div>
          </div>
        </Reveal>
      </section>
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

/* ──────────────────────────────────────────────────────────── PRODUCT */
function ProductPage({ goto, openApp, bookCall }) {
  const features = [
    { icon: Mic, t: 'We ingest everything', d: 'Send us a podcast, interview, livestream, webinar, or YouTube link. We pull the file, transcribe it, and take it from there. You never touch a timeline.' },
    { icon: Workflow, t: 'Our AI finds the moments', d: 'We analyze every second for high-retention hooks, emotional peaks, teaching moments, and quotable lines, then score each candidate so the strongest clips rise to the top.' },
    { icon: Film, t: 'We cut and format for every platform', d: 'Vertical, square, and horizontal, all reframed, captioned, and styled to look native wherever your audience is watching.' },
    { icon: Sparkles, t: 'We write the hooks and titles', d: 'Multiple title, description, and thumbnail variants per clip, tuned for each destination, so every post leads with its strongest opening.' },
    { icon: Users, t: 'A human editor signs off on every clip', d: 'Nothing leaves the building on an algorithm’s say-so. Our editors review, polish, and approve each cut before it reaches you.' },
    { icon: Share2, t: 'We deliver, or publish for you', d: 'Clips land in your queue for approval, or we post them on your schedule across TikTok, YouTube, Reels, X, and LinkedIn.' },
    { icon: TrendingUp, t: 'We measure and optimize', d: 'We track what performs, feed it back into how we pick and cut, and your output gets sharper every week.' },
  ];
  return (
    <>
      <PageHero eyebrow="How it works" title="One recording in." italic="A week of content out." sub="You send us your long-form. Our AI systems and human editors turn it into publish-ready short-form, reviewed, on-brand, and delivered every week. No software for you to run." />

      <section className="relative z-10 max-w-[1400px] mx-auto px-8 py-12">
        <div className="grid md:grid-cols-2 gap-3">
          {features.map((f, i) => (
            <Reveal key={f.t} delay={i * 60}>
              <div className="tilt-card group p-8 rounded-xl border border-[#53fc18]/[0.08] hover:border-[#53fc18]/30 hover:bg-[#53fc18]/[0.015] h-full">
                <div className="w-10 h-10 rounded-md border border-[#53fc18]/[0.12] flex items-center justify-center mb-5 group-hover:border-[#53fc18]/40 group-hover:bg-[#53fc18]/5">
                  <f.icon className="w-4 h-4 text-stone-400 group-hover:text-[#53fc18]" />
                </div>
                <div className="font-medium mb-2 text-lg">{f.t}</div>
                <div className="text-sm text-stone-400 leading-relaxed">{f.d}</div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="relative z-10 max-w-[1400px] mx-auto px-8 py-16 border-t border-white/[0.12]">
        <Reveal>
          <div className="grid md:grid-cols-[1fr_1.2fr] gap-16">
            <div>
              <div className="text-[10px] mono text-[#53fc18] mb-4 tracking-[0.2em] uppercase flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[#53fc18]" /> What you get</div>
              <h2 className="serif text-5xl leading-[1.05] tracking-tight mb-6">One show becomes <span className="italic text-[#53fc18]">weeks of content.</span></h2>
              <p className="text-stone-400 leading-relaxed text-lg">Hand us a single recording and a steady stream of reviewed, ready-to-post clips comes back, on a cadence you can build an audience around.</p>
            </div>
            <div className="tilt-card rounded-2xl border border-[#53fc18]/[0.12] bg-black/40 backdrop-blur overflow-hidden">
              <div className="border-b border-white/[0.06] px-5 py-3 text-[10px] mono text-stone-500 tracking-wider uppercase flex items-center justify-between">
                <span>From one 60-minute show</span>
                <span className="text-[#53fc18]">Typical output</span>
              </div>
              <div className="divide-y divide-[#53fc18]/[0.08]">
                {[
                  ['Short-form clips', '12-20'],
                  ['Platform formats', '9:16 · 1:1 · 16:9'],
                  ['Hook & title variants', 'Per clip'],
                  ['Human review', 'Every cut'],
                  ['Turnaround', '48-72 hrs'],
                ].map(([label, val]) => (
                  <div key={label} className="px-5 py-4 flex items-center justify-between gap-4">
                    <div className="text-sm text-stone-300">{label}</div>
                    <div className="mono text-sm text-stone-100 text-right">{val}</div>
                  </div>
                ))}
              </div>
              <div className="border-t border-white/[0.12] px-5 py-3 flex items-center justify-between text-xs">
                <span className="mono text-stone-500">Delivered</span>
                <span className="serif text-2xl text-[#53fc18]">Every week</span>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      <IntegrationsStrip />

      <ClipPreviewPlayer />

      {/* The operation behind the service */}
      <section className="relative z-10 max-w-[1400px] mx-auto px-8 py-16 border-t border-white/[0.12]">
        <Reveal>
          <div className="text-center mb-8">
            <div className="text-[10px] mono text-[#53fc18] mb-4 tracking-[0.2em] uppercase flex items-center justify-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[#53fc18]" /> Behind the scenes</div>
            <h2 className="serif text-5xl leading-[1.05] mb-4">
              The production system <span className="italic gradient-green">behind your content.</span>
            </h2>
            <p className="text-stone-400 leading-relaxed max-w-2xl mx-auto">
              This is the operations console our editors and reviewers work in to produce, check, and ship your clips. You never have to log in or learn it. That’s the whole point. You send content, we run the room.
            </p>
          </div>
          <StudioMockup />
        </Reveal>
      </section>

      <CTABand goto={goto} openApp={openApp} bookCall={bookCall} />
    </>
  );
}

/* ──────────────────────────────────────────────────────────── PRICING */
function PricingPage({ goto, openApp, bookCall }) {
  const tiers = [
    {
      name: 'Launch',
      tag: 'Weekly drop',
      volume: '~60',
      unit: 'clips / mo',
      rate: 'from up to 4 recordings',
      who: 'One show, turned into a steady weekly drop.',
      popular: false,
      baseline: null,
      features: [
        'Hooks, captions & vertical reframing on every clip',
        '3 hook variants per clip, ready to A/B',
        'TikTok, Reels & Shorts native formats',
        'Delivered to your queue, ready to post',
        'Monthly performance recap',
      ],
    },
    {
      name: 'Growth',
      tag: 'Daily posting',
      volume: '~180',
      unit: 'clips / mo',
      rate: 'from up to 12 recordings',
      who: 'Daily short-form across every platform, done for you.',
      popular: true,
      baseline: 'Everything in Launch, plus:',
      features: [
        'All five platforms, formatted natively',
        'We publish to your channels on schedule',
        'A dedicated account manager',
        'Bi-weekly optimization from performance data',
      ],
    },
    {
      name: 'Scale',
      tag: 'Multi-show',
      volume: 'Custom',
      unit: null,
      rate: 'unlimited recordings',
      who: "Multiple shows, brands, or a full content team's output.",
      popular: false,
      baseline: 'Everything in Growth, plus:',
      features: [
        'Multiple shows & brands under one roof',
        'Custom volume, cadence & formats',
        'A senior editor pod + content strategist',
        'Weekly reporting & strategy reviews',
      ],
    },
  ];

  return (
    <>
      <PageHero eyebrow="Pricing" title="Pay for clips" italic="that ship." sub="No seats, no per-minute meter. Pick the volume you want each month and we run the content engine behind it. Every plan is scoped on a call." />

      <section className="relative z-10 max-w-[1400px] mx-auto px-8 py-12 pt-10">
        <div className="grid md:grid-cols-3 gap-4 max-w-5xl mx-auto">
          {tiers.map((t, i) => (
            <Reveal key={t.name} delay={i * 80}>
              <div className="h-full pricing-card-hover">
              <div style={{ '--tilt-scale': t.popular ? '1.02' : '1' }}
                className={`tilt-card relative rounded-2xl border h-full flex flex-col transition-all ${t.popular ? 'border-[#53fc18]/50 bg-gradient-to-b from-[#53fc18]/[0.06] via-[#53fc18]/[0.02] to-transparent shadow-[0_0_60px_-12px_rgba(83,252,24,0.45)] md:scale-[1.02]' : 'border-[#53fc18]/[0.10] bg-[#53fc18]/[0.01] hover:border-[#53fc18]/20'}`}
                onMouseMove={(e) => { const el = e.currentTarget; const r = el.getBoundingClientRect(); el.style.setProperty('--sx', ((e.clientX - r.left) / r.width * 100).toFixed(1) + '%'); el.style.setProperty('--sy', ((e.clientY - r.top) / r.height * 100).toFixed(1) + '%'); el.style.setProperty('--sheen', '1'); }}
                onMouseLeave={(e) => { e.currentTarget.style.setProperty('--sheen', '0'); }}
              >
                <span className="card-sheen" aria-hidden="true" />
                {/* Most popular badge — layered, animated shimmer */}
                {t.popular && (
                  <>
                    {/* Halo glow behind card */}
                    <div className="absolute -inset-px rounded-2xl pointer-events-none" style={{ background: 'radial-gradient(ellipse at top, rgba(83,252,24,0.12), transparent 60%)' }} />

                    {/* Badge */}
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-20">
                      <div className="relative px-3.5 py-1.5 rounded-full bg-gradient-to-b from-[#aaff66] to-[#53fc18] text-black overflow-hidden" style={{ boxShadow: '0 4px 24px -4px rgba(83,252,24,0.6), inset 0 1px 0 rgba(255,255,255,0.4), inset 0 -1px 0 rgba(0,0,0,0.15)' }}>
                        {/* Shimmer sweep */}
                        <div className="absolute inset-0 opacity-50" style={{
                          background: 'linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.5) 50%, transparent 70%)',
                          backgroundSize: '200% 100%',
                          animation: 'shimmer 3s ease-in-out infinite',
                        }} />
                        <div className="relative flex items-center gap-1.5">
                          <span className="text-[8px] mono font-bold tracking-[0.2em] uppercase">★ Most popular</span>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                <div className="relative z-[1] p-8 flex flex-col flex-1">
                  <div className="flex items-baseline justify-between mb-4">
                    <div className="text-[10px] mono text-stone-500 tracking-wider uppercase">{t.name}</div>
                    <div className="text-[10px] mono text-[#53fc18] tracking-wider">{t.tag}</div>
                  </div>
                  <div className="flex items-baseline gap-1.5 mb-1">
                    <span className="serif text-5xl tracking-tight leading-none">{t.volume}</span>
                    {t.unit && <span className="text-xs mono text-stone-500">{t.unit}</span>}
                  </div>
                  <div className="text-[10px] mono text-stone-500 tracking-wider uppercase mb-3">{t.rate}</div>
                  <div className="text-xs text-stone-400 leading-relaxed mb-6 min-h-[32px]">{t.who}</div>

                  {t.baseline && (
                    <div className="text-[10px] mono text-[#53fc18] tracking-wider uppercase mb-3 pb-3 border-b border-white/[0.08]">{t.baseline}</div>
                  )}
                  <ul className="space-y-3 mb-6">
                    {t.features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5 text-sm text-stone-300">
                        <Check className="w-4 h-4 text-[#53fc18] mt-0.5 flex-shrink-0" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>

                  <button
                    onClick={bookCall}
                    className="btn-neon w-full py-3 rounded-md font-medium text-sm mt-auto inline-flex items-center justify-center gap-2 whitespace-nowrap"
                  >
                    Book a demo
                  </button>
                </div>
              </div>
              </div>
            </Reveal>
          ))}
        </div>

        {/* The non-negotiables apply to every plan, stated once */}
        <Reveal delay={240}>
          <div className="max-w-5xl mx-auto mt-8 grid sm:grid-cols-3 gap-px bg-white/[0.06] rounded-2xl overflow-hidden border border-[#53fc18]/[0.08]">
            {[
              { icon: Users, t: 'A human editor signs off on every clip' },
              { icon: Shield, t: 'Your recordings stay your IP, never trained on' },
              { icon: Zap, t: 'No seats, no software for you to run' },
            ].map((b) => (
              <div key={b.t} className="bg-black px-6 py-5 flex items-center gap-3">
                <b.icon className="w-4 h-4 text-[#53fc18] flex-shrink-0" />
                <span className="text-xs text-stone-400 leading-relaxed">{b.t}</span>
              </div>
            ))}
          </div>
          <div className="text-center text-[10px] mono text-stone-600 tracking-[0.18em] uppercase mt-4">Included in every plan</div>
        </Reveal>
      </section>

      <section className="relative z-10 max-w-[1400px] mx-auto px-8 py-16 border-t border-white/[0.12]">
        <Reveal>
          <div className="text-[10px] mono text-[#53fc18] mb-4 tracking-[0.2em] uppercase flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[#53fc18]" /> Compare in detail</div>
          <h2 className="serif text-5xl leading-tight tracking-tight mb-6">What's handled at each level.</h2>
        </Reveal>
        <div className="rounded-2xl border border-[#53fc18]/[0.08] overflow-hidden">
          {[
            ['', 'Launch', 'Growth', 'Scale'],
            ['Recordings in / mo', 'Up to 4', 'Up to 12', 'Unlimited'],
            ['Clips out / mo', '~60', '~180', 'Custom volume'],
            ['Platforms', 'TikTok · Reels · Shorts', 'All five', 'All five + custom'],
            ['Publishing', 'Delivered to you', 'We publish for you', 'Full distribution'],
            ['Account management', 'Shared', 'Dedicated manager', 'Manager + strategist'],
            ['Optimization', 'Monthly recap', 'Bi-weekly', 'Weekly + strategy reviews'],
            ['Human editor review', 'Every clip', 'Every clip', 'Every clip · senior pod'],
          ].map((row, i) => (
            <Reveal key={i} delay={i * 40}>
              <div className={`grid grid-cols-4 px-6 py-4 text-sm transition-colors duration-200 ${i === 0 ? 'border-b border-white/[0.08]' : `hover:bg-[#53fc18]/[0.04] ${i % 2 === 1 ? 'bg-[#53fc18]/[0.015]' : ''}`}`}>
                <div className={i === 0 ? 'text-stone-500 text-[10px] mono tracking-wider uppercase' : 'text-stone-300 font-medium'}>{row[0]}</div>
                {row.slice(1).map((cell, j) => (
                  <div key={j} className={i === 0 ? 'text-[#53fc18] text-[10px] mono tracking-wider uppercase flex items-center' : 'text-stone-400 mono text-xs flex items-center'}>{cell}</div>
                ))}
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Pricing FAQ — how a managed engagement works */}
      <section className="relative z-10 max-w-[1100px] mx-auto px-8 py-20 border-t border-white/[0.12]">
        <Reveal>
          <div className="text-[10px] mono text-[#53fc18] mb-4 tracking-[0.2em] uppercase flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[#53fc18]" /> 
            Pricing questions
          </div>
          <h2 className="serif text-4xl md:text-5xl leading-[1.05] mb-12">
            How an engagement <span className="italic gradient-green">actually works.</span>
          </h2>
        </Reveal>

        <div className="space-y-3">
          {[
            {
              q: 'How does pricing work?',
              a: 'Every engagement is scoped on a strategy call. We price on the volume of finished short-form you want each month and how much of the workflow you want us to own, from editing only to fully managed publishing. No seats, no per-minute metering.'
            },
            {
              q: 'Is there a minimum commitment?',
              a: 'Most partners start on a monthly retainer so we can build a rhythm and learn what performs for your audience. There is no long lock-in, so you can adjust volume or pause between cycles with notice.'
            },
            {
              q: 'Who owns the content you produce?',
              a: 'You do. Every clip, caption, and asset we create is yours to keep and use anywhere, forever.'
            },
            {
              q: 'How fast can we start?',
              a: 'After the strategy call we typically onboard within a week. Send your first recording and the first batch of clips is usually back for your review within a few days.'
            },
            {
              q: 'Do you publish to our accounts, or just hand over the files?',
              a: 'Either. Growth and Scale partners have us post on a schedule across their channels; if you would rather keep publishing in-house, we deliver everything ready to go.'
            },
            {
              q: "What if we're not happy with a clip?",
              a: 'Revisions are part of the service. A human editor reviews everything before it reaches you, and anything that misses gets reworked. We optimize for clips that actually perform.'
            },
          ].map((item, i) => (
            <FAQItem key={i} q={item.q} a={item.a} />
          ))}
        </div>
      </section>

      <CTABand goto={goto} openApp={openApp} bookCall={bookCall} />
    </>
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

function PrivacyPage({ goto }) {
  return (
    <>
      <PageHero eyebrow="Legal" title="Privacy," italic="in plain English." sub="What we collect today, what we do with it, and how to make us delete it. Last updated June 2026." />
      <section className="relative z-10 max-w-3xl mx-auto px-6 md:px-8 pb-16">
        <LegalSection title="What we collect">
          <p>Right now this site collects one thing: the email address (and optional content type) you submit when you request a strategy call. We also use privacy-respecting product analytics to understand how visitors use the site.</p>
        </LegalSection>
        <LegalSection title="What we do with it">
          <p>We use your email to schedule your call and to follow up about working together. We do not sell it, rent it, or share it with advertisers.</p>
        </LegalSection>
        <LegalSection title="Your recordings and your IP">
          <p>When you become a client, your recordings stay yours. We never train models on your content, and we delete source material on request.</p>
        </LegalSection>
        <LegalSection title="Deletion and questions">
          <p>Email privacy@clipper.ai and we will remove your data, usually within a few days. Questions about anything here are welcome at the same address.</p>
        </LegalSection>
      </section>
    </>
  );
}

function TermsPage({ goto }) {
  return (
    <>
      <PageHero eyebrow="Legal" title="Terms," italic="the short version." sub="Clipper.ai is in early access. These are the honest ground rules until full terms ship with the service agreement. Last updated June 2026." />
      <section className="relative z-10 max-w-3xl mx-auto px-6 md:px-8 pb-16">
        <LegalSection title="The site">
          <p>The sample run, scores, and numbers shown on this site are demonstrations on sample footage, not results we promise you. We cannot guarantee any clip goes viral; nobody honestly can.</p>
        </LegalSection>
        <LegalSection title="The service">
          <p>Client work is governed by the service agreement you sign at onboarding, which covers scope, pricing, ownership, and turnaround. Your content remains your property throughout.</p>
        </LegalSection>
        <LegalSection title="Contact">
          <p>Anything unclear, email hello@clipper.ai before you book. We would rather answer questions up front.</p>
        </LegalSection>
      </section>
    </>
  );
}

function DocsPage({ goto, bookCall }) {
  // The search is real: it live-filters the topic tiles below. ⌘K / Ctrl+K
  // focuses it, like people expect. Tiles are reference summaries (the full
  // guides ship with the product), so they carry no dead "Read" links.
  // (⌘K belongs to the site-wide command palette; this search is click/tap-to-focus.)
  const [q, setQ] = useState('');
  const searchRef = useRef(null);
  const topics = [
    { icon: BookOpen, t: 'Getting started', d: 'What happens after your strategy call, how onboarding works, and how to send your first recording.', count: 'Start here' },
    { icon: Upload, t: 'How to send us content', d: 'Drop a link or a file: podcasts, interviews, livestreams, webinars, YouTube. What formats work best and how to get clean audio.', count: 'Formats' },
    { icon: Download, t: 'What you receive', d: 'The clips, formats, captions, hooks, and thumbnails in every delivery, and how they land in your queue.', count: 'Overview' },
    { icon: Clock, t: 'Turnaround & cadence', d: 'How fast your first batch arrives, and how we keep a steady weekly stream running behind your show.', count: '48-72 hrs' },
    { icon: GitBranch, t: 'Approvals & control', d: 'You keep the final say. How approval works, how to request changes, and how we publish on your schedule.', count: 'Your call' },
    { icon: Layers, t: 'Brand & style', d: 'Lock your fonts, colors, intros, and caption look once. Every clip we ship comes back on-brand.', count: 'Setup' },
    { icon: Globe, t: 'Platforms we publish to', d: 'TikTok, YouTube Shorts, Reels, X, and LinkedIn, delivered ready-to-post or published for you.', count: '5 platforms' },
    { icon: Shield, t: 'Security & your IP', d: 'How we handle your recordings, retention, and why we never train models on your content.', count: 'Policy' },
  ];
  const norm = q.trim().toLowerCase();
  const shown = norm ? topics.filter((d) => (d.t + ' ' + d.d).toLowerCase().includes(norm)) : topics;
  return (
    <>
      <PageHero eyebrow="Resources" title="Everything you need" italic="to get started." sub="How to send us your content, what comes back, how fast, and how much you control. The practical stuff, not technical manuals." />

      <section className="relative z-10 max-w-[1400px] mx-auto px-8 py-12">
        <Reveal>
          <div className="relative max-w-2xl">
            <Search className="w-4 h-4 text-stone-500 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              ref={searchRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search topics · try 'turnaround' or 'approvals'"
              aria-label="Search resource topics"
              className="w-full pl-11 pr-4 py-3.5 rounded-md bg-[#53fc18]/[0.015] border border-[#53fc18]/[0.12] focus:border-[#53fc18]/30 focus:outline-none text-sm placeholder:text-stone-500"
            />

          </div>
        </Reveal>
      </section>

      <section className="relative z-10 max-w-[1400px] mx-auto px-8 py-12">
        {shown.length === 0 ? (
          <div className="rounded-xl border border-white/[0.07] p-10 text-center">
            <div className="text-sm text-stone-400 mb-1">Nothing matches “{q.trim()}”.</div>
            <div className="text-xs text-stone-600">Try a different word, or book a demo and just ask us.</div>
          </div>
        ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {shown.map((d, i) => (
            <Reveal key={d.t} delay={i * 50}>
              <div className="tilt-card group p-7 rounded-xl border border-[#53fc18]/[0.08] hover:border-[#53fc18]/30 hover:bg-[#53fc18]/[0.015] h-full">
                <div className="flex items-start justify-between mb-5">
                  <div className="w-10 h-10 rounded-md border border-[#53fc18]/[0.12] flex items-center justify-center group-hover:border-[#53fc18]/40 group-hover:bg-[#53fc18]/5">
                    <d.icon className="w-4 h-4 text-stone-400 group-hover:text-[#53fc18]" />
                  </div>
                  <span className="text-[10px] mono text-stone-500 tracking-wider uppercase">{d.count}</span>
                </div>
                <div className="font-medium mb-2 text-lg">{d.t}</div>
                <div className="text-sm text-stone-400 leading-relaxed">{d.d}</div>
              </div>
            </Reveal>
          ))}
        </div>
        )}
      </section>

      <section className="relative z-10 max-w-[1400px] mx-auto px-8 py-16 border-t border-white/[0.12]">
        <Reveal>
          <div className="rounded-2xl border border-[#53fc18]/[0.10] bg-[#53fc18]/[0.02] p-10 md:p-12 text-center max-w-2xl mx-auto">
            <div className="text-[10px] mono text-[#53fc18] mb-4 tracking-[0.2em] uppercase">Still have questions?</div>
            <h2 className="serif text-4xl leading-tight mb-4">The fastest answer is <span className="italic gradient-green">a conversation.</span></h2>
            <p className="text-stone-400 leading-relaxed mb-8 max-w-lg mx-auto">Tell us about your show and what you’re trying to grow. We’ll walk you through how we’d run your content.</p>
            <button onClick={bookCall || (() => goto('home'))} className="btn-neon group px-6 py-4 rounded-md font-medium inline-flex items-center gap-2">
              Book a demo
              <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </button>
          </div>
        </Reveal>
      </section>
    </>
  );
}

/* ──────────────────────────────────────────────────────────── STATUS */
function StatusPage({ goto, bookCall }) {
  // Pre-launch: Clipper isn't serving public traffic yet, so there is no uptime
  // history or incident record to publish. Both start the day we open to traffic.
  const systems = [
    { name: 'Content intake' },
    { name: 'Transcription & analysis' },
    { name: 'Clip selection & scoring' },
    { name: 'Editing & formatting' },
    { name: 'Human review' },
    { name: 'Delivery & publishing' },
    { name: 'Performance reporting' },
    { name: 'Client communication' },
  ];

  return (
    <>
      <PageHero eyebrow="Status" title="Pre-launch" italic="status." sub="Clipper isn't running client work at scale yet, so there's no operational history to show. We'll publish live service status and an operations log here the day we open to clients." />

      <section className="relative z-10 max-w-[1400px] mx-auto px-6 md:px-8 pb-10">
        <Reveal>
          <div className="rounded-2xl border border-[#53fc18]/30 bg-[#53fc18]/[0.04] p-8 flex items-center gap-4">
            <div className="relative">
              <span className="w-3 h-3 rounded-full bg-[#53fc18] block" style={{ boxShadow: '0 0 16px #53fc18' }} />
              <span className="absolute inset-0 w-3 h-3 rounded-full bg-[#53fc18] animate-ping opacity-60" />
            </div>
            <div>
              <div className="serif text-3xl text-[#53fc18]">Pre-launch, not yet live</div>
              <div className="text-xs mono text-stone-400 tracking-wider mt-1">LIVE SERVICE STATUS BEGINS WHEN WE OPEN TO CLIENTS</div>
            </div>
          </div>
        </Reveal>
      </section>

      <section className="relative z-10 max-w-[1400px] mx-auto px-6 md:px-8 pb-16 border-t border-white/[0.12] pt-12">
        <Reveal>
          <div className="flex items-baseline justify-between mb-8">
            <div>
              <div className="text-[10px] mono text-[#53fc18] mb-2 tracking-[0.2em] uppercase flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[#53fc18]" /> 
                Systems
              </div>
              <h2 className="serif text-4xl">Components</h2>
            </div>
            <div className="text-[10px] mono text-stone-500 tracking-wider">STATUS PUBLISHED AT LAUNCH</div>
          </div>
          <div className="rounded-2xl border border-[#53fc18]/[0.10] bg-stone-900/30 overflow-hidden divide-y divide-[#53fc18]/[0.08]">
            {systems.map((sys, i) => (
              <Reveal key={sys.name} delay={i * 30}>
                <div className="px-6 py-5 flex items-center justify-between gap-6 hover:bg-[#53fc18]/[0.015]">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-stone-500 flex-shrink-0" />
                    <div className="text-sm font-medium text-stone-100">{sys.name}</div>
                  </div>
                  <div className="text-[10px] mono px-2 py-0.5 rounded border border-stone-700 bg-stone-800/40 text-stone-400 tracking-wider uppercase flex-shrink-0">Pre-launch</div>
                </div>
              </Reveal>
            ))}
          </div>
        </Reveal>
      </section>

      <section className="relative z-10 max-w-[1400px] mx-auto px-6 md:px-8 pb-20 border-t border-white/[0.12] pt-12">
        <Reveal>
          <div className="flex items-baseline justify-between mb-8">
            <div>
              <div className="text-[10px] mono text-[#53fc18] mb-2 tracking-[0.2em] uppercase flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[#53fc18]" /> 
                History
              </div>
              <h2 className="serif text-4xl">Incidents</h2>
            </div>
          </div>
          <div className="rounded-xl border border-[#53fc18]/[0.10] bg-[#53fc18]/[0.02] p-6 text-center">
            <div className="text-sm text-stone-400">No incidents to report. Public incident history starts when Clipper begins serving live traffic.</div>
            <div className="text-[10px] mono text-stone-600 tracking-wider mt-2">STATUS UPDATES → STATUS@CLIPPER.AI</div>
          </div>
        </Reveal>
      </section>

      <CTABand goto={goto} openApp={() => goto('home')} bookCall={bookCall} />
    </>
  );
}

/* ──────────────────────────────────────────────────────────── COMPANY */
function CompanyPage({ goto, bookCall }) {
  return (
    <>
      <PageHero eyebrow="Company" title="Built by people who" italic="missed the deadline." sub="Clipper.ai is a pre-launch content operations company built to fix one stubborn problem: great long-form content dying in the gap between recording it and finding the time to clip it." />

      <section className="relative z-10 max-w-[1400px] mx-auto px-8 py-12">
        <div className="grid md:grid-cols-3 gap-4">
          {[
            { icon: Zap, t: 'Speed compounds', d: 'Every shipped clip teaches us something. The more we publish for you, the faster we learn what works, so we optimize the whole operation for time-to-publish.' },
            { icon: Shield, t: 'Your data, your IP', d: 'We never train on client content. Our systems improve from anonymized aggregate signal, never from your specific videos.' },
            { icon: Globe, t: 'Open by default', d: 'How we work is on the website. Our pricing is too. No mystery process, no hidden floors.' },
          ].map((p, i) => (
            <Reveal key={p.t} delay={i * 80}>
              <div className="tilt-card p-8 rounded-xl border border-[#53fc18]/[0.08] h-full">
                <p.icon className="w-5 h-5 text-[#53fc18] mb-5" />
                <div className="font-medium mb-2 text-lg">{p.t}</div>
                <div className="text-sm text-stone-400 leading-relaxed">{p.d}</div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="relative z-10 max-w-[1400px] mx-auto px-8 py-16 border-t border-white/[0.12]">
        <Reveal>
          <div className="max-w-2xl">
            <div className="text-[10px] mono text-[#53fc18] mb-4 tracking-[0.2em] uppercase flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[#53fc18]" /> Careers</div>
            <h2 className="serif text-5xl leading-tight tracking-tight mb-6">Come build the<br /><span className="italic">attention layer.</span></h2>
            <p className="text-stone-400 leading-relaxed text-lg mb-6">We're a small, pre-launch team and aren't running formal openings yet. If this is the problem you'd want to spend your time on, we'd still like to hear from you.</p>
            <a href="mailto:jobs@clipper.ai" className="inline-flex items-center gap-2 text-sm text-stone-300 hover:text-[#53fc18] group">
              jobs@clipper.ai
              <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </a>
          </div>
        </Reveal>
      </section>

      <section className="relative z-10 max-w-[1400px] mx-auto px-8 py-16 border-t border-white/[0.12]">
        <div className="grid md:grid-cols-3 gap-8">
          <Reveal>
            <div>
              <div className="text-[10px] mono text-[#53fc18] mb-3 tracking-[0.2em] uppercase flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[#53fc18]" /> Status</div>
              <h3 className="serif text-3xl mb-4">Where we are</h3>
              <div className="space-y-3 text-sm text-stone-400">
                <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[#53fc18]" style={{ boxShadow: '0 0 6px #53fc18' }} /> Pre-launch, early access opens in small batches</div>
                <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-stone-500" /> Private beta, onboarding our first design partners</div>
                <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-stone-500" /> Independently built, talking to potential backers</div>
                <div className="text-xs text-stone-600 pt-2">Press inquiries → press@clipper.ai</div>
              </div>
            </div>
          </Reveal>
          <Reveal delay={80}>
            <div>
              <div className="text-[10px] mono text-[#53fc18] mb-3 tracking-[0.2em] uppercase flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[#53fc18]" /> Contact</div>
              <h3 className="serif text-3xl mb-4">Get in touch</h3>
              <div className="space-y-2 text-sm text-stone-400">
                <div className="flex items-center gap-2"><Mail className="w-3.5 h-3.5 text-stone-500" /> hello@clipper.ai</div>
                <div className="flex items-center gap-2"><Briefcase className="w-3.5 h-3.5 text-stone-500" /> sales@clipper.ai</div>
                <div className="flex items-center gap-2"><Building2 className="w-3.5 h-3.5 text-stone-500" /> press@clipper.ai</div>
              </div>
            </div>
          </Reveal>
          <Reveal delay={160}>
            <div>
              <div className="text-[10px] mono text-[#53fc18] mb-3 tracking-[0.2em] uppercase flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[#53fc18]" /> Backing</div>
              <h3 className="serif text-3xl mb-4">Independent and early</h3>
              <div className="text-sm text-stone-400 leading-relaxed">Clipper is independently built and pre-launch. If you back AI-native content operations for creators and media teams, we'd love to talk.</div>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}

/* ──────────────────────────────────────────────────────────── PRE-LAUNCH COMPONENTS */
function Waitlist({ accent = '#53fc18' }) {
  const [email, setEmail] = useState('');
  const [kind, setKind] = useState(''); // optional lead qualifier — what they make
  const [submitted, setSubmitted] = useState(false);
  const [count, setCount] = useState(0);
  const [position, setPosition] = useState(1);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [todayCount, setTodayCount] = useState(0);

  // Load real waitlist count on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get('waitlist:meta', true);
        if (res && res.value) {
          const meta = JSON.parse(res.value);
          setCount(meta.totalSignups || 0);
          // Count signups from today
          const today = new Date().toISOString().slice(0, 10);
          if (meta.dailySignups && meta.dailySignups[today]) {
            setTodayCount(meta.dailySignups[today]);
          }
        }
      } catch (e) {
        // No existing data — use defaults
      }
    })();
  }, []);

  const submit = async () => {
    const trimmed = email.trim().toLowerCase();
    setError('');
    if (!trimmed || !trimmed.includes('@') || !trimmed.includes('.')) {
      setError('Please enter a valid email address.');
      return;
    }
    setLoading(true);
    try {
      // Check for dedup
      const existingRes = await window.storage.get(`waitlist:email:${trimmed}`, true).catch(() => null);
      if (existingRes && existingRes.value) {
        const existing = JSON.parse(existingRes.value);
        setPosition(existing.position);
        track('book_call_requested', { duplicate: true, contentKind: kind || undefined });
        setSubmitted(true);
        setLoading(false);
        return;
      }

      // Load meta
      let meta = { totalSignups: 0, dailySignups: {} };
      try {
        const metaRes = await window.storage.get('waitlist:meta', true);
        if (metaRes && metaRes.value) meta = JSON.parse(metaRes.value);
      } catch (e) {}

      const today = new Date().toISOString().slice(0, 10);
      meta.totalSignups = (meta.totalSignups || 0) + 1;
      meta.dailySignups = meta.dailySignups || {};
      meta.dailySignups[today] = (meta.dailySignups[today] || 0) + 1;

      const newPosition = meta.totalSignups;

      // Save email record
      await window.storage.set(`waitlist:email:${trimmed}`, JSON.stringify({
        email: trimmed,
        position: newPosition,
        contentKind: kind || null,
        signedUpAt: new Date().toISOString(),
      }), true);

      // Save meta
      await window.storage.set('waitlist:meta', JSON.stringify(meta), true);

      setCount(newPosition);
      setPosition(newPosition);
      setTodayCount(meta.dailySignups[today]);
      track('book_call_requested', { position: newPosition, contentKind: kind || undefined });
      setSubmitted(true);
    } catch (e) {
      setError("Something went wrong. Please try again.");
    }
    setLoading(false);
  };

  return (
    <section className="relative z-10 max-w-[1400px] mx-auto px-8 py-16 border-t border-white/[0.12]">
      <Reveal>
        <div className="relative max-w-3xl mx-auto text-center">
          <div className="absolute -inset-20 bg-[#53fc18]/[0.10] blur-3xl rounded-full pointer-events-none" />
          <div className="relative">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#53fc18]/[0.12] bg-[#53fc18]/[0.015] backdrop-blur text-[11px] mono text-stone-300 mb-8 tracking-wider uppercase">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inset-0 rounded-full bg-[#53fc18] animate-ping opacity-60" />
                <span className="relative rounded-full h-1.5 w-1.5 bg-[#53fc18]" />
              </span>
              Now onboarding founding partners · in small batches
            </div>

            <h2 className="serif text-5xl md:text-6xl leading-[1.05] mb-6 text-center">
              Book a <span className="italic gradient-green">demo.</span>
            </h2>
            <p className="text-stone-400 leading-relaxed text-lg mb-10 max-w-xl mx-auto text-center">
              We take on new content partners in small batches so every account gets real attention. Tell us about your show and we'll scope a content engine built around it: turnaround, output, and what we'd publish.
            </p>

            <div className="max-w-2xl mx-auto mb-10">
              <div className="text-[10px] mono text-stone-500 tracking-[0.2em] uppercase mb-4 text-center">What founding partners get</div>
              <div className="grid sm:grid-cols-3 gap-px bg-white/[0.06] rounded-2xl overflow-hidden border border-[#53fc18]/[0.08] text-left">
                {[
                  { t: 'A direct line to the founders', d: 'You work with the people building Clipper, not a ticket queue.' },
                  { t: 'Your input shapes the service', d: 'Early partners set what we prioritize and how the workflow runs.' },
                  { t: 'Full attention on your content', d: 'Small batches mean real focus on every clip, never a backlog.' },
                ].map((b) => (
                  <div key={b.t} className="bg-black p-5">
                    <div className="text-sm text-stone-200 font-medium mb-1.5">{b.t}</div>
                    <div className="text-xs text-stone-500 leading-relaxed">{b.d}</div>
                  </div>
                ))}
              </div>
            </div>

            {!submitted ? (
              <>
                {/* Optional one-tap qualifier — warms the strategy call without
                    adding a form field to type into. */}
                <div className="flex flex-wrap items-center justify-center gap-2 max-w-xl mx-auto mb-4">
                  <span className="text-[10px] mono text-stone-500 tracking-[0.18em] uppercase mr-1">You make</span>
                  {['Podcast', 'Interviews', 'Livestreams', 'Webinars', 'Other'].map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setKind(kind === k ? '' : k)}
                      aria-pressed={kind === k}
                      className={`px-3 py-1.5 rounded-full border text-xs transition-colors ${
                        kind === k
                          ? 'border-[#53fc18]/60 bg-[#53fc18]/[0.1] text-[#aaff66]'
                          : 'border-white/[0.12] text-stone-400 hover:border-[#53fc18]/30 hover:text-stone-200'
                      }`}
                    >
                      {k}
                    </button>
                  ))}
                </div>
                <div className="flex flex-col sm:flex-row gap-2 max-w-xl mx-auto mb-3 justify-center">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setError(''); }}
                    onKeyDown={(e) => e.key === 'Enter' && !loading && submit()}
                    placeholder="you@company.com"
                    aria-label="Work email"
                    aria-invalid={!!error}
                    autoComplete="email"
                    disabled={loading}
                    className="flex-1 min-w-0 px-5 py-4 rounded-md border border-[#53fc18]/30 focus:border-[#53fc18]/60 focus:outline-none text-base placeholder:text-stone-500 disabled:opacity-50"
                    style={{ backgroundColor: 'rgba(20, 20, 18, 0.8)', color: '#e7e5e4' }}
                  />
                  <button
                    onClick={submit}
                    disabled={loading}
                    className="btn-neon group px-6 py-4 rounded-md font-medium flex items-center justify-center gap-2 whitespace-nowrap disabled:opacity-50"
                  >
                    {loading ? 'Sending…' : 'Request my call'}
                    {!loading && <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />}
                  </button>
                </div>
                {error && (
                  <div role="alert" className="text-xs mono text-red-400 text-center mb-3 tracking-wider">{error}</div>
                )}
                {!error && <div className="mb-3" />}
              </>
            ) : (
              <div role="status" className="max-w-lg mx-auto mb-6 p-5 rounded-md border border-[#53fc18]/30 bg-[#53fc18]/[0.08] flex items-center gap-3" style={{ animation: 'blur-in 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}>
                <CheckCircle2 className="w-5 h-5 text-[#53fc18] flex-shrink-0" />
                <div className="text-left flex-1">
                  <div className="font-medium text-sm">Request received.</div>
                  <div className="text-xs text-stone-400 mt-0.5">We'll be in touch within 48 hours to book your demo.</div>
                </div>
              </div>
            )}

            <div className="flex items-center justify-center gap-3 text-xs mono text-stone-500 tracking-wider">
              <span>We reply within 48 hours</span>
              <span className="text-stone-700">·</span>
              <span>No spam, ever</span>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

/* ──────────────────────────────────────────────────────────── WHY CLIPPER
   Honest, qualitative 3-way comparison (DIY tool / hire it out / Clipper).
   No invented prices or competitor stats. The Clipper column and the
   risk-reversal footer reuse only claims already made elsewhere on the site:
   AI scoring + human sign-off, steady weekly cadence, pay per clip we ship,
   "we never train on your content", start with a single recording. */
function WhyClipper({ bookCall }) {
  const cols = [
    {
      k: 'diy', label: 'Do it yourself', sub: 'A clipping tool', neon: false, Icon: Scissors,
      rows: [
        { l: 'Who does the work', v: 'You. Learn the tool, scrub the timeline, cut and caption every clip yourself.' },
        { l: 'Finding the moments', v: 'You hunt for them by hand, recording after recording.' },
        { l: 'Quality control', v: 'Whatever you have time to check before you post.' },
        { l: 'Staying consistent', v: 'Slips the first week you get busy.' },
        { l: 'What it costs', v: 'Your hours, plus the subscription.' },
      ],
    },
    {
      k: 'hire', label: 'Hire it out', sub: 'An editor or agency', neon: false, Icon: Briefcase,
      rows: [
        { l: 'Who does the work', v: 'You recruit, brief, and manage an editor or agency.' },
        { l: 'Finding the moments', v: 'Down to their instincts and how well you direct them.' },
        { l: 'Quality control', v: 'Varies with whoever you hired that month.' },
        { l: 'Staying consistent', v: 'Tied to one person\u2019s schedule and turnaround.' },
        { l: 'What it costs', v: 'A salary or monthly retainer, good output or not.' },
      ],
    },
    {
      k: 'clipper', label: 'Clipper', sub: 'Done for you', neon: true, Icon: Sparkles,
      rows: [
        { l: 'Who does the work', v: 'We do. You record the long-form, we handle everything after.' },
        { l: 'Finding the moments', v: 'AI scores every moment for retention, then a human picks the cut.' },
        { l: 'Quality control', v: 'A human signs off on every clip before it ships. Nothing on autopilot.' },
        { l: 'Staying consistent', v: 'Publish-ready short-form in your queue on a steady weekly cadence.' },
        { l: 'What it costs', v: 'You pay per clip we ship. Approve what you want, skip the rest.' },
      ],
    },
  ];
  // The verdict row pays off the headline: where does the work land?
  const verdicts = ['On you.', 'Still on you.', 'On us.'];
  // Pivot for the desktop matrix: one row per criterion, values aligned across
  // the three options so the reader compares left-to-right instead of
  // re-reading three separate cards.
  const matrix = cols[0].rows.map((r, ri) => ({ l: r.l, vals: cols.map((c) => c.rows[ri].v) }));
  const reassure = [
    { t: 'Pay per clip we ship', d: 'You are billed for clips that actually go out, never for hours or seats.' },
    { t: 'A human signs off on every clip', d: 'Nothing reaches your queue on autopilot.' },
    { t: 'Your content stays yours', d: 'We never train on it. Our systems improve from anonymized aggregate signal, never your videos.' },
    { t: 'Start with one recording', d: 'Send a single link to see what comes back before you scale up.' },
  ];
  return (
    <section className="relative z-10 max-w-[1400px] mx-auto px-6 md:px-8 py-12 border-t border-white/[0.12]">
      <Reveal>
        <div className="max-w-2xl mb-10">
          <div className="text-[10px] mono text-[#53fc18] tracking-[0.2em] uppercase mb-4 flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[#53fc18]" /> The honest comparison</div>
          <h2 className="serif text-3xl md:text-4xl tracking-tight leading-[1.1] mb-4">
            Three ways to turn long-form into clips.<br />
            Only one <span className="italic gradient-green">doesn&rsquo;t land on you.</span>
          </h2>
          <p className="text-stone-400 leading-relaxed text-lg">
            You can run the tools yourself, hire someone to run them, or hand the whole thing over. Here is the honest version of each.
          </p>
        </div>
      </Reveal>

      {/* Desktop: one aligned matrix. A shared label column keeps every
          criterion on a single line of sight across the three options, and the
          Clipper column carries a continuous neon band. Mobile keeps the
          stacked cards below. */}
      <Reveal className="hidden md:block">
        <div className="tilt-card card-lift relative rounded-2xl border border-white/[0.08] bg-white/[0.01] overflow-hidden">
          {/* Header row */}
          <div className="cmp-row">
            <div className="px-6 py-5" />
            {cols.map((c) => {
              const Icon = c.Icon;
              return (
                <div key={c.k} className={`flex items-center gap-3 px-6 py-5 border-l border-white/[0.06] ${c.neon ? 'bg-[#53fc18]/[0.05]' : ''}`}>
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${c.neon ? 'bg-[#53fc18]/15 text-[#53fc18]' : 'bg-white/[0.04] text-stone-400'}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className={`text-base font-medium leading-tight ${c.neon ? 'text-[#53fc18]' : 'text-stone-200'}`}>{c.label}</div>
                    <div className="text-[10px] mono text-stone-500 tracking-[0.18em] uppercase mt-0.5">{c.sub}</div>
                  </div>
                  {c.neon && <span className="ml-auto text-[#53fc18] text-xl leading-none flex-shrink-0">&#10003;</span>}
                </div>
              );
            })}
          </div>
          {/* Criterion rows */}
          {matrix.map((r) => (
            <div key={r.l} className="cmp-row border-t border-white/[0.06] transition-colors hover:bg-white/[0.015]">
              <div className="px-6 py-4 text-[10px] mono text-stone-600 tracking-[0.16em] uppercase leading-snug flex items-center">{r.l}</div>
              {r.vals.map((v, i) => (
                <div key={i} className={`px-6 py-4 text-sm leading-relaxed border-l border-white/[0.06] ${cols[i].neon ? 'bg-[#53fc18]/[0.05] text-stone-200' : 'text-stone-400'}`}>{v}</div>
              ))}
            </div>
          ))}
          {/* Verdict row — pays off the headline */}
          <div className="cmp-row border-t border-white/[0.1]">
            <div className="px-6 py-4 text-[10px] mono text-stone-500 tracking-[0.16em] uppercase flex items-center">Where it lands</div>
            {verdicts.map((v, i) => (
              <div key={i} className={`px-6 py-4 border-l border-white/[0.06] ${cols[i].neon ? 'bg-[#53fc18]/[0.08]' : ''}`}>
                <span className={`serif text-lg ${cols[i].neon ? 'text-[#53fc18]' : 'text-stone-500'}`} style={cols[i].neon ? { textShadow: '0 0 18px rgba(83,252,24,0.45)' } : undefined}>{v}</span>
              </div>
            ))}
          </div>
          {/* Continuous glow over the Clipper column */}
          <span aria-hidden className="absolute inset-y-0 pointer-events-none" style={{ left: 'calc(170px + (100% - 170px) * 2 / 3)', width: 'calc((100% - 170px) / 3)', boxShadow: 'inset 0 0 0 1px rgba(83,252,24,0.35), 0 0 44px -10px rgba(83,252,24,0.35)' }} />
        </div>
      </Reveal>

      {/* Mobile: stacked cards (one option at a time reads better narrow) */}
      <div className="grid grid-cols-1 gap-4 md:hidden">
        {cols.map((c, i) => {
          const Icon = c.Icon;
          return (
          <Reveal key={c.k} delay={i * 80} className="h-full">
            <div
              className={`group relative h-full rounded-2xl border flex flex-col overflow-hidden card-lift tilt-card ${c.neon ? 'border-[#53fc18]/45 bg-[#53fc18]/[0.04]' : 'border-white/[0.08] bg-white/[0.01] hover:border-white/[0.18]'}`}
              style={c.neon ? { boxShadow: '0 0 44px -14px rgba(83,252,24,0.4)' } : undefined}
            >
              {c.neon && <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#53fc18] to-transparent" />}
              <div className="flex items-center gap-3 px-6 pt-6 pb-5 border-b border-white/[0.07]">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${c.neon ? 'bg-[#53fc18]/15 text-[#53fc18]' : 'bg-white/[0.04] text-stone-400'}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className={`text-base font-medium leading-tight ${c.neon ? 'text-[#53fc18]' : 'text-stone-200'}`}>{c.label}</div>
                  <div className="text-[10px] mono text-stone-500 tracking-[0.18em] uppercase mt-0.5">{c.sub}</div>
                </div>
                {c.neon && (
                  <span className="ml-auto text-[#53fc18] text-xl leading-none flex-shrink-0">&#10003;</span>
                )}
              </div>
              <div className="flex-1 px-6 divide-y divide-white/[0.06]">
                {c.rows.map((r) => (
                  <div key={r.l} className="py-4">
                    <div className="text-[10px] mono text-stone-600 tracking-[0.16em] uppercase mb-1.5 leading-snug">{r.l}</div>
                    <div className={`text-sm leading-relaxed ${c.neon ? 'text-stone-200' : 'text-stone-400'}`}>{r.v}</div>
                  </div>
                ))}
                <div className="py-4">
                  <div className="text-[10px] mono text-stone-600 tracking-[0.16em] uppercase mb-1.5 leading-snug">Where it lands</div>
                  <div className={`serif text-lg ${c.neon ? 'text-[#53fc18]' : 'text-stone-500'}`}>{verdicts[i]}</div>
                </div>
              </div>
            </div>
          </Reveal>
          );
        })}
      </div>

      <Reveal delay={260}>
        <div className="mt-10 flex flex-col items-center gap-4 text-center">
          <p className="serif text-xl md:text-2xl text-stone-200 tracking-tight">Ready to hand the whole thing over?</p>
          <button onClick={bookCall} className="btn-neon group px-7 py-4 rounded-md font-medium inline-flex items-center gap-2 whitespace-nowrap">
            Book a demo
            <ArrowUpRight className="w-4 h-4" />
          </button>
        </div>
      </Reveal>

      <Reveal delay={340}>
        <div className="mt-9 rounded-2xl border border-[#53fc18]/25 bg-gradient-to-r from-[#53fc18]/[0.05] to-transparent p-6 md:p-7 grid sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-6">
          {reassure.map((r) => (
            <div key={r.t} className="flex gap-3">
              <span className="w-5 h-5 rounded-full bg-[#53fc18]/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Check className="w-3 h-3 text-[#53fc18]" />
              </span>
              <div>
                <div className="text-sm text-stone-200 font-medium mb-1">{r.t}</div>
                <div className="text-xs text-stone-500 leading-relaxed">{r.d}</div>
              </div>
            </div>
          ))}
        </div>
      </Reveal>
    </section>
  );
}

function TrustStrip() {
  const badges = [
    { icon: Shield, label: 'SOC 2 Type II', sub: 'In progress' },
    { icon: Shield, label: 'GDPR ready', sub: 'EU compliant' },
    { icon: Database, label: 'Your data, your IP', sub: 'Never trained on' },
    { icon: Globe, label: 'US-hosted', sub: 'SFO · primary region' },
  ];
  return (
    <section className="relative z-10 max-w-[1400px] mx-auto px-8 py-12 border-t border-white/[0.12]">
      <Reveal>
        <div className="text-center mb-10">
          <div className="text-[10px] mono text-stone-500 tracking-[0.2em] uppercase">Built for teams that care about how their content is handled</div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-white/[0.06] rounded-2xl overflow-hidden border border-[#53fc18]/[0.08]">
          {badges.map((b, i) => (
            <Reveal key={b.label} delay={i * 60}>
              <div className="bg-black p-7 flex items-start gap-4 h-full">
                <div className="w-9 h-9 rounded-md border border-[#53fc18]/[0.12] flex items-center justify-center flex-shrink-0">
                  <b.icon className="w-4 h-4 text-[#53fc18]" />
                </div>
                <div>
                  <div className="text-sm font-medium mb-1">{b.label}</div>
                  <div className="text-xs mono text-stone-500 tracking-wider uppercase">{b.sub}</div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </Reveal>
    </section>
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


/* ──────────────────────────────────────────────────────────── UPLOAD */
function UploadView({ onFile, fileRef, history = [], onLoadRun, onDeleteRun }) {
  const [drag, setDrag] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const relTime = (iso) => {
    if (!iso) return '';
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(iso).toLocaleDateString();
  };

  return (
    <div className="animate-slide-up">
      <div className="flex items-baseline justify-between mb-10">
        <div>
          <div className="text-xs mono text-stone-500 mb-2 tracking-wider">→ NEW PROJECT</div>
          <h1 className="serif text-5xl tracking-tight">Drop your long-form video</h1>
        </div>
        <div className="text-right text-xs mono text-stone-500">
          <div>SUPPORTED</div>
          <div className="text-stone-400 mt-1">.mp4 · .mov · .webm · up to 4GB</div>
        </div>
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); onFile(e.dataTransfer.files[0]); }}
        onClick={() => fileRef.current?.click()}
        className={`relative cursor-pointer rounded-2xl border-2 border-dashed p-16 text-center transition-all ${
          drag ? 'border-[#53fc18] bg-[#53fc18]/5' : 'border-stone-700 hover:border-stone-600 bg-stone-900/30'
        }`}
      >
        <input ref={fileRef} type="file" accept="video/*" className="hidden" onChange={(e) => onFile(e.target.files[0])} />
        <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-[#53fc18]/20 to-[#53fc18]/10 border border-[#53fc18]/30 flex items-center justify-center mb-6">
          <Upload className="w-7 h-7 text-[#53fc18]" />
        </div>
        <div className="serif text-3xl mb-2">Drop a file or click to browse</div>
        <div className="text-stone-500 text-sm mono">Up to 4GB · .mp4 · .mov · .webm</div>
      </div>

      <div className="grid md:grid-cols-3 gap-4 mt-10">
        {[
          { icon: Sparkles, t: 'Smart segmentation', d: 'Identifies self-contained moments instead of loud spikes.' },
          { icon: TrendingUp, t: 'Virality scoring', d: 'Each clip gets a 0-100 score with reasoning.' },
          { icon: Zap, t: 'Platform-ready exports', d: 'TikTok, Reels, Shorts, X, auto-cropped and captioned.' },
        ].map((f) => (
          <div key={f.t} className="p-6 rounded-xl border border-stone-800 bg-stone-900/30">
            <f.icon className="w-5 h-5 text-[#53fc18] mb-4" />
            <div className="font-medium mb-1">{f.t}</div>
            <div className="text-sm text-stone-400 leading-relaxed">{f.d}</div>
          </div>
        ))}
      </div>

      {/* Real history — saved across sessions */}
      {history.length > 0 && (
        <div className="mt-10">
          <div className="flex items-center justify-between mb-4">
            <div className="text-xs mono text-stone-500 tracking-wider flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#53fc18]" style={{ boxShadow: '0 0 6px #53fc18' }} />
              YOUR RECENT RUNS · {history.length}
            </div>
            <div className="text-[10px] mono text-stone-600 tracking-wider">SAVED LOCALLY</div>
          </div>
          <div className="space-y-2">
            {history.slice(0, 6).map((run) => (
              <div
                key={run.id}
                className="group flex items-center gap-4 p-4 rounded-xl border border-stone-800 bg-stone-900/30 hover:border-[#53fc18]/30 hover:bg-[#53fc18]/[0.02] transition cursor-pointer"
                onClick={() => onLoadRun && onLoadRun(run)}
              >
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#53fc18]/20 to-[#53fc18]/5 border border-[#53fc18]/20 flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-4 h-4 text-[#53fc18]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-stone-200 truncate font-medium">
                    {run.videoMeta?.name || 'Untitled run'}
                  </div>
                  <div className="text-[11px] mono text-stone-500 tracking-wider mt-0.5">
                    {run.clips?.length || 0} clips · {run.videoMeta?.size ? `${run.videoMeta.size}MB · ` : ''}{relTime(run.createdAt)}{Number.isFinite(run.processedMs) && run.processedMs > 0 ? ` · ${fmtElapsed(run.processedMs)}` : ''}
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirmDelete === run.id) {
                      onDeleteRun && onDeleteRun(run.id);
                      setConfirmDelete(null);
                    } else {
                      setConfirmDelete(run.id);
                      setTimeout(() => setConfirmDelete(null), 3000);
                    }
                  }}
                  className={`text-[10px] mono tracking-wider px-2.5 py-1.5 rounded-md transition opacity-0 group-hover:opacity-100 ${
                    confirmDelete === run.id
                      ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                      : 'text-stone-500 hover:text-red-400 border border-transparent hover:border-red-500/20'
                  }`}
                >
                  {confirmDelete === run.id ? 'CONFIRM' : 'DELETE'}
                </button>
                <ArrowUpRight className="w-4 h-4 text-stone-600 group-hover:text-[#53fc18] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────── ANALYZING */
// Checklist row → pipeline stage key. Now 1:1 with runDemoPipeline's six stages,
// so every row gets an authoritative timestamp the first time the run reaches it
// and the per-row clock reflects real per-stage timing.
const STEP_STAGE = { 0: 'ingest', 1: 'transcribe', 2: 'moments', 3: 'score', 4: 'caption', 5: 'package' };

function fmtElapsed(ms) {
  if (!Number.isFinite(ms) || ms < 0) return '';
  if (ms < 60_000) return (ms / 1000).toFixed(1) + 's';
  const s = Math.floor(ms / 1000);
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}

function AnalyzingView({ progress, step, steps, videoMeta, stageHistory = [], momentsFound = 0 }) {
  // Live clock while mounted so the running stage shows elapsed time. This is a
  // clock, not an animation — under reduced motion the whole run completes in
  // ~0.6s, so it ticks at most once.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  // Client fallbacks for any stage the run hasn't stamped yet.
  const mountedAt = useRef(Date.now());
  const stepStartedAt = useRef(Date.now());
  useEffect(() => { stepStartedAt.current = Date.now(); }, [step]);

  // Parse the synthesized stage_history into a clean, time-sorted list. These are
  // authoritative per-stage timestamps (one per pipeline stage now).
  const hist = (Array.isArray(stageHistory) ? stageHistory : [])
    .map((h) => ({ stage: h && h.stage, ms: Date.parse(h && h.at) }))
    .filter((h) => h.stage && Number.isFinite(h.ms))
    .sort((a, b) => a.ms - b.ms);
  const idxByStage = {};
  hist.forEach((h, i) => { if (!(h.stage in idxByStage)) idxByStage[h.stage] = i; });
  // A stage's duration is the gap to the next recorded stage; the latest recorded
  // stage is still running, so it ticks against `now`.
  const stageDuration = (stage) => {
    const i = idxByStage[stage];
    if (i == null) return null;
    const end = i + 1 < hist.length ? hist[i + 1].ms : now;
    return end - hist[i].ms;
  };
  const t0 = hist.length ? hist[0].ms : mountedAt.current;
  const totalElapsed = fmtElapsed(now - t0);
  const rowTime = (i) => {
    const stage = STEP_STAGE[i];
    const d = stage ? stageDuration(stage) : null;
    if (d != null) return fmtElapsed(d);                          // recorded stage
    if (i === step) return fmtElapsed(now - stepStartedAt.current); // client fallback
    return null;
  };

  // ── Source monitor ──────────────────────────────────────────────────────────
  // Everything below is derived purely from `progress`/`step`/`momentsFound`, so it
  // scrubs in lock-step with the (already-eased) pipeline and needs no second
  // animation loop. Reduced motion is handled upstream by the pipeline's fast path.
  const pct = Math.max(0, Math.min(100, progress));
  const frac = pct / 100;

  // Synthetic transcript that deliberately echoes the clips we ship, so the line
  // scrolling past visibly *becomes* the hooks the user sees in the results grid.
  const TRANSCRIPT = [
    'So', 'the', 'thing', 'nobody', 'tells', 'you', 'about', 'pricing', 'is', 'that',
    'cost-plus', 'is', 'a', 'trap.', 'Most', 'founders', 'get', 'this', 'completely',
    'backwards', '\u2014', 'this', 'next', 'part', 'is', 'completely', 'opposite', 'to',
    'what', 'every', 'thread', 'told', 'us.', 'Steal', 'these', 'three', 'frameworks',
    'I', 'use', 'every', 'day.', 'This', 'is', 'the', 'one', 'thing', 'nobody',
    'warned', 'me', 'about.',
  ];
  const wordCount = TRANSCRIPT.length;
  const activeWord = Math.min(wordCount - 1, Math.floor(frac * wordCount));
  const WINDOW = 9;
  const winStart = Math.max(0, Math.min(wordCount - WINDOW, activeWord - 3));
  const windowWords = TRANSCRIPT.slice(winStart, winStart + WINDOW);

  // Waveform: deterministic per-bar heights with a slow progress-driven shimmer.
  const BARS = 54;
  const playhead = frac; // 0..1 across the strip
  // Where the five moments sit on the source timeline (normalized). A marker lights
  // as the counter climbs past it, so the dots pop in in sync with "moments found".
  const MOMENT_POS = [0.13, 0.31, 0.5, 0.69, 0.86];

  const STEP_ICON = [Film, Mic, Search, TrendingUp, Scissors, Download];
  const STEP_DETAIL = [
    'Reading container & audio track',
    'Aligning words to the waveform',
    'Scanning for hooks, peaks & payoffs',
    'Ranking each candidate by virality',
    'Vertical reframe + burned-in captions',
    'Encoding per-platform deliverables',
  ];

  return (
    <div className="animate-slide-up max-w-3xl mx-auto pt-16">
      <div className="text-center mb-8">
        <div className="text-xs mono text-[#53fc18] mb-3 tracking-wider">→ PROCESSING</div>
        <h1 className="serif text-5xl mb-4">Working through your video</h1>
        <div className="text-stone-500 mono text-sm">{videoMeta?.name} · {videoMeta?.size} MB</div>
      </div>

      {/* Source monitor: scrubbing waveform + transcript + live moments counter */}
      <div className="relative rounded-2xl border border-stone-800 bg-stone-900/40 overflow-hidden mb-6">
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <div className="text-[10px] mono uppercase tracking-[0.2em] text-stone-500 flex items-center gap-2">
            <Loader2 className="w-3 h-3 text-[#53fc18] animate-spin" />
            Scanning source
          </div>
          <div role="status" aria-live="polite" className="flex items-baseline gap-1.5">
            <span
              className="serif text-2xl tabular-nums leading-none transition-colors"
              style={{ color: momentsFound > 0 ? '#53fc18' : '#57534e', textShadow: momentsFound > 0 ? '0 0 14px rgba(83,252,24,0.5)' : 'none' }}
            >
              {momentsFound}
            </span>
            <span className="text-[10px] mono uppercase tracking-wider text-stone-500">moments found</span>
          </div>
        </div>

        <div className="relative px-4 pb-3">
          <div className="relative h-24 flex items-end gap-[2px]">
            {Array.from({ length: BARS }).map((_, j) => {
              const u = j / (BARS - 1);
              const raw = 22 + Math.abs(Math.sin(j * 0.5 + frac * 6)) * 70 * (0.5 + 0.5 * Math.sin(j * 1.7 + 1));
              const h = Math.max(8, Math.min(100, raw));
              const played = u <= playhead;
              const nearHead = Math.abs(u - playhead) < 0.04;
              return (
                <div
                  key={j}
                  className="flex-1 rounded-sm"
                  style={{
                    height: `${h}%`,
                    background: nearHead ? '#aaff66' : played ? '#53fc18' : 'rgba(255,255,255,0.18)',
                    boxShadow: nearHead ? '0 0 8px #53fc18' : 'none',
                    transition: 'background 200ms linear',
                  }}
                />
              );
            })}

            {/* playhead */}
            <div
              className="absolute top-0 bottom-0 w-px bg-[#aaff66]"
              style={{ left: `${playhead * 100}%`, boxShadow: '0 0 10px #53fc18' }}
            />

            {/* moment markers — light up as the counter climbs */}
            {MOMENT_POS.map((mp, i) => {
              const lit = i < momentsFound;
              return (
                <div key={i} className="absolute -top-1" style={{ left: `${mp * 100}%`, transform: 'translateX(-50%)' }}>
                  <div
                    className="rounded-full transition-all"
                    style={{
                      width: lit ? 9 : 5,
                      height: lit ? 9 : 5,
                      background: lit ? '#53fc18' : 'rgba(255,255,255,0.25)',
                      boxShadow: lit ? '0 0 10px #53fc18' : 'none',
                    }}
                  />
                </div>
              );
            })}
          </div>

          {/* transcript line — the active word becomes a hook */}
          <div className="mt-3 h-6 overflow-hidden">
            <div className="flex items-center gap-1.5 whitespace-nowrap text-sm justify-center">
              {windowWords.map((w, k) => {
                const idx = winStart + k;
                const isActive = idx === activeWord;
                const isPast = idx < activeWord;
                return (
                  <span
                    key={idx}
                    className="font-medium transition-all"
                    style={{
                      color: isActive ? '#53fc18' : isPast ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.25)',
                      textShadow: isActive ? '0 0 10px rgba(83,252,24,0.6)' : 'none',
                      transform: isActive ? 'scale(1.06)' : 'scale(1)',
                    }}
                  >
                    {w}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Progress bar — fractional width updated every rAF frame (no transition lag) */}
      <div
        className="clip-pbar relative h-2 rounded-full bg-stone-800 overflow-hidden mb-2"
        style={{ boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.55)' }}
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="clip-pbar-fill" style={{ width: `${pct}%` }}>
          <span className="clip-pbar-sheen" aria-hidden="true" />
          <span className="clip-pbar-edge" aria-hidden="true" />
        </div>
      </div>
      <div className="flex justify-between text-xs mono text-stone-500 mb-8">
        <span>{steps[step]}</span>
        <span className="flex items-center gap-3">
          <span className="text-stone-600 inline-flex items-center gap-1"><Clock className="w-3 h-3" />{totalElapsed}</span>
          <span>{Math.round(pct)}%</span>
        </span>
      </div>

      {/* Step checklist */}
      <div className="space-y-3">
        {steps.map((s, i) => {
          const t = rowTime(i);
          const Icon = STEP_ICON[i] || Sparkles;
          const isActive = i === step;
          const isDone = i < step;
          return (
            <div key={s} className={`flex items-center gap-4 p-4 rounded-xl border transition ${
              isDone ? 'border-stone-800 bg-stone-900/30 text-stone-500' :
              isActive ? 'border-[#53fc18]/40 bg-[#53fc18]/5 text-stone-100' :
              'border-stone-800/60 text-stone-600'
            }`}>
              <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0">
                {isDone ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> :
                 isActive ? <Loader2 className="w-5 h-5 text-[#53fc18] animate-spin" /> :
                 <div className="w-2 h-2 rounded-full bg-stone-700" />}
              </div>
              <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-[#53fc18]' : isDone ? 'text-stone-500' : 'text-stone-700'}`} />
              <div className="flex-1 min-w-0">
                <div className="truncate">{s}</div>
                {isActive && (
                  <div className="text-[11px] mono text-stone-500 mt-0.5 truncate">
                    {STEP_DETAIL[i]}{i === 2 && momentsFound > 0 ? ` \u00b7 ${momentsFound} so far` : ''}
                  </div>
                )}
              </div>
              <div className="text-xs mono tabular-nums">
                {isDone ? (t || 'done') : isActive ? (t ? <span className="text-[#53fc18]">{t}</span> : 'running') : 'queued'}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────── RESULTS */

/* Count-up: animates 0 → target on mount (easeOutCubic, rAF). Reduced motion
   lands on the final value immediately. It only animates toward the real derived
   figure the caller passes in — nothing here invents a number. */
function useCountUp(target, durationMs = 1000) {
  const reduced = prefersReducedMotion();
  const [val, setVal] = useState(reduced ? target : 0);
  useEffect(() => {
    const to = Number(target) || 0;
    if (reduced) { setVal(to); return; }
    let raf, start = null;
    const tick = (t) => {
      if (start == null) start = t;
      const p = Math.min(1, (t - start) / durationMs);
      setVal(to * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick); else setVal(to);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs, reduced]);
  return val;
}

/* Display helper so the headline number can count up without adding a hook to
   ResultsView itself (which returns early for the empty state). */
function StatCountUp({ value, fmt = (n) => Math.round(n), durationMs = 900, className, style }) {
  const v = useCountUp(value, durationMs);
  return <span className={className} style={style}>{fmt(v)}</span>;
}

/* ── Stat micro-visualizations ──────────────────────────────────────
   One shared instrument language across all four stat cards: a thin
   track, fine ruler ticks, data drawn as crisp strokes, and a bright
   dot marking the datum that matters. Dots inside stretched viewBoxes
   are zero-ish-length round-cap path segments with non-scaling stroke,
   so they stay perfectly circular at any card width. */

/* Score distribution — ranked lollipops (stem + dot per clip), with a
   dashed reference line at the batch average. */
function ScoreSpark({ scores }) {
  const n = scores.length;
  const X = (i) => (n > 1 ? 5 + (i / (n - 1)) * 90 : 50);
  const Y = (s) => 30 - (s / 100) * 24;
  const avg = scores.reduce((a, b) => a + b, 0) / Math.max(1, n);
  return (
    <svg viewBox="0 0 100 36" preserveAspectRatio="none" className="w-full h-9 block" aria-hidden="true">
      <line x1="0" y1="31" x2="100" y2="31" stroke="rgba(255,255,255,0.10)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      <line x1="0" y1={Y(avg)} x2="100" y2={Y(avg)} stroke="rgba(255,255,255,0.18)" strokeWidth="1" strokeDasharray="1.5 2.5" vectorEffect="non-scaling-stroke" />
      {scores.map((s, i) => {
        const col = s >= 90 ? '#34d399' : s >= 80 ? '#53fc18' : '#fbbf24';
        const x = X(i);
        const y = Y(s);
        return (
          <g key={i}>
            <rect x={x - 1.7} y={y} width="3.4" height={31 - y} fill={col} opacity="0.12" />
            <line x1={x} y1="31" x2={x} y2={y} stroke={col} strokeOpacity="0.55" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
            <path d={`M ${x} ${y} l 0.01 0`} stroke={col} strokeWidth="5" strokeLinecap="round" vectorEffect="non-scaling-stroke" style={{ filter: `drop-shadow(0 0 3px ${col}99)` }} />
          </g>
        );
      })}
    </svg>
  );
}

/* Runtime composition — each clip's true share of the batch on a thin
   track, boundary ticks between cuts, and the real seconds labelled
   under each segment. */
function RuntimeSpark({ durations }) {
  const total = durations.reduce((s, d) => s + d, 0) || 1;
  let acc = 0;
  const segs = durations.map((d) => {
    const a = (acc / total) * 100;
    acc += d;
    return [a, (acc / total) * 100, d];
  });
  return (
    <svg width="100%" height="36" className="block" aria-hidden="true">
      <line x1="0%" y1="14" x2="100%" y2="14" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
      {segs.map(([a, b, d], i) => (
        <g key={i}>
          <line
            x1={`${a + 0.9}%`} y1="14" x2={`${Math.max(a + 0.9, b - 0.9)}%`} y2="14"
            stroke="#53fc18" strokeOpacity={i % 2 ? 0.5 : 0.9} strokeWidth="3.5" strokeLinecap="round"
            style={{ filter: 'drop-shadow(0 0 3px rgba(83,252,24,0.35))' }}
          />
          {i < segs.length - 1 && (
            <line x1={`${b}%`} y1="9" x2={`${b}%`} y2="19" stroke="rgba(255,255,255,0.14)" strokeWidth="1" />
          )}
          <text x={`${(a + b) / 2}%`} y="31" textAnchor="middle" className="mono" fill="#57534e" style={{ fontSize: 8 }}>
            {d}s
          </text>
        </g>
      ))}
    </svg>
  );
}

/* Reach build-up — cumulative projected reach per clip, smallest first,
   so the curve always climbs to the headline number (marked by the end
   dot). Faint gridlines keep it reading as a chart, not a decoration. */
function ReachSpark({ values }) {
  const sorted = [...values].sort((a, b) => a - b);
  let acc = 0;
  const cum = sorted.map((v) => (acc += v));
  const max = cum[cum.length - 1] || 1;
  const n = cum.length;
  const pts = [[0, 33], ...cum.map((v, i) => [((i + 1) / n) * 100, 33 - (v / max) * 27])];
  const line = pts.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
  const [ex, ey] = pts[pts.length - 1];
  return (
    <svg viewBox="0 0 100 36" preserveAspectRatio="none" className="w-full h-9 block" aria-hidden="true">
      <defs>
        <linearGradient id="reachFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#53fc18" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#53fc18" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[13, 23].map((y) => (
        <line key={y} x1="0" y1={y} x2="100" y2={y} stroke="rgba(255,255,255,0.06)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      ))}
      <line x1="0" y1="33" x2="100" y2="33" stroke="rgba(255,255,255,0.10)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      <polygon points={`0,33 ${line} 100,33`} fill="url(#reachFill)" />
      <polyline
        points={line} fill="none" stroke="#53fc18" strokeWidth="1.5"
        strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke"
        style={{ filter: 'drop-shadow(0 0 3px rgba(83,252,24,0.7))' }}
      />
      {pts.slice(1, -1).map(([x, y], i) => (
        <path
          key={i} d={`M ${x.toFixed(2)} ${y.toFixed(2)} l 0.01 0`} stroke="#53fc18" strokeWidth="3"
          strokeLinecap="round" vectorEffect="non-scaling-stroke"
          style={{ filter: 'drop-shadow(0 0 3px rgba(83,252,24,0.7))' }}
        />
      ))}
      <path
        d={`M ${ex.toFixed(2)} ${ey.toFixed(2)} l 0.01 0`} stroke="#aaff66" strokeWidth="4.5" strokeLinecap="round"
        vectorEffect="non-scaling-stroke" style={{ filter: 'drop-shadow(0 0 4px rgba(83,252,24,0.9))' }}
      />
    </svg>
  );
}

/* A neon stat tile: icon chip, count-up value, hover glow, and a data-derived
   micro-visualization passed in as `m.viz`. Boots in staggered: tile rises,
   viz wipes on like a plotter, and the value flashes as its count-up lands.
   Hover gets the same cursor-tracking spotlight as the clip cards. */
function StatCard({ m, index }) {
  const shown = useCountUp(m.raw, 900 + index * 110);
  const [hot, setHot] = useState(false);
  const ref = useRef(null);
  const d = 150 + index * 90; // entrance stagger (ms)
  const onMove = (e) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${(((e.clientX - r.left) / r.width) * 100).toFixed(2)}%`);
    el.style.setProperty('--my', `${(((e.clientY - r.top) / r.height) * 100).toFixed(2)}%`);
  };
  return (
    <div
      ref={ref}
      onMouseEnter={() => setHot(true)}
      onMouseLeave={() => setHot(false)}
      onMouseMove={onMove}
      className="spot-host stat-enter tilt-card group relative p-5 rounded-xl border bg-stone-900/30 overflow-hidden transition-all duration-300"
      style={{
        animationDelay: `${d}ms`,
        borderColor: hot ? 'rgba(83,252,24,0.28)' : 'rgba(255,255,255,0.09)',
        boxShadow: hot ? '0 14px 38px -22px rgba(83,252,24,0.4)' : 'none',
      }}
    >
      <span aria-hidden className="panel-grid" />
      <span aria-hidden className="clip-spot" />
      <span aria-hidden className="clip-ring" />
      <span aria-hidden className="absolute inset-x-0 top-0 h-px" style={{
        background: 'linear-gradient(90deg, transparent, rgba(83,252,24,0.75), transparent)',
        opacity: hot ? 1 : 0.35, transition: 'opacity .3s',
      }} />
      <span aria-hidden className="absolute -top-12 -right-10 w-28 h-28 rounded-full pointer-events-none" style={{
        background: 'radial-gradient(circle, rgba(83,252,24,0.16), transparent 70%)',
        opacity: hot ? 1 : 0, transition: 'opacity .35s',
      }} />
      <div className="relative flex items-center justify-between mb-3">
        <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-[#53fc18]/25 bg-[#53fc18]/[0.06]">
          <m.icon className="w-4 h-4 text-[#53fc18]" />
        </span>
        {m.tag && <span className="text-[9px] mono uppercase tracking-[0.16em] text-stone-600">{m.tag}</span>}
      </div>
      <div className="relative text-xs mono text-stone-500 mb-1">{m.l}</div>
      <div className="relative flex items-baseline gap-1 mb-3">
        <span
          className="val-lock serif text-3xl tabular-nums"
          style={{ animationDelay: `${d + 900 + index * 110}ms`, textShadow: '0 0 22px rgba(83,252,24,0.18)' }}
        >
          {m.fmt(shown)}
        </span>
        <span className="text-xs text-stone-500">{m.s}</span>
      </div>
      <div className="viz-reveal relative" style={{ animationDelay: `${d + 280}ms` }}>{m.viz}</div>
    </div>
  );
}

/* A labelled ruler-meter: tick scale every 5%, thin track, and a round-cap
   fill drawn in via pathLength dash-offset (same mechanic as the gauge),
   landing a bright head dot at the value. Value is a real per-signal average. */
function Meter({ label, value, delay }) {
  const reduced = prefersReducedMotion();
  const [on, setOn] = useState(reduced);
  useEffect(() => {
    if (reduced) { setOn(true); return; }
    const id = requestAnimationFrame(() => setOn(true));
    return () => cancelAnimationFrame(id);
  }, [reduced]);
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-stone-400">{label}</span>
        <StatCountUp value={value} durationMs={1000 + delay} className="text-xs mono text-[#53fc18] tabular-nums" />
      </div>
      <svg width="100%" height="15" className="block" aria-hidden="true">
        {Array.from({ length: 21 }, (_, i) => (
          <line
            key={i} x1={`${i * 5}%`} y1={i % 2 ? 9.5 : 7.5} x2={`${i * 5}%`} y2="12"
            stroke={i * 5 <= value ? 'rgba(83,252,24,0.4)' : 'rgba(255,255,255,0.12)'} strokeWidth="1"
          />
        ))}
        <line x1="0%" y1="5" x2="100%" y2="5" stroke="rgba(255,255,255,0.08)" strokeWidth="2" />
        <line
          x1="0%" y1="5" x2="100%" y2="5" stroke="#53fc18" strokeWidth="3" strokeLinecap="round"
          pathLength="100" strokeDasharray={`${value} 100`} strokeDashoffset={on ? 0 : value}
          style={{
            transition: 'stroke-dashoffset 1s cubic-bezier(.16,1,.3,1)',
            transitionDelay: `${delay}ms`,
            filter: 'drop-shadow(0 0 3px rgba(83,252,24,0.45))',
          }}
        />
        <circle
          cx={`${value}%`} cy="5" r="2.8" fill="#aaff66" className="meter-dot"
          style={{
            opacity: on ? 1 : 0,
            transition: 'opacity .4s ease',
            transitionDelay: `${delay + 750}ms`,
            filter: 'drop-shadow(0 0 4px rgba(83,252,24,0.9))',
          }}
        />
      </svg>
    </div>
  );
}

/* Engagement radar — the three real signal averages plotted as a triangle.
   Rings at 33/66/100, spokes per axis, value polygon scales in with glowing
   vertex dots. Fixed-aspect SVG so the tiny labels never distort. */
function EngagementRadar({ profile }) {
  const C = [60, 58], R = 42;
  const A = [-90, 30, 150].map((d) => (d * Math.PI) / 180);
  const pt = (ai, f) => [C[0] + Math.cos(A[ai]) * R * f, C[1] + Math.sin(A[ai]) * R * f];
  const ring = (f) => A.map((_, i) => pt(i, f).map((n) => n.toFixed(1)).join(',')).join(' ');
  const poly = profile.map((p, i) => pt(i, Math.max(0, Math.min(100, p.v)) / 100));
  const labels = [
    { t: 'HOOK', x: C[0], y: 9, anchor: 'middle' },
    { t: 'RETAIN', x: C[0] + Math.cos(A[1]) * (R + 7), y: C[1] + Math.sin(A[1]) * (R + 7) + 7, anchor: 'middle' },
    { t: 'SHARE', x: C[0] + Math.cos(A[2]) * (R + 7), y: C[1] + Math.sin(A[2]) * (R + 7) + 7, anchor: 'middle' },
  ];
  return (
    <svg viewBox="0 0 120 110" className="block w-[104px] h-[96px]" aria-hidden="true">
      {[0.33, 0.66, 1].map((f) => (
        <polygon key={f} points={ring(f)} fill="none" stroke="rgba(255,255,255,0.09)" strokeWidth="1" />
      ))}
      {A.map((_, i) => {
        const [x, y] = pt(i, 1);
        return <line key={i} x1={C[0]} y1={C[1]} x2={x} y2={y} stroke="rgba(255,255,255,0.07)" strokeWidth="1" />;
      })}
      <g className="radar-in" style={{ animationDelay: '880ms' }}>
        <polygon
          points={poly.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')}
          fill="rgba(83,252,24,0.15)" stroke="#53fc18" strokeWidth="1.5" strokeLinejoin="round"
          style={{ filter: 'drop-shadow(0 0 5px rgba(83,252,24,0.5))' }}
        />
        {poly.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="2.1" fill="#aaff66" style={{ filter: 'drop-shadow(0 0 4px rgba(83,252,24,0.9))' }} />
        ))}
      </g>
      {labels.map((l) => (
        <text key={l.t} x={l.x} y={l.y} textAnchor={l.anchor} className="mono" fill="#57534e" style={{ fontSize: 7, letterSpacing: '0.12em' }}>
          {l.t}
        </text>
      ))}
    </svg>
  );
}

/* Source map — the waveform becomes a map of the recording. A synthesized
   (deterministic, decorative) audio signature draws in mirrored around the
   centerline, then the *real* extracted clip regions land on it as glowing
   bands placed by each clip's true timestamps against the source length.
   Hovering a band reads out which clip was cut there. */
function ResultsWave({ totalSec, sourceEnd, clips = [] }) {
  const [hov, setHov] = useState(null);
  const { top, bottom, body } = useMemo(() => {
    const N = 160, t = [], b = [];
    for (let i = 0; i <= N; i++) {
      const x = ((i / N) * 1200).toFixed(1);
      const env = Math.pow(Math.sin((i / N) * Math.PI), 0.6); // fade at both edges
      const a =
        Math.abs(Math.sin(i * 0.43) * 13 + Math.sin(i * 0.117 + 1.7) * 9 + Math.sin(i * 0.95 + 0.4) * 4) * env + 1.2;
      t.push(`${x},${(40 - a).toFixed(1)}`);
      b.push(`${x},${(40 + a * 0.78).toFixed(1)}`);
    }
    return { top: t.join(' '), bottom: b.join(' '), body: `M ${t.join(' L ')} L ${[...b].reverse().join(' L ')} Z` };
  }, []);

  // Real clip regions, positioned by timestamp against the source length.
  const len = Number.isFinite(sourceEnd) && sourceEnd > 0 ? sourceEnd : 0;
  const regions = len
    ? clips
        .map((c, i) => {
          const [s, e] = String(c.timestamp || '').split('-').map((p) => parseClock(p));
          if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s) return null;
          const x1 = (s / len) * 1200;
          const x2 = Math.max(x1 + 14, (e / len) * 1200);
          return { i, x1, x2, c };
        })
        .filter(Boolean)
    : [];

  return (
    <div aria-hidden className="relative -mt-4 mb-10 select-none">
      <div className="relative overflow-hidden">
        <svg viewBox="0 0 1200 80" preserveAspectRatio="none" className="block w-full h-16">
        <defs>
          <linearGradient id="rwStroke" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#53fc18" stopOpacity="0" />
            <stop offset="16%" stopColor="#53fc18" stopOpacity="0.85" />
            <stop offset="52%" stopColor="#aaff66" stopOpacity="1" />
            <stop offset="84%" stopColor="#53fc18" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#53fc18" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="rwBody" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#53fc18" stopOpacity="0.13" />
            <stop offset="50%" stopColor="#53fc18" stopOpacity="0.05" />
            <stop offset="100%" stopColor="#53fc18" stopOpacity="0.11" />
          </linearGradient>
          <linearGradient id="rwRegion" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#53fc18" stopOpacity="0.22" />
            <stop offset="55%" stopColor="#53fc18" stopOpacity="0.05" />
            <stop offset="100%" stopColor="#53fc18" stopOpacity="0.14" />
          </linearGradient>
        </defs>
        <line x1="0" y1="40" x2="1200" y2="40" stroke="rgba(255,255,255,0.07)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        {/* Mirrored audio body fades in beneath the lead traces. */}
        <path className="wave-fill-in" d={body} fill="url(#rwBody)" />
        {/* Extracted clip regions — real cut positions on the source. */}
        {regions.map(({ i, x1, x2 }) => (
          <g key={i} className="region-in" style={{ animationDelay: `${2.25 + i * 0.13}s` }}>
            <rect
              x={x1} y={6} width={x2 - x1} height={68} rx={2}
              fill="url(#rwRegion)" opacity={hov === i ? 1 : 0.66}
              style={{ transition: 'opacity .25s ease', cursor: 'crosshair' }}
              pointerEvents="auto"
              onMouseEnter={() => setHov(i)}
              onMouseLeave={() => setHov(null)}
            />
            <line x1={x1} y1={6} x2={x1} y2={74} stroke="#53fc18" strokeOpacity={hov === i ? 0.9 : 0.45} strokeWidth="1" vectorEffect="non-scaling-stroke" style={{ transition: 'stroke-opacity .25s ease' }} />
            <line x1={x2} y1={6} x2={x2} y2={74} stroke="#53fc18" strokeOpacity={hov === i ? 0.9 : 0.45} strokeWidth="1" vectorEffect="non-scaling-stroke" style={{ transition: 'stroke-opacity .25s ease' }} />
          </g>
        ))}
        <polyline
          className="wave-draw"
          points={top}
          pathLength="1"
          fill="none"
          stroke="url(#rwStroke)"
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          style={{ filter: 'drop-shadow(0 0 6px rgba(83,252,24,0.55))' }}
        />
        <polyline
          className="wave-draw"
          points={bottom}
          pathLength="1"
          fill="none"
          stroke="#53fc18"
          strokeOpacity="0.35"
          strokeWidth="1"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
        {/* Rank labels above each extracted region (HTML so glyphs never stretch). */}
        {regions.map(({ i, x1, x2 }) => (
          <span
            key={i}
            className="region-in absolute top-0.5 -translate-x-1/2 text-[9px] mono tabular-nums pointer-events-none"
            style={{
              left: `${(((x1 + x2) / 2) / 1200) * 100}%`,
              color: hov === i ? '#aaff66' : 'rgba(134,239,172,0.55)',
              textShadow: hov === i ? '0 0 8px rgba(83,252,24,0.8)' : 'none',
              transition: 'color .25s ease',
              animationDelay: `${2.25 + i * 0.13}s`,
            }}
          >
            {String(i + 1).padStart(2, '0')}
          </span>
        ))}
        {/* Scan-head: a bright vertical beam + soft trail that leads the draw. */}
        <span className="wave-scan" />
        {/* …then a faint radar-style rescan keeps drifting across. */}
        <span className="wave-rescan" />
      </div>
      <div className="flex items-center justify-between mt-1 text-[9px] mono tracking-[0.18em] text-stone-600 uppercase">
        <span>0:00</span>
        {hov != null && clips[hov] ? (
          <span className="text-[#53fc18] normal-case tracking-[0.12em]" style={{ textShadow: '0 0 10px rgba(83,252,24,0.4)' }}>
            №{String(hov + 1).padStart(2, '0')} · {clips[hov].title} · {clips[hov].duration}s · {clips[hov].timestamp}
          </span>
        ) : (
          <span className="text-stone-700">· source waveform · {regions.length ? `${regions.length} segments extracted` : 'analyzed'}</span>
        )}
        <span>{fmtClock(len || totalSec)}</span>
      </div>
    </div>
  );
}

function ResultsView({ clips, onSelect, onReset, videoMeta, processedMs, bookCall }) {
  const [sort, setSort] = useState('virality');
  const [busy, setBusy] = useState(null); // simulated packaging state (demo)

  // Empty state — parity with production (unreachable with the seeded demo data).
  if (!clips.length) {
    return (
      <div className="animate-slide-up max-w-2xl mx-auto pt-16 text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl border border-stone-700 bg-stone-900/40 mb-6">
          <Film className="w-7 h-7 text-stone-500" />
        </div>
        <div className="text-xs mono text-stone-500 mb-3 tracking-wider">→ NO CLIPS FOUND</div>
        <h1 className="serif text-5xl mb-4">Nothing clippable this time</h1>
        <p className="text-stone-400 mb-8">
          We analyzed {videoMeta?.name ? <span className="mono text-stone-300">{videoMeta.name}</span> : 'your video'} but
          didn’t find moments that clear the bar. Longer, conversational source video tends to yield the best clips.
        </p>
        <button onClick={onReset} className="btn-neon px-5 py-3 rounded-lg font-medium">
          Replay sample
        </button>
      </div>
    );
  }

  const sorted = [...clips].sort((a, b) =>
    sort === 'virality' ? clipScore(b) - clipScore(a) : (a.duration || 0) - (b.duration || 0));

  // Real, derived stats (no hardcoded numbers) — mirrors production.
  const scores = clips.map(clipScore);
  const durations = clips.map((c) => c.duration || 0);
  const avg = Math.round(scores.reduce((s, n) => s + n, 0) / scores.length);
  const top = Math.max(...scores);
  const totalSec = durations.reduce((s, d) => s + d, 0);
  // Latest cut-point across the batch ≈ usable length of the source recording;
  // drives each card's mini source-timeline.
  const sourceEnd = Math.max(0, ...clips.map((c) => parseClock(String(c.timestamp || '').split('-')[1])).filter(Number.isFinite));
  const reachParts = clips.map((c) => Math.pow(clipScore(c) / 100, 2) * 60000);
  const totalReach = reachParts.reduce((s, n) => s + n, 0);

  // Best clip (for the top-score card label) + sorted distribution for the spark.
  const topClip = clips.reduce((b, c) => (clipScore(c) > clipScore(b) ? c : b), clips[0]);
  const distScores = [...scores].sort((a, b) => b - a);

  // Engagement profile — averages across each clip's real per-signal scores.
  const eng = clips.map((c) => c.engagement).filter(Boolean);
  const engAvg = (k) => (eng.length ? Math.round(eng.reduce((s, e) => s + (e[k] || 0), 0) / eng.length) : 0);
  const profile = [
    { k: 'Hook strength', v: engAvg('hook') },
    { k: 'Retention', v: engAvg('retention') },
    { k: 'Shareability', v: engAvg('shareability') },
  ];

  // Signals detected — the reason tags the scorer attached, counted across clips.
  const signalCount = {};
  clips.forEach((c) => (c.reasons || []).forEach((r) => { signalCount[r] = (signalCount[r] || 0) + 1; }));
  const signals = Object.entries(signalCount).sort((a, b) => b[1] - a[1]);

  // Platform coverage across the whole batch.
  const platformSet = Array.from(new Set(clips.flatMap((c) => c.platforms || [])));

  const stats = [
    {
      l: 'Avg virality', raw: avg, fmt: (n) => Math.round(n), s: '/100', icon: Flame,
      tag: `${clips.length} clips`, viz: <ScoreSpark scores={distScores} />,
    },
    {
      l: 'Top score', raw: top, fmt: (n) => Math.round(n), s: '/100', icon: TrendingUp, tag: 'best',
      viz: (
        <div>
          {/* 0–100 ruler: ticks every 10, lit up to the score; marker dot at the score. */}
          <svg width="100%" height="18" className="block" aria-hidden="true">
            {Array.from({ length: 11 }, (_, i) => (
              <line
                key={i} x1={`${i * 10}%`} y1={i % 5 ? 10 : 7.5} x2={`${i * 10}%`} y2="14"
                stroke={i * 10 <= top ? 'rgba(83,252,24,0.45)' : 'rgba(255,255,255,0.14)'} strokeWidth="1"
              />
            ))}
            <line x1="0%" y1="5" x2="100%" y2="5" stroke="rgba(255,255,255,0.08)" strokeWidth="2" />
            <line
              x1="0%" y1="5" x2={`${top}%`} y2="5" stroke="#53fc18" strokeWidth="3" strokeLinecap="round"
              style={{ filter: 'drop-shadow(0 0 3px rgba(83,252,24,0.5))' }}
            />
            <circle cx={`${top}%`} cy="5" r="3" fill="#aaff66" style={{ filter: 'drop-shadow(0 0 4px rgba(83,252,24,0.9))' }} />
          </svg>
          <div className="mt-1.5 text-[10px] mono text-stone-600 truncate" title={topClip?.title}>↑ {topClip?.title}</div>
        </div>
      ),
    },
    {
      l: 'Total runtime', raw: totalSec, fmt: (n) => fmtClock(n), s: 'min:sec', icon: Clock,
      tag: `avg ${Math.round(totalSec / clips.length)}s`, viz: <RuntimeSpark durations={durations} />,
    },
    {
      l: 'Est. reach', raw: totalReach, fmt: (n) => fmtCompact(n), s: 'projected', icon: Users,
      tag: `${platformSet.length} platforms`, viz: <ReachSpark values={reachParts} />,
    },
  ];

  // Demo-only: the live app streams a real store-only .zip of rendered clips.
  const downloadAll = () => {
    if (busy) return;
    setBusy('Packaging zip…');
    setTimeout(() => setBusy(null), 1200);
  };

  return (
    <div className="animate-slide-up">
      <div className="flex flex-wrap items-baseline justify-between gap-4 mb-2">
        <div>
          <div className="text-xs mono text-emerald-400 mb-2 tracking-wider flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5" /> ANALYSIS COMPLETE
          </div>
          <h1 className="serif text-5xl tracking-tight">
            <span className="relative inline-block">
              <span aria-hidden className="head-ping" />
              <StatCountUp value={clips.length} className="relative text-[#53fc18] tabular-nums" style={{ textShadow: '0 0 26px rgba(83,252,24,0.55)' }} />
            </span>{' '}
            {clips.length === 1 ? 'clip' : 'clips'} <span className="italic gradient-green">ready to ship</span>
          </h1>
        </div>
        <button onClick={onReset} className="text-sm text-stone-400 hover:text-stone-100 mono">
          ↻ Replay sample
        </button>
      </div>
      <p className="text-stone-500 mb-10">From <span className="mono text-stone-300">{videoMeta?.name || 'your video'}</span> · ranked by viral potential{Number.isFinite(processedMs) && processedMs > 0 ? <> · processed in <span className="mono text-stone-300">{fmtElapsed(processedMs)}</span></> : ''}</p>

      <ResultsWave totalSec={totalSec} sourceEnd={sourceEnd} clips={clips} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        {stats.map((m, i) => (
          <StatCard key={m.l} m={m} index={i} />
        ))}
      </div>

      <div className="grid md:grid-cols-5 gap-4 mb-10">
        {/* Engagement profile — real per-signal averages across the batch. */}
        <div className="vf-corners stat-enter tilt-card relative md:col-span-2 p-5 rounded-xl border border-stone-800 bg-stone-900/30 overflow-hidden" style={{ animationDelay: '540ms' }}>
          <span aria-hidden className="panel-grid" />
          <span aria-hidden className="absolute inset-x-0 top-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(83,252,24,0.6), transparent)' }} />
          <div className="relative flex items-center gap-2 mb-4">
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg border border-[#53fc18]/25 bg-[#53fc18]/[0.06]">
              <Zap className="w-3.5 h-3.5 text-[#53fc18]" />
            </span>
            <span className="text-xs mono text-stone-400 tracking-wider">ENGAGEMENT PROFILE</span>
          </div>
          <div className="relative flex items-center gap-5">
            <div className="hidden sm:block shrink-0">
              <EngagementRadar profile={profile} />
            </div>
            <div className="flex-1 min-w-0 space-y-3.5">
              {profile.map((p, i) => (
                <Meter key={p.k} label={p.k} value={p.v} delay={620 + i * 160} />
              ))}
            </div>
          </div>
        </div>

        {/* Signals detected — the scorer's real reason tags, counted across clips. */}
        <div className="vf-corners stat-enter tilt-card relative md:col-span-3 p-5 rounded-xl border border-stone-800 bg-stone-900/30 overflow-hidden" style={{ animationDelay: '640ms' }}>
          <span aria-hidden className="panel-grid" />
          <span aria-hidden className="absolute inset-x-0 top-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(83,252,24,0.6), transparent)' }} />
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg border border-[#53fc18]/25 bg-[#53fc18]/[0.06]">
                <Sparkles className="w-3.5 h-3.5 text-[#53fc18]" />
              </span>
              <span className="text-xs mono text-stone-400 tracking-wider">SIGNALS DETECTED</span>
            </div>
            <span className="text-[10px] mono text-stone-600">{signals.length} types</span>
          </div>
          <div className="flex flex-wrap gap-2 mb-5">
            {signals.map(([name, count]) => (
              <span key={name} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-[#53fc18]/25 bg-[#53fc18]/[0.05] text-xs text-stone-200">
                <span className="w-1.5 h-1.5 rounded-full bg-[#53fc18]" style={{ boxShadow: '0 0 6px rgba(83,252,24,0.9)' }} />
                {name}
                {count > 1 && <span className="mono text-[10px] text-[#53fc18]">×{count}</span>}
              </span>
            ))}
          </div>
          <div className="pt-4 border-t border-stone-800/80">
            <div className="flex items-center gap-2 mb-2.5">
              <Globe className="w-3.5 h-3.5 text-stone-500" />
              <span className="text-[10px] mono text-stone-500 tracking-wider uppercase">Formatted for</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {platformSet.map((p) => (
                <span key={p} className="px-2.5 py-1 rounded-md border border-stone-700 bg-stone-800/40 text-[11px] mono text-stone-300">
                  {p}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <span className="text-xs mono text-stone-500">SORT</span>
        {['virality', 'duration'].map((k) => (
          <button key={k} onClick={() => setSort(k)} className={`px-3 py-1.5 rounded-md text-xs mono transition ${
            sort === k ? 'bg-stone-100 text-stone-950' : 'text-stone-400 hover:text-stone-100'
          }`}>
            {k}
          </button>
        ))}
        <div className="flex-1" />
        <span className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[#53fc18]/40 bg-[#53fc18]/[0.06] text-[#53fc18] text-xs mono">
          <span className="relative flex w-1.5 h-1.5">
            <span className="motion-safe:animate-ping absolute inline-flex w-full h-full rounded-full bg-[#53fc18] opacity-60" />
            <span className="relative inline-flex w-1.5 h-1.5 rounded-full bg-[#53fc18]" style={{ boxShadow: '0 0 6px rgba(83,252,24,0.9)' }} />
          </span>
          <CheckCircle2 className="w-3.5 h-3.5" />
          Editor-reviewed · delivered to your queue
        </span>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {sorted.map((clip, i) => (
          <ClipCard key={clip.id} clip={clip} rank={i + 1} onSelect={() => onSelect(clip)} sourceEnd={sourceEnd} />
        ))}
      </div>

      <div className="vf-corners relative overflow-hidden mt-12 rounded-2xl border border-[#53fc18]/30 bg-gradient-to-br from-[#53fc18]/[0.07] to-transparent p-8 text-center">
        {/* Decorative concentric rings — anchor the panel's corners */}
        <svg aria-hidden viewBox="0 0 200 200" fill="none" className="absolute -right-16 -top-20 w-72 h-72 pointer-events-none" style={{ opacity: 0.22 }}>
          <circle cx="100" cy="100" r="34" stroke="#53fc18" strokeOpacity="0.55" strokeWidth="1" />
          <circle cx="100" cy="100" r="58" stroke="#53fc18" strokeOpacity="0.35" strokeWidth="1" strokeDasharray="2 7" />
          <circle cx="100" cy="100" r="82" stroke="#53fc18" strokeOpacity="0.22" strokeWidth="1" />
          <circle cx="100" cy="100" r="2.5" fill="#53fc18" fillOpacity="0.7" />
        </svg>
        <svg aria-hidden viewBox="0 0 200 200" fill="none" className="absolute -left-20 -bottom-24 w-64 h-64 pointer-events-none" style={{ opacity: 0.14 }}>
          <circle cx="100" cy="100" r="46" stroke="#53fc18" strokeOpacity="0.5" strokeWidth="1" strokeDasharray="2 7" />
          <circle cx="100" cy="100" r="78" stroke="#53fc18" strokeOpacity="0.28" strokeWidth="1" />
        </svg>

        <div className="relative">
          <div className="text-xs mono text-[#53fc18] mb-3 tracking-wider">→ THIS IS A SAMPLE</div>
          <h2 className="serif text-3xl tracking-tight mb-3">This is a sample of what we'd deliver from a single recording.</h2>
          <p className="text-stone-400 max-w-xl mx-auto mb-7">
            Your account team handles the whole pipeline: strategy, editing, and review. Finished clips land in your queue. No tools to learn.
          </p>
          <button
            onClick={bookCall}
            className="btn-neon cta-glow magnetic-glow group px-6 py-3 rounded-lg font-medium inline-flex items-center gap-2"
          >
            Book a demo
            <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function ClipFrame({ clip, rank, className = '' }) {
  const lines = Array.isArray(clip.onScreenText) ? clip.onScreenText.slice(0, 3) : [];
  const platforms = clip.platforms || [];
  const BARS = 16;
  return (
    <div className={`relative aspect-[9/16] w-full bg-black overflow-hidden ${className}`}>
        <div className={`absolute inset-0 bg-gradient-to-br ${CLIP_GRADIENTS[clip.thumbnail] || CLIP_GRADIENTS['gradient-1']} opacity-25`} />
        <div
          className="absolute inset-0"
          style={{ background: 'radial-gradient(ellipse at 30% 35%, rgba(83,252,24,0.18), transparent 60%), radial-gradient(ellipse at 70% 65%, rgba(150,80,200,0.14), transparent 60%)' }}
        />
        <div className="absolute inset-0 bg-black/30" />

        <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-sm text-[9px] mono text-white/90 leading-none">
          {String(rank).padStart(2, '0')}
        </div>
        {platforms[0] && (
          <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/55 backdrop-blur-sm text-[9px] mono text-[#53fc18] leading-none">
            {platforms[0]}
          </div>
        )}

        <div className="absolute left-0 right-0 top-[38%] -translate-y-1/2 flex items-center justify-center gap-[2px] px-3 h-12">
          {Array.from({ length: BARS }).map((_, j) => {
            const h = 24 + Math.abs(Math.sin(j * 0.7 + clip.id)) * 60;
            const lit = j < BARS * 0.55;
            return (
              <span
                key={j}
                className="w-[2px] rounded-full"
                style={{
                  height: `${h}%`,
                  background: lit ? 'rgba(83,252,24,0.85)' : 'rgba(255,255,255,0.25)',
                  boxShadow: lit ? '0 0 4px rgba(83,252,24,0.55)' : 'none',
                }}
              />
            );
          })}
        </div>

        <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="w-9 h-9 rounded-full bg-black/35 backdrop-blur-md flex items-center justify-center opacity-0 group-hover/pv:opacity-100 transition">
            <Play className="w-4 h-4 text-white fill-white ml-0.5" />
          </span>
        </span>

        {lines.length > 0 && (
          <div className="absolute left-1.5 right-1.5 bottom-7 flex flex-col items-center gap-0.5 text-center">
            {lines.map((t, i) => (
              <span
                key={i}
                className="font-bold leading-tight text-[11px] sm:text-xs"
                style={{
                  color: i === lines.length - 1 ? '#53fc18' : '#ffffff',
                  textShadow:
                    i === lines.length - 1
                      ? '0 0 10px rgba(83,252,24,0.7), 0 2px 4px rgba(0,0,0,0.85)'
                      : '0 2px 4px rgba(0,0,0,0.85)',
                }}
              >
                {t}
              </span>
            ))}
          </div>
        )}

        <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/65 backdrop-blur-sm text-[9px] mono text-white/90 leading-none">
          {fmtClock(clip.duration)}
        </div>
        <div className="absolute bottom-1.5 left-1.5 text-[7px] mono tracking-wider text-white/40 leading-none">
          CLIPPER.AI
        </div>
    </div>
  );
}

/* Parse "12:34" → seconds. Returns NaN on anything unexpected so callers can fall back. */
const parseClock = (s) => {
  const m = /^(\d+):(\d{2})$/.exec(String(s || '').trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : NaN;
};

/* ScoreGauge — a 270° instrument-style gauge built from real SVG paths.
   Geometry: 64×64 viewBox, center (32,32). The sweep opens at the bottom
   (135° → 405° in screen coords, y-down, clockwise), which leaves a natural
   gap for the VIRALITY micro-label. The number is SVG <text> with
   textAnchor=middle + dominantBaseline=central, so it is centered by the
   renderer itself — no flexbox/baseline guesswork (this fixes the optical
   drift the old HTML-overlay number had).
   Layers, back to front: tinted disc · track arc · tick ring (lit portion
   tinted) · gradient progress arc (pathLength=100, dash-offset draw-in) ·
   head dot at the arc tip · number + label. Reduced motion renders settled. */
const GAUGE_START = 135;
const GAUGE_SWEEP = 270;
const gaugePt = (r, deg) => {
  const a = (deg * Math.PI) / 180;
  return [32 + r * Math.cos(a), 32 + r * Math.sin(a)];
};
const gaugeArc = (r, fromDeg, toDeg) => {
  const [x0, y0] = gaugePt(r, fromDeg);
  const [x1, y1] = gaugePt(r, toDeg);
  const large = toDeg - fromDeg > 180 ? 1 : 0;
  return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
};
function ScoreGauge({ score, gid }) {
  const tone = scoreTone(score);
  const color = score >= 90 ? '#34d399' : score >= 80 ? '#53fc18' : '#fbbf24';
  const colorHi = score >= 90 ? '#6ee7b7' : score >= 80 ? '#aaff66' : '#fde68a';

  const reduced = prefersReducedMotion();
  const [drawn, setDrawn] = useState(reduced);
  useEffect(() => {
    if (reduced) return;
    const id = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(id);
  }, [reduced]);

  const R = 23;            // arc radius — stroke 4 + round cap stays inside 64
  const endDeg = GAUGE_START + GAUGE_SWEEP;
  const track = gaugeArc(R, GAUGE_START, endDeg);

  // Tick ring: one path per state (lit/unlit) keeps this at 2 DOM nodes.
  const TICKS = 28;
  let lit = '';
  let dim = '';
  for (let i = 0; i < TICKS; i++) {
    const t = i / (TICKS - 1);
    const deg = GAUGE_START + t * GAUGE_SWEEP;
    const [x0, y0] = gaugePt(17.5, deg);
    const [x1, y1] = gaugePt(19.5, deg);
    const seg = `M ${x0.toFixed(2)} ${y0.toFixed(2)} L ${x1.toFixed(2)} ${y1.toFixed(2)} `;
    if (t * 100 <= score) lit += seg; else dim += seg;
  }

  const [hx, hy] = gaugePt(R, GAUGE_START + (score / 100) * GAUGE_SWEEP);

  return (
    <svg width="64" height="64" viewBox="0 0 64 64" className="block" role="img" aria-label={`Virality score ${score} out of 100`}>
      <defs>
        <linearGradient id={gid} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor={color} />
          <stop offset="100%" stopColor={colorHi} />
        </linearGradient>
      </defs>
      {/* tinted backing disc */}
      <circle cx="32" cy="32" r="15" fill={color} fillOpacity="0.06" />
      <circle cx="32" cy="32" r="15" fill="none" stroke={color} strokeOpacity="0.12" strokeWidth="1" />
      {/* track + ticks */}
      <path d={track} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4" strokeLinecap="round" />
      <path d={dim} stroke="rgba(255,255,255,0.10)" strokeWidth="1" />
      <path d={lit} stroke={color} strokeOpacity="0.55" strokeWidth="1" />
      {/* progress arc — pathLength normalises the arc to 100 units, so the
          dash math is just the score itself */}
      <path
        d={track}
        fill="none"
        stroke={`url(#${gid})`}
        strokeWidth="4"
        strokeLinecap="round"
        pathLength="100"
        strokeDasharray={`${score} 100`}
        strokeDashoffset={drawn ? 0 : score}
        style={{
          transition: 'stroke-dashoffset 1.2s cubic-bezier(.16,1,.3,1)',
          filter: `drop-shadow(0 0 4px ${color}77)`,
        }}
      />
      {/* head dot at the arc tip — fades in once the draw lands */}
      <circle
        cx={hx.toFixed(2)} cy={hy.toFixed(2)} r="2.4" fill={colorHi}
        style={{
          opacity: drawn ? 1 : 0,
          transition: 'opacity .4s ease 1s',
          filter: `drop-shadow(0 0 4px ${color})`,
        }}
      />
      {/* number — renderer-centered SVG text */}
      <text
        x="32" y="32" textAnchor="middle" dominantBaseline="central"
        className={`serif ${tone}`} fill="currentColor"
        style={{ fontSize: 19, fontStyle: 'italic', letterSpacing: '-0.02em' }}
      >
        {score}
      </text>
      {/* label sits in the gauge's bottom opening */}
      <text
        x="32" y="58.5" textAnchor="middle"
        className="mono" fill="#78716c"
        style={{ fontSize: 5, letterSpacing: '0.22em' }}
      >
        VIRALITY
      </text>
    </svg>
  );
}

function ClipCard({ clip, rank, onSelect, sourceEnd }) {
  const score = clipScore(clip);
  const ringColor = score >= 90 ? '#34d399' : score >= 80 ? '#53fc18' : '#fbbf24';
  const platforms = clip.platforms || [];

  /* ── Delivery materialization ──
     Entrance delay is captured once (initial rank) so re-sorting — which makes
     React move the DOM node and would otherwise replay CSS animations — keeps a
     stable value; `entered` strips the one-shot classes after the sequence so
     reorders never re-trigger it. Reduced motion skips straight to settled. */
  const reduced = prefersReducedMotion();
  const delayRef = useRef(Math.min(rank - 1, 7) * 110);
  const d = delayRef.current;
  const [entered, setEntered] = useState(reduced);
  useEffect(() => {
    if (reduced) return;
    const t = setTimeout(() => setEntered(true), d + 1500);
    return () => clearTimeout(t);
  }, [reduced, d]);

  /* Cursor spotlight — write the pointer position into CSS vars; the .clip-spot
     and .clip-ring overlays render the light. One cheap style write per move. */
  const cardRef = useRef(null);
  const onMove = (e) => {
    const el = cardRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${e.clientX - r.left}px`);
    el.style.setProperty('--my', `${e.clientY - r.top}px`);
  };

  // Locate this clip inside the source recording for the mini timeline.
  const [tsA, tsB] = String(clip.timestamp || '').split('-').map((s) => parseClock(s));
  const hasSpan = Number.isFinite(tsA) && Number.isFinite(tsB) && Number.isFinite(sourceEnd) && sourceEnd > 0;
  const segA = hasSpan ? Math.max(0, Math.min(100, (tsA / sourceEnd) * 100)) : 0;
  const segB = hasSpan ? Math.max(segA + 2.5, Math.min(100, (tsB / sourceEnd) * 100)) : 0;

  return (
    <div
      ref={cardRef}
      onMouseMove={onMove}
      className={`group clip-card tilt-card rounded-xl border border-stone-800 bg-stone-900/30 transition-all duration-300 overflow-hidden flex ${entered ? '' : 'clip-enter'}`}
      style={entered ? undefined : { animationDelay: `${d}ms` }}
    >
      {/* Pointer-tracking light layers (hover only; removed for reduced motion) */}
      <span aria-hidden className="clip-spot" />
      <span aria-hidden className="clip-ring" />

      {/* ── Left: real 9:16 vertical preview (shared ClipFrame) ── */}
      <button
        onClick={onSelect}
        className="relative shrink-0 w-[116px] sm:w-[132px] border-r border-stone-800 block group/pv overflow-hidden"
      >
        <div className={entered ? '' : 'clip-develop'} style={entered ? undefined : { animationDelay: `${d + 120}ms` }}>
          <ClipFrame clip={clip} rank={rank} />
        </div>
        {/* Render sweep — scanline wipes the frame as it lands */}
        {!entered && <span aria-hidden className="clip-sweep" style={{ animationDelay: `${d + 140}ms` }} />}
      </button>

      {/* ── Right: content ── */}
      <div className="p-4 sm:p-5 flex flex-col gap-2.5 flex-1 min-w-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <button onClick={onSelect} className="text-left font-medium block w-full hover:text-[#53fc18] transition line-clamp-2">
              {clip.title}
            </button>
            <div className="serif italic text-stone-400 text-sm line-clamp-1 mt-0.5">{clip.hook}</div>
          </div>
          <div className="shrink-0">
            <ScoreGauge score={score} gid={`vg-${clip.id}`} />
          </div>
        </div>

        {clip.caption && <div className="text-sm text-stone-300 line-clamp-2">{clip.caption}</div>}

        {platforms.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {platforms.map((p, i) => (
              <span key={i} className="px-2 py-0.5 rounded bg-stone-800/60 border border-stone-700/60 text-[10px] mono text-stone-300">
                {p}
              </span>
            ))}
          </div>
        )}

        {/* Mini source timeline — where this cut sits inside the recording.
            Percentage coordinates keep the SVG fluid without viewBox stretch,
            so the round caps and tick widths never distort. */}
        {hasSpan ? (
          <div className="flex items-center gap-2.5">
            <span className="text-[9px] mono text-stone-600 tracking-[0.15em] uppercase shrink-0">Source</span>
            <svg width="100%" height="12" className="block min-w-0 flex-1" aria-hidden>
              <line x1="0%" y1="6" x2="100%" y2="6" stroke="rgba(255,255,255,0.08)" strokeWidth="2" />
              {/* minute ticks along the source */}
              {Array.from({ length: Math.floor(sourceEnd / 600) }, (_, i) => {
                const x = `${(((i + 1) * 600) / sourceEnd) * 100}%`;
                return <line key={i} x1={x} y1="3.5" x2={x} y2="8.5" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />;
              })}
              <line
                x1={`${segA}%`} y1="6" x2={`${segB}%`} y2="6"
                stroke={ringColor} strokeWidth="4" strokeLinecap="round"
                style={{ filter: `drop-shadow(0 0 4px ${ringColor}aa)` }}
              />
            </svg>
            <span className="text-xs mono text-stone-500 shrink-0 tabular-nums">{clip.timestamp}</span>
          </div>
        ) : (
          <div className="text-xs mono text-stone-500">{clip.timestamp}</div>
        )}

        <div className="mt-auto flex items-center gap-2 pt-1">
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[#53fc18]/40 bg-[#53fc18]/[0.06] text-[#53fc18] text-[11px] mono ${entered ? '' : 'clip-stamp'}`}
            style={entered ? undefined : { animationDelay: `${d + 820}ms` }}
          >
            <CheckCircle2 className="w-3.5 h-3.5" /> Editor-reviewed
          </span>
          <div className="flex-1" />
          <button
            onClick={onSelect}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-stone-700 text-stone-300 text-[11px] mono hover:bg-stone-900 transition"
          >
            Details <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────── DETAIL */
function ClipPlaybackStage({ clip }) {
  const reduced = prefersReducedMotion();
  const [playing, setPlaying] = useState(!reduced);

  useEffect(() => { setPlaying(!reduced); }, [clip.id, reduced]);

  // Looping synthetic playback on the shared, time-based rAF engine. The play/pause
  // button gates `playing` (resumes from the same spot); a new clip resets via
  // resetKey; reduced motion holds a single settled frame.
  const progress = useLoopProgress({
    durationMs: 8000,
    playing,
    resetKey: clip.id,
    staticPct: 58,
  });

  const frac = progress / 100;
  const currentTime = frac * (clip.duration || 0);

  // Spoken caption — word tokens derived from the hook line.
  const words = (clip.hook || '').replace(/[\u201c\u201d"]/g, '').trim().split(/\s+/).filter(Boolean);
  const activeWordIdx = words.length ? Math.min(words.length - 1, Math.floor(frac * words.length)) : -1;

  // On-screen text — punchy line swaps across the timeline.
  const lines = Array.isArray(clip.onScreenText) ? clip.onScreenText.filter(Boolean) : [];
  const otIdx = lines.length ? Math.min(lines.length - 1, Math.floor(frac * lines.length)) : -1;
  const otIsPayoff = otIdx === lines.length - 1;

  const grad = CLIP_GRADIENTS[clip.thumbnail] || CLIP_GRADIENTS['gradient-1'];
  const score = clipScore(clip);

  return (
    <div className="relative aspect-[9/16] max-h-[600px] mx-auto w-full max-w-[340px] rounded-[28px] overflow-hidden border-[3px] border-stone-800 bg-black shadow-[0_0_80px_-24px_rgba(83,252,24,0.45)]">
      <div className={`absolute inset-0 bg-gradient-to-br ${grad} opacity-25`} />
      <div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(ellipse at 30% 40%, rgba(83,252,24,0.15) 0%, transparent 50%), radial-gradient(ellipse at 70% 60%, rgba(150,80,200,0.12) 0%, transparent 50%)' }}
      />
      <div className="absolute inset-0 bg-black/35" />

      <button
        onClick={() => { if (!reduced) setPlaying((v) => !v); }}
        aria-label={playing ? 'Pause preview' : 'Play preview'}
        className="absolute inset-0 z-20 flex items-center justify-center"
      >
        <span
          className="w-16 h-16 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center transition-opacity"
          style={{ opacity: playing ? 0 : 1 }}
        >
          <Play className="w-7 h-7 text-white fill-white ml-1" />
        </span>
      </button>

      <div className="absolute top-0 inset-x-0 flex items-center justify-between px-4 pt-3 z-10 text-[10px] mono">
        <span className="px-2 py-0.5 rounded bg-black/45 backdrop-blur-sm text-white/85">CC · Auto-captioned</span>
        {clip.platforms && clip.platforms[0] && (
          <span className="px-2 py-0.5 rounded bg-black/45 backdrop-blur-sm text-[#53fc18]">{clip.platforms[0]}</span>
        )}
      </div>
      <div className="absolute top-12 right-3 z-10 px-1.5 py-0.5 rounded bg-black/45 backdrop-blur text-[8px] mono text-[#53fc18] tracking-wider">
        CLIPPER.AI · {score}
      </div>

      <div className="absolute inset-x-6 top-1/2 -translate-y-16 flex items-end gap-0.5 h-24 z-[1]">
        {Array.from({ length: 38 }).map((_, j) => {
          const distance = Math.abs(j - 19);
          const h = 30 + Math.abs(Math.sin(j * 0.5 + currentTime * 3)) * 70;
          const active = j / 38 < frac;
          return (
            <div
              key={j}
              className="flex-1 rounded-sm h-full"
              style={{
                transform: `scaleY(${h / 100})`,
                transformOrigin: 'bottom',
                background: active ? '#53fc18' : 'rgba(255,255,255,0.28)',
                boxShadow: active && distance < 4 ? '0 0 6px #53fc18' : 'none',
              }}
            />
          );
        })}
      </div>

      {otIdx >= 0 && (
        <div className="absolute inset-x-6 top-[34%] z-10 text-center">
          <div
            key={otIdx}
            className="animate-slide-up font-bold leading-tight text-2xl"
            style={{
              color: otIsPayoff ? '#53fc18' : '#ffffff',
              textShadow: otIsPayoff
                ? '0 0 16px rgba(83,252,24,0.7), 0 2px 6px rgba(0,0,0,0.85)'
                : '0 2px 6px rgba(0,0,0,0.85)',
            }}
          >
            {lines[otIdx]}
          </div>
        </div>
      )}

      {words.length > 0 && (
        <div className="absolute bottom-16 inset-x-4 z-10">
          <div className="flex flex-wrap gap-x-1.5 gap-y-1 justify-center">
            {words.map((w, i) => {
              const isPast = i < activeWordIdx;
              const isActive = i === activeWordIdx;
              return (
                <span
                  key={i}
                  className="text-base font-bold transition-all"
                  style={{
                    color: isActive ? '#53fc18' : isPast ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.4)',
                    textShadow: isActive
                      ? '0 0 12px rgba(83,252,24,0.8), 0 2px 4px rgba(0,0,0,0.8)'
                      : '0 2px 4px rgba(0,0,0,0.8)',
                    transform: isActive ? 'scale(1.08)' : 'scale(1)',
                  }}
                >
                  {w}
                </span>
              );
            })}
          </div>
        </div>
      )}

      <div className="absolute bottom-4 inset-x-4 z-10">
        <div className="relative h-1 rounded-full bg-white/20">
          <div
            className="absolute inset-y-0 left-0 right-0 rounded-full"
            style={{ transform: `scaleX(${frac})`, transformOrigin: 'left', background: 'linear-gradient(90deg,#53fc18,#aaff66)', boxShadow: '0 0 6px #53fc18' }}
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-[#53fc18]"
            style={{ left: `${progress}%`, boxShadow: '0 0 8px #53fc18' }}
          />
        </div>
        <div className="flex items-center justify-between mt-1 text-[9px] mono text-white/60">
          <span>{currentTime.toFixed(1)}s</span>
          <span>{fmtClock(clip.duration)}</span>
        </div>
      </div>
    </div>
  );
}

function ClipDetailView({ clip, onBack, bookCall }) {
  const reduced = prefersReducedMotion();
  const [shownScore, setShownScore] = useState(reduced ? clip.virality : 0);
  const [barsIn, setBarsIn] = useState(reduced);
  useEffect(() => {
    if (reduced) { setShownScore(clip.virality); setBarsIn(true); return; }
    setShownScore(0);
    setBarsIn(false);
    const rafIn = requestAnimationFrame(() => setBarsIn(true));
    const target = clip.virality;
    const start = performance.now();
    const DUR = 900;
    let id;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / DUR);
      const eased = 1 - Math.pow(1 - t, 3);
      setShownScore(Math.round(target * eased));
      if (t < 1) id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(rafIn); if (id) cancelAnimationFrame(id); };
  }, [clip.id, clip.virality, reduced]);

  return (
    <div className="animate-slide-up">
      <button onClick={onBack} className="text-sm text-stone-400 hover:text-stone-100 mono mb-6">
        ← Back to clips
      </button>

      <div className="grid lg:grid-cols-[1.2fr_1fr] gap-8">
        <div>
          <ClipPlaybackStage clip={clip} />

          <div className="grid grid-cols-3 gap-3 mt-4">
            {['9:16', '1:1', '16:9'].map((r, i) => (
              <button key={r} className={`p-3 rounded-lg border text-xs mono transition ${
                i === 0 ? 'border-[#53fc18] bg-[#53fc18]/10 text-[#53fc18]' : 'border-stone-800 text-stone-400 hover:border-stone-700'
              }`}>
                {r} {i === 0 && '· active'}
              </button>
            ))}
          </div>

          {(clip.caption || (Array.isArray(clip.onScreenText) && clip.onScreenText.length > 0)) && (
            <div className="mt-4 p-4 rounded-xl bg-stone-900/40 border border-stone-800 space-y-3">
              {clip.caption && (
                <div>
                  <div className="text-[11px] mono text-stone-500 mb-1.5 tracking-wider">→ SUGGESTED CAPTION</div>
                  <div className="text-sm text-stone-300 leading-relaxed">{clip.caption}</div>
                </div>
              )}
              {Array.isArray(clip.onScreenText) && clip.onScreenText.length > 0 && (
                <div>
                  <div className="text-[11px] mono text-stone-500 mb-1.5 tracking-wider">→ ON-SCREEN TEXT</div>
                  <div className="flex flex-wrap gap-1.5">
                    {clip.onScreenText.filter(Boolean).map((t, i) => (
                      <span key={i} className="px-2.5 py-1 rounded-md bg-stone-800/60 border border-stone-700 text-xs text-stone-200">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div>
            <div className="flex items-center gap-2 text-xs mono text-stone-500 mb-3 tracking-wider">
              <Flame className="w-3.5 h-3.5 text-[#53fc18]" /> VIRALITY BREAKDOWN
            </div>
            <div className="serif text-7xl text-[#53fc18] leading-none mb-2">{shownScore}</div>
            <div className="text-stone-400 text-sm">out of 100 · our model’s predicted reach potential</div>
          </div>

          {clip.scoreExplanation && (
            <div className="p-4 rounded-xl bg-stone-900/40 border border-stone-800">
              <div className="text-xs mono text-stone-500 mb-2 tracking-wider">→ WHY THIS SCORE</div>
              <div className="text-sm text-stone-300 leading-relaxed">{clip.scoreExplanation}</div>
            </div>
          )}

          <div className="space-y-3">
            {Object.entries(clip.engagement).map(([k, v], bi) => (
              <div key={k}>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="capitalize text-stone-300">{k}</span>
                  <span className="mono text-stone-400">{v}</span>
                </div>
                <div className="h-1.5 rounded-full bg-stone-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#53fc18] to-[#aaff66] transition-[width] duration-700 ease-out"
                    style={{ width: barsIn ? `${v}%` : '0%', transitionDelay: `${bi * 120}ms` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div>
            <div className="text-xs mono text-stone-500 mb-3 tracking-wider">→ WHY IT WORKS</div>
            <div className="space-y-2">
              {clip.reasons.map((r) => (
                <div key={r} className="flex items-start gap-2.5 p-3 rounded-lg bg-stone-900/40 border border-stone-800">
                  <Sparkles className="w-4 h-4 text-[#53fc18] mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-stone-300">{r}</div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="text-xs mono text-stone-500 mb-3 tracking-wider">→ RECOMMENDED PLATFORMS</div>
            <div className="flex flex-wrap gap-2">
              {clip.platforms.map((p) => (
                <span key={p} className="px-3 py-1.5 rounded-md border border-stone-700 bg-stone-900/50 text-sm">
                  {p}
                </span>
              ))}
            </div>
          </div>

          <div className="pt-2 space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-[#53fc18]/40 bg-[#53fc18]/[0.06] text-[#53fc18] text-xs mono">
              <CheckCircle2 className="w-3.5 h-3.5" /> Editor-reviewed · delivered to your queue
            </div>
            <button
              onClick={bookCall}
              className="btn-neon w-full py-3 rounded-lg font-medium flex items-center justify-center gap-2"
            >
              Book a demo to do this with your content
            </button>
          </div>
        </div>
      </div>

      <div className="tilt-card mt-8 p-6 rounded-2xl border border-stone-800 bg-stone-900/30">
        <div className="text-xs mono text-stone-500 mb-4 tracking-wider">→ TRANSCRIPT · {clip.timestamp}</div>
        <div className="serif text-xl leading-relaxed text-stone-300 italic">
          "{clip.hook} ...and what we found was completely opposite to what every blog post and Twitter thread told us. The data was unambiguous. The conventional wisdom was just wrong, and the teams that ignored it were winning."
        </div>
      </div>
    </div>
  );
}


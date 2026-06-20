import React from 'react';

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
  try { document.documentElement.lang = 'en'; } catch { /* best-effort */ }
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

export { SEO_BRAND, SEO_BY_PAGE, _seoUpsertLink, _seoUpsertMeta, applySeo, injectJsonLd };

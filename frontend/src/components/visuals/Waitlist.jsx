import React, { useState, useRef, useEffect } from 'react';
import { ArrowUpRight, Briefcase, Check, CheckCircle2, Clock, Database, Globe, Heart, MessageCircle, Play, Scissors, Share2, Shield, Sparkles, Zap } from 'lucide-react';
import { GlowOrb, Reveal, useReveal } from '../ui.jsx';
import { track } from '../../lib/analytics.jsx';
import { postLead } from '../../lib/api.js';
import { DEMO_CLIPS, SAMPLE_RECORDINGS } from '../../lib/demo.jsx';
import { prefersReducedMotion, useLoopProgress } from '../../lib/motion.jsx';
import { ClipFrame } from '../../studio/views.jsx';

function Waitlist({ accent = 'var(--color-brand)' }) {
  const [email, setEmail] = useState('');
  const [kind, setKind] = useState(''); // optional lead qualifier — what they make
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // F3: submissions go to the operations backend (POST /api/leads) instead of
  // the artifact sandbox's persistent-storage API, which doesn't exist on the real
  // site. The endpoint is idempotent per email, so resubmits succeed quietly
  // rather than erroring.
  const submit = async () => {
    const trimmed = email.trim().toLowerCase();
    setError('');
    if (!trimmed || !trimmed.includes('@') || !trimmed.includes('.')) {
      setError('Please enter a valid email address.');
      return;
    }
    setLoading(true);
    try {
      const lead = await postLead({
        email: trimmed,
        contentKind: kind || undefined,
        source: 'waitlist',
        meta: {
          page: typeof window !== 'undefined' ? window.location.pathname : undefined,
          referrer: typeof document !== 'undefined' ? document.referrer || undefined : undefined,
        },
      });
      track('book_call_requested', { duplicate: !!lead.duplicate, contentKind: kind || undefined });
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
          <div className="absolute -inset-20 bg-[var(--color-brand)]/[0.10] blur-3xl rounded-full pointer-events-none" />
          <div className="relative">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[var(--color-brand)]/[0.12] bg-[var(--color-brand)]/[0.015] backdrop-blur text-[11px] mono text-stone-300 mb-8 tracking-wider uppercase">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inset-0 rounded-full bg-[var(--color-brand)] animate-ping opacity-60" />
                <span className="relative rounded-full h-1.5 w-1.5 bg-[var(--color-brand)]" />
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
              <div className="grid sm:grid-cols-3 gap-px bg-white/[0.06] rounded-2xl overflow-hidden border border-[var(--color-brand)]/[0.08] text-left">
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
                          ? 'border-[var(--color-brand)]/60 bg-[var(--color-brand)]/[0.1] text-[#aaff66]'
                          : 'border-white/[0.12] text-stone-400 hover:border-[var(--color-brand)]/30 hover:text-stone-200'
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
                    className="flex-1 min-w-0 px-5 py-4 rounded-md border border-[var(--color-brand)]/30 focus:border-[var(--color-brand)]/60 focus:outline-none text-base placeholder:text-stone-500 disabled:opacity-50"
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
              <div role="status" className="max-w-lg mx-auto mb-6 p-5 rounded-md border border-[var(--color-brand)]/30 bg-[var(--color-brand)]/[0.08] flex items-center gap-3" style={{ animation: 'blur-in 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}>
                <CheckCircle2 className="w-5 h-5 text-[var(--color-brand)] flex-shrink-0" />
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

export { Waitlist };

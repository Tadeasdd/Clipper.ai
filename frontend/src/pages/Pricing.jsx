import React from 'react';
import { Check, Shield, Users, Zap } from 'lucide-react';
import { CTABand, FAQItem, PageHero } from '../components/site-chrome.jsx';
import { Reveal } from '../components/ui.jsx';

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

export { PricingPage };

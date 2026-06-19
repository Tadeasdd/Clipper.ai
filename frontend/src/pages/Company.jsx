import React from 'react';
import { ArrowUpRight, Briefcase, Building2, Globe, Mail, Shield, Zap } from 'lucide-react';
import { PageHero } from '../components/site-chrome.jsx';
import { Reveal } from '../components/ui.jsx';

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
              <div className="tilt-card p-8 rounded-xl border border-[var(--color-brand)]/[0.08] h-full">
                <p.icon className="w-5 h-5 text-[var(--color-brand)] mb-5" />
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
            <div className="text-[10px] mono text-[var(--color-brand)] mb-4 tracking-[0.2em] uppercase flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[var(--color-brand)]" /> Careers</div>
            <h2 className="serif text-5xl leading-tight tracking-tight mb-6">Come build the<br /><span className="italic">attention layer.</span></h2>
            <p className="text-stone-400 leading-relaxed text-lg mb-6">We're a small, pre-launch team and aren't running formal openings yet. If this is the problem you'd want to spend your time on, we'd still like to hear from you.</p>
            <a href="mailto:jobs@clipper.ai" className="inline-flex items-center gap-2 text-sm text-stone-300 hover:text-[var(--color-brand)] group">
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
              <div className="text-[10px] mono text-[var(--color-brand)] mb-3 tracking-[0.2em] uppercase flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[var(--color-brand)]" /> Status</div>
              <h3 className="serif text-3xl mb-4">Where we are</h3>
              <div className="space-y-3 text-sm text-stone-400">
                <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[var(--color-brand)]" style={{ boxShadow: '0 0 6px var(--color-brand)' }} /> Pre-launch, early access opens in small batches</div>
                <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-stone-500" /> Private beta, onboarding our first design partners</div>
                <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-stone-500" /> Independently built, talking to potential backers</div>
                <div className="text-xs text-stone-600 pt-2">Press inquiries → press@clipper.ai</div>
              </div>
            </div>
          </Reveal>
          <Reveal delay={80}>
            <div>
              <div className="text-[10px] mono text-[var(--color-brand)] mb-3 tracking-[0.2em] uppercase flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[var(--color-brand)]" /> Contact</div>
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
              <div className="text-[10px] mono text-[var(--color-brand)] mb-3 tracking-[0.2em] uppercase flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[var(--color-brand)]" /> Backing</div>
              <h3 className="serif text-3xl mb-4">Independent and early</h3>
              <div className="text-sm text-stone-400 leading-relaxed">Clipper is independently built and pre-launch. If you back AI-native content operations for creators and media teams, we'd love to talk.</div>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}

export { CompanyPage };

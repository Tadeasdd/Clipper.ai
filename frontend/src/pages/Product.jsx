import React from 'react';
import { Film, Mic, Share2, Sparkles, TrendingUp, Users, Workflow } from 'lucide-react';
import { ClipPreviewPlayer, IntegrationsStrip, StudioMockup } from '../components/landing-visuals.jsx';
import { CTABand, PageHero } from '../components/site-chrome.jsx';
import { Reveal } from '../components/ui.jsx';

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
              <div className="tilt-card group p-8 rounded-xl border border-[var(--color-brand)]/[0.08] hover:border-[var(--color-brand)]/30 hover:bg-[var(--color-brand)]/[0.015] h-full">
                <div className="w-10 h-10 rounded-md border border-[var(--color-brand)]/[0.12] flex items-center justify-center mb-5 group-hover:border-[var(--color-brand)]/40 group-hover:bg-[var(--color-brand)]/5">
                  <f.icon className="w-4 h-4 text-stone-400 group-hover:text-[var(--color-brand)]" />
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
              <div className="text-[10px] mono text-[var(--color-brand)] mb-4 tracking-[0.2em] uppercase flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[var(--color-brand)]" /> What you get</div>
              <h2 className="serif text-5xl leading-[1.05] tracking-tight mb-6">One show becomes <span className="italic text-[var(--color-brand)]">weeks of content.</span></h2>
              <p className="text-stone-400 leading-relaxed text-lg">Hand us a single recording and a steady stream of reviewed, ready-to-post clips comes back, on a cadence you can build an audience around.</p>
            </div>
            <div className="tilt-card rounded-2xl border border-[var(--color-brand)]/[0.12] bg-black/40 backdrop-blur overflow-hidden">
              <div className="border-b border-white/[0.06] px-5 py-3 text-[10px] mono text-stone-500 tracking-wider uppercase flex items-center justify-between">
                <span>From one 60-minute show</span>
                <span className="text-[var(--color-brand)]">Typical output</span>
              </div>
              <div className="divide-y divide-[var(--color-brand)]/[0.08]">
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
                <span className="serif text-2xl text-[var(--color-brand)]">Every week</span>
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
            <div className="text-[10px] mono text-[var(--color-brand)] mb-4 tracking-[0.2em] uppercase flex items-center justify-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[var(--color-brand)]" /> Behind the scenes</div>
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

export { ProductPage };

import React from 'react';
import { CTABand, PageHero } from '../components/site-chrome.jsx';
import { Reveal } from '../components/ui.jsx';

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
          <div className="rounded-2xl border border-[var(--color-brand)]/30 bg-[var(--color-brand)]/[0.04] p-8 flex items-center gap-4">
            <div className="relative">
              <span className="w-3 h-3 rounded-full bg-[var(--color-brand)] block" style={{ boxShadow: '0 0 16px var(--color-brand)' }} />
              <span className="absolute inset-0 w-3 h-3 rounded-full bg-[var(--color-brand)] animate-ping opacity-60" />
            </div>
            <div>
              <div className="serif text-3xl text-[var(--color-brand)]">Pre-launch, not yet live</div>
              <div className="text-xs mono text-stone-400 tracking-wider mt-1">LIVE SERVICE STATUS BEGINS WHEN WE OPEN TO CLIENTS</div>
            </div>
          </div>
        </Reveal>
      </section>

      <section className="relative z-10 max-w-[1400px] mx-auto px-6 md:px-8 pb-16 border-t border-white/[0.12] pt-12">
        <Reveal>
          <div className="flex items-baseline justify-between mb-8">
            <div>
              <div className="text-[10px] mono text-[var(--color-brand)] mb-2 tracking-[0.2em] uppercase flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[var(--color-brand)]" /> 
                Systems
              </div>
              <h2 className="serif text-4xl">Components</h2>
            </div>
            <div className="text-[10px] mono text-stone-500 tracking-wider">STATUS PUBLISHED AT LAUNCH</div>
          </div>
          <div className="rounded-2xl border border-[var(--color-brand)]/[0.10] bg-stone-900/30 overflow-hidden divide-y divide-[var(--color-brand)]/[0.08]">
            {systems.map((sys, i) => (
              <Reveal key={sys.name} delay={i * 30}>
                <div className="px-6 py-5 flex items-center justify-between gap-6 hover:bg-[var(--color-brand)]/[0.015]">
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
              <div className="text-[10px] mono text-[var(--color-brand)] mb-2 tracking-[0.2em] uppercase flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[var(--color-brand)]" /> 
                History
              </div>
              <h2 className="serif text-4xl">Incidents</h2>
            </div>
          </div>
          <div className="rounded-xl border border-[var(--color-brand)]/[0.10] bg-[var(--color-brand)]/[0.02] p-6 text-center">
            <div className="text-sm text-stone-400">No incidents to report. Public incident history starts when Clipper begins serving live traffic.</div>
            <div className="text-[10px] mono text-stone-600 tracking-wider mt-2">STATUS UPDATES → STATUS@CLIPPER.AI</div>
          </div>
        </Reveal>
      </section>

      <CTABand goto={goto} openApp={() => goto('home')} bookCall={bookCall} />
    </>
  );
}

export { StatusPage };

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ArrowUpRight, BookOpen, Building2, Film, Globe, Layers, Play, Search, Workflow } from 'lucide-react';
import { NeonGrid, GlowOrb, LogoMark, Reveal } from '../ui.jsx';
import { track } from '../../lib/analytics.jsx';

function FAQItem({ q, a, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div
      className={`rounded-xl border overflow-hidden ${open ? 'border-[var(--color-brand)]/30 bg-[var(--color-brand)]/[0.015]' : 'border-white/[0.06] hover:border-white/[0.12]'}`}
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
            <div className="text-[10px] mono text-[var(--color-brand)] mb-4 tracking-[0.2em] uppercase flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[var(--color-brand)]" /> Frequently asked</div>
            <h2 className="serif text-5xl leading-[1.05] mb-4">
              The answers <span className="italic text-stone-400">to the questions we keep getting.</span>
            </h2>
            <p className="text-stone-400 leading-relaxed">
              Don't see yours? <a href="mailto:hello@clipper.ai" className="text-[var(--color-brand)] hover:underline cursor-pointer">Email us</a>. We read everything.
            </p>
          </div>

          <div className="space-y-2">
            {items.map((item, i) => {
              const isOpen = open === i;
              return (
                <div
                  key={item.q}
                  className={`rounded-xl border overflow-hidden ${isOpen ? 'border-[var(--color-brand)]/30 bg-[var(--color-brand)]/[0.015]' : 'border-white/[0.06] hover:border-white/[0.12]'}`}
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

export { FAQItem, FAQ };

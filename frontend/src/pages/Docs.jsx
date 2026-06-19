import React, { useState, useRef } from 'react';
import { ArrowUpRight, BookOpen, Clock, Download, GitBranch, Globe, Layers, Search, Shield, Upload } from 'lucide-react';
import { PageHero } from '../components/site-chrome.jsx';
import { Reveal } from '../components/ui.jsx';

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
              className="w-full pl-11 pr-4 py-3.5 rounded-md bg-[var(--color-brand)]/[0.015] border border-[var(--color-brand)]/[0.12] focus:border-[var(--color-brand)]/30 focus:outline-none text-sm placeholder:text-stone-500"
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
              <div className="tilt-card group p-7 rounded-xl border border-[var(--color-brand)]/[0.08] hover:border-[var(--color-brand)]/30 hover:bg-[var(--color-brand)]/[0.015] h-full">
                <div className="flex items-start justify-between mb-5">
                  <div className="w-10 h-10 rounded-md border border-[var(--color-brand)]/[0.12] flex items-center justify-center group-hover:border-[var(--color-brand)]/40 group-hover:bg-[var(--color-brand)]/5">
                    <d.icon className="w-4 h-4 text-stone-400 group-hover:text-[var(--color-brand)]" />
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
          <div className="rounded-2xl border border-[var(--color-brand)]/[0.10] bg-[var(--color-brand)]/[0.02] p-10 md:p-12 text-center max-w-2xl mx-auto">
            <div className="text-[10px] mono text-[var(--color-brand)] mb-4 tracking-[0.2em] uppercase">Still have questions?</div>
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

export { DocsPage };

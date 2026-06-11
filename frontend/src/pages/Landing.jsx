import React, { useEffect } from 'react';
import { ArrowUpRight, ChevronRight } from 'lucide-react';
import { BentoDeliverables, ContentMath, InteractiveDemo, Manifesto, PipelineExplorer, SignaturePath, TrustStrip, ViralityChart, Waitlist, WhyClipper } from '../components/landing-visuals.jsx';
import { FAQ } from '../components/site-chrome.jsx';
import { NeonGrid, Reveal } from '../components/ui.jsx';
import { prefersReducedMotion } from '../lib/motion.jsx';

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

export { Landing };

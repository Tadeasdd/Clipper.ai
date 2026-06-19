import React, { useState, useRef, useEffect } from 'react';
import { ArrowUpRight, Briefcase, Check, CheckCircle2, Clock, Database, Globe, Heart, MessageCircle, Play, Scissors, Share2, Shield, Sparkles, Zap } from 'lucide-react';
import { GlowOrb, Reveal, useReveal } from '../ui.jsx';
import { track } from '../../lib/analytics.jsx';
import { postLead } from '../../lib/api.js';
import { DEMO_CLIPS, SAMPLE_RECORDINGS } from '../../lib/demo.jsx';
import { prefersReducedMotion, useLoopProgress } from '../../lib/motion.jsx';
import { ClipFrame } from '../../studio/views.jsx';
import { PL_GLYPHS } from './shared.jsx';

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
      <div className="pl-panel rounded-2xl border border-[var(--color-brand)]/[0.14] bg-gradient-to-b from-white/[0.03] to-transparent backdrop-blur overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06] text-[10px] mono tracking-wider uppercase text-stone-400">
          <div className="flex items-center gap-2">
            <span className={"inline-block w-1.5 h-1.5 rounded-full bg-[var(--color-brand)] " + (reduced ? "" : "pl-live")} />
            Six-model pipeline
          </div>
          <div className="flex items-center gap-3">
            <span className="text-stone-500">{String(done).padStart(2, '0')}/06 complete</span>
            <button type="button" onClick={replay} className="pl-replay text-stone-400 hover:text-[var(--color-brand)] transition-colors">{'\u21bb'} replay</button>
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
                <span key={i} className={"pl-tick absolute w-px h-3 " + (tickOn ? "pl-tick-on bg-[var(--color-brand)]" : "bg-white/15")} style={{ left: ((i + 1) / N * 100) + '%' }} />
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
                (st === 'idle' ? "border-white/[0.08] bg-white/[0.01] " : "border-[var(--color-brand)]/40 bg-[var(--color-brand)]/[0.05] ") +
                (st === 'done' ? "is-done " : "") +
                (st === 'active' ? "is-active " : "") +
                (focus === i ? "is-focus " : "");
              return (
                <button key={i} type="button" onClick={() => onNode(i)} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} className={cls}>
                  <span className="pl-cnr pl-cnr-tl" aria-hidden="true" />
                  <span className="pl-cnr pl-cnr-br" aria-hidden="true" />
                  <div className="flex items-center justify-between mb-2">
                    <span className={"pl-glyph " + (st === 'idle' ? "text-stone-500" : "text-[var(--color-brand)]")}>{PL_GLYPHS[nd.g]}</span>
                    <span className={"w-1.5 h-1.5 rounded-full " + (st === 'done' ? "bg-[var(--color-brand)]" : st === 'active' ? "bg-[var(--color-brand)] pl-dot" : "bg-stone-600")} />
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className={"mono text-[10px] " + (st === 'idle' ? "text-stone-500" : "text-[var(--color-brand)]")}>{nd.n}</span>
                    <span className={"text-xs font-medium tracking-wide " + (st === 'idle' ? "text-stone-400" : "text-stone-100")}>{nd.label}</span>
                  </div>
                  <div className={"pl-val mono mt-2 leading-none " + (lit ? "text-[var(--color-brand)]" : "text-stone-600")}><span ref={(el) => { numRefs.current[i] = el; }} className="text-[14px] font-semibold tracking-tight">0</span><span className="pl-caret" aria-hidden="true" /><span className="text-[9px] text-stone-500"> {nd.unit}</span></div>
                  <span className="pl-bar absolute left-0 right-0 bottom-0 h-[3px] bg-white/[0.06]">
                    <span className="pl-bar-fill block h-full" style={{ '--i': i }} />
                  </span>
                </button>
              );
            })}
          </div>

          {/* detail */}
          <div className="pl-detail mt-5 rounded-xl border border-white/[0.07] bg-black/30 px-4 py-4 grid grid-cols-[auto_1fr] gap-4 items-start">
            <div className="mono text-3xl leading-none text-[var(--color-brand)]">{f.n}</div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-stone-100">{f.label}</span>
                <span className={"text-[9px] mono uppercase tracking-widest px-1.5 py-[2px] rounded " + (fState === 'idle' ? "text-stone-500 border border-white/10" : "text-[var(--color-brand)] border border-[var(--color-brand)]/30 bg-[var(--color-brand)]/[0.06]")}>{fState === 'done' ? 'complete' : fState === 'active' ? 'running' : 'queued'}</span>
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

export { PipelineExplorer };

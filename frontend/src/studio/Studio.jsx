import React, { useState, useRef, useEffect, useMemo } from 'react';
import { LogoMark, CrosshairCursor } from '../components/ui.jsx';
import { StudioBackdrop, UploadView, AnalyzingView, ResultsView, ClipDetailView } from './views.jsx';

/* The studio view — extracted verbatim from ClipperAppInner's `view === 'app'`
   branch in the F2 split. All state stays in App.jsx (the run is started from
   marketing CTAs before this chunk even loads); this is purely presentation. */
export default function Studio({
  onExit, bookCall, stage, progress, analysisStep, analysisSteps, videoMeta,
  stageHistory, momentsFound, clips, selectedClip, setSelectedClip, processedMs,
  history, handleFile, fileRef, loadFromHistory, deleteRun, watchSample,
}) {
  return (
    <div className="min-h-screen bg-black text-stone-100" style={{ fontFamily: "'Inter', -apple-system, sans-serif" }}>
      <style>{`
        .serif { font-family: 'Newsreader', Georgia, 'Times New Roman', serif; font-optical-sizing: auto; font-weight: 500; letter-spacing: -0.015em; line-height: 1.04; }
        .serif.italic, .serif em, em { font-style: italic; font-weight: 500; }
        .mono { font-family: 'JetBrains Mono', 'SF Mono', Menlo, monospace; font-feature-settings: "calt", "ss01"; }
        body, * { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; -webkit-font-smoothing: antialiased; }

        /* Motion system — slow, deliberate, Palantir-grade */
        @keyframes shimmer { 0% { background-position: -1000px 0; } 100% { background-position: 1000px 0; } }
        @keyframes pulse-ring { 0% { transform: scale(0.95); opacity: 1; } 100% { transform: scale(1.4); opacity: 0; } }
        @keyframes slide-up { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes blur-in {
          from { opacity: 0; filter: blur(12px); transform: translateY(20px); }
          to { opacity: 1; filter: blur(0); transform: translateY(0); }
        }
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes ambient {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.05); }
        }
        @keyframes scan {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(100vh); }
        }
        @keyframes grid-fade {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.7; }
        }
        .animate-slide-up { animation: slide-up 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .animate-blur-in { animation: blur-in 0.9s cubic-bezier(0.16, 1, 0.3, 1) forwards; opacity: 0; }
        .animate-fade-in { animation: fade-in 1.2s ease-out forwards; }
        .animate-ambient { animation: ambient 8s ease-in-out infinite; }

        /* Reveal-on-scroll utility */
        .reveal { opacity: 0; transform: translateY(24px); transition: opacity 1s cubic-bezier(0.16, 1, 0.3, 1), transform 1s cubic-bezier(0.16, 1, 0.3, 1); }
        .reveal.in { opacity: 1; transform: translateY(0); }

        /* Smooth scroll */
        html { scroll-behavior: smooth; }

        /* Grid background */
        .grid-bg {
          background-image:
            linear-gradient(rgba(83,252,24,0.10) 1px, transparent 1px),
            linear-gradient(90deg, rgba(83,252,24,0.10) 1px, transparent 1px);
          background-size: 64px 64px;
        }

        /* Soft transitions everywhere */
        button, a, [role="button"] { transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1); }

        /* Grain texture */
        .grain::before {
          content: ''; position: fixed; inset: 0; pointer-events: none; opacity: 0.035; z-index: 1; mix-blend-mode: overlay;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence baseFrequency='0.9' /%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)' /%3E%3C/svg%3E");
        }

        /* Accent glow utility */
        .glow-green { box-shadow: 0 0 0 1px rgba(83,252,24,0.2), 0 0 30px -5px rgba(83,252,24,0.3); }
        .text-glow { text-shadow: 0 0 28px rgba(83,252,24,0.22); }

        /* Gradient text for italic green — adds dimension */
        .gradient-green {
          background: linear-gradient(120deg, #53fc18 0%, #b8ff7d 90%);
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        @keyframes greenFlow { 0%, 100% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } }

        /* Removed the default blue focus ring; custom green ring shows on keyboard focus only */
        *:focus { outline: none; }
        *:focus-visible {
          outline: none;
          box-shadow: 0 0 0 2px rgba(83, 252, 24, 0.5), 0 0 12px rgba(83, 252, 24, 0.25);
          border-radius: 4px;
        }

        /* Animated underline for inline links */
        .link-underline { position: relative; }
        .link-underline::after {
          content: ''; position: absolute; left: 0; bottom: -2px; width: 100%; height: 1px;
          background: #53fc18; transform-origin: right; transform: scaleX(0);
          transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .link-underline:hover::after { transform-origin: left; transform: scaleX(1); }

        /* Shimmer effect — for use on premium tiles */
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        .shimmer-on-hover {
          background: linear-gradient(110deg, transparent 30%, rgba(83,252,24,0.08) 45%, rgba(83,252,24,0.12) 50%, rgba(83,252,24,0.08) 55%, transparent 70%);
          background-size: 200% 100%;
          background-position: -200% 0;
          opacity: 0;
          transition: opacity 0.3s ease;
        }
        .group:hover .shimmer-on-hover {
          opacity: 1;
          animation: shimmer 1.4s ease-in-out;
        }

        /* Smooth scrollbar */
        ::-webkit-scrollbar { width: 10px; height: 10px; }
        ::-webkit-scrollbar-track { background: rgba(20,20,18,0.4); }
        ::-webkit-scrollbar-thumb {
          background: rgba(83,252,24,0.15);
          border-radius: 999px;
          border: 2px solid transparent;
          background-clip: padding-box;
        }
        ::-webkit-scrollbar-thumb:hover { background: rgba(83,252,24,0.35); background-clip: padding-box; border: 2px solid transparent; }

        /* Selection color — when you highlight text */
        ::selection { background: rgba(83,252,24,0.3); color: #fff; }

        /* Subtle hover lift on cards */
        .card-lift { transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.3s, box-shadow 0.3s; }
        .card-lift:hover { transform: translateY(-2px); }

        /* Magnetic border glow — for primary CTAs */
        .magnetic-glow { position: relative; isolation: isolate; }
        .magnetic-glow::before {
          content: ''; position: absolute; inset: -1px; border-radius: inherit;
          background: linear-gradient(120deg, transparent 30%, rgba(83,252,24,0.6) 50%, transparent 70%);
          background-size: 200% 100%;
          background-position: -200% 0;
          z-index: -1; opacity: 0;
          transition: opacity 0.3s ease;
        }
        .magnetic-glow:hover::before {
          opacity: 1;
          animation: shimmer 1.8s linear infinite;
        }

        /* ── Studio wow layer (additive, dependency-free) ─────────────── */
        /* Unified neon button system — mirrors the marketing site so the
           studio's CTAs read as real buttons, not bare text. */
        .btn-neon { position: relative; overflow: hidden; background: #53fc18; color: #000;
          box-shadow: 0 0 0 1px rgba(83,252,24,0.0), 0 8px 28px rgba(83,252,24,0.20);
          transition: transform .25s cubic-bezier(.16,1,.3,1), box-shadow .35s ease, background-color .25s ease; }
        .btn-neon:hover { transform: translateY(-1px); background: #62ff2b;
          box-shadow: 0 0 0 1px rgba(83,252,24,0.35), 0 10px 30px rgba(83,252,24,0.22); }
        .btn-neon:active { transform: translateY(0) scale(0.99); }
        .btn-neon::after { content: ''; position: absolute; top: 0; left: 0; height: 100%; width: 60%;
          background: linear-gradient(105deg, transparent 0%, rgba(255,255,255,0.35) 50%, transparent 100%);
          transform: translateX(-180%) skewX(-12deg); transition: transform .6s cubic-bezier(.16,1,.3,1); pointer-events: none; }
        .btn-neon:hover::after { transform: translateX(320%) skewX(-12deg); }
        .cta-glow { box-shadow: 0 8px 30px rgba(83,252,24,0.14); }

        /* Neon hairline under the studio nav — matches the marketing chrome. */
        .studio-nav::after {
          content: ''; position: absolute; left: 0; right: 0; bottom: -1px; height: 1px;
          background: linear-gradient(90deg, transparent 10%, rgba(83,252,24,0.45) 50%, transparent 90%);
          pointer-events: none;
        }

        /* Viewfinder corner brackets — camera-framing detail on data panels. */
        .vf-corners { position: relative; }
        .vf-corners::before, .vf-corners::after {
          content: ''; position: absolute; width: 14px; height: 14px; pointer-events: none;
          border: 1px solid rgba(83,252,24,0.30); transition: border-color .35s ease;
        }
        .vf-corners::before { top: 8px; left: 8px; border-right: 0; border-bottom: 0; border-top-left-radius: 5px; }
        .vf-corners::after { bottom: 8px; right: 8px; border-left: 0; border-top: 0; border-bottom-right-radius: 5px; }
        .vf-corners:hover::before, .vf-corners:hover::after { border-color: rgba(83,252,24,0.7); }

        /* Sonar backdrop — slow rotation for the decorative ring SVG. */
        @keyframes sonarSpin { to { transform: rotate(360deg); } }
        .sonar-spin { animation: sonarSpin 80s linear infinite; transform-origin: center; }
        @keyframes blipPulse { 0%, 100% { opacity: 0.15; } 50% { opacity: 0.9; } }
        .sonar-blip { animation: blipPulse 3.2s ease-in-out infinite; }

        /* Results waveform — draws itself in once on mount. */
        @keyframes waveDraw { to { stroke-dashoffset: 0; } }
        .wave-draw { stroke-dasharray: 1; stroke-dashoffset: 1;
          animation: waveDraw 2.4s cubic-bezier(.16,1,.3,1) 0.25s forwards; }

        /* Clip cards — neon hairline + green tint on hover. */
        .clip-card { position: relative; }
        .clip-card::before {
          content: ''; position: absolute; inset: 0 0 auto 0; height: 1px; z-index: 1;
          background: linear-gradient(90deg, transparent, rgba(83,252,24,0.7), transparent);
          opacity: 0; transition: opacity .35s ease; pointer-events: none;
        }
        .clip-card:hover { border-color: rgba(83,252,24,0.35) !important;
          box-shadow: 0 18px 50px -24px rgba(83,252,24,0.4); }
        .clip-card:hover::before { opacity: 1; }

        /* Living gradient text — same breathing flow as the marketing site. */
        .gradient-green {
          background: linear-gradient(120deg, #53fc18 0%, #b8ff7d 30%, #53fc18 55%, #d2ff9e 80%, #53fc18 100%);
          background-size: 240% 240%;
          -webkit-background-clip: text; background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: greenFlow 8s ease-in-out infinite;
        }

        /* ── Delivery materialization — the shipped-clips wow sequence ──────
           Cards arrive staggered (blur-rise), a render-sweep scanline wipes
           each 9:16 preview while the frame "develops" from dark to lit, and
           the Editor-reviewed pill stamps in last. All one-shot, backwards
           fill (so hover transforms still win after entry), classes removed
           by ClipCard once the sequence completes (so re-sorting the grid
           never replays it). */
        @keyframes clipMaterialize {
          0%   { opacity: 0; transform: translateY(26px) scale(0.97); filter: blur(10px); }
          55%  { filter: blur(0); }
          100% { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
        }
        .clip-enter { animation: clipMaterialize .85s cubic-bezier(.16,1,.3,1) backwards; }

        @keyframes clipSweep {
          0%   { transform: translateY(-140%); opacity: 0; }
          12%  { opacity: 1; }
          80%  { opacity: 1; }
          100% { transform: translateY(440%); opacity: 0; }
        }
        .clip-sweep {
          position: absolute; left: -10%; right: -10%; top: 0; height: 26%;
          pointer-events: none; z-index: 3; opacity: 0;
          background: linear-gradient(to bottom,
            transparent,
            rgba(83,252,24,0.14) 40%,
            rgba(170,255,102,0.85) 50%,
            rgba(83,252,24,0.14) 60%,
            transparent);
          animation: clipSweep 1.05s cubic-bezier(.55,.06,.35,1) backwards;
        }
        @keyframes clipDevelop {
          from { filter: brightness(0.22) saturate(0.35); }
          to   { filter: brightness(1) saturate(1); }
        }
        .clip-develop { animation: clipDevelop 1s ease-out backwards; }

        @keyframes clipStamp {
          0%   { opacity: 0; transform: scale(1.45); }
          62%  { opacity: 1; transform: scale(0.96); }
          100% { opacity: 1; transform: scale(1); }
        }
        .clip-stamp { animation: clipStamp .45s cubic-bezier(.34,1.56,.64,1) backwards; }

        /* Cursor spotlight — a soft green light + border glint that track the
           pointer across each clip card (CSS vars set from one mousemove). */
        .clip-spot {
          position: absolute; inset: 0; z-index: 1; pointer-events: none; opacity: 0;
          transition: opacity .45s ease; border-radius: inherit;
          background: radial-gradient(240px circle at var(--mx, 50%) var(--my, 40%),
            rgba(83,252,24,0.11), transparent 65%);
        }
        .clip-card:hover .clip-spot { opacity: 1; }
        .clip-ring {
          position: absolute; inset: 0; z-index: 2; pointer-events: none; opacity: 0;
          transition: opacity .45s ease; border-radius: inherit; padding: 1px;
          background: radial-gradient(190px circle at var(--mx, 50%) var(--my, 40%),
            rgba(170,255,102,0.85), transparent 70%);
          -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
          -webkit-mask-composite: xor;
          mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
          mask-composite: exclude;
        }
        .clip-card:hover .clip-ring { opacity: 1; }
        /* Spotlight is reusable: any .spot-host (stat tiles, panels) gets it too. */
        .spot-host:hover .clip-spot, .spot-host:hover .clip-ring { opacity: 1; }
        /* 3D tilt cards — same shared engine (useTiltEngine) as the marketing
           site, so studio panels lean toward the cursor identically. */
        .tilt-card { will-change: transform;
          transition-property: border-color, box-shadow, background-color, color, opacity, filter !important; }

        /* ── Analytics boot sequence — the stats deck powers on ────────────
           The waveform draws in behind a moving scan-head, stat tiles rise in
           staggered, each tile's micro-viz wipes on left→right like a plotter,
           and the big numbers "lock in" with a flash as their count-up lands.
           All one-shot; the meter head-dots keep a faint instrument breathing. */
        .stat-enter { animation: clipMaterialize .7s cubic-bezier(.16,1,.3,1) backwards; }

        @keyframes vizReveal {
          from { clip-path: inset(0 100% 0 0); opacity: 0.35; }
          to   { clip-path: inset(0 -8% 0 0); opacity: 1; }
        }
        .viz-reveal { animation: vizReveal .9s cubic-bezier(.3,.7,.3,1) backwards; }

        @keyframes valLock {
          0%   { text-shadow: 0 0 22px rgba(83,252,24,0); }
          40%  { text-shadow: 0 0 26px rgba(83,252,24,0.85), 0 0 58px rgba(83,252,24,0.35); }
          100% { text-shadow: 0 0 22px rgba(83,252,24,0.18); }
        }
        .val-lock { animation: valLock .7s ease-out backwards; }

        /* Scan-head riding the waveform draw: an inset-0 layer whose right edge
           carries the beam, translated -100% → 0 (pure transform). */
        @keyframes waveScan { from { transform: translateX(-100%); } to { transform: translateX(0); } }
        .wave-scan {
          position: absolute; inset: 0; pointer-events: none; opacity: 1;
          background:
            linear-gradient(to right, transparent calc(100% - 90px), rgba(83,252,24,0.10) calc(100% - 8px), transparent),
            linear-gradient(to right, transparent calc(100% - 2px), rgba(190,255,130,0.9) calc(100% - 1px));
          animation: waveScan 2.4s cubic-bezier(.16,1,.3,1) 0.25s backwards,
                     waveFade .3s linear 2.55s forwards;
        }
        @keyframes waveFade { from { opacity: 1; } to { opacity: 0; } }

        /* One-shot ping ring behind the headline clip count. */
        @keyframes headPing {
          0%   { opacity: 0.9; transform: translate(-50%,-50%) scale(0.35); }
          100% { opacity: 0;   transform: translate(-50%,-50%) scale(2.4); }
        }
        .head-ping {
          position: absolute; left: 50%; top: 50%; width: 1.6em; height: 1.6em;
          border-radius: 9999px; border: 1.5px solid rgba(83,252,24,0.8);
          box-shadow: 0 0 18px rgba(83,252,24,0.5); pointer-events: none;
          animation: headPing 1.1s cubic-bezier(.16,1,.3,1) .2s backwards;
          opacity: 0;
        }

        /* Faint instrument breathing on meter head-dots after they land. */
        @keyframes dotBreathe { 0%, 100% { opacity: 0.75; } 50% { opacity: 1; } }
        .meter-dot { animation: dotBreathe 3.4s ease-in-out 2.2s infinite; }

        /* ── Source map layer ───────────────────────────────────────────
           The waveform doubles as a map of the source recording: a mirrored
           audio body fades in under the draw, then the extracted clip regions
           land staggered as glowing bands. A faint radar-style rescan beam
           keeps drifting across afterwards so the instrument feels live. */
        @keyframes waveFillIn { from { opacity: 0; } to { opacity: 1; } }
        .wave-fill-in { animation: waveFillIn 1.4s ease-out 0.7s backwards; }
        @keyframes regionIn {
          0%   { opacity: 0; transform: scaleY(0.2); }
          100% { opacity: 1; transform: scaleY(1); }
        }
        .region-in {
          transform-origin: center; transform-box: fill-box;
          animation: regionIn .55s cubic-bezier(.16,1,.3,1) backwards;
        }
        @keyframes waveRescan {
          0%   { transform: translateX(-100%); opacity: 0; }
          3%   { opacity: 0.45; }
          26%  { opacity: 0.45; }
          30%  { transform: translateX(0); opacity: 0; }
          100% { transform: translateX(0); opacity: 0; }
        }
        .wave-rescan {
          position: absolute; inset: 0; pointer-events: none; opacity: 0;
          background:
            linear-gradient(to right, transparent calc(100% - 70px), rgba(83,252,24,0.07) calc(100% - 6px), transparent),
            linear-gradient(to right, transparent calc(100% - 2px), rgba(190,255,130,0.55) calc(100% - 1px));
          animation: waveRescan 11s linear 4s infinite;
        }

        /* Engagement radar — the triangle plot scales in once. */
        @keyframes radarIn { from { opacity: 0; transform: scale(0.5); } to { opacity: 1; transform: scale(1); } }
        .radar-in { transform-origin: center; transform-box: fill-box;
          animation: radarIn .8s cubic-bezier(.16,1,.3,1) backwards; }

        /* Blueprint grid — faint engineering-paper texture inside data tiles,
           fading out toward the bottom so content stays the focus. */
        .panel-grid {
          position: absolute; inset: 0; pointer-events: none;
          background:
            repeating-linear-gradient(to right, rgba(83,252,24,0.05) 0 1px, transparent 1px 26px),
            repeating-linear-gradient(to bottom, rgba(83,252,24,0.05) 0 1px, transparent 1px 26px);
          -webkit-mask-image: linear-gradient(160deg, rgba(0,0,0,0.9), transparent 62%);
          mask-image: linear-gradient(160deg, rgba(0,0,0,0.9), transparent 62%);
        }

        @media (prefers-reduced-motion: reduce) {
          .sonar-spin, .sonar-blip, .gradient-green { animation: none !important; }
          .wave-draw { animation: none !important; stroke-dashoffset: 0; }
          .btn-neon::after { display: none; }
          .clip-enter, .clip-develop, .clip-stamp { animation: none !important; }
          .clip-sweep, .clip-spot, .clip-ring { display: none !important; }
          .stat-enter, .viz-reveal, .val-lock, .meter-dot { animation: none !important; }
          .wave-scan, .head-ping { display: none !important; }
          .wave-fill-in, .region-in, .radar-in { animation: none !important; }
          .wave-rescan { display: none !important; }
          .tilt-card { transform: none !important; }
        }
      `}</style>

      <div className="grain" />
      <StudioBackdrop />

      {/* Top bar — passive sample walkthrough, not a self-serve studio */}
      <nav className="studio-nav border-b border-stone-800/60 bg-black/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-[1400px] mx-auto px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-5">
            <button onClick={() => onExit()} className="flex items-center gap-2.5">
              <LogoMark size={28} />
              <span className="serif text-2xl tracking-tight">Clipper.ai</span>
            </button>
            <span className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/[0.12] bg-white/[0.04] text-[11px] mono tracking-wider text-stone-300">
              <span className="w-1.5 h-1.5 rounded-full bg-[#53fc18]" />
              SAMPLE RUN · WHAT WE'D DELIVER
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => onExit()}
              className="text-sm text-stone-400 hover:text-stone-100 transition-colors"
            >
              ← Back to site
            </button>
            <button
              onClick={bookCall}
              className="btn-neon px-4 py-2 rounded-md font-medium text-sm"
            >
              Book a demo
            </button>
          </div>
        </div>
      </nav>

      <main className="relative z-10 max-w-[1400px] mx-auto px-8 py-10">
        {stage === 'upload' && <UploadView onFile={handleFile} fileRef={fileRef} history={history} onLoadRun={loadFromHistory} onDeleteRun={deleteRun} />}
        {stage === 'analyzing' && <AnalyzingView progress={progress} step={analysisStep} steps={analysisSteps} videoMeta={videoMeta} stageHistory={stageHistory} momentsFound={momentsFound} />}
        {stage === 'results' && (
          selectedClip ? (
            <ClipDetailView clip={selectedClip} onBack={() => setSelectedClip(null)} bookCall={bookCall} />
          ) : (
            <ResultsView clips={clips} onSelect={setSelectedClip} onReset={watchSample} videoMeta={videoMeta} processedMs={processedMs} bookCall={bookCall} />
          )
        )}
      </main>

      <CrosshairCursor />
    </div>
  );
}

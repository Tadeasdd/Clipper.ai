import React, { useState, useRef, useEffect } from 'react';
import { ArrowUpRight, Briefcase, Check, CheckCircle2, Clock, Database, Globe, Heart, MessageCircle, Play, Scissors, Share2, Shield, Sparkles, Zap } from 'lucide-react';
import { GlowOrb, Reveal, useReveal } from '../ui.jsx';
import { track } from '../../lib/analytics.jsx';
import { postLead } from '../../lib/api.js';
import { DEMO_CLIPS, SAMPLE_RECORDINGS } from '../../lib/demo.jsx';
import { prefersReducedMotion, useLoopProgress } from '../../lib/motion.jsx';
import { ClipFrame } from '../../studio/views.jsx';

function ClipPreviewPlayer() {
  const [platform, setPlatform] = useState('tiktok'); // tiktok | shorts | reels
  const [activeClipIdx, setActiveClipIdx] = useState(0);

  const clips = [
    {
      title: 'The 47-second framework that changed my Q4',
      caption: [
        { t: 0, w: 'So' }, { t: 0.15, w: 'the' }, { t: 0.3, w: 'thing' }, { t: 0.5, w: 'nobody' },
        { t: 0.75, w: 'tells' }, { t: 0.9, w: 'you' }, { t: 1.0, w: 'about' }, { t: 1.15, w: 'pricing' },
        { t: 1.4, w: 'is' }, { t: 1.55, w: 'that' }, { t: 1.7, w: 'cost-plus' },
        { t: 2.0, w: 'is' }, { t: 2.15, w: 'a' }, { t: 2.3, w: 'trap.' },
      ],
      author: '@maya.builds',
      handle: 'The Build Log · Ep 128',
      score: 94,
      duration: '0:47',
    },
    {
      title: 'When she changed her mind mid-sentence',
      caption: [
        { t: 0, w: 'I' }, { t: 0.15, w: 'used' }, { t: 0.3, w: 'to' }, { t: 0.45, w: 'think' },
        { t: 0.7, w: 'remote' }, { t: 0.95, w: 'work' }, { t: 1.15, w: 'was' }, { t: 1.3, w: 'the' },
        { t: 1.45, w: 'future' }, { t: 1.75, w: 'but' }, { t: 1.9, w: 'actually' },
        { t: 2.2, w: 'wait.' },
      ],
      author: '@deepwork.daily',
      handle: 'Deep Work Daily · Ep 53',
      score: 88,
      duration: '0:38',
    },
    {
      title: 'The framework, condensed',
      caption: [
        { t: 0, w: 'Three' }, { t: 0.2, w: 'questions.' },
        { t: 0.55, w: 'One:' }, { t: 0.8, w: 'who' }, { t: 0.95, w: 'pays?' },
        { t: 1.25, w: 'Two:' }, { t: 1.5, w: 'who' }, { t: 1.65, w: 'wins?' },
        { t: 1.95, w: 'Three:' }, { t: 2.25, w: 'what' }, { t: 2.4, w: 'breaks?' },
      ],
      author: '@the.signal.pod',
      handle: 'The Signal · Ep 207',
      score: 81,
      duration: '0:52',
    },
  ];

  const clip = clips[activeClipIdx];
  const totalCaptionDuration = 2.6;

  // Looping playback on the shared, time-based rAF engine (60fps, self-correcting).
  // The loop period equals the caption timeline, so captions play through and then
  // the next clip is selected. Reduced motion pins a settled frame and never loops.
  const progress = useLoopProgress({
    durationMs: totalCaptionDuration * 1000,
    resetKey: activeClipIdx,
    onLoop: () => setActiveClipIdx((i) => (i + 1) % clips.length),
    staticPct: 60,
  });

  const currentTime = (progress / 100) * totalCaptionDuration;
  const activeWordIdx = clip.caption.findIndex((w, i) => {
    const next = clip.caption[i + 1];
    return currentTime >= w.t && (!next || currentTime < next.t);
  });

  const platforms = [
    { id: 'tiktok', label: 'TikTok', ratio: '9:16', size: { w: 270, h: 480 } },
    { id: 'shorts', label: 'Shorts', ratio: '9:16', size: { w: 270, h: 480 } },
    { id: 'reels', label: 'Reels', ratio: '9:16', size: { w: 270, h: 480 } },
  ];
  const currentPlatform = platforms.find((p) => p.id === platform);

  return (
    <section className="relative z-10 max-w-[1400px] mx-auto px-6 md:px-8 py-16 border-t border-white/[0.12] overflow-hidden">
      <GlowOrb size={500} opacity={0.1} className="right-0 top-1/2 -translate-y-1/2" />
      <Reveal>
        <div className="grid md:grid-cols-[1.4fr_1fr] gap-12 items-center">
          {/* Left: copy */}
          <div>
            <div className="text-[10px] mono text-[var(--color-brand)] mb-4 tracking-[0.2em] uppercase flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[var(--color-brand)]" /> 
              The output
            </div>
            <h2 className="serif text-5xl md:text-6xl leading-[1.02] mb-5">
              Native captions. <span className="italic gradient-green">Native reframes.</span>
            </h2>
            <p className="text-stone-400 leading-relaxed mb-8 max-w-xl text-lg">
              Every clip ships with platform-tuned captions, vertical reframe, and a hook generated specifically for the destination feed. No post-processing. No reformatting. Drop and publish.
            </p>

            {/* Platform tabs */}
            <div className="inline-flex items-center gap-1 p-1 rounded-full border border-[var(--color-brand)]/20 bg-black/40 mb-6">
              {platforms.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPlatform(p.id)}
                  className={`px-4 py-1.5 rounded-full text-[10px] mono tracking-wider uppercase ${platform === p.id ? 'text-black' : 'text-stone-400 hover:text-stone-200'}`}
                  style={platform === p.id ? { backgroundColor: 'var(--color-brand)', boxShadow: '0 0 16px rgba(83,252,24,0.4)' } : {}}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Clip selector */}
            <div className="space-y-2 max-w-md">
              {clips.map((c, i) => (
                <button
                  key={i}
                  onClick={() => setActiveClipIdx(i)}
                  className={`w-full text-left p-3 rounded-md border transition-all ${
                    i === activeClipIdx
                      ? 'border-[var(--color-brand)]/40 bg-[var(--color-brand)]/[0.05]'
                      : 'border-[var(--color-brand)]/[0.08] bg-[var(--color-brand)]/[0.01] hover:border-[var(--color-brand)]/20'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <div
                        className="serif text-base"
                        style={i === activeClipIdx ? { color: 'var(--color-brand)', textShadow: '0 0 8px rgba(83,252,24,0.4)' } : { color: '#a8a29e' }}
                      >
                        {c.score}
                      </div>
                      <div className="text-[10px] mono text-stone-500 tracking-wider uppercase">virality</div>
                    </div>
                    <div className="text-[10px] mono text-stone-500 tracking-wider">{c.duration}</div>
                  </div>
                  <div className="text-sm text-stone-200 leading-snug">{c.title}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Right: phone frame */}
          <div className="flex justify-center">
            <div
              className="relative rounded-[36px] border-[3px] border-stone-800 bg-black p-2 shadow-[0_0_80px_-20px_rgba(83,252,24,0.4)]"
              style={{ width: currentPlatform.size.w, height: currentPlatform.size.h }}
            >
              {/* Notch */}
              <div className="absolute top-2 left-1/2 -translate-x-1/2 w-16 h-4 rounded-b-2xl bg-stone-900 z-20" />

              {/* Screen */}
              <div className="relative w-full h-full rounded-[28px] overflow-hidden bg-gradient-to-br from-stone-900 via-black to-stone-900">
                {/* Faux video bg — animated gradient */}
                <div
                  className="absolute inset-0"
                  style={{
                    background:
                      'radial-gradient(ellipse at 30% 40%, rgba(83,252,24,0.15) 0%, transparent 50%), radial-gradient(ellipse at 70% 60%, rgba(150,80,200,0.12) 0%, transparent 50%)',
                  }}
                />

                {/* Top status bar */}
                <div className="absolute top-0 inset-x-0 flex items-center justify-between px-4 pt-4 z-10 text-[10px] mono text-white/80">
                  <span>9:41</span>
                  <span className="flex items-center gap-1">
                    <span>●●●●</span>
                    <span>5G</span>
                    <span>100%</span>
                  </span>
                </div>

                {/* Platform UI overlay (top) */}
                <div className="absolute top-10 inset-x-0 flex items-center justify-between px-4 z-10">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[var(--color-brand)] to-emerald-500" />
                    <div>
                      <div className="text-xs text-white font-medium">{clip.author}</div>
                      <div className="text-[9px] text-white/60">{clip.handle}</div>
                    </div>
                  </div>
                  <button className="px-2.5 py-1 rounded-md bg-[var(--color-brand)] text-black text-[10px] font-medium">Follow</button>
                </div>

                {/* Animated waveform "video" */}
                <div className="absolute inset-x-6 top-1/2 -translate-y-12 flex items-end gap-0.5 h-24">
                  {Array.from({ length: 38 }).map((_, j) => {
                    const distance = Math.abs(j - 19);
                    const baseHeight = 30 + Math.abs(Math.sin(j * 0.5 + currentTime * 3)) * 70;
                    const isActive = j / 38 < progress / 100;
                    return (
                      <div
                        key={j}
                        className="flex-1 rounded-sm h-full"
                        style={{
                          transform: `scaleY(${baseHeight / 100})`,
                          transformOrigin: 'bottom',
                          background: isActive ? 'var(--color-brand)' : 'rgba(255,255,255,0.3)',
                          boxShadow: isActive && distance < 4 ? '0 0 6px var(--color-brand)' : 'none',
                        }}
                      />
                    );
                  })}
                </div>

                {/* Live captions — word-by-word */}
                <div className="absolute bottom-20 inset-x-4 z-10">
                  <div className="flex flex-wrap gap-x-1.5 gap-y-1 justify-center">
                    {clip.caption.map((word, i) => {
                      const isPast = i < activeWordIdx;
                      const isActive = i === activeWordIdx;
                      return (
                        <span
                          key={i}
                          className="text-base font-bold transition-all"
                          style={{
                            color: isActive ? 'var(--color-brand)' : isPast ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.4)',
                            textShadow: isActive
                              ? '0 0 12px rgba(83,252,24,0.8), 0 2px 4px rgba(0,0,0,0.8)'
                              : '0 2px 4px rgba(0,0,0,0.8)',
                            transform: isActive ? 'scale(1.08)' : 'scale(1)',
                          }}
                        >
                          {word.w}
                        </span>
                      );
                    })}
                  </div>
                </div>

                {/* Right rail — engagement */}
                <div className="absolute right-3 bottom-24 z-10 flex flex-col items-center gap-4">
                  <button aria-label="Like" className="flex flex-col items-center text-white/80 hover:text-[var(--color-brand)]">
                    <Heart className="w-6 h-6" />
                  </button>
                  <button aria-label="Comment" className="flex flex-col items-center text-white/80">
                    <MessageCircle className="w-6 h-6" />
                  </button>
                  <button aria-label="Share" className="flex flex-col items-center text-white/80">
                    <Share2 className="w-6 h-6" />
                  </button>
                </div>

                {/* Progress bar */}
                <div className="absolute bottom-3 inset-x-4 z-10">
                  <div className="h-0.5 rounded-full bg-white/20 overflow-hidden">
                    <div
                      className="h-full w-full rounded-full"
                      style={{
                        transform: `scaleX(${progress / 100})`,
                        transformOrigin: 'left',
                        background: 'linear-gradient(90deg, var(--color-brand), #aaff66)',
                        boxShadow: '0 0 6px var(--color-brand)',
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between mt-1 text-[9px] mono text-white/60">
                    <span>{(currentTime).toFixed(1)}s</span>
                    <span>{clip.duration}</span>
                  </div>
                </div>

                {/* Pulsing "clipper.ai" watermark badge */}
                <div className="absolute top-20 right-3 z-10 px-1.5 py-0.5 rounded bg-black/40 backdrop-blur text-[8px] mono text-[var(--color-brand)] tracking-wider">
                  CLIPPER.AI · {clip.score}
                </div>
              </div>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

/* ──────────────────────────────────────────────────────────── INTERACTIVE DEMO
   Pick a sample recording → the studio opens and runs the real pipeline on it.
   The product *is* the demo. This section used to render its own inline
   "analyzing" console, which meant the site had two different loading screens
   for the same run; now there is exactly one — the studio's AnalyzingView —
   and this card only chooses what gets fed into it. */

export { ClipPreviewPlayer };

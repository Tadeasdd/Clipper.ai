import React, { useState, useRef, useEffect } from 'react';
import { ArrowUpRight, Briefcase, Check, CheckCircle2, Clock, Database, Globe, Heart, MessageCircle, Play, Scissors, Share2, Shield, Sparkles, Zap } from 'lucide-react';
import { GlowOrb, Reveal, useReveal } from '../ui.jsx';
import { track } from '../../lib/analytics.jsx';
import { postLead } from '../../lib/api.js';
import { DEMO_CLIPS, SAMPLE_RECORDINGS } from '../../lib/demo.jsx';
import { prefersReducedMotion, useLoopProgress } from '../../lib/motion.jsx';
import { ClipFrame } from '../../studio/views.jsx';

function SignaturePath() {
  const wrapRef = useRef(null);
  const [inView, setInView] = useState(false);
  const [motionOK, setMotionOK] = useState(false);
  const [hov, setHov] = useState(null);
  useEffect(() => {
    if (!prefersReducedMotion()) setMotionOK(true);
    const el = wrapRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) { setInView(true); obs.disconnect(); } }),
      { threshold: 0.2, rootMargin: '0px 0px -10% 0px' }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Six clips, ranked by score. `src` is the slice of the waveform each was cut
  // from (x-range on the timeline) with matching timestamps for the readout.
  const branches = [
    { x: 660,  y: 20,  score: 94, hook: 'Hook',  src: [188, 200], t: ['00:38:12', '00:38:51'] },
    { x: 770,  y: 50,  score: 88, hook: 'Turn',  src: [96, 108],  t: ['00:16:44', '00:17:21'] },
    { x: 880,  y: 80,  score: 81, hook: 'Quote', src: [312, 324], t: ['01:09:30', '01:10:02'] },
    { x: 990,  y: 110, score: 76, hook: 'List',  src: [408, 420], t: ['01:33:05', '01:33:41'] },
    { x: 1100, y: 140, score: 71, hook: 'Punch', src: [130, 142], t: ['00:26:10', '00:26:48'] },
    { x: 1180, y: 160, score: 65, hook: 'CTA',   src: [345, 357], t: ['01:18:22', '01:18:55'] },
  ];
  const branchD = (b) =>
    `M478 104 C ${478 + (b.x - 478) * 0.4} 104, ${b.x - 70} ${b.y + 31}, ${b.x - 16} ${b.y + 31}`;
  // One shared 7s cycle keeps every spark, ping, and flash in phase.
  const CYC = '7s';
  const f3 = (n) => n.toFixed(3);
  const mono = { fontFamily: "'JetBrains Mono', Menlo, monospace", textTransform: 'uppercase' };
  const readout = hov == null
    ? null
    : `Clip 0${hov + 1} · ${branches[hov].hook} · ${branches[hov].t[0]} → ${branches[hov].t[1]} · Score ${branches[hov].score}`;
  const frameLabel = (b, i) =>
    `Clip ${i + 1}: ${b.hook}, cut at ${b.t[0]} to ${b.t[1]}, virality score ${b.score}`;

  return (
    <div ref={wrapRef} className={`sigpath mt-14 mb-2 hidden md:block ${inView ? 'in' : ''}`}>
      <style>{`
        .sigpath { opacity: 0; transition: opacity 0.8s ease; }
        .sigpath.in { opacity: 1; }
        .sigpath .sig-draw {
          stroke-dasharray: 1; stroke-dashoffset: 1;
          transition: stroke-dashoffset 1.6s cubic-bezier(0.16, 1, 0.3, 1),
                      stroke-opacity 0.25s ease, stroke-width 0.25s ease;
        }
        .sigpath .sig-branch { transition-duration: 1.1s, 0.25s, 0.25s; }
        .sigpath.in .sig-draw { stroke-dashoffset: 0; }
        .sigpath .sig-frame, .sigpath .sig-meta { opacity: 0; transition: opacity 0.5s ease; }
        .sigpath.in .sig-frame, .sigpath.in .sig-meta { opacity: 1; }
        .sigpath.in .sig-branch { transition-delay: 0.9s, 0s, 0s; }
        .sigpath.in .sig-frame { transition-delay: 1.5s; }
        .sigpath.in .sig-meta { transition-delay: 0.6s; }
        .sigpath .sig-chip { opacity: 0; transform: translateY(4px); transition: opacity 0.45s ease, transform 0.45s cubic-bezier(0.16,1,0.3,1), fill-opacity 0.25s ease; }
        .sigpath.in .sig-chip { opacity: 1; transform: translateY(0); }
        .sigpath .sig-hit { cursor: pointer; outline: none; }
        .sigpath .sig-rect { transition: stroke-opacity 0.25s ease, fill-opacity 0.25s ease; }
        .sigpath .sig-band { transition: opacity 0.3s ease; }
        .sigpath .sig-loop { transition: opacity 0.35s ease; }
        .sigpath .sig-readout { transition: opacity 0.25s ease; }
      `}</style>
      <svg
        viewBox="0 0 1240 232"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-auto overflow-visible"
        role="group"
        aria-label="How it works: one long recording goes in, six short clips ranked by virality score come out. Focus a clip to see where it was cut."
        onMouseLeave={() => setHov(null)}
      >
        <defs>
          <linearGradient id="sigStroke" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="var(--color-brand)" stopOpacity="0.45" />
            <stop offset="0.8" stopColor="var(--color-brand)" />
            <stop offset="1" stopColor="#b8ff7d" />
          </linearGradient>
          <filter id="sigGlow" x="-300%" y="-300%" width="700%" height="700%">
            <feGaussianBlur stdDeviation="2.6" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* the long-form: one continuous waveform stroke */}
        <path
          id="sigMain"
          className="sig-draw"
          pathLength="1"
          d="M10 104 H80
             l9 -34 l10 68 l9 -50 l10 30 l9 -14
             H170
             l9 -50 l10 82 l9 -60 l10 36 l9 -8
             H300
             l9 -26 l10 46 l9 -36 l10 16
             H400
             l9 -14 l10 24 l9 -10
             H462"
          stroke="url(#sigStroke)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"
        />

        {/* source slice marker — appears when a clip is hovered/focused */}
        {branches.map((b, i) => (
          <g key={i} className="sig-band" opacity={hov === i ? 1 : 0} pointerEvents="none">
            <rect x={b.src[0]} y={46} width={b.src[1] - b.src[0]} height={98} fill="rgba(83,252,24,0.07)" />
            <path d={`M${b.src[0]} 48 V144 M${b.src[1]} 48 V144`}
              stroke="var(--color-brand)" strokeOpacity="0.55" strokeWidth="1" strokeDasharray="3 3" />
            <text x={(b.src[0] + b.src[1]) / 2} y={40} textAnchor="middle"
              fill="var(--color-brand)" fillOpacity="0.8" fontSize="10" letterSpacing="1" style={mono}>
              {b.t[0]}
            </text>
          </g>
        ))}

        {/* timecode ruler under the recording */}
        <g className="sig-meta">
          <path d="M10 144 H462" stroke="#44403c" strokeWidth="1" />
          {Array.from({ length: 9 }, (_, i) => 10 + i * 56.5).map((x) => (
            <path key={x} d={`M${x} 144 v5`} stroke="#57534e" strokeWidth="1" />
          ))}
          <text x="10" y="166" fill="#78716c" fontSize="10" letterSpacing="1.6" style={mono}>00:00:00</text>
          <text x="462" y="166" textAnchor="end" fill="#78716c" fontSize="10" letterSpacing="1.6" style={mono}>01:47:55</text>
          <text x="10" y="192" fill="#57534e" fontSize="10" letterSpacing="2.2" style={mono}>One recording</text>
          <text x="1230" y="14" textAnchor="end" fill="#57534e" fontSize="10" letterSpacing="2.2" style={mono}>A week of clips · ranked by score</text>
        </g>

        {/* console readout — prints the hovered clip's provenance */}
        <g className="sig-readout sig-meta" opacity={inView ? 1 : 0}>
          <text x="520" y="206" fontSize="10" letterSpacing="1.4" style={mono}
            fill={hov == null ? '#57534e' : 'var(--color-brand)'} fillOpacity={hov == null ? 1 : 0.9}>
            {hov == null ? '→ Hover a clip to trace it back to the recording' : `→ ${readout}`}
          </text>
        </g>

        {/* the node where moments are found */}
        <circle className="sig-frame" cx="470" cy="104" r="5" fill="none" stroke="var(--color-brand)" strokeWidth="1.5" />
        <circle className="sig-frame" cx="470" cy="104" r="1.8" fill="var(--color-brand)" />

        {/* branches: one curve per clip */}
        {branches.map((b, i) => (
          <path
            key={i}
            className="sig-draw sig-branch"
            pathLength="1"
            id={`sigBr${i}`}
            d={branchD(b)}
            stroke="var(--color-brand)"
            strokeOpacity={hov === i ? 0.95 : (hov == null ? 0.45 - i * 0.04 : 0.14)}
            strokeWidth={hov === i ? 1.75 : 1.25}
            strokeLinecap="round"
          />
        ))}

        {/* the clips: six 9:16 frames with caption ticks, score chips, hit areas */}
        {branches.map((b, i) => {
          const lit = hov === i;
          const dim = hov != null && !lit;
          return (
            <g
              key={i}
              className="sig-hit"
              tabIndex={inView ? 0 : -1}
              role="img"
              aria-label={frameLabel(b, i)}
              onMouseEnter={() => setHov(i)}
              onFocus={() => setHov(i)}
              onBlur={() => setHov(null)}
              onClick={() => setHov(i)}
            >
              {/* generous invisible hit area */}
              <rect x={b.x - 20} y={b.y - 8} width="40" height="74" fill="transparent" pointerEvents="all" />
              <g className="sig-frame">
                <rect className="sig-rect" x={b.x - 13} y={b.y + 8} width="26" height="46" rx="5"
                  stroke="var(--color-brand)"
                  strokeOpacity={lit ? 1 : (dim ? 0.3 : 0.85 - i * 0.1)}
                  strokeWidth={lit ? 1.75 : 1.25}
                  fill="var(--color-brand)"
                  fillOpacity={lit ? 0.14 : 0.04} />
                <path d={`M${b.x - 6} ${b.y + 42} h12 M${b.x - 5} ${b.y + 47} h10`}
                  stroke="var(--color-brand)" strokeOpacity={lit ? 0.9 : (dim ? 0.2 : 0.5 - i * 0.05)} strokeWidth="1" strokeLinecap="round" />
              </g>
              <text className="sig-chip" x={b.x} y={b.y} textAnchor="middle"
                fill="var(--color-brand)" fillOpacity={lit ? 1 : (dim ? 0.3 : 1 - i * 0.11)} fontSize="11" letterSpacing="1"
                style={{ ...mono, transitionDelay: inView ? `${1.7 + i * 0.1}s, ${1.7 + i * 0.1}s, 0s` : '0s' }}>
                {b.score}
              </text>
              {/* hook label appears under the lit frame */}
              <text x={b.x} y={b.y + 68} textAnchor="middle" pointerEvents="none"
                fill="var(--color-brand)" fontSize="10" letterSpacing="1.6" style={mono}
                opacity={lit ? 0.8 : 0} className="sig-band">
                {b.hook}
              </text>
            </g>
          );
        })}

        {/* ── the loop: spark → node ping → branch sparks → frame flashes ──
            All animations share one cycle on the document timeline, so they stay
            in phase no matter when this layer mounts. Dimmed while a clip is
            being inspected; never rendered under prefers-reduced-motion. */}
        {inView && motionOK && (
          <g className="sig-loop" opacity={hov == null ? 1 : 0.2} pointerEvents="none">
            {branches.map((b, i) => {
              const t1 = 0.48 + i * 0.022;
              return (
                <rect key={i} x={b.x - 12} y={b.y + 9} width="24" height="44" rx="4"
                  fill="var(--color-brand)" opacity="0">
                  <animate attributeName="opacity" dur={CYC} repeatCount="indefinite"
                    values="0;0;0.22;0;0"
                    keyTimes={`0;${f3(t1)};${f3(t1 + 0.015)};${f3(t1 + 0.1)};1`} />
                </rect>
              );
            })}
            <circle cx="470" cy="104" fill="none" stroke="var(--color-brand)" strokeWidth="1" r="5" opacity="0">
              <animate attributeName="r" dur={CYC} repeatCount="indefinite"
                values="5;5;5;16;16" keyTimes="0;0.26;0.261;0.4;1" />
              <animate attributeName="opacity" dur={CYC} repeatCount="indefinite"
                values="0;0;0.7;0;0" keyTimes="0;0.26;0.275;0.4;1" />
            </circle>
            <g filter="url(#sigGlow)">
              <circle r="2.8" fill="#d9ffba" opacity="0">
                <animateMotion dur={CYC} repeatCount="indefinite" calcMode="linear"
                  keyPoints="0;1;1" keyTimes="0;0.26;1">
                  <mpath href="#sigMain" />
                </animateMotion>
                <animate attributeName="opacity" dur={CYC} repeatCount="indefinite"
                  values="0;1;1;0;0" keyTimes="0;0.02;0.24;0.265;1" />
              </circle>
              {branches.map((b, i) => {
                const t0 = 0.27 + i * 0.022;
                const t1 = 0.48 + i * 0.022;
                return (
                  <circle key={i} r="2.1" fill="#aaff66" opacity="0">
                    <animateMotion dur={CYC} repeatCount="indefinite" calcMode="linear"
                      keyPoints="0;0;1;1" keyTimes={`0;${f3(t0)};${f3(t1)};1`}>
                      <mpath href={`#sigBr${i}`} />
                    </animateMotion>
                    <animate attributeName="opacity" dur={CYC} repeatCount="indefinite"
                      values="0;0;0.9;0.9;0;0"
                      keyTimes={`0;${f3(t0)};${f3(t0 + 0.012)};${f3(t1 - 0.012)};${f3(t1)};1`} />
                  </circle>
                );
              })}
            </g>
          </g>
        )}
      </svg>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────── MANIFESTO
   One giant statement that lights up word by word as it scrolls through the
   viewport — the Linear/Arc "thesis" moment. Scroll-linked via a passive,
   rAF-throttled handler; reduced motion renders it fully lit. */

export { SignaturePath };

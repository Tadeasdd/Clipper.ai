import React, { useState, useRef, useEffect } from 'react';
import { ArrowUpRight, Briefcase, Check, CheckCircle2, Clock, Database, Globe, Heart, MessageCircle, Play, Scissors, Share2, Shield, Sparkles, Zap } from 'lucide-react';
import { GlowOrb, Reveal, useReveal } from '../ui.jsx';
import { track } from '../../lib/analytics.jsx';
import { postLead } from '../../lib/api.js';
import { DEMO_CLIPS, SAMPLE_RECORDINGS } from '../../lib/demo.jsx';
import { prefersReducedMotion, useLoopProgress } from '../../lib/motion.jsx';
import { ClipFrame } from '../../studio/views.jsx';

function IntegrationGlyph({ name }) {
  const common = "w-8 h-8 text-stone-300 group-hover:text-[var(--color-brand)] transition-all duration-300 group-hover:scale-110";
  switch (name) {
    case 'Zoom':
      // Rounded camera body + lens — video-meeting tool
      return (
        <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round">
          <rect x="2.5" y="6.5" width="13" height="11" rx="3" />
          <path d="M15.5 10.2 L21.5 7.2 v9.6 l-6 -3 z" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'Riverside':
      // Centered waveform — reads as audio recording
      return (
        <svg viewBox="0 0 24 24" className={common} fill="currentColor" stroke="none">
          <rect x="3.2" y="9" width="2" height="6" rx="1" />
          <rect x="6.7" y="6" width="2" height="12" rx="1" />
          <rect x="10.2" y="2.5" width="2" height="19" rx="1" />
          <rect x="13.7" y="6.5" width="2" height="11" rx="1" />
          <rect x="17.2" y="8.5" width="2" height="7" rx="1" />
        </svg>
      );
    case 'Descript':
      // App tile + play — media/transcript editor
      return (
        <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
          <rect x="3" y="3.5" width="18" height="17" rx="4.5" />
          <path d="M10 8.8 L15.5 12 L10 15.2 Z" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'TikTok':
      // Eighth-note glyph with the signature offset
      return (
        <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M13 4 v9.6 a3.6 3.6 0 1 1 -3.6 -3.6" />
          <path d="M13 4 c0 2.6 2.1 4.7 4.8 4.7" />
          <path d="M10.2 4.2 v9.6 a3.6 3.6 0 1 1 -3.6 -3.6" opacity="0.32" />
        </svg>
      );
    case 'Instagram':
      // Rounded frame + lens + flash dot
      return (
        <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.6">
          <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
          <circle cx="12" cy="12" r="4.2" />
          <circle cx="17" cy="7" r="1" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'LinkedIn':
      // The "in" mark
      return (
        <svg viewBox="0 0 24 24" className={common} fill="currentColor">
          <rect x="3" y="9" width="3.2" height="11" rx="0.4" />
          <circle cx="4.6" cy="5.2" r="1.9" />
          <path d="M9.5 9h3v1.7c.6-1 1.8-2 3.6-2 3.4 0 4.4 2.2 4.4 5.1V20h-3.3v-5.4c0-1.3-.3-2.4-1.7-2.4-1.5 0-2 1.1-2 2.4V20H9.5z" />
        </svg>
      );
    case 'Drive':
      // Official Google Drive mark (three blades)
      return (
        <svg viewBox="0 0 24 24" className={common} fill="currentColor">
          <path d="M12.01 1.485c-2.082 0-3.754.02-3.743.047.01.02 1.708 3.001 3.774 6.62l3.76 6.574h3.76c2.081 0 3.753-.02 3.742-.047-.005-.02-1.708-3.001-3.775-6.62l-3.76-6.574zm-4.76 1.73a789.828 789.861 0 0 0-3.63 6.319L0 15.868l1.89 3.298 1.885 3.297 3.62-6.335 3.618-6.33-1.88-3.287C8.1 4.704 7.255 3.22 7.25 3.214zm2.259 12.653-.203.348c-.114.198-.96 1.672-1.88 3.287a423.93 423.948 0 0 1-1.698 2.97c-.01.026 3.24.042 7.222.042h7.244l1.796-3.157c.992-1.734 1.85-3.23 1.906-3.323l.104-.167h-7.249z" />
        </svg>
      );
    case 'Dropbox':
      // Official Dropbox mark (five-facet open box)
      return (
        <svg viewBox="0 0 24 24" className={common} fill="currentColor">
          <path d="M6 1.807L0 5.629l6 3.822 6.001-3.822L6 1.807zM18 1.807l-6 3.822 6 3.822 6-3.822-6-3.822zM0 13.274l6 3.822 6.001-3.822L6 9.452l-6 3.822zM18 9.452l-6 3.822 6 3.822 6-3.822-6-3.822zM6 18.371l6.001 3.822 6-3.822-6-3.822L6 18.371z" />
        </svg>
      );
    case 'Notion':
      // The Notion "N"
      return (
        <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" strokeLinecap="round">
          <rect x="3.5" y="3.5" width="17" height="17" rx="2" />
          <path d="M8.5 17V8l7 8.5V8" />
        </svg>
      );
    case 'Slack':
      // Official Slack hash (eight rounded lozenges)
      return (
        <svg viewBox="0 0 24 24" className={common} fill="currentColor">
          <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
        </svg>
      );
    default:
      return <div className={common + " border border-current rounded-md"} />;
  }
}

/* ──────────────────────────────────────────────────────────── LANDING */

export { IntegrationGlyph };

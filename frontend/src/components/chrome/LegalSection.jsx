import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ArrowUpRight, BookOpen, Building2, Film, Globe, Layers, Play, Search, Workflow } from 'lucide-react';
import { NeonGrid, GlowOrb, LogoMark, Reveal } from '../ui.jsx';
import { track } from '../../lib/analytics.jsx';

function LegalSection({ title, children }) {
  return (
    <div className="mb-10">
      <h2 className="serif text-2xl mb-3">{title}</h2>
      <div className="text-sm text-stone-400 leading-relaxed space-y-3">{children}</div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────── FAQ ITEM
   Reusable accordion row used by both the global FAQ and pricing FAQ */

export { LegalSection };

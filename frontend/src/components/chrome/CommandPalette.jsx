import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ArrowUpRight, BookOpen, Building2, Film, Globe, Layers, Play, Search, Workflow } from 'lucide-react';
import { NeonGrid, GlowOrb, LogoMark, Reveal } from '../ui.jsx';
import { track } from '../../lib/analytics.jsx';

function CommandPalette({ open, onClose, goto, bookCall, openApp }) {
  const [q, setQ] = useState('');
  const [idx, setIdx] = useState(0);
  const inputRef = useRef(null);

  const actions = useMemo(() => [
    { group: 'Actions', icon: ArrowUpRight, label: 'Book a demo', hint: 'Talk to us', run: () => bookCall && bookCall() },
    { group: 'Actions', icon: Play, label: 'Watch the sample run', hint: 'Live pipeline', run: () => openApp && openApp() },
    { group: 'Go to', icon: Film, label: 'Home', run: () => goto('home') },
    { group: 'Go to', icon: Workflow, label: 'How it works', run: () => goto('product') },
    { group: 'Go to', icon: Layers, label: 'Pricing', run: () => goto('pricing') },
    { group: 'Go to', icon: Building2, label: 'Company', run: () => goto('company') },
    { group: 'Go to', icon: BookOpen, label: 'Resources', run: () => goto('docs') },
    { group: 'Go to', icon: Globe, label: 'Status', run: () => goto('status') },
  ], [goto, bookCall, openApp]);

  const norm = q.trim().toLowerCase();
  const shown = norm ? actions.filter((a) => (a.group + ' ' + a.label + ' ' + (a.hint || '')).toLowerCase().includes(norm)) : actions;

  // Reset + focus on open.
  useEffect(() => {
    if (!open) return;
    setQ('');
    setIdx(0);
    const t = setTimeout(() => inputRef.current && inputRef.current.focus(), 30);
    return () => clearTimeout(t);
  }, [open]);
  useEffect(() => { setIdx(0); }, [norm]);

  // Keyboard nav while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); setIdx((i) => Math.min(shown.length - 1, i + 1)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((i) => Math.max(0, i - 1)); }
      else if (e.key === 'Enter') {
        e.preventDefault();
        const a = shown[idx];
        if (a) { onClose(); a.run(); track('cmdk_run', { label: a.label }); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, shown, idx, onClose]);

  if (!open) return null;

  let lastGroup = null;
  return (
    <>
      <div className="cmdk-backdrop" onClick={onClose} />
      <div className="cmdk-panel" role="dialog" aria-modal="true" aria-label="Command palette">
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/[0.08]">
          <Search className="w-4 h-4 text-stone-500 flex-shrink-0" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Where to?"
            aria-label="Search pages and actions"
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-stone-600 text-stone-100"
          />
          <kbd className="kbd">esc</kbd>
        </div>
        <div className="cmdk-list py-2">
          {shown.length === 0 && (
            <div className="px-4 py-6 text-sm text-stone-500">Nothing matches “{q.trim()}”.</div>
          )}
          {shown.map((a, i) => {
            const header = a.group !== lastGroup ? a.group : null;
            lastGroup = a.group;
            return (
              <div key={a.label}>
                {header && (
                  <div className="px-4 pt-2 pb-1 text-[10px] mono tracking-[0.18em] uppercase text-stone-600">{header}</div>
                )}
                <button
                  data-active={i === idx}
                  onMouseEnter={() => setIdx(i)}
                  onClick={() => { onClose(); a.run(); track('cmdk_run', { label: a.label }); }}
                  className="cmdk-item w-full flex items-center gap-3 px-4 py-2.5 text-left"
                >
                  <a.icon className="cmdk-glyph w-4 h-4 text-stone-500 flex-shrink-0" />
                  <span className="text-sm text-stone-200 flex-1">{a.label}</span>
                  {a.hint && <span className="text-[10px] mono text-stone-600 tracking-wider uppercase">{a.hint}</span>}
                  {i === idx && <kbd className="kbd">↵</kbd>}
                </button>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-3 px-4 py-2.5 border-t border-white/[0.08] text-[10px] mono text-stone-600 tracking-wider">
          <span className="flex items-center gap-1.5"><kbd className="kbd">↑↓</kbd> navigate</span>
          <span className="flex items-center gap-1.5"><kbd className="kbd">↵</kbd> select</span>
        </div>
      </div>
    </>
  );
}

/* ──────────────────────────────────────────────────────────── PAGE HELPERS */

export { CommandPalette };

/* Recompute every split module's import header from its real AST.
   Regex scanning failed twice (apostrophes in prose; "video/*" opening a fake
   comment) — the parser sees actual code, so identifiers can't be lost. */
import { parse } from '@babel/parser';
import { readFileSync, writeFileSync } from 'node:fs';

const MODULES = [
  'src/lib/analytics.jsx', 'src/lib/seo.jsx', 'src/lib/perf.jsx', 'src/lib/motion.jsx',
  'src/lib/demo.jsx', 'src/lib/tilt.jsx', 'src/components/ui.jsx',
  'src/components/landing-visuals.jsx', 'src/components/site-chrome.jsx',
  'src/studio/views.jsx', 'src/pages/Landing.jsx', 'src/pages/Product.jsx',
  'src/pages/Pricing.jsx', 'src/pages/Legal.jsx', 'src/pages/Docs.jsx',
  'src/pages/Status.jsx', 'src/pages/Company.jsx',
];
const LUCIDE = new Set('Upload Sparkles TrendingUp Scissors Play Download Share2 Clock Zap ChevronRight Film CheckCircle2 Loader2 ArrowUpRight Flame Users Search Heart MessageCircle Check X Mic Code Globe Shield Workflow Database Layers GitBranch BookOpen Terminal Building2 Briefcase Mail'.split(' '));
const HOOKS = ['useState', 'useRef', 'useEffect', 'useMemo'];

// strip current import header; keep body + export footer
const bodies = {}, exportsOf = {};
for (const f of MODULES) {
  const lines = readFileSync(f, 'utf8').split('\n');
  let i = 0;
  while (i < lines.length && (lines[i].startsWith('import ') || lines[i].trim() === '')) i++;
  const body = lines.slice(i).join('\n');
  bodies[f] = body;
  const m = body.match(/^export \{ ([^}]+) \};/m);
  exportsOf[f] = new Set(m ? m[1].split(',').map((s) => s.trim()) : []);
}
const owner = {};
for (const f of MODULES) for (const n of exportsOf[f]) owner[n] = f;

const SKIP_KEYS = new Set(['type', 'start', 'end', 'loc', 'range', 'leadingComments', 'trailingComments', 'innerComments', 'comments', 'extra']);
function collect(node, out) {
  if (!node) return;
  if (Array.isArray(node)) { for (const n of node) collect(n, out); return; }
  if (typeof node !== 'object' || !node.type) return;
  switch (node.type) {
    case 'Identifier': case 'JSXIdentifier': out.add(node.name); return;
    case 'MemberExpression': case 'OptionalMemberExpression':
      collect(node.object, out); if (node.computed) collect(node.property, out); return;
    case 'ObjectProperty':
      if (node.computed) collect(node.key, out);
      collect(node.value, out); return;
    case 'ObjectMethod': case 'ClassMethod': case 'ClassProperty':
      if (node.computed) collect(node.key, out);
      collect(node.params, out); collect(node.body, out); collect(node.value, out); return;
    case 'JSXAttribute': collect(node.value, out); return;
    case 'JSXMemberExpression': collect(node.object, out); return;
    case 'ExportNamedDeclaration': collect(node.declaration, out); return; // skip specifier list
    default:
      for (const k of Object.keys(node)) if (!SKIP_KEYS.has(k)) collect(node[k], out);
  }
}

function rel(from, to) {
  const f = from.split('/').slice(0, -1), t = to.split('/');
  while (f.length && t.length && f[0] === t[0]) { f.shift(); t.shift(); }
  return (f.length ? '../'.repeat(f.length) : './') + t.join('/');
}

const graph = {};
for (const f of MODULES) {
  const ast = parse(bodies[f], { sourceType: 'module', plugins: ['jsx'] });
  const ids = new Set();
  collect(ast.program.body, ids);
  const local = exportsOf[f];
  const need = {};
  for (const id of ids) {
    if (local.has(id)) continue;
    if (owner[id] && owner[id] !== f) (need[owner[id]] ||= new Set()).add(id);
  }
  const icons = [...ids].filter((i) => LUCIDE.has(i)).sort();
  const usedHooks = HOOKS.filter((h) => ids.has(h));
  const hdr = [`import React${usedHooks.length ? `, { ${usedHooks.join(', ')} }` : ''} from 'react';`];
  if (icons.length) hdr.push(`import { ${icons.join(', ')} } from 'lucide-react';`);
  for (const src of Object.keys(need).sort()) {
    hdr.push(`import { ${[...need[src]].sort().join(', ')} } from '${rel(f, src)}';`);
  }
  graph[f] = Object.keys(need);
  writeFileSync(f, hdr.join('\n') + '\n\n' + bodies[f]);
  console.log(f, '→', graph[f].map((g) => g.split('/').pop()).join(', ') || '(leaf)');
}

// cycle check
const state = {}; const cyc = [];
const dfs = (n, st) => { state[n] = 1; for (const m of graph[n] || []) { if (state[m] === 1) cyc.push([...st, n, m]); else if (!state[m]) dfs(m, [...st, n]); } state[n] = 2; };
for (const n of MODULES) if (!state[n]) dfs(n, []);
console.log('\ncycles:', cyc.length ? JSON.stringify(cyc) : 'none');

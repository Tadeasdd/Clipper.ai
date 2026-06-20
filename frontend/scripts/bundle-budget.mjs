/* P1 — frontend performance budget gate + bundle analysis (offline, no deps).
   Reads the Vite build manifest (dist/.vite/manifest.json, enabled by
   build.manifest in vite.config.js) and the emitted asset files, then:

     1. prints a per-chunk gzip table (the bundle analysis), and
     2. computes the landing-route INITIAL JS graph — the bytes a first-time
        visitor downloads to paint "/" — and asserts it (and the shared entry
        graph, and every individual chunk) against frontend/perf-budgets.json.

   The "initial graph" is the entry chunk plus everything reachable through
   STATIC imports (these load synchronously with the page). Route chunks and the
   below-the-fold landing visuals are reached via DYNAMIC import, so they are
   deferred and explicitly excluded from the first-paint figure.

   Exits non-zero on any budget breach, so CI fails when a change inflates the
   bundle past its allowance. Pure Node — gzip via zlib, no network, no Chrome —
   so it runs in the offline frontend CI job alongside build/lint/smoke. */
import { readFileSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const FRONTEND = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(FRONTEND, 'dist');
const MANIFEST = join(DIST, '.vite', 'manifest.json');
const BUDGETS = join(FRONTEND, 'perf-budgets.json');
const LANDING_KEY = 'src/pages/Landing.jsx';

const fail = (msg) => { console.error('ERROR:', msg); process.exit(1); };

let manifest, budgets;
try { manifest = JSON.parse(readFileSync(MANIFEST, 'utf8')); }
catch { fail(`no build manifest at ${MANIFEST} — run "npm run build" first`); }
try { budgets = JSON.parse(readFileSync(BUDGETS, 'utf8')).budgets; }
catch { fail(`no/invalid budgets file at ${BUDGETS}`); }

const kib = (n) => (n / 1024).toFixed(1).padStart(7) + ' KiB';
const sizes = new Map(); // file -> { raw, gz }
function measure(file) {
  if (sizes.has(file)) return sizes.get(file);
  const buf = readFileSync(join(DIST, file));
  const s = { raw: statSync(join(DIST, file)).size, gz: gzipSync(buf).length };
  sizes.set(file, s);
  return s;
}

// Transitively collect manifest records reachable from `startKeys` through
// STATIC imports only (dynamicImports are deferred and deliberately skipped).
function staticGraph(startKeys) {
  const seen = new Set(), files = new Set();
  const stack = [...startKeys];
  while (stack.length) {
    const key = stack.pop();
    if (seen.has(key)) continue;
    seen.add(key);
    const rec = manifest[key];
    if (!rec) continue;
    if (rec.file && rec.file.endsWith('.js')) files.add(rec.file);
    for (const dep of rec.imports || []) stack.push(dep);
  }
  return files;
}
const gzSum = (files) => [...files].reduce((t, f) => t + measure(f).gz, 0);

const entryKey = Object.keys(manifest).find((k) => manifest[k].isEntry);
if (!entryKey) fail('no entry chunk in manifest');
if (!manifest[LANDING_KEY]) fail(`no ${LANDING_KEY} chunk in manifest`);

const entryFiles = staticGraph([entryKey]);
const landingFiles = staticGraph([entryKey, LANDING_KEY]);
const deferred = (manifest[LANDING_KEY].dynamicImports || [])
  .map((k) => manifest[k]).filter(Boolean)
  .map((r) => ({ file: r.file, gz: measure(r.file).gz }))
  .sort((a, b) => b.gz - a.gz);

// ── Analysis: every emitted JS chunk, largest first ──────────────────────────
const allChunks = [...new Set(Object.values(manifest).map((r) => r.file).filter((f) => f && f.endsWith('.js')))]
  .map((f) => ({ file: f, ...measure(f) })).sort((a, b) => b.gz - a.gz);

console.log('\nBundle analysis — JS chunks (gzip):');
for (const c of allChunks) console.log(`  ${kib(c.gz)}  ${c.file}`);

const entryGz = gzSum(entryFiles);
const landingGz = gzSum(landingFiles);
const deferredGz = deferred.reduce((t, d) => t + d.gz, 0);
console.log('\nLanding route (gzip JS):');
console.log(`  shared entry graph (static)      ${kib(entryGz)}  [${entryFiles.size} chunks]`);
console.log(`  landing first paint (entry+hero) ${kib(landingGz)}  [${landingFiles.size} chunks]`);
console.log(`  deferred below-the-fold visuals  ${kib(deferredGz)}  [${deferred.length} chunks, loaded after paint]`);

// ── Enforce budgets ──────────────────────────────────────────────────────────
const checks = [
  ['entry graph (static JS)', entryGz, budgets.entryGraphGzip],
  ['landing first paint (JS)', landingGz, budgets.landingFirstPaintGzip],
];
const bigChunk = allChunks.find((c) => c.gz > budgets.maxChunkGzip);
if (bigChunk) checks.push([`largest chunk ${bigChunk.file}`, bigChunk.gz, budgets.maxChunkGzip]);

let breached = false;
console.log('\nBudget checks (gzip):');
for (const [label, actual, limit] of checks) {
  const ok = actual <= limit;
  if (!ok) breached = true;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}: ${(actual / 1024).toFixed(1)} KiB / ${(limit / 1024).toFixed(1)} KiB budget`);
}

if (breached) { console.error('\nperf budget exceeded — see FAILs above'); process.exit(1); }
console.log('\nAll perf budgets within allowance.\n');

import React, { useState, useRef, useEffect, lazy, Suspense } from 'react';
import { useLocation, useNavigate, Routes, Route } from 'react-router-dom';
import { track } from './lib/analytics.jsx';
import { applySeo, injectJsonLd } from './lib/seo.jsx';
import { injectPerfHints } from './lib/perf.jsx';
import { MotionConfig } from './lib/motion.jsx';
import { SAMPLE_RECORDINGS, STEP_STAGE, runDemoPipeline, fetchShowcase } from './lib/demo.jsx';
import { useTiltEngine } from './lib/tilt.jsx';
import { ErrorBoundary, CrosshairCursor } from './components/ui.jsx';
import { SiteShell } from './components/site-chrome.jsx';

/* Route-level code splitting: each page (and the whole studio) is its own
   chunk, loaded on first visit. SiteShell stays eager so navigation chrome
   never flashes. */
const Landing = lazy(() => import('./pages/Landing.jsx').then((m) => ({ default: m.Landing })));
const ProductPage = lazy(() => import('./pages/Product.jsx').then((m) => ({ default: m.ProductPage })));
const PricingPage = lazy(() => import('./pages/Pricing.jsx').then((m) => ({ default: m.PricingPage })));
const DocsPage = lazy(() => import('./pages/Docs.jsx').then((m) => ({ default: m.DocsPage })));
const StatusPage = lazy(() => import('./pages/Status.jsx').then((m) => ({ default: m.StatusPage })));
const CompanyPage = lazy(() => import('./pages/Company.jsx').then((m) => ({ default: m.CompanyPage })));
const PrivacyPage = lazy(() => import('./pages/Legal.jsx').then((m) => ({ default: m.PrivacyPage })));
const TermsPage = lazy(() => import('./pages/Legal.jsx').then((m) => ({ default: m.TermsPage })));
const Studio = lazy(() => import('./studio/Studio.jsx'));
// F4: the operations dashboard — its own chunk, its own world. The marketing
// site never links here; this is the internal product.
const OpsApp = lazy(() => import('./ops/OpsApp.jsx'));

const PAGE_BY_PATH = {
  '/': 'home', '/product': 'product', '/pricing': 'pricing', '/docs': 'docs',
  '/status': 'status', '/privacy': 'privacy', '/terms': 'terms', '/company': 'company',
};

export default function ClipperApp() {
  return (
    <ErrorBoundary>
      <ClipperAppInner />
    </ErrorBoundary>
  );
}

function ClipperAppInner() {
  // F2: view/page were useState; they are now derived from the URL so every
  // marketing page has a real address and the studio lives at /studio.
  const location = useLocation();
  const navigate = useNavigate();
  const path = location.pathname.replace(/\/+$/, '') || '/';
  const isOps = path === '/ops' || path.startsWith('/ops/'); // F4: internal route tree
  const view = path === '/studio' ? 'app' : 'landing'; // landing | app
  const page = PAGE_BY_PATH[path] || 'home'; // home | product | pricing | docs | status | company
  // Unknown URLs canonicalize to home (never /ops — it owns its own 404).
  useEffect(() => {
    if (!isOps && view !== 'app' && !PAGE_BY_PATH[path]) navigate('/', { replace: true });
  }, [isOps, view, path, navigate]);
  const [stage, setStage] = useState('upload'); // upload | analyzing | results | pulse
  const [progress, setProgress] = useState(0);
  const [analysisStep, setAnalysisStep] = useState(0);
  const [momentsFound, setMomentsFound] = useState(0); // live counter during the "moments" stage
  const [stageHistory, setStageHistory] = useState([]); // [{ stage, at }] synthesized as the demo runs
  const [processedMs, setProcessedMs] = useState(null); // end-to-end demo run time, surfaced on results
  const [clips, setClips] = useState([]);
  const [selectedClip, setSelectedClip] = useState(null);
  const [videoMeta, setVideoMeta] = useState(null);
  const [history, setHistory] = useState([]);
  const [currentRunId, setCurrentRunId] = useState(null);
  const fileRef = useRef(null);

  // One tilt engine for the whole product (marketing pages + studio).
  useTiltEngine();

  // Load the showcase (pre-seeded demo jobs) + any live runs from the backend.
  const refreshHistory = React.useCallback(async () => {
    try {
      const runs = await fetchShowcase();
      setHistory(runs);
    } catch (e) {
      // Showcase is best-effort — never block the studio on it.
      console.error('showcase load failed', e);
    }
  }, []);

  useEffect(() => {
    refreshHistory();
  }, [refreshHistory]);

  // The backend persists every job automatically, so "persist" is just a
  // re-fetch of the list. Kept as a named function so call sites don't change.
  const persistRun = async () => {
    await refreshHistory();
  };

  const deleteRun = async (runId) => {
    // No hard-delete endpoint in the demo — just hide it from the list.
    setHistory((h) => h.filter((r) => r.id !== runId));
  };

  // Prepend a just-finished run so demo runs accumulate with their timing.
  const rememberRun = (run) => {
    if (!run || !run.id) return;
    setHistory((h) => [run, ...h.filter((r) => r.id !== run.id)].slice(0, 12));
  };

  const loadFromHistory = (run) => {
    setClips(run.clips);
    setVideoMeta(run.videoMeta);
    setProcessedMs(Number.isFinite(run.processedMs) ? run.processedMs : null);
    setCurrentRunId(run.id);
    setStage('results');
  };

  // Inject fonts via head link — works reliably in artifact sandbox
  useEffect(() => {
    const id = 'clipper-fonts';
    if (document.getElementById(id)) return;
    const preconnect1 = document.createElement('link');
    preconnect1.rel = 'preconnect';
    preconnect1.href = 'https://fonts.googleapis.com';
    const preconnect2 = document.createElement('link');
    preconnect2.rel = 'preconnect';
    preconnect2.href = 'https://fonts.gstatic.com';
    preconnect2.crossOrigin = 'anonymous';
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,300;0,400;0,500;0,600;1,400;1,500&family=JetBrains+Mono:wght@400;500&display=swap';
    document.head.appendChild(preconnect1);
    document.head.appendChild(preconnect2);
    document.head.appendChild(link);
  }, []);

  // Toggle studio-app body class — enables custom crosshair cursor in app view
  useEffect(() => {
    if (view === 'app') {
      document.body.classList.add('studio-app');
    } else {
      document.body.classList.remove('studio-app');
    }
    return () => document.body.classList.remove('studio-app');
  }, [view]);

  // Scroll to the top on every top-level transition. Switching between the
  // marketing site and the studio (and between studio stages / clip detail)
  // swaps the whole page body, but the window keeps its old scroll offset — so
  // without this the new view opens wherever the previous one was scrolled
  // (e.g. mid-page, since the triggering buttons sit far down). One place to own
  // it instead of scattering scrollTo() across every handler. rAF so it lands
  // after the new view paints (scrolling before the layout change gets undone).
  // A handler can opt out for one transition (skipTopScroll) when it performs
  // its own targeted scroll — e.g. bookCall jumping to the booking section.
  const skipTopScroll = useRef(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (skipTopScroll.current) { skipTopScroll.current = false; return; }
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    const id = requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: 'auto' }));
    return () => cancelAnimationFrame(id);
  }, [view, page, stage, selectedClip]);

  const analysisSteps = [
    'Ingesting the recording',
    'Transcribing the audio',
    'Finding the strongest moments',
    'Scoring each candidate',
    'Reframing & writing captions',
    'Packaging your clips',
  ];

  // Analysis is driven by runDemoPipeline (one eased rAF engine). Progress, the
  // active step, and the live moments-found counter all arrive via onProgress;
  // we stamp each stage the first time we reach it so the timeline shows real
  // per-stage timing — exactly as the backend's stage_history would.

  // Shared driver for both the uploaded-file path and the passive sample run.
  // `meta` is { name, size }; `input` is forwarded to the pipeline (unused by
  // the demo); `sampleClips` (optional) selects which clip ordering comes back,
  // so the visitor's sample pick on the landing page carries into the studio.
  // It owns every stage transition end to end.
  const runPipeline = async (meta, input, sampleClips) => {
    setVideoMeta(meta);
    setSelectedClip(null);
    setClips([]);
    setStage('analyzing');
    setProgress(0);
    setAnalysisStep(0);
    setMomentsFound(0);
    setStageHistory([]);
    setProcessedMs(null);
    const hist = [];
    const seen = new Set();
    try {
      const { clips: newClips, jobId } = await runDemoPipeline(input, {
        clips: Array.isArray(sampleClips) && sampleClips.length ? sampleClips : undefined,
        onProgress: (pct, stepIndex, info) => {
          setProgress(pct);
          if (typeof stepIndex === 'number') setAnalysisStep(stepIndex);
          if (info && typeof info.momentsFound === 'number') setMomentsFound(info.momentsFound);
          const stage = STEP_STAGE[stepIndex];
          if (stage && !seen.has(stage)) {
            seen.add(stage);
            hist.push({ stage, at: new Date().toISOString() });
            setStageHistory([...hist]);
          }
        },
      });
      setClips(newClips);
      const ms = hist.length ? Date.now() - Date.parse(hist[0].at) : null;
      setProcessedMs(ms);
      setCurrentRunId(jobId);
      setStage('results');
      // Surface this run in the sidebar with its timing (newest first).
      rememberRun({ id: jobId, clips: newClips, videoMeta: meta, createdAt: new Date().toISOString(), processedMs: ms });
    } catch (e) {
      console.error('pipeline failed', e);
      setStage('upload');
    }
  };

  const handleFile = async (file) => {
    if (!file) return;
    const meta = { name: file.name, size: (file.size / 1024 / 1024).toFixed(1) };
    await runPipeline(meta, file);
  };

  const reset = () => {
    setStage('upload');
    setClips([]);
    setSelectedClip(null);
    setVideoMeta(null);
    setProgress(0);
    setAnalysisStep(0);
    setMomentsFound(0);
    setStageHistory([]);
    setProcessedMs(null);
    setCurrentRunId(null);
  };

  // ── Step 4: passive sample walkthrough ──────────────────────────────────
  // The studio is no longer a self-serve tool. The only path "into" it is a
  // guided sample run: we auto-play one recording through the same pipeline so a
  // visitor can WATCH what we'd deliver. Nobody uploads anything, and the run
  // ends on "book a strategy call." No public CTA ever opens an empty studio.
  //
  // There is exactly ONE loading screen in the product — the studio's
  // AnalyzingView. Every "run/watch the sample" CTA on the site funnels here
  // (the landing demo used to render its own inline analyzing console; it now
  // hands its picked sample to this same run instead).
  const lastSample = useRef(null);
  const isSample = (s) => s && typeof s === 'object' && Array.isArray(s.clips) && s.meta;
  const runSample = (sample) => {
    const s = isSample(sample) ? sample : (lastSample.current || SAMPLE_RECORDINGS[0]);
    lastSample.current = s;
    runPipeline({ ...s.meta }, null, s.clips);
  };
  // Open the studio purely as that passive sample run. Tolerates being used as a
  // bare onClick handler (the click event is not a sample → falls back sensibly).
  // Scroll-to-top is handled centrally by the transition effect above.
  const watchSample = (sample) => {
    track('sample_play_click', isSample(sample) ? { sample: sample.meta.name } : undefined);
    navigate('/studio');
    runSample(sample);
  };

  // Hoisted so both the marketing site and the sample walkthrough can use it.
  const bookCall = () => {
    track('cta_book_call_click');
    skipTopScroll.current = true; // we scroll to the booking section ourselves
    navigate('/');
    setTimeout(() => {
      const el = document.getElementById('book-call');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      else window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 80);
  };

  // Phase 1: fire a real page_view on mount and on every in-app navigation.
  // (Not on /ops — internal traffic doesn't belong in the marketing funnel.)
  useEffect(() => { if (!isOps) track('page_view', { page }); }, [isOps, page]);
  useEffect(() => { if (!isOps) applySeo(page, view); }, [isOps, page, view]);
  useEffect(() => { injectJsonLd(); }, []);
  useEffect(() => { injectPerfHints(); }, []);

  // Conversion funnel — scroll-depth milestones, once each per page. rAF-throttled, passive.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const fired = { 25: false, 50: false, 75: false, 100: false };
    let ticking = false;
    const check = () => {
      ticking = false;
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      if (scrollable <= 0) return;
      const pct = Math.min(100, Math.round((window.scrollY / scrollable) * 100));
      [25, 50, 75, 100].forEach((m) => {
        if (!fired[m] && pct >= m) { fired[m] = true; track('scroll_depth', { depth: m, page }); }
      });
    };
    const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(check); } };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [page]);

  // Conversion funnel — fire once when a key section first enters view.
  useEffect(() => {
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) return;
    const seen = new Set();
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting && e.target.id && !seen.has(e.target.id)) {
          seen.add(e.target.id);
          track('section_view', { section: e.target.id, page });
        }
      });
    }, { threshold: 0.3 });
    const raf = requestAnimationFrame(() => {
      ['book-call', 'faq'].forEach((id) => { const el = document.getElementById(id); if (el) io.observe(el); });
    });
    return () => { cancelAnimationFrame(raf); io.disconnect(); };
  }, [page]);

  const goto = (p) => navigate(p === 'home' ? '/' : `/${p}`);

  // F4: the internal operations dashboard — separate chunk, no marketing shell.
  // The /ops/* splat gives OpsApp's nested <Routes> their base path.
  if (isOps) {
    return (
      <Suspense fallback={null}>
        <Routes>
          <Route path="/ops/*" element={<OpsApp />} />
        </Routes>
      </Suspense>
    );
  }

  if (view === 'landing') {
    const pageProps = { goto, openApp: watchSample, bookCall, page };
    return (
      <MotionConfig reducedMotion="user">
        <SiteShell {...pageProps}>
          <Suspense fallback={null}>
            <div key={page} className="page-transition">
              {page === 'home' && <Landing onStart={watchSample} goto={goto} bookCall={bookCall} />}
              {page === 'product' && <ProductPage goto={goto} openApp={watchSample} bookCall={bookCall} />}
              {page === 'pricing' && <PricingPage goto={goto} openApp={watchSample} bookCall={bookCall} />}
              {page === 'docs' && <DocsPage goto={goto} bookCall={bookCall} />}
              {page === 'status' && <StatusPage goto={goto} bookCall={bookCall} />}
              {page === 'privacy' && <PrivacyPage goto={goto} />}
              {page === 'terms' && <TermsPage goto={goto} />}
              {page === 'company' && <CompanyPage goto={goto} bookCall={bookCall} />}
            </div>
          </Suspense>
        </SiteShell>
        <CrosshairCursor />
      </MotionConfig>
    );
  }

  return (
    <Suspense fallback={null}>
      <Studio
        onExit={() => navigate('/')}
        bookCall={bookCall}
        stage={stage}
        progress={progress}
        analysisStep={analysisStep}
        analysisSteps={analysisSteps}
        videoMeta={videoMeta}
        stageHistory={stageHistory}
        momentsFound={momentsFound}
        clips={clips}
        selectedClip={selectedClip}
        setSelectedClip={setSelectedClip}
        processedMs={processedMs}
        history={history}
        handleFile={handleFile}
        fileRef={fileRef}
        loadFromHistory={loadFromHistory}
        deleteRun={deleteRun}
        watchSample={watchSample}
      />
    </Suspense>
  );
}

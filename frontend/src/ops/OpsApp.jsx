/* F4 — the operations dashboard shell. THE primary product surface
   (docs/ARCHITECTURE.md: ops dashboard first, client dashboard is a window).

   Visual direction: the same company as the marketing site — black, hairline
   borders, var(--color-brand) as the single signal color — but turned inward: a dense
   utilitarian command deck. Mono everywhere data lives, serif only for the
   page title. No marketing chrome, no orbs; a faint engineering grid. */
import React, { useEffect, useState } from 'react';
import { Routes, Route, NavLink, Link } from 'react-router-dom';
import { auth, setSession, getUser, ops, usePoll } from './api.js';

/* ── design tokens (one place) ────────────────────────────────────────── */
export const T = {
  line: 'rgba(255,255,255,0.08)',
  lineSoft: 'rgba(255,255,255,0.05)',
  dim: '#71717a',
  text: '#e7e5e4',
  green: 'var(--color-brand)',
  amber: '#fbbf24',
  red: '#f87171',
  panel: 'rgba(255,255,255,0.022)',
};
export const STATUS_COLOR = {
  // pipeline stages
  pending: T.dim, running: T.green, done: '#9ca3af', failed: T.red,
  // recordings
  awaiting_upload: T.dim, queued: T.amber, processing: T.green, ready: T.green,
  // clip machine
  candidate: T.dim, awaiting_review: T.amber, changes_requested: T.amber,
  approved_internal: T.green, awaiting_client: '#7dd3fc', approved: T.green,
  rejected: T.red, scheduled: '#7dd3fc', published: T.green,
};

export const Mono = ({ children, className = '', style }) => (
  <span className={`mono ${className}`} style={style}>{children}</span>
);
export const Label = ({ children, style }) => (
  <div className="mono uppercase" style={{ fontSize: 10, letterSpacing: '0.18em', color: T.dim, ...style }}>{children}</div>
);
export const Dot = ({ color, pulse }) => (
  <span style={{ position: 'relative', display: 'inline-block', width: 7, height: 7, marginRight: 7 }}>
    <span style={{ position: 'absolute', inset: 0, borderRadius: 99, background: color }} />
    {pulse && <span style={{ position: 'absolute', inset: 0, borderRadius: 99, background: color, animation: 'ops-ping 1.4s cubic-bezier(0,0,0.2,1) infinite' }} />}
  </span>
);
export const StatusChip = ({ status, pulse }) => (
  <span className="mono" style={{
    display: 'inline-flex', alignItems: 'center', fontSize: 11,
    color: STATUS_COLOR[status] || T.dim, whiteSpace: 'nowrap',
  }}>
    <Dot color={STATUS_COLOR[status] || T.dim} pulse={pulse ?? status === 'running'} />{status}
  </span>
);
export const Panel = ({ children, className = '', style }) => (
  <section className={className} style={{ border: `1px solid ${T.line}`, background: T.panel, borderRadius: 10, ...style }}>
    {children}
  </section>
);
export const PanelHead = ({ title, right }) => (
  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '12px 16px', borderBottom: `1px solid ${T.lineSoft}` }}>
    <Label>{title}</Label>
    {right}
  </div>
);
export const ErrorBand = ({ error, retry }) => (
  <div className="mono" style={{ padding: '14px 16px', fontSize: 12, color: T.red, display: 'flex', gap: 14, alignItems: 'center' }}>
    <span>backend unreachable — {String(error?.message || error)}</span>
    {retry && <button onClick={retry} className="mono" style={btnStyle()}>retry</button>}
  </div>
);
export const Empty = ({ children }) => (
  <div className="mono" style={{ padding: '22px 16px', fontSize: 12, color: T.dim }}>{children}</div>
);
export const btnStyle = (accent) => ({
  fontSize: 11, padding: '5px 12px', borderRadius: 6, cursor: 'pointer',
  // U1: alpha composed via color-mix (byte-identical to the old hex +'55'/+'14':
  // 0x55=33.333%, 0x14=7.843%) so it works with the var(--color-brand) token too.
  border: `1px solid ${accent ? `color-mix(in srgb, ${accent} 33.333%, transparent)` : T.line}`,
  color: accent || T.text, background: accent ? `color-mix(in srgb, ${accent} 7.843%, transparent)` : 'transparent',
});

/* ── sign in (B7: real sessions against /api/auth) ────────────────────── */
function Login({ onAuthed }) {
  const [mode, setMode] = useState('login'); // login | bootstrap
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    auth.status().then((st) => st.bootstrapRequired && setMode('bootstrap')).catch(() => {});
  }, []);
  const submit = async () => {
    setBusy(true); setErr(null);
    try {
      const r = mode === 'bootstrap' ? await auth.bootstrap(email, password) : await auth.login(email, password);
      setSession(r.user); // the token rode home as an httpOnly cookie; we keep only the user
      onAuthed(r.user);
    } catch (e) { setErr(e); }
    finally { setBusy(false); }
  };
  const field = {
    width: '100%', boxSizing: 'border-box', fontSize: 13, padding: '10px 14px',
    background: 'rgba(255,255,255,0.04)', border: `1px solid ${T.line}`,
    borderRadius: 8, color: T.text, outline: 'none',
  };
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
      <div style={{ maxWidth: 460, width: '100%' }}>
        <Label style={{ marginBottom: 10 }}>Clipper.ai · internal</Label>
        <h1 className="serif" style={{ fontSize: 34, color: T.text, marginBottom: 14 }}>
          {mode === 'bootstrap' ? 'Create the first ops account' : 'Operations console'}
        </h1>
        <p style={{ fontSize: 13.5, color: T.dim, lineHeight: 1.65, marginBottom: 22 }}>
          {mode === 'bootstrap'
            ? 'No accounts exist yet. This creates the founding ops account — every later account is created from inside, by an ops user, with an initial password its holder then changes.'
            : 'The machinery behind the managed service — the content queue, the pipeline board, clip review, publishing, and the loop. Sessions are server-side and revocable; client users land in their own portal, never here.'}
        </p>
        <div style={{ display: 'grid', gap: 8 }}>
          <input type="email" value={email} placeholder="email" autoComplete="username"
            onChange={(e) => setEmail(e.target.value)} className="mono" style={field} />
          <input type="password" value={password} placeholder={mode === 'bootstrap' ? 'password (≥ 8 characters)' : 'password'}
            autoComplete="current-password"
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()} className="mono" style={field} />
          <button onClick={submit} disabled={busy} className="mono" style={{ ...btnStyle(T.green), padding: '10px 18px', opacity: busy ? 0.5 : 1 }}>
            {busy ? '…' : mode === 'bootstrap' ? 'create account & enter' : 'sign in'}
          </button>
        </div>
        {err && <Mono style={{ display: 'block', fontSize: 11, color: T.red, marginTop: 10 }}>{String(err.message)}</Mono>}
        <p className="mono" style={{ fontSize: 10.5, color: '#52525b', marginTop: 14, lineHeight: 1.6 }}>
          server-side sessions · bearer for the API, httpOnly cookie for media · rate-limited
        </p>
      </div>
    </div>
  );
}

/* ── account badge (the session user; every action is theirs) ─────────── */
function AccountBadge({ user, onLogout }) {
  const [busy, setBusy] = useState(false);
  const logout = async () => {
    setBusy(true);
    try { await auth.logout(); } catch { /* session may already be dead */ }
    setSession(null);
    onLogout();
  };
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
      <Mono style={{ fontSize: 11, color: T.text }}>
        <Dot color={T.green} />{user.email} <span style={{ color: T.dim }}>· {user.role}</span>
      </Mono>
      <button onClick={logout} disabled={busy} className="mono" style={btnStyle()}>{busy ? '…' : 'sign out'}</button>
    </span>
  );
}

/* ── nav + shell ──────────────────────────────────────────────────────── */
const NAV = [
  { to: '/ops', label: 'Board', end: true },
  { to: '/ops/review', label: 'Review' },
  { to: '/ops/clients', label: 'Clients' },
  { to: '/ops/publish', label: 'Publish' },
  { to: '/ops/analytics', label: 'Analytics' },
  { to: '/ops/activity', label: 'Activity' },
];

function Shell({ user, onLogout, children }) {
  const { data: health } = usePoll(() => fetch(((import.meta.env && import.meta.env.VITE_API_BASE) || '') + '/api/health').then((r) => r.json()), { ms: 10000 });
  return (
    <div style={{ minHeight: '100vh', position: 'relative' }}>
      {/* engineering grid backdrop */}
      <div aria-hidden style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', opacity: 0.5,
        backgroundImage: `linear-gradient(${T.lineSoft} 1px, transparent 1px), linear-gradient(90deg, ${T.lineSoft} 1px, transparent 1px)`,
        backgroundSize: '56px 56px',
        maskImage: 'radial-gradient(ellipse 90% 70% at 50% 0%, black 30%, transparent 100%)',
        WebkitMaskImage: 'radial-gradient(ellipse 90% 70% at 50% 0%, black 30%, transparent 100%)',
      }} />
      <header style={{ position: 'sticky', top: 0, zIndex: 40, borderBottom: `1px solid ${T.line}`, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 20px', height: 54, display: 'flex', alignItems: 'center', gap: 22 }}>
          <Link to="/ops" className="mono" style={{ fontSize: 13, color: T.text, textDecoration: 'none', letterSpacing: '0.02em' }}>
            <span style={{ color: T.green }}>clipper</span>/ops
          </Link>
          <nav style={{ display: 'flex', gap: 4 }}>
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} className="mono"
                style={({ isActive }) => ({
                  fontSize: 12, padding: '6px 12px', borderRadius: 6, textDecoration: 'none',
                  color: isActive ? '#000' : T.dim, background: isActive ? T.green : 'transparent',
                })}>
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
            <Mono style={{ fontSize: 10.5, color: health?.ok ? T.dim : T.red }}>
              <Dot color={health?.ok ? T.green : T.red} pulse={!!health?.ok} />api {health?.ok ? 'up' : 'down'}
            </Mono>
            <AccountBadge user={user} onLogout={onLogout} />
          </div>
        </div>
      </header>
      <main style={{ maxWidth: 1280, margin: '0 auto', padding: '26px 20px 80px', position: 'relative' }}>
        {children}
      </main>
    </div>
  );
}

export const PageTitle = ({ kicker, title, right }) => (
  <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 20 }}>
    <div>
      <Label style={{ marginBottom: 6 }}>{kicker}</Label>
      <h1 className="serif" style={{ fontSize: 30, color: T.text, lineHeight: 1.05 }}>{title}</h1>
    </div>
    {right}
  </div>
);

const Stub = ({ kicker, title, body }) => (
  <>
    <PageTitle kicker={kicker} title={title} />
    <Panel><Empty>{body}</Empty></Panel>
  </>
);

/* Surfaces land phase by phase; stubs say exactly what they're waiting on. */
import Board from './Board.jsx';
import RecordingDetail from './RecordingDetail.jsx';
import ReviewDesk from './ReviewDesk.jsx';
import Clients from './Clients.jsx';
import Measure from './Measure.jsx';
import Activity from './Activity.jsx';

export default function OpsApp() {
  const [authState, setAuthState] = useState({ phase: 'checking', user: null });
  useEffect(() => { document.title = 'Clipper.ai · Operations'; }, []);
  useEffect(() => {
    auth.me()
      .then((r) => { setSession(r.user); setAuthState({ phase: 'in', user: r.user }); })
      .catch(() => setAuthState({ phase: 'out', user: null }));
  }, []);
  if (authState.phase === 'checking') return <OpsStyles><div /></OpsStyles>;
  if (authState.phase === 'out') {
    return <OpsStyles><Login onAuthed={(user) => setAuthState({ phase: 'in', user })} /></OpsStyles>;
  }
  if (authState.user?.role === 'client') {
    // The login screen promises "client users land in their own portal, never here."
    // One shared session key makes that a plain navigation, no token handoff.
    window.location.replace('/portal');
    return <OpsStyles><div /></OpsStyles>;
  }
  return (
    <OpsStyles>
      <Shell user={authState.user} onLogout={() => setAuthState({ phase: 'out', user: null })}>
        <Routes>
          <Route index element={<Board />} />
          <Route path="recordings/:id" element={<RecordingDetail />} />
          <Route path="review" element={<ReviewDesk />} />
          <Route path="clients" element={<Clients />} />
          <Route path="publish" element={<Measure surface="publish" />} />
          <Route path="analytics" element={<Measure surface="analytics" />} />
          <Route path="activity" element={<Activity />} />
          <Route path="*" element={<Stub kicker="404" title="No such surface" body={<Link to="/ops" className="mono" style={btnStyle()}>back to the board</Link>} />} />
        </Routes>
      </Shell>
    </OpsStyles>
  );
}

function OpsStyles({ children }) {
  return (
    <div style={{ minHeight: '100vh', background: '#050505', color: T.text, fontFamily: "'Inter', -apple-system, sans-serif" }}>
      <style>{`
        .mono { font-family: 'JetBrains Mono', 'SF Mono', Menlo, monospace; }
        .serif { font-family: 'Newsreader', Georgia, serif; font-weight: 500; letter-spacing: -0.015em; }
        @keyframes ops-ping { 75%, 100% { transform: scale(2.4); opacity: 0; } }
        @keyframes ops-shake { 0%,100% { transform: translateX(0); } 25% { transform: translateX(-6px); } 75% { transform: translateX(6px); } }
        @keyframes ops-rise { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .ops-rise { animation: ops-rise 0.45s cubic-bezier(0.16,1,0.3,1) both; }
        .ops-row:hover { background: rgba(255,255,255,0.03); }
        select option { background: #0a0a0a; }
      `}</style>
      {children}
    </div>
  );
}

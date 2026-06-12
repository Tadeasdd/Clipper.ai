/* F4 — the operations dashboard shell. THE primary product surface
   (docs/ARCHITECTURE.md: ops dashboard first, client dashboard is a window).

   Visual direction: the same company as the marketing site — black, hairline
   borders, #53fc18 as the single signal color — but turned inward: a dense
   utilitarian command deck. Mono everywhere data lives, serif only for the
   page title. No marketing chrome, no orbs; a faint engineering grid. */
import React, { useEffect, useState } from 'react';
import { Routes, Route, NavLink, Link, useNavigate } from 'react-router-dom';
import { gateUnlocked, tryUnlock, getIdentity, setIdentity, ops, usePoll } from './api.js';

/* ── design tokens (one place) ────────────────────────────────────────── */
export const T = {
  line: 'rgba(255,255,255,0.08)',
  lineSoft: 'rgba(255,255,255,0.05)',
  dim: '#71717a',
  text: '#e7e5e4',
  green: '#53fc18',
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
  border: `1px solid ${accent ? accent + '55' : T.line}`,
  color: accent || T.text, background: accent ? accent + '14' : 'transparent',
});

/* ── the gate (B7 placeholder — see api.js) ───────────────────────────── */
function Gate({ onUnlock }) {
  const [key, setKey] = useState('');
  const [shake, setShake] = useState(false);
  const submit = () => {
    if (tryUnlock(key)) onUnlock();
    else { setShake(true); setTimeout(() => setShake(false), 450); }
  };
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
      <div style={{ maxWidth: 460, width: '100%' }}>
        <Label style={{ marginBottom: 10 }}>Clipper.ai · internal</Label>
        <h1 className="serif" style={{ fontSize: 34, color: T.text, marginBottom: 14 }}>Operations console</h1>
        <p style={{ fontSize: 13.5, color: T.dim, lineHeight: 1.65, marginBottom: 22 }}>
          This is the machinery behind the managed service — the content queue, the pipeline
          board, clip review, and client management. It is for the operations team, editors,
          reviewers, and account managers. Clients never see this; their window is the
          deliverables portal.
        </p>
        <div style={{ display: 'flex', gap: 8, animation: shake ? 'ops-shake 0.4s' : 'none' }}>
          <input
            type="password" value={key} placeholder="ops key"
            onChange={(e) => setKey(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            className="mono"
            style={{ flex: 1, fontSize: 13, padding: '10px 14px', background: 'rgba(255,255,255,0.04)', border: `1px solid ${T.line}`, borderRadius: 8, color: T.text, outline: 'none' }}
          />
          <button onClick={submit} className="mono" style={{ ...btnStyle(T.green), padding: '10px 18px' }}>enter</button>
        </div>
        <p className="mono" style={{ fontSize: 10.5, color: '#52525b', marginTop: 14, lineHeight: 1.6 }}>
          shared-key gate · placeholder until B7 ships sessions &amp; roles · deployments must
          also gate /ops at the proxy
        </p>
      </div>
    </div>
  );
}

/* ── identity picker (B7 placeholder) ─────────────────────────────────── */
function IdentityBadge() {
  const [me, setMe] = useState(getIdentity());
  const [open, setOpen] = useState(false);
  const [usersList, setUsersList] = useState(null);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('reviewer');
  const [err, setErr] = useState(null);
  const load = async () => {
    try { setUsersList((await ops.users()).users.filter((u) => u.role !== 'client')); }
    catch (e) { setErr(e); }
  };
  const pick = (u) => { setIdentity(u); setMe(u); setOpen(false); };
  const create = async () => {
    try { pick(await ops.createUser({ email, role })); setErr(null); }
    catch (e) { setErr(e); }
  };
  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => { setOpen(!open); if (!usersList) load(); }} className="mono"
        style={{ ...btnStyle(me ? T.green : T.amber), display: 'flex', alignItems: 'center', gap: 8 }}>
        <Dot color={me ? T.green : T.amber} />
        {me ? `${me.email} · ${me.role}` : 'acting as — pick identity'}
      </button>
      {open && (
        <div style={{ position: 'absolute', right: 0, top: '110%', zIndex: 50, width: 320, background: '#0a0a0a', border: `1px solid ${T.line}`, borderRadius: 10, padding: 12 }}>
          <Label style={{ marginBottom: 8 }}>review actions are attributed to</Label>
          {err && <div className="mono" style={{ fontSize: 11, color: T.red, marginBottom: 8 }}>{String(err.message)}</div>}
          <div style={{ display: 'grid', gap: 4, maxHeight: 160, overflow: 'auto', marginBottom: 10 }}>
            {(usersList || []).map((u) => (
              <button key={u.id} onClick={() => pick(u)} className="mono"
                style={{ ...btnStyle(), textAlign: 'left', borderColor: me?.id === u.id ? T.green + '66' : T.line }}>
                {u.email} <span style={{ color: T.dim }}>· {u.role}</span>
              </button>
            ))}
            {usersList && !usersList.length && <Empty>no internal users yet — create one below</Empty>}
          </div>
          <div style={{ display: 'grid', gap: 6 }}>
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email" className="mono"
              style={{ fontSize: 12, padding: '7px 10px', background: 'rgba(255,255,255,0.04)', border: `1px solid ${T.line}`, borderRadius: 6, color: T.text, outline: 'none' }} />
            <div style={{ display: 'flex', gap: 6 }}>
              <select value={role} onChange={(e) => setRole(e.target.value)} className="mono"
                style={{ flex: 1, fontSize: 12, padding: '7px 10px', background: '#0a0a0a', border: `1px solid ${T.line}`, borderRadius: 6, color: T.text }}>
                {['ops', 'editor', 'reviewer', 'account_manager'].map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              <button onClick={create} className="mono" style={btnStyle(T.green)}>create</button>
            </div>
            <div className="mono" style={{ fontSize: 10, color: '#52525b' }}>trusted identity until B7 sessions</div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── nav + shell ──────────────────────────────────────────────────────── */
const NAV = [
  { to: '/ops', label: 'Board', end: true },
  { to: '/ops/review', label: 'Review' },
  { to: '/ops/clients', label: 'Clients' },
  { to: '/ops/publish', label: 'Publish' },
  { to: '/ops/analytics', label: 'Analytics' },
];

function Shell({ children }) {
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
            <IdentityBadge />
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

export default function OpsApp() {
  const [unlocked, setUnlocked] = useState(gateUnlocked());
  const navigate = useNavigate();
  useEffect(() => { document.title = 'Clipper.ai · Operations'; }, []);
  if (!unlocked) return <OpsStyles><Gate onUnlock={() => setUnlocked(true)} /></OpsStyles>;
  return (
    <OpsStyles>
      <Shell>
        <Routes>
          <Route index element={<Board />} />
          <Route path="recordings/:id" element={<RecordingDetail />} />
          <Route path="review" element={<ReviewDesk />} />
          <Route path="clients" element={<Clients />} />
          <Route path="publish" element={<Measure surface="publish" />} />
          <Route path="analytics" element={<Measure surface="analytics" />} />
          <Route path="*" element={<Stub kicker="404" title="No such surface" body={<button onClick={() => navigate('/ops')} className="mono" style={btnStyle()}>back to the board</button>} />} />
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

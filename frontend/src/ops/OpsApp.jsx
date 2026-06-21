/* F4 — the operations dashboard shell. THE primary product surface
   (docs/ARCHITECTURE.md: ops dashboard first, client dashboard is a window).

   Visual direction: the same company as the marketing site — black, hairline
   borders, var(--color-brand) as the single signal color — but turned inward: a dense
   utilitarian command deck. Mono everywhere data lives, serif only for the
   page title. No marketing chrome, no orbs; a faint engineering grid. */
import React, { useEffect, useState } from 'react';
import { Routes, Route, NavLink, Link, useLocation } from 'react-router-dom';
import { auth, setSession, getUser, ops, usePoll } from './api.js';
// U3: the identical inline-style primitives now live in one leaf module shared
// with /portal. Re-exported below so ops sub-pages keep importing them from here.
import { T, Mono, Label, Panel, PanelHead, btnStyle, field } from '../components/surface-ui.jsx';
import { RouteErrorBoundary } from '../components/error-boundary.jsx'; // U4: keep the shell alive when a route throws

export { T, Mono, Label, Panel, PanelHead, btnStyle };
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
export const ErrorBand = ({ error, retry }) => (
  <div className="mono" style={{ padding: '14px 16px', fontSize: 12, color: T.red, display: 'flex', gap: 14, alignItems: 'center' }}>
    <span>backend unreachable — {String(error?.message || error)}</span>
    {retry && <button onClick={retry} className="mono" style={btnStyle()}>retry</button>}
  </div>
);
export const Empty = ({ children }) => (
  <div className="mono" style={{ padding: '22px 16px', fontSize: 12, color: T.dim }}>{children}</div>
);
/* U4 — the loading/empty/error triplet every ops poll renders, in one place.
   Renders exactly what the views inlined: the error band only when there is no
   data to keep showing, the "loading…" placeholder on the first load, and the
   per-panel empty message. `panel` wraps a state in its own <Panel> for the
   surfaces (ClipGrid, Measure) that show these as standalone cards. Returns null
   in the happy path, so it adds nothing to the rendered output there. */
export const DataStates = ({ error, loading, data, refresh, isEmpty, empty, panel }) => {
  const wrap = (el) => (panel ? <Panel>{el}</Panel> : el);
  if (error && !data) return wrap(<ErrorBand error={error} retry={refresh} />);
  if (loading && !data && !error) return wrap(<Empty>loading…</Empty>);
  if (data && isEmpty) return wrap(<Empty>{empty}</Empty>);
  return null;
};

/* ── sign in (B7: real sessions against /api/auth) ────────────────────── */
function Login({ onAuthed }) {
  const [mode, setMode] = useState('login'); // login | bootstrap
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  // C2: a login can resolve to a second step (MFA code) or forced MFA enrolment.
  const [step, setStep] = useState('password'); // password | mfa | enrol
  const [challenge, setChallenge] = useState(null);
  const [code, setCode] = useState('');
  const [enrol, setEnrol] = useState(null); // { secret, otpauthUri }
  const [recovery, setRecovery] = useState(null);
  const [providers, setProviders] = useState([]);
  useEffect(() => {
    auth.status().then((st) => {
      if (st.bootstrapRequired) setMode('bootstrap');
      setProviders(st.ssoProviders || []);
    }).catch(() => {});
  }, []);

  const finish = (user) => { setSession(user); onAuthed(user); };
  const submit = async () => {
    setBusy(true); setErr(null);
    try {
      const r = mode === 'bootstrap' ? await auth.bootstrap(email, password) : await auth.login(email, password);
      if (r.mfaRequired) { setChallenge(r.challenge); setStep('mfa'); }
      else if (r.mfaEnrolmentRequired) { setChallenge(r.challenge); setEnrol(await auth.mfaSetup(r.challenge)); setStep('enrol'); }
      else finish(r.user); // the token rode home as an httpOnly cookie; we keep only the user
    } catch (e) { setErr(e); }
    finally { setBusy(false); }
  };
  const submitMfa = async () => {
    setBusy(true); setErr(null);
    try { finish((await auth.mfaLogin(challenge, code)).user); }
    catch (e) { setErr(e); }
    finally { setBusy(false); }
  };
  const submitEnrol = async () => {
    setBusy(true); setErr(null);
    try {
      const r = await auth.mfaSetupConfirm(challenge, code);
      setRecovery(r.recoveryCodes); // shown once; then they sign in again with a code
    } catch (e) { setErr(e); }
    finally { setBusy(false); }
  };

  const secondFactor = step === 'mfa' || step === 'enrol';
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
      <div style={{ maxWidth: 460, width: '100%' }}>
        <Label style={{ marginBottom: 10 }}>Clipper.ai · internal</Label>
        <h1 className="serif" style={{ fontSize: 34, color: T.text, marginBottom: 14 }}>
          {mode === 'bootstrap' ? 'Create the first ops account'
            : step === 'mfa' ? 'Two-factor authentication'
            : step === 'enrol' ? 'Set up two-factor authentication'
            : 'Operations console'}
        </h1>
        <p style={{ fontSize: 13.5, color: T.dim, lineHeight: 1.65, marginBottom: 22 }}>
          {mode === 'bootstrap'
            ? 'No accounts exist yet. This creates the founding ops account — every later account is created from inside, by an ops user, with an initial password its holder then changes.'
            : step === 'mfa' ? 'Enter the 6-digit code from your authenticator app — or a recovery code if you’ve lost the device.'
            : step === 'enrol' ? 'Your organisation requires two-factor authentication. Add this secret to an authenticator app, then enter the code it shows.'
            : 'The machinery behind the managed service — the content queue, the pipeline board, clip review, publishing, and the loop. Sessions are server-side and revocable; client users land in their own portal, never here.'}
        </p>

        {recovery ? (
          <div style={{ display: 'grid', gap: 10 }}>
            <Mono style={{ fontSize: 11.5, color: T.text }}>Recovery codes — save these now; each works once.</Mono>
            <div className="mono" style={{ ...field, lineHeight: 1.9, whiteSpace: 'pre-wrap' }}>{recovery.join('\n')}</div>
            <button onClick={() => { setRecovery(null); setStep('password'); setCode(''); setPassword(''); }}
              className="mono" style={{ ...btnStyle(T.green), padding: '10px 18px' }}>done — sign in</button>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            {!secondFactor && (
              <>
                <input type="email" value={email} placeholder="email" autoComplete="username"
                  onChange={(e) => setEmail(e.target.value)} className="mono" style={field} />
                <input type="password" value={password} placeholder={mode === 'bootstrap' ? 'password (≥ 8 characters)' : 'password'}
                  autoComplete="current-password"
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && submit()} className="mono" style={field} />
                <button onClick={submit} disabled={busy} className="mono" style={{ ...btnStyle(T.green), padding: '10px 18px', opacity: busy ? 0.5 : 1 }}>
                  {busy ? '…' : mode === 'bootstrap' ? 'create account & enter' : 'sign in'}
                </button>
                {mode !== 'bootstrap' && providers.includes('local') && (
                  <button onClick={() => { window.location.href = auth.ssoStartUrl('local'); }} className="mono" style={{ ...btnStyle(), padding: '10px 18px' }}>
                    continue with SSO
                  </button>
                )}
              </>
            )}
            {step === 'enrol' && enrol && (
              <div className="mono" style={{ ...field, fontSize: 11, color: T.dim, wordBreak: 'break-all' }}>{enrol.secret}</div>
            )}
            {secondFactor && (
              <>
                <input inputMode="numeric" value={code} placeholder="6-digit code" autoComplete="one-time-code"
                  onChange={(e) => setCode(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (step === 'mfa' ? submitMfa() : submitEnrol())} className="mono" style={field} />
                <button onClick={step === 'mfa' ? submitMfa : submitEnrol} disabled={busy} className="mono"
                  style={{ ...btnStyle(T.green), padding: '10px 18px', opacity: busy ? 0.5 : 1 }}>
                  {busy ? '…' : step === 'mfa' ? 'verify & enter' : 'confirm & continue'}
                </button>
              </>
            )}
          </div>
        )}
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
  { to: '/ops/security', label: 'Security' },
];

function Shell({ user, onLogout, children }) {
  const { data: health } = usePoll(() => fetch(((import.meta.env && import.meta.env.VITE_API_BASE) || '') + '/api/health').then((r) => r.json()), { ms: 10000 });
  const loc = useLocation(); // U4: re-keys the route boundary so navigation clears a stale error
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
        <RouteErrorBoundary key={loc.pathname} scope="ops">{children}</RouteErrorBoundary>
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

/* ── account security (C2): self-service MFA + session management ───────── */
function SecurityPanel() {
  const [mfa, setMfa] = useState(null);          // { enabled, required }
  const [sessions, setSessions] = useState([]);
  const [enrol, setEnrol] = useState(null);      // { secret, otpauthUri }
  const [recovery, setRecovery] = useState(null);
  const [code, setCode] = useState('');
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  const refresh = () => {
    auth.mfaStatus().then(setMfa).catch((e) => setErr(e));
    auth.sessions().then((r) => setSessions(r.sessions || [])).catch(() => {});
  };
  useEffect(refresh, []);

  const guard = (fn) => async () => { setBusy(true); setErr(null); try { await fn(); } catch (e) { setErr(e); } finally { setBusy(false); } };
  const startEnrol = guard(async () => setEnrol(await auth.mfaEnroll()));
  const verifyEnrol = guard(async () => { setRecovery((await auth.mfaVerify(code)).recoveryCodes); setEnrol(null); setCode(''); refresh(); });
  const disable = guard(async () => { await auth.mfaDisable(code); setCode(''); refresh(); });
  const revoke = (id) => guard(async () => { await auth.revokeSession(id); refresh(); })();
  const revokeOthers = guard(async () => { await auth.revokeOtherSessions(); refresh(); });

  return (
    <>
      <PageTitle kicker="account security" title="Security" />
      <Panel>
        <Label style={{ marginBottom: 10 }}>Two-factor authentication</Label>
        {!mfa ? <Empty>loading…</Empty> : recovery ? (
          <div style={{ display: 'grid', gap: 10, maxWidth: 360 }}>
            <Mono style={{ fontSize: 11.5, color: T.text }}>Recovery codes — save these now; each works once.</Mono>
            <div className="mono" style={{ ...field, lineHeight: 1.9, whiteSpace: 'pre-wrap' }}>{recovery.join('\n')}</div>
            <button onClick={() => setRecovery(null)} className="mono" style={{ ...btnStyle(T.green), padding: '8px 16px' }}>done</button>
          </div>
        ) : mfa.enabled ? (
          <div style={{ display: 'grid', gap: 8, maxWidth: 360 }}>
            <Mono style={{ fontSize: 11.5, color: T.green }}><Dot color={T.green} />enabled{mfa.required ? ' · required by policy' : ''}</Mono>
            {!mfa.required && (
              <>
                <input inputMode="numeric" value={code} placeholder="current code to disable" onChange={(e) => setCode(e.target.value)} className="mono" style={field} />
                <button onClick={disable} disabled={busy} className="mono" style={{ ...btnStyle(), padding: '8px 16px' }}>disable MFA</button>
              </>
            )}
          </div>
        ) : enrol ? (
          <div style={{ display: 'grid', gap: 8, maxWidth: 360 }}>
            <Mono style={{ fontSize: 11, color: T.dim }}>Add this secret to your authenticator app:</Mono>
            <div className="mono" style={{ ...field, fontSize: 11, wordBreak: 'break-all' }}>{enrol.secret}</div>
            <input inputMode="numeric" value={code} placeholder="6-digit code" onChange={(e) => setCode(e.target.value)} className="mono" style={field} />
            <button onClick={verifyEnrol} disabled={busy} className="mono" style={{ ...btnStyle(T.green), padding: '8px 16px' }}>verify & enable</button>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 8, maxWidth: 360 }}>
            <Mono style={{ fontSize: 11.5, color: T.dim }}>{mfa.required ? 'Required by policy — not yet enabled.' : 'Not enabled.'}</Mono>
            <button onClick={startEnrol} disabled={busy} className="mono" style={{ ...btnStyle(T.green), padding: '8px 16px' }}>enable MFA</button>
          </div>
        )}
      </Panel>

      <Panel style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <Label>Active sessions</Label>
          <button onClick={revokeOthers} disabled={busy} className="mono" style={btnStyle()}>sign out other sessions</button>
        </div>
        {sessions.length === 0 ? <Empty>no active sessions</Empty> : (
          <div style={{ display: 'grid', gap: 6 }}>
            {sessions.map((s) => (
              <div key={s.id || s.created_at} className="mono ops-row" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 10px', borderRadius: 6, fontSize: 11.5 }}>
                <Dot color={s.current ? T.green : T.dim} />
                <span style={{ color: T.text }}>{s.auth_method || 'password'}</span>
                <span style={{ color: T.dim }}>{s.ip || '—'}</span>
                <span style={{ color: T.dim, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.user_agent || ''}</span>
                <span style={{ color: T.dim }}>{s.last_seen_at ? new Date(s.last_seen_at).toLocaleString() : ''}</span>
                {s.current ? <span style={{ color: T.green }}>this session</span>
                  : s.id ? <button onClick={() => revoke(s.id)} disabled={busy} className="mono" style={btnStyle()}>revoke</button> : null}
              </div>
            ))}
          </div>
        )}
      </Panel>
      {err && <Mono style={{ display: 'block', fontSize: 11, color: T.red, marginTop: 10 }}>{String(err.message)}</Mono>}
    </>
  );
}

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
          <Route path="security" element={<SecurityPanel />} />
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

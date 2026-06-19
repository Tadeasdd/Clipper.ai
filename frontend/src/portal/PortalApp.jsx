/* F5 — the client portal. Secondary by design (docs/ARCHITECTURE.md: the ops
   dashboard is the product; this is the client's window into it). Four
   surfaces only: view deliverables, approve content, upload content, read
   the report.

   Visual direction: the same company as /ops — black, hairline borders,
   var(--color-brand) as the single signal color — but turned outward: calmer, fewer
   columns, no machinery. Clients see outcomes, not pipelines.

   Scoping lives on the server (B7): every endpoint this app calls is pinned
   to the session's client in the query. The portal never passes a clientId
   it wasn't given by /api/auth/me, and couldn't widen its view if it did. */
import React, { useEffect, useState } from 'react';
import { Routes, Route, NavLink, Link } from 'react-router-dom';
import { portal, uploadFile, auth, setSession, usePoll, fmtClock, fmtAgo } from './api.js';
// U3: the primitives identical to /ops live in one leaf module (imports only
// React, so composing them here never drags the ops surfaces into the portal
// chunk — the reason they were duplicated in the first place).
import { T as baseT, Mono, Label, Panel, PanelHead, btnStyle, field } from '../components/surface-ui.jsx';

/* ── design tokens (same palette as /ops; `sky` is the portal's one extra
      token, spread onto the shared base so the rest stay single-source) ──── */
const T = { ...baseT, sky: '#7dd3fc' };
const STATUS_COLOR = {
  awaiting_upload: T.dim, queued: T.amber, ingesting: T.green, processing: T.green, ready: T.green, failed: T.red,
  candidate: T.dim, awaiting_review: T.amber, changes_requested: T.amber,
  approved_internal: T.green, awaiting_client: T.sky, approved: T.green,
  rejected: T.red, scheduled: T.sky, published: T.green,
};
// Client-facing names for internal statuses — the portal speaks outcomes.
const STATUS_LABEL = {
  awaiting_upload: 'awaiting your upload', queued: 'in queue', ingesting: 'processing', processing: 'processing',
  ready: 'processed', candidate: 'in production', awaiting_review: 'in production',
  changes_requested: 'being revised', approved_internal: 'in production',
  awaiting_client: 'awaiting your sign-off', approved: 'approved', rejected: 'declined',
  scheduled: 'scheduled', published: 'published', failed: 'failed',
};

const Dot = ({ color, pulse }) => (
  <span style={{ position: 'relative', display: 'inline-block', width: 7, height: 7, marginRight: 7 }}>
    <span style={{ position: 'absolute', inset: 0, borderRadius: 99, background: color }} />
    {pulse && <span style={{ position: 'absolute', inset: 0, borderRadius: 99, background: color, animation: 'portal-ping 1.4s cubic-bezier(0,0,0.2,1) infinite' }} />}
  </span>
);
const StatusChip = ({ status }) => (
  <span className="mono" style={{ display: 'inline-flex', alignItems: 'center', fontSize: 11, color: STATUS_COLOR[status] || T.dim, whiteSpace: 'nowrap' }}>
    <Dot color={STATUS_COLOR[status] || T.dim} />{STATUS_LABEL[status] || status}
  </span>
);
const ErrorBand = ({ error, retry }) => (
  <div className="mono" style={{ padding: '14px 16px', fontSize: 12, color: T.red, display: 'flex', gap: 14, alignItems: 'center' }}>
    <span>can't reach the studio — {String(error?.message || error)}</span>
    {retry && <button onClick={retry} className="mono" style={btn()}>retry</button>}
  </div>
);
const Empty = ({ children }) => (
  <div className="mono" style={{ padding: '22px 16px', fontSize: 12, color: T.dim, lineHeight: 1.7 }}>{children}</div>
);
const btn = btnStyle; // U3: shared with /ops; alias keeps the btn(...) call sites untouched
const PageTitle = ({ kicker, title, right }) => (
  <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
    <div>
      <Label style={{ marginBottom: 6 }}>{kicker}</Label>
      <h1 className="serif" style={{ fontSize: 30, color: T.text, lineHeight: 1.05 }}>{title}</h1>
    </div>
    {right}
  </div>
);

/* ── clip preview: cookie-authed <video> (the reason sessions ride a cookie) */
function ClipPreview({ clip, height = 210 }) {
  const rendered = clip.asset_key || clip.rendered;
  return (
    <div style={{ height, borderRadius: 8, overflow: 'hidden', border: `1px solid ${T.lineSoft}`, background: '#000', display: 'grid', placeItems: 'center' }}>
      {rendered
        ? <video src={portal.assetUrl(clip.id)} controls preload="metadata" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        : <Mono style={{ fontSize: 11, color: T.dim, padding: 12, textAlign: 'center' }}>preview renders when production finishes</Mono>}
    </div>
  );
}

/* ── sign in (client-facing copy; bootstrap lives at /ops, never here) ──── */
function Login({ onAuthed }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true); setErr(null);
    try {
      const r = await auth.login(email, password);
      setSession(r.user); // token rode home as an httpOnly cookie; keep only the user
      onAuthed(r.user);
    } catch (e) { setErr(e); }
    finally { setBusy(false); }
  };
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
      <div style={{ maxWidth: 460, width: '100%' }}>
        <Label style={{ marginBottom: 10 }}>Clipper.ai · client portal</Label>
        <h1 className="serif" style={{ fontSize: 34, color: T.text, marginBottom: 14 }}>Your studio window</h1>
        <p style={{ fontSize: 13.5, color: T.dim, lineHeight: 1.65, marginBottom: 22 }}>
          Sign in to see your deliverables, approve clips before they publish, send us new
          long-form content, and read your performance report. Your account was created by
          your account manager — if you don't have credentials yet, ask them.
        </p>
        <div style={{ display: 'grid', gap: 8 }}>
          <input type="email" value={email} placeholder="email" autoComplete="username"
            onChange={(e) => setEmail(e.target.value)} className="mono" style={field} />
          <input type="password" value={password} placeholder="password" autoComplete="current-password"
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()} className="mono" style={field} />
          <button onClick={submit} disabled={busy} className="mono" style={{ ...btn(T.green), padding: '10px 18px', opacity: busy ? 0.5 : 1 }}>
            {busy ? '…' : 'sign in'}
          </button>
        </div>
        {err && <Mono style={{ display: 'block', fontSize: 11, color: T.red, marginTop: 10 }}>{String(err.message)}</Mono>}
        <p className="mono" style={{ fontSize: 10.5, color: '#52525b', marginTop: 14, lineHeight: 1.6 }}>
          you only ever see your own data — that's enforced in the database query, not the UI
        </p>
      </div>
    </div>
  );
}

/* ── account: badge, sign out, change password ──────────────────────────── */
function AccountBadge({ user, onLogout }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pw, setPw] = useState({ current: '', next: '' });
  const [msg, setMsg] = useState(null);
  const logout = async () => {
    setBusy(true);
    try { await auth.logout(); } catch { /* session may already be dead */ }
    setSession(null);
    onLogout();
  };
  const change = async () => {
    setMsg(null);
    try {
      await portal.changePassword(pw.current, pw.next);
      setMsg({ ok: true, text: 'password changed' });
      setPw({ current: '', next: '' });
    } catch (e) { setMsg({ ok: false, text: e.message }); }
  };
  return (
    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 10 }}>
      <button onClick={() => setOpen((v) => !v)} className="mono" style={{ ...btn(), border: 'none', fontSize: 11, color: T.text }}>
        <Dot color={T.green} />{user.email}
      </button>
      <button onClick={logout} disabled={busy} className="mono" style={btn()}>{busy ? '…' : 'sign out'}</button>
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 10px)', right: 0, width: 280, padding: 14, borderRadius: 10, border: `1px solid ${T.line}`, background: '#0a0a0a', zIndex: 50 }}>
          <Label style={{ marginBottom: 10 }}>Change password</Label>
          <div style={{ display: 'grid', gap: 8 }}>
            <input type="password" value={pw.current} placeholder="current password" autoComplete="current-password"
              onChange={(e) => setPw((s) => ({ ...s, current: e.target.value }))} className="mono" style={field} />
            <input type="password" value={pw.next} placeholder="new password (≥ 8 characters)" autoComplete="new-password"
              onChange={(e) => setPw((s) => ({ ...s, next: e.target.value }))} className="mono" style={field} />
            <button onClick={change} className="mono" style={btn(T.green)}>update</button>
          </div>
          {msg && <Mono style={{ display: 'block', fontSize: 10.5, marginTop: 8, color: msg.ok ? T.green : T.red }}>{msg.text}</Mono>}
        </div>
      )}
    </span>
  );
}

/* ── surface 1: deliverables ────────────────────────────────────────────── */
const DELIVERED = ['approved', 'scheduled', 'published'];

function MetricsBlock({ clipId }) {
  const [state, setState] = useState({ loading: true, data: null, error: null });
  useEffect(() => {
    portal.clipMetrics(clipId)
      .then((data) => setState({ loading: false, data, error: null }))
      .catch((error) => setState({ loading: false, data: null, error }));
  }, [clipId]);
  if (state.loading) return <Mono style={{ fontSize: 11, color: T.dim }}>loading metrics…</Mono>;
  if (state.error) return <Mono style={{ fontSize: 11, color: T.red }}>{state.error.message}</Mono>;
  const platforms = Object.entries(state.data?.platforms || {});
  if (!platforms.length) return <Mono style={{ fontSize: 11, color: T.dim }}>no platform metrics yet — they arrive after publish</Mono>;
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {platforms.map(([platform, p]) => {
        const last = p.series?.[0];
        return (
          <div key={platform} className="mono" style={{ fontSize: 11, display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'baseline' }}>
            <span style={{ color: T.green, minWidth: 70 }}>{platform}</span>
            {last ? (<>
              <span>{Number(last.views).toLocaleString()} views</span>
              <span style={{ color: T.dim }}>{Math.round((last.retention || 0) * 100)}% retention</span>
              <span style={{ color: T.dim }}>{last.likes} likes · {last.comments} comments · {last.shares} shares</span>
              {p.externalUrl && <a href={p.externalUrl} target="_blank" rel="noreferrer" style={{ color: T.sky, textDecoration: 'none' }}>open ↗</a>}
            </>) : <span style={{ color: T.dim }}>captures pending</span>}
          </div>
        );
      })}
    </div>
  );
}

function DeliverableCard({ clip }) {
  const [showMetrics, setShowMetrics] = useState(false);
  return (
    <Panel className="portal-rise" style={{ padding: 14 }}>
      <ClipPreview clip={clip} />
      <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
        <StatusChip status={clip.status} />
        <Mono style={{ fontSize: 10.5, color: T.dim }}>{fmtClock(clip.t_end_s - clip.t_start_s)} · {fmtAgo(clip.created_at)}</Mono>
      </div>
      <p style={{ fontSize: 13, color: T.text, lineHeight: 1.5, margin: '8px 0 10px' }}>{clip.hook || 'untitled clip'}</p>
      {DELIVERED.includes(clip.status) && (
        <button onClick={() => setShowMetrics((v) => !v)} className="mono" style={btn()}>
          {showMetrics ? 'hide performance' : 'performance'}
        </button>
      )}
      {showMetrics && <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${T.lineSoft}` }}><MetricsBlock clipId={clip.id} /></div>}
    </Panel>
  );
}

/* O4 — recent updates: the client's lifecycle notification feed (content
   received, ready for approval, published, delivery-at-risk). Additive panel;
   reuses the portal's Panel idiom and tokens — no new colors/SVGs/fonts. */
function UpdatesPanel() {
  const { data } = usePoll(() => portal.notifications(), { ms: 10000 });
  const items = (data?.notifications || []).slice(0, 6);
  if (!items.length) return null;
  return (
    <Panel style={{ marginBottom: 16 }} className="portal-rise">
      <PanelHead title="Recent updates" />
      <div>
        {items.map((n) => (
          <div key={n.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, padding: '9px 14px', borderTop: `1px solid ${T.lineSoft}` }}>
            <span style={{ fontSize: 12.5, color: n.event === 'sla_risk' ? T.amber : T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.subject}</span>
            <span className="mono" style={{ fontSize: 10.5, color: T.dim, whiteSpace: 'nowrap' }}>{fmtAgo(n.created_at)}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function Deliverables() {
  const [filter, setFilter] = useState('delivered'); // delivered | production | all
  const { data, error, loading, refresh } = usePoll(() => portal.clips(), { ms: 8000 });
  const clips = data?.clips || [];
  const shown = clips.filter((c) =>
    filter === 'all' ? true
      : filter === 'delivered' ? DELIVERED.includes(c.status)
        : !DELIVERED.includes(c.status));
  return (
    <>
      <PageTitle kicker="F5 · Deliverables" title="Your clips" right={
        <div style={{ display: 'flex', gap: 4 }}>
          {[['delivered', 'delivered'], ['production', 'in production'], ['all', 'everything']].map(([k, label]) => (
            <button key={k} onClick={() => setFilter(k)} className="mono"
              style={{ ...btn(filter === k ? T.green : null), fontSize: 10.5 }}>{label}</button>
          ))}
        </div>
      } />
      <UpdatesPanel />
      {error && <Panel style={{ marginBottom: 16 }}><ErrorBand error={error} retry={refresh} /></Panel>}
      {!error && !loading && !shown.length && (
        <Panel><Empty>
          {filter === 'delivered'
            ? 'Nothing delivered yet. Clips land here once they clear your sign-off — check the Sign-off tab, or send us new content from Submit.'
            : 'Nothing in this view yet. Submit long-form content and the studio cuts it into clips; you\'ll see them appear here as production runs.'}
        </Empty></Panel>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 14 }}>
        {shown.map((c) => <DeliverableCard key={c.id} clip={c} />)}
      </div>
    </>
  );
}

/* ── surface 2: sign-off (the client side of the B4 review workflow) ────── */
function History({ clipId }) {
  const [state, setState] = useState({ loading: true, events: null, error: null });
  useEffect(() => {
    portal.history(clipId)
      .then((r) => setState({ loading: false, events: r.events, error: null }))
      .catch((error) => setState({ loading: false, events: null, error }));
  }, [clipId]);
  if (state.loading) return <Mono style={{ fontSize: 11, color: T.dim }}>loading history…</Mono>;
  if (state.error) return <Mono style={{ fontSize: 11, color: T.red }}>{state.error.message}</Mono>;
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      {(state.events || []).map((e) => (
        <Mono key={e.id} style={{ fontSize: 10.5, color: T.dim }}>
          <span style={{ color: STATUS_COLOR[e.decision] || T.text }}>{e.decision}</span>
          {' · '}{e.reviewer_email} ({e.reviewer_role}) · {fmtAgo(e.created_at)}
          {e.notes ? <span style={{ color: T.text }}> — “{e.notes}”</span> : null}
        </Mono>
      ))}
      {!state.events?.length && <Mono style={{ fontSize: 11, color: T.dim }}>no events yet</Mono>}
    </div>
  );
}

function SignoffCard({ item, onDone }) {
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(null);
  const [err, setErr] = useState(null);
  const [result, setResult] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const decide = async (decision) => {
    setBusy(decision); setErr(null);
    try {
      const r = await portal.decide(item.id, { decision, notes: notes || undefined });
      setResult(r);
      setTimeout(onDone, 1400); // let the confirmation land, then refresh the queue
    } catch (e) {
      setErr(e);
      if (e.status === 409) setTimeout(onDone, 900); // someone got there first — refresh
    } finally { setBusy(null); }
  };
  if (result) {
    return (
      <Panel className="portal-rise" style={{ padding: 16 }}>
        <Mono style={{ fontSize: 12, color: result.to === 'approved' ? T.green : T.amber }}>
          {result.to === 'approved'
            ? `approved${result.scheduled?.length ? ` — queued to ${result.scheduled.join(', ')}` : result.autoPublished === false ? ' — your team will schedule publishing' : ''}`
            : result.to === 'changes_requested' ? 'changes requested — back to the editors'
              : 'declined — it won\'t publish'}
        </Mono>
      </Panel>
    );
  }
  return (
    <Panel className="portal-rise" style={{ padding: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 230px) 1fr', gap: 16 }}>
        <ClipPreview clip={{ ...item, asset_key: item.rendered ? 'x' : null }} height={170} />
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
            <StatusChip status={item.status} />
            <Mono style={{ fontSize: 10.5, color: T.dim }}>
              {fmtClock(item.t_start_s)}–{fmtClock(item.t_end_s)} · score {Math.round(item.score)} · sent {fmtAgo(item.created_at)}
            </Mono>
          </div>
          <p style={{ fontSize: 14, color: T.text, lineHeight: 1.5, margin: '10px 0' }}>{item.hook || 'untitled clip'}</p>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} className="mono"
            placeholder="notes for the editors (kept in the audit trail)" style={{ ...field, fontSize: 12, marginBottom: 10 }} />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <button onClick={() => decide('approve')} disabled={!!busy} className="mono" style={btn(T.green)}>
              {busy === 'approve' ? '…' : 'approve'}
            </button>
            <button onClick={() => decide('changes')} disabled={!!busy} className="mono" style={btn(T.amber)}>
              {busy === 'changes' ? '…' : 'request changes'}
            </button>
            <button onClick={() => decide('reject')} disabled={!!busy} className="mono" style={btn(T.red)}>
              {busy === 'reject' ? '…' : 'decline'}
            </button>
            <button onClick={() => setShowHistory((v) => !v)} className="mono" style={btn()}>history</button>
          </div>
          {err && <Mono style={{ display: 'block', fontSize: 11, color: T.red, marginTop: 8 }}>{err.message}</Mono>}
          {showHistory && <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${T.lineSoft}` }}><History clipId={item.id} /></div>}
        </div>
      </div>
    </Panel>
  );
}

function Signoff() {
  const { data, error, loading, refresh } = usePoll(() => portal.reviewQueue(), { ms: 6000 });
  const items = data?.items || [];
  return (
    <>
      <PageTitle kicker="F5 · Sign-off" title="Awaiting your approval"
        right={<Mono style={{ fontSize: 11, color: T.dim }}>{items.length} clip{items.length === 1 ? '' : 's'} waiting</Mono>} />
      <p style={{ fontSize: 13, color: T.dim, lineHeight: 1.6, maxWidth: 640, marginBottom: 18 }}>
        Approving a clip publishes it on your configured cadence — if auto-publish is on for your
        account, it's scheduled the moment you approve. Every decision and note here lands in the
        audit trail under your name.
      </p>
      {error && <Panel style={{ marginBottom: 16 }}><ErrorBand error={error} retry={refresh} /></Panel>}
      {!error && !loading && !items.length && (
        <Panel><Empty>
          Nothing waiting on you. The studio sends clips here once they clear internal review —
          you'll see them as soon as they're ready for your sign-off.
        </Empty></Panel>
      )}
      <div style={{ display: 'grid', gap: 14 }}>
        {items.map((item) => <SignoffCard key={item.id} item={item} onDone={refresh} />)}
      </div>
    </>
  );
}

/* ── surface 3: submit content (B2 intake — URL or file) ────────────────── */
function Submit({ user }) {
  const [mode, setMode] = useState('url'); // url | file
  const [sourceUrl, setSourceUrl] = useState('');
  const [file, setFile] = useState(null);
  const [kind, setKind] = useState('podcast');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const { data, error, refresh } = usePoll(() => portal.submissions(), { ms: 6000 });
  const items = data?.items || [];

  const go = async () => {
    setBusy(true); setMsg(null);
    try {
      if (mode === 'url') {
        if (!sourceUrl.trim()) throw new Error('paste a link first');
        await portal.submit({ clientId: user.clientId, sourceUrl: sourceUrl.trim(), kind });
        setSourceUrl('');
        setMsg({ ok: true, text: 'submitted — it\'s in the production queue' });
      } else {
        if (!file) throw new Error('choose a file first');
        const r = await portal.submit({ clientId: user.clientId, filename: file.name, kind });
        await uploadFile(r.recordingId, file);
        setFile(null);
        setMsg({ ok: true, text: `uploaded ${file.name} — it's in the production queue` });
      }
      refresh();
    } catch (e) { setMsg({ ok: false, text: e.message }); }
    finally { setBusy(false); }
  };

  return (
    <>
      <PageTitle kicker="F5 · Submit" title="Send us content" />
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 460px) 1fr', gap: 16, alignItems: 'start' }}>
        <Panel style={{ padding: 16 }}>
          <div style={{ display: 'flex', gap: 4, marginBottom: 14 }}>
            <button onClick={() => setMode('url')} className="mono" style={btn(mode === 'url' ? T.green : null)}>paste a link</button>
            <button onClick={() => setMode('file')} className="mono" style={btn(mode === 'file' ? T.green : null)}>upload a file</button>
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            {mode === 'url'
              ? <input value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} className="mono" style={field}
                  placeholder="https:// — episode, stream VOD, or raw footage" />
              : <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} className="mono"
                  style={{ ...field, padding: '8px 10px' }} />}
            <select value={kind} onChange={(e) => setKind(e.target.value)} className="mono" style={field}>
              <option value="podcast">podcast</option>
              <option value="stream">stream VOD</option>
              <option value="video">video</option>
              <option value="other">other</option>
            </select>
            <button onClick={go} disabled={busy} className="mono" style={{ ...btn(T.green), padding: '9px 16px', opacity: busy ? 0.5 : 1 }}>
              {busy ? 'sending…' : 'submit to the studio'}
            </button>
          </div>
          {msg && <Mono style={{ display: 'block', fontSize: 11, marginTop: 10, color: msg.ok ? T.green : T.red }}>{msg.text}</Mono>}
          <p className="mono" style={{ fontSize: 10.5, color: '#52525b', marginTop: 12, lineHeight: 1.6 }}>
            one long-form in → the pipeline finds the moments, cuts vertical, captions, and routes
            the best candidates to your sign-off queue
          </p>
        </Panel>
        <Panel>
          <PanelHead title="Your submissions" right={<button onClick={refresh} className="mono" style={btn()}>refresh</button>} />
          {error && <ErrorBand error={error} retry={refresh} />}
          {!error && !items.length && <Empty>Nothing submitted yet — your last 50 submissions and their production status will show here.</Empty>}
          {items.map((rec) => (
            <div key={rec.id} className="portal-row" style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '10px 16px', borderTop: `1px solid ${T.lineSoft}`, alignItems: 'baseline' }}>
              <Mono style={{ fontSize: 11.5, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '55%' }}>
                {rec.source_url || rec.id}
              </Mono>
              <span style={{ display: 'inline-flex', gap: 14, alignItems: 'baseline' }}>
                <Mono style={{ fontSize: 10.5, color: T.dim }}>{rec.kind || '—'} · {fmtAgo(rec.created_at)}</Mono>
                <StatusChip status={rec.status} />
              </span>
            </div>
          ))}
        </Panel>
      </div>
    </>
  );
}

/* ── surface 4: the report (B6 — self-generating from real captures) ────── */
const num = (n) => Number(n || 0).toLocaleString();

function Report({ user }) {
  const [days, setDays] = useState(30);
  const { data, error, loading, refresh } = usePoll(() => portal.report(user.clientId, days), { ms: 30000, deps: [days] });
  const t = data?.totals;
  const stats = t ? [
    ['posts published', num(t.postsPublished)],
    ['total views', num(t.views)],
    ['watch time', `${num(Math.round((t.watchTimeS || 0) / 3600))}h`],
    ['avg retention', `${Math.round((t.avgRetention || 0) * 100)}%`],
    ['likes', num(t.likes)],
    ['comments', num(t.comments)],
    ['shares', num(t.shares)],
    ['new follows', num(t.follows)],
  ] : [];
  return (
    <>
      <PageTitle kicker="F5 · Report" title={data?.clientName ? `${data.clientName} — last ${days} days` : 'Performance report'}
        right={
          <div style={{ display: 'flex', gap: 4 }}>
            {[7, 30, 90].map((d) => (
              <button key={d} onClick={() => setDays(d)} className="mono" style={btn(days === d ? T.green : null)}>{d}d</button>
            ))}
          </div>
        } />
      {error && <Panel style={{ marginBottom: 16 }}><ErrorBand error={error} retry={refresh} /></Panel>}
      {t && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 16 }}>
          {stats.map(([label, value]) => (
            <Panel key={label} style={{ padding: '14px 16px' }}>
              <Label style={{ marginBottom: 6 }}>{label}</Label>
              <Mono style={{ fontSize: 22, color: T.text }}>{value}</Mono>
            </Panel>
          ))}
        </div>
      )}
      <Panel>
        <PanelHead title="Published posts (best first)" right={<Mono style={{ fontSize: 10.5, color: T.dim }}>latest capture per post</Mono>} />
        {!error && !loading && !data?.posts?.length && (
          <Empty>
            No published posts in this window yet. The report generates itself from real platform
            captures — once clips publish, every post's views, retention, and engagement appear here.
          </Empty>
        )}
        {data?.posts?.map((p) => (
          <div key={p.publishId} className="portal-row" style={{ display: 'grid', gridTemplateColumns: '90px 1fr 110px 110px 150px', gap: 12, padding: '10px 16px', borderTop: `1px solid ${T.lineSoft}`, alignItems: 'baseline' }}>
            <Mono style={{ fontSize: 11, color: T.green }}>{p.platform}</Mono>
            <span style={{ fontSize: 12.5, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {p.externalUrl ? <a href={p.externalUrl} target="_blank" rel="noreferrer" style={{ color: T.text, textDecoration: 'none' }}>{p.hook || p.clipId}</a> : (p.hook || p.clipId)}
            </span>
            <Mono style={{ fontSize: 11, color: T.text, textAlign: 'right' }}>{num(p.views)} views</Mono>
            <Mono style={{ fontSize: 11, color: T.dim, textAlign: 'right' }}>{Math.round((p.retention || 0) * 100)}% ret</Mono>
            <Mono style={{ fontSize: 11, color: T.dim, textAlign: 'right' }}>{num(p.likes)} ♥ · {num(p.comments)} 💬 · {fmtAgo(p.publishedAt)}</Mono>
          </div>
        ))}
      </Panel>
    </>
  );
}

/* ── nav + shell ────────────────────────────────────────────────────────── */
const NAV = [
  { to: '/portal', label: 'Deliverables', end: true },
  { to: '/portal/review', label: 'Sign-off' },
  { to: '/portal/upload', label: 'Submit' },
  { to: '/portal/report', label: 'Report' },
];

function Shell({ user, onLogout, children }) {
  return (
    <div style={{ minHeight: '100vh', position: 'relative' }}>
      <header style={{ position: 'sticky', top: 0, zIndex: 40, borderBottom: `1px solid ${T.line}`, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 20px', height: 54, display: 'flex', alignItems: 'center', gap: 22 }}>
          <Link to="/portal" className="mono" style={{ fontSize: 13, color: T.text, textDecoration: 'none', letterSpacing: '0.02em' }}>
            <span style={{ color: T.green }}>clipper</span>/portal
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
          <div style={{ marginLeft: 'auto' }}>
            <AccountBadge user={user} onLogout={onLogout} />
          </div>
        </div>
      </header>
      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '26px 20px 80px', position: 'relative' }}>
        {children}
      </main>
    </div>
  );
}

/* ── app: auth gate, role routing, surfaces ─────────────────────────────── */
export default function PortalApp() {
  const [authState, setAuthState] = useState({ phase: 'checking', user: null });
  useEffect(() => { document.title = 'Clipper.ai · Client portal'; }, []);
  useEffect(() => {
    auth.me()
      .then((r) => { setSession(r.user); setAuthState({ phase: 'in', user: r.user }); })
      .catch(() => setAuthState({ phase: 'out', user: null }));
  }, []);
  if (authState.phase === 'checking') return <PortalStyles><div /></PortalStyles>;
  if (authState.phase === 'out') {
    return <PortalStyles><Login onAuthed={(user) => setAuthState({ phase: 'in', user })} /></PortalStyles>;
  }
  if (authState.user?.role !== 'client') {
    // Internal users belong on the ops console — same session, different surface.
    window.location.replace('/ops');
    return <PortalStyles><div /></PortalStyles>;
  }
  const user = authState.user;
  return (
    <PortalStyles>
      <Shell user={user} onLogout={() => setAuthState({ phase: 'out', user: null })}>
        <Routes>
          <Route index element={<Deliverables />} />
          <Route path="review" element={<Signoff />} />
          <Route path="upload" element={<Submit user={user} />} />
          <Route path="report" element={<Report user={user} />} />
          <Route path="*" element={
            <>
              <PageTitle kicker="404" title="No such page" />
              <Panel><Empty><Link to="/portal" className="mono" style={btn()}>back to your deliverables</Link></Empty></Panel>
            </>
          } />
        </Routes>
      </Shell>
    </PortalStyles>
  );
}

function PortalStyles({ children }) {
  return (
    <div style={{ minHeight: '100vh', background: '#050505', color: T.text, fontFamily: "'Inter', -apple-system, sans-serif" }}>
      <style>{`
        .mono { font-family: 'JetBrains Mono', 'SF Mono', Menlo, monospace; }
        .serif { font-family: 'Newsreader', Georgia, serif; font-weight: 500; letter-spacing: -0.015em; }
        @keyframes portal-ping { 75%, 100% { transform: scale(2.4); opacity: 0; } }
        @keyframes portal-rise { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .portal-rise { animation: portal-rise 0.45s cubic-bezier(0.16,1,0.3,1) both; }
        .portal-row:hover { background: rgba(255,255,255,0.03); }
        select option { background: #0a0a0a; }
      `}</style>
      {children}
    </div>
  );
}

/* F4.4 — the review desk. The B4 status machine, operated:

     awaiting_review     → reviewers decide   (approve / changes / reject)
     changes_requested   → editors fix + resubmit
     approved_internal   → account managers send to the client
     awaiting_client     → read-only here: that decision belongs to the
                           client portal (F5); shown so ops can see what's
                           sitting with clients

   Every action posts with the picked identity (header badge); the backend
   does the real role checks and the atomic transition — a 409 here means
   someone else decided first, and the desk just refreshes to the truth. */
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ops, usePoll, fmtAgo, fmtClock } from './api.js';
import { PageTitle, Panel, PanelHead, ErrorBand, Empty, StatusChip, Label, Mono, T, btnStyle } from './OpsApp.jsx';
import { SignalBlock, ClipPreview } from './ClipGrid.jsx';

const TABS = [
  { status: 'awaiting_review', label: 'To review', who: 'reviewers' },
  { status: 'changes_requested', label: 'In edit', who: 'editors' },
  { status: 'approved_internal', label: 'To send', who: 'account managers' },
  { status: 'awaiting_client', label: 'With client', who: 'client portal (F5)' },
];

function NotesInput({ value, onChange }) {
  return (
    <input value={value} onChange={(e) => onChange(e.target.value)} placeholder="notes (kept in the audit trail)"
      className="mono"
      style={{ width: '100%', boxSizing: 'border-box', fontSize: 11.5, padding: '7px 10px', background: 'rgba(255,255,255,0.04)', border: `1px solid ${T.line}`, borderRadius: 6, color: T.text, outline: 'none' }} />
  );
}

function History({ clipId }) {
  const [events, setEvents] = useState(null);
  const [err, setErr] = useState(null);
  const load = async () => {
    try { setEvents((await ops.history(clipId)).events); setErr(null); }
    catch (e) { setErr(e); }
  };
  if (events === null) {
    return (
      <button onClick={load} className="mono" style={{ ...btnStyle(), fontSize: 10 }}>
        {err ? `history failed: ${err.message}` : 'audit trail'}
      </button>
    );
  }
  return (
    <div style={{ display: 'grid', gap: 4 }}>
      <Label>audit trail</Label>
      {!events.length && <Mono style={{ fontSize: 10.5, color: T.dim }}>no events yet</Mono>}
      {events.map((e) => (
        <Mono key={e.id} style={{ fontSize: 10.5, color: T.dim, lineHeight: 1.6 }}>
          <span style={{ color: T.text }}>{e.decision}</span> · {e.reviewer_email} ({e.reviewer_role}) · {fmtAgo(e.created_at)}
          {e.notes && <span style={{ color: '#a1a1aa' }}> — “{e.notes}”</span>}
        </Mono>
      ))}
    </div>
  );
}

/** The action row for one clip in one worklist. Backend enforces roles; this
 *  just offers the actions that make sense for the tab. */
function Actions({ clip, tab, onDone }) {
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(null);
  const [err, setErr] = useState(null);
  const run = async (name, fn) => {
    setBusy(name); setErr(null);
    try { await fn(); onDone?.(); }
    catch (e) {
      setErr(e);
      if (e.status === 409) onDone?.(); // someone got there first — show the truth
    } finally { setBusy(null); }
  };
  const decide = (decision) => run(decision, () => ops.decide(clip.id, { decision, notes: notes || undefined }));
  const btn = (name, label, color, fn) => (
    <button key={name} onClick={fn} disabled={!!busy} className="mono" style={{ ...btnStyle(color), opacity: busy && busy !== name ? 0.4 : 1 }}>
      {busy === name ? '…' : label}
    </button>
  );
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {tab === 'awaiting_review' && (
        <>
          <NotesInput value={notes} onChange={setNotes} />
          <div style={{ display: 'flex', gap: 8 }}>
            {btn('approve', 'approve', T.green, () => decide('approve'))}
            {btn('changes', 'request changes', T.amber, () => decide('changes'))}
            {btn('reject', 'reject', T.red, () => decide('reject'))}
          </div>
        </>
      )}
      {tab === 'changes_requested' && (
        <>
          <Mono style={{ fontSize: 10.5, color: T.dim }}>fix the hook on the card, then put it back in review</Mono>
          <div style={{ display: 'flex', gap: 8 }}>
            {btn('resubmit', 'resubmit for review', T.green, () => run('resubmit', () => ops.resubmit(clip.id, {})))}
          </div>
        </>
      )}
      {tab === 'approved_internal' && (
        <div style={{ display: 'flex', gap: 8 }}>
          {btn('send', 'send to client', T.green, () => run('send', () => ops.send(clip.id, {})))}
        </div>
      )}
      {tab === 'awaiting_client' && (
        <Mono style={{ fontSize: 10.5, color: T.dim }}>
          waiting on the client's sign-off — their decision arrives through the portal (F5)
        </Mono>
      )}
      {err && <Mono style={{ fontSize: 10.5, color: T.red }}>{String(err.message)}</Mono>}
    </div>
  );
}

function ReviewCard({ item, tab, onDone }) {
  const len = Number(item.t_end_s) - Number(item.t_start_s);
  return (
    <Panel style={{ display: 'grid', gridTemplateColumns: '170px 1fr', overflow: 'hidden' }}>
      <ClipPreview clip={{ ...item, asset_key: item.rendered ? 'x' : null }} height={210} />
      <div style={{ padding: '12px 14px', display: 'grid', gap: 10, alignContent: 'start' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, color: T.text }}>{item.client_name}</div>
            <Mono style={{ fontSize: 10.5, color: T.dim }}>
              <Link to={`/ops/recordings/${item.recording_id}`} style={{ color: T.dim }}>{item.recording_id}</Link>
              {' '}· {fmtClock(item.t_start_s)}–{fmtClock(item.t_end_s)} · {Math.round(len)}s · in queue {fmtAgo(item.created_at)}
              {item.assignee_email && <> · assigned {item.assignee_email}</>}
            </Mono>
          </div>
          <Mono style={{ fontSize: 20, color: T.green }}>{item.score ?? '—'}</Mono>
        </div>
        <div style={{ fontSize: 13, color: item.hook?.includes('pending editor') ? T.amber : T.text, lineHeight: 1.5 }}>
          {item.hook || <span style={{ color: T.dim }}>no hook</span>}
        </div>
        <SignalBlock signals={item.signals} />
        <div style={{ borderTop: `1px solid ${T.lineSoft}`, paddingTop: 10 }}>
          <Actions clip={item} tab={tab} onDone={onDone} />
        </div>
        <History clipId={item.id} />
      </div>
    </Panel>
  );
}

export default function ReviewDesk() {
  const [tab, setTab] = useState('awaiting_review');
  const { data, error, loading, refresh } = usePoll(() => ops.reviewQueue(tab), { ms: 4000, deps: [tab] });
  // tab counts ride along on a slower poll so the badges stay honest
  const { data: counts } = usePoll(async () => {
    const all = await Promise.all(TABS.map((t) => ops.reviewQueue(t.status).then((r) => [t.status, r.items.length])));
    return Object.fromEntries(all);
  }, { ms: 8000 });
  const items = data?.items || [];
  return (
    <>
      <PageTitle kicker="Operations · QA" title="Review desk"
        right={<Label>oldest first — age is the SLA until clients carry one</Label>} />
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {TABS.map((t) => (
          <button key={t.status} onClick={() => setTab(t.status)} className="mono"
            style={{ ...btnStyle(tab === t.status ? T.green : undefined), padding: '7px 14px' }}>
            {t.label}
            <span style={{ marginLeft: 8, opacity: 0.65 }}>{counts?.[t.status] ?? '·'}</span>
          </button>
        ))}
      </div>
      <Label style={{ marginBottom: 10 }}>{TABS.find((t) => t.status === tab)?.who}</Label>
      {error && !data && <Panel><ErrorBand error={error} retry={refresh} /></Panel>}
      {loading && !data && !error && <Panel><Empty>loading…</Empty></Panel>}
      {data && !items.length && <Panel><Empty>nothing in this worklist — the machine is ahead of you</Empty></Panel>}
      <div style={{ display: 'grid', gap: 14 }}>
        {items.map((i) => <ReviewCard key={i.id} item={i} tab={tab} onDone={refresh} />)}
      </div>
    </>
  );
}

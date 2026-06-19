/* F4.3 — the clip candidate grid. Every card carries its evidence: the score
   plus the three stored signals (energy z-score, duration fit, position
   bonus) so a reviewer sees WHY the model picked this moment — the
   explainability the scoring stage writes for exactly this screen. Rendered
   clips play inline from GET /api/clips/:id/asset; editors rewrite the hook
   in place (PATCH). Status changes live in the review desk (F4.4). */
import React, { useState } from 'react';
import { ops, usePoll, fmtClock } from './api.js';
import { Panel, PanelHead, ErrorBand, Empty, StatusChip, Label, Mono, T, btnStyle } from './OpsApp.jsx';

const clamp01 = (x) => Math.max(0, Math.min(1, x));

/** One signal as a labelled hairline meter. */
function Signal({ name, value, display }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '64px 1fr 38px', gap: 8, alignItems: 'center' }}>
      <Mono style={{ fontSize: 9.5, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{name}</Mono>
      <div style={{ height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.08)' }}>
        <div style={{ height: '100%', width: `${clamp01(value) * 100}%`, borderRadius: 2, background: T.green, opacity: 0.85 }} />
      </div>
      <Mono style={{ fontSize: 10, color: T.dim, textAlign: 'right' }}>{display}</Mono>
    </div>
  );
}

export function SignalBlock({ signals }) {
  const s = signals || {}; // signals is nullable in the schema; null skips a `= {}` default
  const z = Number(s.energyZ ?? 0);
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <Signal name="energy" value={(z + 1) / 3} display={`${z >= 0 ? '+' : ''}${z.toFixed(1)}σ`} />
      <Signal name="dur fit" value={s.durationFit} display={Number(s.durationFit ?? 0).toFixed(2)} />
      <Signal name="position" value={s.positionBonus} display={Number(s.positionBonus ?? 0).toFixed(2)} />
    </div>
  );
}

function HookEditor({ clip, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const start = () => { setDraft(clip.hook || ''); setErr(null); setEditing(true); };
  const save = async () => {
    setBusy(true); setErr(null);
    try { await ops.patchClip(clip.id, { hook: draft.trim() }); setEditing(false); onSaved?.(); }
    catch (e) { setErr(e); }
    finally { setBusy(false); }
  };
  if (!editing) {
    return (
      <button onClick={start} title="click to rewrite the hook" style={{ all: 'unset', cursor: 'text', display: 'block', width: '100%', boxSizing: 'border-box' }}>
        <div style={{ fontSize: 13, color: clip.hook?.includes('pending editor') ? T.amber : T.text, lineHeight: 1.5, minHeight: 38, padding: '6px 8px', margin: '-6px -8px', borderRadius: 6 }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
          {clip.hook || <span style={{ color: T.dim }}>no hook yet — click to write one</span>}
        </div>
      </button>
    );
  }
  return (
    <div>
      <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={2} autoFocus
        onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) save(); if (e.key === 'Escape') setEditing(false); }}
        style={{ width: '100%', boxSizing: 'border-box', fontSize: 13, lineHeight: 1.5, padding: '6px 8px', background: 'rgba(255,255,255,0.05)', border: `1px solid color-mix(in srgb, ${T.green} 33.333%, transparent)`, borderRadius: 6, color: T.text, outline: 'none', resize: 'vertical', fontFamily: 'inherit' }} />
      <div style={{ display: 'flex', gap: 8, marginTop: 6, alignItems: 'center' }}>
        <button onClick={save} disabled={busy} className="mono" style={btnStyle(T.green)}>{busy ? 'saving…' : 'save hook'}</button>
        <button onClick={() => setEditing(false)} className="mono" style={btnStyle()}>cancel</button>
        {err && <Mono style={{ fontSize: 10.5, color: T.red }}>{String(err.message)}</Mono>}
      </div>
    </div>
  );
}

export function ClipPreview({ clip, height = 230 }) {
  const [failed, setFailed] = useState(false);
  if (!clip.asset_key || failed) {
    return (
      <div style={{ height, display: 'grid', placeItems: 'center', background: 'rgba(255,255,255,0.03)', borderRadius: 8 }}>
        <Mono style={{ fontSize: 10.5, color: T.dim }}>{clip.asset_key ? 'asset unavailable' : 'not rendered — candidate only'}</Mono>
      </div>
    );
  }
  return (
    <video controls preload="metadata" onError={() => setFailed(true)}
      src={ops.assetUrl(clip.id)}
      style={{ width: '100%', height, objectFit: 'contain', background: '#000', borderRadius: 8, display: 'block' }} />
  );
}

export function ClipCard({ clip, onChanged, children }) {
  const len = Number(clip.t_end_s) - Number(clip.t_start_s);
  return (
    <Panel style={{ display: 'grid', gridTemplateRows: 'auto 1fr', overflow: 'hidden' }}>
      <ClipPreview clip={clip} />
      <div style={{ padding: '12px 14px 14px', display: 'grid', gap: 10, alignContent: 'start' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <Mono style={{ fontSize: 22, color: T.green }}>{clip.score ?? '—'}</Mono>
          <div style={{ textAlign: 'right' }}>
            <StatusChip status={clip.status} pulse={false} />
            <Mono style={{ display: 'block', fontSize: 10.5, color: T.dim, marginTop: 3 }}>
              {fmtClock(clip.t_start_s)}–{fmtClock(clip.t_end_s)} · {Math.round(len)}s · {clip.format || 'uncut'}
            </Mono>
          </div>
        </div>
        <SignalBlock signals={clip.signals} />
        <div style={{ borderTop: `1px solid ${T.lineSoft}`, paddingTop: 10 }}>
          <Label style={{ marginBottom: 5 }}>hook</Label>
          <HookEditor clip={clip} onSaved={onChanged} />
        </div>
        {children}
        <Mono style={{ fontSize: 9.5, color: '#3f3f46' }}>{clip.id}</Mono>
      </div>
    </Panel>
  );
}

export default function ClipGrid({ recordingId }) {
  const { data, error, loading, refresh } = usePoll(() => ops.clips({ recordingId }), { ms: 5000, deps: [recordingId] });
  const clips = data?.clips || [];
  return (
    <div className="ops-rise" style={{ animationDelay: '0.1s' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '0 2px 10px' }}>
        <Label>Clip candidates — scored, with the evidence</Label>
        <Label>{clips.length ? `${clips.length} candidates · top ${clips[0].score}` : ''}</Label>
      </div>
      {error && !data && <Panel><ErrorBand error={error} retry={refresh} /></Panel>}
      {loading && !data && !error && <Panel><Empty>loading…</Empty></Panel>}
      {data && !clips.length && <Panel><Empty>no candidates yet — the score stage creates them from analyze's moments</Empty></Panel>}
      {clips.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 14 }}>
          {clips.map((c) => <ClipCard key={c.id} clip={c} onChanged={refresh} />)}
        </div>
      )}
    </div>
  );
}

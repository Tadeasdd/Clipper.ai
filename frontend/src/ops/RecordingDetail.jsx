/* F4.2 — one recording, end to end: the stage timeline with each stage's
   real evidence (the pipeline_jobs payload — probe results, the analyze
   baseline, candidate counts, render counts), retry, and the clip rollup.
   The clip candidate grid plugs in below (F4.3). */
import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ops, usePoll, fmtAgo, fmtClock } from './api.js';
import { PageTitle, Panel, PanelHead, DataStates, Empty, StatusChip, Label, Mono, T, STATUS_COLOR, btnStyle } from './OpsApp.jsx';
import { StageRail } from './Board.jsx';
import ClipGrid from './ClipGrid.jsx';

/** Human one-liner for each stage's payload — the WHY behind the status. */
function evidence(stage, p = {}) {
  switch (stage) {
    case 'ingest':
      return p.durationS ? `probed ${fmtClock(p.durationS)} · ${p.hasVideo ? 'video' : 'audio-only'}` : null;
    case 'transcribe':
      return p.provider ? `provider: ${p.provider}${p.words != null ? ` · ${p.words} words` : ''}` : null;
    case 'analyze':
      return p.moments ? `${p.moments.length} moments · baseline ${p.baseline?.meanLufs ?? '?'} LUFS ±${p.baseline?.sdLufs ?? '?'}` : null;
    case 'score':
      return p.candidates != null ? `${p.candidates} candidates · top score ${p.top}` : null;
    case 'generate':
      return p.rendered != null ? `${p.rendered} clips rendered · ${p.format}` : null;
    default: return null;
  }
}

function StageRow({ s }) {
  const [open, setOpen] = useState(false);
  const line = evidence(s.stage, s.payload);
  const tookS = s.started_at && s.finished_at ? (Date.parse(s.finished_at) - Date.parse(s.started_at)) / 1000 : null;
  return (
    <div style={{ borderTop: `1px solid ${T.lineSoft}` }}>
      <button onClick={() => setOpen(!open)} className="ops-row" style={{ all: 'unset', boxSizing: 'border-box', cursor: 'pointer', display: 'grid', width: '100%', gridTemplateColumns: '120px 130px 1fr 90px 70px', gap: 12, alignItems: 'center', padding: '11px 16px' }}>
        <Mono style={{ fontSize: 12.5, color: T.text }}>{s.stage}</Mono>
        <StatusChip status={s.status} />
        <div style={{ minWidth: 0 }}>
          {s.status === 'failed'
            ? <Mono style={{ fontSize: 11, color: T.red, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.error}</Mono>
            : line
              ? <Mono style={{ fontSize: 11, color: T.dim }}>{line}</Mono>
              : <Mono style={{ fontSize: 11, color: '#3f3f46' }}>{s.status === 'pending' ? 'queued' : '—'}</Mono>}
        </div>
        <Mono style={{ fontSize: 10.5, color: T.dim, textAlign: 'right' }}>
          {s.attempts > 1 ? `attempt ${s.attempts}` : tookS != null ? `${tookS.toFixed(1)}s` : ''}
        </Mono>
        <Mono style={{ fontSize: 10.5, color: T.dim, textAlign: 'right' }}>{open ? 'close' : 'payload'}</Mono>
      </button>
      {open && (
        <pre className="mono" style={{ margin: 0, padding: '10px 16px 14px', fontSize: 10.5, lineHeight: 1.6, color: T.dim, background: 'rgba(0,0,0,0.35)', overflowX: 'auto' }}>
          {JSON.stringify({ error: s.error || undefined, ...s.payload }, null, 2)}
        </pre>
      )}
    </div>
  );
}

export default function RecordingDetail() {
  const { id } = useParams();
  const { data, error, loading, refresh } = usePoll(() => ops.job(id), { ms: 3000, deps: [id] });
  const [retryErr, setRetryErr] = useState(null);
  const failed = (data?.stages || []).some((s) => s.status === 'failed');
  const retry = async () => {
    setRetryErr(null);
    try { await ops.retry(id); refresh(); } catch (e) { setRetryErr(e); }
  };
  const byStatus = data?.clips?.by_status || {};
  return (
    <>
      <div style={{ marginBottom: 10 }}>
        <Link to="/ops" className="mono" style={{ fontSize: 11, color: T.dim, textDecoration: 'none' }}>← board</Link>
      </div>
      <PageTitle
        kicker={data ? `${data.client_name} · ${data.kind || 'recording'} · submitted ${fmtAgo(data.created_at)}` : 'recording'}
        title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 14 }}>
          <Mono style={{ fontSize: 22 }}>{id}</Mono>
          {data && <StatusChip status={data.status} pulse={data.status === 'processing'} />}
        </span>}
        right={failed && (
          <span style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {retryErr && <Mono style={{ fontSize: 11, color: T.red }}>{String(retryErr.message)}</Mono>}
            <button onClick={retry} className="mono" style={btnStyle(T.amber)}>retry failed stages</button>
          </span>
        )}
      />
      <DataStates error={error} loading={loading} data={data} refresh={refresh} panel />
      {data && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 18, marginBottom: 18 }}>
            <Panel className="ops-rise">
              <PanelHead title="Stage timeline" right={<StageRail stages={data.stages} size="lg" />} />
              {!data.stages.length && <Empty>not armed yet — the pipeline starts when the upload completes</Empty>}
              {data.stages.map((s) => <StageRow key={s.stage} s={s} />)}
            </Panel>
            <Panel className="ops-rise" style={{ animationDelay: '0.06s' }}>
              <PanelHead title="Clip rollup" right={<Label>{data.clips?.total ?? 0} total</Label>} />
              {!data.clips?.total && <Empty>no candidates yet — score creates them, generate renders the top {''}of them</Empty>}
              {Object.entries(byStatus).sort((a, b) => b[1] - a[1]).map(([st, n]) => (
                <div key={st} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 16px', borderTop: `1px solid ${T.lineSoft}` }}>
                  <StatusChip status={st} pulse={false} />
                  <Mono style={{ fontSize: 12, color: T.text }}>{n}</Mono>
                </div>
              ))}
              {data.media_info && Object.keys(data.media_info).length > 0 && (
                <div style={{ padding: '10px 16px', borderTop: `1px solid ${T.lineSoft}` }}>
                  <Label style={{ marginBottom: 6 }}>media</Label>
                  <Mono style={{ fontSize: 11, color: T.dim, display: 'block', lineHeight: 1.7 }}>
                    {data.media_info.hasVideo ? 'video' : 'audio-only'} · {fmtClock(data.duration_s)}{data.media_info.sampleRate ? ` · ${data.media_info.sampleRate} Hz` : ''}
                  </Mono>
                </div>
              )}
            </Panel>
          </div>
          <ClipGrid recordingId={id} />
        </>
      )}
    </>
  );
}

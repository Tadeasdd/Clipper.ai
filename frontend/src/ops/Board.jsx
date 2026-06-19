/* F4.1 — the processing board. The heartbeat screen: every recording, its
   five-stage rail, attempts, the REAL error when a stage parks, and the
   retry that re-arms it. Mirrors the queue truth in pipeline_jobs — nothing
   here is synthesized. Polls every 3 s. */
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ops, usePoll, fmtAgo, fmtClock } from './api.js';
import { PageTitle, Panel, PanelHead, ErrorBand, Empty, StatusChip, Label, Mono, T, STATUS_COLOR, btnStyle } from './OpsApp.jsx';

const STAGES = ['ingest', 'transcribe', 'analyze', 'score', 'generate'];

/** The five-segment stage rail. Reused at full size on the detail page. */
export function StageRail({ stages = [], size = 'sm' }) {
  const byStage = Object.fromEntries(stages.map((s) => [s.stage, s]));
  const h = size === 'sm' ? 5 : 8;
  return (
    <div style={{ display: 'flex', gap: 3, alignItems: 'center', minWidth: size === 'sm' ? 130 : 260 }}>
      {STAGES.map((name) => {
        const s = byStage[name];
        const status = s?.status || 'idle';
        const color = status === 'idle' ? 'rgba(255,255,255,0.10)' : STATUS_COLOR[status] || T.dim;
        return (
          <div key={name} title={`${name}: ${status}${s?.attempts > 1 ? ` (attempt ${s.attempts})` : ''}`}
            style={{ flex: 1, height: h, borderRadius: 3, background: status === 'pending' ? 'rgba(255,255,255,0.14)' : color,
                     opacity: status === 'done' ? 0.55 : 1,
                     animation: status === 'running' ? 'ops-railpulse 1.1s ease-in-out infinite' : 'none' }} />
        );
      })}
      <style>{`@keyframes ops-railpulse { 0%,100% { opacity: 1; } 50% { opacity: 0.35; } }`}</style>
    </div>
  );
}

function RetryButton({ recordingId, onDone }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const go = async (e) => {
    e.preventDefault(); e.stopPropagation();
    setBusy(true); setErr(null);
    try { await ops.retry(recordingId); onDone?.(); }
    catch (ex) { setErr(ex); }
    finally { setBusy(false); }
  };
  return (
    <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
      <button onClick={go} disabled={busy} className="mono" style={{ ...btnStyle(T.amber), opacity: busy ? 0.5 : 1 }}>
        {busy ? 'retrying…' : 'retry'}
      </button>
      {err && <Mono style={{ fontSize: 10.5, color: T.red }}>{String(err.message)}</Mono>}
    </span>
  );
}

function IncomingQueue() {
  const { data, error, loading, refresh } = usePoll(ops.intakeQueue, { ms: 4000 });
  return (
    <Panel style={{ marginBottom: 18 }} className="ops-rise">
      <PanelHead title="Incoming content queue" right={<Label>{data ? `${data.items.length} waiting` : '…'}</Label>} />
      {error && !data && <ErrorBand error={error} retry={refresh} />}
      {loading && !data && !error && <Empty>loading…</Empty>}
      {data && !data.items.length && <Empty>nothing waiting — every submission is in the pipeline or done</Empty>}
      {data && data.items.length > 0 && (
        <div>
          {data.items.map((i) => (
            <div key={i.id} className="ops-row" style={{ display: 'grid', gridTemplateColumns: '1fr 130px 110px 110px 90px', gap: 12, alignItems: 'center', padding: '9px 16px', borderTop: `1px solid ${T.lineSoft}` }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i.client_name}</div>
                <Mono style={{ fontSize: 10.5, color: T.dim }}>{i.id}</Mono>
              </div>
              <Mono style={{ fontSize: 11.5, color: T.dim }}>{i.kind || '—'}</Mono>
              <Mono style={{ fontSize: 11.5, color: T.dim }}>{i.source_url ? 'by url' : 'file upload'}</Mono>
              <StatusChip status={i.status} pulse={false} />
              <Mono style={{ fontSize: 11, color: T.dim, textAlign: 'right' }}>{fmtAgo(i.created_at)}</Mono>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

const fmtHours = (h) => (h == null ? '—' : h < 1 ? `${Math.round(h * 60)}m` : `${h.toFixed(1)}h`);

/* O1 — SLA & turnaround: submit→deliver per client vs the plan target, with
   late + overdue breaches flagged. Reads /api/analytics/turnaround (which also
   carries R4's org-level SLO turnaround objective). Same Panel idiom as the
   incoming queue; no new colors — breaches reuse T.red, healthy T.dim. */
function SlaPanel() {
  const { data, error, loading, refresh } = usePoll(ops.opsTurnaround, { ms: 8000 });
  const clients = data?.clients || [];
  const t = data?.totals;
  const slo = data?.slo;
  return (
    <Panel style={{ marginBottom: 18 }} className="ops-rise" >
      <PanelHead
        title="SLA & turnaround — submit → delivered"
        right={
          <div style={{ display: 'flex', gap: 14, alignItems: 'baseline' }}>
            {slo && <Mono style={{ fontSize: 10.5, color: slo.breached ? T.red : T.dim }}>
              org p95 {fmtHours(slo.sli == null ? null : slo.sli / 3600)} / {fmtHours(slo.target / 3600)}
            </Mono>}
            <Label>{t ? `${t.breachingClients} breaching · ${t.overdue} overdue` : '…'}</Label>
          </div>
        }
      />
      {error && !data && <ErrorBand error={error} retry={refresh} />}
      {loading && !data && !error && <Empty>loading…</Empty>}
      {data && !clients.length && <Empty>no deliveries yet — turnaround appears once recordings are published</Empty>}
      {clients.length > 0 && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(160px,1.4fr) 90px 90px 110px 120px 110px', gap: 12, padding: '8px 16px', borderTop: `1px solid ${T.lineSoft}` }}>
            {['Client', 'SLA', 'Delivered', 'Median', 'p95', 'Breaches'].map((h, i) => (
              <Label key={h} style={{ textAlign: i >= 2 ? 'right' : 'left' }}>{h}</Label>
            ))}
          </div>
          {clients.map((c) => (
            <div key={c.clientId} className="ops-row" style={{ display: 'grid', gridTemplateColumns: 'minmax(160px,1.4fr) 90px 90px 110px 120px 110px', gap: 12, alignItems: 'center', padding: '10px 16px', borderTop: `1px solid ${T.lineSoft}` }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.client}</div>
                <Mono style={{ fontSize: 10.5, color: T.dim }}>{c.plan || 'no plan'}</Mono>
              </div>
              <Mono style={{ fontSize: 11.5, color: T.dim, textAlign: 'right' }}>{c.slaHours}h</Mono>
              <Mono style={{ fontSize: 11.5, color: T.dim, textAlign: 'right' }}>{c.delivered}</Mono>
              <Mono style={{ fontSize: 11.5, color: T.dim, textAlign: 'right' }}>{fmtHours(c.medianHours)}</Mono>
              <Mono style={{ fontSize: 11.5, color: c.p95Hours != null && c.p95Hours > c.slaHours ? T.red : T.dim, textAlign: 'right' }}>{fmtHours(c.p95Hours)}</Mono>
              <Mono style={{ fontSize: 11.5, color: c.breached ? T.red : T.dim, textAlign: 'right' }}
                title={c.overdue ? `${c.overdue} overdue (oldest ${fmtHours(c.oldestOverdueHours)}), ${c.late} delivered late` : `${c.late} delivered late`}>
                {c.breached ? `${c.breaches}${c.overdue ? ` · ${c.overdue} overdue` : ''}` : 'on time'}
              </Mono>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

export default function Board() {
  const { data, error, loading, refresh } = usePoll(ops.jobs, { ms: 3000 });
  const jobs = data?.jobs || [];
  const counts = jobs.reduce((a, r) => ((a[r.status] = (a[r.status] || 0) + 1), a), {});
  return (
    <>
      <PageTitle
        kicker="Operations · live"
        title="Processing board"
        right={
          <div style={{ display: 'flex', gap: 14 }}>
            {['processing', 'ready', 'failed'].map((s) => (
              <Mono key={s} style={{ fontSize: 11, color: STATUS_COLOR[s] }}>{counts[s] || 0} {s}</Mono>
            ))}
          </div>
        }
      />
      <IncomingQueue />
      <SlaPanel />
      <Panel className="ops-rise" style={{ animationDelay: '0.06s' }}>
        <PanelHead title="Pipeline — every recording, right now" right={<Label>ingest → transcribe → analyze → score → generate</Label>} />
        {error && !data && <ErrorBand error={error} retry={refresh} />}
        {loading && !data && !error && <Empty>loading…</Empty>}
        {data && !jobs.length && <Empty>no recordings yet — submissions appear here the moment intake accepts them</Empty>}
        {jobs.map((r) => {
          const failed = (r.stages || []).find((s) => s.status === 'failed');
          return (
            <Link key={r.id} to={`/ops/recordings/${r.id}`} className="ops-row" style={{ display: 'block', textDecoration: 'none', borderTop: `1px solid ${T.lineSoft}` }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(180px,1.2fr) 90px 150px minmax(140px,1fr) 110px 100px', gap: 12, alignItems: 'center', padding: '11px 16px' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.client_name}</div>
                  <Mono style={{ fontSize: 10.5, color: T.dim }}>{r.id} · {r.kind || 'recording'}{r.duration_s ? ` · ${fmtClock(r.duration_s)}` : ''}</Mono>
                </div>
                <StatusChip status={r.status} pulse={r.status === 'processing'} />
                <StageRail stages={r.stages} />
                <div>
                  {failed
                    ? <Mono style={{ fontSize: 10.5, color: T.red, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={failed.error || ''}>
                        {failed.stage}: {failed.error || 'failed'}
                      </Mono>
                    : <Mono style={{ fontSize: 10.5, color: T.dim }}>
                        {(r.stages || []).filter((s) => s.status === 'done').length}/{STAGES.length} stages done
                      </Mono>}
                </div>
                <div>{failed && <RetryButton recordingId={r.id} onDone={refresh} />}</div>
                <Mono style={{ fontSize: 11, color: T.dim, textAlign: 'right' }}>{fmtAgo(r.created_at)}</Mono>
              </div>
            </Link>
          );
        })}
      </Panel>
    </>
  );
}

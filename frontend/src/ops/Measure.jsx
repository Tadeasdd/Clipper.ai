/* F4.6 — Measure: the two surfaces that complete with B5/B6.

   Analytics shows what's honestly computable TODAY (QA approval rate from
   review_events, median pipeline turnaround from pipeline_jobs) and renders
   the score↔performance correlation as the awaited thing it is — that loop
   is the moat, and faking it here would poison it.

   Publish renders the B5 contract: the queue shape the scheduler will fill
   (clip · client · platform · scheduled_at · status). Empty is the truth
   until platform adapters exist. */
import React from 'react';
import { ops, usePoll } from './api.js';
import { PageTitle, Panel, PanelHead, ErrorBand, Empty, Label, Mono, T, StatusChip } from './OpsApp.jsx';

function Metric({ label, value, unit, note, accent }) {
  return (
    <Panel style={{ padding: '16px 18px' }}>
      <Label style={{ marginBottom: 10 }}>{label}</Label>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <Mono style={{ fontSize: 34, color: accent || T.text, lineHeight: 1 }}>{value}</Mono>
        {unit && <Mono style={{ fontSize: 13, color: T.dim }}>{unit}</Mono>}
      </div>
      {note && <Mono style={{ fontSize: 10.5, color: T.dim, display: 'block', marginTop: 10, lineHeight: 1.6 }}>{note}</Mono>}
    </Panel>
  );
}

function Analytics() {
  const { data, error, loading, refresh } = usePoll(ops.opsAnalytics, { ms: 10000 });
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState(null);
  const fmtH = (h) => (h == null ? '—' : h < 1 ? `${Math.round(h * 60)}` : h.toFixed(1));
  const corr = data?.scoreCorrelation;
  const w = data?.scoringWeights;
  const retrain = async () => {
    setBusy(true); setMsg(null);
    try {
      const res = await fetch(((import.meta.env && import.meta.env.VITE_API_BASE) || '') + '/api/analytics/retrain', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ note: 'from ops dashboard' }),
      });
      const body = await res.json();
      setMsg(res.ok ? { ok: true, text: `weights updated (n=${body.basis.sample})` } : { ok: false, text: body.error });
      refresh();
    } catch (e) { setMsg({ ok: false, text: String(e.message) }); }
    finally { setBusy(false); }
  };
  return (
    <>
      <PageTitle kicker="Operations · the loop" title="Ops analytics" />
      {error && !data && <Panel><ErrorBand error={error} retry={refresh} /></Panel>}
      {loading && !data && !error && <Panel><Empty>loading…</Empty></Panel>}
      {data && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14, marginBottom: 14 }} className="ops-rise">
            <Metric label="First-pass QA approval" accent={T.green}
              value={data.approvalRate == null ? '—' : `${Math.round(data.approvalRate * 100)}%`}
              note={data.approvalRate == null ? 'no verdicts yet' : `${data.verdicts} internal verdicts in review_events — when this drifts, the scoring weights are off`} />
            <Metric label="Median pipeline turnaround"
              value={fmtH(data.medianTurnaroundHours)}
              unit={data.medianTurnaroundHours == null ? '' : data.medianTurnaroundHours < 1 ? 'min' : 'h'}
              note={data.medianTurnaroundHours == null ? 'no completed pipelines yet' : 'ingest start → last render, recordings with all five stages done'} />
            <Metric label="Distribution" accent={T.green}
              value={data.totalViews?.toLocaleString?.() ?? '—'} unit="views"
              note={`latest capture per post, ${data.postsMeasured} posts measured`} />
            <Metric label="Score ↔ performance"
              accent={corr?.value == null ? T.amber : T.green}
              value={corr?.value == null ? '—' : `ρ ${corr.value}`}
              note={corr?.value == null
                ? `the loop needs ≥ ${corr?.needed ?? 8} published clips with captures (have ${corr?.sample ?? 0})`
                : `Spearman over ${corr.sample} published clips, performance client-normalized. Near zero under the local metrics driver is the honest reading — the simulator never peeks at the score.`} />
          </div>
          <Panel className="ops-rise" style={{ animationDelay: '0.06s' }}>
            <PanelHead title="Scoring weights — what the model currently believes"
              right={<button onClick={retrain} disabled={busy} className="mono" style={{ fontSize: 10, padding: '4px 12px', borderRadius: 6, cursor: 'pointer', border: `1px solid ${T.green}55`, color: T.green, background: T.green + '14', opacity: busy ? 0.5 : 1 }}>{busy ? 'running…' : 'run retrain cycle'}</button>} />
            <div style={{ display: 'flex', gap: 26, alignItems: 'baseline', padding: '13px 16px', flexWrap: 'wrap' }}>
              {w && Object.entries(w.weights).map(([k, v]) => (
                <Mono key={k} style={{ fontSize: 13 }}>
                  <span style={{ color: T.dim, fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{k} </span>
                  <span style={{ color: T.green }}>{Number(v).toFixed(3)}</span>
                </Mono>
              ))}
              <Mono style={{ fontSize: 10.5, color: T.dim }}>
                {w?.source === 'retrained' ? `retrained · ${w.id}` : 'built-in defaults — no retrain cycle yet'}
              </Mono>
              {msg && <Mono style={{ fontSize: 10.5, color: msg.ok ? T.green : T.amber }}>{msg.text}</Mono>}
            </div>
          </Panel>
        </>
      )}
    </>
  );
}

function Publish() {
  const { data, error, loading, refresh } = usePoll(ops.publishQueue, { ms: 5000 });
  const [actErr, setActErr] = React.useState(null);
  const items = data?.items || [];
  const retry = async (id) => {
    setActErr(null);
    try { await fetch(((import.meta.env && import.meta.env.VITE_API_BASE) || '') + `/api/publish/${id}/retry`, { method: 'POST' }); refresh(); }
    catch (e) { setActErr(e); }
  };
  const cols = ['clip', 'client', 'platform', 'scheduled', 'status', ''];
  return (
    <>
      <PageTitle kicker="Operations · distribution" title="Publishing queue"
        right={actErr && <Mono style={{ fontSize: 11, color: T.red }}>{String(actErr.message)}</Mono>} />
      <Panel className="ops-rise">
        <PanelHead title="Per client, per platform — failed first" right={<Label>{items.length} jobs</Label>} />
        <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr 0.7fr 1fr 1.3fr 80px', gap: 12, padding: '9px 16px', borderBottom: `1px solid ${T.lineSoft}` }}>
          {cols.map((c, i) => <Label key={i}>{c}</Label>)}
        </div>
        {error && !data && <ErrorBand error={error} retry={refresh} />}
        {loading && !data && !error && <Empty>loading…</Empty>}
        {data && !items.length && (
          <Empty>
            nothing queued — clips land here on sign-off (auto-scheduled onto every
            connected platform) or via POST /api/publish; the scheduler drains them
            at their scheduled time
          </Empty>
        )}
        {items.map((i) => (
          <div key={i.id} className="ops-row" style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr 0.7fr 1fr 1.3fr 80px', gap: 12, alignItems: 'center', padding: '10px 16px', borderTop: `1px solid ${T.lineSoft}` }}>
            <div style={{ minWidth: 0 }}>
              <Mono style={{ fontSize: 11, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i.hook || i.clip_id}</Mono>
              <Mono style={{ fontSize: 9.5, color: T.dim }}>{i.clip_id}</Mono>
            </div>
            <Mono style={{ fontSize: 11 }}>{i.client_name || '—'}</Mono>
            <Mono style={{ fontSize: 11 }}>{i.platform}{i.handle ? ` ${i.handle}` : ''}</Mono>
            <Mono style={{ fontSize: 11, color: T.dim }}>{i.scheduled_at ? new Date(i.scheduled_at).toLocaleString() : 'asap'}</Mono>
            <div style={{ minWidth: 0 }}>
              <StatusChip status={i.status === 'publishing' ? 'running' : i.status === 'published' ? 'published' : i.status === 'failed' ? 'failed' : 'scheduled'} pulse={i.status === 'publishing'} />
              {i.status === 'failed' && i.error && (
                <Mono title={i.error} style={{ fontSize: 9.5, color: T.red, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {i.attempts}× · {i.error}
                </Mono>
              )}
              {i.status === 'published' && i.external_url && (
                <a href={(import.meta.env && import.meta.env.VITE_API_BASE || '') + i.external_url} target="_blank" rel="noreferrer" className="mono" style={{ fontSize: 9.5, color: T.green }}>
                  view delivery →
                </a>
              )}
            </div>
            <div>{i.status === 'failed' && <button onClick={() => retry(i.id)} className="mono" style={{ fontSize: 10, padding: '4px 10px', borderRadius: 6, cursor: 'pointer', border: `1px solid ${T.amber}55`, color: T.amber, background: T.amber + '14' }}>retry</button>}</div>
          </div>
        ))}
      </Panel>
    </>
  );
}

export default function Measure({ surface }) {
  return surface === 'publish' ? <Publish /> : <Analytics />;
}

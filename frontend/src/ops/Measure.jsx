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
import { PageTitle, Panel, PanelHead, ErrorBand, Empty, Label, Mono, T } from './OpsApp.jsx';

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
  const fmtH = (h) => (h == null ? '—' : h < 1 ? `${Math.round(h * 60)}` : h.toFixed(1));
  return (
    <>
      <PageTitle kicker="Operations · the loop" title="Ops analytics" />
      {error && !data && <Panel><ErrorBand error={error} retry={refresh} /></Panel>}
      {loading && !data && !error && <Panel><Empty>loading…</Empty></Panel>}
      {data && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }} className="ops-rise">
          <Metric label="First-pass QA approval" accent={T.green}
            value={data.approvalRate == null ? '—' : `${Math.round(data.approvalRate * 100)}%`}
            note={data.approvalRate == null ? 'no verdicts yet' : `${data.verdicts} internal verdicts in review_events — when this drifts, the scoring weights are off`} />
          <Metric label="Median pipeline turnaround"
            value={fmtH(data.medianTurnaroundHours)}
            unit={data.medianTurnaroundHours == null ? '' : data.medianTurnaroundHours < 1 ? 'min' : 'h'}
            note={data.medianTurnaroundHours == null ? 'no completed pipelines yet' : 'ingest start → last render, recordings with all five stages done'} />
          <Metric label="Score ↔ performance" value="awaits B6" accent={T.amber}
            note="the moat: correlate clips.score with realized views/retention from clip_metrics, then retrain the scoring weights. Needs published clips — stays honest until then." />
        </div>
      )}
    </>
  );
}

function Publish() {
  const { data, error, loading, refresh } = usePoll(ops.publishQueue, { ms: 8000 });
  const items = data?.items || [];
  const cols = ['clip', 'client', 'platform', 'scheduled', 'status'];
  return (
    <>
      <PageTitle kicker="Operations · distribution" title="Publishing queue" />
      <Panel className="ops-rise">
        <PanelHead title="Scheduled — per client, per platform" right={<Label>{items.length} queued</Label>} />
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 1fr 1fr', gap: 12, padding: '9px 16px', borderBottom: `1px solid ${T.lineSoft}` }}>
          {cols.map((c) => <Label key={c}>{c}</Label>)}
        </div>
        {error && !data && <ErrorBand error={error} retry={refresh} />}
        {loading && !data && !error && <Empty>loading…</Empty>}
        {data && !items.length && (
          <Empty>
            empty until B5 — platform adapters (YouTube Shorts · TikTok · Reels · LinkedIn · X)
            drain publish_jobs at scheduled_at; approved clips queue here, and only approved
            clips: the status machine guarantees it
          </Empty>
        )}
        {items.map((i) => (
          <div key={i.id} className="ops-row" style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 1fr 1fr', gap: 12, padding: '10px 16px', borderTop: `1px solid ${T.lineSoft}` }}>
            <Mono style={{ fontSize: 11 }}>{i.clip_id}</Mono>
            <Mono style={{ fontSize: 11 }}>{i.client_name || '—'}</Mono>
            <Mono style={{ fontSize: 11 }}>{i.platform}</Mono>
            <Mono style={{ fontSize: 11 }}>{i.scheduled_at || '—'}</Mono>
            <Mono style={{ fontSize: 11 }}>{i.status}</Mono>
          </div>
        ))}
      </Panel>
    </>
  );
}

export default function Measure({ surface }) {
  return surface === 'publish' ? <Publish /> : <Analytics />;
}

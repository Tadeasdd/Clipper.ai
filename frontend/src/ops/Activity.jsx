/* O5 — the system-wide activity feed. Every material action across intake,
   processing, review, publish, billing, and admin, newest first, filterable by
   area. Reads /api/audit (ops scope). Same Panel idiom + tokens as the rest of
   the dashboard — no new colors/SVGs/fonts. */
import React, { useState } from 'react';
import { ops, usePoll, fmtAgo } from './api.js';
import { PageTitle, Panel, PanelHead, ErrorBand, Empty, Label, Mono, T, btnStyle } from './OpsApp.jsx';

const AREAS = ['all', 'intake', 'processing', 'review', 'publish', 'billing', 'admin'];
const areaColor = (a) => (a === 'review' ? T.amber : a === 'admin' || a === 'billing' || a === 'processing' ? T.dim : T.green);

export default function Activity() {
  const [area, setArea] = useState('all');
  const { data, error, loading, refresh } = usePoll(() => ops.opsAudit(area === 'all' ? undefined : area), { ms: 5000, deps: [area] });
  const events = data?.events || [];
  return (
    <>
      <PageTitle
        kicker="Operations · audit"
        title="Activity feed"
        right={
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {AREAS.map((a) => (
              <button key={a} onClick={() => setArea(a)} className="mono"
                style={{ ...btnStyle(area === a ? T.green : undefined), padding: '6px 11px', fontSize: 10.5 }}>{a}</button>
            ))}
          </div>
        }
      />
      <Panel className="ops-rise">
        <PanelHead title="Every material action, newest first" right={<Label>{events.length} events</Label>} />
        {error && !data && <ErrorBand error={error} retry={refresh} />}
        {loading && !data && !error && <Empty>loading…</Empty>}
        {data && !events.length && <Empty>no activity in this view yet</Empty>}
        {events.map((e) => (
          <div key={e.id} className="ops-row" style={{ display: 'grid', gridTemplateColumns: '90px 110px minmax(220px,1fr) 150px 90px', gap: 12, alignItems: 'center', padding: '10px 16px', borderTop: `1px solid ${T.lineSoft}` }}>
            <Mono style={{ fontSize: 10.5, color: areaColor(e.area) }}>{e.area}</Mono>
            <Mono style={{ fontSize: 10.5, color: T.dim }}>{e.action}</Mono>
            <div style={{ fontSize: 12.5, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={e.summary || ''}>{e.summary || '—'}</div>
            <Mono style={{ fontSize: 10.5, color: T.dim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.actor_role || 'system'}{e.client_id ? ` · ${e.client_id}` : ''}</Mono>
            <Mono style={{ fontSize: 10.5, color: T.dim, textAlign: 'right' }}>{fmtAgo(e.ts)}</Mono>
          </div>
        ))}
      </Panel>
    </>
  );
}

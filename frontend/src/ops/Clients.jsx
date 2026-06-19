/* F4.5 — client management. The account-manager surface: plan, cadence, and
   brand_config. auto_publish lives here because the review machine reads it —
   flipping it is the client opting out of per-clip sign-off, so the toggle
   says exactly that. */
import React, { useState } from 'react';
import { ops, usePoll, fmtAgo } from './api.js';
import { PageTitle, Panel, PanelHead, ErrorBand, Empty, Label, Mono, T, btnStyle } from './OpsApp.jsx';

const field = () => ({
  width: '100%', boxSizing: 'border-box', fontSize: 12.5, padding: '8px 11px',
  background: 'rgba(255,255,255,0.04)', border: `1px solid ${T.line}`,
  borderRadius: 6, color: T.text, outline: 'none',
});

function ClientEditor({ client, onDone, onCancel }) {
  const isNew = !client;
  const [name, setName] = useState(client?.name || '');
  const [plan, setPlan] = useState(client?.plan || '');
  const [cadence, setCadence] = useState(client?.cadence || '');
  const [autoPublish, setAutoPublish] = useState(client?.brand_config?.auto_publish === true);
  const [stage, setStage] = useState(client?.lifecycle_stage || 'onboarding');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const save = async () => {
    setBusy(true); setErr(null);
    const body = {
      name: name.trim(), plan: plan.trim() || null, cadence: cadence.trim() || null,
      brandConfig: { ...(client?.brand_config || {}), auto_publish: autoPublish },
      ...(isNew ? {} : { lifecycleStage: stage }), // O3: operator advances the lifecycle
    };
    try {
      if (isNew) await ops.createClient(body);
      else await ops.patchClient(client.id, body);
      onDone();
    } catch (e) { setErr(e); }
    finally { setBusy(false); }
  };
  return (
    <div style={{ padding: '14px 16px', display: 'grid', gap: 10, borderTop: `1px solid ${T.lineSoft}` }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        <div>
          <Label style={{ marginBottom: 5 }}>name</Label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Podcast" style={field()} />
        </div>
        <div>
          <Label style={{ marginBottom: 5 }}>plan</Label>
          <input value={plan} onChange={(e) => setPlan(e.target.value)} placeholder="scoped on the strategy call" style={field()} />
        </div>
        <div>
          <Label style={{ marginBottom: 5 }}>cadence</Label>
          <input value={cadence} onChange={(e) => setCadence(e.target.value)} placeholder="weekly" style={field()} />
        </div>
      </div>
      <label style={{ display: 'flex', gap: 10, alignItems: 'center', cursor: 'pointer' }}>
        <input type="checkbox" checked={autoPublish} onChange={(e) => setAutoPublish(e.target.checked)} style={{ accentColor: T.green }} />
        <span style={{ fontSize: 12.5, color: T.text }}>
          auto-publish <Mono style={{ fontSize: 10.5, color: T.amber }}>— client opts OUT of per-clip sign-off; internal approval publishes directly</Mono>
        </span>
      </label>
      {!isNew && (
        <div style={{ maxWidth: 240 }}>
          <Label style={{ marginBottom: 5 }}>lifecycle stage</Label>
          <select value={stage} onChange={(e) => setStage(e.target.value)} style={field()}>
            {['onboarding', 'active', 'at_risk', 'churned'].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button onClick={save} disabled={busy || !name.trim()} className="mono" style={{ ...btnStyle(T.green), opacity: !name.trim() ? 0.4 : 1 }}>
          {busy ? 'saving…' : isNew ? 'create client' : 'save changes'}
        </button>
        {onCancel && <button onClick={onCancel} className="mono" style={btnStyle()}>cancel</button>}
        {err && <Mono style={{ fontSize: 11, color: T.red }}>{String(err.message)}</Mono>}
      </div>
    </div>
  );
}

/* O3 — client health & lifecycle. Per client: lifecycle stage, a computed
   health score (usage/turnaround/approval/performance), onboarding progress,
   and churn flags. At-risk clients sort first and flag in T.red. Additive panel;
   the Accounts table below is unchanged. No new colors. */
const scoreColor = (s) => (s == null ? T.dim : s >= 70 ? T.green : s >= 50 ? T.amber : T.red);
const stageColor = (st) => (st === 'active' ? T.green : st === 'at_risk' ? T.red : st === 'churned' ? T.dim : T.amber);

function HealthPanel() {
  const { data, error, loading, refresh } = usePoll(ops.opsHealth, { ms: 8000 });
  const clients = data?.clients || [];
  const t = data?.totals;
  return (
    <Panel style={{ marginBottom: 16 }} className="ops-rise">
      <PanelHead title="Client health & lifecycle"
        right={<Label>{t ? `${t.atRisk} at-risk · ${t.onboarding} onboarding` : '…'}</Label>} />
      {error && !data && <ErrorBand error={error} retry={refresh} />}
      {loading && !data && !error && <Empty>loading…</Empty>}
      {data && !clients.length && <Empty>no clients yet</Empty>}
      {clients.length > 0 && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(160px,1.5fr) 100px 80px 110px 1fr', gap: 12, padding: '8px 16px', borderTop: `1px solid ${T.lineSoft}` }}>
            {['Client', 'Stage', 'Health', 'Onboarding', 'Churn signals'].map((h, i) => (
              <Label key={h} style={{ textAlign: i === 2 ? 'right' : 'left' }}>{h}</Label>
            ))}
          </div>
          {clients.map((c) => (
            <div key={c.clientId} className="ops-row" style={{ display: 'grid', gridTemplateColumns: 'minmax(160px,1.5fr) 100px 80px 110px 1fr', gap: 12, alignItems: 'center', padding: '10px 16px', borderTop: `1px solid ${T.lineSoft}` }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                <Mono style={{ fontSize: 10.5, color: T.dim }}>{c.plan || 'no plan'}</Mono>
              </div>
              <Mono style={{ fontSize: 11, color: stageColor(c.stage) }}>{c.stage}</Mono>
              <Mono style={{ fontSize: 13, color: scoreColor(c.score), textAlign: 'right' }}>{c.score == null ? '—' : c.score}</Mono>
              <Mono style={{ fontSize: 11.5, color: c.onboarding.complete ? T.dim : T.amber }}>{c.onboarding.done}/{c.onboarding.total}{c.onboarding.complete ? ' ✓' : ''}</Mono>
              <Mono style={{ fontSize: 11, color: c.churn.atRisk ? T.red : T.dim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {c.churn.atRisk ? c.churn.reasons.join(', ') : 'healthy'}
              </Mono>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

export default function Clients() {
  const { data, error, loading, refresh } = usePoll(ops.clients, { ms: 6000 });
  const [editing, setEditing] = useState(null); // client id | 'new' | null
  const clients = data?.clients || [];
  return (
    <>
      <PageTitle kicker="Operations · accounts" title="Clients"
        right={<button onClick={() => setEditing('new')} className="mono" style={btnStyle(T.green)}>+ new client</button>} />
      {editing === 'new' && (
        <Panel style={{ marginBottom: 16 }}>
          <PanelHead title="New client" />
          <ClientEditor onDone={() => { setEditing(null); refresh(); }} onCancel={() => setEditing(null)} />
        </Panel>
      )}
      <HealthPanel />
      <Panel className="ops-rise">
        <PanelHead title="Accounts" right={<Label>{clients.length} clients</Label>} />
        {error && !data && <ErrorBand error={error} retry={refresh} />}
        {loading && !data && !error && <Empty>loading…</Empty>}
        {data && !clients.length && <Empty>no clients yet — they're created here after the strategy call</Empty>}
        {clients.map((c) => (
          <div key={c.id} style={{ borderTop: `1px solid ${T.lineSoft}` }}>
            <div className="ops-row" style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 1fr 110px 80px', gap: 12, alignItems: 'center', padding: '11px 16px' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, color: T.text }}>{c.name}</div>
                <Mono style={{ fontSize: 10, color: T.dim }}>{c.id} · {fmtAgo(c.created_at)}</Mono>
              </div>
              <Mono style={{ fontSize: 11.5, color: c.plan ? T.text : T.dim }}>{c.plan || 'no plan set'}</Mono>
              <Mono style={{ fontSize: 11.5, color: c.cadence ? T.text : T.dim }}>{c.cadence || 'no cadence'}</Mono>
              <Mono style={{ fontSize: 11, color: c.brand_config?.auto_publish ? T.amber : T.dim }}>
                {c.brand_config?.auto_publish ? 'auto-publish ON' : 'sign-off required'}
              </Mono>
              <Mono style={{ fontSize: 11, color: T.dim }}>{c.open_recordings} open rec.</Mono>
              <button onClick={() => setEditing(editing === c.id ? null : c.id)} className="mono" style={btnStyle()}>
                {editing === c.id ? 'close' : 'edit'}
              </button>
            </div>
            {editing === c.id && <ClientEditor client={c} onDone={() => { setEditing(null); refresh(); }} />}
          </div>
        ))}
      </Panel>
    </>
  );
}

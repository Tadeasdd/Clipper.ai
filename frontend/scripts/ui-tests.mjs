/* U5 — component/unit tests (offline, happy-dom, no backend, no build step).
   Covers usePoll's loading → data → error → refresh state machine: the stateful
   core behind every ops/portal data view. usePoll lives in pure-JS ops/api.js,
   so we render it through a real React component with React.createElement (no JSX
   transform needed). The U4 state helpers (DataStates/States) and the ReviewDesk
   decision flow are covered end-to-end by integration:f4 / f5 against a live
   backend — this is the isolated unit layer beneath them. */
import { GlobalRegistrator } from '@happy-dom/global-registrator';
GlobalRegistrator.register({ url: 'http://localhost/' });

import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { usePoll } from '../src/ops/api.js';

const assert = (cond, msg) => { if (!cond) { console.error('FAIL:', msg); process.exit(1); } console.log('ok:', msg); };
const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

// A probe that surfaces usePoll's state and hands `refresh` back to the test.
let last = null, refreshFn = null; const history = [];
function Probe({ fn }) {
  const st = usePoll(fn, { ms: 100000 }); // long interval: we drive ticks manually via refresh
  last = st; refreshFn = st.refresh;
  history.push({ loading: st.loading, n: st.data && st.data.n, err: st.error && String(st.error.message) });
  return React.createElement('div', null, st.loading ? 'loading' : st.error ? 'error' : 'data');
}

const root = createRoot(document.getElementById('root') || (() => {
  const d = document.createElement('div'); d.id = 'root'; document.body.appendChild(d); return d;
})());

// mode flips what the polled fn does, so one stable fn covers success + failure.
let mode = 'ok';
const fn = async () => { if (mode === 'ok') return { n: 1 }; throw new Error('boom'); };

await act(async () => { root.render(React.createElement(Probe, { fn })); });
assert(history[0] && history[0].loading === true && !history[0].n, 'starts in the loading state');
await flush();
assert(last.loading === false && last.data && last.data.n === 1 && last.error === null, 'resolves to data, clears loading');

// flip to failure and re-poll: error is set, the last good data is retained
mode = 'err';
await act(async () => { await refreshFn(); });
assert(last.error && String(last.error.message) === 'boom', 'a failed poll surfaces the error');
assert(last.data && last.data.n === 1, 'last good data is retained through an error (honest stale render)');

// recover: a successful re-poll clears the error
mode = 'ok';
await act(async () => { await refreshFn(); });
assert(last.error === null && last.data.n === 1, 'recovery clears the error');

await act(async () => { root.unmount(); });
console.log('\nU5 component tests passed.');

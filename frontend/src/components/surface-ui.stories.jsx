import React from 'react';
import { Mono, Label, Panel, PanelHead, btnStyle, field, T } from './surface-ui.jsx';

/* P4 — the ops/portal surface primitives from surface-ui.jsx (the U3 leaf module),
   rendered with the same inline-style tokens the two product apps use. */

export default { title: 'Design system/Surface primitives' };

export const Typography = () => (
  <div style={{ display: 'grid', gap: 12 }}>
    <Label>Label — section eyebrow</Label>
    <Mono style={{ color: T.text }}>Mono — monospace value text</Mono>
  </div>
);

export const Panels = () => (
  <Panel style={{ width: 360 }}>
    <PanelHead title="Panel head" right={<Mono style={{ color: T.green, fontSize: 11 }}>right slot</Mono>} />
    <div style={{ padding: 16, color: T.text, fontSize: 13 }}>Panel body content sits here.</div>
  </Panel>
);

export const Buttons = () => (
  <div style={{ display: 'flex', gap: 10 }}>
    <button style={btnStyle()}>neutral</button>
    <button style={btnStyle(T.green)}>approve</button>
    <button style={btnStyle(T.amber)}>hold</button>
    <button style={btnStyle(T.red)}>reject</button>
  </div>
);

export const Field = () => (
  <div style={{ width: 320 }}>
    <label htmlFor="demo-field" style={{ display: 'block', marginBottom: 8 }}><Label>Field label</Label></label>
    <input id="demo-field" style={field} defaultValue="editable value" />
  </div>
);

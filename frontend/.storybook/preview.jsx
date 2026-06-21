import React from 'react';
import '../src/index.css';

/* P4 — global preview config. The design system lives on a black canvas with the
   neon-green brand, so every story renders on #000 with the app's light body text
   and the app stylesheet (tokens + utilities) loaded.

   @type {import('@storybook/react').Preview} */
const preview = {
  parameters: {
    backgrounds: {
      default: 'black',
      values: [
        { name: 'black', value: '#000000' },
        { name: 'stone-950', value: '#0c0a09' },
      ],
    },
    layout: 'centered',
    a11y: {
      // axe is scoped to the rendered component (#storybook-root). `region` is a
      // page-level landmark rule that doesn't apply to an isolated primitive, so
      // it's disabled here AND in the test-runner — every other rule stays on.
      config: { rules: [{ id: 'region', enabled: false }] },
    },
  },
  decorators: [
    (Story) => (
      <div style={{ background: '#000', color: '#e7e5e4', padding: 32, fontFamily: "'Inter', system-ui, sans-serif" }}>
        <Story />
      </div>
    ),
  ],
};
export default preview;

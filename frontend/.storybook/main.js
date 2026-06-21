import { mergeConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

/* P4 — Storybook for the design system. Runs on the app's own Vite + React +
   Tailwind-v4 stack so the primitives render exactly as they do in the app.

   @type {import('@storybook/react-vite').StorybookConfig} */
const config = {
  stories: ['../src/**/*.stories.jsx'],
  addons: ['@storybook/addon-essentials', '@storybook/addon-a11y'],
  framework: { name: '@storybook/react-vite', options: {} },
  core: { disableTelemetry: true },
  async viteFinal(cfg) {
    // Storybook inherits the app's vite.config. Drop its CSP-meta plugin — it
    // injects a strict Content-Security-Policy <meta> into built HTML that would
    // block Storybook's own inline runtime — and ensure Tailwind v4 is present so
    // the @theme tokens + utility classes resolve in the preview iframe.
    const plugins = (cfg.plugins || []).filter((p) => !p || p.name !== 'clipper-csp-meta');
    const hasTailwind = plugins.flat().some((p) => p && String(p.name).includes('tailwind'));
    return mergeConfig({ ...cfg, plugins }, hasTailwind ? {} : { plugins: [tailwindcss()] });
  },
};
export default config;

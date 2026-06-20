import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Backend origin for the dev proxy. Defaults to localhost:8080 (native dev,
// unchanged); the docker stack sets BACKEND_ORIGIN=http://backend:8080 so the
// frontend container reaches the backend service over the compose network.
const backendOrigin = process.env.BACKEND_ORIGIN || 'http://localhost:8080';

/* S5: Content-Security-Policy for the built app, allowlisting EXACTLY what the
   code loads — the bundle (self), the Newsreader display font (Google Fonts),
   PostHog analytics (external <script src>, no eval), the <video> asset
   (media-src), and /api fetches. No 'unsafe-eval'; 'unsafe-inline' only for
   style (React inline-style props + injected <style>; JSON-LD is data, exempt).
   When the API is a separate origin (VITE_API_BASE), it's added to connect/media. */
const apiOrigin = (() => { try { return process.env.VITE_API_BASE ? new URL(process.env.VITE_API_BASE).origin : ''; } catch { return ''; } })();
const POSTHOG = 'https://eu.i.posthog.com https://eu-assets.i.posthog.com';
const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "img-src 'self' data:",
  "font-src 'self' data: https://fonts.gstatic.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "script-src 'self' https://eu-assets.i.posthog.com",
  `connect-src 'self' ${POSTHOG}${apiOrigin ? ' ' + apiOrigin : ''}`,
  `media-src 'self'${apiOrigin ? ' ' + apiOrigin : ''}`,
].join('; ');

// Inject the CSP meta into the BUILT index.html only. The Vite dev server is
// left alone — HMR needs inline scripts + eval + a ws connection that a strict
// CSP would break, and the dev stack isn't the hardened surface.
const cspMeta = () => ({
  name: 'clipper-csp-meta',
  transformIndexHtml: {
    order: 'pre',
    handler(_html, ctx) {
      if (ctx.server) return; // dev server → no CSP
      return [{ tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP }, injectTo: 'head-prepend' }];
    },
  },
});

export default defineConfig({
  plugins: [react(), tailwindcss(), cspMeta()],
  /* P1: code-splitting + perf budgets. Routes are already React.lazy-split in
     App.jsx (a chunk per page/studio/ops/portal), and Landing.jsx lazy-loads
     its below-the-fold visuals. Here we (a) emit the build manifest so
     scripts/bundle-budget.mjs can measure the landing-route initial graph
     offline, and (b) hoist the React/router runtime into a single long-lived
     `vendor` chunk so it caches once across every route instead of riding
     inside the entry chunk. Pure output reorganization — no module's code
     changes, so the rendered pages stay pixel-identical. */
  build: {
    manifest: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/react') || id.includes('/node_modules/scheduler/')) {
            return 'vendor';
          }
          return undefined;
        },
      },
    },
  },
  server: {
    port: 5173,
    // Proxy API calls to the backend in local dev (Stage F4+).
    proxy: {
      '/api': { target: backendOrigin, changeOrigin: true },
    },
  },
});

# Clipper — demo frontend

The marketing site + live studio demo for Clipper, wired to the FastAPI backend
in **demo mode** (no sign-in wall). Founders land on the marketing page, click
into the studio, see the pre-seeded showcase instantly, and can upload their own
podcast to watch the real pipeline run.

## What's here

- `components/ClipperApp.jsx` — the full UI (marketing + studio). Originally a
  single-file design artifact; surgically rewired to the real backend (the
  `window.storage` mock and the simulated progress timer are gone).
- `lib/clipper.js` — the API client: presign → upload to R2 → create job → poll,
  plus showcase loading and feedback submission. **No auth** — demo mode resolves
  every request to the shared demo org.
- `lib/storageShim.js` — a tiny `localStorage` polyfill so residual marketing-page
  storage calls keep working.
- `components/FeedbackWidget.jsx` — floating feedback capture → `POST /v1/feedback`.

## Run locally

You need the backend running first (see the backend's `docker-compose.demo.yml`).

```bash
cp .env.local.example .env.local      # NEXT_PUBLIC_API_URL=http://localhost:8000
npm install
npm run dev                           # http://localhost:3000
```

What to check:
1. The marketing page renders, and the CTA drops you into the studio.
2. The studio shows the seeded showcase runs (once you've run the backend's
   `seed_demo.py`). If you haven't seeded yet, history is empty — that's fine.
3. Uploading a file kicks off a real job; the progress bar + step labels track
   the backend status; results appear when it completes.
4. The Feedback button (bottom-right) submits and you can read it back with
   `curl -H "X-Admin-Token: <token>" $API/v1/feedback`.

## Configure

Only one env var: `NEXT_PUBLIC_API_URL` — where the backend lives. Local during
dev, your `https://<app>.fly.dev` once the backend is deployed.

## Deploy (Vercel)

```bash
npm i -g vercel
vercel            # first run links/creates the project
vercel --prod
```

Set `NEXT_PUBLIC_API_URL` in the Vercel project's Environment Variables to your
deployed backend URL, and make sure that backend's `CORS_ORIGINS` includes your
Vercel domain.

## Notes

- `next.config.mjs` intentionally sets `eslint.ignoreDuringBuilds` and
  `typescript.ignoreBuildErrors`: the studio UI is untyped artifact JS, and
  retrofitting types across ~4,800 lines isn't worth it for a feedback MVP.
  Turn both off when you harden the frontend.
- This build verified clean with `next build` (Next 14.2.x).

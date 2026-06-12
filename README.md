# Clipper.ai

AI-native content operations. We turn long-form content into high-performing
short-form at scale — AI systems find the strongest moments, human editors
refine every clip. This repo is the machinery behind that service: the
marketing site, the internal operations platform, and the pipeline.

> Customers buy a managed service, not software. The ops dashboard is primary;
> the client dashboard is secondary. See `docs/ARCHITECTURE.md`.

## Layout

```
frontend/   Vite + React + Tailwind v4 — marketing site (live), dashboards (staged)
backend/    Express API + Postgres schema + pipeline worker stubs
docs/       BUILD_STAGES.md (the roadmap) · ARCHITECTURE.md
```

## Quick start

```bash
# Frontend (marketing site — production-ready now)
cd frontend && npm install && npm run dev      # http://localhost:5173
npm run build                                  # static output in dist/

# Backend (needs Postgres + ffmpeg; migrations run on boot)
createdb clipper   # or: docker run -e POSTGRES_USER=clipper -e POSTGRES_PASSWORD=clipper -e POSTGRES_DB=clipper -p 5432:5432 postgres:16
cd backend && npm install && cp .env.example .env && npm run dev   # :8080
curl localhost:8080/api/health   # {"ok":true,"db":"up"}
npm run smoke                    # B2: intake/clients/leads end-to-end
npm run smoke:pipeline           # B3–B6: synthetic podcast → sign-off → published → measured
npm run smoke:review             # B4: the review status machine, roles, audit trail
npm run smoke:publish            # B5: connections, scheduler lifecycle, sign-off guarantee
npm run smoke:metrics            # B6: capture rotation, report aggregation, the retrain loop
```

The ops dashboard lives at `/ops` (dev gate key: `clipper-ops`, override with
`VITE_OPS_KEY` — a B7 placeholder; gate `/ops` at the proxy in deployments).
With both servers up, `cd frontend && npm run integration:f4` clicks through a
real review in the built UI and verifies the transitions in Postgres.

The Vite dev server proxies `/api` to `localhost:8080`.

## Build roadmap

The full staged plan (F1–F5 frontend, B1–B7 backend, with dependencies and
done-criteria) lives in [`docs/BUILD_STAGES.md`](docs/BUILD_STAGES.md).
Current status: **F1–F4 ✅ · B1–B6 ✅** — site is modular/routed, the pipeline is live (intake → ingest → transcribe → analyze → score → generate → rendered 9:16 clips), the B4 review machine enforces client sign-off (auto-publish is an explicit opt-out), B5 publishing ships signed-off clips through platform adapters (offline-real `local` driver by default, real YouTube adapter behind `PUBLISH_DRIVER=live`; credentials encrypted at rest), and B6 closes the loop: published posts get measured into `clip_metrics`, the client report generates itself, and score↔performance correlation retrains the scoring weights (bounded, gated, append-only — `score.js` records which weights it used). The `/ops` dashboard operates all of it end to end. Next: B7 auth, F5 client portal.

## Deploy

- `frontend/dist` → any static host (Vercel, Netlify, Cloudflare Pages).
- `backend` → any Node host + managed Postgres; apply `backend/src/db/schema.sql`.
- CI builds both on every push (`.github/workflows/ci.yml`).

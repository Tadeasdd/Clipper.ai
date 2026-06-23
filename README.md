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

### One command (Docker)

```bash
docker compose up --build        # db + backend (+ workers) + frontend
# frontend → http://localhost:5173   backend → http://localhost:8080
docker compose --profile seed run --rm seed    # demo: real captioned clips
docker compose --profile test run --rm smoke   # the offline smoke suite
```

No local Postgres/ffmpeg/whisper needed — see `docs/DEV_STACK.md`. The rest of
this section is the native (non-Docker) path.

### Native

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
npm run smoke:auth               # B7: sessions, role walls, client fencing, attribution
```

The ops dashboard lives at `/ops` behind real sessions (B7): the first visit
to a fresh database offers to create the founding ops account; every later
account is created from inside by an ops user. The API has one door —
`POST /api/auth/login` returns a bearer token and sets an httpOnly cookie
(media elements authenticate with the cookie; API clients use the bearer).
With both servers up, `cd frontend && npm run integration:f4` signs in,
clicks through a real review in the built UI, and verifies the transitions —
and their attribution — in Postgres. `npm run integration:f5` does the same
for the client portal at `/portal`: two clients seeded, the fence verified
(the neighbor's data never renders), a sign-off and an upload driven through
the built UI and checked in the database.

The Vite dev server proxies `/api` to `localhost:8080`.

## Build roadmap

The full staged plan (F1–F5 frontend, B1–B7 backend, with dependencies and
done-criteria) lives in [`docs/BUILD_STAGES.md`](docs/BUILD_STAGES.md).
Current status: **F1–F5 ✅ · B1–B7 ✅** — the full staged plan is built. The site is modular/routed, the pipeline is live (intake → ingest → transcribe → analyze → score → generate → rendered 9:16 clips), the B4 review machine enforces client sign-off (auto-publish is an explicit opt-out), B5 publishing ships signed-off clips through platform adapters (offline-real `local` driver by default, real YouTube adapter behind `PUBLISH_DRIVER=live`; credentials encrypted at rest), and B6 closes the loop: published posts get measured into `clip_metrics`, the client report generates itself, and score↔performance correlation retrains the scoring weights (bounded, gated, append-only — `score.js` records which weights it used). B7 put it all behind one door: server-side sessions, role walls on every endpoint, client users fenced to their own data, and every approval and publish attributable to the session that made it. The `/ops` dashboard operates all of it; the `/portal` client dashboard (F5) gives clients their four surfaces — submit, deliverables, sign-off, report — fenced to their own data on both sides of the wire.

## Deploy

- `frontend/dist` → any static host (Vercel, Netlify, Cloudflare Pages).
- `backend` → any Node host + managed Postgres; apply `backend/src/db/schema.sql`.
- CI builds both on every push (`.github/workflows/ci.yml`).

## Contributing

Run `npm install` once at the repo root to activate the local pre-commit hooks
(format + secret-scan + lint/typecheck) and the commit-message gate. Commit
conventions, the hook chain, and how releases are cut are documented in
[`docs/COMMITS_AND_RELEASES.md`](docs/COMMITS_AND_RELEASES.md).

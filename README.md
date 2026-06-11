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

# Backend (Stage B1 skeleton)
cd backend && npm install && cp .env.example .env && npm run dev   # :8080
curl localhost:8080/api/health
```

The Vite dev server proxies `/api` to `localhost:8080`.

## Build roadmap

The full staged plan (F1–F5 frontend, B1–B7 backend, with dependencies and
done-criteria) lives in [`docs/BUILD_STAGES.md`](docs/BUILD_STAGES.md).
Current status: **F1 ✅ · F2 ✅ (modular + routed + code-split) · B1 ✅**.

## Deploy

- `frontend/dist` → any static host (Vercel, Netlify, Cloudflare Pages).
- `backend` → any Node host + managed Postgres; apply `backend/src/db/schema.sql`.
- CI builds both on every push (`.github/workflows/ci.yml`).

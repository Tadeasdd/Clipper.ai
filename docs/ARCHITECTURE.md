# Architecture

## Principle

Clipper.ai is a managed content growth service. The software is internal
machinery. Architecture priority, in order:

1. Operations dashboard (ops, editors, reviewers, account managers)
2. Pipeline workers (the AI operating system)
3. Client dashboard (limited visibility: upload, deliverables, approve, reports)
4. Marketing site (positioning: never "SaaS", "tool", or "platform")

## System diagram

```
                       ┌──────────────────────────────────────────┐
                       │              frontend/ (Vite)            │
                       │  marketing site │ /ops dashboard │ /app  │
                       └───────────────┬──────────────────────────┘
                                       │ /api (REST)
                       ┌───────────────▼──────────────────────────┐
                       │            backend/ (Express)            │
                       │ intake · jobs · clips · review · publish │
                       │        analytics · clients               │
                       └───────┬───────────────────────┬──────────┘
                               │ enqueue               │ SQL
                  ┌────────────▼───────────┐   ┌───────▼────────┐
                  │  pipeline workers      │   │   Postgres     │
                  │  ingest → transcribe → │   │  (schema.sql)  │
                  │  analyze → score →     │   └────────────────┘
                  │  generate              │
                  └──────┬─────────┬───────┘
                         │         │
                 ┌───────▼──┐  ┌───▼─────────────────┐
                 │ S3 media │  │ AI providers         │
                 │ storage  │  │ (ASR, LLM, vision)   │
                 └──────────┘  └─────────────────────┘
                         │
                  ┌──────▼──────────────────────────┐
                  │ platform adapters (publish)     │
                  │ YT Shorts · TikTok · IG · LI · X│──► metrics pollers ─► clip_metrics
                  └─────────────────────────────────┘            │
                                                                 ▼
                                              feedback into the scoring model
```

## Key decisions

- **Single API, role-gated** — ops and client dashboards share endpoints;
  the client role just sees a narrow, own-data-only slice. Avoids two backends.
- **Workers off the request path** — every AI/media operation is a queue job
  with per-stage status, so the ops board can always answer "where is this
  recording right now?"
- **Provider-agnostic AI seams** — transcription/LLM providers sit behind the
  pipeline modules, swappable via env config.
- **The feedback loop is first-class** — `clip_metrics → score` retraining is
  a stage (B6), not an afterthought. It is the compounding asset.
- **Status machine in the schema** — clip lifecycle is a CHECK constraint, so
  "nothing publishes without sign-off" is enforced by the database, not just UI.

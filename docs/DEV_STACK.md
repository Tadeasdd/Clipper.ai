# One-command local stack (D1)

Bring the whole system — Postgres, the backend API, the in-process pipeline /
publish / metrics workers, and the frontend — up on a clean machine with one
command. The only prerequisite is Docker (or a compatible engine such as
[Colima](https://github.com/abiosoft/colima)) with the `compose` plugin; you do
**not** need a local Postgres, ffmpeg, or whisper install.

## Run it

```bash
docker compose up --build
```

- Frontend (marketing site, `/ops` dashboard, `/portal`): http://localhost:5173
- Backend API + health: http://localhost:8080/api/health

The backend runs migrations on boot and starts the workers in-process. Defaults
are fully offline: **builtin** ASR + **builtin** LLM + **local** storage +
**local** publish/metrics drivers — zero external keys, zero network at runtime.

## See real output (seed)

```bash
docker compose --profile seed run --rm seed     # or: make demo
```

Creates a demo client and runs a synthetic podcast through the real pipeline
(ingest → analyze → score → generate) to scored, captioned, 9:16 clips — the
content-rich segment beats the louder-but-vacuous one, with explainable signals.

## Run the smoke suite (acceptance)

```bash
docker compose --profile test run --rm smoke    # or: make verify
```

Runs the offline suite — `smoke`, `smoke:pipeline`, `smoke:review`,
`smoke:publish`, `smoke:metrics`, `smoke:auth`, `smoke:ingest`,
`smoke:transcribe`, `smoke:prod` — against the running backend. Live-key /
live-network assertions gate themselves off, so this is green with zero secrets.
`smoke:transcribe` prints a loud SKIP unless whisper is enabled (below) — it
never fakes a transcript.

## Make targets

| Command       | What it does                                        |
| ------------- | --------------------------------------------------- |
| `make up`     | Full app (db + backend + frontend), foreground      |
| `make demo`   | Start the stack detached, then seed captioned clips |
| `make verify` | Backend up, then run the offline smoke suite        |
| `make down`   | Tear down, including the database volume            |

## Going live (optional)

The provider seams are env-switched; set them in the `backend` service
environment (see `backend/.env.example` for the full list):

- ASR: `TRANSCRIPTION_PROVIDER=deepgram` + `TRANSCRIPTION_API_KEY`
- LLM: `LLM_PROVIDER=anthropic` + `LLM_API_KEY`
- Publish/metrics: `PUBLISH_DRIVER=live` / `METRICS_DRIVER=live` (see
  `docs/RUNBOOK_YOUTUBE.md`)
- Storage: `STORAGE_DRIVER=s3` + the `S3_*` vars

### Offline whisper ASR (opt-in)

whisper.cpp is a real but opt-in build (it adds a ~75 MB model download and a
compile step, kept off the default path so the image stays lean and the default
stack needs no network at runtime):

```bash
INSTALL_WHISPER=true docker compose build backend
TRANSCRIPTION_PROVIDER=whisper docker compose up
```

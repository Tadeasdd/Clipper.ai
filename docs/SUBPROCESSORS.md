# Sub-processors & data processing (C5)

The register of third parties that may process client data on Clipper.ai's behalf,
plus a Data Processing Agreement (DPA) summary. This is the disclosure a brand or
agency expects before handing over unreleased content.

> **Offline by default.** Every provider seam (ASR, LLM, vision, storage, publish,
> metrics, notify, billing) ships a `builtin`/`local`/dry-run default that runs
> with **zero external keys and zero network**. Until a deployment explicitly
> configures a provider, **no client data leaves the system** and the register
> below is empty in practice. Each entry is "engaged only when configured."

## Sub-processor register

| Sub-processor | Purpose | Data shared | Engaged when | Offline default |
|---|---|---|---|---|
| ASR provider (e.g. cloud speech-to-text) | Transcription | Audio derived from client media | `TRANSCRIPTION_PROVIDER` set to a cloud driver | `whisper`/local — none leaves the box |
| LLM provider | Moment selection, captions, hooks | Transcript text | `LLM_API_KEY` / cloud LLM configured | `builtin` heuristics — none leaves the box |
| Vision provider | Visual signals | Frame samples | configured | local — none leaves the box |
| Object storage (e.g. S3) | Media at rest | Encrypted client media | `STORAGE_DRIVER=s3` | local disk; encrypted either way (C1) |
| Publish platforms (YouTube, TikTok, Instagram, LinkedIn, X) | Publishing approved clips | Final clip + caption, OAuth tokens | a platform connection is added | dry-run publish driver |
| Metrics platforms (same set) | Performance metrics | Published-clip identifiers | a connection exists | `local` metrics driver |
| Notification channels (email/Slack) | Lifecycle comms | Recipient address, event metadata | `NOTIFY_DRIVER` set | `log` driver — nothing sent |
| Billing (Stripe) | Metered outcomes billing | Usage counts, client id | `BILLING_DRIVER=live` | dry-run — no records sent |
| Hosting / CI (GitHub Actions) | Build, test, artifact signing | Source code, SBOM, attestations | always (development) | n/a (no client content) |

## DPA summary

**Roles.** The client is the data controller; Clipper.ai is the processor;
the parties above are sub-processors engaged only when configured.

**Categories of data.** Client-supplied long-form media and its derivatives
(transcripts, clips, captions, scores); account data (operator/client emails,
roles); platform OAuth credentials; usage/metrics telemetry. No special-category
data is solicited.

**Purposes of processing.** Solely to deliver the managed content service:
transcribe → analyze → score → caption → review → publish → measure. No secondary
use; client content is not used to train shared models (the scoring feedback loop
is per the service's own weights, not a third party's).

**Security measures.** Encryption in transit (HTTPS/HSTS) and at rest
(AES-256-GCM for media + credentials, rotatable keys — C1/C3); access control,
MFA, and tenant isolation (B7/C2/S4); audit logging (S6/O5); see
`THREAT_MODEL.md` and `SOC2_READINESS.md` for the full control set.

**Retention & disposal.** Per `DATA_LIFECYCLE.md`: configurable retention windows
with automatic purge, and verifiable per-client erasure across the database and
object storage on request (C1).

**Data-subject / controller rights.** Access, export, and erasure are supported
operationally; erasure is auditable (`smoke:lifecycle`).

**International transfers.** Determined by where the client configures storage and
providers; with the offline defaults, data stays within the deployment.

**Sub-processor changes.** This register is the source of truth; material changes
should be communicated to clients before a new sub-processor is enabled. A signed
DPA with each enabled sub-processor is tracked as a gap in `SOC2_READINESS.md`.

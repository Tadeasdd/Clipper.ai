# Supply-chain security (C4)

How Clipper.ai keeps its dependency surface auditable, attestable, and current.
All of this lives in CI (`.github/workflows/ci.yml`) and `.github/dependabot.yml`
— there is no runtime component and nothing here needs external keys.

## SBOM — software bill of materials

The `sbom` CI job emits a CycloneDX 1.6 SBOM (JSON) for **both** npm packages on
every run (push and PR):

- `sbom/backend.cdx.json`
- `sbom/frontend.cdx.json`

They are generated with `@cyclonedx/cyclonedx-npm` against the **installed**
dependency tree (`npm ci` first), then uploaded as the `sbom` build artifact
(90-day retention). The installed tree is used rather than a lockfile-only scan
because the lockfile lists optional platform packages (e.g.
`@tailwindcss/oxide-wasm32-wasi`) whose transitive deps it doesn't fully pin; the
platform-filtered installed tree resolves cleanly.

Generate them locally the same way:

```bash
cd backend  && npx @cyclonedx/cyclonedx-npm@5.0.0 --output-format JSON --output-file ../sbom/backend.cdx.json
cd frontend && npx @cyclonedx/cyclonedx-npm@5.0.0 --output-format JSON --output-file ../sbom/frontend.cdx.json
```

## Signed build provenance + SBOM attestation

On **push** (where the runner can mint an OIDC token), the `sbom` job:

1. builds the frontend bundle (`frontend/dist`) — the shipped artifact;
2. signs a **SLSA build-provenance** attestation over it with
   `actions/attest-build-provenance` (keyless via Sigstore — no secrets);
3. attaches a **signed SBOM attestation** with `actions/attest-sbom`.

The attest steps are gated to `github.event_name == 'push'` so fork PRs (which
cannot mint an OIDC token) never fail the gate. The job requests only
`id-token: write` + `attestations: write` on top of read.

Verify a downloaded artifact against its attestation:

```bash
gh attestation verify <path-to-dist-file> --repo Tadeasdd/Clipper.ai
```

## Pinned + locked dependencies

- **Lockfiles are authoritative.** Every CI job installs with `npm ci`, which
  fails if `package.json` and `package-lock.json` disagree — drift can't slip in.
- **Exact versions on install.** `backend/.npmrc` and `frontend/.npmrc` set
  `save-exact=true`, so a new `npm install <pkg>` writes a pinned version, not a
  caret range.

## Automated dependency updates

`.github/dependabot.yml` opens weekly update PRs for three ecosystems:

| Ecosystem | Path | Grouping |
| --- | --- | --- |
| npm | `/backend` | minor+patch grouped into one PR; majors individual |
| npm | `/frontend` | minor+patch grouped into one PR; majors individual |
| github-actions | `/` | all action bumps grouped |

Each Dependabot PR fires the `pull_request` trigger, so the **entire CI gate**
(frontend, backend smokes, e2e/visual lock, gitleaks, CodeQL, dependency-review,
SBOM) runs against it before it can merge. Pair this with the existing
`dependency-review` job, which blocks any PR introducing a high-severity
dependency.

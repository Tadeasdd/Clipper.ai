# Clipper.ai — Excellence Plan: Security, API Protection & UI Quality

The companion to `docs/MVP_BACKEND_PLAN.md`. That plan makes the product
*work*; this one makes it *excellent and safe to operate*. Two tracks:

- **Track S — Security & API protection** (S0–S6)
- **Track U — UI quality / "less vibe-coded"** (U1–U5)

Same execution rules as the MVP plan: **one item per branch**, plan before you
write, keep every driver working offline, finish on green smokes, one reviewable
commit per item.

> This plan supersedes and expands the thin "M7 hardening" bullet in the MVP
> plan. Do the S-track here instead of M7.

---

## Non-negotiable preservation contract (Track U)

Every UI item is an **output-preserving refactor**. The rendered result — every
SVG, the black/neon-green/stone color scheme, every layout and spacing — must be
**visually identical** before and after. The work is structural, not cosmetic.

Enforced on every U-item by:
1. `cd frontend && npm run build` succeeds before and after.
2. `npm run smoke && npm run integration:f4 && npm run integration:f5` stay green.
3. A manual `npm run dev` eyeball of the touched routes.
4. For the color-token work specifically: a grep proving the resolved hex
   values are unchanged (same `#53fc18`, same gradient stops, same black).

If a change would alter a single pixel of intended design, it is out of scope.

---

## Track S — Security & API protection

### S0 — Restore CI + add security scanning (do this first)

**Why:** The GitHub workflows were deleted (commit `08774d6`). Right now nothing
runs the smokes, and there is no dependency or secret scanning. Every later item
in both plans is only "green" by hand. Security work without CI enforcement
rots immediately.

**Goal:** push triggers the full smoke suite (backend + frontend) plus automated
security scans, on a real Postgres + ffmpeg + whisper runner.

**Files:** `.github/workflows/ci.yml` (restore + extend), `package.json`
scripts, `frontend/package.json`.

**Approach:**
- Restore the backend CI job (Postgres service container, ffmpeg, run all
  `smoke:*`). Add the whisper binary + tiny model install so `smoke:transcribe`
  (MVP M1) runs for real.
- Add the frontend job: `npm run build`, `smoke`, `integration:f4/f5`.
- Add **`npm audit --audit-level=high`** (fail on high/critical) for both
  packages.
- Add **secret scanning** (gitleaks action) and **dependency review** on PRs.
- Add **CodeQL** (JavaScript) for static analysis.

**Acceptance:** a PR runs all jobs; a planted dummy secret fails gitleaks; a
known-vuln dependency fails the audit gate.

**Commit:** `S0: restore CI + dependency/secret/static security scanning`

---

### S1 — SSRF lockdown on content ingest

**Why:** `pipeline/ingest.js` fetches a **user-supplied `source_url`**
server-side, and MVP M4 adds `yt-dlp` on user URLs too. Unrestricted, this is a
textbook SSRF: a client could point it at `http://169.254.169.254/…` (cloud
metadata), internal services, or `file://`. This is the single highest-severity
backend risk.

**Goal:** the fetcher can only reach public, allowed content hosts; never the
internal network, link-local, or non-HTTP schemes.

**Files:** `pipeline/ingest.js`, new `src/lib/safe-fetch.js`, `.env.example`.

**Approach:**
- Build a `safeFetch(url)` that: allows only `https:` (and `http:` only if
  explicitly enabled); resolves the hostname and **rejects private, loopback,
  link-local, and reserved IP ranges** (10/8, 172.16/12, 192.168/16, 127/8,
  169.254/16, ::1, fc00::/7, etc.); re-checks the IP **after redirects** (guard
  DNS-rebinding by pinning the resolved IP for the connection); caps response
  size and time.
- For `yt-dlp`, pass `--no-exec`, restrict to an allowlist of known platforms
  (YouTube/Vimeo/etc.), disable arbitrary local-file extractors.
- Optional `INGEST_HOST_ALLOWLIST` for locked-down deployments.

**Acceptance:** unit tests assert fetch is refused for `169.254.169.254`,
`localhost`, `10.x`, `file://`, and a redirect that lands on a private IP;
allowed for a normal public URL.

**Commit:** `S1: SSRF-safe ingest fetch (private-range + scheme + rebinding guards)`

---

### S2 — Move auth off localStorage to httpOnly cookie + CSRF

**Why:** `ops/api.js` stores the session token in `localStorage`
(`clipper_session`) and sends it as a Bearer header. Any XSS can read
localStorage and exfiltrate the session. An httpOnly cookie **already exists**
(set at login, used for `<video>` asset auth) — so the Bearer copy is redundant
risk.

**Goal:** the browser never holds the raw token in JS-readable storage; all
authenticated requests ride the httpOnly cookie; state-changing requests carry
CSRF protection.

**Files:** `backend/src/lib/auth.js`, `backend/src/routes/auth.js`,
`backend/src/server.js` (CSRF middleware), `frontend/src/ops/api.js`,
`frontend/src/portal/api.js`.

**Approach:**
- Cookie: `httpOnly`, `Secure` (prod), `SameSite=Lax` (or `Strict` for the API
  if the portal is same-origin). Keep storing only `sha256(token)` server-side
  (already done).
- CSRF: double-submit token or the `SameSite` + custom-header pattern (require a
  non-forgeable header like `X-Requested-With` / a per-session CSRF token on all
  non-GET routes). Validate in middleware.
- Frontend: drop `localStorage` token read/write; rely on `credentials:
  'include'` so the cookie rides automatically. `setSession` keeps only the
  in-memory user object.
- Logout already revokes server-side — keep that.

**Acceptance:** after login, `localStorage` holds no token; API calls succeed via
cookie; a cross-site POST without the CSRF token is rejected; the asset
`<video>` flow still works.

**Commit:** `S2: cookie-based sessions + CSRF, remove localStorage token`

---

### S3 — Request validation + rate limiting on every route

**Why:** Validation is hand-rolled and inconsistent; rate limiting exists only on
login (`lib/auth.js`). The **public lead endpoint** (`/api/leads`) and the
**login/bootstrap** endpoints are open abuse doors; list endpoints take arbitrary
params.

**Goal:** every write route validates its body against a schema; every route has
a sensible rate limit; list endpoints are paginated with hard caps.

**Files:** all `backend/src/routes/*.js`, new `src/lib/validate.js`,
`src/lib/ratelimit.js` (generalize the login limiter), `server.js`.

**Approach:**
- Add `zod` (or keep zero-dep with a tiny validator) and a `validate(schema)`
  middleware; define a schema per write route. Reject unknown fields.
- Generalize the in-memory limiter into reusable buckets: strict on
  `/api/leads`, `/api/auth/*`; standard on authenticated writes. (Document that
  multi-instance deployments need a shared store — Redis — later.)
- Pagination: clamp `limit`/`offset` on `clips`, `users`, queues; default + max
  page size; reject absurd values.
- Confirm **every non-public route is behind `requireAuth(...roles)`** — audit
  the full route table and write a test that hits each unauthenticated and
  asserts 401/403.

**Acceptance:** malformed bodies → 400 with a clear error; over-limit requests →
429; `GET /api/clips?limit=100000` is clamped; the route-coverage auth test
passes.

**Commit:** `S3: schema validation, per-route rate limits, pagination caps, authz audit`

---

### S4 — IDOR / tenant-isolation audit on every read and asset

**Why:** Reads are client-fenced in most routes, but the **clip asset endpoint**
(`/api/clips/:id/asset`) and any id-addressed resource must be proven to enforce
the caller's client scope — otherwise an ops user or client could fetch another
tenant's media by guessing ids.

**Goal:** no resource is reachable across client boundaries; the asset stream is
authz'd, not just authenticated.

**Files:** `backend/src/routes/clips.js`, `routes/review.js`, `routes/intake.js`,
any `:id` route; a new `smoke:authz` script.

**Approach:**
- For every `:id` lookup, the query must include the caller's client scope (or
  ops/admin override), so a wrong-tenant id returns 404 (not 403 — don't leak
  existence).
- Asset route: verify the clip belongs to the caller's client before streaming;
  consider signed, expiring asset URLs so a leaked URL can't be replayed
  forever.
- Write `smoke:authz`: create two clients, assert client A cannot read B's
  recordings, clips, asset, or review history.

**Acceptance:** `smoke:authz` proves cross-tenant reads 404; asset of another
client is refused.

**Commit:** `S4: cross-tenant IDOR audit + authorized asset streaming`

---

### S5 — HTTP hardening: headers, CORS, CSP, body limits

**Why:** Docs flag CORS wide open and no security headers. With cookie auth (S2),
CORS and CSP correctness become load-bearing.

**Goal:** a locked-down HTTP surface that still serves the inline-SVG UI.

**Files:** `backend/src/server.js`, `.env.example`, frontend build (CSP meta or
served headers).

**Approach:**
- Add `helmet` (or equivalent headers): HSTS (prod), `X-Content-Type-Options`,
  `X-Frame-Options: DENY`, `Referrer-Policy`.
- **CORS:** allowlist via `CORS_ORIGINS`; with cookies, `credentials: true` and
  an explicit origin (never `*`).
- **CSP:** craft a policy that permits the app's **inline React SVGs and inline
  style props** (these are DOM/CSSOM, not HTML-parsed `<style>` — verify in a
  browser) — likely `default-src 'self'`, `img-src 'self' data:`,
  `media-src 'self'`, `style-src 'self' 'unsafe-inline'` (or nonces), no
  `unsafe-eval`. Test the landing visuals + ops board render clean under it.
- Confirm the JSON body cap (2 mb) and add a separate cap + content-type guard on
  the upload PUT path (overlaps MVP M4 — coordinate).

**Acceptance:** CORS rejects an unlisted origin; security headers present;
the full site + ops dashboard render with **zero CSP violations** in the console.

**Commit:** `S5: helmet headers, strict CORS, CSP tuned for inline-SVG UI`

---

### S6 — Secrets, audit logging & observability

**Why:** No structured logs, no security event trail beyond review history, and
secrets handling should fail fast.

**Goal:** security-relevant events are logged; secrets can't be misconfigured
silently; errors are observable without leaking internals.

**Files:** `backend/src/server.js`, `src/lib/log.js` (new), `routes/auth.js`,
central error handler, `.env.example`.

**Approach:**
- Structured JSON logger; **redact** tokens, passwords, credentials, cookies.
- Log security events: login success/failure, bootstrap, logout, rate-limit
  trips, authz denials, retrains.
- Boot-time config guard: in `NODE_ENV=production`, fail fast if
  `PUBLISH_TOKEN_KEY`, `DATABASE_URL`, or session secret look unset/weak.
- Central error handler returns a generic message + correlation id to clients,
  full detail to logs only. Wire an error reporter hook (Sentry-style).

**Acceptance:** a "prod config" smoke boots with strict env, fails on a missing
key, and a forced error returns a generic body while the log carries the detail
(with secrets redacted).

**Commit:** `S6: structured redacted logging, security audit trail, fail-fast config`

---

## Track U — UI quality ("less vibe-coded"), look preserved

### U1 — Single source of truth for the color system

**Why:** `#53fc18` is hardcoded **502 times across 15 files**; the gradient stops
(`#2fcf0c`, `#a6ff63`), the black, and the stone surfaces are scattered too.
That's the defining "vibe-coded" trait and the root of future drift.

**Goal:** one token set; the **exact same colors** resolve everywhere.

**Files:** `frontend/src/index.css` / `styles/global.css` (Tailwind v4
`@theme`), then every file in the grep list.

**Approach:**
- Define Tailwind v4 `@theme` tokens / CSS custom properties:
  `--color-brand: #53fc18`, `--color-brand-bright: #a6ff63`,
  `--color-brand-deep: #2fcf0c`, surface scale mapped to the existing stones,
  `--color-ink: #000`.
- Replace literal hexes with the token (`text-brand`, `bg-brand`,
  `var(--color-brand)` in inline styles/SVG `fill`). **Do not change any value.**
- SVGs: keep geometry byte-for-byte; swap only the color literal for the token
  where practical (some SVG attributes may stay literal if tokenizing risks the
  render — preserve-first).

**Acceptance:** `grep -rn '#53fc18' src` drops to ~0 (outside the token
definition); build + all frontend tests green; manual eyeball shows identical
color; a screenshot of the landing hero is pixel-equivalent.

**Commit:** `U1: tokenize brand color system (no visual change)`

---

### U2 — Break up the monolith components

**Why:** `landing-visuals.jsx` is **2,382 lines**, `site-chrome.jsx` 1,156,
`App.jsx` 395. Single giant files are hard to review, test, and reason about —
classic vibe-coded structure.

**Goal:** focused modules with **identical rendered output**.

**Files:** split `components/landing-visuals.jsx` →
`components/visuals/<Name>.jsx` (one exported visual per file, re-exported from
an index); `site-chrome.jsx` → header/footer/nav/section modules; `App.jsx` →
router + route groups.

**Approach:** pure mechanical extraction — move each component to its own file,
keep names and props, fix imports. **No JSX content changes.** Re-export from a
barrel so call sites don't change. Do it in small, verifiable slices (one
visual/section per commit if needed).

**Acceptance:** build + tests green after each slice; the rendered DOM is
unchanged (snapshot or manual diff); no file over ~400 lines except where a
single SVG legitimately is.

**Commit:** `U2.x: extract <area> into focused modules (no behavior change)`

---

### U3 — Consolidate repeated patterns into the shared primitives

**Why:** The same `border border-stone-800 bg-stone-950/...` card/button/badge/
input class strings are repeated across pages, drifting subtly. `ui.jsx` already
holds primitives but they're under-used.

**Goal:** one `Card`, `Button`, `Badge`, `Input`, `Stat` etc.; pages compose
them; the look is unchanged.

**Files:** `components/ui.jsx` (extend), then page/ops files that inline the
patterns.

**Approach:** lift the most-repeated class combos into primitives whose default
classes equal today's strings, then replace inline usages. Where a usage differs
slightly, pass props/variants rather than forking. Preserve exact classes.

**Acceptance:** visual parity; fewer duplicated class strings (measure with a
grep before/after); tests green.

**Commit:** `U3: consolidate card/button/badge/input into shared primitives`

---

### U4 — Consistent loading / empty / error states + error boundaries

**Why:** `usePoll` exposes `{data, error, loading}` and the ops layer is built to
render honest error states — but coverage is uneven, and a thrown render error
takes down the route (no boundaries). Also, `FeedbackWidget` **fakes** submit
with `setTimeout` — a placeholder masquerading as real.

**Goal:** every data view renders all three states the same way; routes are
wrapped in error boundaries; no fake interactions.

**Files:** `ops/*.jsx`, `portal/PortalApp.jsx`, `components/ui.jsx` (shared
`Loading`/`Empty`/`ErrorState`), new `components/error-boundary.jsx`,
`components/ui.jsx` FeedbackWidget.

**Approach:** add shared state components; ensure each view uses them; add a
route-level `ErrorBoundary`. Wire FeedbackWidget to a real endpoint or label it
honestly as not-yet-wired (no silent fake — consistent with the backend's
"never fabricate" rule).

**Acceptance:** kill the backend → ops board shows the error state, doesn't blow
up; a thrown error shows the boundary, not a white screen; feedback either
persists or is honestly labeled.

**Commit:** `U4: uniform loading/empty/error states + boundaries, de-fake feedback`

---

### U5 — Lint, typecheck, and component tests

**Why:** There's an `eslint-disable react-hooks/exhaustive-deps` in `ops/api.js`
(a real bug-risk smell) and no linter/typecheck enforcing quality. Tests are
smoke/integration only.

**Goal:** automated quality gates that catch regressions without touching design.

**Files:** `frontend/.eslintrc` / flat config, `jsconfig.json` (`checkJs`) or
incremental TS, `package.json` scripts, CI (S0).

**Approach:**
- ESLint with `react`, `react-hooks`, `jsx-a11y`; fix the exhaustive-deps
  disable properly. Add `lint` + `typecheck` scripts; wire into CI.
- Add a few component render tests with the existing `happy-dom` for the
  stateful pieces (ReviewDesk decision flow, usePoll states).
- Run a **a11y audit** (`jsx-a11y` + a manual axe pass): fix labels, focus
  traps in any modal, and check stone-on-black text contrast meets WCAG AA —
  adjusting only the few failing shades, documented, with sign-off (this is the
  one place a tiny color tweak may be justified — flag it, don't sneak it).

**Acceptance:** `lint` + `typecheck` pass in CI; component tests green; the a11y
report has no critical violations.

**Commit:** `U5: eslint + typecheck + component tests + a11y audit`

---

## Suggested sequence

```
S0  (CI + scanning)            ← first, everything depends on enforcement
S1  (SSRF)  ─┐
S2  (cookie/CSRF)  ├─ highest-severity backend; do early
S3  (validation/limits) ─┘
S4  (IDOR) → S5 (headers/CORS/CSP) → S6 (logging/secrets)

U1  (color tokens)  ← do before U2/U3; biggest leverage, lowest risk
U2  (split monoliths) → U3 (primitives) → U4 (states) → U5 (lint/tests/a11y)
```

Tracks S and U are independent — you can interleave (e.g. a security item, then
a UI item) to keep variety, as long as **S0 lands first** and **U1 lands before
the other U items**. Relative to the MVP plan: do **MVP M1–M3** (the product)
first if it isn't done, then **S0–S3** before exposing anything publicly, then
fold the rest in alongside MVP M4–M8.

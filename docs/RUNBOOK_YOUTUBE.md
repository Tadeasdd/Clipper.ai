# Runbook — the one real YouTube publish + metrics path (M6)

This is the operator's guide to taking an approved clip all the way to a live
YouTube Short and pulling its real view metrics back into the feedback loop. The
defaults are offline (`PUBLISH_DRIVER=local`, `METRICS_DRIVER=local`); everything
here is opt-in and changes nothing about CI or offline dev.

The moat only becomes real here: under the local metrics driver performance is
generated independently of `clips.score` by design, so correlations hover near
zero. A real channel with real views is the first time `retrain` moves the
weights on evidence rather than scaffolding.

---

## 1. One-time Google Cloud setup

1. **Create / pick a project** at <https://console.cloud.google.com>.
2. **Enable the YouTube Data API v3** (APIs & Services → Library → "YouTube Data
   API v3" → Enable).
3. **OAuth consent screen** (APIs & Services → OAuth consent screen):
   - User type: External (or Internal for a Workspace org).
   - Add the scopes:
     - `https://www.googleapis.com/auth/youtube.upload` — publish
     - `https://www.googleapis.com/auth/youtube.readonly` — metrics
   - While the app is in "Testing", add the channel's Google account under
     **Test users** (otherwise consent is blocked).
4. **Create an OAuth client ID** (APIs & Services → Credentials → Create
   credentials → OAuth client ID):
   - Application type: **Web application**.
   - **Authorized redirect URI** — must match `OAUTH_REDIRECT_BASE` exactly:
     `https://YOUR_HOST/api/publish/connections/youtube/oauth/callback`
     (for local testing: `http://localhost:8080/api/publish/connections/youtube/oauth/callback`).
   - Copy the **Client ID** and **Client secret**.

> Quota note: a `videos.insert` costs ~1600 units of the default 10,000/day
> quota — i.e. a handful of uploads per day on an unaudited project. Request a
> quota increase before running this for a real client cadence.

---

## 2. Configure the backend

In `backend/.env` (never commit real secrets):

```
PUBLISH_DRIVER=live
METRICS_DRIVER=live
YOUTUBE_CLIENT_ID=<from the console>
YOUTUBE_CLIENT_SECRET=<from the console>
OAUTH_REDIRECT_BASE=https://YOUR_HOST      # or http://localhost:8080 for local
PUBLISH_TOKEN_KEY=<a strong secret>        # encrypts stored refresh tokens
```

Restart the API so the new env takes effect.

---

## 3. Connect a channel (mint the refresh token)

The connect flow stores `{ clientId, clientSecret, refreshToken }` encrypted in
`platform_connections` — exactly what the live adapter and metrics poller read.

1. As an ops/account-manager user, start the flow for the client:

   ```
   GET /api/publish/connections/youtube/oauth/start?clientId=<CLIENT_ID>
   → { authUrl, state, redirectUri }
   ```

2. Open `authUrl` in a browser, sign in **as the target channel**, and grant
   the upload + readonly scopes. Google redirects to the callback, which
   exchanges the code and stores the connection:

   ```
   GET /api/publish/connections/youtube/oauth/callback?code=…&state=…
   → { connected: true, platform: "youtube", connection: {…} }
   ```

   The API never returns the credentials; `GET /api/publish/connections` shows
   the connection without them.

Re-running the flow re-consents and replaces the stored token (an OAuth
re-auth). If the callback returns *"no refresh_token returned"*, revoke the
app's prior access at <https://myaccount.google.com/permissions> and retry —
Google only returns a refresh token on the first grant per user+client.

---

## 4. Publish an approved clip → a real Short

1. Take a clip through the normal machine to `approved` (sign-off enforced).
2. Schedule it: `POST /api/publish { clipId, platform: "youtube" }`.
3. The scheduler claims it and the live adapter does a **resumable upload**
   (`videos.insert`), returning the video id; the job moves to `published` with
   `external_url = https://www.youtube.com/shorts/<id>`.
4. Confirm it resolves as a **Short**: open the shorts URL — a vertical ≤3 min
   upload is classified automatically; the `#Shorts` title tag nudges it.

If the upload fails it parks with the real error on the ops queue after 3
attempts (`dead_letter`), retryable via `POST /api/publish/:id/retry`.

---

## 5. Capture real metrics → first real retrain

1. The metrics poller picks the published post up immediately (its
   `metrics_next_at` is set on publish) and calls `videos.list?part=statistics`,
   writing a `clip_metrics` row: real `views`/`likes`/`comments`.
   `watch_time_s`/`retention`/`shares` stay **null** — the Data API does not
   expose them (that is the separate Analytics API), and we never guess.
2. Let at least a handful of posts accumulate captures (the retrain gate is
   `RETRAIN_MIN_SAMPLE`, default 8).
3. Run one cycle: `POST /api/analytics/retrain`.
   - Acceptance: a **non-zero** score↔performance correlation (ρ ≠ 0) and a
     recorded weight change, with the evidence basis stored on the new
     `scoring_weights` row. Confirm via `GET /api/analytics/ops`
     (`scoreCorrelation`, `scoringWeights.source === "retrained"`).

This is the first cycle where the weights move on what the audience actually
rewarded — the loop is real, not scaffolded.

---

## 6. Back to safe defaults

Unset `PUBLISH_DRIVER` / `METRICS_DRIVER` (or set them to `local`) to return to
the offline outbox. Stored connections remain encrypted at rest and inert until
the live drivers are on again.

# ADR-0003 — Server-side sessions, scrypt, client fencing

- **Status:** Accepted
- **Date:** 2026-06-21 (recorded retroactively)

## Context

The API has one door. Tokens in JS-readable storage are an XSS liability, and
trusting an identity from the request body invites IDOR. We need both closed
structurally, not by convention.

## Decision

Passwords are hashed with scrypt. Sessions are server-side rows that store only
`sha256(token)` — the raw token is never persisted and never readable from JS.
`requireAuth(...roles)` walls every route, and identity always comes from the
session, never the request body. Client users are fenced to their own data on
every read. Login is rate-limited and backed by a persistent account lockout.

## Consequences

- XSS-resilient (no token in JS-readable storage) and structurally IDOR-proof
  (a client cannot read another client's data regardless of parameters sent).
- Approvals and publishes are attributable by construction.
- Sessions are revocable: `GET /api/auth/sessions`, `DELETE /api/auth/sessions/:id`.

## Implementing files

- `backend/src/lib/auth.js` — scrypt, session issue/verify, `requireAuth`, fencing.
- `backend/migrations/008_auth.sql` — sessions, accounts, lockout state.

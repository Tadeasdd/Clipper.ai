# ADR-0008 — SSRF-safe ingest fetch

- **Status:** Accepted
- **Date:** 2026-06-21 (recorded retroactively)

## Context

Ingest accepts user-supplied URLs and fetches them server-side — the system's main
SSRF surface. A naive fetch can be steered at internal metadata endpoints or
private hosts, including via DNS rebinding across a redirect.

## Decision

All ingest URLs go through an SSRF-safe client that allows only http/https, blocks
private/loopback/link-local IP ranges, re-checks the IP after every redirect, and
pins the resolved IP to the socket so DNS can't rebind to a private address
mid-request. A stream timeout bounds the transfer.

## Consequences

- The primary SSRF surface is closed structurally, including rebind-across-redirect.
- Rejections carry a reason for the operator to inspect.
- Verified by `npm run smoke:ssrf`.

## Implementing files

- `backend/src/lib/safe-fetch.js` — scheme/IP allowlisting, per-redirect re-check,
  IP-pinned socket, stream timeout.

# ADR-0004 — AES-256-GCM envelope encryption + rotatable keyring

- **Status:** Accepted
- **Date:** 2026-06-21 (recorded retroactively)

## Context

Platform credentials and stored media must be confidential at rest, and keys must
be rotatable without taking the system down or re-touching every blob at once.
The API must never hand plaintext credentials back to a caller.

## Decision

Encrypt credentials and stored media with AES-256-GCM. An envelope/keyring scheme
stamps each ciphertext with the id of the key that sealed it, and keeps an active
key plus a retired PREVIOUS key for decryption — so a new key can be introduced
while old blobs still decrypt. A batch re-wrap re-encrypts everything under the
new key, after which the PREVIOUS key is dropped.

## Consequences

- At-rest confidentiality with zero-downtime key rotation.
- The API never returns plaintext credentials.
- Rotation is operational, not a migration: set `PUBLISH_TOKEN_KEY` (new) +
  `PUBLISH_TOKEN_KEY_PREVIOUS` (old), run `npm run rewrap`, then drop PREVIOUS.

## Implementing files

- `backend/src/lib/crypto.js` — AES-256-GCM primitives.
- `backend/src/lib/content-crypto.js` — stored-media encryption.
- `backend/src/lib/keyring.js` — key-id stamping, active + PREVIOUS resolution.
- `backend/src/lib/secrets.js` — secret-manager seam.
- `backend/scripts/rewrap-secrets.mjs` — batch re-wrap (`npm run rewrap`).
- See `docs/SECRETS.md`, `docs/DATA_LIFECYCLE.md`.

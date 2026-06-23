# Secrets & key rotation (C3)

How Clipper.ai sources encryption/signing secrets and rotates encryption keys
without downtime. Builds on C1 (content-at-rest encryption) and B5 (credentials
at rest).

## Where secrets come from — the manager seam

All key material is resolved through `backend/src/lib/secrets.js` rather than read
straight off `process.env`, so a deployment can keep secrets in a manager. The
provider is env-switched (`SECRETS_PROVIDER`), like every other provider seam:

| `SECRETS_PROVIDER` | Source | Use |
| --- | --- | --- |
| `env` (default) | `process.env` | offline dev, CI — zero-config |
| `file` | JSON object at `SECRETS_FILE` (`{ "NAME": "secret", … }`) | a local "vault"; CI/offline parity for the manager path |

`getSecret(name)` returns the value (an explicit `process.env` value always wins,
so a local override needs no edit to the vault file). Cloud managers (AWS Secrets
Manager, HashiCorp Vault, GCP Secret Manager) are **additive behind the same
seam** — fetch + cache in `initSecrets()`, resolve from the cache in
`getSecret()`. No call site changes.

`initSecrets()` runs once at boot (from `assertProdConfig`) and fails fast if the
configured provider is unreachable (e.g. `SECRETS_PROVIDER=file` with a missing
or malformed `SECRETS_FILE`).

## Boot guard — no weak keys in production

`backend/src/lib/config.js#assertProdConfig` refuses to boot when
`NODE_ENV=production` and a load-bearing key is unset, the dev default, or too
short (< 16 chars):

- `PUBLISH_TOKEN_KEY` — encrypts stored credentials / MFA secrets / OAuth state.
- `CONTENT_ENCRYPTION_KEY` — encrypts client media at rest (C1).

Dev/test skip these checks, so offline dev and the smokes stay zero-config.

## Rotatable envelope encryption

`lib/crypto.js` (small JSON blobs) builds a **keyring** (`lib/keyring.js`) from an
active secret plus any retired secrets. Each ciphertext is self-describing:

```
v2:<keyId>:<base64(iv | authTag | ciphertext)>   # written by this version
<base64(iv | authTag | ciphertext)>              # legacy (pre-C3); still readable
```

`keyId` is a short stable hash of `(salt, secret)` — it needs no separate store
and leaks nothing. Key material is the same scrypt derivation as before, so a
given secret yields the same AES key and historical blobs stay readable.

The active key encrypts new blobs; the active **and** every retired key can
decrypt. That is what makes rotation downtime-free.

### Rotating `PUBLISH_TOKEN_KEY` (no downtime)

1. **Add the new key, retire the old one** — set the new value active and move the
   old value into `*_PREVIOUS` (comma-separated; more than one retired key is
   fine):

   ```bash
   PUBLISH_TOKEN_KEY=<new-strong-secret>
   PUBLISH_TOKEN_KEY_PREVIOUS=<old-secret>
   ```

   New writes use the new key immediately; existing blobs still decrypt via the
   retired key. Roll this out across all processes.

2. **Re-wrap stored ciphertext onto the new key** (any time during the window):

   ```bash
   cd backend && npm run rewrap        # needs DATABASE_URL
   ```

   Idempotent — re-wraps `platform_connections.credentials_enc`,
   `users.mfa_secret`, and `users.mfa_pending_secret` only when the blob actually
   changes.

3. **Drop the retired key** — once `rewrap` reports zero remaining, remove
   `PUBLISH_TOKEN_KEY_PREVIOUS`. A blob still on a dropped key fails closed (it
   throws — never a silent wrong-key decrypt), which is why step 2 precedes this.

### Rotating `CONTENT_ENCRYPTION_KEY`

Media objects are large streams with a fixed-size on-disk header, so the content
seam (`lib/content-crypto.js`) does not carry a per-object key id. Each object is
self-describing (magic + IV) and read with the configured key; rotate by
re-encrypting objects through storage (decrypt-with-old → encrypt-with-new) during
a maintenance window rather than via in-place re-wrap.

## Verify

```bash
cd backend
npm run smoke:secrets   # offline: manager seam, key-stamped envelope, rotation, rewrap, boot guard
npm run smoke:prod      # spawns prod server: fail-fast on missing PUBLISH/CONTENT keys, valid boot
```

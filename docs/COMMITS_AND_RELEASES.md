# Commits, hooks & releases

Capstone **D2** adds a local quality gate and release automation on top of the
existing CI gates. All tooling is dev-only and lives at the repo root; it never
touches the `backend/` or `frontend/` runtime, so offline dev and CI stay green.

## One-time setup

```bash
npm install        # at the repo ROOT — installs the tooling and activates husky
```

`npm install` runs the `prepare` script (`husky`), which points git at `.husky/`.
Until you do this, the hooks below don't fire.

## What runs on every commit

**`.husky/pre-commit`**

1. **lint-staged** → Prettier `--write` + **secretlint** on _staged files only_.
   Nothing un-staged is reformatted, so pixel-locked files (the landing visuals,
   excluded in `.prettierignore`) are never rewritten.
2. If frontend `src` changed → `cd frontend && npm run lint && npm run typecheck`.
3. If backend `.js/.mjs` changed → `node --check` each file.

These reuse the exact scripts CI runs, so a commit can't pass locally yet break CI.

**`.husky/commit-msg`** → **commitlint** validates the message.

### Secret scanning, two layers

- **Local (pre-commit):** `secretlint` — npm-native, no external binary, runs on
  every developer machine.
- **CI (authoritative):** `gitleaks` (`.gitleaks.toml`, `gitleaks` job in
  `ci.yml`) — the deep history scan.

## Commit message format

Two header styles are accepted (`commitlint.config.js`):

| Style                | Example                                         | Drives a release?    |
| -------------------- | ----------------------------------------------- | -------------------- |
| Conventional Commits | `feat: add captions`, `fix(api): 404 on idor`   | **Yes**              |
| Program code         | `D2: pre-commit hooks …`, `U2.2: split visuals` | No (release-neutral) |

Rules: header ≤ 100 chars, non-empty subject, no trailing period. A `!` or a
`BREAKING CHANGE:` footer marks a breaking change.

## Cutting a release

```bash
npm run release:dry   # preview the version bump + CHANGELOG diff (no writes)
npm run release       # bump version, write CHANGELOG.md, create the git tag
```

`commit-and-tag-version` (`.versionrc.json`) computes the semver bump and changelog
from Conventional Commits since the last tag: `fix:` → patch, `feat:` → minor,
`!`/`BREAKING CHANGE` → major. Program-prefixed commits are intentionally omitted
from the changelog — they document the build-out, not user-facing change.

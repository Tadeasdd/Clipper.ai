---
argument-hint: [milestone-id]
description: Execute one MVP backend milestone from docs/MVP_BACKEND_PLAN.md
---

Implement milestone **$ARGUMENTS** from `docs/MVP_BACKEND_PLAN.md` — that
milestone only. Stop at the next milestone boundary.

Workflow:

1. **Read** `docs/MVP_BACKEND_PLAN.md` (the whole doc for context, then focus
   on section $ARGUMENTS) and `CLAUDE.md`. Note the "load-bearing — extend,
   never rewrite" list and respect it.
2. **Plan first.** Enter plan mode and present the implementation plan —
   files to touch, approach, any new migration — and wait for my approval
   before writing code.
3. **Implement** the milestone. Keep all `builtin` / `local` providers working
   with zero external keys and zero network. If a capability can't run for
   real, complete honestly with a visible marker — never fabricate a result.
4. **Verify.** Run this milestone's acceptance criteria from the plan, add the
   new smoke test the milestone specifies, and run the smoke suite:
   ```bash
   cd backend && node --check src/server.js && \
   npm run smoke && npm run smoke:pipeline && npm run smoke:review && \
   npm run smoke:publish && npm run smoke:metrics && npm run smoke:auth
   ```
   Keep any live-key / live-network assertions gated so offline CI stays green.
   If a frontend file was touched, also run `cd frontend && npm run build && npm run smoke`.
5. **Commit.** When everything is green, propose a commit using the exact
   commit message from the plan for milestone $ARGUMENTS. Do not begin the
   next milestone.

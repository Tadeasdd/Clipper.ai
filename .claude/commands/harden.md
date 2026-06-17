---
argument-hint: [item-id]
description: Execute one Security/UI item from docs/EXCELLENCE_PLAN.md
---

Implement item **$ARGUMENTS** from `docs/EXCELLENCE_PLAN.md` — that item only.
Stop at the next item boundary.

Workflow:

1. **Read** `docs/EXCELLENCE_PLAN.md` (full, then focus on $ARGUMENTS) and
   `CLAUDE.md`. Respect the "load-bearing — extend, never rewrite" list.
2. **If $ARGUMENTS is a U-item, honor the preservation contract:** the rendered
   UI — every SVG, the black / `#53fc18` neon-green / stone color scheme, and
   every layout — must be visually identical before and after. The change is
   structural only. If anything would alter the intended design, stop and ask.
3. **Plan first.** Enter plan mode and show files, approach, and (for U-items)
   exactly how you'll prove the look is unchanged. Wait for my approval.
4. **Implement.** Keep all backend `builtin`/`local` providers working offline.
   Never fabricate a capability or fake an interaction — wire it for real or
   label it honestly.
5. **Verify** the item's acceptance criteria, then:
   - Backend item: `cd backend && node --check src/server.js && npm run smoke && npm run smoke:pipeline && npm run smoke:review && npm run smoke:publish && npm run smoke:metrics && npm run smoke:auth` (plus any new smoke the item adds, e.g. `smoke:authz`).
   - UI item: `cd frontend && npm run build && npm run smoke && npm run integration:f4 && npm run integration:f5`, and for U1 confirm with `grep -rn '#53fc18' src` that values are unchanged. Report the preservation check result explicitly.
6. **Commit** with the exact message from the plan for item $ARGUMENTS. Do not
   begin the next item.

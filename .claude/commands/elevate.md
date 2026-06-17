---
argument-hint: [item-id]
description: Execute one Capstone item from docs/CAPSTONE_PLAN.md
---

Implement item **$ARGUMENTS** from `docs/CAPSTONE_PLAN.md` — that item only.
Stop at the next item boundary.

Workflow:

1. **Read** `docs/CAPSTONE_PLAN.md` (full, then focus on $ARGUMENTS), plus
   `CLAUDE.md`, and skim `docs/MVP_BACKEND_PLAN.md` + `docs/EXCELLENCE_PLAN.md`
   for any item this one depends on. Respect the "load-bearing — extend, never
   rewrite" list.
2. **Check dependencies.** If $ARGUMENTS relies on an item that isn't done yet
   (e.g. Q3 needs MVP M2; E3 needs E1; P3/P4 need U-track), say so and propose
   doing the prerequisite first instead of faking around it.
3. **If the item touches the UI, honor the preservation contract:** every SVG,
   the black / `#53fc18` neon-green / stone color scheme, and every layout stay
   visually identical. Structural change only. Track P perf items must prove
   pixel-equivalence (screenshot/visual-regression).
4. **Plan first.** Enter plan mode; show files, approach, new migrations, and how
   you'll verify. Wait for approval before writing.
5. **Implement.** All backend `builtin`/`local`/dry-run paths must keep working
   offline with zero external keys. Never fabricate a capability or fake an
   interaction — wire it real or label it honestly. Any new external integration
   ships with an offline/dry-run default so CI stays green.
6. **Verify** the item's acceptance criteria, then run the relevant gates:
   - Backend: `cd backend && node --check src/server.js && npm run smoke && npm run smoke:pipeline && npm run smoke:review && npm run smoke:publish && npm run smoke:metrics && npm run smoke:auth` plus any new script the item adds (e.g. `npm run eval`, `smoke:authz`).
   - Frontend/UI: `cd frontend && npm run build && npm run smoke && npm run integration:f4 && npm run integration:f5`; report the preservation/visual check explicitly.
7. **Commit** with the exact message from the plan for item $ARGUMENTS. Do not
   begin the next item.

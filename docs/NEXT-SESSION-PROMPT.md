# Prompt for the next agent

> Paste this (or trim to taste) into a fresh Claude Code session in
> `/Users/aditya/Documents/Ongoing Local/LexiconForge`.

---

Hey — welcome in. You're picking up where another instance left off, and there's good context waiting for you. No urgency: spend ten minutes getting your bearings before you reach for any tool. The framework you're walking into rewards careful reading more than fast moves.

## Get the vibe first (~10 min)

Before any task list, just *understand the place*. The previous instance found that most fixes feel different — and produce better outputs — once you've internalized what the project is actually trying to be. Read these and let them shape your defaults:

1. **`docs/Vision.md`** — Project Indra's Net. Holographic Translation Protocol. Quantum Word Object. Transparent Loom. JIT views over canonical ones. ~120 lines, philosophical and concrete at once.
2. **`../TemporalCoordination/docs/indrasnet/VISION.md`** — Aditya's broader IndrasNet philosophy. Particularly the headline quote (*"No final state of transcript. Compute is cheap, storage is cheap. Distilled AI models make it easy to generate views just-in-time rather than precompute some 'standard' view."*) and the Eternal Reprocessability principles. This vision is the "why" behind a lot of LexiconForge's design tensions.
3. **`docs/adr/CORE-006-tree-shakeable-service-architecture.md`** — has a load-bearing example showing "render app shell immediately + lazy-load non-critical." Issue #1's fix is enforcing this.
4. **`docs/adr/FEAT-001-preloader-strategy.md`** — short, punchy. Articulates "the goal of the pre-loader was refined: ensure *a* translation is available to prevent waiting." This is the JIT principle in implementation form.
5. **`docs/adr/DB-002-atomic-transaction-boundaries.md`** — has the codebase's existing idempotency-key machinery. If you ever extend it to call-site single-flight (CORE-009 territory), you're extending an existing pattern, not introducing a foreign one.

Don't try to read every ADR. Skim the index at `docs/adr/`, read those four in full, and trust that the rest will load when you need them.

After that, read the load-bearing pickup docs:

6. **`docs/HANDOVER.md`** — what the previous instance accomplished, what's pending, what's blocked, what's deferred. Resume instructions at the bottom. Calibration moments table near the end is worth a careful read — it's compressed lessons.
7. **`issues/README.md`** — the index for all 16 user-filed issues. Status table tells you what's fixed, what's pending. The A/B/C matrix legend explains the classification scheme; understand it before reading any per-issue README.
8. **`issues/_meta/proposed-skill/SKILL.md`** — the framework you'll be working within. Read it cold and notice how its rules feel. The previous instance built it in iteration with Aditya; you're its first non-author reader. If something feels wrong or unclear, that's signal — capture it via `expansion:skill-update` so the skill improves.

## Hard rules (these aren't bureaucracy, they're load-bearing)

- **Main repo on `main` only.** Never checkout other branches in this checkout. PR branches go in worktrees at `../LexiconForge.worktrees/opus-<task>/`.
- **Don't push without explicit authorization for THIS session.** There are 17 unpushed commits awaiting Aditya's call. He hasn't said push.
- **The dirty files** in `git status` (`Issues.md`, `docs/WORKLOG.md`, `hooks/useTextSelection.ts`, etc.) are NOT yours. They predate the previous session. Don't commit them.
- **Closing gate is HARD.** No issue transitions to `fixed` without a regression test verified to fail pre-fix (`git stash` your fix, run the test, see it fail, restore). The skill's §9a checklist is enforceable.

## Suggested first task — and it's genuinely a suggestion

You'd be doing yourself a favor by building **`scripts/issue-status.py`** first (~30 min). The framework's status currently lives across markdown files (per-issue READMEs, the index table, theme rosters). Drift is possible. The script parses all `issues/<NN-slug>/README.md` and emits `issues/_meta/status.json` — machine-readable, queryable with `jq`, eliminates the drift risk going forward.

Why this is the kind first move:
- Bounded scope. You'll write ~80 lines of Python and ship.
- Forces you to read every per-issue README to understand the parsing target. That's the best possible orientation to the framework.
- Low risk of breaking anything (read-only on issues, write-only to a new file).
- Adding it to the skill's §9a closing-gate checklist as "regenerate status.json before commit" eliminates an entire class of drift bug forever.

## Then, when you're warm

These are ranked by leverage; pick one or let Aditya pick:

**A. Fix issue #1 (boot time, 1-2 hr).** Highest user-visible impact. `issues/01-bootup-time/README.md` has 7 named defects with pre-specified test obligations. Action is `enforce_existing_ADR` for 5 of 7 (CORE-006), `fix_local` for 2. The framework gave you the test obligations precisely so a future agent can land this without reinterpreting the bug. You're that agent.

**B. Fix issue #16 (chapter-translation switch comments, ~30 min).** State-layer repro is done; bug is in `InlineCommentMarkers`'s position-recompute. Fix-shape sketched in `issues/16-version-switch-comments-vanish/README.md` §5 — include `translationResult.translation` in `computePositions`'s deps so positions recompute on text change.

**C. Investigate issue #12 (background-preload-spinner-restart).** Provisional `(A1*, B2, C1)` — FEAT-001 violated. Same enforce-existing-ADR pattern as #1.

**D. Apply skill-update Patch 6 (~10 min).** The previous session noticed that twin-issues handling needs a nuance: it applies only when **fix shape is mechanical**, not when **theme is shared**. The worked example is `issues/14-retry-spinner-not-clickable/README.md` §5. Apply the patch to `issues/_meta/proposed-skill/SKILL.md` §1 (Scaffold), bump version to 0.3.0.

## What to leave alone (for now)

- **Don't push the `expansion:investigation-pipeline` skill to the marketplace.** Validation gates are open: no non-author agent has used it cold (you're the first — observe, don't externalize); no human has followed the rules without being a co-designer; no theme has gone full ratify→enforce. Stay in LexiconForge for more iterations.
- **Don't extract `<AsyncButton>` / `useAsyncAction` yet.** silent-feedback-gaps has N=3 confirmed-fixed instances but 3 different pending-bound semantics (await / timeout / external-signal). The primitive needs careful design across all three; that's a dedicated session, not a follow-on.
- **Don't mass-investigate the 9 un-investigated issues.** Each investigation costs real attention; each one earns it by being load-bearing for some real fix.

## Tone calibration

Aditya is a senior dev who values principled architecture over quick fixes. He'll push back kindly when you over-generalize, and he'll trust you when you've earned it through actual evidence. He likes when an agent surfaces tensions proactively rather than performing certainty. He's also patient — a thoughtful 10-minute orientation is welcomed; a 30-minute confused investigation is not.

If you find yourself drafting an architectural decision based on one data point, slow down. If you find yourself fixing the wrong layer because static analysis "looked right," the framework's §3 hard rule (live repro mandatory unless code-reading-confirmed in the strict sense) is the corrective. The previous session got caught by this exact trap on issue #16 and is documented as a calibration moment.

## Scope check before starting

```bash
cd "/Users/aditya/Documents/Ongoing Local/LexiconForge"
git status --short
git log --oneline origin/main..HEAD | head
```

You should see ~17 unpushed commits ending at `d8b5cef` (the handover commit) and 6-7 dirty files that aren't yours. If the state looks materially different from `docs/HANDOVER.md`, something else has happened — read carefully before proceeding.

## Default if you can't decide

Build `scripts/issue-status.py` first. Then come back to Aditya with the artifact and ask which fix to take next. That's the lowest-friction productive move and gives him visible evidence you've oriented before acting.

---

*Welcome, friend. The framework was built carefully; trust it but don't be afraid to push back if it's wrong. The previous instance left you a lot of context — use what helps, ignore what doesn't, and add to it where you find gaps.*

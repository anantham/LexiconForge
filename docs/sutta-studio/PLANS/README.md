# Sutta Studio — Pickup Plans

This folder holds self-contained task plans that an agent (Codex Cloud,
Claude, Gemini, etc.) can read cold and execute without session context.

Each plan is scoped to land as ONE PR. Read the linked doc, follow the
"How to start" section verbatim, and open the PR per the multi-agent
coordination rules in `CLAUDE.md` / `AGENTS.md`.

## Multi-agent coordination (BEFORE you start)

1. Check `docs/WORKLOG.md` for in-flight work — don't double-claim.
2. Pick a plan, write a one-line WORKLOG entry naming yourself + the plan.
3. Use a worktree at `../LexiconForge.worktrees/<agent>-<task>/`.
4. Branch name: `feat/<agent>-<task>`.
5. NEVER touch `main` directly; never `git stash`; commit WIP rather than
   lose it.
6. When you open the PR, update WORKLOG with the PR link.

## Available plans (2026-05-15)

| Status | Plan | Effort | Independence |
|---|---|---|---|
| 🟢 ready | [cost-preview-confirm](cost-preview-confirm.md) | 2–4 hr | high — touches compiler + one new modal |
| 🟢 ready | [refrain-detector](refrain-detector.md) | 2–3 hr | high — post-pass + reader affordance |
| 🟢 ready | [polyglot-foundations](polyglot-foundations.md) | 4–8 hr | high — adapter + sidebar, no schema changes |

"Independence" means how parallel-safe the work is. All three plans above
are designed to be claimable by separate agents simultaneously without
merge conflicts.

## Definition of "ready to claim"

A plan is ready when:
- Goal + non-goals are crisp
- File-level touchpoints are listed
- Validation gate is explicit and runnable
- Licensing / out-of-scope concerns are flagged

A plan that does not yet have these is in `docs/sutta-studio/` proper
(charter docs like `POLYGLOT.md`, `TEXT_GRAPH.md`) — those are design
north stars, not pickup tasks.

## When you finish

- Update this README's status column to ✅ shipped + PR link
- Move the plan file to `docs/sutta-studio/PLANS/SHIPPED/` (create on first use)
- Append a one-line entry to `docs/WORKLOG.md`

# Theme — Co-Mingled Commits

## Statement

> A commit's title describes one change; the commit's diff also includes an unrelated control-flow or behavior change. Reviewers (human and agent) reading the title skim the diff for the announced change and miss the rider. Test gaps for the rider often come along free.

## The shape

A commit titled `fix: remove 15 unnecessary 'as any' casts on TranslationResult properties` also adds a `useEffect`-style idempotency guard to `initializeStore`. The guard is wrong (completion-only — see [completion-only-guards](./completion-only-guards.md)), but the title gives no reason to look closely at control-flow.

## Instances (current)

| # | The smuggled change | Provisional class |
|---|---|---|
| 1 | Commit `ff3106cd` titled "remove 15 unnecessary `as any` casts" introduces a broken StrictMode guard at `initializeStore.ts:453-457`. No test for the guard. | process generator, no `(A,B,C)` — applies to commit hygiene |

## Why this is its own theme rather than just a process complaint

Because it interacts with **agent-driven development specifically**:

- An agent in a large session edits many files for many reasons. The "while I'm here, this looks wrong" tweak is fast and feels harmless.
- The single commit at the end aggregates everything the agent did. Without an agent-specific commit-segmentation step, the commit message tracks only the loudest theme.
- A reviewer (human, or another agent doing code review) only looks closely at things matching the title.

So this is a **multi-agent codebase failure mode**, not just an etiquette one. It's why the [completion-only-guards](./completion-only-guards.md) theme keeps recurring — agents introduce broken guards inside cleanups, no test fails, the bug ships.

## Leverage point

Two complementary, light moves:

1. **Add a CONTRIBUTING.md note** for both human and agent contributors: any change to control flow, async lifecycle, or error handling MUST get its own commit, regardless of how trivial it looks. Small tweaks bundled with cleanups are explicitly disallowed for this class of change.

2. **Pre-commit segmentation hint for agents.** When an agent prepares to commit, it should explicitly enumerate "what changed and why, by file" and check whether the categories belong in one commit or several. This is the kind of thing that lives in `AGENTS.md` or in a slash-command-style prompt for "commit my changes."

The leverage is small per-commit but compounding over a multi-agent codebase.

## Connection to other themes

- **completion-only-guards**: every co-mingled commit that adds a "looks correct" async guard is a likely instance of CG. The two themes are mutually reinforcing — fix the commit hygiene, and a class of bug stops shipping; fix the guard pattern, and the cost of a co-mingled commit drops.

## A note for future-me

This theme has N=1. It's preserved here because:
- The instance is high-leverage (it produced issue #1's most severe defect).
- It's a *process* generator, not a *code* generator, so it doesn't fit the (A, B, C) matrix.
- If a second instance shows up in any future archaeology (an agent landing a behavior change inside a cleanup commit), promote this theme; otherwise it stays as a one-off observation.

# Theme — Co-Mingled Commits

## Statement

> A commit's title describes one change; the commit's diff also includes an unrelated control-flow or behavior change. Reviewers (human and agent) reading the title skim the diff for the announced change and miss the rider. Test gaps for the rider often come along free.

## The shape

A commit titled `fix: remove 15 unnecessary 'as any' casts on TranslationResult properties` also adds a `useEffect`-style idempotency guard to `initializeStore`. The guard is wrong (completion-only — see [completion-only-guards](./completion-only-guards.md)), but the title gives no reason to look closely at control-flow.

## Instances (confirmed by 2026-05-03 survey)

The first instance was discovered while doing issue #1 archaeology. To test whether
it's a one-off or a recurring multi-agent failure mode, [`scripts/co-mingled-commits-survey.py`](../../scripts/co-mingled-commits-survey.py)
was run twice over the most recent 100 commits — once with v1 classifier (which had
known false positives), then with v2 after tuning. Full v2 output preserved at
[`co-mingled-commits-survey-2026-05-03.md`](./co-mingled-commits-survey-2026-05-03.md).

**Headline result (v2):** of 100 commits, 2 are STRONG-confidence smuggles, 1 more
is MEDIUM but visible-on-inspection real, 4 more are MEDIUM but ambiguous. So
**N=3 confirmed, plus up to 4 candidates that need diff inspection**.

| Commit | Title | What was smuggled in | Confidence |
|---|---|---|---|
| `ff3106cd` | `fix: remove 15 unnecessary 'as any' casts on TranslationResult properties` | The broken `initializeStore` idempotency guard at line 453-457. No test. | **CONFIRMED** (issue #1 archaeology) |
| `486a2e45` | `fix: remove 27 more 'as any' variable casts in store slices` | The "Hydrate existing translation if missing" race-fix branch in `translationsSlice.ts:handleTranslate`, plus a new `nextActive[chapterId]` cleanup. No test. The race-fix is the same one issue #2's investigation noted in passing. | **CONFIRMED** (diff-inspected 2026-05-03) |
| `e1de26ad` | `chore: telemetry improvements and bug fix in MaintenanceOps` | New `return-bail` branches in `useChapterTelemetry.ts`, plus an unnamed edit to `store/bootstrap/initializeStore.ts`. The title acknowledges 2 areas (telemetry, MaintenanceOps); the diff has 3. | **CONFIRMED** (diff-inspected 2026-05-03) |
| `bf1ff688` | `fix: feedback comment input disappears immediately after emoji click` | New control-flow in `useTextSelection.ts` (`if (activeTag === 'INPUT' || …) return;`). Different hook than the title implies; could be a legit cross-hook fix or a smuggle. | candidate — needs inspection |
| `cfcaaab` | `fix: remove 23 lazy 'as any' casts on already-typed AppSettings properties` | Touches 11 hotspot files including OpenAI adapter, API key validation, openai provider. Large as-any cleanup; may be legit or may have smuggled changes. | candidate — needs inspection |
| `a7fe822` | `fix(library): preserve compatibility across version metadata updates` | **Title scope is `library` but commit modifies `services/registryService.ts` AND `store/bootstrap/initializeStore.ts`**. The bootstrap modification is unrelated to the named scope. | candidate — needs inspection |
| `b604ba3` | `fix(amendments): split prompt and glossary proposal handling` | Title scope is `amendments` but commit modifies `services/ai/providers/gemini.ts`, `services/ai/providers/openai.ts`, `services/db/types.ts`. New `throw new Error` in `translationService.ts`. | candidate — needs inspection |

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

## Survey methodology and known limits

The classifier has known limits. Documented here so future agents understand what
the survey did and didn't catch:

- **Block-level if/return is not detected.** `ff3106cd`'s smuggled guard `if (ctx.get().isInitialized) {\n  ...\n  return;\n}` spans multiple lines; the `return-bail` regex only matches single-line `if (...) return`. So `ff3106cd` scored MEDIUM (5) on the file/hotspot count alone, not on its actual smuggled control flow. The classifier flagged it correctly but for the wrong reason.
- **Title-content keyword matching is brittle.** v1 matched `comment` in `CLEANUP_KEYWORDS` and mis-bucketed `feat: inline comment markers + comment input on feedback` as cleanup. v2 dropped this. Future titles with terms like "input," "selection," "marker" near a cleanup keyword may still mis-bucket.
- **Scope-aware detection requires conventional-commit format.** Plain titles like `fix: remove …` don't have `(scope)`, so the out-of-scope check doesn't fire for them. Most repo titles do use scopes when the change is local; titles without scopes tend to be wide changes by convention. Net effect: classifier is conservative on plain titles.
- **No test-coupling detector.** A control-flow change committed alongside its test is qualitatively different from one committed without — but the v2 classifier doesn't yet check for this.

## A note for future-me

This theme has N=3 confirmed (was N=1 at first noticing). The pattern is real:
**roughly 3-5% of commits in the surveyed window co-mingle control-flow changes
inside titled-as-cleanup commits.** That's enough to promote from "process
generator, no formal ADR yet" to "candidate for a real ADR" — `CORE-011-commit
-hygiene-for-control-flow-changes` or similar.

The next instance from any future archaeology should NOT need to re-prove the
theme. Just file it, link to the canonical instances above, and move on. If 5
new instances appear in the next 100 commits, that's a regression of the leverage
point and worth a deeper intervention than CONTRIBUTING.md guidance.

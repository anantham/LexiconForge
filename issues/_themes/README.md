# Themes — Cross-Cutting Failure Classes

A theme is a **generator function** that produces multiple specific issues. Each theme:

- Names the class precisely enough that a future issue can be tested against it ("does this fit the pattern? yes/no").
- Lists current instances (issues that are confirmed examples).
- Names the **spec gap that allows the class to keep happening** — typically a missing or aspirational ADR.
- Suggests the **leverage point**: where to intervene once, so a future-Aditya / future-agent doesn't keep filing the same shape of bug.

Themes are not bug categories. They are *causal hypotheses*. If we fix the leverage point and the same shape of bug stops appearing, the theme was real. If it keeps appearing, the theme is too narrow and we need a different cut.

## Index

| Theme | One-line statement | Instances |
|---|---|---|
| [jit-vs-precompute](./jit-vs-precompute.md) | Codebase materializes canonical views (full session imports, fixed comparison modes, frozen ETAs) where the vision calls for JIT-derived views | 1, 2, 3, 6, 9, 11, 12, 13, 15, 16 |
| [completion-only-guards](./completion-only-guards.md) | "Run once" guards check completion state, not in-flight state — under any concurrent caller, both runs go through | 1, 2, 7, 9, 12 |
| [silent-feedback-gaps](./silent-feedback-gaps.md) | User clicks → async work begins → no UI signal until much later (or never) | 4, 5, 14 |
| [silent-failure-deep](./silent-failure-deep.md) | Validation fires deep inside a long pipeline instead of at the request boundary, so the user pays seconds before learning the request couldn't work | 1 |
| [co-mingled-commits](./co-mingled-commits.md) | Commit title and content disagree — control-flow changes hide inside cleanups, defeating review | 1 |

## How a theme gets promoted from "noticed" to "addressed"

1. Theme exists with N≥2 instances and a named leverage point.
2. Aditya decides the leverage point is worth the effort.
3. Either an ADR is written that the theme cannot survive, or a refactor is planned that makes the bug-class structurally impossible (e.g. a single-flight wrapper, a Validator class that runs at boundaries).
4. New instances after that date are tracked separately ("regressions of an addressed theme") because they signal the leverage point didn't hold.

If a theme reaches N≥4 and remains unaddressed, it's a candidate for **escalation to vision-level discussion** — at that point the same gap is producing bugs faster than they can be filed.

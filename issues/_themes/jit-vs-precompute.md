# Theme — JIT vs Precompute

## Statement

> The codebase materializes canonical, decontextualized views (full session imports, fixed `v1-composite` snapshots, frozen "Selected" comparison states, aggregate ETAs) where the project's stated vision calls for **just-in-time, recontextualized derivation**.

## Why this matters

LexiconForge's [`docs/Vision.md`](../../docs/Vision.md) opens with:

> Project Indra's Net is a **"Just-in-Time" interface** for high-bandwidth cognition. It rejects the idea that a text has a single, static state.

The IndrasNet companion vision (`../../../TemporalCoordination/docs/indrasnet/VISION.md`) is even more explicit:

> Traditional systems scale by **generalization**: exclude edge cases, abstract away context, **precompute rigid structures**. This filters out nuance.
>
> IndrasNet scales by **inclusion**: cheap intelligence near the edge interprets intentions in local context, **generating structure just-in-time** rather than forcing users into predefined taxonomies.

> Just-in-time generation — Generate views when needed, don't precompute "standard" views.

So the codebase has drifted from its own founding principle. The generator: **whenever an engineer (human or agent) optimized for a specific path under perf or simplicity pressure, they materialized a view rather than letting it stay derived.** Each individual decision was locally rational; the cumulative effect is anti-vision.

## The distinction (matters because the vision allows *some* pre-computation)

| Bad precomputation (what the theme is about) | Good precomputation (vision-allowed) |
|---|---|
| Canonical view shared across all consumers | Anticipative pre-fetch for *this* user's likely next moment |
| Frozen at write time | Always re-derivable |
| Blocks user until ready | Runs in background of an already-interactive UI |
| Decoupled from consumer context | Coupled to recent state |

`Vision.md` example of *good* anticipation: the [Comparative Heatmap](../../docs/Vision.md) idea — diff AI vs fan translation — is itself a JIT recomposition of two pre-existing materials. Fine. But if the comparison panel **stores** the diff and re-renders it on chapter change, that's the bad form.

## Instances (current)

| # | How it manifests | Provisional class |
|---|---|---|
| 1 | `initializeStore` blocks on full deep-link import; cannot render until session JSON is fully materialized | `(A2, B2, C2)` |
| 2 | Fan-toggle restarts translation rather than reading from the JIT-derivable mix of raw + machine + glossary | `(A2, B2, C2)` |
| 3 | Glossary terms not loaded; novel metadata empty — derived view that should compose from the three-tier glossary doesn't | `(A2*, B2, C2)` |
| 6 | Image-model dropdown is a static snapshot, not a live-validated list | `(A2, B2, C2)` |
| 9 | Chapter change is slow because eager work blocks JIT rendering of the next chapter | `(A2, B2, C2)` |
| 11 | Comparison panel state survives chapter change — view treated as durable, not derived | `(A2, B2?, C2)` |
| 12 | Tab return resets background-preload spinners — the anticipative work was done but its progress wasn't durable | `(A2, B2, C2)` |
| 13 | ETA aggregated across providers — frozen averaged view hides per-model granularity | `(A2, B3, C2)` |
| 15 | Comparison says "Selected" with repeated text instead of cycling raw/fan/google with faint underline of the focal text — explicit JIT recomposition refused in favor of a frozen mode | `(A2, B3, C3)` |
| 16 | Version switch loses comments — comments tied to version *identity* rather than to the chapter-as-derived-view | `(A2, B2, C2)` |

The pattern: **N=10**, all `B2` or `B3`, all `C2` or `C3`, every `A` is `A2` or `A3`. Spec rot is the upstream cause.

## Existing spec coverage (ADR audit — 2026-05-02)

The principle is **partially covered**, not absent:

| ADR | What it commits to | Issues it covers |
|---|---|---|
| **CORE-006** (Tree-Shakeable Service Architecture, *Implemented 2026-03-05*) | Critical services = `database, navigation, translation` only. **"Render app shell immediately"** then load non-critical in background. SLO: `featureLoading: '< 500ms from trigger'` | **#1** (boot blocks on import + audio init), **#9** (chapter change exceeds 500ms feature-load SLO) |
| **FEAT-001** (Pre-loader Strategy, *Implemented*) | "The primary goal is to ensure *a* translation is available to prevent waiting, not necessarily to ensure the translation is perfectly up-to-date" — "skip if any version exists" | **#12** (tab-return restarts preload spinners — violates the "skip if exists" optimization) |
| **FEAT-003** (Image Service Architecture, *Implemented 2026-03-08*) | OpenRouter image-model catalog is dynamic ("replacing the earlier stale static list approach"). Imagen/Gemini/PiAPI remain static via `config/costs.ts` | **#6** (split: OpenRouter dynamic = ADR violation if static; others = under-specified) |
| **SUTTA-003** (Sutta Studio MVP, *Implemented*) | "Derived 'phase views' (Deep Loom) for UI rendering" — explicit "derived view" language exists, but only in Sutta-Studio context | conceptual precedent only |

So #1, #9, #12, #6 are **ADR-vs-code drift cases** (the spec says the right thing; the code drifted). The other instances (#2, #3, #11, #13, #15, #16) are **genuine spec gaps** that no existing ADR addresses.

## Leverage point

**Two moves, in order.**

1. **Enforce existing ADRs.** Tests that assert CORE-006's "render shell immediately" and FEAT-001's "skip if any version exists" should fail today. Adding them surfaces the drift and creates pressure to fix #1, #9, #12. This is more leverage per hour than any new ADR.

2. **Write the missing umbrella ADR**, scoped to what CORE-006/FEAT-001/FEAT-003 don't cover. **Draft now exists at [`proposed-adrs/CORE-008-derived-views-recomputed-not-stored.md`](./proposed-adrs/CORE-008-derived-views-recomputed-not-stored.md).** Awaiting Aditya ratification before moving to `docs/adr/`.

Content sketch (not committing — this is theme-doc, not the ADR itself):

- **Invariant**: any state that can be derived from raw inputs + a small amount of session/UI context MUST be derived, not persisted.
- **Definition of "raw input"**: source-text chapter, fan translation, AI translation result, glossary entries, user preferences. These are sacred.
- **Definition of "derived view"**: comparison panel state, ETA estimates, "selected mode" state, comments-as-attached-to-version, the v1-composite version itself, the per-novel chapter-progress aggregate.
- **Pragmatic exemption clause**: an anticipative pre-compute is allowed if (a) it is for a specific user's session, (b) it is invalidated cheaply, (c) the absence of the precompute does not block rendering. This is the "Amazon delivers before you order" kind of pre-compute, not the "everyone gets the same standard view" kind.

Once that ADR exists:
- Issues 1, 11, 12, 15, 16 become straightforward refactors.
- Issues 6, 13 become tests that fail when the dropdown is static or when ETA is aggregated.
- Issues 2, 3, 9 become design exercises ("what does a JIT version of this look like?") that have a vision-aligned answer.

## Tests that would have caught this earlier (none exist)

- Boot-time E2E that asserts `initializeStore` returns within Nms regardless of session JSON size.
- "Comparison panel does not survive chapter navigation" assertion.
- "ETA reported separately per active model" assertion.
- "Image model list is fetched at first dropdown open, not at boot" assertion.

## Open questions

- Is there an existing ADR I'm missing that already covers some of this? Worth a `docs/adr/` audit before writing CORE-008.
- The IndrasNet docs talk about "pace layering" (slow layers vs fast layers). Are derived views "fast layer" by definition? If yes, that gives the ADR a vocabulary.
- Aditya's call: is `v1-composite` a derived view (which would make defect 5 in issue #1 a JIT-violation) or is it intentionally a stored snapshot for reproducibility? The two interpretations imply different fixes.

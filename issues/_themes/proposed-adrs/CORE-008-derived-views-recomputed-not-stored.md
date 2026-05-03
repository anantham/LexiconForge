# CORE-008 (DRAFT) — Derived Views Are Recomputed, Not Stored

> **Status: PROPOSED — DRAFT** · Date: 2026-05-02 · Author: Opus 4.7 (with Aditya as ratifier)
>
> **Not in `docs/adr/` yet.** This draft lives under `issues/_themes/proposed-adrs/` as a working artifact. Move into `docs/adr/` only when Aditya ratifies the principle and sign-offs the scope. **Until ratified, do not enforce.**

## Context

LexiconForge's [`docs/Vision.md`](../../../docs/Vision.md) opens with the JIT principle:

> Project Indra's Net is a **"Just-in-Time" interface** for high-bandwidth cognition. It rejects the idea that a text has a single, static state.

The IndrasNet companion vision (`../../../../TemporalCoordination/docs/indrasnet/VISION.md`) reinforces:

> Just-in-time generation — Generate views when needed, don't precompute "standard" views.

> Audio (sacred, eternal) → JSON (reprocessable) → Chunked Items → Views (generated JIT)

Despite this, multiple parts of the codebase materialize canonical/durable views from raw inputs:

- **Boot** (#1): `initializeStore` blocks on a full session-JSON import before rendering any chapter — even when only one chapter is requested.
- **Comparison panel** (#11, fixed): used to persist across chapter changes; fixed in `0c5162b` by invalidating on `currentChapterId` change.
- **Background preload** (#12): work survives mount but is restarted on tab visibility change instead of resumed.
- **ETA** (#13): aggregated across providers, hiding per-model granularity.
- **Comparison cycle modes** (#15): "Selected" state freezes a single comparison view; user wants raw/fan/google cycle.
- **Version-switch comments** (#16): comments are stored against a version-identity rather than against the underlying chapter as a JIT-recomposed view.
- **Image models** (#6): static dropdown for non-OpenRouter providers (FEAT-003 already moved OpenRouter to dynamic).
- **Glossary loading** (#3): novel metadata + glossary loading lifecycle is unclear.

[FEAT-001](../../../docs/adr/FEAT-001-preloader-strategy.md) commits to "ensure *a* translation is available, prevent waiting" for chapter preloads. [CORE-006](../../../docs/adr/CORE-006-tree-shakeable-service-architecture.md) commits to "render app shell immediately, lazy-load non-critical." Both are partial: each governs its own scope but neither names the *general principle* that produces them.

This ADR fills the gap.

## Decision

**Invariant:** Any state that can be derived from raw inputs + a small amount of session/UI context **MUST** be derived, not persisted.

### Definitions

- **Raw input** (sacred, persisted): the untransformed substrate of the system. Specifically:
  - Source-text chapters (the bytes from kakuyomu/syosetu/dxmwx/etc.)
  - Fan translations (community-imported, treated as raw input)
  - AI translation results (the model's output for given settings, treated as raw because the model produced it; the *settings* are the prompt-side raw input)
  - Glossary entries (user-curated)
  - Footnotes, illustrations (artifacts of generation, treated as raw)
  - User feedback (spans, comments, amendments)
  - User preferences (settings)

- **Derived view** (ephemeral, JIT-recomputed): anything reachable from raw input + session/UI context via a deterministic function. Specifically:
  - Comparison panel state (a function of: current chapter, current selection, current modes-being-compared)
  - Selected mode in a cycle (raw/fan/google) (a function of: cycle position + chapter)
  - "v1-composite" version (a function of: raw chapters under v1-st-enhanced + glossary + composition rules)
  - Per-novel chapter-progress aggregate (a function of: chapter records)
  - ETA estimate (a function of: queue + per-model historical speed)
  - Comments-attached-to-view (a function of: comments-against-chapter-spans + current view's text)

- **Anticipative pre-compute** (allowed exemption): a derived view computed eagerly *for a specific user's likely next moment*. To qualify it must:
  - (a) be scoped to the current session, not shared across users
  - (b) be invalidated cheaply when its inputs change
  - (c) **never block rendering** — the absence of the precompute must produce a correct (slower) UX, not a broken one

  Examples that qualify: chapter preloader (FEAT-001), prompt-template prefetch, OpenRouter model list cached for the dropdown lifecycle.
  Examples that DO NOT qualify (and are forbidden by this ADR): any precompute the renderer waits on, any precompute that's persisted across sessions, any precompute that becomes a "canonical view" (one shape for all consumers).

### Required behaviors

1. **Render the requested view from raw input synchronously where possible**, asynchronously where not — but never block rendering on derivation of an *adjacent* view.
2. **Invalidate derived state on context change.** Hooks/subscribers that hold derived state MUST clear/recompute when their input identifiers change. The fix in `0c5162b` (`useComparisonPortal`'s `useEffect` on `currentChapterId`) is the canonical pattern.
3. **Never persist a derived view in IndexedDB.** If you find yourself writing a derived shape to a `db/operations/*.ts` write, stop and add a "raw → derive at read time" comment for the next reviewer.
4. **Surface the cost of view-fork settings.** If a settings change forks the version tree (`includeFanTranslationInPrompt`, system prompt, model), the UI MUST tell the user before the fork happens. (This is a UX commitment, not just a code one.)

### Required architectural patterns

- A `useDerivedView(contextId, derive)` hook (or equivalent) that pairs the derived value with an automatic invalidation on `contextId` change. Sites that currently hand-roll this (e.g. `useComparisonPortal`) refactor to use it.
- A `precompute(key, fn, { invalidatesOn })` utility for the anticipative-precompute exemption. Cache is per-session, invalidates on listed dependencies, never blocks. **Pairs with `CORE-009-single-flight-at-call-sites`** (proposed) for dedup; see that ADR for the dedup primitive.

## Consequences

### Positive

- The boot-time bug (#1) becomes structurally easier to fix: `initializeStore` returns the rendered shell, and `loadNovelIntoStore` becomes a background derivation that the renderer doesn't await.
- Issues #11, #12, #13, #15, #16 collapse into "use the new hook factory" tasks instead of one-off fixes.
- Image-model dropdown (#6) becomes a precompute (anticipative-allowed) instead of a static list.
- The vision becomes enforceable: tests can assert "no view is rendered from a non-derived source" or "every derived view's hook clears on context change."

### Negative

- Several existing files need refactoring to honor the principle. Estimate: ~15–20 small PRs over a sprint. Not a single big-bang.
- The "v1-composite" version specifically is a hard call: is it raw (a stored snapshot) or derived (a recomputable view)? The current code treats it as raw, but the silent-remap bug (issue #1, defect 5) suggests it shouldn't be a stored identity. **Aditya call required** — if "derived," the import-fail bug becomes obviously wrong (don't store v1-composite; derive on read); if "raw," then the silent-remap is a separate bug.
- This ADR overlaps with FEAT-001 and CORE-006. They become *specific applications* of CORE-008's general principle. No redundancy if their scopes (preload-strategy, bundle-loading) stay narrower than CORE-008's umbrella.

### Tradeoffs

- **Performance**: deriving on read is slower than reading a precomputed cache. Acceptable because (a) cheap intelligence makes derivation fast and (b) most derived views are tiny relative to the raw inputs they're derived from. If a specific derived view becomes a hot path, the anticipative-precompute exemption covers it.
- **Cognitive load**: developers have to ask "is this raw or derived?" at every state-design moment. This is a price worth paying — it forces the right question.

## Test patterns this ADR enables

- "Derived view X invalidates when context Y changes" — should be a one-line vitest case per `useDerivedView` site.
- "Init returns a render-able shell within Nms regardless of remote state" — Playwright SLO test for #1.
- "Comparison panel does not survive chapter navigation" — already failing pre-`0c5162b`, would have caught the regression.
- "Settings change that forks the version fingerprint surfaces a UI signal" — for #2's settings-as-identity axis.

## Migration path (sketch)

1. **Land the umbrella.** Merge this ADR (after revisions). Add a single test that exercises the principle on one site.
2. **Enforce CORE-006 first.** Issues #1 and #9 — already-spec, drift is the bug. Test + fix.
3. **Generalize to new instances.** Issues #11 (already fixed, just add regression test), #12, #15, #16. Each is a 1-2 day PR.
4. **Refactor the gnarly ones.** Issue #6 (image-model picker dynamic), #13 (per-model ETA). These touch more surfaces.
5. **Decide the v1-composite question.** Defect 5 from issue #1 forces this either way.

## Open questions for ratification

- **Scope of "raw input."** Are AI translation results truly raw (the model produced them and we shouldn't re-derive) or derived (we COULD re-derive given prompt + model + settings)? Current ADR treats them as raw — please confirm.
- **`v1-composite` — raw or derived?** This is the load-bearing question for issue #1's defect 5.
- **Comments-attached-to-view (#16)** — currently coupled to version. Should they couple to (chapter, span) so they re-render in any view? This is a data-model question that touches DB-003.
- **Settings as identity (#2)** — should `includeFanTranslationInPrompt` continue to fork the version tree, or should it become a view-time directive? Has direct consequences for storage cost and API spend.

## Related

- [`Vision.md`](../../../docs/Vision.md) — JIT philosophy
- [`CORE-006-tree-shakeable-service-architecture.md`](../../../docs/adr/CORE-006-tree-shakeable-service-architecture.md) — render-shell-immediately for boot, specific application of CORE-008
- [`FEAT-001-preloader-strategy.md`](../../../docs/adr/FEAT-001-preloader-strategy.md) — "ensure *a* translation is available", specific application
- [`FEAT-003-image-service-architecture.md`](../../../docs/adr/FEAT-003-image-service-architecture.md) — OpenRouter dynamic model list, specific application
- [`SUTTA-003-sutta-studio-mvp.md`](../../../docs/adr/SUTTA-003-sutta-studio-mvp.md) — "Derived 'phase views' (Deep Loom) for UI rendering" — same language, restricted scope
- [`DB-002-atomic-transaction-boundaries.md`](../../../docs/adr/DB-002-atomic-transaction-boundaries.md) — idempotency principles at data-layer; CORE-008 extends spirit to view-layer
- Related proposed: `CORE-009-single-flight-at-call-sites` (separate draft, complements this one for dedup of anticipative pre-computes)
- Theme: [`jit-vs-precompute.md`](../jit-vs-precompute.md) — instances roster

## What this ADR does not do

- Does **not** mandate a single hook implementation. The pattern matters; the file layout doesn't.
- Does **not** ban all caching. Anticipative precompute exemption preserves the right kinds of caching.
- Does **not** retroactively rewrite history — existing stored derived state can be read, but new code must follow the principle, and refactoring opportunities are tracked per-issue.
- Does **not** bind Sutta Studio's pipeline (covered by SUTTA-006/007, which already follow the principle).

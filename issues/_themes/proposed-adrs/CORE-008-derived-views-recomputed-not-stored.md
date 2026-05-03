# CORE-008 (DRAFT) — Two-Level Versioning: Chapter-Translations Are Raw, Book-Versions Are Recipes

> **Status: PROPOSED — DRAFT v2 (2026-05-03)** · Author: Opus 4.7 (with Aditya as ratifier)
>
> **Not in `docs/adr/` yet.** This draft lives under `issues/_themes/proposed-adrs/` as a working artifact. Move into `docs/adr/` only when Aditya ratifies the principle and sign-offs the scope. **Until ratified, do not enforce.**
>
> **v2 changes (2026-05-03):** Conversation with Aditya pinned the load-bearing decisions. The two-level vocabulary (chapter-translation vs book-version) replaces v1's single "raw vs derived" frame; "best" defined as "the user's active flag, not temporal latest"; auto-active on translate explicitly endorsed; materialize-on-demand promoted from "tradeoff" to "required mechanism."

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

The system has **two distinct levels of "version"** that must not be conflated:

### Level 1 — Chapter-translation (raw)

A single immutable translation of one chapter, addressed by `(novel, chapter, provider, model, systemPrompt, settings_hash, generated_at)`. The fundamental raw unit. Stored in IDB `translations` table with an `isActive` boolean.

**Rules:**
- **Immutable.** A new translation with different settings is a *new* chapter-translation, never an overwrite.
- **`isActive` flag = "what to render right now for this chapter."** Set on creation (auto-active) AND settable explicitly via the dropdown (`setActiveTranslationVersion`). The dropdown override is the load-bearing escape hatch — without it, auto-active becomes a trap.
- **Comments / feedback / amendments anchor here.** A comment is `(novel, chapter, chapter_translation_id, span)`. Durable because chapter-translations are immutable. Switching chapter-translation away hides the comment; switching back must re-render it (this is issue #16's regression test obligation).
- **Tier ordering ("which is best?") is NOT defined globally.** The system has no opinion on quality. The user's `isActive` flag is the answer; the system tracks user choices, not external rankings.

### Level 2 — Book-version (recipe over chapter-translations)

A coherent reading sequence over a novel. Two flavors:

- **Curated** (raw at the book level): an explicit list of chapter-translation IDs. Like an EPUB you've committed to. Stored as a NovelVersion with a `manifest: { [chapterId]: chapterTranslationId }`.
- **Rule-based** (derived at the book level): a function `chapterId → chapterTranslationId`, resolved at read time. **`v1-composite` is this kind**, and its rule is *"resolve to whichever chapter-translation has `isActive: true` for that chapter."* No stored manifest; nothing in IDB has v1-composite as a scope.

**Rules:**
- **Rule-based book-versions are NEVER scopes for storage.** No IndexedDB record, no session-JSON chapter, no registry entry should tag content as belonging to v1-composite. Tag it with the chapter-translation's actual settings-fingerprint.
- **Materialize-on-demand is required, not optional.** A user must be able to take a snapshot ("freeze this reading state") and have it become a curated book-version with provenance pointing back to the rule + the chapter-translations resolved at that moment. EPUB export is the most obvious materialization trigger.
- **Auto-promote behavior of rule-based books is fine when the override mechanism works.** Generating a fresh chapter-translation auto-actives it (you want to read what you just made); the dropdown lets you switch back if the older one was better. Both behaviors are necessary; auto-active alone without the override would trap users.

### Anticipative pre-compute (allowed exemption — unchanged from v1)

A derived view computed eagerly *for a specific user's likely next moment*. To qualify it must:
- (a) be scoped to the current session, not shared across users
- (b) be invalidated cheaply when its inputs change
- (c) **never block rendering** — the absence of the precompute must produce a correct (slower) UX, not a broken one

Examples that qualify: chapter preloader (FEAT-001), prompt-template prefetch, OpenRouter model list cached for the dropdown lifecycle.
Examples that DO NOT qualify (and are forbidden by this ADR): any precompute the renderer waits on, any precompute that's persisted across sessions as a canonical-view-for-everyone, any precompute that becomes a stored book-version-as-scope.

### Required behaviors

1. **Render the requested view from raw input synchronously where possible**, asynchronously where not — but never block rendering on derivation of an *adjacent* view.
2. **Invalidate derived state on context change.** Hooks/subscribers that hold derived state MUST clear/recompute when their input identifiers change. The fix in `0c5162b` (`useComparisonPortal`'s `useEffect` on `currentChapterId`) is the canonical pattern. The same pattern applies to chapter-translation switches (issue #16): comments and floating-icon overlays MUST re-render when the active chapter-translation changes.
3. **Never persist a rule-based derived view as a storage scope.** If you find yourself writing chapter records under a book-version-name that isn't a curated manifest, stop. The book-version-name is a label for a rule, not a key.
4. **Surface the cost of chapter-translation forks.** If a settings change creates a new chapter-translation (always true for any settings-fingerprint change), the UI MUST tell the user a new chapter-translation is being created, not silently. Issue #2's settings-as-identity concern.
5. **Materialize-on-demand must be reachable from the UI.** At minimum: EPUB export materializes the current resolution into a curated book-version. Optionally: a "save this reading state" button that names + stores the snapshot for later return.

### Required architectural patterns

- A `useDerivedView(contextId, derive)` hook (or equivalent) that pairs the derived value with an automatic invalidation on `contextId` change. Sites that currently hand-roll this (e.g. `useComparisonPortal`) refactor to use it.
- A `precompute(key, fn, { invalidatesOn })` utility for the anticipative-precompute exemption. Cache is per-session, invalidates on listed dependencies, never blocks. **Pairs with `CORE-009-single-flight-at-call-sites`** (proposed) for dedup; see that ADR for the dedup primitive.
- A `materialize(rule, snapshot_at)` operation that takes a rule-based book-version and produces a curated one. Used by EPUB export and any "freeze" feature.

## Consequences

### Positive

- The boot-time bug (#1) becomes structurally easier to fix: `initializeStore` returns the rendered shell, and `loadNovelIntoStore` becomes a background derivation that the renderer doesn't await.
- Issues #11, #12, #13, #15, #16 collapse into "use the new hook factory" tasks instead of one-off fixes.
- Image-model dropdown (#6) becomes a precompute (anticipative-allowed) instead of a static list.
- The vision becomes enforceable: tests can assert "no view is rendered from a non-derived source" or "every derived view's hook clears on context change."

### Negative

- Several existing files need refactoring to honor the principle. Estimate: ~15–20 small PRs over a sprint. Not a single big-bang.
- ~~The "v1-composite" version specifically is a hard call: is it raw or derived?~~ **Resolved 2026-05-03:** v1-composite is rule-based at the book level; its rule is "resolve to the active chapter-translation per chapter." Defect 5 (silent remap) is a bug because v1-composite should never have been a storage scope the registry searches against.
- This ADR overlaps with FEAT-001 and CORE-006. They become *specific applications* of CORE-008's general principle. No redundancy if their scopes (preload-strategy, bundle-loading) stay narrower than CORE-008's umbrella.
- Existing IndexedDB records that may have been written under a v1-composite scope (if any — needs verification) would need migration to their actual chapter-translation-fingerprint scope. Migration effort TBD.

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

## Open questions for ratification (post-2026-05-03 conversation)

Most v1 questions resolved in conversation. Remaining:

- **AI translation results — raw or re-derivable?** Current draft treats them as raw (the model produced specific bytes; we don't re-derive given prompt + settings, we reuse the stored bytes). Please confirm.
- **Are there existing IDB records tagged under rule-based book-version names?** If yes, migration plan needed before this ADR can be enforced. If no, the ADR is purely forward-looking.
- **EPUB export materialization shape.** When an EPUB is exported, is the resulting curated book-version stored back into IDB for future reference, or is it a write-only artifact (file download, gone from app state after)? Current draft says "stored with provenance"; verify that's the desired UX.

## Resolved questions (with answers from 2026-05-03)

- **`v1-composite` — raw or derived?** **Derived (rule-based book-version).** Rule: "per-chapter, resolve to active chapter-translation."
- **What does "best" mean?** **The user's `isActive` flag.** No global quality ranking; the system tracks user choices.
- **Auto-active on new translation — bug or feature?** **Feature, because the dropdown override exists.** Auto-active alone without override would be a trap; with override, it's a sensible "you wanted to read what you just made" default.
- **Comments-attached-to-view (#16)** — anchor to chapter-translation (immutable). The bug is rendering, not data-model: switching chapter-translation away should hide; switching back should re-render. (Issue #16 reclassified to local UI re-render.)
- **Settings as identity (#2)** — settings-fingerprint forking is by-design; each unique-settings translation is a new chapter-translation. The bug is making fork-cost visible to the user, not eliminating the fork.

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

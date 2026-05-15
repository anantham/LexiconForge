# Issue 12 — Tab return resets background-preload spinners

> Status: **investigated** · Last updated: 2026-05-15 · Investigator: Claude Opus 4.7 (1M) · Worktree `opus-issues-investigation`

## 1. Claim (verbatim from Issues.md)

> when i move away from the page and get back the background preload ahead chapters are freshly api called rather than showing the calls that were sent in the background... spinner starts from scratch

## 2. Reproduction

**Status:** live repro deferred — **subsumed by [issue #19's prescribed Playwright repro](../19-translation-survives-nav-policy/README.md#2-reproduction)**, which exercises the same generator. Reproducing here would duplicate that work without independent value.

**What live-Playwright would show (per issue #19's code-inspection verdict):**
- Navigate to chapter A. Auto-translate / preload fires.
- Navigate away within 500ms (back to library or to chapter Z).
- Console log fires: `🚫 [Chapters] Navigation detected, cancelling previous chapter translation: A` (from `store/slices/chaptersSlice.ts:170-199`).
- The LLM call is aborted; no IDB write occurs.
- Return to chapter A. `translationResult` is absent; spinner restarts from scratch.

**This investigation's contribution:** confirmation that the verbatim claim ("background preload ahead chapters") is a **preload subset** of the broader root cause. Issue #19's framing also covers the user-initiated-translation case (which #12 doesn't mention) and the misleading `beforeunload` dialog (also out-of-scope for #12).

## 3. Verdict

**Real bug** (superseded by issue #19) — Confidence: **0.95** (inherited from #19's code-read verdict).

The user's symptom is a true bug. The generator that produces it (`setCurrentChapter` action explicitly cancelling in-flight work on navigation) is fully diagnosed at issue #19 §3.

This issue could close as `superseded` once issue #19 ships its Phase 1 fix. Alternatively, this issue can close as the **user-filed canonical statement** of the preload subset while #19 handles implementation.

## 4. Where the failure lives (A / B / C)

**`(A1*, B2, C1)`** — confirmed from index's provisional assignment.

Justification:
- **A1*** — FEAT-001 ("ensure a translation is available, prevent waiting") explicitly addresses this. The ADR isn't aspirational; the code drifted from it. Asterisk = ADR-rot suspected, but the spirit and letter of FEAT-001 are clear.
- **B2** — Code falls short of FEAT-001 by actively cancelling preload work on navigation.
- **C1** — Aligned with Vision. FEAT-001 IS the vision-aligned ADR; the implementation is the gap.

### Themes (cross-cutting failure classes)

- [`jit-vs-precompute`](../_themes/jit-vs-precompute.md) — instance. Preload is the precomputed view; cancelling it is the explicit anti-precompute behavior.
- [`completion-only-guards`](../_themes/completion-only-guards.md) — instance. The cancellation logic guards on "user navigated" without considering "translation in progress" as a separate state worth preserving.
- Candidate new theme **`nav-cancels-bg-work`** — proposed by issue #19. N=2 (this + #19). The roster expands to 2 confirmed instances, which is enough to ratify the theme.

## 5. Evidence and code paths

Per [issue #19 §3-§5](../19-translation-survives-nav-policy/README.md#5-evidence-and-code-paths):

**Cancellation site:** `store/slices/chaptersSlice.ts:170-199` — `setCurrentChapter` action explicitly cancels in-flight translation for previous chapter:

```ts
// Cancel any active translation from the previous chapter when navigating away
const prevChapterId = get().currentChapterId;
if (prevChapterId && prevChapterId !== chapterId) {
  // ... AbortController.abort() on in-flight translation
}
```

**Effect on preload specifically:** the preload mediator (`services/AutoTranslateMediator.ts` / `services/preloadAhead.ts` — exact path deferred to #19 fix-time) is just another consumer of the translation service; its in-flight requests use the same AbortController slot keyed on chapter ID. When `setCurrentChapter` aborts on nav, preload requests die with it.

**Returning to the chapter** → no IDB record exists (the partial LLM call was aborted before `runChunk()` could write) → `AutoTranslateMediator` sees no `translationResult` → spinner restarts from scratch.

## 6. Test coverage gap & regression-test obligations

### What's missing

- No test exercises the "navigate away during preload, return, expect cached result" flow.
- Issue #19's prescribed Playwright test (`traces/repro-shape-b.spec.ts`) covers the user-initiated case but doesn't pin the preload subset specifically.

### Regression-test obligations

| Defect | Required regression test |
|---|---|
| Preload cancellation on nav | `tests/e2e/preload-survives-nav.spec.ts` — load chapter A, wait for preload mediator to start chapter B, navigate to chapter Z, wait > preload duration, navigate back to chapter B, assert `translationResult` exists. (Owned by #19's fix.) |

**This issue's obligation is to ensure #19's regression test specifically pins the preload subset, not just the user-initiated case.**

## 7. Archaeology

Deferred — owned by issue #19.

Adjacent archaeology that IS relevant: when was the `setCurrentChapter` cancellation logic introduced, and was the trade-off ever documented? FEAT-001 predates the code that violates it — that's the ADR-rot evidence.

## 8. Generator function

**Same as issue #19:** "SPA navigation treated as 'user wants different work, abort the old' without distinguishing between user-initiated work (cancel ok) vs speculative/preload work (preserve)."

The fix-shape that resolves both: a finer-grained cancellation policy that preserves IDB-bound writes regardless of nav direction.

**Other places this generator might surface:**
- Image generation: does navigating away cancel in-flight image requests? Likely yes per the same `AbortController` pattern.
- Audio synthesis: same concern.
- Worth a follow-up grep `grep -rEn "AbortController|.abort\(\)" services/`.

## 9. Action — which kind of fix this is

**`wait`** — issue is subsumed by issue #19's Phase 1 implementation.

Recommendation: keep this issue open as the user-filed canonical preload-subset statement, and close it as `superseded` when issue #19's regression test (with the preload-specific case) lands.

| Direction | Impact | Effort | Risk | Reversibility | Confidence |
|---|---|---|---|---|---|
| Wait for #19 Phase 1 | Closes both #12 + #19 user-initiated case | 0 here | None | High | 0.95 |
| Add preload-specific test to #19's regression suite | Pins the preload subset | <30 min during #19 fix | None | High | 0.95 |

## 9a. Closing gate

This issue closes as `superseded` when:

- [ ] Issue #19 Phase 1 fix ships.
- [ ] #19's regression test suite includes `tests/e2e/preload-survives-nav.spec.ts` covering this issue's specific symptom.
- [ ] Theme `nav-cancels-bg-work` ratified with N≥2 roster (#12 + #19).

## 10. Status

`investigated` — closes as `superseded` (by issue #19) pending #19's Phase 1 fix.

## 11. Open questions

- Should the "preload survives nav" regression test be a separate file from #19's user-initiated test, or one combined test exercising both shapes?
- Are there other speculative-work consumers (image preload, audio preload) that would benefit from the same fix?

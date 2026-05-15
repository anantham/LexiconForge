# Issue 9 — Chapter-change is slow — instrument and identify causes

> Status: **investigated** · Last updated: 2026-05-15 · Investigator: Claude Opus 4.7 (1M) · Worktree `opus-issues-investigation`

## 1. Claim (verbatim from Issues.md)

> do logging between chapter changes and identify all causes of delay and optimize

_Note: an **audit task** — instrument a chapter transition, classify every contributor to wall-clock time, identify SLO compliance + low-hanging-fruit optimizations._

## 2. Reproduction

**Goal:** measure wall-clock time from chapter-change click to visible H1 update, identify what runs during the transition.

**Environment:** dev server `http://localhost:5183/` (isolated worktree, port-isolated IDB), IDB pre-seeded with Dungeon Defense chapters 1-4 with v1-v5 translations each (carryover from earlier investigation #3).

**Steps:**
1. Open Dungeon Defense in reader at Chapter 1.
2. Use in-page JS instrumentation (`MutationObserver` on h1 + monkey-patched `console.log`) to capture timeline.
3. Click `Next →` button.
4. Settle 2.5s; collect log lines and h1-change time.

**Trace:** [`traces/ch1-to-ch2-timeline.txt`](./traces/ch1-to-ch2-timeline.txt).

**Observed result — Ch1 → Ch2 transition timeline:**

| t (ms) | Source | Event |
|---:|---|---|
| 0 | (click) | Next → button clicked |
| 99 | `AutoTranslateMediator.ts` | State change detected |
| 110 | `AutoTranslateMediator.ts` | Translation already cached for ch2 stableId |
| 389 | `TranslationRepository.ts:267` | getTranslationVersionsByStableId called |
| 571 | `ImageSlice.ts:488` | loadExistingImages called for ch2 |
| 572 | `ImageSlice.ts` | Loaded existing images |
| **574** | **DOM mutation** | **H1 visually changed to "Dungeon Defense - Chapter 2"** ← user-visible transition |
| 630 | `TranslationRepository.ts` | Resolved stableId → URL `booktoki468.com/novel/3912078` |
| 897 | `TranslationRepository.ts` | Found 0 translation(s) by URL ← **lookup failed** |
| 897 | `TranslationRepository.ts` | Trying direct stableId index fallback |
| 958 | `TranslationRepository.ts` | ✅ Fallback found 3 translation(s) |

**Verdict:** `reproduced` — chapter change is **574ms** to visible H1 (exceeds CORE-006's `<500ms` SLO), with up to **958ms** before all translation data is fully resolved.

## 3. Verdict

**Real bug** — Confidence: **0.9**.

Three distinct defects confirmed:

1. **Visible transition (574ms) exceeds CORE-006's `<500ms` SLO by 15%** — even for an already-cached chapter with no network calls.

2. **Serial fallback in TranslationRepository wastes ~330ms** — `Found 0 translation(s) by URL` at 630-897ms is a failed lookup that should have been short-circuited or run in parallel with the stableId fallback (which succeeds at 958ms).

3. **9 `console.log` lines fire per chapter change** — adds to issue #8's wasted-logs concerns; the runtime side of the audit that #8 deferred.

This is for an **already-cached, already-translated chapter on a warm IDB**. Worst-case (uncached / un-translated / first-time) would be much higher.

## 4. Where the failure lives (A / B / C)

**`(A1*, B2, C2)`** — confirmed from index's provisional assignment. The asterisk is real: CORE-006 commits to "< 500ms feature-loading SLO" but the code drifted from that commitment.

Justification:
- **A1*** — CORE-006 has the spec, and `Implemented` flag is suspect because the measured wall-clock violates it. The ADR isn't aspirational; the code lapsed.
- **B2** — Code falls short — visible transition exceeds the SLO and the underlying repo path has a wasted-URL-lookup serial fallback.
- **C2** — Vision implicitly favors snappy navigation; no doc directly contradicts current behavior but no doc defends the 574ms either.

### Themes

- [`jit-vs-precompute`](../_themes/jit-vs-precompute.md) — instance. `AutoTranslateMediator` already KNOWS the translation is cached at 110ms; the visible transition still takes another 464ms. The system precomputes a cache lookup but doesn't use the result on the critical path.
- [`completion-only-guards`](../_themes/completion-only-guards.md) — instance. The two-lookup serial pattern (URL → fallback to stableId) doesn't have a single-flight wrapper to short-circuit when one returns first.
- [`logging-policy-missing`](#) — the proposed theme from issue #8. Instance N=2 once issue #8 ratifies.

## 5. Evidence and code paths

**Critical path of `navigateToChapter`:** `store/slices/chaptersSlice.ts:646-668`

```ts
navigateToChapter: (chapterId) => {
  const chapter = get().chapters.get(chapterId);
  console.log(`[navigateToChapter] called`, { ... });  // 1 wasted log
  if (chapter) {
    set({ currentChapterId: chapterId, appScreen: 'reader' });  // Zustand notify
    get().addToHistory(chapterId);   // sync state + IDB fire-and-forget
    NavigationService.updateBrowserHistory(...);  // URL update
    get().lightenNonCurrentChapters(chapterId);  // disabled no-op
    scheduleBookshelfPositionPersist(get);  // IDB scheduling
  }
},
```

Synchronous critical path: ~few ms.

**What takes 574ms:**
- React re-render of Reader on Zustand `currentChapterId` change — includes:
  - `ChapterContent.tsx` mount/update
  - `TranslationStatusPanel.tsx` mount
  - `Illustration.tsx` per illustration placeholder (×3) — each calls `getAverageImageGenerationTime`
  - `TranslationRepository.getTranslationVersionsByStableId(...)` at 389ms (post-render side-effect)
  - `ImageSlice.loadExistingImages` at 571ms

**Wasted serial-fallback at 630-958ms** — `services/db/repositories/TranslationRepository.ts:267-...`:
```ts
async getTranslationVersionsByStableId(stableId) {
  // 1. Resolve stableId → URL  (630ms)
  // 2. Try lookup by URL        (returns 0 at 897ms)
  // 3. Fallback to stableId idx (returns 3 at 958ms)
}
```

The URL-based lookup is the legacy path; the stableId index is the current source of truth. Either:
- The URL lookup should be removed (after data-migration of all rows to stableId-indexed format), OR
- The two lookups should fire in parallel with a `Promise.any`-style winner-take-all.

**Logs fired per chapter change** (9 lines):
- `[navigateToChapter] called` — `chaptersSlice.ts:648`
- `[AutoTranslateMediator] State change detected`
- `[AutoTranslateMediator] Translation already cached for ...`
- `[TranslationRepo] getTranslationVersionsByStableId called`
- `[ImageSlice:loadExistingImages] Called for chapter ...`
- `[ImageSlice:loadExistingImages] Loaded existing images`
- `[TranslationRepo] Resolved stableId ... → URL ...`
- `[TranslationRepo] Found 0 translation(s) by URL ...`
- `[TranslationRepo] ✅ Direct stableId fallback found 3 translation(s) ...`

All on the navigation hot path. Issue #8 catalogs them.

## 6. Test coverage gap & regression-test obligations

### What's missing

- No e2e/perf test pins chapter-change wall-clock time to < 500ms.
- No unit test asserts `TranslationRepository.getTranslationVersionsByStableId` short-circuits when one lookup path succeeds first.
- No test pins `console.log` count per navigation transition.

### Regression-test obligations

| Defect | Required regression test |
|---|---|
| Chapter change >500ms | `tests/e2e/chapter-change-perf.spec.ts` — Playwright with IDB seeded with 4 chapters, click Next, assert `H1` mutation timestamp ≤ 500ms after click. |
| Serial URL→stableId fallback wastes ~330ms | `tests/services/db/translationRepository.parallelLookup.test.ts` — assert that when both paths return data, the first responder wins (lookup completes in ≤ time of single path). |
| Log noise on navigation | `tests/e2e/chapter-change-console-budget.spec.ts` — assert ≤ 2 `console.log` lines on a typical navigation; gate the rest behind `DEBUG_BOOT`-style flag. |

## 7. Archaeology

Three sites worth tracing at fix-time:

1. `services/db/repositories/TranslationRepository.ts:267` — when was the URL-based lookup introduced, and was the stableId fallback always serial? Likely from before the stableId migration (issue #20 territory).
2. `store/slices/chaptersSlice.ts:648` — `[navigateToChapter] called` log line — when added, was it meant as temporary debug?
3. `services/AutoTranslateMediator.ts` — the parallel cache-check that fires at 99-110ms. Was it ever on the critical render path?

Run `python3 scripts/issue-archaeology.py services/db/repositories/TranslationRepository.ts` at fix-time.

## 8. Generator function

Two distinct generators:

1. **"Serial fallback for redundant data paths."** Two ways to find the same data (URL-indexed legacy, stableId-indexed current) executed serially instead of racing. The pattern probably extends to other lookups that migrated index schemes (chapter lookup by old-id vs new-id, image lookup by hash vs reference).

2. **"Debug instrumentation on hot paths never decommissioned."** Same generator as issue #8, observed here on the navigation hot path. Forward-direction reflex without reverse-direction cleanup.

**Other places these generators might surface:**
- Generator 1: any service that survived a schema/index migration. Grep `grep -rEn "fallback|legacy" services/db/repositories/`.
- Generator 2: `services/translationService.ts`, `services/imageService.ts` — translation/image hot paths.

## 9. Action — which kind of fix this is

**Compound:** `enforce_existing_ADR` (for CORE-006 SLO) + `fix_local` (for repo race).

### 9.1 enforce_existing_ADR — CORE-006 <500ms SLO

CORE-006 commits to `<500ms feature-loading`. Current measurement is 574ms. Add a Playwright perf regression test, then tighten the critical path.

### 9.2 fix_local — parallel-or-eliminate URL/stableId race

Either:
- (a) Remove URL-based lookup after data-migration audit. 1-2 hr.
- (b) Race the two paths with `Promise.any` and short-circuit on first success. <1 hr.

Recommend (b) as immediate fix, (a) as follow-up after audit.

### 9.3 logging cleanup

Gate the 9 navigation logs behind `DEBUG_NAV` flag. Defer until issue #8's ADR-009 lands.

| Direction | Impact | Effort | Risk | Reversibility | Confidence |
|---|---|---|---|---|---|
| Race URL & stableId lookups | -330ms (60% of overrun) | <1 hr | Low | High | 0.9 |
| Memoize getAverageImageGenerationTime per session | -? unknown but per-illustration overhead exists | 1 hr | Low | High | 0.7 |
| Gate the 9 navigation logs | -minor, but cleans #8 | 30 min (after #8 ADR) | None | High | 0.9 |
| Add perf regression test | Prevents drift | 1 hr | None | High | 0.95 |
| Audit + remove URL-based lookup | Future-proofing | 2-4 hr | Medium | Medium | 0.7 |

**Recommendation:** ship 9.2(b) + perf test in one PR. Defer the log cleanup until #8 settles. The bigger URL-based-lookup removal is its own audit.

## 9a. Closing gate

This issue closes as `fixed` only when:

- [ ] `TranslationRepository.getTranslationVersionsByStableId` races the two paths (Promise.any).
- [ ] Playwright perf test: chapter-change h1-mutation ≤ 500ms passes on seeded IDB.
- [ ] All three regression tests from §6 written and passing.
- [ ] Comment in perf test links to CORE-006's `< 500ms feature-loading` SLO statement (per template's `enforce_existing_ADR` requirement).

## 10. Status

`investigated` — compound action `enforce_existing_ADR` + `fix_local`. Empirically measured at 574ms (target <500ms). Race-fix should close the gap with margin.

## 11. Open questions

- Is the URL-based lookup ever a HIT in current data? If not, it's pure dead code; if yes, the parallel-race is the correct fix.
- Should the perf budget be tightened below 500ms for cached chapters? (CORE-006 is the floor, not a goal.) Worth measuring uncached too.
- Are there other repositories with similar URL/stableId serial-fallback?

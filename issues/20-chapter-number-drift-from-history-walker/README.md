# Issue 20 — `chapterNumber` field drifts from `stableId` baseHash (history-walker corruption)

> Status: **root-caused** · Last updated: 2026-05-10 · Investigator: Claude Opus 4.7 (1M)
> Surfaced while shipping V4 unwrap migration ([issue #19 spec](../19-translation-survives-nav-policy/README.md), V4 in `services/db/operations/maintenance.ts`). Post-V4, dropdown showed duplicate entries ("· Chapter 339" + "● Chapter 339 — First-Degree State of War"). Investigation revealed the chapter row's `chapterNumber` field was 341, not 339, even though both stableId baseHash and title agree on 339.

## 1. Claim

> A subset of chapter rows have `chapterNumber` field values that disagree with the chapter number encoded in their `stableId` baseHash (e.g. baseHash `ch339_60hkvy_65g6` carries `chapterNumber: 341`). The discrepancy is always **forward** (`chapterNumber > bareHash N`), typically by +1 or +2, and is concentrated in chapters the user actively translated between April 16 and May 4 2026.

The user-visible symptom: dropdown dedup keys on `chapterNumber`, so virtual catalog entry "Chapter N" stays on screen even when a real chapter row exists with the same N in its stableId — because the real row reports a different `chapterNumber`. Result: duplicate entries for ~6 chapters.

## 2. Reproduction

**Status:** repro is empirical (not test-suite). The corrupt state was confirmed in production-like data on the user's local IDB and reproduced via offline analysis of the user's session JSON exports.

**Empirical evidence:**

| Date | Source | ch11_vlmzva | ch5_a6ydin | ch339_60hkvy | ch341_7zz8g9 | ch342_dvdu4m |
|------|--------|---|---|---|---|---|
| 2026-04-03 | session JSON export | cn=11 ✓ | cn=5 ✓ | cn=339 ✓ | cn=341 ✓ | cn=342 ✓ |
| 2026-05-10 | live IDB | **cn=12** | **cn=6** | **cn=341** | **cn=342** | cn=342 ✓ |

The April 3 session has all 3269 chapters with `chapterNumber === parseInt(stableIdBareHash)`. **Zero drift.** The same exact chapters in the May 10 IDB exhibit drift.

**Activity correlation:** the audit (`MaintenanceOps.auditChapterDuplicates()`) shows translations created on chapters 337-348 on 2026-04-16 and 348-349 on 2026-05-04 (Anthropic claude-sonnet-4.6 outputs). The drift exclusively affects chapters touched in those windows.

**Repro plan (deferred to fix-PR):** Vitest test that constructs a 5-chapter `prevUrl` chain with a deliberate gap (chapter 343's `prevUrl` skips 340-342 and points to 339), invokes the history walker via `TranslationService.buildHistoryAsync(...)`, then asserts the surviving chapter rows have `chapterNumber === parseInt(stableIdBareHash)` and that no `setChapterNumberByStableId` call ever wrote a value disagreeing with bareHash.

## 3. Verdict

**Real bug** — Confidence: **0.95**.

Code chain identified by inspection + git blame + offline data diff:

### Site of corruption

`services/translationService.ts:858-876` — the `[HistoryAsync]` block at the end of `buildHistoryAsync`:

```ts
const currentNumber = currentChapter?.chapterNumber || 0;
if (currentNumber > 0 && links.length > 0) {
  try {
    for (let i = 0; i < links.length; i++) {
      const inferred = currentNumber - (i + 1);
      if (inferred <= 0) break;
      const link = links[i];
      if (link.stableId) {
        try { await ChapterOps.setChapterNumberByStableId(link.stableId, inferred); } catch {}
      }
      if (link.memChapter) {
        try { (link.memChapter as any).chapterNumber = inferred; } catch {}
      }
    }
    slog(`[HistoryAsync] Persisted inferred chapter numbers for ${Math.min(links.length, currentNumber - 1)} link(s).`);
  } catch (e) {
    swarn('[HistoryAsync] Failed to persist inferred chapter numbers', e);
  }
}
```

### Causal mechanism

The walker builds `links[]` by traversing `prevUrl` from `currentChapter` backward. Then it assumes the chain is dense (every prev link decrements chapter# by exactly 1) and stamps each link with `inferred = currentNumber - (i + 1)`. **The assignment is unconditional** — it overwrites whatever `chapterNumber` was previously stored.

**Two failure modes:**

1. **Gap in prevUrl chain.** If chapter 343's `prevUrl` resolves to (e.g.) ch340_* (skipping nothing on its hop, but the chain then jumps farther on the next hop), the walker overshoots and stamps wrong numbers. Example reconstruction for `ch339_*` → cn=341:
   - Walk start: chapter at cn=343
   - links[0] resolves to ch340_* → inferred=342 → ch340_*.chapterNumber=342 (wrong; was 340)
   - links[1] resolves to ch339_* (prev of ch340_*) → inferred=341 → ch339_*.chapterNumber=341 (wrong; was 339)

2. **Propagation.** Once one chapter's `chapterNumber` is corrupted, future walks that start from it use the bad value as `currentNumber`, then infer wrong numbers for everything before it. Drift compounds.

### Downstream amplifier

`services/db/operations/chapters.ts:425-447` — `setChapterNumberByStableId` is unguarded. It blindly writes the supplied `chapterNumber` with no consistency check against the stableId's own baseHash, no comparison against the existing value, no telemetry on mismatch.

### Why session export (April 3) is clean but live IDB (May 10) is dirty

The walker has been in place since **2025-09-08** (commit `a30647c`, original code) and the IDB write has been in place since **2025-11-18** (commit `056bb75a`, refactored during legacy IDB facade removal). However, the corruption only manifests in chapters that were *both* (a) translated using this code path AND (b) had a `prevUrl` chain that the walker traversed. Most of the user's 3269 chapters were imported via session JSON or scraped fresh — both paths set `chapterNumber` directly from URL/title parsing and have correct values. Only chapters near the user's *recent active translation work* (April 16, May 4) have been touched by the walker and corrupted.

**This explains the small blast radius (~6 chapters) despite the bug being live for ~8 months.**

## 4. Provenance / postmortem

### Commit attribution

| Commit | Date | Author | Change |
|--------|------|--------|--------|
| `a30647cd` | 2025-09-08 | Aditya | Original walker added — "feat(translation): prevUrl-chain fallback, diagnostics, number derivation and persistence" |
| `056bb75a` | 2025-11-18 | Aditya | IDB write call updated during "refactor(db): remove legacy indexedDB facade" (this commit refactored `ChapterOps.setChapterNumberByStableId` from the legacy facade to the modular ops, preserving the call site) |

### Originating prompt

**Not available.** The Claude Code transcript archive (`~/.claude/projects/-Users-aditya-Documents-Ongoing-Local-LexiconForge/`) only goes back to **2025-12-21**, three months after the walker was written. Commits `a30647c` and `056bb75a` predate the archive entirely. We cannot trace the originating prompt or whether Claude Code, a different agent, or manual authoring produced the code.

What we *can* say from the commit message: the intent was framed as "number derivation and persistence" — i.e., compute chapter numbers from contextual signals when missing, and persist them. The intent is reasonable; the implementation is unsound because it (a) overwrites unconditionally and (b) trusts the prevUrl chain to be dense.

### Why earlier transcript searches did not surface this

Prior debugging sessions (Jan 26 92ad916d-*, March 30 c2b67a19-*) discussed dropdown rendering and chapter loading symptoms, but the discussion centered on UI display (`SessionInfo.tsx`/`ChapterDropdown.tsx`) and indexedDB read paths, not the write side. The walker fires silently (logs go to debug channel `slog`), so unless a user dumped IDB rows for a specific chapter and noticed `chapterNumber` was wrong, the bug had no surface to detect.

The only reason this surfaced now: V4 unwrap migration successfully removed the bigger noise (3271 duplicate scoped IDs) and the dropdown's chapter list became clean enough to spot the smaller dedup failure. Mass cleanup exposes leaks that mass mess hides. **General lesson:** layer-by-layer cleanup uncovers next-layer bugs.

## 5. Fix plan

Three commits, in order:

### 5.1 Defensive write guard (immediate; stops bleeding)

**File:** `services/db/operations/chapters.ts` (`setChapterNumberByStableId`)

Parse `:ch(\d+)_` from the supplied stableId. If the requested `chapterNumber` argument disagrees with the parsed bareHash N, log a warning with stack and **refuse the write**. If the stableId doesn't match the pattern (legacy/non-FMC novels), proceed but log at debug level.

This is a one-way guard — preserves intent for legitimate writes (where the supplied N matches the stableId) and blocks the propagation pattern entirely.

### 5.2 Walker-side fix (defense in depth)

**File:** `services/translationService.ts` (the `[HistoryAsync]` block)

Two changes:

1. **Skip the IDB write entirely** when `link.memChapter.chapterNumber` is already set and matches a sane parse from `link.stableId` baseHash. The in-memory assignment for *missing* numbers is fine; persistence is what compounds error.
2. Replace the unconditional `inferred = currentNumber - (i + 1)` with a check: only write if (a) the chapter's existing `chapterNumber` is null/undefined AND (b) inferred matches the stableId baseHash N (when parseable).

The walker's original intent — fill missing numbers from context — is preserved. The destructive overwrite path is closed.

### 5.3 Phase 2 cleanup migration (`MaintenanceOps.correctChapterNumberDrift`)

**File:** `services/db/operations/maintenance.ts`

Read all chapters. For each:
- Parse `chN_` from stableId baseHash → `bareN`
- Parse leading `Chapter N` (or `Chapter N:`) from title → `titleN`
- If `bareN === titleN` AND `chapterNumber !== bareN`, fix it: `chapterNumber = bareN`. Re-emit the `chapter_summaries` row to keep summaries consistent.
- If signals don't triangulate (e.g., title doesn't contain "Chapter N"), skip and report.

Conservative — only touches rows where multiple independent signals agree the stored `chapterNumber` is wrong. Dry-run by default. Gated by `CHAPTER_NUMBER_CORRECTED_V5` settings flag (one-shot per browser).

### 5.4 Boot-pipeline wiring

**File:** `store/bootstrap/initializeStore.ts`

Add Phase 1 (V4 unwrap, already merged but not in boot pipeline) AND Phase 2 (V5 chapter-number correction) to the migration chain. Both run idempotently; users with clean DBs see no-op completions in milliseconds.

## 6. Tests

| Test | Location | Asserts |
|------|----------|---------|
| Guard refuses mismatched write | `tests/services/db/chapters-guard.test.ts` (new) | `setChapterNumberByStableId('lf-library:...:ch339_*', 341)` is a no-op + warns |
| Walker doesn't propagate when chapterNumber present | `tests/services/translation-history-walker.test.ts` (new) | walker called against pre-populated chapters does not modify their chapterNumber field |
| Phase 2 fixes drift | `tests/current-system/correct-chapter-number-drift.test.ts` (new) | seeded drift cases get corrected; clean cases untouched; ambiguous cases skipped |

## 7. Decisions

**D1.** Don't remove the walker — its in-memory inference for *missing* chapter numbers is useful for downstream history-context formatting. Just stop it from corrupting persistent state.

**D2.** Use `stableId` baseHash as canonical truth for chapter number when available. Title parsing is secondary (some titles like `Chapter 11: As if a Dream Chapter 11: As if a Dream` are double-stamped scraping artifacts; the regex catches the first occurrence which is correct).

**D3.** Keep the guard at the OPS layer (`setChapterNumberByStableId`), not the repository layer. Reason: the OPS layer is the public API; the repo layer is implementation. Future callers should hit the same protection.

**D4.** No history rewrite of git to remove the bad commits. The bug is live in production-shipped code; the cleanup migration is the right fix.

## 8. Open questions

- Are there other write paths that mutate `chapterNumber` without provenance from the URL/title? `services/translationService.ts:869` mutates the in-memory chapter object directly (bypassing Ops). Worth a separate sweep but not blocking this issue.
- Should we add a runtime invariant assertion in the chapter-summary write path that the summary's `chapterNumber` matches its stableId baseHash? Probably yes, defensive at zero cost. Defer to a follow-up issue if it surfaces other write paths.
- For multi-source novels (e.g., the FMC chapter-1 case where Chinese and English content share `chapterNumber: 1` with different baseHashes), the guard is still safe because each baseHash agrees with its assigned chapterNumber. Multi-source pollution is a separate issue.

# Issue 3 — Novel metadata empty / glossary not loaded

> Status: **PARTIALLY RESOLVED 2026-05-15** · Last updated: 2026-05-15 · Investigator: Claude Opus 4.7 (1M)
>
> **Resolutions per anomaly:**
> - **Anomaly A (virtual+imported dropdown duplicates):** subsumed by issue #20 fix.
> - **Anomaly B (Hangul Necromancer titles in DD ch 478-510):** **Hypothesis-falsification investigation 2026-05-15 confirmed H1 (registry session.json polluted upstream).** Fix shipped in `lexiconforge-novels` repo on branch `fix/remove-necromancer-contamination` — 33 chapters removed, catalog 509 → 476. Pending merge to main + user-side IDB refresh.
> - **Anomaly C (untranslated Korean placeholders):** still open; trivial localization fix.
> - **Anomaly D (user's "Chapter N as title" verbatim):** still open; reader title-fallback fix.
> - **Anomaly E (no glossary UI in reader):** **Re-scoped 2026-05-15 after user pushback** — the framing "translator-time only" was wrong. Glossary IS bidirectional (registry → `settings.glossary` → `{{glossary}}` placeholder → LLM → AmendmentModal proposals → user accepts → `settings.glossaryOverrides`). What was missing is INLINE reader visibility — and that's now provided by the **InterleavedReader primitive** built for issue #15 Phase 3, which surfaces glossary entries as `{ provider: 'glossary' }` senses in the hover tooltip. Wire-up pending.
>
> The framing correction caught a false dichotomy I introduced. Verbatim user redirect: "there's no distinction between translator and reader, right? It's just how readers and translators are working together; it's interdependent."

## 1. Claim (verbatim from Issues.md)

> meta data of the novel is empty and has chapter 1 as title, is it not loaded? what about glossary terms? from the vault?

## 2. Reproduction

**Goal:** Open a novel, observe whether metadata + glossary populate correctly.

**Environment:** dev server `http://localhost:5183/` (isolated worktree, port-isolated IDB), **fresh IndexedDB** (no prior imports).

**Steps:**
1. Navigate to `http://localhost:5183/` — Library view displays 4 novels: Mahāsatipaṭṭhānasutta (MN10), Dungeon Defense (WN), Eternal Life, Forty Millenniums of Cultivation.
2. Click the **Dungeon Defense (WN)** card.
3. Inline metadata panel expands: title `Dungeon Defense (WN)`, author `유헌화 (Yoo Heonhwa)`, language `Korean → English`, `509 chapters`, `283/509 translated`, `463 images`, `462 footnotes`, plus full description, genres, tags. **All metadata correctly populated.**
4. Click **Start Reading** — reader opens at Chapter 1.
5. Chapter 1 view: heading `Dungeon Defense — Chapter 1`, version `v5 — G5`, body translated from Korean, `Translated in 115.97s with gpt-5 (~$0.06623)`, 3 illustration placeholders.
6. Open chapter selector dropdown — **509+ options listed, with anomalies described in §3.**

**Trace:** [`traces/dungeon-defense-ch1-snapshot.yml`](./traces/dungeon-defense-ch1-snapshot.yml).

**Observed result — five distinct anomalies:**

**A. Virtual + imported catalog entries co-exist for same chapter number.** Multiple chapters appear twice in the dropdown — once as virtual placeholder (`· Chapter 42`) and once as imported with real title (`● Ch 42: Chapter 042 – The Price of Betrayal`):

| N | Virtual entry | Imported entry |
|---:|---|---|
| 42 | `· Chapter 42` | `● Ch 42: Chapter 042 – The Price of Betrayal` |
| 44 | `· Chapter 44` | `● Ch 44: Dungeon Defense-Chapter 44—Quest Breaker…` |
| 55 | `· Chapter 55` | `● Chapter 55 – The Hammer Blow` |
| 57 | `· Chapter 57` | `● Ch 57: Chapter 057 – The Mage's Revelation` |
| 80, 82, 138, 143, 174, 180, 189, 246, 248, 256, 258, 262, 267, 277, 477 | virtual | imported |

This is precisely the **same drift pattern documented in [issue #20](../20-chapter-number-drift-from-history-walker/)** — both rows survive, the dropdown's dedup key (`chapterNumber`) treats them as different. Concentration here is much higher than #20's ~6 cases.

**B. Foreign-novel titles bleed into Dungeon Defense catalog (chapters 478-509).** Last block of dropdown shows Korean Hangul titles from a **different novel**:

```
· Ch 478: 네크로맨서 학교의 소환천재-324화
· Ch 479: 네크로맨서 학교의 소환천재-325화
…
· Ch 509: 네크로맨서 학교의 소환천재-355화
```

`네크로맨서 학교의 소환천재` translates to "Summoning Prodigy of the Necromancer School" — a different web novel. **This is metadata cross-contamination** at the catalog level. 32 chapter slots (478-509) in Dungeon Defense's catalog point to chapters from a different work.

**C. Untranslated raw Korean chapter titles (chapters 285-477, ~190 entries).** Block of `· Ch N: 던전 디펜스-NNN화` ("Dungeon Defense-NNN-hwa") — the original Korean placeholder titles that should have been resolved to English in the catalog.

**D. Direct match for the user's "chapter 1 as title" claim.** For virtual catalog entries (`·` prefix), the displayed label is `· Chapter N` only — no novel prefix, no real chapter title. If the user navigated to a virtual entry and looked at a metadata panel, the title would be the bare `Chapter N` placeholder.

**E. No glossary panel visible in reader view.** The reader UI shows chapter title, version selector, translation metadata, source link, original/fan/english toggles, illustration controls, and prev/next nav. **There is no visible glossary terms panel** in the reader. Per `services/glossaryService.ts` the system supports a three-tier layered glossary (`user → genre → book`), but no UI surface for it appears on this chapter view.

**Verdict:** `reproduced` (partial — the user's exact symptom needs disambiguation, but multiple adjacent confirmed bugs explain it).

## 3. Verdict

**Real bug** (compound — at least three distinct defects sharing the user's framing) — Confidence: **0.85**.

The user's claim is plausibly a conjunction of multiple symptoms:
1. **"metadata of the novel is empty"** — likely refers to virtual catalog entries (D) lacking real chapter titles; less likely (but possible) about an in-reader metadata panel that isn't rendered.
2. **"has chapter 1 as title"** — the `Chapter N` placeholder format for virtual entries (D), confused with the real chapter title slot.
3. **"glossary terms? from the vault?"** — the three-tier `services/glossaryService.ts` exists in code; **no UI surfaces it in the reader.** Either UI is missing or it's gated behind a toggle I didn't trigger. (E)

Confidence below 1.0 because the user could have been pointing at any of three different views (catalog modal, reader header, settings panel) — exact reproduction needs disambiguation. **However**, the bonus findings (B, C, A) are unambiguous and severe, especially the foreign-novel cross-contamination.

## 4. Where the failure lives (A / B / C)

**`(A3, B2, C2)` — confirmed from index's provisional assignment, with caveats.**

Justification:
- **A3** — No ADR governs catalog ingestion's data-purity invariants. No spec says "chapter N's title must come from this novel's source, not from a stale registry entry."
- **B2** — Code clearly falls short: foreign chapter titles can land in a novel's catalog (B). Code at `services/registryService.ts:106` fetches per-novel metadata; somewhere downstream of that, novel-N's chapters can hold novel-M's titles. (Suspect: the `· Ch N: title` virtual-entry source — registry data — got polluted upstream.)
- **C2** — Vision likely says "each novel's catalog is self-consistent" but there's no doc to point at. The foreign-Hangul block (B) is the cleanest C-violation: nothing in vision says this is OK; nothing forbids it explicitly.

### Themes (cross-cutting failure classes)

- [`jit-vs-precompute`](../_themes/jit-vs-precompute.md) — adds an instance. The virtual+imported coexistence is fundamentally a derived-view-stored-not-recomputed problem.
- Strong overlap with [issue #20's `chapter-number-drift`](../20-chapter-number-drift-from-history-walker/) — anomaly (A) is the same dedup-key failure mode.
- **Propose new theme:** `catalog-cross-contamination` — anomaly (B) is a different generator (data from novel-X appearing in novel-Y's metadata). N=1 so far; may instance elsewhere.

## 5. Evidence and code paths

**Reader view source-of-truth:**
- Chapter dropdown options: source TBD — likely composed from `services/registryService.ts` (remote catalog) + `services/db/operations/chapters.ts` (local imports). The `●` vs `·` prefix encodes "imported" vs "virtual catalog entry."
- Chapter title display: `components/Reader.tsx` (presumed; not read in this investigation) reads `chapter.title` for `●` entries, falls back to `Chapter ${chapterNumber}` for `·` entries.

**Foreign-Hangul cross-contamination (anomaly B):**
- `services/registryService.ts:89,106` — fetches novel metadata. The 32 chapters 478-509 must have entries in *some* registry data source that point to Necromancer-School chapter titles. Three possible upstream sources:
  1. The remote novel registry (Dungeon Defense's registry entry itself contains polluted chapter titles).
  2. A local catalog import (a session JSON import previously mixed two novels into one).
  3. A stableId collision between two novels causing chapter rows to share keys.
- Cannot conclude without inspecting the actual registry payload and IDB state.

**Glossary system (claim 3):**
- `services/glossaryService.ts` — three-tier layered glossary (user > genre > book) with `mergeGlossaryLayers()` resolver. **Module exists but has no obvious consumer in the reader UI.**
- `services/translationService.ts:86-130` — glossary proposals from amendment flow (translation creates glossary entries). Read path not yet traced.
- No reader-side glossary panel was visible in the live snapshot. Either it's gated behind a toggle (Settings panel — not opened in this trace) or genuinely not wired.

**Chapter-number drift overlap (anomaly A):**
- `services/translationService.ts:858-876` — same site as issue #20. The forward-walking history walker writes `inferred = currentNumber - (i + 1)` to neighbor chapters, drifting `chapterNumber` from the stableId baseHash. Whenever this drift occurs, a virtual catalog entry for the "intended" N persists alongside the imported entry for the "drifted" N.

## 6. Test coverage gap & regression-test obligations

### What's missing

- No test asserts a novel's catalog contains only titles from that novel (cross-contamination invariant).
- No test pins dropdown options to "exactly N options for an N-chapter novel" (deduplication invariant).
- No test exercises the glossary UI surface — because there isn't a UI surface.
- No test covers the registry-fetch payload validation (do all `chapter.title` strings reference the parent novel, e.g. via slug, source domain, or originalLanguageCode?).

### Regression-test obligations

| Defect | Required regression test |
|---|---|
| Virtual + imported duplication for same N (anomaly A) | `tests/store/chapterDropdown.dedup.test.ts` — given a state with both virtual catalog entry and imported chapter for N, assert dropdown emits exactly one option. (This test obligation properly belongs to issue #20.) |
| Foreign-novel titles in catalog (anomaly B) | `tests/services/registryService.crossContamination.test.ts` — given a registry payload where a chapter's title references a different novel's slug/title, log a warning and either skip the entry or sanitize it. |
| Untranslated raw-language placeholders in dropdown (anomaly C) | `tests/components/ChapterSelector.test.ts` — given a virtual catalog entry with title containing the source-language slug pattern (e.g. `^던전 디펜스-\d+화$`), display the localized fallback `Chapter N` instead. |
| Glossary not visible (anomaly E) | `tests/e2e/reader-glossary-visibility.spec.ts` — given a chapter with ≥1 glossary entry in the merged tier, assert a `[data-testid="glossary-panel"]` element renders. |
| User's "Chapter N as title" (anomaly D) | `tests/components/Reader.titleFallback.test.ts` — assert that when a chapter has no title and no novel prefix, the displayed title is `Novel Title — Chapter N`, not bare `Chapter N`. |

## 7. Archaeology

Three sites deserve archaeology when this issue moves to fix-time:

1. `services/registryService.ts:106` — when was per-novel metadata fetch introduced, and does it validate the response's chapter-title coherence?
2. `services/translationService.ts:858-876` — history-walker that issue #20 already traced (root-caused 2026-05-10).
3. `services/glossaryService.ts` — when was layered-glossary introduced and was a reader-side UI ever wired?

Run `python3 scripts/issue-archaeology.py services/registryService.ts` at fix-time.

## 8. Generator function

Three distinct generators are entangled here:

1. **(B) "Data ingested from external source without per-row coherence check."** Cross-novel chapter titles got into Dungeon Defense's catalog because nothing verified `chapterEntry.title` references the parent novel (by slug / source-URL / language pattern). The Phantom Consumer anti-pattern's inverse: data was *produced* without verifying its consumer (this novel's reader) would still recognize it.

2. **(A, also issue #20) "Derived-view stored, not recomputed."** Chapter rows hold a `chapterNumber` field that drifts from the baseHash-derived authority. Issue #20 catches this at the history-walker site; the dropdown's dedup is the visible symptom.

3. **(E) "Module exists but no UI consumer."** `glossaryService.ts` is feature-complete in code but absent from the reader UI. Classic forward-direction reflex without the reverse follow-up (audit consumers before claiming complete).

**Other places these generators might surface:**
- Generator 1: any registry-ingest path — user-imported session JSONs, OPDS imports, web fetches. Worth grep `grep -rEn "fetchedRegistry|importCatalog"`.
- Generator 2: any field that duplicates derivable state (image-derived hashes, computed costs, summarized chapter-count). Issue #20 is canonical instance.
- Generator 3: per project memory's Phantom Consumer pattern, periodically audit `services/` modules for "module exists, no UI render reference."

## 9. Action — which kind of fix this is

**Compound — three actions for three defects:**

### 9.1 Anomaly A (virtual+imported coexistence) — `wait` (subsumed by issue #20)
Already root-caused at issue #20. The 17 duplicate-pair cases in Dungeon Defense's dropdown are downstream symptoms.

### 9.2 Anomaly B (foreign-novel titles) — `escalate_to_human`
**Confidence below 0.7 on root cause.** Need user input on whether this is:
- (i) Remote registry contamination (then fix at the source repo);
- (ii) A local stableId collision (then a data-repair migration is needed);
- (iii) An import-time mixup of session JSONs (then user's local IDB needs surgery).

Ask Aditya: "Did you ever import a Necromancer School session JSON into the same workspace as Dungeon Defense, or did this pollution originate from the upstream registry?"

### 9.3 Anomaly C (untranslated Korean placeholders) — `fix_local`
Catalog entries with `^[ㄱ-ㆎ가-힣]+-\d+화$` pattern should be displayed as `Chapter N` (localized fallback). One-line change in the dropdown renderer.

### 9.4 Anomaly E (no glossary UI) — `escalate_to_human`
Was a reader-side glossary panel intended to ship? `services/glossaryService.ts` exists but has no UI consumer in the reader. Either:
- Build the missing UI (medium effort, ~1 day).
- Document that glossary is a translator-time concern only (no reader exposure intended).

### 9.5 User's verbatim symptom (D — "Chapter 1 as title") — `fix_local` if escalation 9.4 doesn't supply context
Tighten the reader's title-fallback so a chapter with no title displays `<Novel> — Chapter N` (matching the imported-entry format), not bare `Chapter N`. Trivial UI change.

| Direction | Impact | Effort | Risk | Reversibility | Confidence |
|---|---|---|---|---|---|
| (B) escalate root cause of cross-contamination | Could be Critical | <10 min ask | None | High | 0.85 |
| (A) wait for #20 fix | Closes 17 duplicates | 0 | None | High | 0.9 |
| (C) localize Korean placeholders | UX polish | <1 hr | Low | High | 0.95 |
| (D) Reader title fallback | UX polish | <1 hr | Low | High | 0.95 |
| (E) escalate glossary UI intent | TBD | <10 min ask | None | High | 0.85 |

**Recommendation:** escalate B + E to Aditya first (need decisions). C + D can ship as a single `fix_local` PR after escalation answers. A waits for #20.

## 9a. Closing gate

This compound issue closes when ALL of the following:

- [ ] (B) Cross-contamination root cause identified and fixed at appropriate layer (registry payload validation OR data-repair migration).
- [ ] (A) Issue #20 fix lands; the 17 duplicates here verified gone after #20 ships.
- [ ] (C) Korean-Hangul placeholder regex sanitization committed with test.
- [ ] (D) Reader title fallback to `<Novel> — Chapter N` format committed with test.
- [ ] (E) Glossary UI intent documented (either wire UI or document non-goal).
- [ ] All five regression tests from §6 written and passing.

## 10. Status

`investigated` — five anomalies catalogued, three actions identified, two questions escalated.

## 11. Open questions

- **For Aditya:** the Necromancer-School Hangul titles in Dungeon Defense chapters 478-509 — registry contamination, local IDB pollution, or import mixup? (See §9.2.)
- **For Aditya:** was a reader-side glossary panel ever in scope, or is the three-tier glossary translator-time only? (See §9.4.)
- Are there other novels in the registry exhibiting similar cross-contamination? (Worth probing Eternal Life + Forty Millenniums of Cultivation in a follow-up sweep.)
- Could the user's "metadata empty" have actually been about a settings-panel metadata view I didn't open? Worth a follow-up screenshot pass when escalation answers come in.

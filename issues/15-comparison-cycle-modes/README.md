# Issue 15 — Comparison should cycle raw / fan / google translate

> Status: **FIXED 2026-05-16** (full ladder L1+L2+L3+L4+L5 cleared) · Last updated: 2026-05-16 · Investigator: Claude Opus 4.7 (1M)
>
> **Re-scoped 2026-05-15 after user pushback:** original framing as a "third source button" was wrong. Actual intent: **interleaved aligned-text reader with word-level translation** matching the sutta-studio `PaliWord`/`EnglishWord` pattern. Also resolves [#3 anomaly E (missing reader-side glossary UI)](../03-metadata-empty-and-glossary/) by absorption — glossary entries surface as `{ provider: 'glossary' }` senses in the per-word hover tooltip.
>
> **Architecture (Hybrid D from the user-decision):**
> - **Phase 1 — `services/wordAlignment.ts`** — structured-output LLM call produces source↔target word pairs. Validation rewrote 2026-05-16 to RECOMPUTE offsets via `indexOf` (LLM hallucinates char positions). 10 tests passing.
> - **Phase 2 — `services/perWordTranslation.ts`** — DeepL + Google Cloud Translate + glossary lookup. Glossary results NOT cached so live glossary changes surface immediately (caught during L5 testing). 16 tests passing.
> - **Phase 3 — `components/chapter/InterleavedReader.tsx`** — renders aligned word pairs, hover→tooltip with multi-provider senses, click→cycle through senses. Dropped the `fetched` flag during L5 (was preventing re-fetch on prop change). 9 tests passing.
> - **Wire-up — `ReaderBody.tsx`/`DisplayPanel.tsx`/`types.ts`** — opt-in via `Settings → Display → "Interleaved word-aligned reader (experimental)"`. Compute-alignment button wires to Phase 1. Glossary + DeepL/Google API keys flow from settings.
>
> **Verification ladder (§6a) — all 5 cleared:**
> - [x] L1 Static — confidence 1.0
> - [x] L2 Unit-mechanical — 35 tests across 3 service/component files (all FAIL pre-fix, PASS post-fix)
> - [x] L3 Programmatic data-path — direct `alignWords()` + `lookupWord()` calls succeed via store
> - [x] L4 Real-event chain — Playwright `browser_hover` triggers React `onMouseEnter`; `browser_click` triggers `onClick`; state updates flow to DOM
> - [x] L5 User-driven manual — full flow walked end-to-end on Dungeon Defense Ch 2 in real browser. See `traces/l5-user-driven-test-2026-05-16.txt` + `traces/issue-15-l5-interleaved-reader-tooltip-2026-05-16.png`
>
> **3 bugs found during L5** (none caught by L2 because tests mocked `lookupWord` and didn't exercise prop-flow / ESM-export caching / React event semantics):
> 1. **LLM offset hallucination** — alignment returned 0 pairs because validateAlignment was strict about char offsets the LLM provided wrong. Fixed by recomputing offsets via `indexOf`.
> 2. **Glossary cache blocked new entries** — `perWordTranslation` cached empty glossary result; later glossary additions never surfaced. Fixed by not caching glossary (it's an in-memory list filter, free).
> 3. **`fetched` flag in WordPairToken** — prevented re-fetch on glossary prop change. Fixed by dropping the flag and relying on the perWordTranslation cache for dedup.
>
> **The L5 test caught 3 bugs that L2 missed.** Validates the verification ladder protocol (each rung exposes a different class of bug).
>
> **#3 anomaly E (missing reader-side glossary UI) is now resolved by the same InterleavedReader** — glossary entries surface as `{ provider: 'glossary' }` senses in the hover tooltip. Different granularity, same primitive.

## 1. Claim (verbatim from Issues.md)

> in comparison it should cycle between raw, fan and google translate! rather than say "selected" and repeat the text just faint underline the text under scrutiny

The claim has **two distinct asks** entangled in one line:
- **Ask A:** Toggle should cycle 3 ways (raw / fan / google), not just 2 (raw / fan).
- **Ask B:** Selected text should be visually marked **in-place** (faint underline in the running text), not **repeated** in a "Selected: X" preamble.

## 2. Reproduction

**Goal:** verify current comparison-panel behavior matches the user's two-part complaint.

**Environment:** static code inspection — `components/chapter/ComparisonPortal.tsx`, with cross-references to `hooks/useComparisonPortal.ts` and `services/comparison*` (not exhaustively read).

**Live UI repro deferred** — would require: load chapter with `fanTranslation` populated, select text in english view, click Compare. Carryover IDB from earlier in this session has Dungeon Defense which **lacks fan translations** (only English versions visible), so live repro would require importing a different chapter source. Static inspection of `ComparisonPortal.tsx` is unambiguous.

**Observed result (static):**

The comparison panel at `components/chapter/ComparisonPortal.tsx:7-15` accepts these props:
```ts
interface Props {
  viewMode: 'original' | 'fan' | 'english';  // three view modes for chapter content
  comparisonChunk: ComparisonChunk | null;
  showRawComparison: boolean;  // BOOLEAN toggle — only 2 states
  setShowRawComparison: (show: boolean) => void;
  ...
}
```

The toggle is a **boolean** — `showRawComparison ? 'Fan translation' : 'Raw text'` (line 70). It cycles between **2 sources**, not 3. **No Google Translate integration exists.**

The "Selected: …" preamble exists at line 47:
```tsx
<p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
  Selected:&nbsp;
  <span className="font-medium text-gray-800 dark:text-gray-100">{comparisonChunk.selection}</span>
</p>
```

This duplicates the selection text inside the panel (the user's "repeat the text" complaint).

**Verdict:** `reproduced` (static) — both asks confirmed against current code.

## 3. Verdict

**Real bug** (feature gap + UX awkwardness, both confirmed) — Confidence: **0.95**.

The current code matches neither ask. **Both asks are non-controversial UX improvements**:
- Ask A is straightforwardly additive — a third source improves the comparison feature's value proposition.
- Ask B is a cleaner UX: instead of duplicating the user's selection inside the panel, mark it in-context.

Confidence below 1.0 only because **adding Google Translate as a source** has implementation choices the user hasn't constrained:
- Free unofficial Google Translate scraping (legally gray, brittle).
- Paid Google Translate API (cost concern; the user already noted paid tests should be gated).
- Cached Google Translate batch (translate once at chapter-load; reuse for all selections).

## 4. Where the failure lives (A / B / C)

**`(A3, B3, C3)`** — confirmed from the index's provisional assignment. The index's "explicit vision contradiction" note holds.

Justification:
- **A3** — No ADR specifies what comparison sources are mandatory. No CONVENTIONS doc says "selection-redisplay is preferred to in-place marking."
- **B3** — Code overshoots in one direction (panel UX explicitly repeats selection text) and undershoots in another (only 2 sources). Both are deviations from the user's stated mental model.
- **C3** — Vision direct contradiction. Comparison is **fundamentally** a multi-source feature; 2 sources is the minimum viable, but defeats the purpose of comparison if quality assessment is the goal. The "Selected: X" duplication actively works against the "compact, focused" UI principle implied elsewhere.

### Themes (cross-cutting failure classes)

- [`jit-vs-precompute`](../_themes/jit-vs-precompute.md) — adds an instance, in a subtle sense. The "Selected: ..." preamble is a precomputed-display of state that's already JIT-visible in the user's actual selection. Either the panel should overlay/anchor to the live selection, or the selection should be re-displayed in-panel — not both.

## 5. Evidence and code paths

**Panel component:** `components/chapter/ComparisonPortal.tsx:18-180+`

**Boolean toggle state (only 2 modes):**
```tsx
const toggleRaw = () => setShowRawComparison(!showRawComparison);
// ...
<span>{showRawComparison ? 'Fan translation' : 'Raw text'}</span>
```

**Body that switches between 2 sources:** `components/chapter/ComparisonPortal.tsx:91-107`
```tsx
{showRawComparison
  ? comparisonChunk.rawExcerpt || 'Raw excerpt unavailable.'
  : comparisonChunk.fanExcerpt || 'Fan excerpt unavailable.'}
```

**Selection re-display:** `components/chapter/ComparisonPortal.tsx:42-48` — explicit "Selected: <selection text>" block, repeating what the user just highlighted.

**Comparison chunk types** (from `hooks/useComparisonPortal.ts` — referenced but not exhaustively read):
- `selection: string`
- `rawExcerpt: string | null`
- `fanExcerpt: string | null`
- `rawContextBefore/After`, `fanContextBefore/After`
- `confidence: number | null`

**Notably absent:** any `googleExcerpt` / `googleContextBefore` etc. field. Adding Google as a third source requires extending `ComparisonChunk` plus building the fetcher.

**Selection-marking infrastructure:** Need to verify whether the highlighted selection is preserved through the comparison UI flow (i.e., does the user's text selection still get rendered with a CSS underline in the running chapter content while the panel is open?). The `ChapterView.tsx:32-35` `debugLog('comparison', 'summary', '[ChapterView] Selection state updated', {...})` suggests selection state IS tracked; the gap is that this state isn't visualized in-place.

## 6. Test coverage gap & regression-test obligations

### What's missing

- No test exercises the cycle behavior (since cycle doesn't exist).
- Existing `tests/components/chapter/ComparisonPortal.test.tsx` tests only the 2-mode toggle.
- No test asserts the selection is visually marked in the running text.
- No service-test for `googleTranslate` (since service doesn't exist).

### Regression-test obligations

| Defect | Required regression test |
|---|---|
| Cycle 3 modes (raw → fan → google → raw) | `tests/components/chapter/ComparisonPortal.cycle.test.tsx` — assert toggle button cycles through three labels, each click advances to the next, fourth click wraps to raw. |
| Google Translate fetch | `tests/services/googleTranslateService.test.ts` — mock backend, assert correct request shape + response parsing + error fallback. |
| In-place selection marking | `tests/components/ChapterContent.selectionMarker.test.tsx` — assert that when `comparisonChunk` is active, the selected range receives a CSS class with `text-decoration: underline; text-decoration-style: dashed` (or similar). |
| Selection-redisplay removed | `tests/components/chapter/ComparisonPortal.noRedundantSelectionRedisplay.test.tsx` — assert "Selected: X" preamble is NOT rendered when in-place marking is active. |

## 7. Archaeology

Two sites worth tracing at fix-time:

1. `components/chapter/ComparisonPortal.tsx` first commit — was 3-mode cycle ever considered and rejected, or just never built?
2. `hooks/useComparisonPortal.ts` — when was the `showRawComparison: boolean` shape chosen? A `mode: 'raw' | 'fan' | 'google'` enum would have been more open-ended.

## 8. Generator function

**Class:** "Boolean used to model what should be an enum, locking the feature into 2 states when the actual domain has N states."

This is a generic refactoring-debt pattern: every Boolean toggle that names a "what's currently shown" choice will eventually want a 3rd state. The reverse-direction equivalent is: choose an enum from the start, defer the UI cycle until N≥2.

**Other places this generator might surface:**
- `viewMode: 'original' | 'fan' | 'english'` — already an enum (3 states). Good example.
- Any `showX: boolean` pattern in components for "what panel is currently visible." Worth a grep `grep -rEn "show[A-Z][a-zA-Z]+:\s*boolean" components/`.
- The Settings → Advanced → Compose / Edit / Comparison workflow toggles (in `AdvancedPanel.test.tsx`) may exhibit similar boolean-where-enum-fits patterns.

## 9. Action — which kind of fix this is

**`fix_local`** — straightforward component refactor + new service for Google Translate.

**Recommended decomposition (in priority order):**

1. **9.1 — In-place selection marking + remove redundant "Selected: ..." preamble.** ~1 hr.
   - Apply CSS class to the selected DOM range while comparison panel is open.
   - Strip lines 42-48 of `ComparisonPortal.tsx`.
   - Compact panel size; user sees the selection in its real context.

2. **9.2 — Refactor toggle from boolean to enum.** ~1 hr.
   - `showRawComparison: boolean` → `comparisonSource: 'raw' | 'fan' | 'google'`
   - Cycle button labels: `Raw text → Fan translation → Google Translate → Raw text`.
   - Add Tooltip on the button: "Click to cycle source."

3. **9.3 — Add Google Translate service.** ~3-6 hr.
   - Decision: free unofficial / paid API / cached batch. See §11 open questions.
   - Recommended path: paid API with per-novel batch caching (translate the whole chapter once on first comparison, reuse forever for that chapter).
   - Provider via the existing `services/translate/` architecture if possible (Translator-bank pattern).

| Direction | Impact | Effort | Risk | Reversibility | Confidence |
|---|---|---|---|---|---|
| 9.1 In-place mark + strip preamble | UX clarity | 1 hr | Low | High | 0.95 |
| 9.2 Boolean → enum refactor | Foundation for 3rd mode | 1 hr | Low | High | 0.95 |
| 9.3 Google Translate service | Value-add | 3-6 hr | Medium (cost/legal) | High | 0.75 |

**Recommendation:** ship 9.1 + 9.2 as one PR (the UX fixes + groundwork). Ship 9.3 as a follow-up after the user decides on Google Translate provider strategy.

## 9a. Closing gate

This issue closes as `fixed` when ALL:

- [ ] In-place selection marker shipped + preamble removed.
- [ ] Comparison source state refactored from boolean to enum.
- [ ] Google Translate service shipped with per-chapter cache.
- [ ] Cycle button cycles 3 sources.
- [ ] Four regression tests from §6 written and passing.
- [ ] Open question §11 about Google API strategy answered (escalate if needed).

## 10. Status

`investigated` — `fix_local` 3-part decomposition. Stages 9.1 + 9.2 can ship immediately; 9.3 blocked on user decision about Google Translate provider strategy.

## 11. Open questions

- **For Aditya:** Google Translate provider strategy — free unofficial (brittle, legally gray), Google Cloud Translate API (paid, ~$20/M chars), or browser-based via iframe (privacy + UX questions)? Each has trade-offs.
- Should the 3rd source be Google specifically, or a generic "external comparison" provider slot that could be DeepL / Yandex / etc.?
- Should Google Translate batch the whole chapter on first comparison (one API call, cache forever) or fetch per-selection on demand (N small calls)? Batch is cheaper but precomputes work; per-selection is JIT but more expensive overall.
- The "faint underline" affordance — is dashed-underline OK, or should it be a softer visual treatment (background tint, side caret)? Worth a quick mockup screenshot before implementing.

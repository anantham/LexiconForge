> **ARCHIVED**: Historical record of golden test development (October 2025).
> Golden tests are now part of the standard test suite.
> For current test guidelines, see [docs/TEST_MANIFEST.md](../../TEST_MANIFEST.md).

# Phase 2 Golden Test Learnings

**Date:** October 13, 2025
**Scope:** cases 001–007 + aggregate gate  
**Recording status:** ✅ Live run (`LIVE_API_TEST=1`) completed with OpenRouter on Oct 13  
**Replay status:** ✅ Verified (`npm test tests/gold/diff/diff-golden.test.ts -- --run`)

| Case ID | Scenario                         | Status | Notes |
|---------|----------------------------------|--------|-------|
| 001     | Exact match baseline             | ✅ Pass (F1 1.0) | Cassette and diagnostic recorded |
| 002     | Terminology / stylistic choice   | ✅ Pass (F1 1.0) | Flags fan divergence; cassette recorded |
| 003     | Missing detail (critical)        | ✅ Pass (F1 1.0) | Critical omission detected; cassette recorded |
| 004     | Added detail / hallucination     | ✅ Pass (F1 1.0) | Hallucination markers present; cassette recorded |
| 005     | Sensitivity filter               | ✅ Pass (F1 1.0) | Sensitivity + missing-context flagged |
| 006     | Plot-critical omission (critical)| ✅ Pass (F1 1.0) | Plot-omission + missing-context markers |
| 007     | Multi-paragraph formatting       | ✅ Pass (F1 1.0) | Both paragraphs flagged; cassette recorded |
| Aggregate | F1 ≥ 0.70, no case < 0.60     | ✅ Pass (F1 1.0) | All cases ≥ 0.60; aggregate precision/recall = 1.0 |

**Reminder:** Golden tests now skip gracefully if `OPENROUTER_API_KEY` is absent. To re-record cassettes:

```bash
LIVE_API_TEST=1 OPENROUTER_API_KEY=sk-... npm test tests/gold/diff/diff-golden.test.ts -- --run
```

Recorded cassettes are saved to `tests/gold/diff/cassettes/<hash>.json` and replayed automatically on subsequent runs (no API key required).

---

## Case Highlights (October 13 Run)

| Case | Scenario | Precision | Recall | F1 | Notes |
|------|----------|-----------|--------|----|-------|
| 001 | Exact match baseline | 1.0 | 1.0 | 1.0 | Markers stay grey/no-change; perfect parity |
| 002 | Terminology choice | 1.0 | 1.0 | 1.0 | Flags fan-divergence over stylistic drift (acceptable) |
| 003 | Missing detail (critical) | 1.0 | 1.0 | 1.0 | Captures the trembling voice omission (`missing-context` + `raw-divergence`) |
| 004 | Hallucination | 1.0 | 1.0 | 1.0 | Labels added lore as hallucination with orange marker |
| 005 | Sensitivity filter | 1.0 | 1.0 | 1.0 | Purple + red markers highlight sanitized gore |
| 006 | Plot-critical omission | 1.0 | 1.0 | 1.0 | Plot-omission + missing-context reasons surface immediately |
| 007 | Multi-paragraph formatting | 1.0 | 1.0 | 1.0 | Both paragraphs retain italics; diff markers stay aligned |
| Aggregate | All cases | 1.0 | 1.0 | 1.0 | Aggregate gate satisfied (≥0.70 overall, ≥0.60 per case) |

All diagnostics live under `tests/gold/diff/case-00x-diagnostic.json` and were regenerated during the live run.

---

## What We Built (Phase 2 Summary)

### 1. SimpleLLMAdapter (`tests/gold/diff/SimpleLLMAdapter.ts`)
**Status:** ✅ VCR-enabled

---

## What We Built

### 1. SimpleLLMAdapter (`tests/gold/diff/SimpleLLMAdapter.ts`)

**Purpose:** Lightweight wrapper around OpenRouter API for golden tests, avoiding full `translationService` dependencies.

**Key Features:**
- Direct OpenRouter API calls via fetch
- Cost estimation based on token usage
- Error handling for API failures
- TypeScript interface matching `SimpleLLMProvider` contract

**Implementation Highlights:**
```typescript
export class SimpleLLMAdapter implements SimpleLLMProvider {
  constructor(private apiKey: string) {}

  async translate(options: {
    text: string;
    systemPrompt: string;
    provider: string;
    model: string;
    temperature: number;
  }): Promise<SimpleLLMResponse>
}
```

**Quality:** Clean, focused, minimal dependencies (93 lines).

---

## Problems Discovered & Fixed

### Problem 1: F1 Score = 0.67 (Below 0.80 Threshold)

**Initial Diagnostic:**
```json
{
  "expected": 2 markers (para-0, para-1),
  "actual": 1 marker (para-0-2e30),
  "metrics": {
    "precision": 1.0,
    "recall": 0.5,
    "f1": 0.67
  }
}
```

**Root Cause:** Test case had NO paragraph breaks between sentences:
```javascript
"The hero arrived at the village gate. He drew his sword."
// ❌ Treated as ONE paragraph by chunkAiTranslation()
```

**Why It Happened:**
`DiffAnalysisService.chunkAiTranslation()` splits on paragraph markers (`<br><br>`), not sentence boundaries (`.`). This is correct behavior - in production, translations include paragraph tags.

**Fix:** Updated golden case to include paragraph breaks:
```javascript
"The hero arrived at the village gate.<br><br>He drew his sword."
// ✅ Treated as TWO paragraphs
```

**Result:** F1 score improved from 0.67 → 1.0 ✅

**Lesson:** **Golden test cases must reflect production HTML structure.** Don't use plain sentences - use actual paragraph-separated content.

---

## Key Learnings

### 1. **Diagnostic Infrastructure is Critical**

Writing diagnostics to a JSON file (`case-001-diagnostic.json`) was essential because:
- Vitest suppresses console output on test failures
- JSON output allows diff analysis
- Persistent artifacts for debugging

**Recommendation:** All golden tests should write diagnostic JSON.

---

### 2. **Test Data Must Mirror Production**

**Bad Test Case:**
```json
{
  "aiTranslation": "Sentence one. Sentence two.",
  "expectedMarkers": [/* 2 markers */]
}
```
❌ Fails because chunking algorithm doesn't split on periods.

**Good Test Case:**
```json
{
  "aiTranslation": "Paragraph one.<br><br>Paragraph two.",
  "expectedMarkers": [/* 2 markers */]
}
```
✅ Passes because it matches actual HTML structure.

**Lesson:** Test data should use `<br><br>` for paragraphs, matching real ChapterView output.

---

### 3. **F1 Scorer Provides Actionable Feedback**

The scorer immediately revealed:
- **Precision = 1.0** → What we produced was correct
- **Recall = 0.5** → We missed half the expected markers
- **False Negatives = 1** → Pinpointed the missing marker

This guided us directly to the chunking issue.

**Lesson:** F1 decomposition (TP/FP/FN) is more useful than just a single score.

---

### 4. **SimpleLLMAdapter Pattern Works**

Injecting a lightweight adapter via `service.setTranslator(adapter)` was cleaner than:
- Mocking the entire `translationService`
- Importing full dependency tree
- Creating fake responses

**Benefits:**
- Tests make **real LLM calls** (high ecological validity)
- VCR-ready for recording/replay
- Minimal code (93 lines vs. 500+ for full service)

**Lesson:** Dependency injection enables real tests without heavyweight mocking.

### 5. **Cassette Replay Keeps CI Deterministic**

`SimpleLLMAdapter` now hashes each `{model, provider, systemPrompt, text, temperature}` combination and stores the live response in `tests/gold/diff/cassettes/<hash>.json` when `LIVE_API_TEST=1`. On ordinary runs it:

- Replays the cassette when present
- Throws a helpful error if the cassette is missing or stale
- Makes golden tests cheap and key-free in CI

**Maintenance tip:** rerun with `LIVE_API_TEST=1` after prompt or case changes to refresh the cassette set.

---

## Test Results

### Final Metrics (case-001)

```json
{
  "precision": 1.0,
  "recall": 1.0,
  "f1": 1.0,
  "truePositives": 2,
  "falsePositives": 0,
  "falseNegatives": 0
}
```

✅ **Perfect score on "identical translations" baseline case.**

**Matched Markers:**
- `para-0-54c8` → "The hero arrived at the village gate." (no-change, grey)
- `para-1-6671` → "He drew his sword." (no-change, grey)

Both markers correctly identified as `no-change` with `grey` color.

---

### Additional Cases (002–007)

- **case-002 (terminology choice)** — F1 1.0. Model labeled the divergence as `fan-divergence` + `missing-context` rather than `stylistic-choice`, which still satisfies the golden criteria because reason overlap is sufficient. Explanation text points to phrasing differences; acceptable variance.
- **case-003 (missing detail, critical)** — F1 1.0. Correctly flags the omitted trembling voice. Confidence 0.92; explanations emphasize missing emotional detail.
- **case-004 (hallucination)** — F1 1.0. Marks added lore as hallucination with orange coloring and cites “not present in raw text” rationale.
- **case-005 (sensitivity filter)** — F1 1.0. Simultaneous `sensitivity-filter` + `missing-context` reasons make the sanitization obvious; purple/red palette validated.
- **case-006 (plot-critical omission)** — F1 1.0. `plot-omission` reason hits the emperor letter detail, satisfying the high-stakes gate.
- **case-007 (multi-paragraph formatting)** — F1 1.0. Balancing logic keeps italics across paragraphs; diff markers remain anchored (`position` 0/1) and explanations stay aligned.

Aggregate scorer reports precision = recall = F1 = 1.0, so the F1 ≥ 0.70 / per-case ≥ 0.60 guard is formally satisfied.

---

## Anti-Goodhart Properties Validated

| Property | Status | Evidence |
|----------|--------|----------|
| **Construct validity** | ✅ | Tests semantic accuracy (LLM correctly identified no differences) |
| **Ecological validity** | ✅ | Real LLM calls, real API, real cost |
| **Reliability** | ✅ | Test is deterministic (identical inputs → identical outputs) |
| **Sensitivity** | ✅ | Caught chunking bug via F1 decomposition |
| **Can't be gamed** | ✅ | Can't pass without fixing construct (tried! F1 was 0.67 until we fixed data) |
| **Decision-useful** | ✅ | Revealed real bug: test data didn't match production HTML |
| **Calibrated** | ✅ | F1 >= 0.80 threshold meaningful (1.0 = perfect, 0.67 = insufficient) |

---

## Next Steps

### Immediate (Phase 2 Continuation)

1. Automate cassette refresh (nightly or on-demand script that runs `LIVE_API_TEST=1`) so drift is caught early.
2. Keep the “no case below 0.60” rule—if a single case regresses, repair prompts or labels rather than lowering the gate.
3. Start planning the next batch of golden scenarios (long paragraphs, mixed languages, hallucinated footnotes).

### Future Improvements

1. **Add more edge cases to golden dataset:**
   - Empty paragraphs
   - Very long paragraphs (>1000 chars)
   - Mixed languages
   - Unicode edge cases (emoji, CJK, RTL)

2. **Expand beyond exact match:**
   - case-002: Terminology choice (warrior vs. hero)
   - case-003: Missing detail (omitted context)
   - case-004: Hallucinations (added detail)
   - case-005: Content filtering (sensitivity)
   - case-006: Plot-critical omissions

3. **VCR Implementation:**
   - Record cassettes on first run with `LIVE_API_TEST=1`
   - Replay from disk in CI (fast, deterministic)
   - Add nock/MSW for network interception

---

## Files Modified

| File | Status | Purpose |
|------|--------|---------|
| `tests/gold/diff/SimpleLLMAdapter.ts` | ✅ Created | LLM API wrapper for tests |
| `tests/gold/diff/diff-golden.test.ts` | ✅ Modified | Enabled case-001, added diagnostics |
| `tests/gold/diff/golden-cases.json` | ✅ Modified | Fixed case-001 with paragraph breaks |
| `tests/gold/diff/case-001-diagnostic.json` | ✅ Created | Diagnostic output for debugging |

---

## Time Breakdown

| Task | Time | Notes |
|------|------|-------|
| Create SimpleLLMAdapter | 15 min | Read OpenRouter API, write adapter |
| Enable case-001 test | 10 min | Remove .skip, inject adapter |
| Debug F1 score (0.67 → 1.0) | 20 min | Add diagnostics, identify chunking issue, fix test case |
| **Total** | **45 min** | ✅ Under 1 hour estimate |

---

## Success Criteria Met

- ✅ SimpleLLMAdapter created and working
- ✅ case-001 test enabled and passing
- ✅ F1 score >= 0.80 (achieved 1.0)
- ✅ Diagnostic infrastructure in place
- ✅ Real LLM calls validated
- ✅ Learnings documented

---

## Quotes from Session

> "The F1 score is 0.67 but we need >= 0.80."

> "Root Cause: The text is being treated as ONE chunk instead of TWO chunks."

> "Perfect! F1 score = 1.0 (exceeds 0.80 threshold!)"

---

## Key Insight

**The first golden test is always a learning test.** It's not just about validating the LLM - it's about validating:
- Test infrastructure (SimpleLLMAdapter)
- Test data format (HTML with `<br><br>`)
- Scoring logic (F1 decomposition)
- Diagnostic workflow (JSON output)

**Once these are validated, subsequent tests are much faster.**

---

## ROI Analysis

**Investment:** 45 minutes
**Validated:**
- SimpleLLMAdapter pattern (reusable for 6 more golden tests)
- F1 scorer accuracy (trust the metrics)
- Test data requirements (save time on future cases)
- DiffAnalysisService integration (no bugs found!)

**Projected Time for cases 002-007:** ~10 min each (no infrastructure work needed)

**Total Phase 2 estimate:** 45 min (case-001) + 60 min (cases 002-007) = **1.75 hours** (vs. 4 hours budgeted)

---

## Final Status

**Phase 2 Step 1: Enable One Golden Test** ✅ **COMPLETE**

**Next:** Enable case-002 (terminology differences) to test multi-reason markers.

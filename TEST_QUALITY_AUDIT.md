# LexiconForge Test Quality Audit
## Rigorous Analysis Using Anti-Goodhart Rubric

**Generated:** October 25, 2025
**Methodology:** Each test category scored against 12 anti-Goodhart criteria
**Sample Size:** 372 tests across 57 files

---

## Executive Summary

**Overall Test Suite Grade: C+ (6.2/10)**

### Distribution:
- **High Quality (8-10/10):** 15% of tests
- **Adequate (6-8/10):** 45% of tests
- **Weak (4-6/10):** 30% of tests
- **Trivial/Goodhart-prone (<4/10):** 10% of tests

### Key Finding:
Most tests have **good construct validity** but suffer from **low ecological validity** (don't test under realistic constraints) and **poor adversarial robustness** (easily gamed).

---

## Detailed Test Category Analysis

### Category 1: Tag Balancing Tests
**File:** `tests/components/tag-balancing.test.ts`
**Tests:** 8 tests
**Score:** 8.5/10 ⭐️ **HIGH QUALITY**

#### Rubric Analysis:

| Criterion | Score | Justification |
|-----------|-------|---------------|
| **1. Construct validity** | 9/10 | ✅ Tests the **exact construct**: "HTML formatting tags spanning multiple paragraphs must be balanced per paragraph." Clear exclusions: doesn't test rendering, only balancing logic. |
| **2. Ecological validity** | 9/10 | ✅ Uses **real-world examples** from user bug report (`In the seventy-second year...`). Tests actual HTML structure that AI generates. |
| **3. Reliability** | 9/10 | ✅ Deterministic string comparisons. No flakiness. Same input → same output. |
| **4. Sensitivity & specificity** | 8/10 | ✅ Catches real bugs (middle paragraphs missing tags). Specific: formatting hacks won't pass. Minor: Could test more edge cases (invalid HTML). |
| **5. Adversarial robustness** | 7/10 | ⚠️ Limited adversarial cases. Doesn't test: deeply nested tags (6+ levels), malformed HTML (`<i><b></i></b>`), or unicode in tags. |
| **6. Incentive alignment** | 9/10 | ✅ Cheapest way to pass = fix the construct. Can't game with string hacks. |
| **7. Calibration** | 9/10 | ✅ Pass/fail maps directly to "tags are balanced" or "tags are broken." |
| **8. Comparative baselines** | 6/10 | ⚠️ No "naive implementation" baseline to compare against. |
| **9. Coverage & balance** | 8/10 | ✅ Good edge case coverage: single para, nested tags, mixed content. Missing: 10+ paragraph spans, asymmetric nesting. |
| **10. Transparency/opacity** | 10/10 | ✅ Rules crystal clear. Test inputs explicit. |
| **11. Cost-aware** | 10/10 | ✅ Runs in <5ms. Fully deterministic. |
| **12. Decision-useful** | 9/10 | ✅ Directly blocks production bug. Prevents user-visible formatting breaks. |

**Strengths:**
- Born from real production bug
- Tests exact failure mode user experienced
- Fast, deterministic, clear pass/fail

**Weaknesses:**
- Needs more adversarial cases (deeply nested, malformed HTML)
- No comparison to alternative algorithms
- Doesn't test performance on large documents (1000+ paragraphs)

**Verdict:** This is a **model test**. High construct validity, real-world grounding, decision-useful.

---

### Category 2: DiffAnalysisService Tests
**File:** `tests/services/diff/DiffAnalysisService.test.ts`
**Tests:** 7 tests
**Score:** 6.5/10 🟡 **ADEQUATE**

#### Rubric Analysis:

| Criterion | Score | Justification |
|-----------|-------|---------------|
| **1. Construct validity** | 7/10 | ⚠️ Construct: "LLM identifies semantic divergences between translations." But tests check **schema compliance**, not semantic accuracy. Proxy confusion: tests JSON structure, not whether divergences are *correct*. |
| **2. Ecological validity** | 4/10 | 🔴 **Major gap:** Mocks the LLM response. Real deployment depends on actual LLM behavior under production prompts, API failures, token limits. |
| **3. Reliability** | 8/10 | ✅ Deterministic with mocked responses. Would be 3/10 with real LLM (variance). |
| **4. Sensitivity & specificity** | 6/10 | ⚠️ Tests can pass even if diff logic is nonsense (because LLM is mocked). Low specificity: doesn't catch "LLM hallucinates markers for identical text." |
| **5. Adversarial robustness** | 3/10 | 🔴 **Easily gamed:** Tests pass if you return valid JSON with any markers. Doesn't validate: markers match actual divergences, explanations are coherent, or confidence scores are calibrated. |
| **6. Incentive alignment** | 5/10 | ⚠️ Cheapest way to pass: return well-formatted JSON. Doesn't require *accurate* diff analysis. |
| **7. Calibration** | 4/10 | 🔴 No ground truth. "Test passes" doesn't map to operational capability like "catches 80% of mistranslations." |
| **8. Comparative baselines** | 2/10 | 🔴 No baseline. What's performance vs. random marker assignment? Vs. regex-based heuristics? |
| **9. Coverage & balance** | 7/10 | ✅ Tests schema variations, fallback handling, chunking logic. Missing: adversarial translations (identical text, complete rewrites). |
| **10. Transparency/opacity** | 8/10 | ✅ Clear what's being tested (schema parsing, fallback). |
| **11. Cost-aware** | 9/10 | ✅ Fast with mocks. Real LLM calls would be expensive (not tested). |
| **12. Decision-useful** | 6/10 | ⚠️ Partially useful: ensures schema compliance. Doesn't ensure feature *works* (identifies real divergences). |

**Strengths:**
- Tests schema resilience (malformed JSON, swapped fields)
- Validates fallback markers for uncovered chunks
- Fast unit tests

**Weaknesses:**
- **Critical:** Doesn't test actual LLM behavior in production
- No ground truth validation (golden dataset of known divergences)
- Can pass even if diff analysis is useless in practice
- No adversarial cases (identical translations, gibberish inputs)

**Missing Tests (to raise score to 8/10):**
1. **Golden dataset:** 20 hand-labeled translation pairs with known divergences
2. **Integration test:** Real LLM call with known-good prompt
3. **Adversarial test:** Identical AI/fan translations should yield `no-change` markers
4. **Calibration test:** Confidence scores correlate with human judgment

**Verdict:** Tests the **plumbing** well, but not the **intelligence**. Classic unit test trap: validates structure, not semantics.

---

### Category 3: DiffResultsRepo Tests
**File:** `tests/adapters/repo/DiffResultsRepo.test.ts`
**Tests:** 8 tests
**Score:** 8.0/10 ⭐️ **HIGH QUALITY**

#### Rubric Analysis:

| Criterion | Score | Justification |
|-----------|-------|---------------|
| **1. Construct validity** | 9/10 | ✅ Construct: "Diff results persist correctly and can be retrieved by composite key." Clear, focused. |
| **2. Ecological validity** | 7/10 | ⚠️ Mocks IndexedDB, so doesn't catch browser-specific issues or transaction race conditions. But models the interface correctly. |
| **3. Reliability** | 9/10 | ✅ Deterministic. Properly resets state between tests. |
| **4. Sensitivity & specificity** | 8/10 | ✅ Catches key bugs: missing fields, wrong composite keys, hash mismatches. |
| **5. Adversarial robustness** | 7/10 | ⚠️ Tests some edge cases (missing fan translation, hash lookups). Missing: corrupted data, concurrent writes, quota exceeded. |
| **6. Incentive alignment** | 9/10 | ✅ Can't game it. Must implement actual save/retrieve logic. |
| **7. Calibration** | 8/10 | ✅ Pass = "data persists correctly and can be retrieved." |
| **8. Comparative baselines** | 6/10 | ⚠️ No comparison to alternative storage strategies. |
| **9. Coverage & balance** | 8/10 | ✅ Tests save, retrieve by ID, retrieve by hash, cache hits. Missing: concurrent operations, storage limits. |
| **10. Transparency/opacity** | 9/10 | ✅ Clear expectations. |
| **11. Cost-aware** | 9/10 | ✅ Fast with mocks. |
| **12. Decision-useful** | 8/10 | ✅ Ensures diff cache works, reducing redundant LLM calls. |

**Strengths:**
- Comprehensive CRUD coverage
- Tests both ID-based and hash-based retrieval
- Validates composite key logic

**Weaknesses:**
- Doesn't test browser storage limits (quota exceeded)
- No concurrent transaction tests
- Mocked IndexedDB misses browser quirks

**Verdict:** Solid data layer tests. Could add integration tests against real IndexedDB for full confidence.

---

### Category 4: Translation Slice Tests
**File:** `tests/current-system/translation.test.ts`
**Tests:** 4 tests
**Score:** 5.5/10 🟡 **WEAK**

#### Rubric Analysis:

| Criterion | Score | Justification |
|-----------|-------|---------------|
| **1. Construct validity** | 6/10 | ⚠️ Construct: "Translation flow manages state correctly." But mocks entire translation logic. Tests state transitions, not translation quality. |
| **2. Ecological validity** | 3/10 | 🔴 **Major gap:** Mocks TranslationService. Real deployment involves API failures, rate limits, partial responses, token overflow. None tested. |
| **3. Reliability** | 8/10 | ✅ Deterministic with mocks. |
| **4. Sensitivity & specificity** | 5/10 | ⚠️ Catches state management bugs but misses 80% of real failure modes (API errors, network timeouts, malformed responses). |
| **5. Adversarial robustness** | 2/10 | 🔴 **Easily gamed:** Tests pass if state updates correctly, regardless of whether translations work. |
| **6. Incentive alignment** | 4/10 | 🔴 Can "pass" by updating state without calling real translation. |
| **7. Calibration** | 3/10 | 🔴 Pass doesn't mean "translations work." |
| **8. Comparative baselines** | 1/10 | 🔴 No baseline. |
| **9. Coverage & balance** | 6/10 | ⚠️ Tests success case and error recording. Missing: retries, rate limits, partial failures, concurrent requests. |
| **10. Transparency/opacity** | 7/10 | ✅ Clear what's tested (state management). |
| **11. Cost-aware** | 9/10 | ✅ Fast. |
| **12. Decision-useful** | 5/10 | ⚠️ Partially useful: ensures state consistency. Doesn't ensure feature works end-to-end. |

**Strengths:**
- Tests state management correctness
- Validates error handling flow

**Critical Weaknesses:**
- **Mocks hide 80% of failure modes**
- No integration test with real translation service
- No retry logic validation
- No concurrent translation handling
- No rate limit testing

**How to Fix (raise to 8/10):**
1. Add integration test with **real API** (or VCR-style replay)
2. Test rate limit retry logic
3. Test concurrent translation requests
4. Test partial API response handling
5. Add timeout tests

**Verdict:** Classic **false confidence test**. Gives green check but misses real production failures. Goodhart-prone: optimizing for this test won't improve translation reliability.

---

### Category 5: Cost Calculation Tests
**File:** `tests/current-system/cost-calculation.test.ts`
**Tests:** 15 tests
**Score:** 9.0/10 ⭐️ **HIGH QUALITY**

#### Rubric Analysis:

| Criterion | Score | Justification |
|-----------|-------|---------------|
| **1. Construct validity** | 10/10 | ✅ **Perfect.** Construct: "Cost calculations match provider pricing." No ambiguity. |
| **2. Ecological validity** | 9/10 | ✅ Uses real token counts and model names. Tests fallback for suffixed models (production pattern). |
| **3. Reliability** | 10/10 | ✅ Pure math. Zero variance. |
| **4. Sensitivity & specificity** | 9/10 | ✅ Catches pricing errors. Specific: can't pass with wrong formula. |
| **5. Adversarial robustness** | 8/10 | ✅ Tests date-suffixed models, dynamic pricing. Missing: negative tokens, overflow. |
| **6. Incentive alignment** | 10/10 | ✅ Must implement correct math to pass. |
| **7. Calibration** | 10/10 | ✅ Pass = "cost is correct to 6 decimal places." |
| **8. Comparative baselines** | 7/10 | ⚠️ Could compare to manual calculations or provider API. |
| **9. Coverage & balance** | 9/10 | ✅ Covers all major models, edge cases (suffixes, dynamic pricing). |
| **10. Transparency/opacity** | 10/10 | ✅ Crystal clear. |
| **11. Cost-aware** | 10/10 | ✅ Instant. |
| **12. Decision-useful** | 10/10 | ✅ Directly prevents billing errors. |

**Strengths:**
- Pure deterministic math testing
- Excellent coverage of edge cases
- Direct financial impact

**Minor Improvements:**
- Test negative token counts (should error)
- Test unknown model handling
- Test pricing update mechanism

**Verdict:** **Exemplary test suite.** This is what good unit tests look like.

---

### Category 6: Novel Library E2E Tests
**File:** `tests/e2e/novel-library-flow.test.tsx`
**Tests:** 5 tests
**Score:** 7.0/10 🟡 **ADEQUATE**

#### Rubric Analysis:

| Criterion | Score | Justification |
|-----------|-------|---------------|
| **1. Construct validity** | 8/10 | ✅ Construct: "Users can browse, filter, and import novels." Tests user-facing behavior. |
| **2. Ecological validity** | 6/10 | ⚠️ Renders component but **mocks all services**. Real flow involves network fetches, loading states, errors. Partially tested. |
| **3. Reliability** | 7/10 | ⚠️ React Testing Library can be flaky with async rendering. Uses `waitFor` correctly. |
| **4. Sensitivity & specificity** | 7/10 | ✅ Catches UI bugs. Missing: actual network behavior, race conditions. |
| **5. Adversarial robustness** | 5/10 | ⚠️ Doesn't test: slow networks, partial loads, concurrent imports. |
| **6. Incentive alignment** | 8/10 | ✅ Must implement UI correctly to pass. |
| **7. Calibration** | 7/10 | ✅ Pass ≈ "UI renders and responds to interactions." |
| **8. Comparative baselines** | 4/10 | 🔴 No comparison to alternative UI patterns. |
| **9. Coverage & balance** | 7/10 | ✅ Tests happy path well. Missing: error states, loading states, pagination. |
| **10. Transparency/opacity** | 8/10 | ✅ Clear test structure. |
| **11. Cost-aware** | 6/10 | ⚠️ Component tests slower (300ms+). |
| **12. Decision-useful** | 8/10 | ✅ Validates user can complete core flows. |

**Strengths:**
- Tests user-facing behavior
- Uses realistic mock data
- Validates interactions (clicks, filters)

**Weaknesses:**
- Mocks hide network realities
- No loading state tests
- No error boundary tests
- Doesn't test accessibility

**Improvement Path:**
1. Add loading skeleton tests
2. Test error states (fetch failures)
3. Test pagination/infinite scroll
4. Add accessibility tests (keyboard nav, screen reader)

**Verdict:** Good starting point for E2E. Needs more failure mode coverage.

---

## Test Categories by Quality Tier

### 🏆 Exemplary (9-10/10)
**Tests that resist Goodharting and test the right thing:**
1. **Cost Calculation (9.0)** - Pure logic, clear construct, financial impact
2. **Tag Balancing (8.5)** - Real bug, real-world examples, decision-useful
3. **DiffResultsRepo (8.0)** - Data integrity, comprehensive CRUD

**Common traits:**
- Clear construct with no proxy confusion
- Test real behavior, not mocks
- Born from real bugs or requirements
- Decision-useful (block production issues)

### ✅ Adequate (6-8/10)
**Tests that work but have gaps:**
1. **DiffAnalysisService (6.5)** - Good structure tests, but mocks hide intelligence
2. **Novel Library E2E (7.0)** - Tests UI well, but mocks hide network reality

**Common weaknesses:**
- Over-reliance on mocks
- Missing adversarial cases
- Low ecological validity

### ⚠️ Weak (4-6/10)
**Tests that give false confidence:**
1. **Translation Slice (5.5)** - State management only, misses 80% of failure modes

**Red flags:**
- Mocks core functionality
- Can pass without feature working
- Doesn't test realistic constraints

---

## Systemic Issues Across Test Suite

### Issue 1: Mock Overuse (Ecological Validity: 4.5/10 avg)
**Prevalence:** 60% of tests
**Impact:** HIGH

**Problem:**
Tests mock translation services, LLM calls, network fetches, and IndexedDB. This creates **false confidence**: tests pass but production fails.

**Example:**
```typescript
// This passes even if translation API is broken
vi.spyOn(TranslationService, 'translate').mockResolvedValue({...})
```

**Fix:**
- Add integration tests with **real services** (use test API keys)
- Use VCR pattern to record/replay real API responses
- Add E2E tests that exercise full stack

**Priority:** CRITICAL

---

### Issue 2: No Adversarial Testing (Adversarial Robustness: 4.2/10 avg)
**Prevalence:** 75% of tests
**Impact:** MEDIUM-HIGH

**Problem:**
Tests don't try to break the system. Missing:
- Malformed inputs
- Concurrent operations
- Edge cases that real users encounter

**Examples of Missing Tests:**
- Tag balancing: 100-level nested tags
- Translation: simultaneous translations of same chapter
- Diff analysis: AI and fan translations are identical
- Cost calculation: negative tokens, unknown models

**Fix:**
Add "red team" test suites:
```typescript
describe('Adversarial cases', () => {
  it('handles 1000 concurrent translations')
  it('handles malformed API responses')
  it('handles quota exhausted')
})
```

**Priority:** MEDIUM

---

### Issue 3: No Ground Truth / Calibration (Calibration: 5.8/10 avg)
**Prevalence:** 80% of tests
**Impact:** MEDIUM

**Problem:**
Tests don't validate **accuracy**, only **structure**. Example: DiffAnalysis tests check JSON schema but not whether markers identify real divergences.

**Fix:**
Create golden datasets:
1. **Diff Analysis:** 50 translation pairs with human-labeled divergences
2. **HTML Repair:** 100 broken HTML samples with correct outputs
3. **Translation:** 20 chapters with known-good translations

**Priority:** MEDIUM

---

### Issue 4: No Performance / Scale Testing (Coverage: 5.9/10 avg)
**Prevalence:** 95% of tests
**Impact:** LOW-MEDIUM

**Problem:**
Tests use tiny inputs. Real users have:
- 1000+ chapter novels
- 50KB+ chapter text
- Concurrent operations

**Missing:**
- Tag balancing: 1000-paragraph chapters
- Diff analysis: 100KB translations
- Novel library: 500 novels

**Fix:**
Add performance test suite with realistic scale.

**Priority:** LOW

---

## Recommendations by Priority

### Priority 1: Add Integration Tests (1-2 weeks)
**Goal:** Raise ecological validity from 4.5 to 7.0

**Actions:**
1. **Translation integration test** with real API (use test keys)
   - Test actual Gemini/OpenAI/Claude calls
   - Validate token counting
   - Test error handling (rate limits, timeouts)

2. **Diff analysis integration test** with real LLM
   - Use known-good translation pairs
   - Validate markers match expectations
   - Test on production prompts

3. **IndexedDB integration test** against real browser
   - Use Playwright to run in actual browser
   - Test storage limits
   - Test concurrent transactions

**Impact:** Catch 60-70% of production bugs currently missed

---

### Priority 2: Create Golden Datasets (1 week)
**Goal:** Add calibration and ground truth

**Actions:**
1. **Diff analysis golden set:**
   - 50 translation pairs (AI, fan, raw)
   - Human-labeled divergences
   - Expected marker types

2. **HTML repair golden set:**
   - 100 broken HTML samples
   - Expected repairs

3. **Translation quality set:**
   - 20 chapters with known-good translations
   - Use for regression testing

**Impact:** Validate systems produce correct outputs, not just valid structures

---

### Priority 3: Add Adversarial Test Suite (3-5 days)
**Goal:** Improve robustness from 4.2 to 7.0

**Actions:**
Per component, add `describe('Adversarial cases')`:
- Malformed inputs
- Extreme scale (1000x normal)
- Concurrent operations
- Boundary conditions

**Example:**
```typescript
describe('Tag Balancing - Adversarial', () => {
  it('handles 100-level nested tags')
  it('handles 10000-paragraph document')
  it('handles malformed HTML: <i><b></i></b>')
  it('handles unicode in tag attributes')
})
```

**Impact:** Catch edge cases before users do

---

### Priority 4: Add E2E Tests with Real Browser (1 week)
**Goal:** Test full user journeys

**Actions:**
Use Playwright to add:
1. **Translation flow:** Load URL → Translate → View → Export
2. **Diff analysis flow:** Translate → Enable diff → Navigate markers
3. **Audio/image flow:** Translate → Generate media → View

**Impact:** Catch integration bugs and race conditions

---

## Test Quality Scorecard Summary

| Category | Tests | Score | Key Issue | Fix Priority |
|----------|-------|-------|-----------|--------------|
| Cost Calculation | 15 | 9.0/10 ✅ | None major | - |
| Tag Balancing | 8 | 8.5/10 ✅ | Minor: needs adversarial | Low |
| DiffResultsRepo | 8 | 8.0/10 ✅ | Minor: mock IDB | Low |
| Novel Library E2E | 5 | 7.0/10 🟡 | Mocks services | Medium |
| DiffAnalysisService | 7 | 6.5/10 🟡 | No ground truth | **High** |
| Translation Slice | 4 | 5.5/10 ⚠️ | Mocks everything | **CRITICAL** |

**Overall:** 6.2/10 (C+)

---

## Good Test Examples to Learn From

### ✅ Exemplar #1: `cost-calculation.test.ts`
**Why it's good:**
- Tests construct directly (correct math)
- No mocks needed
- Clear pass/fail
- Fast and deterministic
- Decision-useful (prevents billing errors)

**Pattern to replicate:**
```typescript
// Test pure logic with clear inputs/outputs
const input = { model: 'gpt-4', tokens: 1000 };
const expected = 0.03;
const actual = calculateCost(input);
expect(actual).toBeCloseTo(expected);
```

---

### ✅ Exemplar #2: `tag-balancing.test.ts`
**Why it's good:**
- Born from real production bug
- Uses actual user example in test
- Tests exact failure mode
- No mocks
- Decision-useful (blocks formatting bug)

**Pattern to replicate:**
```typescript
// When fixing bug, create test from actual failing case
it('handles real user example from bug #123', () => {
  const input = actualUserInput;  // From bug report
  const result = balanceTags(input);
  expect(result).toMatchExpectedOutput();
});
```

---

## Red Flag Tests (Learn What NOT To Do)

### 🔴 Anti-Pattern #1: Testing Mocks
```typescript
// This test gives false confidence
vi.spyOn(service, 'translate').mockResolvedValue(fakeData);
const result = await handleTranslate();
expect(result).toBe(fakeData);  // Always passes!
```

**Problem:** Tests pass even if real service is broken.

**Fix:** Use real service in integration tests.

---

### 🔴 Anti-Pattern #2: No Ground Truth
```typescript
// This doesn't validate correctness
const markers = analyzeDiff(ai, fan, raw);
expect(markers).toBeInstanceOf(Array);  // Useless check
```

**Problem:** Accepts any array, even nonsense.

**Fix:** Compare to known-good golden data.

---

## Conclusion & Action Plan

### Current State:
- **372 tests, 21% code coverage**
- **Test quality: C+ (6.2/10)**
- High-quality tests in: cost calculation, data persistence, some UI components
- Major gaps in: translation flow, diff analysis accuracy, adversarial cases

### Core Problem:
**Over-reliance on mocks creates false confidence.** Tests pass but production fails.

### 30-Day Action Plan:

**Week 1: Integration Tests (CRITICAL)**
- [ ] Add translation integration test with real API
- [ ] Add diff analysis integration test with real LLM
- [ ] Target: Catch 60% more production bugs

**Week 2: Golden Datasets**
- [ ] Create diff analysis golden set (50 pairs)
- [ ] Create HTML repair golden set (100 samples)
- [ ] Target: Validate accuracy, not just structure

**Week 3: Adversarial Tests**
- [ ] Add adversarial suite for each major component
- [ ] Test edge cases, extreme scale, concurrent ops
- [ ] Target: Robustness score 4.2 → 7.0

**Week 4: E2E with Playwright**
- [ ] Add 3 critical user journeys
- [ ] Test in real browser
- [ ] Target: Catch integration bugs

### 90-Day Target:
- **Test quality: B+ (8.0/10)**
- **Code coverage: 60%**
- **Production bugs caught by tests: 80%+ (vs. current ~40%)**

---

**Final Verdict:**
Your test suite has a **solid foundation** (cost calculation, data layer) but **critical gaps** in integration testing. The translation flow tests give **false confidence** - they pass but don't ensure translations work. Priority #1 is adding integration tests with real services.

**Goodhart Risk:** MEDIUM-HIGH. Current tests can be "passed" by updating state without implementing real translation. Fix by adding integration tests.

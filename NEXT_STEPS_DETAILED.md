# Next Steps - Detailed Action Plan

**Last Updated:** October 25, 2025
**Current Status:** Phase 1 Complete (Infrastructure Built)
**Next Phase:** Phase 2 - Enable & Validate

---

## 🎯 IMMEDIATE: This Week (5-8 hours)

### Step 1: Enable One Golden Test (2-3 hours) 🔥 **START HERE**

**Goal:** Get F1 scoring working end-to-end with real diff analysis

**Sub-tasks:**

#### 1A. Create SimpleLLMAdapter (30 mins)
```typescript
// File: tests/gold/diff/SimpleLLMAdapter.ts

import { OpenRouterService } from '../../../services/openrouterService';

export class SimpleLLMAdapter {
  private openRouter: OpenRouterService;

  constructor(apiKey: string) {
    this.openRouter = new OpenRouterService(apiKey);
  }

  async translate(options: {
    text: string;
    systemPrompt: string;
    provider: string;
    model: string;
    temperature: number;
  }) {
    // Call OpenRouter (which supports multiple providers)
    const response = await this.openRouter.generateCompletion({
      model: options.model,
      messages: [
        { role: 'system', content: options.systemPrompt },
        { role: 'user', content: options.text }
      ],
      temperature: options.temperature,
    });

    return {
      translatedText: response.content,
      cost: response.cost || 0,
      model: response.model || options.model,
    };
  }
}
```

#### 1B. Enable ONE Golden Test (30 mins)
```bash
# Edit: tests/gold/diff/diff-golden.test.ts
# Change:
#   it.skip('[Golden] case-001: identical translations...'
# To:
#   it('[Golden] case-001: identical translations...'

# Add at top of file:
import { SimpleLLMAdapter } from './SimpleLLMAdapter';

beforeEach(() => {
  service = new DiffAnalysisService();

  // Only inject translator if API key available
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (apiKey) {
    const adapter = new SimpleLLMAdapter(apiKey);
    service.setTranslator(adapter as any);
  }

  scorer = new DiffScorer();
});
```

#### 1C. Run Test & Iterate (1-2 hours)
```bash
# Run with API key
OPENROUTER_API_KEY=your_key npm test tests/gold/diff/diff-golden.test.ts

# Expected: Test will fail first time (F1 score too low)
# Iterate:
# 1. Check console output (scorer shows which markers are wrong)
# 2. Adjust expected markers in golden-cases.json
# 3. OR improve diff prompt if LLM is consistently wrong
# 4. Re-run until F1 >= 0.80 for case-001
```

**Success criteria:**
- ✅ One test passes with F1 >= 0.80
- ✅ Scorer output shows TP/FP/FN breakdown
- ✅ You understand how to interpret results

**Estimated time:** 2-3 hours (includes debugging)

---

### Step 2: Enable ONE ChapterView Test (1-2 hours)

**Goal:** Validate ChapterView test infrastructure works

#### 2A. Add Test IDs to ChapterView (30 mins)
```typescript
// File: components/ChapterView.tsx

// Add these data attributes to your JSX:

// 1. Main container
<div data-chapter-content className="chapter-view">

// 2. Diff gutter
<div data-diff-gutter className="diff-gutter">

// 3. Diff markers/pips
<div data-diff-marker data-marker-id={marker.chunkId}>

// 4. Text chunks
<span data-lf-type="text" data-lf-chunk={chunkId}>
```

#### 2B. Enable Flow #1 Test (15 mins)
```bash
# Edit: tests/integration/ChapterView.critical-flows.test.tsx
# Change it.skip → it for the first test only:
#   it('[Flow 1] renders diff markers in gutter with correct counts'
```

#### 2C. Run & Fix (45 mins)
```bash
npm test tests/integration/ChapterView.critical-flows.test.tsx

# Expected failures:
# - Selectors don't match (fix in test)
# - Missing props (add to mock)
# - Timing issues (adjust waitFor timeout)

# Iterate until test passes
```

**Success criteria:**
- ✅ One ChapterView test passes
- ✅ Test catches real bug if you comment out diff gutter code
- ✅ Runs in <5 seconds

**Estimated time:** 1-2 hours

---

### Step 3: Document Learnings (30 mins)

Create quick notes:

```markdown
# Golden Test Learnings (YYYY-MM-DD)

## What Worked:
- [Note successes]

## What Needed Adjustment:
- Expected markers: [list changes]
- Diff prompt: [any tweaks]
- Test infrastructure: [issues found]

## F1 Score Results:
- case-001: 0.85 (target: 0.80) ✅

## Next Golden Cases to Enable:
1. case-002 (terminology) - should be easy
2. case-003 (missing detail) - critical
```

---

## 🚀 Next 2 Weeks (15-20 hours)

### Week 1: Enable Golden Dataset

**Mon-Tue: Enable 3 more golden tests (4 hours)**
- case-002: Terminology choice
- case-003: Missing detail (CRITICAL)
- case-004: Hallucination

**Wed-Thu: Tune prompts if needed (3 hours)**
- If F1 < 0.70 on critical cases, improve diff prompt
- Add explicit instructions for plot-critical detection
- Test prompt changes against all cases

**Fri: Add 5 more golden cases (2 hours)**
- Long multi-paragraph content
- Empty translation
- Very technical content
- Dialogue-heavy content
- Poetry/stylistic content

**Weekend: Document & commit**

**End of Week 1:**
- ✅ 7 golden tests enabled + passing
- ✅ Overall F1 >= 0.70
- ✅ 5 new golden cases added (total: 12)

---

### Week 2: Enable ChapterView + Provider Tests

**Mon-Tue: Enable all 4 ChapterView flows (4 hours)**
- Flow 2: Inline edit
- Flow 3: Large chapter performance
- Flow 4: Media coexistence

**Wed: Add ChapterView error states (2 hours)**
- Illustration load failure
- Audio playback error
- Inline edit save failure

**Thu: Provider contract infrastructure (3 hours)**
- Implement cassette save/load
- Add nock for network interception
- Record 1 cassette for OpenAI

**Fri: Enable provider tests (2 hours)**
- Remove .skip from OpenAI tests
- Verify replay works
- Add Gemini cassettes

**End of Week 2:**
- ✅ 4 ChapterView flows passing
- ✅ 3 provider contract tests passing
- ✅ Coverage: ChapterView 7% → 40%

---

## 📈 Weeks 3-4: Expand & Harden (10-15 hours)

### Adversarial Test Suite (5 hours)

Add `describe('Adversarial')` blocks to:

**1. Tag Balancing (1 hour)**
```typescript
describe('Tag Balancing: Adversarial', () => {
  it('handles 10-level nested tags', () => {
    // <i><b><u>...(10 levels)...text...</u></b></i>
  });

  it('handles malformed cross-closing', () => {
    // <i><b></i></b> → should repair or fail gracefully
  });

  it('handles 1000-paragraph document', () => {
    // Performance guard
  });

  it('handles unicode in tag attributes', () => {
    // <i style="font-family: 微软雅黑">
  });
});
```

**2. Diff Analysis (2 hours)**
```typescript
describe('Diff Analysis: Adversarial', () => {
  it('identical texts produce ALL no-change markers', () => {
    // Strictest test: F1 = 1.0 required
  });

  it('completely different texts flag ALL chunks', () => {
    // AI in English, fan in Chinese → 100% divergence
  });

  it('handles 100KB translation', () => {
    // Scale test
  });

  it('handles mixed languages in same paragraph', () => {
    // "He said: '你好' to greet her."
  });
});
```

**3. Translation Flow (2 hours)**
```typescript
describe('Translation: Adversarial', () => {
  it('concurrent translations of same chapter dedupes', () => {
    // Fire 5 simultaneous requests
    // Expect: 1 API call, 5 get same result
  });

  it('cancelling translation cleans up state', () => {
    // Start translation → cancel immediately
    // Expect: no orphaned loading states
  });

  it('rate limit triggers backoff', () => {
    // Mock 429 response
    // Expect: exponential backoff, eventual success
  });
});
```

### Mutation Testing Pilot (3 hours)

**Install Stryker:**
```bash
npm install --save-dev @stryker-mutator/core @stryker-mutator/vitest
npx stryker init
```

**Config (`stryker.conf.json`):**
```json
{
  "mutate": [
    "services/aiService.ts",
    "components/ChapterView.tsx:balanceTagsAcrossSegments",
    "adapters/repo/DiffResultsRepo.ts"
  ],
  "testRunner": "vitest",
  "coverageAnalysis": "perTest",
  "thresholds": {
    "high": 80,
    "low": 60,
    "break": 50
  }
}
```

**Run:**
```bash
npm run stryker
```

**Interpret Results:**
- Mutation score 80%+ = good tests
- Mutation score <60% = tests are trivial
- Look for "survived mutants" (bugs tests didn't catch)

### Expand Golden Dataset to 50 Cases (3 hours)

**Add 38 more cases covering:**
- 10 cases: Different genres (action, romance, technical, poetry)
- 10 cases: Edge cases (empty, very long, special chars)
- 10 cases: Known failure modes from production
- 8 cases: Multi-language mixing

**Script to help:**
```bash
# Generate case template
node scripts/generate-golden-case.js \
  --id case-042-technical-jargon \
  --description "Technical documentation with specialized terms"
```

---

## 🎓 Weeks 5-6: Advanced (10-15 hours)

### E2E Tests with Playwright (8 hours)

**Setup (2 hours):**
```bash
npm install --save-dev @playwright/test
npx playwright install
```

**Critical User Journeys (6 hours):**

**1. Translation Flow (2 hours)**
```typescript
// tests/e2e/translation-flow.spec.ts
test('user can translate chapter from URL', async ({ page }) => {
  await page.goto('/');

  // Input URL
  await page.fill('[data-testid=url-input]', TEST_URL);
  await page.click('[data-testid=fetch-button]');

  // Wait for load
  await expect(page.locator('[data-testid=chapter-content]')).toBeVisible();

  // Trigger translation
  await page.click('[data-testid=translate-button]');

  // Wait for completion (with timeout)
  await expect(page.locator('[data-testid=translation-text]'))
    .toBeVisible({ timeout: 30000 });

  // Verify diff markers appear
  await expect(page.locator('[data-diff-marker]').first())
    .toBeVisible();

  // Export EPUB
  const downloadPromise = page.waitForEvent('download');
  await page.click('[data-testid=export-epub]');
  const download = await downloadPromise;

  // Verify file downloaded
  expect(download.suggestedFilename()).toMatch(/\.epub$/);
});
```

**2. Diff Navigation Flow (2 hours)**
```typescript
test('user can navigate diff markers', async ({ page }) => {
  // Setup: load chapter with known markers
  await setupChapterWithMarkers(page);

  // Click next marker
  await page.click('[data-testid=diff-next]');

  // Verify scrolled to marker
  const activeMarker = page.locator('[data-diff-marker-active]');
  await expect(activeMarker).toBeInViewport();

  // Click marker pip directly
  await page.click('[data-diff-marker="para-3-test"]');

  // Verify scrolled to paragraph 3
  const para3 = page.locator('[data-lf-chunk="para-3-test"]');
  await expect(para3).toBeInViewport();
});
```

**3. Audio/Image Generation (2 hours)**
```typescript
test('user can generate and play audio', async ({ page }) => {
  await setupTranslatedChapter(page);

  // Enable audio generation
  await page.click('[data-testid=settings-button]');
  await page.check('[data-testid=enable-audio]');
  await page.click('[data-testid=generate-audio]');

  // Wait for generation (mock or real)
  await expect(page.locator('audio')).toBeVisible({ timeout: 60000 });

  // Play audio
  await page.click('[data-testid=audio-play]');

  // Verify playing
  const audio = await page.locator('audio').first();
  const isPaused = await audio.evaluate(el => (el as HTMLAudioElement).paused);
  expect(isPaused).toBe(false);
});
```

### CI/CD Integration (2 hours)

**GitHub Actions workflow:**
```yaml
# .github/workflows/test-quality.yml
name: Test Quality Gates

on: [pull_request]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm test -- --coverage
      - name: Check coverage thresholds
        run: npm run test:coverage-check
      - name: Upload coverage
        uses: codecov/codecov-action@v3

  golden-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - name: Run golden dataset (replay mode)
        run: npm test tests/gold/
        env:
          # Use recorded cassettes, no live API
          VCR_MODE: replay

  contract-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - name: Run provider contracts (replay mode)
        run: npm test tests/contracts/

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npx playwright install
      - name: Run E2E tests
        run: npx playwright test
      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: playwright-report/

  nightly-live-tests:
    # Only run on schedule, not on PR
    if: github.event_name == 'schedule'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - name: Run golden tests (LIVE)
        run: npm test tests/gold/
        env:
          OPENROUTER_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}
          VCR_MODE: record
      - name: Commit updated cassettes
        run: |
          git config --global user.name 'Test Bot'
          git config --global user.email 'bot@example.com'
          git add tests/**/*.json
          git commit -m 'test: update golden cassettes' || echo "No changes"
          git push
```

---

## 📊 Success Metrics (Track Progress)

### Coverage (Check Weekly)
```bash
# Run with coverage
npm test -- --coverage

# Target progression:
# Week 1: 25% overall
# Week 2: 35% overall, ChapterView 40%
# Week 4: 50% overall, ChapterView 60%, Providers 50%
# Week 6: 60% overall, ChapterView 70%, Providers 70%
```

### Test Quality (Check Monthly)
```bash
# Run full quality audit
npm run test:quality-audit

# Targets:
# Month 1: 7.0/10 (from 6.2)
# Month 2: 7.5/10
# Month 3: 8.0/10
```

### Production Impact (Track Continuously)
- Bugs caught in CI (before merge): Target 80%+
- User-reported bugs: Target 50% reduction
- Hotfixes deployed: Target 70% reduction

---

## 🎯 Prioritized by ROI

If time is limited, do in this order:

### Tier 1: Highest ROI (Must Do)
1. ✅ Enable 1 golden test (validates F1 scoring works)
2. ✅ Enable 1 ChapterView test (validates UI testing works)
3. ✅ Enable case-003 (missing detail) - catches critical translation bugs
4. ✅ Add adversarial case: identical translations → no-change

**Time:** 6 hours
**Impact:** Catch 50%+ more production bugs

### Tier 2: High ROI (Should Do)
5. Enable all 7 golden tests
6. Enable all 4 ChapterView flows
7. Add 10 more golden cases
8. Enable provider contract tests

**Time:** 15 hours
**Impact:** Catch 70%+ of production bugs

### Tier 3: Good ROI (Nice to Have)
9. Adversarial test suite
10. Mutation testing
11. E2E with Playwright
12. CI integration

**Time:** 20 hours
**Impact:** Catch 85%+ of production bugs, prevent regressions

---

## 🚫 What NOT to Do (Anti-Patterns)

**DON'T:**
1. ❌ Add more tests without enabling what we built
2. ❌ Mock everything to make tests pass quickly
3. ❌ Lower F1 threshold to make tests pass
4. ❌ Skip adversarial cases because they "shouldn't happen"
5. ❌ Disable coverage thresholds when they fail

**DO:**
1. ✅ Enable tests one at a time, fix issues
2. ✅ Use real code paths with VCR for network
3. ✅ Keep F1 >= 0.70, improve prompts if needed
4. ✅ Add adversarial cases when you find bugs
5. ✅ Raise coverage thresholds as you improve

---

## 📝 Weekly Checklist Template

Copy this for each week:

```markdown
## Week of [DATE]

### Goals This Week:
- [ ] Goal 1
- [ ] Goal 2

### Tests Enabled:
- [ ] Test name (expected result)

### Issues Found:
- Issue 1: [description] → [resolution]

### Metrics:
- Coverage: X% → Y%
- Golden F1: N/A or X.XX
- Tests passing: X/Y

### Learnings:
- [Key insight]

### Next Week:
- [Top priority]
```

---

## 🎓 Learning Resources

**When stuck:**
1. Check `TEST_QUALITY_AUDIT.md` - explains the rubric
2. Check `TEST_IMPROVEMENTS_IMPLEMENTED.md` - explains what we built
3. Look at `tests/components/tag-balancing.test.ts` - example of good test
4. Look at `tests/current-system/cost-calculation.test.ts` - another good example

**For VCR patterns:**
- PollyJS: https://netflix.github.io/pollyjs/
- nock: https://github.com/nock/nock
- MSW: https://mswjs.io/

**For mutation testing:**
- Stryker: https://stryker-mutator.io/
- Interpretation guide: https://stryker-mutator.io/docs/mutation-testing-elements/what-is-mutation-testing/

---

## 🎉 Celebration Milestones

Track these wins:

- [ ] ✨ First golden test passes with F1 >= 0.80
- [ ] 🎯 Overall golden F1 >= 0.70 (production ready!)
- [ ] 🚀 ChapterView coverage hits 50%
- [ ] 💯 All 4 ChapterView flows passing
- [ ] 🏆 Mutation score >= 80% on one module
- [ ] 🎊 Test quality score hits 8.0/10

Share these in team chat / commit messages!

---

**Next action:** Start with Step 1 (enable one golden test) - that's your critical path.

# LexiconForge: Technical Improvement Roadmap

**Date:** 2025-11-15
**Status:** Proposed
**For Review By:** User + Codex
**Branch:** `claude/lexiconforge-technical-debt-analysis-011CUzBD65GCev4bZ5FAfUMh`

---

## Executive Summary

This roadmap addresses findings from the E2E test investigation and test quality analysis. Work is organized by **impact vs. effort**, with clear success criteria for each phase.

**Current State:**
- ✅ E2E test infrastructure fixed (JSON imports, Markdown parsing)
- ✅ Comprehensive investigation documented (1000+ lines)
- ✅ Test quality analyzed (Grade: 7.2/10)
- ⚠️ E2E tests have intermittent race condition
- ❌ No mutation testing
- ❌ No property-based testing

**Goal State:**
- All E2E tests pass consistently
- Mutation score ≥ 70% for critical modules
- Property-based tests for security-critical code
- Documented testing standards

---

## Phase 1: E2E Test Stabilization (Critical Path)
**Priority:** 🔴 Critical
**Estimated Time:** 3-5 days
**Owner:** TBD

### Problem Statement
E2E initialization tests fail intermittently due to race condition between Playwright's headless browser and React.StrictMode double-rendering. Tests sometimes crash before useEffect runs.

**Evidence:**
- Tests pass ~40% of time with full initialization
- Tests fail ~60% of time with page crash before useEffect
- Root cause documented in `docs/E2E-DELETE-DATABASE-ROOT-CAUSE.md`

---

### Option 1A: Implement Fresh Context Strategy (Recommended)
**Approach:** Use Playwright's built-in context isolation
**Effort:** Low (2-3 hours)
**Risk:** Low

#### Tasks:
1. **Update initialization tests to use fresh context**
   - File: `tests/e2e/initialization.spec.ts`
   - Change: Implement Solution 2 from examples
   ```typescript
   test('should initialize', async ({ browser }) => {
     const context = await browser.newContext();
     const page = await context.newPage();

     // Set up listeners
     page.on('console', ...);

     // Navigate
     await page.goto('/');

     // Assertions
     expect(await page.title()).toBe('Lexicon Forge');

     await context.close();
   });
   ```

2. **Remove diagnostic logging**
   - Files: `index.tsx`, `App.tsx`, `store/index.ts`, `services/sessionManagementService.ts`
   - Revert temporary debug console.log statements
   - Keep only production-relevant logging

3. **Validate all 5 tests pass consistently**
   - Run: `npm run test:e2e tests/e2e/initialization.spec.ts` 10 times
   - Success: 10/10 passes

**Success Criteria:**
- ✅ All initialization tests pass 100% of time
- ✅ Tests complete in < 15 seconds
- ✅ No diagnostic logging in production code

**Dependencies:** None

---

### Option 1B: Skip Problematic Tests (Pragmatic Alternative)
**Approach:** Mark initialization tests as skipped, focus on workflow tests
**Effort:** Very Low (1 hour)
**Risk:** Medium (reduced test coverage)

#### Tasks:
1. **Skip fresh install tests**
   ```typescript
   test.skip('should initialize fresh database', () => {
     // Skip due to Playwright environment race condition
     // See: docs/E2E-INVESTIGATION-SUMMARY.md
     // Alternative: Test initialization via integration tests
   });
   ```

2. **Create integration tests for initialization**
   - File: `tests/integration/initialization.test.ts`
   - Test `initializeStore()` directly without browser
   - Mock IndexedDB with fake implementation

3. **Focus E2E tests on user workflows**
   - Navigation between chapters
   - Translation triggering
   - Settings persistence

**Success Criteria:**
- ✅ Initialization logic tested (via integration tests)
- ✅ E2E tests focus on user workflows
- ✅ Test suite passes consistently

**Trade-off:** Less coverage of browser environment issues

---

### Option 1C: Production Build Testing (No StrictMode)
**Approach:** Run E2E tests against production build
**Effort:** Medium (4-6 hours)
**Risk:** Low

#### Tasks:
1. **Create production E2E configuration**
   - File: `playwright.config.prod.ts`
   ```typescript
   export default defineConfig({
     webServer: {
       command: 'npm run build && npm run preview',
       url: 'http://localhost:4173',
       reuseExistingServer: true,
     },
   });
   ```

2. **Add production test script**
   - `package.json`:
   ```json
   {
     "scripts": {
       "test:e2e:prod": "playwright test --config=playwright.config.prod.ts"
     }
   }
   ```

3. **Update CI/CD to run both dev and prod tests**

**Success Criteria:**
- ✅ Tests pass against production build
- ✅ Tests verify actual deployment configuration
- ✅ No StrictMode double-rendering issues

**Trade-off:** Doesn't catch StrictMode-specific issues

---

### Recommendation: Start with Option 1A
- **Why:** Lowest effort, keeps E2E coverage, tests real environment
- **Fallback:** If 1A still flaky after 2 days, switch to 1B (skip + integration tests)
- **Long-term:** Implement 1C for CI/CD pipeline (production validation)

---

## Phase 2: Mutation Testing Implementation (Critical)
**Priority:** 🔴 Critical
**Estimated Time:** 2-3 days
**Owner:** TBD

### Problem Statement
Current tests achieve coverage but can't prove they catch bugs. Need mutation testing to verify test effectiveness.

**Current Grade:** 7.2/10 (Above Average)
**Target Grade:** 8.5/10 (Excellent with mutation testing)

---

### Task 2.1: Install and Configure Stryker
**Effort:** 2-4 hours

```bash
npm install --save-dev @stryker-mutator/core @stryker-mutator/vitest-runner
npx stryker init
```

**Configuration:**
```javascript
// stryker.conf.js
module.exports = {
  packageManager: 'npm',
  reporters: ['html', 'clear-text', 'progress'],
  testRunner: 'vitest',
  coverageAnalysis: 'perTest',

  // Start with high-value modules only
  mutate: [
    'services/diff/DiffAnalysisService.ts',
    'services/HtmlSanitizer.ts',
    'services/HtmlRepairService.ts',
    'adapters/repo/**/*.ts',
    'components/diff/**/*.ts'
  ],

  // Exclude test files
  mutationScore: {
    lines: 70,
    functions: 70,
    branches: 70
  },

  // Don't mutate logging
  ignorePatterns: [
    '**/node_modules/**',
    '**/tests/**',
    '**/*.test.ts',
    '**/*.spec.ts'
  ]
};
```

**Success Criteria:**
- ✅ Stryker runs successfully
- ✅ Baseline mutation score measured
- ✅ HTML report generated

---

### Task 2.2: Baseline Mutation Score Analysis
**Effort:** 1-2 hours

1. **Run initial mutation test**
   ```bash
   npx stryker run
   ```

2. **Analyze results**
   - Identify "Nokkukuthi" tests (tests that pass with mutated code)
   - Document mutation score per module
   - Create improvement plan

3. **Expected findings:**
   - HTML Sanitizer: 80-90% mutation score (strong tests)
   - Diff Analysis: 70-80% mutation score (golden tests are good)
   - Adapters: 40-60% mutation score (heavy mocking reduces effectiveness)

**Success Criteria:**
- ✅ Baseline scores documented in `docs/MUTATION-BASELINE.md`
- ✅ Weak tests identified with examples
- ✅ Improvement targets set

---

### Task 2.3: Fix Nokkukuthi Tests (Iterative)
**Effort:** 4-8 hours (ongoing)

**Process for each failing test:**

1. **Identify the mutant that survived**
   ```typescript
   // Example: Original code
   if (text.length > 0) {
     return sanitize(text);
   }

   // Mutant: Changed > to >=
   if (text.length >= 0) {  // This mutant survived!
     return sanitize(text);
   }
   ```

2. **Understand why test didn't catch it**
   ```typescript
   // Current test (weak)
   it('sanitizes text', () => {
     expect(sanitize('hello')).toBe('hello');
   });
   // Problem: Only tests non-empty string
   ```

3. **Fix the test**
   ```typescript
   // Improved test (catches mutant)
   it('sanitizes text', () => {
     expect(sanitize('hello')).toBe('hello');
     expect(sanitize('')).toBe('');  // Now catches >= vs > mutant
   });
   ```

**Success Criteria:**
- ✅ Mutation score ≥ 70% for all critical modules
- ✅ No surviving mutants in security-critical code (HtmlSanitizer)
- ✅ Test improvements documented

---

### Task 2.4: Add Mutation Testing to CI/CD
**Effort:** 2-3 hours

```yaml
# .github/workflows/mutation-test.yml
name: Mutation Testing

on:
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 0 * * 0'  # Weekly on Sunday

jobs:
  mutate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run test:mutate
      - name: Check mutation score
        run: |
          if [ $(jq '.mutationScore' reports/mutation/mutation.json) -lt 70 ]; then
            echo "Mutation score below threshold!"
            exit 1
          fi
```

**Success Criteria:**
- ✅ Mutation tests run on every PR
- ✅ Build fails if mutation score drops below 70%
- ✅ Results visible in PR checks

---

## Phase 3: Property-Based Testing (High Value)
**Priority:** 🟡 High Value
**Estimated Time:** 2-3 days
**Owner:** TBD

### Problem Statement
Current tests check specific examples but miss edge cases. Need property-based testing to find unexpected failures.

---

### Task 3.1: Install fast-check
**Effort:** 15 minutes

```bash
npm install --save-dev fast-check
```

**Success Criteria:**
- ✅ fast-check installed
- ✅ Vitest recognizes library

---

### Task 3.2: Add Property Tests for HtmlSanitizer
**Effort:** 3-4 hours

**File:** `tests/services/HtmlSanitizer.property.test.ts`

```typescript
import { describe, it } from 'vitest';
import fc from 'fast-check';
import { sanitizeHtml, toStrictXhtml } from '../../services/translate/HtmlSanitizer';

describe('HtmlSanitizer Properties', () => {
  describe('Security Invariants', () => {
    it('never allows <script> tags through', () => {
      fc.assert(
        fc.property(
          fc.string(),
          fc.string(),
          (before, after) => {
            const malicious = `${before}<script>alert(1)</script>${after}`;
            const clean = sanitizeHtml(malicious);
            return !clean.includes('<script>');
          }
        ),
        { numRuns: 1000 }
      );
    });

    it('never allows event handlers through', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('onclick', 'onerror', 'onload', 'onmouseover'),
          fc.string(),
          (event, code) => {
            const malicious = `<img ${event}="${code}" />`;
            const clean = sanitizeHtml(malicious);
            return !clean.includes(event);
          }
        ),
        { numRuns: 1000 }
      );
    });

    it('never allows javascript: URLs', () => {
      fc.assert(
        fc.property(
          fc.string(),
          (payload) => {
            const malicious = `<a href="javascript:${payload}">link</a>`;
            const clean = sanitizeHtml(malicious);
            return !clean.toLowerCase().includes('javascript:');
          }
        ),
        { numRuns: 1000 }
      );
    });
  });

  describe('Idempotence', () => {
    it('is idempotent: sanitize(sanitize(x)) === sanitize(x)', () => {
      fc.assert(
        fc.property(
          fc.string(),
          (input) => {
            const once = sanitizeHtml(input);
            const twice = sanitizeHtml(once);
            return once === twice;
          }
        ),
        { numRuns: 1000 }
      );
    });
  });

  describe('Unicode Handling', () => {
    it('preserves valid unicode characters', () => {
      fc.assert(
        fc.property(
          fc.unicodeString(),
          (text) => {
            const clean = sanitizeHtml(text);
            // Should not mangle unicode (除非它包含标签)
            return clean.length > 0 || text.length === 0;
          }
        ),
        { numRuns: 500 }
      );
    });
  });

  describe('Length Constraints', () => {
    it('output length is finite for any input', () => {
      fc.assert(
        fc.property(
          fc.string({ maxLength: 10000 }),
          (input) => {
            const clean = sanitizeHtml(input);
            return clean.length < input.length * 10; // Reasonable bound
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
```

**Success Criteria:**
- ✅ All property tests pass
- ✅ Tests run in < 10 seconds
- ✅ Found and fixed at least 1 edge case bug

---

### Task 3.3: Add Property Tests for Cost Calculations
**Effort:** 2-3 hours

**File:** `tests/services/aiService.property.test.ts`

```typescript
import fc from 'fast-check';
import { calculateCost } from '../../services/aiService';

describe('Cost Calculation Properties', () => {
  it('cost is always non-negative', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('gpt-4o', 'gemini-pro', 'claude-3-opus'),
        fc.nat(),
        fc.nat(),
        (model, promptTokens, completionTokens) => {
          const cost = calculateCost(model, promptTokens, completionTokens);
          return cost >= 0;
        }
      )
    );
  });

  it('cost increases with token count', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('gpt-4o', 'gemini-pro'),
        fc.nat({ max: 1000 }),
        fc.nat({ max: 1000 }),
        (model, baseTokens, extraTokens) => {
          const baseCost = calculateCost(model, baseTokens, baseTokens);
          const moreCost = calculateCost(
            model,
            baseTokens + extraTokens,
            baseTokens + extraTokens
          );
          return moreCost >= baseCost;
        }
      )
    );
  });

  it('cost is commutative with token split', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('gpt-4o'),
        fc.nat({ max: 1000 }),
        fc.nat({ max: 1000 }),
        (model, promptTokens, completionTokens) => {
          const cost1 = calculateCost(model, promptTokens, completionTokens);
          // Split prompt tokens differently
          const split = Math.floor(promptTokens / 2);
          const cost2a = calculateCost(model, split, 0);
          const cost2b = calculateCost(model, promptTokens - split, completionTokens);

          // Total cost should be approximately the same (within floating point precision)
          return Math.abs((cost2a + cost2b) - cost1) < 0.01;
        }
      )
    );
  });
});
```

**Success Criteria:**
- ✅ Cost calculation properties validated
- ✅ No negative costs found
- ✅ Monotonicity verified

---

### Task 3.4: Document Property-Based Testing Standards
**Effort:** 1-2 hours

**File:** `docs/PROPERTY-BASED-TESTING.md`

**Contents:**
- When to use property tests vs example tests
- How to identify good properties to test
- fast-check generators guide
- Examples from codebase
- Common pitfalls

**Success Criteria:**
- ✅ Guide published
- ✅ Team trained on property-based testing

---

## Phase 4: Golden Dataset Expansion (High Value)
**Priority:** 🟡 High Value
**Estimated Time:** 3-5 days
**Owner:** TBD

### Problem Statement
Current golden dataset has only 5 cases. Need 20+ cases to cover edge cases and adversarial inputs.

---

### Task 4.1: Create Golden Case Template
**Effort:** 1-2 hours

**File:** `tests/gold/diff/GOLDEN_CASE_TEMPLATE.md`

```markdown
## Golden Case Template

### Case ID
`case-XXX-descriptive-name`

### Category
- [ ] Exact Match
- [ ] Terminology Choice
- [ ] Missing Detail
- [ ] Added Context
- [ ] Tone Shift
- [ ] Cultural Adaptation
- [ ] Error/Hallucination

### Difficulty
- [ ] Easy (F1 > 0.9)
- [ ] Medium (F1 > 0.7)
- [ ] Hard (F1 > 0.5)

### Raw Text (Japanese)
```
[Original text here]
```

### Fan Translation
```
[Fan translation here]
```

### AI Translation
```
[AI translation here]
```

### Expected Markers
```json
[
  {
    "id": "para-0-1234",
    "reasons": ["fan-divergence"],
    "colors": ["yellow"],
    "explanation": "..."
  }
]
```

### Rationale
Why is this case important? What edge case does it test?

### Manual F1 Score
Expected F1: 0.XX (from manual review)
```

**Success Criteria:**
- ✅ Template created
- ✅ Template includes all metadata
- ✅ Easy to use for contributors

---

### Task 4.2: Create 15 New Golden Cases
**Effort:** 8-12 hours (collaborative)

**Distribution:**
- 3 cases: Unicode/emoji edge cases
- 3 cases: Very long texts (1000+ words)
- 3 cases: Adversarial (intentionally misleading AI translations)
- 3 cases: Cultural nuances (honorifics, idioms)
- 3 cases: Technical terminology (game mechanics, stats)

**Process:**
1. Find real translation examples
2. Manually label expected markers
3. Calculate manual F1 score
4. Add to `golden-cases.json`
5. Run test to verify F1 threshold

**Success Criteria:**
- ✅ 20+ total golden cases (5 existing + 15 new)
- ✅ All categories represented
- ✅ Cases cover difficulty spectrum
- ✅ All cases pass with F1 > threshold

---

### Task 4.3: Add Golden Test Report Dashboard
**Effort:** 2-3 hours

**File:** `tests/gold/diff/generate-report.ts`

```typescript
// Generates HTML dashboard showing:
// - F1 scores by case
// - Precision/recall breakdown
// - Trend over time
// - Failure analysis

import fs from 'fs';
import path from 'path';

interface TestRun {
  timestamp: string;
  cases: {
    id: string;
    f1: number;
    precision: number;
    recall: number;
    passed: boolean;
  }[];
}

export function generateReport(runs: TestRun[]) {
  const html = `
    <!DOCTYPE html>
    <html>
    <head><title>Golden Test Dashboard</title></head>
    <body>
      <h1>Diff Analysis Golden Tests</h1>
      <table>
        <tr>
          <th>Case</th>
          <th>F1 Score</th>
          <th>Precision</th>
          <th>Recall</th>
          <th>Status</th>
        </tr>
        ${runs[runs.length - 1].cases.map(c => `
          <tr>
            <td>${c.id}</td>
            <td>${c.f1.toFixed(3)}</td>
            <td>${c.precision.toFixed(3)}</td>
            <td>${c.recall.toFixed(3)}</td>
            <td>${c.passed ? '✅' : '❌'}</td>
          </tr>
        `).join('')}
      </table>
    </body>
    </html>
  `;

  fs.writeFileSync(path.join(__dirname, 'report.html'), html);
}
```

**Success Criteria:**
- ✅ Dashboard shows all golden cases
- ✅ Trend analysis over time
- ✅ Easy to identify regressions

---

## Phase 5: Testing Standards Documentation (Medium Value)
**Priority:** 🟢 Medium Value
**Estimated Time:** 1-2 days
**Owner:** TBD

### Task 5.1: Create Testing Standards Guide
**Effort:** 3-4 hours

**File:** `docs/TESTING-STANDARDS.md`

**Contents:**
1. **When to write which type of test**
   - Unit vs Integration vs E2E decision tree
   - Property-based vs example-based tests

2. **The Nokkukuthi Checklist**
   - How to avoid scarecrow tests
   - Red flags in code review

3. **Test Quality Checklist**
   ```markdown
   Before submitting a test:
   - [ ] Does it test a property or invariant?
   - [ ] Would it fail if the logic changed?
   - [ ] Does it use hard-coded expected values?
   - [ ] Is it resilient to refactoring?
   - [ ] Does it have diagnostic value?
   ```

4. **Examples from Codebase**
   - Good test: Golden dataset tests
   - Good test: HTML sanitizer security tests
   - Borderline test: Heavy mock setups

5. **Mutation Testing Guide**
   - How to interpret mutation reports
   - How to fix surviving mutants
   - Target mutation scores

**Success Criteria:**
- ✅ Comprehensive guide published
- ✅ Reviewed by team
- ✅ Referenced in PR template

---

### Task 5.2: Add PR Template with Test Checklist
**Effort:** 30 minutes

**File:** `.github/pull_request_template.md`

```markdown
## Description
[Describe your changes]

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing Checklist
- [ ] Unit tests added/updated
- [ ] Integration tests added (if applicable)
- [ ] E2E tests added (if user-facing change)
- [ ] Tests follow Nokkukuthi checklist
- [ ] Mutation tests pass (for critical modules)
- [ ] Property-based tests added (for security code)

## Mutation Testing
- Mutation score: XX%
- Surviving mutants: X (explain why acceptable)

## Documentation
- [ ] Updated relevant docs
- [ ] Added JSDoc comments
- [ ] Updated CHANGELOG.md
```

**Success Criteria:**
- ✅ Template enforces test quality
- ✅ Mutation score reported in PRs
- ✅ Team uses template consistently

---

### Task 5.3: Create Test Examples Repository
**Effort:** 2-3 hours

**File:** `tests/examples/` directory structure

```
tests/examples/
├── README.md
├── unit-test-example.test.ts
├── integration-test-example.test.ts
├── property-test-example.test.ts
├── golden-test-example.test.ts
├── contract-test-example.test.ts
└── anti-patterns/
    ├── mirror-test.bad.ts
    ├── any-trap.bad.ts
    └── setup-heavy.bad.ts
```

**Each file includes:**
- Annotated code explaining why it's good/bad
- Common mistakes to avoid
- How to improve

**Success Criteria:**
- ✅ Examples for all test types
- ✅ Anti-pattern examples with explanations
- ✅ Team trained on examples

---

## Phase 6: CI/CD Quality Gates (Medium Value)
**Priority:** 🟢 Medium Value
**Estimated Time:** 1-2 days
**Owner:** TBD

### Task 6.1: Add Pre-Commit Hooks
**Effort:** 1-2 hours

```bash
npm install --save-dev husky lint-staged
npx husky install
```

**Configuration:**
```json
// package.json
{
  "lint-staged": {
    "*.{ts,tsx}": [
      "eslint --fix",
      "vitest related --run"
    ]
  },
  "husky": {
    "hooks": {
      "pre-commit": "lint-staged",
      "pre-push": "npm run test:coverage"
    }
  }
}
```

**Success Criteria:**
- ✅ Tests run before commit
- ✅ Failing tests block commit
- ✅ Coverage checked before push

---

### Task 6.2: Add GitHub Actions Quality Checks
**Effort:** 2-3 hours

**File:** `.github/workflows/quality.yml`

```yaml
name: Code Quality

on:
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run unit tests
        run: npm run test -- --coverage

      - name: Check coverage thresholds
        run: |
          if ! npx vitest --coverage.enabled --coverage.reporter=json; then
            echo "Coverage below thresholds!"
            exit 1
          fi

      - name: Run E2E tests
        run: npm run test:e2e

      - name: Upload coverage
        uses: codecov/codecov-action@v3

  mutation:
    runs-on: ubuntu-latest
    if: github.event_name == 'pull_request'
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3

      - name: Install dependencies
        run: npm ci

      - name: Run mutation tests
        run: npm run test:mutate

      - name: Check mutation score
        run: |
          SCORE=$(jq '.mutationScore' reports/mutation/mutation.json)
          if (( $(echo "$SCORE < 70" | bc -l) )); then
            echo "Mutation score $SCORE% below threshold!"
            exit 1
          fi
```

**Success Criteria:**
- ✅ All quality checks run on PRs
- ✅ Failing checks block merge
- ✅ Coverage reports visible in PRs

---

## Timeline & Dependencies

### Critical Path (Sequential)
```
Week 1:
├── Day 1-2: Phase 1 (E2E Stabilization)
├── Day 3-5: Phase 2.1-2.2 (Mutation Testing Setup & Baseline)

Week 2:
├── Day 1-3: Phase 2.3 (Fix Nokkukuthi Tests)
├── Day 4-5: Phase 3.1-3.2 (Property Testing Setup)

Week 3:
├── Day 1-2: Phase 3.3-3.4 (Property Tests Implementation)
├── Day 3-5: Phase 4 (Golden Dataset Expansion)

Week 4:
├── Day 1-2: Phase 5 (Documentation)
├── Day 3-4: Phase 6 (CI/CD)
├── Day 5: Buffer for overruns
```

### Parallel Tracks (Can be done simultaneously)
- Phase 3 (Property Testing) can start while Phase 2.3 is ongoing
- Phase 5 (Documentation) can be written anytime
- Phase 6 (CI/CD) can be configured while waiting for tests

---

## Success Metrics

### Phase 1 Success:
- ✅ E2E tests pass 100% of time
- ✅ All 5 initialization tests passing
- ✅ Test runtime < 30 seconds

### Phase 2 Success:
- ✅ Mutation score ≥ 70% for critical modules:
  - `services/diff/DiffAnalysisService.ts`: ≥ 75%
  - `services/HtmlSanitizer.ts`: ≥ 85%
  - `services/HtmlRepairService.ts`: ≥ 75%
  - `adapters/repo/**`: ≥ 70%
- ✅ Zero surviving mutants in security code
- ✅ Mutation tests in CI/CD

### Phase 3 Success:
- ✅ Property tests for HtmlSanitizer (10+ properties)
- ✅ Property tests for cost calculations (5+ properties)
- ✅ Found and fixed ≥ 1 edge case bug
- ✅ Property tests run in < 10 seconds

### Phase 4 Success:
- ✅ 20+ golden cases (up from 5)
- ✅ All difficulty levels represented
- ✅ F1 scores documented for all cases
- ✅ Dashboard shows test health

### Phase 5 Success:
- ✅ Testing standards guide published
- ✅ PR template includes test checklist
- ✅ Test examples repository created
- ✅ Team trained on standards

### Phase 6 Success:
- ✅ Pre-commit hooks installed
- ✅ CI/CD runs all quality checks
- ✅ Failing checks block merge
- ✅ Coverage reports visible

---

## Risk Assessment

### High Risk Items:
1. **Phase 1 - E2E Stabilization**
   - Risk: Tests may still be flaky after fixes
   - Mitigation: Have fallback plan (Option 1B - skip tests)
   - Impact: Blocks other phases

2. **Phase 2.3 - Fixing Nokkukuthi Tests**
   - Risk: May find many weak tests, time-consuming
   - Mitigation: Prioritize security-critical modules first
   - Impact: Delays mutation score target

### Medium Risk Items:
1. **Phase 3 - Property Testing**
   - Risk: Team unfamiliar with property-based testing
   - Mitigation: Provide training and examples
   - Impact: Slower adoption

2. **Phase 4 - Golden Dataset**
   - Risk: Finding good golden cases is time-intensive
   - Mitigation: Collaborate with translation experts
   - Impact: Quality improvement delayed

### Low Risk Items:
1. **Phase 5 - Documentation**
   - Risk: Minimal technical risk
   - Impact: Limited if delayed

2. **Phase 6 - CI/CD**
   - Risk: Standard DevOps work
   - Impact: Quality gates not enforced

---

## Open Questions for Review

### Technical Decisions:
1. **E2E Strategy:** Should we go with Option 1A (fresh context), 1B (skip + integration), or 1C (production build)?
2. **Mutation Scope:** Should we mutate all code or only critical modules initially?
3. **Property Testing:** Should we use fast-check or another library (jsverify, testcheck)?
4. **Golden Dataset:** Should we involve external translators or keep it internal?

### Process Decisions:
1. **Quality Gates:** Should we block merges on mutation score or just warn?
2. **Test Ownership:** Who maintains golden datasets long-term?
3. **CI/CD Budget:** How much time can we spend on mutation testing in CI? (it's slow)
4. **Training:** Should we do a team workshop on property-based testing?

### Resource Allocation:
1. **Time Commitment:** Can we dedicate 3-4 weeks to this work?
2. **Team Size:** How many developers will work on this?
3. **Priority:** Can this be prioritized over feature work?

---

## Appendix: Related Documents

### Investigation & Analysis:
- `docs/E2E-DELETE-DATABASE-ROOT-CAUSE.md` - 450+ line root cause analysis
- `docs/E2E-INVESTIGATION-SUMMARY.md` - Complete investigation summary
- `docs/TEST-QUALITY-ANALYSIS.md` - Test quality evaluation (this document's basis)
- `tests/e2e/examples/indexeddb-test-strategies.spec.ts` - Solution examples

### Existing Tests:
- `tests/gold/diff/diff-golden.test.ts` - Example of excellent testing (8.0/10)
- `tests/contracts/provider.contract.test.ts` - Example of contract testing (8.5/10)
- `tests/services/HtmlSanitizer.test.ts` - Example of security testing

### Configuration:
- `vitest.config.ts` - Current test configuration
- `playwright.config.ts` - E2E test configuration

---

## Approval & Sign-Off

**Proposed By:** Claude (Sonnet 4.5)
**Date:** 2025-11-15
**Status:** Awaiting Review

**Review Checklist:**
- [ ] Technical approach validated
- [ ] Timeline realistic
- [ ] Success metrics agreed
- [ ] Resources allocated
- [ ] Risks acknowledged
- [ ] Open questions answered

**Approved By:** ________________
**Date:** ________________

**Notes:**
[Space for reviewer comments]

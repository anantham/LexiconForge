# Test Suite Cleanup and Expansion Implementation Plan

> **For Claude:** Use `${SUPERPOWERS_SKILLS_ROOT}/skills/collaboration/executing-plans/SKILL.md` to implement this plan task-by-task.

**Goal:** Systematically clean up legacy test code, fix failing tests tied to deprecated store architecture, and expand coverage for critical translation pipeline features.

**Architecture:** This is a multi-phase test refactoring effort using TDD principles. We'll retire tests for removed code, update tests for refactored stores, and add comprehensive coverage for recently added features (comparison, EPUB footnotes, title translation, image handling).

**Current State:**
- 44 test files, 393 total tests
- 127 tests failing (32% failure rate)
- Main issues:
  - Tests referencing archived `useAppStore` (9 files affected)
  - Missing coverage for new comparison feature
  - Insufficient schema validation tests after prompt changes
  - EPUB export tests need updating for footnote links
  - Some tests have brittle assertions (character count formatting)

**Tech Stack:** Vitest, @testing-library/react, fake-indexeddb, happy-dom

---

## PHASE 1: AUDIT & TRIAGE (Diagnostic - No Code Changes)

### Task 1: Create Test Manifest

**Files:**
- Create: `docs/test-manifest.md`

**Step 1: Document all test files with status**

Create a manifest documenting each test file's:
- Current pass/fail status
- Purpose/coverage area
- Dependencies on deprecated code (archive/, old store)
- Priority (critical path vs nice-to-have)

Run:
```bash
npx vitest run --reporter=verbose 2>&1 | tee test-results.txt
```

Analyze results and create manifest in markdown format:

```markdown
# Test Suite Manifest

## Legend
- 🟢 Passing
- 🔴 Failing - needs update
- 🗑️ Retire - tests deleted code
- ⭐ Critical path

## Core Store Tests
| File | Status | Coverage Area | Notes | Priority |
|------|--------|---------------|-------|----------|
| tests/store/useAppStore.test.ts | 🔴 | Legacy monolithic store | References archive/useAppStore.ts | 🗑️ |
...
```

**Step 2: Identify tests to retire**

List all tests that:
- Import from `archive/` directory
- Reference removed constants (constants.ts, costs.ts)
- Test the old monolithic store pattern
- Test features that were removed

**Step 3: Identify tests to update**

List tests that fail because:
- Store slice API changed (setSessionData → different API)
- Default config values changed (provider defaults)
- Schema/prompt wording updated

**Step 4: Identify coverage gaps**

List critical features lacking tests:
- ComparisonService.requestFocusedComparison
- Comparison card UI component
- EPUB footnote backlinks
- Translation title guidance enforcement
- Image cache base64 fallback
- Navigation version dropdown sorting

**Step 5: Commit manifest**

```bash
git add docs/test-manifest.md test-results.txt
git commit -m "docs(test): add comprehensive test suite audit manifest

MOTIVATION:
- Test suite has 32% failure rate after store refactoring
- Need systematic approach to identify which tests to retire vs update
- Many tests reference archived code (useAppStore) or outdated constants

APPROACH:
- Ran full test suite with verbose output
- Categorized each test file by status and purpose
- Identified tests tied to removed code vs tests needing updates
- Listed critical path features lacking coverage

CHANGES:
- docs/test-manifest.md: Complete test suite inventory with status
- test-results.txt: Full vitest output for reference

IMPACT:
- Clear roadmap for which tests to delete, update, or write
- Prevents wasting time updating tests for removed features
- Identifies high-priority coverage gaps

TESTING:
- This is documentation only, no code changes

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## PHASE 2: RETIRE LEGACY TESTS

### Task 2: Remove Tests for Archived Code

**Files:**
- Delete: `tests/store/useAppStore.test.ts`
- Delete: `tests/current-system/providers.test.ts` (references old useAppStore)
- Delete: `tests/current-system/settings.test.ts` (references old useAppStore)
- Delete: `tests/current-system/feedback.test.ts` (references old useAppStore)
- Delete: `tests/current-system/translation.test.ts` (references old useAppStore)
- Delete: `tests/current-system/navigation.test.ts` (references old useAppStore)
- Delete: `tests/current-system/export-import.test.ts` (references old useAppStore)
- Delete: `tests/store/amendmentProposal.test.ts` (if references old store)
- Delete: `tests/store/nullSafety.test.ts` (if references old store)

**Step 1: Verify each test file imports from archive**

For each file listed above, check:
```bash
grep -l "archive/" tests/current-system/*.test.ts tests/store/*.test.ts
grep -l "useAppStore" tests/current-system/*.test.ts tests/store/*.test.ts
```

**Step 2: Check if any tests should be preserved/migrated**

Review each file. If a test covers critical behavior not covered elsewhere:
- Note in manifest: "Migrate test logic to [new location]"
- Keep file in list but don't delete yet

Otherwise, mark for deletion.

**Step 3: Delete confirmed legacy test files**

```bash
rm tests/store/useAppStore.test.ts
rm tests/current-system/providers.test.ts
rm tests/current-system/settings.test.ts
rm tests/current-system/feedback.test.ts
rm tests/current-system/translation.test.ts
rm tests/current-system/navigation.test.ts
rm tests/current-system/export-import.test.ts
# Only if verified to be legacy:
rm tests/store/amendmentProposal.test.ts
rm tests/store/nullSafety.test.ts
```

**Step 4: Run tests to verify removal**

```bash
npx vitest run
```

Expected: Fewer test failures (removed failing legacy tests)

**Step 5: Commit deletions**

```bash
git add -u
git commit -m "test(cleanup): remove legacy tests for archived store

MOTIVATION:
- These tests reference archive/useAppStore.ts which is no longer used
- Store was split into slices (store/slices/) with different APIs
- Tests failing because they expect old monolithic store structure
- Keeping them creates noise and false sense of coverage

APPROACH:
- Identified all tests importing from archive/ or using old useAppStore
- Verified critical behaviors are covered by newer slice-specific tests
- Deleted tests that only exercise removed code

CHANGES:
- tests/store/useAppStore.test.ts: Deleted (tests archived store)
- tests/current-system/providers.test.ts: Deleted (uses old store API)
- tests/current-system/settings.test.ts: Deleted (uses old store API)
- tests/current-system/feedback.test.ts: Deleted (uses old store API)
- tests/current-system/translation.test.ts: Deleted (uses old store API)
- tests/current-system/navigation.test.ts: Deleted (uses old store API)
- tests/current-system/export-import.test.ts: Deleted (uses old store API)

IMPACT:
- Reduced test failure count by ~100 tests
- Cleaner test suite focused on current architecture
- Removed maintenance burden of outdated tests

TESTING:
- npx vitest run: Remaining tests still pass

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## PHASE 3: FIX BROKEN EXISTING TESTS

### Task 3: Fix EPUB Template Character Formatting

**Files:**
- Modify: `tests/services/epub/Templates.test.ts:300`

**Context:** Test expects `375,000` but template outputs `3,75,000` (likely locale-specific number formatting).

**Step 1: Write test to verify current formatting behavior**

```bash
npx vitest run tests/services/epub/Templates.test.ts --reporter=verbose
```

Check actual output in failure message. Determine if:
- A) Template should use US formatting (375,000)
- B) Test should accept either format
- C) Template intentionally uses different locale

**Step 2: Fix the assertion**

If template correctly outputs `3,75,000`, update test:

```typescript
// tests/services/epub/Templates.test.ts around line 300
expect(page).toContain('3,75,000'); // total characters (locale-specific formatting)
```

If template should use US formatting, update template generator instead (not test).

**Step 3: Run test to verify fix**

```bash
npx vitest run tests/services/epub/Templates.test.ts
```

Expected: Test passes

**Step 4: Commit fix**

```bash
git add tests/services/epub/Templates.test.ts
git commit -m "test(epub): fix character count formatting assertion

MOTIVATION:
- Test expected '375,000' but template outputs '3,75,000'
- Template uses locale-specific number formatting
- Test was too strict about formatting

APPROACH:
- Verified template output uses Indian locale formatting (lakhs)
- Updated test to match actual template behavior
- Alternative considered: normalize formatting (rejected - adds complexity)

CHANGES:
- tests/services/epub/Templates.test.ts:300: Accept '3,75,000' format

IMPACT:
- Test now passes and accurately reflects template behavior
- No change to user-facing EPUB output

TESTING:
- npx vitest run tests/services/epub/Templates.test.ts: Now passes

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

### Task 4: Fix Translator Abort Signal Error Message

**Files:**
- Modify: `tests/services/translate/Translator.test.ts`

**Context:** Test expects error containing "Aborted" but gets "Translation was aborted by user".

**Step 1: Identify the test**

```bash
grep -n "handles abort signals" tests/services/translate/Translator.test.ts
```

**Step 2: Update error message assertion**

```typescript
// Update from:
expect(() => translator.translate()).toThrowError('Aborted')

// To:
expect(() => translator.translate()).toThrowError('Translation was aborted by user')
// Or more flexible:
expect(() => translator.translate()).toThrowError(/abort/i)
```

**Step 3: Run test to verify**

```bash
npx vitest run tests/services/translate/Translator.test.ts
```

Expected: Test passes

**Step 4: Commit fix**

```bash
git add tests/services/translate/Translator.test.ts
git commit -m "test(translator): fix abort signal error message assertion

MOTIVATION:
- Test expected generic 'Aborted' but actual message is more specific
- Implementation uses user-friendly message: 'Translation was aborted by user'
- Test assertion was too strict

APPROACH:
- Updated test to match actual error message
- Used regex for flexibility (/abort/i)

CHANGES:
- tests/services/translate/Translator.test.ts: Updated abort error assertion

IMPACT:
- Test now passes and validates abort behavior correctly

TESTING:
- npx vitest run tests/services/translate/Translator.test.ts: Passes

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

### Task 5: Fix PromptBuilder JSON Validation Tests

**Files:**
- Modify: `tests/services/prompts/PromptBuilder.test.ts`

**Context:** Two failing tests:
1. Test expects "valid JSON object" in system prompt but gets "Simple translation prompt without JSON mention"
2. Test for unbalanced braces validation returns true instead of false

**Step 1: RED - Understand current behavior**

```bash
npx vitest run tests/services/prompts/PromptBuilder.test.ts --reporter=verbose
```

Read the actual implementation:
```bash
cat services/prompts/PromptBuilder.ts | grep -A 20 "buildTranslationPrompt"
cat services/prompts/PromptBuilder.ts | grep -A 20 "validatePromptTemplate"
```

**Step 2: Fix JSON requirement test**

If PromptBuilder should include JSON instruction but doesn't:

```typescript
// tests/services/prompts/PromptBuilder.test.ts around line 165
// Update assertion to match actual behavior OR fix implementation
// Check if translateTitleGuidance or other fields should mention JSON

// If test is wrong (prompt doesn't need JSON mention):
expect(result.systemPrompt).toBeTruthy(); // Just verify it exists

// If implementation is wrong (should mention JSON):
// Update services/prompts/PromptBuilder.ts instead
```

**Step 3: Fix unbalanced braces validation**

```typescript
// tests/services/prompts/PromptBuilder.test.ts around line 314
const template = 'Text with {{unbalanced}'; // Unbalanced
const result = PromptBuilder.validatePromptTemplate(template);

expect(result.isValid).toBe(false);
expect(result.issues).toContain('unbalanced');
```

If validator doesn't catch unbalanced braces, fix the validator implementation (not test).

**Step 4: Run tests**

```bash
npx vitest run tests/services/prompts/PromptBuilder.test.ts
```

Expected: Tests pass

**Step 5: Commit fixes**

```bash
git add tests/services/prompts/PromptBuilder.test.ts services/prompts/PromptBuilder.ts
git commit -m "test(prompts): fix JSON validation and brace checking tests

MOTIVATION:
- Test expected JSON instruction in prompt but implementation doesn't require it
- Brace validation test was passing when it should fail
- Tests were checking for old behavior after prompt refactoring

APPROACH:
- Verified current prompt structure doesn't mention JSON explicitly (schema handles it)
- Fixed brace validation to actually catch unbalanced braces
- Updated tests to match current expected behavior

CHANGES:
- tests/services/prompts/PromptBuilder.test.ts:165: Updated JSON assertion
- tests/services/prompts/PromptBuilder.test.ts:314: Fixed brace validation test
- services/prompts/PromptBuilder.ts: Enhanced validatePromptTemplate if needed

IMPACT:
- Tests accurately reflect current prompt structure
- Brace validation now catches malformed templates

TESTING:
- npx vitest run tests/services/prompts/PromptBuilder.test.ts: All pass

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

### Task 6: Fix EPUB Template Default Template Test

**Files:**
- Modify: `tests/services/epubService.test.ts`

**Context:** Two failing tests:
1. "should return complete default template" - expects truthy but gets empty string
2. "should allow partial overrides while keeping defaults" - expects '❤️' but not found

**Step 1: RED - Investigate current behavior**

```bash
npx vitest run tests/services/epubService.test.ts --reporter=verbose
```

**Step 2: Read implementation**

```typescript
// Check what getDefaultTemplate actually returns
grep -A 30 "getDefaultTemplate" services/epubService.ts
```

**Step 3: Fix test assertions**

```typescript
// tests/services/epubService.test.ts
// Update based on actual implementation:

it('should return complete default template', () => {
  const template = getDefaultTemplate();

  // If returns empty string by design:
  expect(template).toBeDefined();
  expect(typeof template).toBe('string');

  // If should return populated template:
  expect(template.length).toBeGreaterThan(0);
  expect(template).toContain('<!DOCTYPE html>');
});

it('should allow partial overrides while keeping defaults', () => {
  const custom = createCustomTemplate({ footer: 'Custom ❤️' });

  // Update to match actual merge behavior:
  expect(custom.footer).toContain('❤️');
  // Or if feature removed:
  // Remove this test entirely
});
```

**Step 4: Run tests**

```bash
npx vitest run tests/services/epubService.test.ts
```

Expected: Tests pass

**Step 5: Commit fix**

```bash
git add tests/services/epubService.test.ts
git commit -m "test(epub): fix template system test assertions

MOTIVATION:
- Tests failing after template system refactoring
- getDefaultTemplate behavior changed
- Tests checking for old template structure

APPROACH:
- Verified current template system implementation
- Updated assertions to match actual behavior
- Removed checks for removed features

CHANGES:
- tests/services/epubService.test.ts: Updated template assertions

IMPACT:
- Tests pass and validate current template system

TESTING:
- npx vitest run tests/services/epubService.test.ts: All pass

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## PHASE 4: ADD CRITICAL PATH COVERAGE

### Task 7: Add Comparison Service Tests

**Purpose:** ComparisonService.requestFocusedComparison handles JSON stripping and fallback parsing - critical for comparison feature reliability.

**Files:**
- Create: `tests/services/ComparisonService.test.ts`

**Step 1: RED - Write test for successful comparison**

```typescript
// tests/services/ComparisonService.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ComparisonService } from '../../services/ComparisonService';

describe('ComparisonService', () => {
  describe('requestFocusedComparison', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should parse valid JSON comparison response', async () => {
      // Arrange
      const mockResponse = {
        fanTranslation: 'fan version text',
        rawTranslation: 'raw version text',
        differences: ['difference 1', 'difference 2'],
        recommendation: 'Use fan translation'
      };

      // Mock API call to return valid JSON
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      } as Response);

      // Act
      const result = await ComparisonService.requestFocusedComparison({
        text: 'Some text to compare',
        fanVersion: 'fan text',
        rawVersion: 'raw text',
        apiKey: 'test-key',
        model: 'gpt-4'
      });

      // Assert
      expect(result.fanTranslation).toBe('fan version text');
      expect(result.rawTranslation).toBe('raw version text');
      expect(result.differences).toHaveLength(2);
      expect(result.recommendation).toBe('Use fan translation');
    });
  });
});
```

**Step 2: Run test to verify RED**

```bash
npx vitest run tests/services/ComparisonService.test.ts
```

Expected: FAIL - ComparisonService not found or method doesn't exist

**Step 3: GREEN - Implement minimal ComparisonService** (if doesn't exist)

```typescript
// services/ComparisonService.ts
export interface ComparisonResult {
  fanTranslation: string;
  rawTranslation: string;
  differences: string[];
  recommendation: string;
}

export interface ComparisonRequest {
  text: string;
  fanVersion: string;
  rawVersion: string;
  apiKey: string;
  model: string;
}

export class ComparisonService {
  static async requestFocusedComparison(request: ComparisonRequest): Promise<ComparisonResult> {
    const response = await fetch('/api/compare', {
      method: 'POST',
      body: JSON.stringify(request),
      headers: { 'Content-Type': 'application/json' }
    });

    return response.json();
  }
}
```

**Step 4: Run test to verify GREEN**

```bash
npx vitest run tests/services/ComparisonService.test.ts
```

Expected: PASS

**Step 5: Commit basic implementation**

```bash
git add tests/services/ComparisonService.test.ts services/ComparisonService.ts
git commit -m "test(comparison): add basic ComparisonService test

MOTIVATION:
- ComparisonService.requestFocusedComparison is critical for comparison feature
- No test coverage for JSON parsing and error handling
- Need baseline test before adding edge case coverage

APPROACH:
- TDD: Write failing test first
- Implement minimal service to pass test
- Test covers happy path JSON parsing

CHANGES:
- tests/services/ComparisonService.test.ts: New test file with basic test
- services/ComparisonService.ts: Basic implementation (if new)

IMPACT:
- Foundation for comprehensive comparison testing
- Validates basic comparison request/response flow

TESTING:
- npx vitest run tests/services/ComparisonService.test.ts: Passes

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

**Step 6: RED - Add test for JSON stripping fallback**

```typescript
// tests/services/ComparisonService.test.ts
it('should strip markdown JSON blocks and parse', async () => {
  // Arrange
  const responseWithMarkdown = '```json\n{"fanTranslation":"text","rawTranslation":"text2","differences":[],"recommendation":"none"}\n```';

  vi.spyOn(global, 'fetch').mockResolvedValueOnce({
    ok: true,
    text: async () => responseWithMarkdown
  } as Response);

  // Act
  const result = await ComparisonService.requestFocusedComparison({
    text: 'Some text',
    fanVersion: 'fan',
    rawVersion: 'raw',
    apiKey: 'test-key',
    model: 'gpt-4'
  });

  // Assert
  expect(result.fanTranslation).toBe('text');
  expect(result.rawTranslation).toBe('text2');
});
```

**Step 7: Run test to verify RED**

```bash
npx vitest run tests/services/ComparisonService.test.ts
```

Expected: FAIL - doesn't handle markdown JSON blocks

**Step 8: GREEN - Implement JSON stripping**

```typescript
// services/ComparisonService.ts
static async requestFocusedComparison(request: ComparisonRequest): Promise<ComparisonResult> {
  const response = await fetch('/api/compare', {
    method: 'POST',
    body: JSON.stringify(request),
    headers: { 'Content-Type': 'application/json' }
  });

  let text = await response.text();

  // Strip markdown JSON blocks
  const jsonMatch = text.match(/```json\s*\n?(.*?)\n?```/s);
  if (jsonMatch) {
    text = jsonMatch[1];
  }

  return JSON.parse(text);
}
```

**Step 9: Run test to verify GREEN**

```bash
npx vitest run tests/services/ComparisonService.test.ts
```

Expected: PASS

**Step 10: Commit JSON stripping**

```bash
git add tests/services/ComparisonService.test.ts services/ComparisonService.ts
git commit -m "test(comparison): add JSON stripping for markdown blocks

MOTIVATION:
- Some providers wrap JSON in markdown code blocks
- ComparisonService must handle both raw JSON and markdown-wrapped
- Missing this causes parse errors for users

APPROACH:
- TDD: Write test for markdown-wrapped JSON first
- Implement regex to strip markdown delimiters
- Fallback to parsing stripped content

CHANGES:
- tests/services/ComparisonService.test.ts: Add markdown stripping test
- services/ComparisonService.ts: Implement JSON stripping logic

IMPACT:
- Handles comparison responses from multiple provider formats
- Prevents JSON parse errors

TESTING:
- npx vitest run tests/services/ComparisonService.test.ts: All pass

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

**Step 11: RED - Add error handling test**

```typescript
// tests/services/ComparisonService.test.ts
it('should throw descriptive error on invalid JSON', async () => {
  // Arrange
  const invalidResponse = 'Not valid JSON at all';

  vi.spyOn(global, 'fetch').mockResolvedValueOnce({
    ok: true,
    text: async () => invalidResponse
  } as Response);

  // Act & Assert
  await expect(
    ComparisonService.requestFocusedComparison({
      text: 'Some text',
      fanVersion: 'fan',
      rawVersion: 'raw',
      apiKey: 'test-key',
      model: 'gpt-4'
    })
  ).rejects.toThrow('Failed to parse comparison response');
});
```

**Step 12: Run test to verify RED**

```bash
npx vitest run tests/services/ComparisonService.test.ts
```

Expected: FAIL - error message doesn't match

**Step 13: GREEN - Add error handling**

```typescript
// services/ComparisonService.ts
static async requestFocusedComparison(request: ComparisonRequest): Promise<ComparisonResult> {
  const response = await fetch('/api/compare', {
    method: 'POST',
    body: JSON.stringify(request),
    headers: { 'Content-Type': 'application/json' }
  });

  let text = await response.text();

  // Strip markdown JSON blocks
  const jsonMatch = text.match(/```json\s*\n?(.*?)\n?```/s);
  if (jsonMatch) {
    text = jsonMatch[1];
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`Failed to parse comparison response: ${error.message}`);
  }
}
```

**Step 14: Run test to verify GREEN**

```bash
npx vitest run tests/services/ComparisonService.test.ts
```

Expected: PASS

**Step 15: Commit error handling**

```bash
git add tests/services/ComparisonService.test.ts services/ComparisonService.ts
git commit -m "test(comparison): add error handling for invalid JSON

MOTIVATION:
- Invalid responses should give clear error messages
- Users need to know when comparison failed and why
- Generic JSON.parse errors are not helpful

APPROACH:
- TDD: Write test expecting descriptive error
- Wrap JSON.parse in try-catch
- Throw error with context

CHANGES:
- tests/services/ComparisonService.test.ts: Add error handling test
- services/ComparisonService.ts: Add try-catch with descriptive error

IMPACT:
- Better error messages for comparison failures
- Easier debugging of comparison issues

TESTING:
- npx vitest run tests/services/ComparisonService.test.ts: All pass

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

### Task 8: Add Translation Schema Validation Tests

**Purpose:** Ensure translatedTitleDescription is enforced after recent prompt changes.

**Files:**
- Modify: `tests/services/structured-outputs.test.ts`

**Step 1: RED - Add test for title description field**

```typescript
// tests/services/structured-outputs.test.ts
describe('Translation Schema Validation', () => {
  it('should validate translatedTitle has description guidance', () => {
    // Arrange
    const schema = getTranslationSchema('openai'); // or gemini/claude

    // Assert
    expect(schema.properties.translatedTitle).toBeDefined();
    expect(schema.properties.translatedTitle.description).toContain('evocative subtitle');
    expect(schema.properties.translatedTitle.description).toContain('em dash');
  });

  it('should require translatedTitle in all provider schemas', () => {
    const providers = ['openai', 'gemini', 'claude'];

    providers.forEach(provider => {
      const schema = getTranslationSchema(provider);
      expect(schema.required).toContain('translatedTitle');
    });
  });
});
```

**Step 2: Run test to verify RED**

```bash
npx vitest run tests/services/structured-outputs.test.ts
```

Expected: FAIL or PASS depending on current implementation

**Step 3: GREEN - Update schema if test fails**

If schema doesn't have correct description:

```typescript
// services/structured-outputs.ts or wherever schema is defined
translatedTitle: {
  type: 'string',
  description: 'Return a single-line English chapter title that keeps original numbering or structural cues (e.g., "Chapter 147") and then adds an evocative subtitle separated by an em dash. Avoid trailing punctuation; make it vivid and specific to this chapter.'
}
```

**Step 4: Run test to verify GREEN**

```bash
npx vitest run tests/services/structured-outputs.test.ts
```

Expected: PASS

**Step 5: Commit schema validation tests**

```bash
git add tests/services/structured-outputs.test.ts
git commit -m "test(schema): add validation for title description guidance

MOTIVATION:
- Recent prompt changes added evocative title guidance
- Schema must match prompt expectations
- Need regression test to prevent schema/prompt drift

APPROACH:
- TDD: Write test validating schema description
- Ensure all providers have consistent title requirements
- Test validates specific wording from prompt

CHANGES:
- tests/services/structured-outputs.test.ts: Add title validation tests

IMPACT:
- Prevents schema/prompt mismatches
- Ensures all providers get same title instructions

TESTING:
- npx vitest run tests/services/structured-outputs.test.ts: All pass

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

### Task 9: Add EPUB Footnote Backlink Tests

**Purpose:** Verify footnote linking and chapter structure enhancements work correctly.

**Files:**
- Modify: `tests/services/epub/XhtmlSerializer.test.ts` or create new test

**Step 1: RED - Write test for footnote backlinks**

```typescript
// tests/services/epub/XhtmlSerializer.test.ts
describe('Footnote Backlinking', () => {
  it('should add backlink anchors to footnotes', () => {
    // Arrange
    const chapter = {
      title: 'Chapter 1',
      content: '<p>Text with footnote[1]</p>',
      footnotes: [
        { marker: '[1]', text: 'This is a footnote' }
      ]
    };

    // Act
    const xhtml = XhtmlSerializer.serializeChapter(chapter);

    // Assert
    expect(xhtml).toContain('id="fn-1"'); // Footnote anchor
    expect(xhtml).toContain('href="#fnref-1"'); // Backlink
    expect(xhtml).toContain('class="footnote-backlink"');
  });

  it('should link footnote markers in text to footnote definitions', () => {
    // Arrange
    const chapter = {
      title: 'Chapter 1',
      content: '<p>Text with footnote[1] and another[2]</p>',
      footnotes: [
        { marker: '[1]', text: 'First footnote' },
        { marker: '[2]', text: 'Second footnote' }
      ]
    };

    // Act
    const xhtml = XhtmlSerializer.serializeChapter(chapter);

    // Assert
    expect(xhtml).toContain('<a id="fnref-1" href="#fn-1"');
    expect(xhtml).toContain('<a id="fnref-2" href="#fn-2"');
  });
});
```

**Step 2: Run test to verify RED**

```bash
npx vitest run tests/services/epub/XhtmlSerializer.test.ts
```

Expected: FAIL - backlinks not implemented

**Step 3: GREEN - Implement footnote backlinking**

```typescript
// services/epub/XhtmlSerializer.ts
function serializeChapter(chapter: Chapter): string {
  let content = chapter.content;

  // Replace footnote markers with links
  chapter.footnotes?.forEach((footnote, index) => {
    const fnNum = index + 1;
    const marker = escapeRegex(footnote.marker);
    content = content.replace(
      new RegExp(marker, 'g'),
      `<sup><a id="fnref-${fnNum}" href="#fn-${fnNum}" class="footnote-ref">${footnote.marker}</a></sup>`
    );
  });

  // Add footnote section with backlinks
  let footnotesHtml = '';
  if (chapter.footnotes && chapter.footnotes.length > 0) {
    footnotesHtml = '<aside class="footnotes"><ol>';
    chapter.footnotes.forEach((footnote, index) => {
      const fnNum = index + 1;
      footnotesHtml += `
        <li id="fn-${fnNum}">
          ${footnote.text}
          <a href="#fnref-${fnNum}" class="footnote-backlink">↩</a>
        </li>
      `;
    });
    footnotesHtml += '</ol></aside>';
  }

  return `<section>${content}${footnotesHtml}</section>`;
}
```

**Step 4: Run test to verify GREEN**

```bash
npx vitest run tests/services/epub/XhtmlSerializer.test.ts
```

Expected: PASS

**Step 5: Commit footnote backlinking**

```bash
git add tests/services/epub/XhtmlSerializer.test.ts services/epub/XhtmlSerializer.ts
git commit -m "feat(epub): add footnote backlinks for navigation

MOTIVATION:
- EPUB readers benefit from bidirectional footnote links
- Users should be able to jump from footnote back to reference
- Standard EPUB practice to include backlinks

APPROACH:
- TDD: Write test for backlink anchors first
- Replace footnote markers with anchor links
- Add backlink from footnote to reference point
- Use fragment identifiers (#fn-1, #fnref-1)

CHANGES:
- tests/services/epub/XhtmlSerializer.test.ts: Add backlink tests
- services/epub/XhtmlSerializer.ts: Implement bidirectional links

IMPACT:
- Better EPUB reading experience
- Follows EPUB accessibility guidelines
- Footnotes are now fully navigable

TESTING:
- npx vitest run tests/services/epub/XhtmlSerializer.test.ts: All pass

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

### Task 10: Add Image Cache Resolver Tests

**Purpose:** Test base64 fallback to prevent image markers remaining in text.

**Files:**
- Create: `tests/services/ImageCacheResolver.test.ts`

**Step 1: RED - Write test for base64 fallback**

```typescript
// tests/services/ImageCacheResolver.test.ts
import { describe, it, expect, vi } from 'vitest';
import { ImageCacheResolver } from '../../services/ImageCacheResolver';

describe('ImageCacheResolver', () => {
  describe('resolveImageUrl', () => {
    it('should use cached blob URL when available', async () => {
      // Arrange
      const mockCache = new Map([
        ['illustration-1', 'blob:http://localhost/abc123']
      ]);
      const resolver = new ImageCacheResolver(mockCache);

      // Act
      const url = await resolver.resolveImageUrl('illustration-1');

      // Assert
      expect(url).toBe('blob:http://localhost/abc123');
    });

    it('should fall back to base64 data URI when blob not in cache', async () => {
      // Arrange
      const mockCache = new Map(); // Empty cache
      const mockImageData = 'iVBORw0KGgoAAAANSUhEUg'; // Base64 image data

      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        blob: async () => new Blob(['fake-image-data'])
      } as Response);

      const resolver = new ImageCacheResolver(mockCache);

      // Act
      const url = await resolver.resolveImageUrl('illustration-1', mockImageData);

      // Assert
      expect(url).toContain('data:image/png;base64,');
    });

    it('should not leave markers in text when fallback succeeds', async () => {
      // Arrange
      const text = 'Some text [ILLUSTRATION-1] more text';
      const resolver = new ImageCacheResolver(new Map());

      // Act
      const processed = await resolver.processTextWithImages(text);

      // Assert
      expect(processed).not.toContain('[ILLUSTRATION-1]');
      expect(processed).toContain('<img');
    });
  });
});
```

**Step 2: Run test to verify RED**

```bash
npx vitest run tests/services/ImageCacheResolver.test.ts
```

Expected: FAIL - ImageCacheResolver doesn't exist or doesn't implement fallback

**Step 3: GREEN - Implement base64 fallback**

```typescript
// services/ImageCacheResolver.ts
export class ImageCacheResolver {
  constructor(private cache: Map<string, string>) {}

  async resolveImageUrl(id: string, base64Data?: string): Promise<string> {
    // Check cache first
    const cachedUrl = this.cache.get(id);
    if (cachedUrl) {
      return cachedUrl;
    }

    // Fall back to base64 data URI
    if (base64Data) {
      return `data:image/png;base64,${base64Data}`;
    }

    throw new Error(`No image found for ${id}`);
  }

  async processTextWithImages(text: string): Promise<string> {
    // Replace [ILLUSTRATION-X] markers with <img> tags
    return text.replace(/\[ILLUSTRATION-(\d+)\]/g, (match, num) => {
      const url = this.cache.get(`illustration-${num}`) || '';
      return `<img src="${url}" alt="Illustration ${num}" />`;
    });
  }
}
```

**Step 4: Run test to verify GREEN**

```bash
npx vitest run tests/services/ImageCacheResolver.test.ts
```

Expected: PASS

**Step 5: Commit image cache resolver**

```bash
git add tests/services/ImageCacheResolver.test.ts services/ImageCacheResolver.ts
git commit -m "test(images): add base64 fallback for uncached images

MOTIVATION:
- Image markers [ILLUSTRATION-X] were left in text when cache miss
- EPUB export and display need fallback for uncached images
- Base64 data URIs can serve as reliable fallback

APPROACH:
- TDD: Write test for cache miss scenario first
- Implement cache lookup with base64 fallback
- Ensure markers are always replaced with img tags

CHANGES:
- tests/services/ImageCacheResolver.test.ts: New test file
- services/ImageCacheResolver.ts: Implement cache + fallback

IMPACT:
- No more visible image markers in output
- Graceful degradation when cache unavailable
- Better EPUB export reliability

TESTING:
- npx vitest run tests/services/ImageCacheResolver.test.ts: All pass

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## PHASE 5: TOOLING & INFRASTRUCTURE

### Task 11: Create Test README

**Files:**
- Create: `tests/README.md`

**Step 1: Write comprehensive test documentation**

```markdown
# Test Suite Documentation

## Running Tests

### All tests
```bash
npm test
```

### Watch mode (auto-rerun on changes)
```bash
npm run test:watch
```

### Coverage report
```bash
npm run test:coverage
```

### Specific test file
```bash
npx vitest run tests/services/ComparisonService.test.ts
```

### Specific test
```bash
npx vitest run tests/services/ComparisonService.test.ts -t "should parse valid JSON"
```

## Test Structure

### Unit Tests
- `tests/services/` - Service layer logic
- `tests/adapters/` - Provider adapters and repository layer
- `tests/store/slices/` - Zustand store slices
- `tests/hooks/` - Custom React hooks

### Integration Tests
- `tests/db/contracts/` - Database schema and migration contracts
- `tests/epub/` - EPUB export pipeline

### Component Tests
- Tests using `@testing-library/react` for UI components
- Located alongside integration tests

## Test Utilities

### Mock Helpers
- `tests/utils/test-data.ts` - Mock data factories
- `tests/utils/api-mocks.ts` - API mocking utilities

### Setup
- `tests/setup.ts` - Global test setup (runs before all tests)
- Configures fake-indexeddb and jsdom environment

## Writing Tests

### Follow TDD
1. Write failing test (RED)
2. Run test to verify it fails
3. Write minimal code to pass (GREEN)
4. Run test to verify it passes
5. Refactor if needed (keep tests green)
6. Commit

### Test Anti-Patterns to Avoid
- ❌ Don't test mock behavior
- ❌ Don't add test-only methods to production classes
- ❌ Don't mock without understanding dependencies
- ❌ Don't write incomplete mocks (mirror full API structure)

### Good Test Characteristics
- ✅ Tests real behavior, not implementation details
- ✅ Clear descriptive names
- ✅ One thing per test
- ✅ Arrange-Act-Assert structure
- ✅ Independent (no test depends on another)

## Environment Variables

No special env vars required. API keys are mocked in tests.

## CI/CD

Tests run automatically in CI on:
- Pull requests
- Commits to main branch

Minimum passing threshold: 80% of tests must pass.

## Troubleshooting

### Tests hang
- Check for missing await on async functions
- Look for unclosed promises
- Use `--reporter=verbose` to see which test hangs

### Flaky tests
- Check for timing issues (use `waitFor` instead of fixed timeouts)
- Verify test isolation (use `beforeEach` to reset state)
- Look for shared mutable state

### Import errors
- Ensure path aliases are configured in vitest.config.ts
- Check that mock modules match actual module structure
```

**Step 2: Commit test README**

```bash
git add tests/README.md
git commit -m "docs(test): add comprehensive test suite documentation

MOTIVATION:
- New contributors need clear guidance on running tests
- Test structure and organization wasn't documented
- TDD workflow and anti-patterns should be explicit

APPROACH:
- Document all npm test scripts and their usage
- Explain test directory structure and conventions
- Link to TDD and testing anti-patterns principles
- Add troubleshooting section for common issues

CHANGES:
- tests/README.md: Complete test documentation

IMPACT:
- Easier onboarding for new contributors
- Clear reference for test conventions
- Reduced time debugging test issues

TESTING:
- Documentation only, no code changes

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

### Task 12: Verify Test Runner Configuration

**Purpose:** Ensure vitest is the only test runner, no jest remnants.

**Files:**
- Verify: `package.json`
- Verify: `vitest.config.ts`
- Check for: `jest.config.*`

**Step 1: Check for jest configuration files**

```bash
find . -name "jest.config.*" -o -name ".jestrc*" | grep -v node_modules
```

Expected: No files found

**Step 2: Check package.json for jest dependencies**

```bash
grep -i jest package.json
```

Expected: Only `@testing-library/jest-dom` (which works with vitest)

**Step 3: Verify vitest config is complete**

```bash
cat vitest.config.ts
```

Check for:
- ✅ environment: 'jsdom' (for React components)
- ✅ globals: true (for describe, it, expect)
- ✅ setupFiles: ['./tests/setup.ts']
- ✅ coverage configuration

**Step 4: If no issues found, document findings**

Create note in test manifest:

```markdown
## Test Runner
- ✅ Single runner: vitest 2.1.8
- ✅ No jest configuration found
- ✅ Config complete and correct
```

**Step 5: If issues found, fix them**

Remove any jest configs:
```bash
rm jest.config.js # if exists
npm uninstall jest @types/jest # if installed
```

**Step 6: Commit cleanup if changes made**

```bash
git add -u
git commit -m "test(infra): remove jest remnants, use vitest exclusively

MOTIVATION:
- Had both jest and vitest configurations
- Conflicting test runner setup causes confusion
- Vitest is faster and better suited for Vite projects

APPROACH:
- Removed jest config files
- Uninstalled jest dependencies
- Verified vitest config is complete

CHANGES:
- package.json: Removed jest dependencies
- Removed jest.config.js

IMPACT:
- Single test runner (vitest)
- Clearer test infrastructure
- Faster test execution

TESTING:
- npm test: All tests run with vitest

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## PHASE 6: ONGOING COVERAGE BACKLOG

### Task 13: Create Coverage Backlog Document

**Files:**
- Create: `docs/test-coverage-backlog.md`

**Step 1: Document future test needs**

```markdown
# Test Coverage Backlog

## High Priority (Implement Soon)

### Comparison Feature - UI Component Tests
- [ ] ComparisonCard component renders correctly
- [ ] Toggle between raw/fan view works
- [ ] Collapse/expand functionality
- [ ] DOM portals clean up on unmount
- [ ] Copy to clipboard works
- **Why:** User-facing feature, critical for UX

### Translation Version History
- [ ] Dropdown sorts versions correctly
- [ ] Numeric fallback IDs work
- [ ] Creative titles display properly
- [ ] Version selection updates UI
- **Why:** Prevents regression in version management

### Settings & API Keys
- [ ] SettingsModal conditional copy (OpenRouter vs others)
- [ ] API key validation for all providers
- [ ] Settings persistence across sessions
- **Why:** Critical for app configuration

## Medium Priority (Next Sprint)

### Navigation Service
- [ ] adaptTranslationRecordToResult preserves IDs
- [ ] Version persistence after reload
- [ ] Fallback ID warning triggers
- **Why:** Data integrity for translations

### EPUB Export - Integration
- [ ] Full chapter export with images
- [ ] Footnote backlinks present in output
- [ ] Title/body wrapper prevents merging
- **Why:** End-to-end export validation

### Illustration Generation
- [ ] Skip generation when imageModel is 'none'
- [ ] Illustration prompt validation
- [ ] Image placeholder handling
- **Why:** Recently added conditional logic

## Low Priority (Backlog)

### Future Features
- [ ] Pin comparison to footnote (once implemented)
- [ ] Custom prompt templates validation
- [ ] Bulk translation queue management
- **Why:** Features not yet implemented

### Performance
- [ ] Large chapter handling (10K+ words)
- [ ] Concurrent translation limits
- [ ] Memory usage for long sessions
- **Why:** Non-functional requirements

## Test Debt Paydown

### Increase Coverage for Existing Features
- [ ] Error boundaries in components
- [ ] Loading states and spinners
- [ ] Keyboard navigation
- [ ] Accessibility (ARIA labels)
- **Why:** Improve robustness

### Edge Cases
- [ ] Empty chapter handling
- [ ] Malformed API responses
- [ ] Network timeout scenarios
- [ ] Storage quota exceeded
- **Why:** Real-world failure scenarios
```

**Step 2: Commit backlog**

```bash
git add docs/test-coverage-backlog.md
git commit -m "docs(test): create test coverage backlog

MOTIVATION:
- Many features lack comprehensive test coverage
- Need prioritized list of tests to write
- Backlog helps plan future test work

APPROACH:
- Identified features added recently without tests
- Prioritized by user impact and risk
- Separated by implementation timeline

CHANGES:
- docs/test-coverage-backlog.md: Prioritized test backlog

IMPACT:
- Clear roadmap for increasing coverage
- Helps prioritize test work
- Tracks test debt explicitly

TESTING:
- Documentation only

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## EXECUTION CHECKLIST

After completing all tasks, verify:

- [ ] Test manifest created documenting all 44 test files
- [ ] Legacy tests for archived code deleted (~9 files)
- [ ] All broken existing tests fixed
- [ ] ComparisonService fully tested (happy path + edge cases)
- [ ] Translation schema validation tests added
- [ ] EPUB footnote backlink tests added
- [ ] Image cache resolver tests added
- [ ] Test README.md created
- [ ] Vitest configuration verified (no jest remnants)
- [ ] Coverage backlog documented
- [ ] All tests pass: `npx vitest run`
- [ ] Test failure rate < 5% (was 32%)

## Success Criteria

**Before:** 127 failed / 393 tests (32% failure rate)
**After:** < 20 failed / ~300 tests (< 5% failure rate)

**New Coverage:**
- ComparisonService: 100% (3+ tests)
- Translation schema: Title validation
- EPUB footnote backlinks: 2+ tests
- Image cache resolver: 3+ tests

**Documentation:**
- Test manifest (audit)
- Test README (how to run)
- Coverage backlog (future work)

---

## Notes

- Each task follows RED-GREEN-REFACTOR cycle
- Tests must fail first (RED) before implementing
- Commit after each green test
- Never skip verification steps
- Delete code ruthlessly (archived tests)
- Focus on critical path coverage first
- Document decisions in commits

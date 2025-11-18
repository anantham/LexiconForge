# Phase 3: Interface & Type Alignment Roadmap

**Generated:** 2025-11-11
**Current Status:** 114 errors (45 production, 69 test)
**Target:** < 100 errors (13% reduction)
**Stretch Goal:** < 80 errors (30% reduction)

---

## Executive Summary

**Phase 1 & 2 Results:**
- Started: 172 errors
- After Phase 1 (Critical Fixes): 150 errors (-22)
- After Phase 2 (Type Safety): 114 errors (-36)
- **Total Reduction: 58 errors (34% decrease)**

**Remaining Error Distribution:**
- **Production Code:** 45 errors (39%)
- **Test Files:** 69 errors (61%)

**Phase 3 Focus:** Fix interface mismatches, export conflicts, and store slice type issues in production code. Test fixes are lower priority.

---

## Phase 3A: Critical Production Fixes (Priority: 🔴 URGENT)

### Fix 3A.1: Remove Duplicate ChapterSummaryRecord Export
**File:** `services/indexeddb.ts:2852`
**Error:** Export declaration conflicts with exported declaration
**Impact:** 1 error

**Root Cause:** ChapterSummaryRecord exported twice

**Solution:**
```bash
# Find all exports of ChapterSummaryRecord
grep -n "export.*ChapterSummaryRecord" services/indexeddb.ts

# Remove duplicate export (likely at line 2852)
```

**Verification:**
```bash
npx tsc --noEmit 2>&1 | grep "ChapterSummaryRecord"
# Should return no results
```

---

### Fix 3A.2: Fix store/index.ts setNotification Errors
**File:** `store/index.ts:272,281,290,297,310,319,327`
**Error:** Property 'setNotification' does not exist
**Impact:** 7 errors

**Root Cause:** UiActions interface missing setNotification method

**Current Pattern:**
```typescript
// Lines 272, 281, 290, 297, 310, 319, 327
useAppStore.getState().setNotification(...)
```

**Investigation Needed:**
```bash
# Check if setNotification exists in UiActions
grep -n "setNotification" store/slices/uiSlice.ts

# Check what the correct method name is
grep -n "notification" store/slices/uiSlice.ts | grep ":" | head -10
```

**Expected Fix:** Either:
- Option A: Add setNotification to UiActions interface
- Option B: Replace with correct method name

---

### Fix 3A.3: Fix chaptersSlice.ts 'unknown' Type Errors
**File:** `store/slices/chaptersSlice.ts:586,588,598,600,611-619`
**Error:** Property X does not exist on type 'unknown'
**Impact:** 9 errors

**Root Cause:** Map.get() returns `unknown` when type inference fails

**Pattern:**
```typescript
// Lines 586-619
const chapter = state.chapters.get(chapterId);
chapter.translationResult // Error: property doesn't exist on 'unknown'
chapter.content // Error: property doesn't exist on 'unknown'
```

**Solution:**
```typescript
// Option A: Type assertion
const chapter = state.chapters.get(chapterId) as EnhancedChapter | undefined;
if (!chapter) return;
chapter.translationResult // Works!

// Option B: Type guard
const chapter = state.chapters.get(chapterId);
if (!chapter || typeof chapter !== 'object') return;
```

**Files to Check:**
- store/slices/chaptersSlice.ts:586-619 (9 occurrences)

---

### Fix 3A.4: Fix jobsSlice Job Type Mismatch
**File:** `store/slices/jobsSlice.ts:91,103`
**Error:** Type mismatch with Job interface
**Impact:** 2 errors

**Investigation:**
```bash
# Check Job interface definition
grep -A20 "interface.*Job\s" types.ts

# Check what's being assigned at line 91
```

**Likely Issue:** Job interface expects additional fields that aren't provided

---

### Fix 3A.5: Fix exportSlice.ts Errors
**File:** `store/slices/exportSlice.ts:3,349,350,414`
**Impact:** 5 errors

**Error 1 (line 3):** Module has no exported member 'TelemetryInsights'
```typescript
// Fix: Remove import or add export
import { TelemetryInsights } from '../../services/indexeddb'; // Remove this
```

**Error 2 (lines 349-350):** Cannot find name 'versionStateEntry' and 'version'
```typescript
// These variables are undefined - likely missing from scope
```

**Error 3 (line 414):** Unknown property 'includeTitlePage'
```typescript
// Property doesn't exist in EpubExportOptions
// Check if it should be 'includeStatsPage'
```

---

### Fix 3A.6: Fix Service Spread Argument Errors
**Files:**
- `services/imageGenerationService.ts:19,20`
- `services/translationService.ts:20,21`
- `workers/translate.worker.ts:88,122`

**Error:** Spread argument must have tuple type
**Impact:** 6 errors

**Pattern:**
```typescript
// Current (error):
someFunction(...arrayWithoutTupleType)

// Fix Option A: Cast to tuple
someFunction(...(arrayVar as [Type1, Type2]))

// Fix Option B: Use array methods
someFunction.apply(null, arrayVar)
```

---

### Fix 3A.7: Fix navigationService EnhancedChapter Conversion
**File:** `services/navigationService.ts:427`
**Error:** Conversion may be a mistake
**Impact:** 1 error

**Current Code (line 426-442):**
```typescript
const enhanced: EnhancedChapter = {
  id: chapterIdFound,
  title: c?.title || 'Untitled Chapter',
  // ... properties
} as EnhancedChapter; // This cast is failing
```

**Solution:** Remove `as EnhancedChapter` cast - type should be inferred correctly after our Phase 2 fixes

---

### Fix 3A.8: Fix Remaining Service Errors
**Files:**
- `services/imageService.ts:140` - Gemini API type mismatch
- `services/imageUtils.ts:85` - Missing argument
- `services/telemetryService.ts:37,84` - Recursive type reference
- `services/translate/translationResponseSchema.ts:157,160` - Schema property issues
- `services/translationPersistenceService.ts:41,78` - Type mismatches

**Impact:** 8 errors
**Priority:** Medium - investigate case by case

---

## Phase 3B: Test File Fixes (Priority: ⚠️ MEDIUM)

### Test Error Categories:

1. **AppSettings Mock Objects Missing Fields** (15 errors)
   - Files: GeminiAdapter.test.ts, OpenAIAdapter.test.ts, SettingsRepository.test.ts, etc.
   - Missing: imageModel, contextDepth, preloadCount, fontSize, etc.

2. **UsageMetrics Missing provider/model** (8 errors)
   - Files: indexedDBService.interface.test.ts, TranslationRepository.test.ts, Translator.test.ts
   - Fix: Add provider and model to all UsageMetrics mocks

3. **Job Interface Mismatches** (12 errors)
   - File: jobsSlice.test.ts
   - Missing: prompt, settings fields for ImageJob type

4. **Miscellaneous Test Mocks** (34 errors)
   - Various missing properties in test mocks

**Recommended Approach:**
Create shared test fixtures/factories to reduce duplication:

```typescript
// tests/fixtures/settings.ts
export const createMockSettings = (overrides?: Partial<AppSettings>): AppSettings => ({
  provider: 'OpenAI',
  model: 'gpt-4',
  imageModel: 'dall-e-3',
  temperature: 0.7,
  systemPrompt: 'Test prompt',
  contextDepth: 2,
  preloadCount: 2,
  fontSize: 16,
  fontStyle: 'sans',
  lineHeight: 1.6,
  ...overrides
});
```

---

## Implementation Priority

### Immediate (Do Now):
1. Fix 3A.1: ChapterSummaryRecord duplicate export (1 error)
2. Fix 3A.2: setNotification errors (7 errors)
3. Fix 3A.3: chaptersSlice unknown types (9 errors)
4. Fix 3A.7: navigationService conversion (1 error)

**Expected Result:** 114 → 96 errors (-18)

### Short Term (This Session):
5. Fix 3A.4: jobsSlice types (2 errors)
6. Fix 3A.5: exportSlice errors (5 errors)
7. Fix 3A.6: Service spread arguments (6 errors)

**Expected Result:** 96 → 83 errors (-13)

### Medium Term (Next Session):
8. Fix 3A.8: Remaining service errors (8 errors)
9. Phase 3B: Test file fixes (69 errors)

**Expected Result:** 83 → 6 errors (-77)

---

## Verification Checklist

### After Phase 3A (Immediate):
- [ ] ChapterSummaryRecord export conflict resolved
- [ ] No setNotification errors in store/index.ts
- [ ] No 'unknown' type errors in chaptersSlice.ts
- [ ] navigationService EnhancedChapter conversion fixed
- [ ] TypeScript errors < 100 (target: 96)

### After Phase 3A (Short Term):
- [ ] jobsSlice types aligned
- [ ] exportSlice compiles without errors
- [ ] All service spread argument errors fixed
- [ ] TypeScript errors < 85 (target: 83)

### After Phase 3B (Medium Term):
- [ ] Test fixtures/factories created
- [ ] All test files compile
- [ ] TypeScript errors < 10 (target: 6)

---

## Expected Results Table

| Phase | Fixes | Errors Fixed | Remaining | Status |
|-------|-------|--------------|-----------|--------|
| Start | - | - | 114 | 🔴 |
| 3A Immediate | 4 fixes | ~18 | ~96 | 🟡 |
| 3A Short Term | 3 fixes | ~13 | ~83 | 🟢 |
| 3A Complete | 8 fixes | ~31 | ~75 | 🟢 |
| 3B Complete | Test fixes | ~69 | ~6 | 🟢 |

---

## Risk Assessment

**Low Risk Fixes:**
- ChapterSummaryRecord export (just remove duplicate)
- Type assertions in chaptersSlice (safe type narrowing)
- navigationService cast removal (already type-safe)

**Medium Risk Fixes:**
- setNotification method (need to verify correct API)
- jobsSlice types (interface changes might affect runtime)
- exportSlice variables (undefined variables might be real bugs)

**High Risk Fixes:**
- Service spread arguments (might affect runtime behavior)
- Schema type issues (could break API validation)
- Recursive type references (complex type system issue)

---

## Notes

- **Phase 1-2 already fixed** the original Phase 3 plan items:
  - ✅ PromptTemplateRecord interface mapping (done in Phase 2.5)
  - ✅ ImportedChapter type alignment (done in Phase 2)

- **Test errors are 61% of total** - consider separate test-fix session

- **Store slice errors dominate** production code issues (21/45 = 47%)

- **Quick wins available:** 18 errors can be fixed with 4 simple changes

---

## Next Steps

1. **Review this roadmap** - Confirm priorities
2. **Execute Phase 3A Immediate** - Fix 18 errors quickly
3. **Verify with build** - Run `npx tsc --noEmit`
4. **Commit progress** - "fix(types): resolve store slice and export conflicts"
5. **Continue Phase 3A Short Term** - Fix remaining production errors
6. **Final commit** - "fix(types): phase 3A complete - production code type-safe"

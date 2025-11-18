# TypeScript Error Fix Plan
**Generated:** 2024-11-10
**Target:** Reduce errors from 172 to < 140 in Phase 1-2

## Phase 1: Critical API Fixes (Priority: 🔴 URGENT)

### Fix 1.1: Restore deleteChapter Method
**File:** `services/indexeddb.ts`
**Current Error:** `components/SessionInfo.tsx:377` - Property 'deleteChapter' does not exist

**Problem:** Method was removed during refactoring, breaking SessionInfo component.

**Solution:** Add deleteChapter as a facade method

```typescript
// Add to services/indexeddb.ts after line 1410

async deleteChapter(chapterUrl: string): Promise<void> {
  const db = await this.openDatabase();
  const stableId = await this.getStableIdByUrl(chapterUrl);

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['chapters', 'translations'], 'readwrite');

    // Delete chapter
    const chaptersStore = transaction.objectStore('chapters');
    chaptersStore.delete(chapterUrl);

    // Delete associated translations
    const translationsStore = transaction.objectStore('translations');
    const index = translationsStore.index('chapterUrl');
    const request = index.openCursor(IDBKeyRange.only(chapterUrl));

    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest).result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };

    transaction.oncomplete = () => {
      if (stableId) {
        this.deleteChapterSummary(stableId).then(resolve).catch(reject);
      } else {
        resolve();
      }
    };

    transaction.onerror = () => reject(transaction.error);
  });
}
```

**Verification:**
```bash
grep -n "deleteChapter" components/SessionInfo.tsx
# Should find usage at line 377
npx tsc --noEmit 2>&1 | grep "SessionInfo.*deleteChapter"
# Should show no error
```

---

### Fix 1.2: Remove .data Accessor on TranslationRecord
**Files:** `services/indexeddb.ts:2882, 2886, 2924, 2926`
**Errors:** Property 'data' does not exist on type 'TranslationRecord'

**Problem:** Old code expected nested `data` property, but TranslationRecord has flat structure.

**Solution:** Remove `.data` accessor

```typescript
// Line 2882 - Before:
const translatedContent = translation.data?.translatedContent;
// After:
const translatedContent = translation.translation;

// Line 2886 - Before:
title: translation.data?.translatedTitle || chapter.title,
// After:
title: translation.translatedTitle || chapter.title,

// Line 2924 - Before:
content: translation.data?.translatedContent || '',
// After:
content: translation.translation || '',

// Line 2926 - Before:
title: translation.data?.translatedTitle || chapter.title,
// After:
title: translation.translatedTitle || chapter.title,
```

**Verification:**
```bash
grep -n "translation\.data" services/indexeddb.ts
# Should return no results after fix
```

---

### Fix 1.3: Remove activeTranslationId References
**Files:** `services/indexeddb.ts:2878, 2879`
**Errors:** Property 'activeTranslationId' does not exist on type 'ChapterRecord'

**Problem:** ChapterRecord doesn't have activeTranslationId field. Active translations are found via isActive flag.

**Solution:** Use proper lookup method

```typescript
// Lines 2878-2879 - Before:
const translationId = chapter.activeTranslationId;
const translation = translationId ? await this.getTranslationById(translationId) : null;

// After:
const translation = await this.getActiveTranslation(chapter.url);
```

**Verification:**
```bash
grep -n "activeTranslationId" services/indexeddb.ts
# Should return no results after fix
```

---

### Fix 1.4: Fix createdAt → dateAdded
**File:** `services/navigationService.ts:749`
**Error:** Property 'createdAt' does not exist on type 'ChapterRecord'

**Solution:**
```typescript
// Line 749 - Before:
const created = chapter.createdAt;
// After:
const created = chapter.dateAdded;
```

---

### Fix 1.5: Add diffResults to STORES Constant
**File:** `services/indexeddb.ts:2479`
**Error:** Argument of type '"diffResults"' is not assignable

**Solution:**
```typescript
// Find STORES constant (around line 47-58) and add:
const STORES = {
  CHAPTERS: 'chapters',
  TRANSLATIONS: 'translations',
  SETTINGS: 'settings',
  FEEDBACK: 'feedback',
  PROMPT_TEMPLATES: 'prompt_templates',
  URL_MAPPINGS: 'url_mappings',
  NOVELS: 'novels',
  CHAPTER_SUMMARIES: 'chapter_summaries',
  AMENDMENT_LOGS: 'amendment_logs',
  DIFF_RESULTS: 'diffResults'  // ADD THIS LINE
} as const;

// Then update line 2479:
// Before:
db.transaction(['diffResults'], 'readonly')
// After:
db.transaction([STORES.DIFF_RESULTS], 'readonly')
```

---

### Fix 1.6: Fix Export Conflict
**File:** `services/indexeddb.ts:3035`
**Error:** Export declaration conflicts with exported declaration of 'ChapterSummaryRecord'

**Solution:** Check where ChapterSummaryRecord is exported twice

```bash
# Find all exports:
grep -n "export.*ChapterSummaryRecord" services/indexeddb.ts

# Remove duplicate or rename one
```

---

## Phase 2: Type Safety Fixes (Priority: ⚠️ HIGH)

### Fix 2.1: Fix Boolean Comparisons
**Files:** `TranslationRepository.ts:202`, `indexeddb.ts:978`
**Errors:** Types 'boolean' and 'number'/'string' have no overlap

**Solution - TranslationRepository.ts:202:**
```typescript
// Before:
return versions.find(v => v.isActive === true || v.isActive === 1 || v.isActive === 'true')
  || versions[0] || null;

// After (safe coercion):
return versions.find(v => Boolean(v.isActive)) || versions[0] || null;
```

**Solution - indexeddb.ts:978:**
```typescript
// Before:
const activeFlag = record.isActive;
if (activeFlag === true || activeFlag === 1 || activeFlag === 'true') {
  // ...
}

// After:
const activeFlag = Boolean(record.isActive);
if (activeFlag) {
  // ...
}
```

---

### Fix 2.2: Fix {} Fallback Pattern
**Files:** `importService.ts:741-759`, `navigationService.ts:424-437`, `stableIdService.ts`

**Problem:** Using `|| {}` loses type information

**Solution Pattern:**
```typescript
// Before:
const chapterData = chapters[i] || {};
const url = chapterData.originalUrl;  // Error!

// After - Option 1 (preferred):
const chapterData = chapters[i];
if (!chapterData) continue;
const url = chapterData.originalUrl;  // Works!

// After - Option 2 (if null is valid):
const chapterData = chapters[i] ?? null;
if (chapterData === null) {
  // handle null case
  continue;
}
const url = chapterData.originalUrl;  // Works!
```

**Apply to:**
- `importService.ts:741` - chapters[i]
- `navigationService.ts:424` - chapterRecord
- `stableIdService.ts:123,192,210,227,234` - ImportedChapter references

---

### Fix 2.3: Fix Emoji to Type Mapping
**File:** `indexeddb.ts:1291`
**Error:** Type '"👍" | "👎"' not assignable to '"positive" | "negative" | "suggestion"'

**Solution:**
```typescript
// Add helper function before storeFeedback method:
private mapEmojiToFeedbackType(emoji: string): 'positive' | 'negative' | 'suggestion' {
  switch (emoji) {
    case '👍': return 'positive';
    case '👎': return 'negative';
    case '?':
    case '🎨':
    default: return 'suggestion';
  }
}

// Then at line 1291, replace:
type: emoji
// With:
type: this.mapEmojiToFeedbackType(emoji)
```

---

### Fix 2.4: Fix isDefault Number to Boolean
**File:** `indexeddb.ts:1716`
**Error:** Type 'number' is not assignable to type 'boolean'

**Solution:**
```typescript
// Line 1716 - Before:
isDefault: record.isDefault
// After:
isDefault: Boolean(record.isDefault)
```

---

### Fix 2.5: Fix PromptTemplate Type Conversion
**File:** `indexeddb.ts:2539`
**Error:** Conversion may be a mistake

**Solution:**
```typescript
// Line 2539 - Before:
const template = {
  id: record.id,
  name: record.name,
  // ...
  isDefault: record.isDefault,
  createdAt: record.createdAt,
  lastUsed: record.lastUsed,
} as PromptTemplateRecord;

// After (add missing field conversions):
const template: PromptTemplateRecord = {
  id: String(record.id),
  name: String(record.name),
  description: String(record.description || ''),
  content: String(record.content),
  isDefault: Boolean(record.isDefault),
  createdAt: String(record.createdAt),
  lastUsed: record.lastUsed ? String(record.lastUsed) : undefined,
};
```

---

## Phase 3: Interface Updates (Priority: ⚠️ MEDIUM)

### Fix 3.1: Update PromptTemplateRecord Interface
**File:** `services/prompts/PromptRegistry.ts` expects missing fields
**Missing:** version, systemPrompt, tags, updatedAt, parameters

**Option A:** Add fields to PromptTemplateRecord interface
**Option B:** Remove references in PromptRegistry

**Recommended:** Option B - Remove unused fields

```typescript
// In PromptRegistry.ts, remove references to:
- template.version
- template.systemPrompt
- template.tags
- template.updatedAt
- template.parameters

// These fields don't exist in the database schema
```

---

### Fix 3.2: Update ImportedChapter Type
**File:** `services/stableIdService.ts` expects properties that don't exist

**Solution:** Add missing fields to ImportedChapter type or use correct type

```typescript
// Check types.ts for ImportedChapter definition
// Ensure it has: url, content, fanTranslation fields
```

---

## Implementation Script

```bash
#!/bin/bash
# Execute Phase 1 fixes

echo "=== Phase 1: Critical Fixes ==="

# Fix 1.1 - Add deleteChapter method
echo "Adding deleteChapter method to indexeddb.ts..."
# (Insert code at appropriate location)

# Fix 1.2 - Remove .data accessors
echo "Fixing .data accessor issues..."
sed -i.bak 's/translation\.data?\.translatedContent/translation.translation/g' services/indexeddb.ts
sed -i 's/translation\.data?\.translatedTitle/translation.translatedTitle/g' services/indexeddb.ts

# Fix 1.3 - Remove activeTranslationId
echo "Fixing activeTranslationId references..."
# (Manual fix required - see above)

# Fix 1.4 - Fix createdAt → dateAdded
echo "Fixing createdAt references..."
sed -i 's/chapter\.createdAt/chapter.dateAdded/g' services/navigationService.ts

# Fix 1.5 - Add diffResults to STORES
echo "Adding DIFF_RESULTS to STORES constant..."
# (Manual fix required - see above)

# Verify
echo "Running TypeScript compiler..."
npx tsc --noEmit 2>&1 | grep -c "error TS"
echo "Errors remaining"
```

---

## Verification Checklist

After Phase 1:
- [ ] deleteChapter method exists and compiles
- [ ] No .data accessor errors
- [ ] No activeTranslationId errors
- [ ] No createdAt errors
- [ ] diffResults in STORES constant
- [ ] Export conflict resolved
- [ ] TypeScript errors < 160 (target: -12 errors)

After Phase 2:
- [ ] No boolean comparison errors
- [ ] No {} fallback errors
- [ ] Emoji mapping works
- [ ] isDefault converts to boolean
- [ ] PromptTemplate conversion fixed
- [ ] TypeScript errors < 145 (target: -15 errors)

After Phase 3:
- [ ] PromptRegistry compiles
- [ ] ImportedChapter type correct
- [ ] TypeScript errors < 140 (target: -5 errors)

---

## Expected Results

| Phase | Errors Fixed | Remaining Errors | Status |
|-------|--------------|------------------|--------|
| Start | - | 172 | 🔴 |
| Phase 1 | ~12 | ~160 | 🟡 |
| Phase 2 | ~15 | ~145 | 🟡 |
| Phase 3 | ~5 | ~140 | 🟢 |

**Final Goal:** < 140 errors (18% reduction)
**Stretch Goal:** < 130 errors (25% reduction)

---

## Next Steps

1. **Review this plan** - Ensure all fixes make sense
2. **Execute Phase 1** - Critical fixes first
3. **Run tests** - Verify nothing breaks
4. **Commit** - "fix(types): restore deleted methods, fix data accessors"
5. **Execute Phase 2** - Type safety fixes
6. **Commit** - "fix(types): resolve boolean comparisons and type narrowing"
7. **Execute Phase 3** - Interface updates
8. **Final commit** - "fix(types): update interfaces and remove unused fields"

**Total Time Estimate:** 4-6 hours for all phases
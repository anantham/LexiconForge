# Preload Logic Analysis: Why Chapters Are Fetched Despite Being in Memory

## TL;DR - The Issue

**You're right!** The preload worker is fetching chapters from the web even when they exist in IndexedDB (disk). The logic only checks the **in-memory `chapters` Map**, not IndexedDB, before deciding to fetch.

## Decision Flow Diagram

```
User navigates to Chapter 5 (preloadCount = 3)
│
├─> Worker starts: preloadNextChapters()
│   │
│   ├─> Loop i=1: Look for Chapter 6
│   │   │
│   │   ├─> Step 1: Check numberToChapterMap (in-memory only)
│   │   │   └─> Built from: chapters.get() Map [MEMORY ONLY]
│   │   │
│   │   ├─> Step 2: If not in memory → Query IndexedDB by chapterNumber
│   │   │   └─> indexedDBService.findChapterByNumber(6)
│   │   │   │
│   │   │   ├─> IF found in IDB:
│   │   │   │   └─> loadChapterFromIDB(stableId)
│   │   │   │   └─> Add to memory
│   │   │   │
│   │   │   └─> IF NOT found in IDB:
│   │   │       └─> Step 3: Fetch from web ⚠️ THIS IS THE PROBLEM
│   │   │
│   │   └─> [Repeat for i=2, i=3...]
```

## Code Path Analysis

### Entry Point
**File**: `App.tsx:159`
```typescript
useEffect(() => {
  const { preloadNextChapters } = useAppStore.getState();
  preloadNextChapters();
}, [currentChapterId, settings.preloadCount, settings.provider, settings.model, settings.temperature]);
```

### Preload Worker Logic
**File**: `store/slices/chaptersSlice.ts:490-620`

#### Step 1: Build In-Memory Map (Lines 512-518)
```typescript
const numberToChapterMap = new Map<number, {id: string, chapter: any}>();
// ⚠️ ONLY looks at chapters currently in MEMORY
for (const [id, chapter] of chapters.entries()) {
  if (typeof chapter.chapterNumber === 'number') {
    numberToChapterMap.set(chapter.chapterNumber, { id, chapter });
  }
}
```

**Problem**: If you have a sliding window of 10 chapters in memory, but 100 chapters on disk, this map only contains those 10.

#### Step 2: Check Memory First (Lines 520-522)
```typescript
for (let i = 1; i <= settings.preloadCount; i++) {
  const targetNumber = currentChapter.chapterNumber + i;
  let nextChapterInfo = numberToChapterMap.get(targetNumber);
```

**Result**: If Chapter 6 is on disk but not in your 10-chapter memory window, `nextChapterInfo` is `undefined`.

#### Step 3: Fallback to IndexedDB (Lines 524-536)
```typescript
if (!nextChapterInfo) {
  const chapterRecord = await indexedDBService.findChapterByNumber(targetNumber);
  if (chapterRecord && chapterRecord.stableId) {
    await loadChapterFromIDB(chapterRecord.stableId);
    const loadedChapter = get().chapters.get(chapterRecord.stableId);
    if (loadedChapter) {
      nextChapterInfo = {
        id: chapterRecord.stableId,
        chapter: loadedChapter,
      };
    }
  }
}
```

**Good**: This DOES check IndexedDB and loads the chapter if found.

**But then...**

#### Step 4: Web Fetch as Final Fallback (Lines 538-584)
```typescript
// If still not found, try to fetch from web using current chapter's nextUrl or navigation logic
if (!nextChapterInfo && i === 1 && currentChapter.nextUrl) {
  debugLog('worker', 'summary', `[Worker] Chapter #${targetNumber} not found locally, attempting web fetch from: ${currentChapter.nextUrl}`);
  try {
    const fetchResult = await NavigationService.handleFetch(currentChapter.nextUrl);
```

**The Problem**: This runs when:
1. Chapter not in memory (`numberToChapterMap.get()` returned `undefined`)
2. **AND** `findChapterByNumber()` didn't find it in IndexedDB
3. **AND** `i === 1` (only fetches next immediate chapter)
4. **AND** current chapter has `nextUrl`

## Why Are You Seeing Fetches?

### Scenario 1: IndexedDB Query Fails
`indexedDBService.findChapterByNumber(targetNumber)` returns `null` because:

**Possible Causes**:
- Chapter exists in IDB but **doesn't have a `chapterNumber` field** set
- Chapter exists but the number doesn't match (e.g., stored as string "6" instead of number 6)
- IndexedDB doesn't have an index on `chapterNumber` (performance issue causes timeout)
- Chapter was imported without `chapterNumber` metadata

**To Check**: Add diagnostic logging to see what `findChapterByNumber()` returns:

```typescript
if (!nextChapterInfo) {
  const chapterRecord = await indexedDBService.findChapterByNumber(targetNumber);
  console.log(`[Preload Debug] Looking for chapter ${targetNumber}:`, {
    found: !!chapterRecord,
    stableId: chapterRecord?.stableId,
    hasNumber: typeof chapterRecord?.chapterNumber === 'number',
    actualNumber: chapterRecord?.chapterNumber
  });
```

### Scenario 2: Sliding Window Eviction
If your sliding window only keeps 10 chapters in memory:
- User is on Chapter 50
- Memory contains: Chapters 45-55
- Preload wants to load Chapter 51-53
- Chapters 51-53 are on disk but NOT in the memory window

**Solution**: The code already handles this (Step 3 above) by loading from IDB.

**But**: If the IDB query fails for any reason, it falls through to web fetch.

### Scenario 3: `nextUrl` Mismatch
Even if Chapter 6 exists on disk, if:
- `currentChapter.nextUrl` points to a DIFFERENT URL than what's stored
- The URL normalization doesn't match

Then the navigation service won't find the chapter and will fetch.

## Root Cause Analysis

Based on the code, **the most likely cause** is:

### **Hypothesis 1: Missing or Incorrect `chapterNumber` Field**

**Evidence**:
- `findChapterByNumber()` queries by chapter number
- If chapters were imported without this field, or with incorrect values, the query fails
- The code then falls back to web fetch

**Test**:
```typescript
// Add to chaptersSlice.ts:524
console.log('[Preload] Searching for chapter:', {
  targetNumber,
  totalChaptersInMemory: chapters.size,
  chapterNumbersInMemory: Array.from(chapters.values())
    .map(c => c.chapterNumber)
    .filter(n => typeof n === 'number')
});

const chapterRecord = await indexedDBService.findChapterByNumber(targetNumber);
console.log('[Preload] IndexedDB query result:', {
  targetNumber,
  found: !!chapterRecord,
  record: chapterRecord
});
```

### **Hypothesis 2: No Index on `chapterNumber`**

**Evidence**:
- `findChapterByNumber()` does a table scan if no index exists
- Large databases (100+ chapters) could timeout or fail
- Falls back to web fetch

**Test**: Check IndexedDB schema in `services/indexeddb.ts` for:
```typescript
chaptersStore.createIndex('chapterNumber', 'chapterNumber', { unique: false });
```

If this index is missing, queries will be O(n) instead of O(log n).

## Recommended Fix Options

### Option A: Add Missing Index (If not present)
**File**: `services/indexeddb.ts`
```typescript
const chaptersStore = db.createObjectStore(STORES.CHAPTERS, { keyPath: 'url' });
chaptersStore.createIndex('stableId', 'stableId', { unique: false });
chaptersStore.createIndex('chapterNumber', 'chapterNumber', { unique: false }); // Add this!
```

### Option B: Add Diagnostic Logging
**File**: `store/slices/chaptersSlice.ts:524`
```typescript
if (!nextChapterInfo) {
  console.log(`[Preload] Searching for chapter ${targetNumber}...`);
  const chapterRecord = await indexedDBService.findChapterByNumber(targetNumber);

  if (chapterRecord) {
    console.log(`[Preload] ✅ Found in IndexedDB:`, chapterRecord.stableId);
  } else {
    console.warn(`[Preload] ❌ NOT found in IndexedDB for number ${targetNumber}`);
    console.log(`[Preload] Available chapter numbers in memory:`,
      Array.from(chapters.values())
        .map(c => ({ id: c.id, number: c.chapterNumber }))
        .filter(c => typeof c.number === 'number')
    );
  }
```

### Option C: Query All Chapter Numbers from IDB First
Instead of building map from memory only, query IDB for all chapter numbers:

**File**: `store/slices/chaptersSlice.ts:512`
```typescript
// Current (memory only):
const numberToChapterMap = new Map<number, {id: string, chapter: any}>();
for (const [id, chapter] of chapters.entries()) {
  if (typeof chapter.chapterNumber === 'number') {
    numberToChapterMap.set(chapter.chapterNumber, { id, chapter });
  }
}

// Better (includes disk):
const numberToChapterMap = new Map<number, {id: string, inMemory: boolean}>();
const allChapterRecords = await indexedDBService.getAllChapterSummaries(); // Query IDB once
for (const record of allChapterRecords) {
  if (typeof record.chapterNumber === 'number') {
    numberToChapterMap.set(record.chapterNumber, {
      id: record.stableId,
      inMemory: chapters.has(record.stableId)
    });
  }
}
```

Then modify the logic:
```typescript
for (let i = 1; i <= settings.preloadCount; i++) {
  const targetNumber = currentChapter.chapterNumber + i;
  const chapterInfo = numberToChapterMap.get(targetNumber);

  if (!chapterInfo) {
    // Not in memory OR disk - try web fetch
    if (i === 1 && currentChapter.nextUrl) {
      await fetchFromWeb();
    }
  } else if (!chapterInfo.inMemory) {
    // On disk but not in memory - hydrate
    await loadChapterFromIDB(chapterInfo.id);
  }
  // else: already in memory, skip
}
```

### Option D: Skip Web Fetch if Disk Sliding Window Enabled
If you're deliberately using a sliding window, disable web fetching entirely:

**File**: `store/slices/chaptersSlice.ts:538`
```typescript
// Add a new setting: settings.disablePreloadFetch
if (!nextChapterInfo && i === 1 && currentChapter.nextUrl && !settings.disablePreloadFetch) {
  // Only fetch if explicitly enabled
  const fetchResult = await NavigationService.handleFetch(currentChapter.nextUrl);
```

## Summary

**Current Behavior**:
1. Checks in-memory chapters first
2. Falls back to IndexedDB query by chapter number
3. If IDB query fails/returns nothing → fetches from web

**Your Issue**:
- Chapters exist on disk
- But IDB query (`findChapterByNumber`) isn't finding them
- Likely because: missing `chapterNumber` field, no index, or number mismatch

**Immediate Action**:
Add the diagnostic logging (Option B) to see what `findChapterByNumber()` is returning. Share those logs with me and we can pinpoint the exact cause.

**Long-term Fix**:
- Ensure all chapters have `chapterNumber` field populated
- Ensure IndexedDB has index on `chapterNumber`
- Consider Option C (query disk once upfront) for better sliding window support

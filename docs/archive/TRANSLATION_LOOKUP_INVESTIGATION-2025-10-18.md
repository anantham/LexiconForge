# Translation Lookup Investigation - Current Status

**Date:** 2025-10-18
**Status:** INVESTIGATION IN PROGRESS - Root cause NOT yet confirmed
**Observed Behavior:** Some chapters fail to load existing translations

---

## What We Know For Certain

### Confirmed Facts from Console Diagnostics

1. **Manual database queries work perfectly:**
   ```javascript
   // Console test for ch261_6wg0v9_kgcn
   ✅ URL mapping exists: {url: 'https://booktoki468.com/novel/3913764', stableId: 'ch261_6wg0v9_kgcn'}
   ✅ Chapter exists: {url: '...', title: '던전 디펜스-261화'}
   ✅ Translation exists: v1 "Chapter 261 — A Poisoned Surrender" (isActive: true)
   ✅ Manual query returns: 1 version
   ```

2. **Behavior varies by session:**
   - **First page load (before reload):** ch261, ch281, ch283 failed to load translations
   - **After page reload:** ch261, ch281, ch283 loaded successfully
   - **ch256:** Status unclear - contradictory reports about whether it fails after reload

3. **Database structure is intact:**
   - URL mappings exist for most chapters
   - Chapters are stored correctly
   - Translations have correct `chapterUrl` and `isActive` fields

### Current Chapter Status (as of last test)

| Chapter ID | Has Mapping | Has Chapter | Has Translation | Loads in App |
|------------|-------------|-------------|-----------------|--------------|
| ch221_e8gpn9_kgck | ✅ | ✅ | ✅ v1 | ✅ Works |
| ch255_54thwk_kgcn | ✅ | ✅ | ✅ v1 | ✅ Works |
| ch256_6sjnz1_kgcn | ❓ Unknown | ❓ Unknown | ❓ Unknown | ❌ Fails |
| ch258_fqdys3_kgcn | ✅ | ✅ | ✅ v1 | ✅ Works |
| ch259_xtmyux_kgcn | ✅ | ✅ | ✅ v1 | ✅ Works |
| ch261_6wg0v9_kgcn | ✅ | ✅ | ✅ v1 | ✅ Works (after reload) |
| ch280_b2eaa_kgcp | ✅ | ? | ? | Status unclear |
| ch281_fdf7te_kgcp | ✅ | ✅ | ✅ v1 | ✅ Works (after reload) |
| ch282_iywkxe_kgcp | ❌ No mapping | ? | ? | ❌ Fails |
| ch283_1b3h1i_kgcp | ✅ | ✅ | ✅ v1 | ✅ Works (after reload) |
| ch284_jgb0dv_kgcp | ❌ No mapping | ❌ Not found | N/A | ❌ Fails |
| ch285_m18u0f_kgcp | ❌ No mapping | ❌ Not found | N/A | ❌ Fails |
| ch286_0fvdmn_kgcp | ❌ No mapping | ❌ Not found | N/A | ❌ Fails |

**Note:** Chapters without mappings (ch282, ch284, ch285, ch286) were never preloaded/stored yet.

---

## Additional Context: CORS Proxy Failures

### Why Do We See CORS Proxy Logs?

**Question:** If chapter raws are in cache/database, why does the code try to fetch from website?

**Answer:** The preload worker (`chaptersSlice.ts:625-768`) fetches chapters ONLY when:
1. No translation versions exist for that chapter (`fetchTranslationVersions()` returns empty)
2. The chapter doesn't exist in the database yet
3. The next chapter in sequence hasn't been preloaded

**Control flow:**
```typescript
// Line 743-747: Check for existing translations BEFORE fetching
const existingVersions = await fetchTranslationVersions(nextChapterId);
if (existingVersions.length > 0) {
  debugLog('worker', 'full', `[Worker] Skipping chapter - versions exist`);
  continue;
}
```

**CORS logs for booktoki chapters indicate:**
- The preload worker is trying to fetch a new chapter that doesn't exist in database
- OR the chapter exists but has no translations, so it tries to fetch raw content to translate

### Booktoki Support Status

**Question:** Is booktoki adapter present and supported?

**Answer:** ❌ **NO** - Booktoki is NOT supported.

**Supported websites** (from `config/constants.ts:69-115`):
- kakuyomu.jp (Japanese)
- ncode.syosetu.com (Japanese)
- dxmwx.org (Chinese)
- kanunu8.com / kanunu.net (Chinese)
- novelcool.com (Fan translations)

**How booktoki data works in the app:**
- Chapters were imported from external JSON files (scraped elsewhere)
- The app can READ and TRANSLATE chapters from booktoki if they're in the database
- The app CANNOT FETCH new chapters from booktoki (no HTML parser for booktoki's structure)

**To add booktoki support:**
- Create `BooktokiAdapter` class in `services/adapters.ts`
- Implement: `extractTitle()`, `extractContent()`, `getNextLink()`, `getPrevLink()`
- Add domain check to `getAdapter()` function (line 129-136)

---

## What We Don't Know Yet

### Unanswered Questions

1. **Why did page reload fix some chapters?**
   - **IMPORTANT:** The "migration logs" shown in console were from temporary diagnostic patches, NOT production code
   - No automatic migration runs on startup that could explain the behavior change
   - Possible browser DevTools caching issue or IndexedDB connection refresh?

2. **What's different about ch256?**
   - Need to run diagnostic to check if it exists in database
   - May have been deleted or never successfully stored

3. **Is there an actual bug or just missing data?**
   - ch261, ch281, ch283 now work - suggests data integrity is OK
   - ch256 might just be missing from database
   - Need to verify with test command

---

## Code Under Investigation

### Primary Suspect: `getTranslationVersionsByStableId()`

**File:** `services/indexeddb.ts:2109-2130`

```typescript
async getTranslationVersionsByStableId(stableId: string): Promise<TranslationRecord[]> {
  const db = await this.openDatabase();
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction([STORES.URL_MAPPINGS, STORES.TRANSLATIONS], 'readonly');
      const urlStore = tx.objectStore(STORES.URL_MAPPINGS);
      const idx = urlStore.index('stableId');
      const req = idx.get(stableId);

      req.onsuccess = async () => {
        const mapping = req.result as UrlMappingRecord | undefined;
        if (!mapping) {
          console.error('[IndexedDB][StableId][DIAG] No URL mapping for stableId', { stableId });
          resolve([]);
          return;
        }

        try {
          const versions = await this.getTranslationVersions(mapping.url);  // ← Calls nested function
          resolve(versions);
        } catch (e) {
          reject(e);
        }
      };
    } catch (e) {
      reject(e);
    }
  });
}
```

**Potential Issue:** Nested async call to `getTranslationVersions()` opens a new database connection, potentially causing:
- Transaction isolation issues
- Race conditions
- Stale reads

**However:** Manual console tests using the SAME nested approach worked correctly, which contradicts this theory.

### Call Chain

```
navigationService.ts:549 loadChapterFromIDB()
  → indexeddb.ts:2319 ensureActiveTranslationByStableId()
    → indexeddb.ts:2142 getActiveTranslationByStableId()
      → indexeddb.ts:2109 getTranslationVersionsByStableId()
        → indexeddb.ts:1187 getTranslationVersions()  ← Opens new DB connection
```

---

## Diagnostic Console Commands

**⚠️ IMPORTANT:** These are temporary browser console commands, NOT production code.
They are for debugging purposes only and should NOT be referenced as existing functionality.

### Check if ch256 exists in database
```javascript
(async () => {
  const db = await new Promise(r => {
    const req = indexedDB.open('lexicon-forge');
    req.onsuccess = () => r(req.result);
  });

  const tx = db.transaction(['url_mappings', 'chapters', 'translations'], 'readonly');

  // Check mapping
  const mapReq = tx.objectStore('url_mappings').index('stableId').get('ch256_6sjnz1_kgcn');
  mapReq.onsuccess = () => console.log('Mapping:', mapReq.result || 'NOT FOUND');

  // Check chapter
  const chapReq = tx.objectStore('chapters').index('stableId').get('ch256_6sjnz1_kgcn');
  chapReq.onsuccess = async () => {
    const chapter = chapReq.result;
    console.log('Chapter:', chapter ? chapter.url : 'NOT FOUND');

    if (chapter) {
      // Check translations
      const transReq = tx.objectStore('translations').index('chapterUrl').getAll(IDBKeyRange.only(chapter.url));
      transReq.onsuccess = () => {
        console.log('Translations:', transReq.result.length, 'versions');
        transReq.result.forEach(t => console.log(`  v${t.version}:`, t.translatedTitle, `(active: ${t.isActive})`));
      };
    }
  };

  db.close();
})();
```

### Enable diagnostic logging (temporary console patch)
```javascript
(async () => {
  console.log('🔧 Installing diagnostic patch...');
  const originalLog = console.log;

  console.log = function(...args) {
    if (args[0]?.includes?.('[EnsureActive] Starting for stableId:')) {
      originalLog.apply(console, ['🔍 INTERCEPTED:', ...args]);

      const stableId = args[0].split('stableId: ')[1];

      (async () => {
        const db = await new Promise(r => {
          const req = indexedDB.open('lexicon-forge');
          req.onsuccess = () => r(req.result);
        });

        const tx = db.transaction(['url_mappings'], 'readonly');
        const req = tx.objectStore('url_mappings').index('stableId').get(stableId);

        req.onsuccess = () => {
          if (req.result) {
            originalLog(`   ✅ MAPPING EXISTS for ${stableId}:`, req.result);
          } else {
            originalLog(`   ❌ MAPPING MISSING for ${stableId}`);
          }
        };

        db.close();
      })();
    }

    originalLog.apply(console, args);
  };

  console.log('✅ Diagnostic patch installed. Navigate to a chapter to test.');
})();
```

---

## Hypotheses to Test

### H1: Missing URL Mappings (PARTIALLY CONFIRMED)
**Claim:** Some chapters lack URL mappings in the `url_mappings` store.

**Evidence FOR:**
- ch284, ch285, ch286 confirmed missing mappings
- ch282 missing mapping

**Evidence AGAINST:**
- ch261, ch281, ch283 HAD mappings and still failed (initially)
- After reload, they worked

**Status:** TRUE for some chapters (never preloaded), but NOT the root cause for others

### H2: IndexedDB Index Corruption (UNCONFIRMED)
**Claim:** The `stableId` index on `url_mappings` or `chapterUrl` index on `translations` is corrupt/stale.

**Evidence FOR:**
- Page reload fixed some chapters
- Manual queries worked when app queries failed

**Evidence AGAINST:**
- No direct evidence of index corruption
- Manual queries use same indexes

**Status:** NEEDS TESTING

**Test:**
1. Check if rebuild/reopen of database triggers index refresh
2. Try querying with `openCursor()` instead of `get()` to force index rebuild

### H3: Transaction Timing/Race Condition (UNCONFIRMED)
**Claim:** Nested `await this.getTranslationVersions()` call causes race condition.

**Evidence FOR:**
- Nested async call inside transaction callback is non-idiomatic
- Could cause timing issues

**Evidence AGAINST:**
- Manual console test using SAME pattern worked
- No evidence of timing-related failures

**Status:** UNLIKELY but not ruled out

### H4: Browser Cache/Reload Side Effect (UNCONFIRMED)
**Claim:** Page reload triggers some cleanup or refresh that fixes the issue.

**Evidence FOR:**
- ch261, ch281, ch283 worked after reload
- No code changes between failing and working state

**Evidence AGAINST:**
- No known mechanism for this

**Status:** OBSERVED but not understood

---

## Next Steps (Prioritized)

### Immediate (Must Do)
1. ✅ **Run ch256 diagnostic** - Determine if it exists in database
2. ⏳ **Document logging requirements** - How to enable diagnostic traces
3. ⏳ **Create reproduction steps** - Exact sequence to trigger failure

### Short Term (Should Do)
4. ⏳ **Add unit tests** - Test `getTranslationVersionsByStableId()` with mock data
5. ⏳ **Add permanent debug flag** - `LF_IDB_TRACE=1` environment variable
6. ⏳ **Test proposed fix** - Single-transaction version of lookup function

### Long Term (Nice to Have)
7. ⏳ **Index health check** - Add diagnostic tool to verify IndexedDB indexes
8. ⏳ **Automated migration tests** - Ensure schema upgrades don't break lookups
9. ⏳ **Telemetry integration** - Track lookup failures in production

---

## Files Referenced

- `services/indexeddb.ts:2109-2130` - getTranslationVersionsByStableId()
- `services/indexeddb.ts:2135-2154` - getActiveTranslationByStableId()
- `services/indexeddb.ts:2319-2334` - ensureActiveTranslationByStableId()
- `services/indexeddb.ts:1187-1210` - getTranslationVersions()
- `services/navigationService.ts:546-568` - loadChapterFromIDB()
- `services/indexeddb.ts:405-496` - createSchema() (NOT a migration)

---

## Mistakes to Avoid (Audit Findings)

1. ❌ **Do NOT assume root cause** - We have observations, not confirmed diagnosis
2. ❌ **Do NOT reference non-existent migrations** - There is NO `backfillActiveTranslations()` migration
   - Early documentation incorrectly claimed this existed at lines 409-500 in indexeddb.ts
   - Those lines contain schema creator code, NOT a migration function
3. ❌ **Do NOT claim "bug confirmed"** - Behavior is inconsistent and may be data-related
4. ❌ **Console logs are from diagnostic patches** - The `[EnsureActive]` logs don't exist in production code
   - These were temporary instrumentation added via browser console
   - They should NOT be referenced as if they're part of the codebase
5. ❌ **Chapter status is contradictory** - ch256 and ch261 have conflicting "works/fails" reports
   - Need single source of truth with clear reproduction steps

---

## Success Criteria

Investigation will be complete when we can:

1. ✅ **Reproduce the failure** - Specific steps that consistently fail
2. ✅ **Identify root cause** - Confirmed with code inspection and tests
3. ✅ **Verify fix works** - Before/after comparison shows improvement
4. ✅ **Prevent regression** - Automated tests catch future breakage

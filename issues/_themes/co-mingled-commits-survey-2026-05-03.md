# Co-mingled commits — survey results

_Surveyed 100 commits._

## Aggregate stats

### By title bucket

| Bucket | Count |
|---|---:|
| `feat` | 31 |
| `fix_bug` | 42 |
| `refactor` | 4 |
| `cleanup_only` | 5 |
| `chore_other` | 5 |
| `docs_only` | 8 |
| `test_only` | 2 |
| `build_chore` | 0 |
| `other` | 3 |

### By suspicion label

| Label | Count |
|---|---:|
| STRONG | 2 |
| MEDIUM | 8 |
| WEAK | 13 |
| CLEAN | 77 |

### Bucket × suspicion crosstab

| Bucket | STRONG | MEDIUM | WEAK | CLEAN |
|---|---:|---:|---:|---:|
| `cleanup_only` | 1 | 3 | 0 | 1 |
| `chore_other` | 1 | 0 | 1 | 3 |
| `docs_only` | 0 | 2 | 0 | 6 |
| `test_only` | 0 | 0 | 1 | 1 |
| `build_chore` | 0 | 0 | 0 | 0 |
| `fix_bug` | 0 | 3 | 6 | 33 |
| `feat` | 0 | 0 | 3 | 28 |
| `refactor` | 0 | 0 | 2 | 2 |
| `other` | 0 | 0 | 0 | 3 |

## Top 10 flagged commits

### `486a2e4` — STRONG (score 8) — `cleanup_only`

**Title:** fix: remove 27 more `as any` variable casts in store slices
**Date:** 2026-04-06T10:52:19-04:00  **Author:** Aditya
**Files:** 2 (66+ / 40-)

**Why flagged:**
- cleanup_only commit added behavior signals: store.set
- cleanup_only commit modifies hotspot path(s): ['store/slices/chaptersSlice.ts', 'store/slices/translationsSlice.ts']

**Behavior signals (added lines):**
- `store.set` (×1)
  - `store/slices/translationsSlice.ts` → `set(prev => {`

---

### `e1de26a` — STRONG (score 7) — `chore_other`

**Title:** chore: telemetry improvements and bug fix in MaintenanceOps
**Date:** 2026-04-10T14:18:22-04:00  **Author:** Aditya
**Files:** 4 (23+ / 9-)

**Why flagged:**
- chore (non-deps) added control-flow signals: return-bail
- chore (non-deps) modifies hotspot path(s): ['hooks/useChapterTelemetry.ts', 'services/db/operations/maintenance.ts', 'store/bootstrap/initializeStore.ts']
- modifies bootstrap/init without naming it in title: ['store/bootstrap/initializeStore.ts', 'tests/store/bootstrap/bootstrapHelpers.test.ts']

**Behavior signals (added lines):**
- `return-bail` (×2)
  - `hooks/useChapterTelemetry.ts` → `if (navigationStartTime == null) return;`
  - `hooks/useChapterTelemetry.ts` → `if (lastLoggedChapterRef.current === versionToken) return;`

---

### `ff3106c` — MEDIUM (score 5) — `cleanup_only`

**Title:** fix: remove 15 unnecessary `as any` casts on TranslationResult properties
**Date:** 2026-04-05T13:47:22-04:00  **Author:** Aditya
**Files:** 14 (28+ / 1057-)

**Why flagged:**
- cleanup_only commit touches 13 non-docs/test files
- cleanup_only commit modifies hotspot path(s): ['services/db/types.ts', 'services/imageGenerationService.ts', 'services/navigation/hydration.ts']

---

### `cfcaaab` — MEDIUM (score 5) — `cleanup_only`

**Title:** fix: remove 23 lazy `as any` casts on already-typed AppSettings properties
**Date:** 2026-04-05T13:54:28-04:00  **Author:** Aditya
**Files:** 11 (27+ / 28-)

**Why flagged:**
- cleanup_only commit touches 11 non-docs/test files
- cleanup_only commit modifies hotspot path(s): ['adapters/providers/OpenAIAdapter.ts', 'services/ai/apiKeyValidation.ts', 'services/ai/providers/openai.ts']

---

### `a7fe822` — MEDIUM (score 5) — `fix_bug`

**Title:** fix(library): preserve compatibility across version metadata updates
**Date:** 2026-04-09T09:33:26-04:00  **Author:** Aditya
**Files:** 8 (460+ / 24-)

**Why flagged:**
- fix touches 6 top-level areas: ['components', 'docs', 'services', 'store', 'tests']
- title scope is `library` but commit modifies out-of-scope hotspot(s): ['services/registryService.ts', 'store/bootstrap/initializeStore.ts']
- modifies bootstrap/init without naming it in title: ['store/bootstrap/initializeStore.ts', 'tests/store/bootstrap/bootstrapHelpers.test.ts']

**Behavior signals (added lines):**
- `await` (×1)
  - `services/registryService.ts` → `const metadata: NovelEntry = normalizeNovelMetadataUrls(await response.json(), metadataUrl);`
- `try/catch` (×1)
  - `services/registryService.ts` → `try {`

---

### `eea5c6b` — MEDIUM (score 4) — `docs_only`

**Title:** docs: debt capture protocol + worklog updates
**Date:** 2026-04-02T19:10:12-04:00  **Author:** Aditya
**Files:** 3 (35+ / 0-)

**Why flagged:**
- docs_only commit modifies non-docs files: ['.gitignore']

---

### `4a8cccf` — MEDIUM (score 4) — `docs_only`

**Title:** docs(issues): scaffold investigation framework + issue #1 deep dive + ADR audit
**Date:** 2026-05-03T14:55:35-04:00  **Author:** Aditya
**Files:** 32 (3764+ / 0-)

**Why flagged:**
- docs_only commit modifies non-docs files: ['scripts/issue-archaeology.py']

---

### `b1bc169` — MEDIUM (score 3) — `cleanup_only`

**Title:** refactor: type Zustand slices against StoreState, remove 44 `as any` casts
**Date:** 2026-04-05T14:39:21-04:00  **Author:** Aditya
**Files:** 5 (47+ / 47-)

**Why flagged:**
- cleanup_only commit modifies hotspot path(s): ['store/slices/chaptersSlice.ts', 'store/slices/imageSlice.ts', 'store/slices/settingsSlice.ts']

---

### `c973b30` — MEDIUM (score 3) — `fix_bug`

**Title:** fix: fetch transport hardening — SSRF, SuttaCentral bypass, TOC consistency
**Date:** 2026-04-06T10:59:30-04:00  **Author:** Aditya
**Files:** 9 (596+ / 3-)

**Why flagged:**
- fix touches 5 top-level areas: ['api', 'docs', 'services', 'store', 'tests']
- modifies bootstrap/init without naming it in title: ['store/bootstrap/initializeStore.ts']

**Behavior signals (added lines):**
- `exported fn` (×2)
  - `services/scraping/allowedDomains.ts` → `export const ALLOWED_DOMAINS = [`
  - `services/scraping/allowedDomains.ts` → `export function isDomainAllowed(hostname: string): boolean {`
- `try/catch` (×1)
  - `services/scraping/fetcher.ts` → `if (!suttaAdapter) try {`

---

### `b604ba3` — MEDIUM (score 3) — `fix_bug`

**Title:** fix(amendments): split prompt and glossary proposal handling
**Date:** 2026-04-09T11:44:15-04:00  **Author:** Aditya
**Files:** 19 (371+ / 32-)

**Why flagged:**
- fix touches 5 top-level areas: ['components', 'docs', 'services', 'store', 'tests']
- title scope is `amendments` but commit modifies out-of-scope hotspot(s): ['services/ai/providers/gemini.ts', 'services/ai/providers/openai.ts', 'services/db/types.ts']

**Behavior signals (added lines):**
- `await` (×1)
  - `store/slices/translationsSlice.ts` → `await get().acceptProposal(index);`
- `exported fn` (×1)
  - `services/glossaryService.ts` → `export const mergeGlossaryEntries = (`
- `throw` (×2)
  - `services/translationService.ts` → `throw new Error('Malformed amendment proposal response: glossary proposals must include glossaryOperation.');`
  - `services/translationService.ts` → `throw new Error('Malformed amendment proposal response: glossary proposals must include glossaryEntry.source and glossaryEntry.tar`

---


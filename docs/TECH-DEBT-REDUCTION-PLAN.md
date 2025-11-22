# Technical Debt Reduction Plan - Days 1-4
Generated: 2024-11-10
Status: Ready for Implementation

## Executive Summary
This plan provides specific, executable tasks for reducing technical debt in LexiconForge over 4 days. Each task includes exact file paths, line numbers, and prompts for Claude Code execution.

---

## Day 1-2: Fix Builds + Minimal Test Harness
**Confidence: 0.80** | **Est. Time: 8-12 hours**

### Task 1.1: Fix OpenAI SDK Type Errors (2 hours)
**Status: Diagnosed, Ready to Implement**

#### Files to Fix:
1. `services/explanationService.ts:79-88`
2. `services/illustrationService.ts:64-83,94-95`

#### Exact Changes Required:

**File: services/explanationService.ts**
```typescript
// Add import at line 4 (after OpenAI import):
import type { ChatCompletionMessageParam } from 'openai/resources/chat';

// Replace lines 77-82 with:
const messages: ChatCompletionMessageParam[] = [
  { role: 'user', content: prompt }
];
const requestBody = {
  model: settings.model,
  messages,
  temperature: 0.5,
  max_tokens: maxOutput,
};
```

**File: services/illustrationService.ts**
```typescript
// Add import at line 4 (after OpenAI import):
import type { ChatCompletionMessageParam } from 'openai/resources/chat';

// Replace lines 62-67 with:
const messages: ChatCompletionMessageParam[] = [
  { role: 'user', content: finalPrompt }
];
const requestBody = {
  model: settings.model,
  messages,
  temperature: 0.7,
  max_tokens: maxOutput,
};

// Replace lines 94-95 with:
const choice = response?.choices?.[0];
const finish = choice?.finish_reason ?? choice?.native_finish_reason ?? null;
```

**Verification:**
```bash
npx tsc --noEmit 2>&1 | grep -c "error TS"
# Should drop from 138 to ~136
```

**Claude Code Prompt:**
```
Fix the OpenAI SDK type errors in services/explanationService.ts and illustrationService.ts.

The fix is already designed:
1. Add import: import type { ChatCompletionMessageParam } from 'openai/resources/chat';
2. Explicitly type messages array as ChatCompletionMessageParam[]
3. In illustrationService, fix the finish_reason access by removing the || {} fallback

Verify with: npx tsc --noEmit
Update docs/WORKLOG.md with results.
```

---

### Task 1.2: Create Minimal Test Harness for IndexedDB (4-6 hours)
**Strategy: Interface-based mocking without reading the monolith**

#### Step 1: Extract Interface from IndexedDB Service

**File to Create:** `services/db/interfaces/IIndexedDBService.ts`

```typescript
// Extract interface based on grep results and Repo.ts contract
import type {
  ChapterRecord,
  TranslationRecord,
  ChapterLookupResult,
  AppSettings,
  FeedbackItem,
  PromptTemplate
} from '../../indexeddb';

export interface IIndexedDBService {
  // Core database operations
  openDatabase(): Promise<IDBDatabase>;

  // Chapter operations
  storeChapter(chapter: Chapter): Promise<void>;
  getChapter(url: string): Promise<ChapterRecord | null>;
  deleteChapter(url: string): Promise<void>;
  findChapterByUrl(url: string): Promise<ChapterLookupResult | null>;
  getAllChapterUrls(): Promise<string[]>;

  // Translation operations
  storeTranslation(chapterUrl: string, translation: TranslationResult, settings: AppSettings): Promise<void>;
  getTranslation(chapterUrl: string, version?: number): Promise<TranslationRecord | null>;
  getTranslationVersions(chapterUrl: string): Promise<TranslationRecord[]>;
  deleteTranslation(chapterUrl: string, version: number): Promise<void>;

  // Settings operations
  saveSettings(settings: AppSettings): Promise<void>;
  loadSettings(): Promise<AppSettings | null>;

  // Feedback operations
  storeFeedback(feedback: FeedbackItem): Promise<void>;
  getFeedback(translationId: string): Promise<FeedbackItem[]>;

  // Template operations
  savePromptTemplate(template: PromptTemplate): Promise<void>;
  getPromptTemplates(): Promise<PromptTemplate[]>;
}
```

#### Step 2: Create Mock Implementation

**File to Create:** `services/db/__mocks__/MockIndexedDBService.ts`

```typescript
export class MockIndexedDBService implements IIndexedDBService {
  private chapters = new Map<string, ChapterRecord>();
  private translations = new Map<string, TranslationRecord[]>();
  private settings: AppSettings | null = null;
  private feedback = new Map<string, FeedbackItem[]>();
  private templates: PromptTemplate[] = [];

  async openDatabase(): Promise<IDBDatabase> {
    return {} as IDBDatabase; // Mock DB object
  }

  async storeChapter(chapter: Chapter): Promise<void> {
    this.chapters.set(chapter.url, {
      ...chapter,
      dateAdded: new Date().toISOString(),
      lastAccessed: new Date().toISOString()
    });
  }

  async getChapter(url: string): Promise<ChapterRecord | null> {
    return this.chapters.get(url) || null;
  }

  // ... implement all other methods with Map storage
}
```

#### Step 3: Create Interface Tests

**File to Create:** `tests/services/db/indexedDBService.interface.test.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import type { IIndexedDBService } from '../../../services/db/interfaces/IIndexedDBService';
import { MockIndexedDBService } from '../../../services/db/__mocks__/MockIndexedDBService';

describe('IndexedDB Service Interface Contract', () => {
  let service: IIndexedDBService;

  beforeEach(() => {
    service = new MockIndexedDBService();
  });

  describe('Chapter Operations', () => {
    it('should store and retrieve chapters', async () => {
      const chapter = {
        url: 'https://example.com/ch1',
        title: 'Chapter 1',
        content: '<p>Content</p>',
        originalUrl: 'https://example.com/ch1'
      };

      await service.storeChapter(chapter);
      const retrieved = await service.getChapter(chapter.url);

      expect(retrieved).toBeTruthy();
      expect(retrieved?.title).toBe(chapter.title);
      expect(retrieved?.content).toBe(chapter.content);
    });

    it('should handle chapter not found', async () => {
      const result = await service.getChapter('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('Translation Operations', () => {
    it('should store and retrieve translations with versioning', async () => {
      const chapterUrl = 'https://example.com/ch1';
      const translation = {
        translatedTitle: 'Translated Title',
        translatedContent: '<p>Translated</p>',
        model: 'gpt-4',
        timestamp: Date.now()
      };

      await service.storeTranslation(chapterUrl, translation as any, {} as any);
      const retrieved = await service.getTranslation(chapterUrl);

      expect(retrieved).toBeTruthy();
      expect(retrieved?.translatedTitle).toBe(translation.translatedTitle);
    });

    it('should handle multiple versions', async () => {
      const chapterUrl = 'https://example.com/ch1';

      // Store v1
      await service.storeTranslation(chapterUrl,
        { translatedTitle: 'V1' } as any, {} as any);

      // Store v2
      await service.storeTranslation(chapterUrl,
        { translatedTitle: 'V2' } as any, {} as any);

      const versions = await service.getTranslationVersions(chapterUrl);
      expect(versions).toHaveLength(2);
      expect(versions[1].translatedTitle).toBe('V2');
    });
  });

  describe('Settings Persistence', () => {
    it('should save and load settings', async () => {
      const settings = {
        provider: 'OpenAI',
        model: 'gpt-4',
        temperature: 0.7
      } as AppSettings;

      await service.saveSettings(settings);
      const loaded = await service.loadSettings();

      expect(loaded).toBeTruthy();
      expect(loaded?.provider).toBe('OpenAI');
      expect(loaded?.temperature).toBe(0.7);
    });
  });
});
```

**Claude Code Prompt:**
```
Create a minimal test harness for indexeddb.ts WITHOUT reading the 3,937-line file.

Steps:
1. Use grep to find all public methods: grep "^\s*async [a-zA-Z]" services/indexeddb.ts
2. Create services/db/interfaces/IIndexedDBService.ts with the interface
3. Create services/db/__mocks__/MockIndexedDBService.ts implementing the interface with Maps
4. Create tests/services/db/indexedDBService.interface.test.ts with 5 critical tests
5. Run tests with: npm test indexedDBService.interface

This gives us safety before decomposing the monolith.
```

---

### Task 1.3: Additional Type Fixes (2 hours)

**Other TypeScript errors to fix:**

1. **services/importService.ts:741-759** - Add proper typing for chapter object
2. **services/indexeddb.ts:970,1987,2432** - Type mismatches
3. **services/imageService.ts:140** - Gemini API typing
4. **store/index.ts:290,297,310** - setNotification method missing

**Claude Code Prompt:**
```
Fix remaining critical TypeScript errors. Use grep to find each error location:

1. grep -n "originalUrl.*does not exist" services/importService.ts
2. Fix by properly typing the chapter object
3. Continue for other files

Target: Get error count below 100.
```

---

## Day 2-3: LOC Guardrail + Strict Typing
**Confidence: 0.85** | **Est. Time: 6-8 hours**

### Task 2.1: Implement LOC Checking Script (1 hour)

**File to Create:** `scripts/check-loc.js`

```javascript
#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const glob = require('glob');

const MAX_LINES = {
  'services': 800,
  'components': 500,
  'default': 300
};

const EXCLUDE = [
  'node_modules/**',
  'dist/**',
  'coverage/**',
  '**/*.test.ts',
  '**/*.spec.ts'
];

async function checkFileSize(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n').length;

  const category = filePath.includes('services/') ? 'services' :
                   filePath.includes('components/') ? 'components' :
                   'default';
  const maxLines = MAX_LINES[category];

  return { filePath, lines, maxLines, oversized: lines > maxLines };
}

async function main() {
  const files = glob.sync('**/*.{ts,tsx}', { ignore: EXCLUDE });
  const results = await Promise.all(files.map(checkFileSize));

  const oversized = results.filter(r => r.oversized);

  if (oversized.length > 0) {
    console.log('⚠️  Files exceeding line limits:\n');
    oversized.forEach(({ filePath, lines, maxLines }) => {
      const excess = lines - maxLines;
      console.log(`  ${filePath}: ${lines} lines (${excess} over ${maxLines} limit)`);
    });
    console.log(`\nTotal: ${oversized.length} files need refactoring`);

    // Warning exit for now, will change to error later
    process.exit(0); // Change to 1 to enforce
  } else {
    console.log('✅ All files within size limits');
  }
}

main().catch(console.error);
```

**Update package.json:**
```json
{
  "scripts": {
    "check:loc": "node scripts/check-loc.js",
    "prebuild": "npm run check:loc",
    "ci": "npm run check:loc && npm test && npm run build"
  }
}
```

**Claude Code Prompt:**
```
Create an LOC checking script:

1. Create scripts/check-loc.js with the provided code
2. Add npm script "check:loc" to package.json
3. Test it: npm run check:loc
4. It should list all oversized files but not fail (warning mode)

Current oversized files expected:
- services/indexeddb.ts: 3,937 lines
- components/SettingsModal.tsx: 2,744 lines
- components/ChapterView.tsx: 1,969 lines
```

---

### Task 2.2: Strict Typing Roadmap (2-3 hours)

**Phase 1: Enable Strict Mode Incrementally**

**File:** `tsconfig.json`
```json
{
  "compilerOptions": {
    // Add these one at a time:
    "noImplicitAny": true,        // Phase 1
    "strictNullChecks": true,      // Phase 2
    "strictFunctionTypes": true,   // Phase 3
    "strictPropertyInitialization": true, // Phase 4
    "strict": true                 // Final
  }
}
```

**Service Priority Order (smallest to largest):**

1. **services/env.ts** (50 lines) - No 'any' types
2. **services/stableIdService.ts** (89 lines) - Clean up types
3. **services/rateLimitService.ts** (~150 lines)
4. **services/telemetryService.ts** (~200 lines)
5. **services/translationService.ts** (721 lines) - Has 'any'
6. **services/aiService.ts** (900 lines) - Multiple 'any'
7. **services/indexeddb.ts** (3,937 lines) - Last

**Type Definition Files to Create:**

**File:** `types/api.ts`
```typescript
// Consolidate API types
export interface ApiResponse<T> {
  data?: T;
  error?: ApiError;
}

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

export type ApiKeyConfig = {
  provider: string;
  key: string;
  baseUrl?: string;
};
```

**File:** `types/database.ts`
```typescript
// Move database types from indexeddb.ts
export interface ChapterRecord {
  url: string;
  stableId?: string;
  title: string;
  content: string;
  originalUrl: string;
  nextUrl?: string;
  prevUrl?: string;
  fanTranslation?: string;
  dateAdded: string;
  lastAccessed: string;
  chapterNumber?: number;
  canonicalUrl?: string;
}

export interface TranslationRecord {
  // ... move from indexeddb.ts
}
```

**Claude Code Prompt:**
```
Begin strict typing migration for smallest services first:

1. Start with services/env.ts - remove all 'any' types
2. Run npx tsc --noEmit after each file
3. Create types/api.ts and types/database.ts for shared types
4. Update tsconfig.json with "noImplicitAny": true
5. Document progress in WORKLOG.md

Work on one service at a time, starting with the smallest.
```

---

### Task 2.3: Service-by-Service Typing (3-4 hours)

**Template for Each Service:**

```typescript
// Before
function processData(input: any): any {
  return input.data;
}

// After
interface ProcessInput {
  data: unknown;
}

interface ProcessOutput {
  result: string;
}

function processData(input: ProcessInput): ProcessOutput {
  // Proper validation
  if (!input.data || typeof input.data !== 'string') {
    throw new TypeError('Invalid input data');
  }
  return { result: String(input.data) };
}
```

**Services with 'any' to Fix (grep results):**

1. **store/index.ts** - 2 instances
2. **types.ts** - 3 instances
3. **adapters/repo/ChaptersRepo.ts** - 2 instances
4. **store/slices/chaptersSlice.ts** - 5 instances
5. **adapters/providers/GeminiAdapter.ts** - 5 instances
6. **adapters/providers/OpenAIAdapter.ts** - 9 instances

---

## Day 3-4: Documentation + Decomposition Blueprint
**Confidence: 0.90** | **Est. Time: 8-10 hours**

### Task 3.1: Document Current Architecture (2 hours)

**File to Create:** `docs/ARCHITECTURE.md`

```markdown
# LexiconForge Architecture

## Current State (November 2024)

### Data Flow
```
User Input → UI Components → Store (Zustand) → Services → Adapters → IndexedDB
                                ↓                              ↓
                             Workers                      Providers (AI APIs)
```

### Key Components

#### Monolithic Files (Technical Debt)
- **services/indexeddb.ts** (3,937 lines) - Central database service
- **components/SettingsModal.tsx** (2,744 lines) - Settings UI
- **components/ChapterView.tsx** (1,969 lines) - Chapter display

#### Service Layer
- Translation pipeline: `services/translationService.ts`
- AI orchestration: `services/aiService.ts`
- Provider adapters: `adapters/providers/*`

#### Store Layer (Zustand)
- Slices: `store/slices/*`
- Main store: `store/index.ts`

### Dual-Write Migration Strategy

Currently implementing dual-write pattern for safe migration:

```typescript
// Feature flag controls backend
const backend = process.env.DB_BACKEND || 'legacy';

if (backend === 'modern') {
  return modernImplementation();
} else {
  return legacyImplementation();
}
```

### Database Schema

#### IndexedDB Object Stores
1. **chapters** - Source content
2. **translations** - Versioned translations
3. **settings** - User preferences
4. **feedback** - Translation feedback
5. **prompt_templates** - Custom prompts
6. **url_mappings** - URL to stable ID mapping
7. **diffResults** - Diff analysis results

### Translation Versioning

Each translation is versioned:
- Version 1: Initial translation
- Version 2+: Retranslations
- Active version tracked separately

## Planned Architecture (After Refactoring)

### Repository Pattern
```
Services → Repository Interface → Concrete Repository
                                   ↓
                        IndexedDB / Memory / Mock
```

### Domain Separation
- ChapterRepository - Chapter CRUD
- TranslationRepository - Translation versioning
- SettingsRepository - User preferences
- FeedbackRepository - User feedback
```

**Claude Code Prompt:**
```
Document the current architecture:

1. Read store/index.ts to understand state management
2. Grep for "import.*from.*services" to map dependencies
3. Create docs/ARCHITECTURE.md with the structure provided
4. Include a dependency graph
5. Document the dual-write pattern from services/db/
```

---

### Task 3.2: Decomposition Blueprint for IndexedDB (4 hours)

**File to Create:** `docs/INDEXEDDB-DECOMPOSITION-PLAN.md`

```markdown
# IndexedDB Decomposition Plan

## Overview
Breaking down services/indexeddb.ts (3,937 lines) into domain-specific repositories.

## Phase 1: Analysis (Complete)

### Method Groupings by Domain

#### Chapter Operations (Lines 1105-1300)
- storeChapter(chapter: Chapter): Promise<void> - Line 1105
- getChapter(url: string): Promise<ChapterRecord | null> - Line 1210
- deleteChapter(url: string): Promise<void> - Line 1210
- getAllChapterUrls(): Promise<string[]> - Line 1845
- findChapterByUrl(url: string): Promise<ChapterLookupResult | null> - Line 3190

#### Translation Operations (Lines 1301-1800)
- storeTranslation(...) - Line 1301
- storeTranslationAtomic(...) - Line 1427
- getTranslation(...) - Line 1634
- getTranslationVersions(...) - Line 1596
- deleteTranslation(...) - Line 1724
- getActiveTranslation(...) - Line 1689

#### Settings Operations (Lines 2801-2900)
- saveSettings(settings: AppSettings) - Line 2801
- loadSettings() - Line 2839

#### Feedback Operations (Lines 1967-2100)
- storeFeedback(feedback: FeedbackItem) - Line 1967
- getFeedback(translationId: string) - Line 2043

#### Template Operations (Lines 2901-3100)
- savePromptTemplate(template: PromptTemplate) - Line 2901
- getPromptTemplates() - Line 2968
- deletePromptTemplate(id: string) - Line 3030

## Phase 2: Extraction Plan

### Step 1: Create Repository Interfaces
```typescript
// services/db/repositories/interfaces/IChapterRepository.ts
export interface IChapterRepository {
  store(chapter: Chapter): Promise<void>;
  get(url: string): Promise<ChapterRecord | null>;
  delete(url: string): Promise<void>;
  getAllUrls(): Promise<string[]>;
  findByUrl(url: string): Promise<ChapterLookupResult | null>;
}
```

### Step 2: Extract Implementations

#### 2.1 ChapterRepository (Target: 400 lines)
```typescript
// services/db/repositories/ChapterRepository.ts
export class ChapterRepository implements IChapterRepository {
  constructor(private getDb: () => Promise<IDBDatabase>) {}

  // Move lines 1105-1300 from indexeddb.ts
}
```

#### 2.2 TranslationRepository (Target: 500 lines)
```typescript
// services/db/repositories/TranslationRepository.ts
export class TranslationRepository implements ITranslationRepository {
  // Move lines 1301-1800 from indexeddb.ts
}
```

### Step 3: Create Facade

```typescript
// services/indexeddb.ts (reduced to ~500 lines)
class IndexedDBService {
  private chapterRepo: ChapterRepository;
  private translationRepo: TranslationRepository;

  constructor() {
    const getDb = () => this.openDatabase();
    this.chapterRepo = new ChapterRepository(getDb);
    this.translationRepo = new TranslationRepository(getDb);
  }

  // Delegate methods for backward compatibility
  async storeChapter(chapter: Chapter) {
    return this.chapterRepo.store(chapter);
  }
}
```

## Phase 3: Migration Steps

### Day 1: Extract ChapterRepository
1. Create interfaces (30 min)
2. Copy methods to new file (1 hour)
3. Update imports (30 min)
4. Test with existing tests (1 hour)

### Day 2: Extract TranslationRepository
1. Copy translation methods (1.5 hours)
2. Handle version management (1 hour)
3. Test versioning logic (1 hour)

### Day 3: Extract Remaining Repositories
1. SettingsRepository (1 hour)
2. FeedbackRepository (1 hour)
3. TemplateRepository (1 hour)

### Day 4: Cleanup & Testing
1. Remove extracted code from indexeddb.ts
2. Update all imports
3. Run full test suite
4. Document changes

## Verification Checklist
- [ ] All tests pass
- [ ] No runtime errors
- [ ] Bundle size unchanged or smaller
- [ ] Performance metrics maintained
- [ ] Dual-write pattern still works
```

**Claude Code Prompt:**
```
Create the IndexedDB decomposition blueprint:

1. grep -n "async.*function\|async.*(" services/indexeddb.ts | head -100
2. Group methods by domain (chapters, translations, settings, etc)
3. Create docs/INDEXEDDB-DECOMPOSITION-PLAN.md
4. Include specific line numbers for each method
5. Calculate target lines for each new repository

Don't read the whole file - use grep to find method boundaries.
```

---

### Task 3.3: Component Decomposition Plan (2 hours)

**File to Create:** `docs/COMPONENT-DECOMPOSITION-PLAN.md`

```markdown
# Component Decomposition Plan

## SettingsModal.tsx (2,744 lines → 8 components)

### Target Structure
```
components/
  Settings/
    SettingsModal.tsx (200 lines - orchestrator)
    panels/
      AISettingsPanel.tsx (400 lines)
      ExportSettingsPanel.tsx (350 lines)
      AudioSettingsPanel.tsx (300 lines)
      DiffSettingsPanel.tsx (300 lines)
      ImageSettingsPanel.tsx (400 lines)
      PromptTemplatesPanel.tsx (350 lines)
      NovelMetadataPanel.tsx (300 lines)
    hooks/
      useSettingsState.ts (100 lines)
      useSettingsValidation.ts (100 lines)
```

## ChapterView.tsx (1,969 lines → 6 components)

### Target Structure
```
components/
  Chapter/
    ChapterView.tsx (300 lines - orchestrator)
    ChapterContent.tsx (400 lines)
    TranslationDisplay.tsx (400 lines)
    DiffViewer.tsx (350 lines)
    TokenizationLogic.tsx (300 lines)
    ChapterNavigation.tsx (200 lines)
```
```

---

## Implementation Prompts for Claude Code

### Day 1 Session Prompt:
```
Start Day 1 of tech debt reduction. Read docs/TECH-DEBT-REDUCTION-PLAN.md.

Tasks:
1. Fix OpenAI type errors (Task 1.1)
2. Create minimal test harness (Task 1.2)
3. Fix remaining type errors to get below 100 total

Follow the exact instructions in the plan. Update WORKLOG.md after each task.
```

### Day 2 Session Prompt:
```
Continue with Day 2. Read docs/TECH-DEBT-REDUCTION-PLAN.md section "Day 2-3".

Tasks:
1. Create LOC checking script (Task 2.1)
2. Begin strict typing with smallest services (Task 2.2)
3. Fix 'any' types in services listed (Task 2.3)

Work incrementally, one service at a time. Update WORKLOG.md.
```

### Day 3 Session Prompt:
```
Day 3: Documentation phase. Read docs/TECH-DEBT-REDUCTION-PLAN.md section "Day 3-4".

Tasks:
1. Create ARCHITECTURE.md (Task 3.1)
2. Create INDEXEDDB-DECOMPOSITION-PLAN.md (Task 3.2)
3. Create COMPONENT-DECOMPOSITION-PLAN.md (Task 3.3)

Use grep to gather info, don't read large files. Update WORKLOG.md.
```

### Day 4 Session Prompt:
```
Day 4: Begin decomposition. Read docs/INDEXEDDB-DECOMPOSITION-PLAN.md.

Tasks:
1. Create repository interfaces
2. Extract ChapterRepository (lines 1105-1300)
3. Create facade for backward compatibility
4. Run tests to verify

Follow the plan exactly. The line numbers are provided. Update WORKLOG.md.
```

---

## Success Metrics

### After Day 1-2:
- ✅ TypeScript errors < 100 (from 138)
- ✅ Test harness covers 5 critical operations
- ✅ All builds pass

### After Day 2-3:
- ✅ LOC check script running
- ✅ 10+ services have no 'any' types
- ✅ tsconfig has "noImplicitAny": true

### After Day 3-4:
- ✅ Architecture documented
- ✅ Decomposition plans created
- ✅ First repository extracted

### Final Goal:
- ✅ indexeddb.ts < 500 lines
- ✅ No file > 800 lines (services) or 500 lines (components)
- ✅ 80% test coverage
- ✅ Zero 'any' types
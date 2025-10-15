# Semantic Diff Heatmap Implementation Plan

> **For Claude:** Use `${SUPERPOWERS_SKILLS_ROOT}/skills/collaboration/executing-plans/SKILL.md` to implement this plan task-by-task.

**Goal:** Add visual diff markers showing where AI translation semantically differs from fan translation and/or raw source text at paragraph level.

**Architecture:** Event-driven diff analysis service that chunks AI translation by paragraphs, sends to LLM for semantic comparison against full fan/raw text, persists results to IndexedDB, and renders color-coded markers in a gutter UI with collision detection and keyboard navigation.

**Tech Stack:** TypeScript, React, Zustand, IndexedDB, Vitest, OpenAI-compatible API (gpt-4o-mini for cost efficiency)

---

## Pre-Implementation Setup

### Task 0: Fix Pre-Existing Test Failures

**Files:**
- Modify: `tests/current-system/providers.test.ts:9`
- Modify: `tests/services/imageMigrationService.test.ts:82`

**Step 1: Fix provider test to not expect OpenAI**

```typescript
// tests/current-system/providers.test.ts:9
expect(providers).toEqual(new Set(['DeepSeek', 'OpenRouter', 'Gemini', 'Claude']));
```

**Step 2: Fix image migration test to expect version field**

```typescript
// tests/services/imageMigrationService.test.ts:82
expect(illustration.generatedImage?.imageCacheKey).toEqual(expect.objectContaining({
  chapterId: 'ch-legacy',
  placementMarker: 'ILL-OLD-1'
}));
```

**Step 3: Run tests to verify fixes**

Run: `npm test`
Expected: All tests pass

**Step 4: Commit**

```bash
git add tests/current-system/providers.test.ts tests/services/imageMigrationService.test.ts
git commit -m "fix: update tests for OpenAI removal and image version field"
```

---

## Phase 1: Core Service Layer

### Task 1.1: Create DiffAnalysisService Types

**Files:**
- Create: `services/diff/types.ts`
- Reference: `docs/plans/2025-10-16-semantic-diff-heatmap.md` (design doc)

**Step 1: Write the type definitions**

```typescript
// services/diff/types.ts

/** Semantic difference categories */
export type DiffColor = 'red' | 'orange' | 'green' | 'grey';

/** Granular reason codes for diff markers */
export type DiffReason =
  | 'missing-context'      // AI missing content from fan (red)
  | 'plot-omission'        // AI skipped plot point (red)
  | 'added-detail'         // AI elaborated beyond source (green)
  | 'hallucination'        // AI invented content (green)
  | 'raw-divergence'       // AI differs from raw source (orange)
  | 'stylistic-choice';    // Phrasing/word choice difference (grey)

/** Single diff marker for a paragraph chunk */
export interface DiffMarker {
  chunkId: string;                    // Format: "para-{position}-{hash4}"
  colors: DiffColor[];                // Multiple colors allowed
  reasons: DiffReason[];              // One reason per color
  confidence?: number;                // Optional 0-1 confidence score
  aiRange: { start: number; end: number }; // Character offsets in full AI text
  position: number;                   // Paragraph index (0-based)
}

/** Complete diff analysis result for a chapter */
export interface DiffResult {
  chapterId: string;
  aiVersionId: string;                // Timestamp of AI translation
  fanVersionId: string | null;        // Timestamp of fan translation or null
  rawVersionId: string;               // Hash of raw source text
  algoVersion: string;                // E.g., "1.0.0"
  markers: DiffMarker[];
  analyzedAt: number;                 // Timestamp
  costUsd: number;                    // API cost for this analysis
  model: string;                      // E.g., "gpt-4o-mini"
}

/** Input for diff analysis */
export interface DiffAnalysisRequest {
  chapterId: string;
  aiTranslation: string;              // Full AI translation text
  fanTranslation: string | null;      // Full fan translation or null
  rawText: string;                    // Full raw source text
  previousVersionFeedback?: string;   // Optional feedback from prior version
}
```

**Step 2: Commit**

```bash
git add services/diff/types.ts
git commit -m "feat(diff): add core type definitions for semantic diff analysis"
```

---

### Task 1.2: Create DiffAnalysisService Test Stub

**Files:**
- Create: `tests/services/diff/DiffAnalysisService.test.ts`
- Reference: `${SUPERPOWERS_SKILLS_ROOT}/skills/testing/test-driven-development/SKILL.md`

**Step 1: Write the first failing test (with AI+Fan+Raw)**

```typescript
// tests/services/diff/DiffAnalysisService.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DiffAnalysisService } from '../../../services/diff/DiffAnalysisService';
import type { DiffAnalysisRequest, DiffResult } from '../../../services/diff/types';

describe('DiffAnalysisService', () => {
  let service: DiffAnalysisService;

  beforeEach(() => {
    service = new DiffAnalysisService();
  });

  describe('analyzeDiff()', () => {
    it('should analyze AI translation against fan and raw text', async () => {
      const request: DiffAnalysisRequest = {
        chapterId: 'ch-001',
        aiTranslation: 'The hero arrived.\n\nHe drew his sword.',
        fanTranslation: 'The hero came.\n\nHe unsheathed his blade.',
        rawText: '勇者が到着した。\n\n彼は剣を抜いた。'
      };

      const result: DiffResult = await service.analyzeDiff(request);

      expect(result.chapterId).toBe('ch-001');
      expect(result.markers).toBeInstanceOf(Array);
      expect(result.markers.length).toBeGreaterThan(0);
      expect(result.markers[0]).toHaveProperty('chunkId');
      expect(result.markers[0]).toHaveProperty('colors');
      expect(result.markers[0]).toHaveProperty('reasons');
      expect(result.aiVersionId).toBeDefined();
      expect(result.analyzedAt).toBeGreaterThan(0);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/services/diff/DiffAnalysisService.test.ts`
Expected: FAIL with "Cannot find module"

**Step 3: Commit**

```bash
git add tests/services/diff/DiffAnalysisService.test.ts
git commit -m "test(diff): add failing test for DiffAnalysisService.analyzeDiff()"
```

---

### Task 1.3: Implement DiffAnalysisService Skeleton

**Files:**
- Create: `services/diff/DiffAnalysisService.ts`

**Step 1: Write minimal implementation to make test pass**

```typescript
// services/diff/DiffAnalysisService.ts
import type { DiffAnalysisRequest, DiffResult, DiffMarker } from './types';

export class DiffAnalysisService {
  private static readonly ALGO_VERSION = '1.0.0';
  private static readonly DEFAULT_MODEL = 'gpt-4o-mini';

  /**
   * Analyze semantic differences between AI translation and reference texts
   */
  async analyzeDiff(request: DiffAnalysisRequest): Promise<DiffResult> {
    const { chapterId, aiTranslation, fanTranslation, rawText } = request;

    // Generate chunk IDs from AI translation paragraphs
    const chunks = this.chunkAiTranslation(aiTranslation);

    // For now, return empty markers (will implement LLM call next)
    const result: DiffResult = {
      chapterId,
      aiVersionId: Date.now().toString(),
      fanVersionId: fanTranslation ? Date.now().toString() : null,
      rawVersionId: this.hashText(rawText),
      algoVersion: DiffAnalysisService.ALGO_VERSION,
      markers: [], // TODO: Implement LLM-based analysis
      analyzedAt: Date.now(),
      costUsd: 0,
      model: DiffAnalysisService.DEFAULT_MODEL
    };

    return result;
  }

  /**
   * Split AI translation into paragraph chunks with stable IDs
   */
  private chunkAiTranslation(text: string): Array<{ id: string; text: string; start: number; end: number; position: number }> {
    const paragraphs = text.split('\n\n').filter(p => p.trim().length > 0);
    let currentOffset = 0;

    return paragraphs.map((para, index) => {
      const start = currentOffset;
      const end = start + para.length;
      const hash = this.hashText(para).substring(0, 4);
      const id = `para-${index}-${hash}`;

      currentOffset = end + 2; // Account for \n\n separator

      return { id, text: para, start, end, position: index };
    });
  }

  /**
   * Generate stable 8-char hash of text content
   */
  private hashText(text: string): string {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
  }
}
```

**Step 2: Run test to verify it passes**

Run: `npm test -- tests/services/diff/DiffAnalysisService.test.ts`
Expected: PASS (markers array is empty but structure is correct)

**Step 3: Commit**

```bash
git add services/diff/DiffAnalysisService.ts
git commit -m "feat(diff): add DiffAnalysisService skeleton with chunking logic"
```

---

### Task 1.4: Add LLM Prompt Configuration

**Files:**
- Modify: `config/prompts.json`
- Reference: `docs/plans/2025-10-16-semantic-diff-heatmap.md` (prompt design)

**Step 1: Add diff analysis prompt to config**

```json
// config/prompts.json (add after line 40)
  "diffAnalysisPrompt": "You are a translation alignment expert. Analyze semantic differences between an AI translation and reference texts.\n\n== AI TRANSLATION (CHUNKED) ==\n{{chunks}}\n\n== FAN TRANSLATION (FULL) ==\n{{fanTranslation}}\n\n== RAW SOURCE TEXT (FULL) ==\n{{rawText}}\n\n== PREVIOUS VERSION FEEDBACK ==\n{{previousFeedback}}\n\nFor each AI chunk, identify semantic differences:\n- RED (missing-context, plot-omission): AI missing content from fan translation\n- ORANGE (raw-divergence): AI differs from raw source meaning\n- GREEN (added-detail, hallucination): AI added content not in source\n- GREY (stylistic-choice): Word choice/phrasing differences only\n\nMultiple colors per chunk are allowed. Respond with JSON only (no markdown fences):\n{\n  \"markers\": [\n    {\n      \"chunkId\": \"para-0-e8f4\",\n      \"colors\": [\"orange\", \"grey\"],\n      \"reasons\": [\"raw-divergence\", \"stylistic-choice\"],\n      \"confidence\": 0.85\n    }\n  ]\n}",
```

**Step 2: Commit**

```bash
git add config/prompts.json
git commit -m "feat(diff): add LLM prompt configuration for semantic diff analysis"
```

---

### Task 1.5: Implement LLM-Based Diff Analysis

**Files:**
- Modify: `services/diff/DiffAnalysisService.ts`
- Modify: `tests/services/diff/DiffAnalysisService.test.ts`

**Step 1: Add test with mocked translator**

```typescript
// tests/services/diff/DiffAnalysisService.test.ts (add after existing test)
it('should call translator with correct prompt and parse response', async () => {
  const mockTranslate = vi.fn().mockResolvedValue({
    translatedText: JSON.stringify({
      markers: [
        {
          chunkId: 'para-0-abcd',
          colors: ['grey'],
          reasons: ['stylistic-choice'],
          confidence: 0.9
        }
      ]
    }),
    cost: 0.0011,
    model: 'gpt-4o-mini'
  });

  // Inject mock translator
  (service as any).translator = { translate: mockTranslate };

  const request: DiffAnalysisRequest = {
    chapterId: 'ch-002',
    aiTranslation: 'Test paragraph.',
    fanTranslation: 'Test para.',
    rawText: 'テスト段落。'
  };

  const result = await service.analyzeDiff(request);

  expect(mockTranslate).toHaveBeenCalledTimes(1);
  expect(result.markers.length).toBe(1);
  expect(result.markers[0].colors).toContain('grey');
  expect(result.costUsd).toBe(0.0011);
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/services/diff/DiffAnalysisService.test.ts`
Expected: FAIL with "markers is empty"

**Step 3: Implement LLM integration**

```typescript
// services/diff/DiffAnalysisService.ts (modify analyzeDiff method)
import { translator } from '../translate/Translator';
import prompts from '../../config/prompts.json';

export class DiffAnalysisService {
  private static readonly ALGO_VERSION = '1.0.0';
  private static readonly DEFAULT_MODEL = 'gpt-4o-mini';
  private static readonly TEMPERATURE = 0; // Deterministic results

  async analyzeDiff(request: DiffAnalysisRequest): Promise<DiffResult> {
    const { chapterId, aiTranslation, fanTranslation, rawText, previousVersionFeedback } = request;

    // Generate chunks from AI translation
    const chunks = this.chunkAiTranslation(aiTranslation);

    // Build LLM prompt
    const prompt = this.buildPrompt(chunks, fanTranslation, rawText, previousVersionFeedback);

    // Call LLM
    const response = await translator.translate({
      text: prompt,
      systemPrompt: '',
      provider: 'OpenRouter', // Use OpenRouter for gpt-4o-mini access
      model: DiffAnalysisService.DEFAULT_MODEL,
      temperature: DiffAnalysisService.TEMPERATURE
    });

    // Parse response
    const parsedResponse = JSON.parse(response.translatedText);

    // Enrich markers with position and range data
    const markers: DiffMarker[] = parsedResponse.markers.map((m: any) => {
      const chunk = chunks.find(c => c.id === m.chunkId);
      if (!chunk) return null;

      return {
        ...m,
        aiRange: { start: chunk.start, end: chunk.end },
        position: chunk.position
      };
    }).filter(Boolean);

    const result: DiffResult = {
      chapterId,
      aiVersionId: Date.now().toString(),
      fanVersionId: fanTranslation ? Date.now().toString() : null,
      rawVersionId: this.hashText(rawText),
      algoVersion: DiffAnalysisService.ALGO_VERSION,
      markers,
      analyzedAt: Date.now(),
      costUsd: response.cost || 0,
      model: response.model || DiffAnalysisService.DEFAULT_MODEL
    };

    return result;
  }

  private buildPrompt(
    chunks: Array<{ id: string; text: string }>,
    fanTranslation: string | null,
    rawText: string,
    previousFeedback?: string
  ): string {
    const template = prompts.diffAnalysisPrompt;

    const chunksFormatted = chunks.map(c => `[${c.id}]: ${c.text}`).join('\n\n');
    const fanText = fanTranslation || '(No fan translation available)';
    const feedbackText = previousFeedback || '(No previous feedback)';

    return template
      .replace('{{chunks}}', chunksFormatted)
      .replace('{{fanTranslation}}', fanText)
      .replace('{{rawText}}', rawText)
      .replace('{{previousFeedback}}', feedbackText);
  }

  // ... rest of methods unchanged
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/services/diff/DiffAnalysisService.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add services/diff/DiffAnalysisService.ts tests/services/diff/DiffAnalysisService.test.ts
git commit -m "feat(diff): implement LLM-based semantic diff analysis"
```

---

## Phase 2: Storage Layer

### Task 2.1: Create DiffResults IndexedDB Schema

**Files:**
- Modify: `db/schema.ts`
- Create: `tests/db/diffResults.test.ts`

**Step 1: Write failing test for diffResults store**

```typescript
// tests/db/diffResults.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { openDB, type IDBPDatabase } from 'idb';
import type { LexiconForgeDB } from '../../db/schema';

describe('DiffResults IndexedDB store', () => {
  let db: IDBPDatabase<LexiconForgeDB>;

  beforeEach(async () => {
    db = await openDB<LexiconForgeDB>('test-diff-results', 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('diffResults')) {
          const store = db.createObjectStore('diffResults', {
            keyPath: ['chapterId', 'aiVersionId', 'fanVersionId', 'rawVersionId', 'algoVersion']
          });
          store.createIndex('by_chapter', 'chapterId');
          store.createIndex('by_analyzed_at', 'analyzedAt');
        }
      }
    });
  });

  afterEach(async () => {
    await db.close();
    await indexedDB.deleteDatabase('test-diff-results');
  });

  it('should store and retrieve diff results by composite key', async () => {
    const diffResult = {
      chapterId: 'ch-001',
      aiVersionId: '1234567890',
      fanVersionId: '0987654321',
      rawVersionId: 'abc12345',
      algoVersion: '1.0.0',
      markers: [],
      analyzedAt: Date.now(),
      costUsd: 0.0011,
      model: 'gpt-4o-mini'
    };

    await db.put('diffResults', diffResult);

    const retrieved = await db.get('diffResults', [
      'ch-001', '1234567890', '0987654321', 'abc12345', '1.0.0'
    ]);

    expect(retrieved).toEqual(diffResult);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/db/diffResults.test.ts`
Expected: FAIL with "LexiconForgeDB type error"

**Step 3: Add diffResults to schema**

```typescript
// db/schema.ts (add to LexiconForgeDB interface)
import type { DiffResult } from '../services/diff/types';

export interface LexiconForgeDB extends DBSchema {
  // ... existing stores ...

  diffResults: {
    key: [string, string, string | null, string, string]; // [chapterId, aiVersionId, fanVersionId, rawVersionId, algoVersion]
    value: DiffResult;
    indexes: {
      'by_chapter': string;
      'by_analyzed_at': number;
    };
  };
}
```

**Step 4: Update database version and upgrade logic**

```typescript
// db/open-singleton.ts (increment version, add upgrade for diffResults)
const DB_VERSION = 8; // Increment from current version

export async function getDatabase(): Promise<IDBPDatabase<LexiconForgeDB>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<LexiconForgeDB>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion, newVersion, transaction) {
      // ... existing upgrade logic ...

      // Version 8: Add diffResults store
      if (oldVersion < 8) {
        const diffStore = db.createObjectStore('diffResults', {
          keyPath: ['chapterId', 'aiVersionId', 'fanVersionId', 'rawVersionId', 'algoVersion']
        });
        diffStore.createIndex('by_chapter', 'chapterId');
        diffStore.createIndex('by_analyzed_at', 'analyzedAt');
      }
    }
  });

  return dbInstance;
}
```

**Step 5: Run test to verify it passes**

Run: `npm test -- tests/db/diffResults.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add db/schema.ts db/open-singleton.ts tests/db/diffResults.test.ts
git commit -m "feat(db): add diffResults IndexedDB store with composite key"
```

---

### Task 2.2: Create DiffResultsRepo

**Files:**
- Create: `adapters/repo/DiffResultsRepo.ts`
- Create: `tests/adapters/repo/DiffResultsRepo.test.ts`

**Step 1: Write failing test for repository**

```typescript
// tests/adapters/repo/DiffResultsRepo.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { DiffResultsRepo } from '../../../adapters/repo/DiffResultsRepo';
import type { DiffResult } from '../../../services/diff/types';

describe('DiffResultsRepo', () => {
  let repo: DiffResultsRepo;

  beforeEach(() => {
    repo = new DiffResultsRepo();
  });

  it('should save and retrieve diff result', async () => {
    const diffResult: DiffResult = {
      chapterId: 'ch-test',
      aiVersionId: '111',
      fanVersionId: '222',
      rawVersionId: 'aaa',
      algoVersion: '1.0.0',
      markers: [{ chunkId: 'para-0-test', colors: ['grey'], reasons: ['stylistic-choice'], aiRange: { start: 0, end: 10 }, position: 0 }],
      analyzedAt: Date.now(),
      costUsd: 0.001,
      model: 'gpt-4o-mini'
    };

    await repo.save(diffResult);
    const retrieved = await repo.get(diffResult.chapterId, diffResult.aiVersionId, diffResult.fanVersionId, diffResult.rawVersionId, diffResult.algoVersion);

    expect(retrieved).toEqual(diffResult);
  });

  it('should return null for non-existent diff result', async () => {
    const result = await repo.get('nonexistent', '0', null, 'xyz', '1.0.0');
    expect(result).toBeNull();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/adapters/repo/DiffResultsRepo.test.ts`
Expected: FAIL with "Cannot find module"

**Step 3: Implement repository**

```typescript
// adapters/repo/DiffResultsRepo.ts
import { getDatabase } from '../../db/open-singleton';
import type { DiffResult } from '../../services/diff/types';

export class DiffResultsRepo {
  /**
   * Save a diff result to IndexedDB
   */
  async save(diffResult: DiffResult): Promise<void> {
    const db = await getDatabase();
    await db.put('diffResults', diffResult);
  }

  /**
   * Retrieve a diff result by composite key
   */
  async get(
    chapterId: string,
    aiVersionId: string,
    fanVersionId: string | null,
    rawVersionId: string,
    algoVersion: string
  ): Promise<DiffResult | null> {
    const db = await getDatabase();
    const result = await db.get('diffResults', [chapterId, aiVersionId, fanVersionId, rawVersionId, algoVersion]);
    return result || null;
  }

  /**
   * Get all diff results for a chapter (sorted by analyzedAt desc)
   */
  async getByChapter(chapterId: string): Promise<DiffResult[]> {
    const db = await getDatabase();
    const results = await db.getAllFromIndex('diffResults', 'by_chapter', chapterId);
    return results.sort((a, b) => b.analyzedAt - a.analyzedAt);
  }

  /**
   * Delete a specific diff result
   */
  async delete(
    chapterId: string,
    aiVersionId: string,
    fanVersionId: string | null,
    rawVersionId: string,
    algoVersion: string
  ): Promise<void> {
    const db = await getDatabase();
    await db.delete('diffResults', [chapterId, aiVersionId, fanVersionId, rawVersionId, algoVersion]);
  }

  /**
   * Delete all diff results for a chapter
   */
  async deleteByChapter(chapterId: string): Promise<void> {
    const db = await getDatabase();
    const results = await this.getByChapter(chapterId);
    const tx = db.transaction('diffResults', 'readwrite');
    await Promise.all(results.map(r => tx.store.delete([r.chapterId, r.aiVersionId, r.fanVersionId, r.rawVersionId, r.algoVersion])));
    await tx.done;
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/adapters/repo/DiffResultsRepo.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add adapters/repo/DiffResultsRepo.ts tests/adapters/repo/DiffResultsRepo.test.ts
git commit -m "feat(repo): add DiffResultsRepo for persisting diff analysis results"
```

---

## Phase 3: UI Components

### Task 3.1: Create useDiffMarkers Hook

**Files:**
- Create: `hooks/useDiffMarkers.ts`
- Create: `tests/hooks/useDiffMarkers.test.tsx`

**Step 1: Write failing test for hook**

```typescript
// tests/hooks/useDiffMarkers.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useDiffMarkers } from '../../hooks/useDiffMarkers';
import type { DiffResult } from '../../services/diff/types';

// Mock DiffResultsRepo
vi.mock('../../adapters/repo/DiffResultsRepo', () => ({
  DiffResultsRepo: class {
    async getByChapter(chapterId: string) {
      if (chapterId === 'ch-with-diffs') {
        return [{
          chapterId,
          aiVersionId: '100',
          fanVersionId: null,
          rawVersionId: 'raw1',
          algoVersion: '1.0.0',
          markers: [{ chunkId: 'para-0-abc', colors: ['orange'], reasons: ['raw-divergence'], aiRange: { start: 0, end: 20 }, position: 0 }],
          analyzedAt: Date.now(),
          costUsd: 0.001,
          model: 'gpt-4o-mini'
        }];
      }
      return [];
    }
  }
}));

describe('useDiffMarkers', () => {
  it('should load diff markers for a chapter', async () => {
    const { result } = renderHook(() => useDiffMarkers('ch-with-diffs'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.markers).toHaveLength(1);
    expect(result.current.markers[0].chunkId).toBe('para-0-abc');
  });

  it('should return empty array for chapter with no diffs', async () => {
    const { result } = renderHook(() => useDiffMarkers('ch-no-diffs'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.markers).toHaveLength(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/hooks/useDiffMarkers.test.tsx`
Expected: FAIL with "Cannot find module"

**Step 3: Implement hook**

```typescript
// hooks/useDiffMarkers.ts
import { useState, useEffect } from 'react';
import { DiffResultsRepo } from '../adapters/repo/DiffResultsRepo';
import type { DiffMarker } from '../services/diff/types';

const repo = new DiffResultsRepo();

export function useDiffMarkers(chapterId: string | null) {
  const [markers, setMarkers] = useState<DiffMarker[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!chapterId) {
      setMarkers([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const results = await repo.getByChapter(chapterId);
        if (cancelled) return;

        // Use the most recent diff result
        const latestResult = results[0];
        setMarkers(latestResult?.markers || []);
      } catch (error) {
        console.error('[useDiffMarkers] Error loading markers:', error);
        setMarkers([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [chapterId]);

  return { markers, loading };
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/hooks/useDiffMarkers.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add hooks/useDiffMarkers.ts tests/hooks/useDiffMarkers.test.tsx
git commit -m "feat(hooks): add useDiffMarkers hook for loading chapter diff markers"
```

---

### Task 3.2: Create DiffPip Component

**Files:**
- Create: `components/diff/DiffPip.tsx`
- Create: `components/diff/DiffPip.module.css`
- Create: `tests/components/diff/DiffPip.test.tsx`

**Step 1: Write failing test for component**

```typescript
// tests/components/diff/DiffPip.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DiffPip } from '../../../components/diff/DiffPip';

describe('DiffPip', () => {
  it('should render single color pip', () => {
    render(<DiffPip colors={['orange']} onClick={() => {}} />);
    const pip = screen.getByRole('button');
    expect(pip).toHaveStyle({ backgroundColor: 'var(--diff-orange)' });
  });

  it('should render stacked pips for 2 colors', () => {
    render(<DiffPip colors={['orange', 'red']} onClick={() => {}} />);
    const pips = screen.getAllByRole('button');
    expect(pips).toHaveLength(2);
  });

  it('should show halo for 3+ colors', () => {
    render(<DiffPip colors={['orange', 'red', 'green']} onClick={() => {}} />);
    const container = screen.getByTestId('diff-pip-container');
    expect(container).toHaveClass('has-halo');
  });

  it('should call onClick when clicked', () => {
    const handleClick = vi.fn();
    render(<DiffPip colors={['grey']} onClick={handleClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/components/diff/DiffPip.test.tsx`
Expected: FAIL with "Cannot find module"

**Step 3: Implement component**

```typescript
// components/diff/DiffPip.tsx
import React from 'react';
import type { DiffColor } from '../../services/diff/types';
import styles from './DiffPip.module.css';

interface DiffPipProps {
  colors: DiffColor[];
  onClick: () => void;
  'aria-label'?: string;
}

const COLOR_PRIORITY: Record<DiffColor, number> = {
  orange: 0,
  red: 1,
  green: 2,
  grey: 3
};

export function DiffPip({ colors, onClick, 'aria-label': ariaLabel }: DiffPipProps) {
  // Sort colors by priority
  const sortedColors = [...colors].sort((a, b) => COLOR_PRIORITY[a] - COLOR_PRIORITY[b]);

  // Stacking logic: max 2 visible + halo for 3+
  const visibleColors = sortedColors.slice(0, 2);
  const hasHalo = sortedColors.length > 2;

  if (visibleColors.length === 1) {
    // Single color: solid pip
    return (
      <button
        className={styles.pip}
        style={{ backgroundColor: `var(--diff-${visibleColors[0]})` }}
        onClick={onClick}
        aria-label={ariaLabel || `Diff marker: ${visibleColors[0]}`}
      />
    );
  }

  // Multiple colors: stacked pips
  return (
    <div
      className={`${styles.pipContainer} ${hasHalo ? styles.hasHalo : ''}`}
      data-testid="diff-pip-container"
    >
      {visibleColors.map((color, index) => (
        <button
          key={`${color}-${index}`}
          className={`${styles.pip} ${styles.stacked}`}
          style={{
            backgroundColor: `var(--diff-${color})`,
            transform: `translateX(${index * 4}px)`
          }}
          onClick={onClick}
          aria-label={ariaLabel || `Diff marker: ${sortedColors.join(', ')}`}
        />
      ))}
    </div>
  );
}
```

**Step 4: Create CSS module**

```css
/* components/diff/DiffPip.module.css */
.pip {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  border: 1px solid rgba(0, 0, 0, 0.2);
  cursor: pointer;
  padding: 0;
  margin: 0;
  transition: transform 0.15s ease;
}

.pip:hover {
  transform: scale(1.3);
}

.pip:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

/* Colorblind-safe: dashed border for orange */
.pip[style*="--diff-orange"] {
  border-style: dashed;
}

.pipContainer {
  position: relative;
  display: inline-flex;
  align-items: center;
}

.pipContainer.hasHalo::after {
  content: '';
  position: absolute;
  top: -2px;
  left: -2px;
  right: -2px;
  bottom: -2px;
  border-radius: 50%;
  border: 1px dashed var(--diff-grey);
  pointer-events: none;
}

.pip.stacked {
  position: relative;
}
```

**Step 5: Run test to verify it passes**

Run: `npm test -- tests/components/diff/DiffPip.test.tsx`
Expected: PASS

**Step 6: Commit**

```bash
git add components/diff/DiffPip.tsx components/diff/DiffPip.module.css tests/components/diff/DiffPip.test.tsx
git commit -m "feat(ui): add DiffPip component with color stacking and halo"
```

---

### Task 3.3: Create DiffGutter Component

**Files:**
- Create: `components/diff/DiffGutter.tsx`
- Create: `components/diff/DiffGutter.module.css`
- Create: `tests/components/diff/DiffGutter.test.tsx`

**Step 1: Write failing test for gutter**

```typescript
// tests/components/diff/DiffGutter.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DiffGutter } from '../../../components/diff/DiffGutter';
import type { DiffMarker } from '../../../services/diff/types';

describe('DiffGutter', () => {
  const mockMarkers: DiffMarker[] = [
    { chunkId: 'para-0-abc', colors: ['orange'], reasons: ['raw-divergence'], aiRange: { start: 0, end: 50 }, position: 0 },
    { chunkId: 'para-1-def', colors: ['red', 'grey'], reasons: ['missing-context', 'stylistic-choice'], aiRange: { start: 52, end: 120 }, position: 1 }
  ];

  it('should render markers in gutter', () => {
    render(<DiffGutter markers={mockMarkers} onMarkerClick={() => {}} />);
    const pips = screen.getAllByRole('button');
    expect(pips.length).toBeGreaterThanOrEqual(2); // At least 2 markers
  });

  it('should position markers based on scroll percentage', () => {
    const { container } = render(<DiffGutter markers={mockMarkers} onMarkerClick={() => {}} />);
    const gutterMarkers = container.querySelectorAll('[data-position]');
    expect(gutterMarkers.length).toBe(2);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/components/diff/DiffGutter.test.tsx`
Expected: FAIL with "Cannot find module"

**Step 3: Implement gutter component**

```typescript
// components/diff/DiffGutter.tsx
import React, { useEffect, useState, useRef } from 'react';
import { DiffPip } from './DiffPip';
import type { DiffMarker } from '../../services/diff/types';
import styles from './DiffGutter.module.css';

interface DiffGutterProps {
  markers: DiffMarker[];
  onMarkerClick: (marker: DiffMarker) => void;
}

export function DiffGutter({ markers, onMarkerClick }: DiffGutterProps) {
  const gutterRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState<number>(0);

  useEffect(() => {
    // Calculate total scrollable content height
    const updateHeight = () => {
      const content = document.querySelector('[data-translation-content]') as HTMLElement;
      if (content) {
        setContentHeight(content.scrollHeight);
      }
    };

    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, [markers]);

  if (markers.length === 0) return null;

  return (
    <div ref={gutterRef} className={styles.gutter} aria-label="Diff markers">
      {markers.map((marker) => {
        // Calculate position as percentage of content height
        const scrollPercentage = contentHeight > 0
          ? (marker.aiRange.start / contentHeight) * 100
          : marker.position * 10; // Fallback to position-based

        return (
          <div
            key={marker.chunkId}
            className={styles.gutterMarker}
            style={{ top: `${scrollPercentage}%` }}
            data-position={marker.position}
          >
            <DiffPip
              colors={marker.colors}
              onClick={() => onMarkerClick(marker)}
              aria-label={`Diff at paragraph ${marker.position + 1}: ${marker.reasons.join(', ')}`}
            />
          </div>
        );
      })}
    </div>
  );
}
```

**Step 4: Create CSS for gutter**

```css
/* components/diff/DiffGutter.module.css */
.gutter {
  position: fixed;
  right: 12px;
  top: 80px; /* Below header */
  bottom: 40px;
  width: 16px;
  background: rgba(0, 0, 0, 0.05);
  border-radius: 8px;
  z-index: 100;
  pointer-events: none;
}

.gutterMarker {
  position: absolute;
  right: 4px;
  pointer-events: auto;
}

@media (max-width: 768px) {
  .gutter {
    right: 4px;
    width: 12px;
  }
}
```

**Step 5: Run test to verify it passes**

Run: `npm test -- tests/components/diff/DiffGutter.test.tsx`
Expected: PASS

**Step 6: Commit**

```bash
git add components/diff/DiffGutter.tsx components/diff/DiffGutter.module.css tests/components/diff/DiffGutter.test.tsx
git commit -m "feat(ui): add DiffGutter component with scroll-based positioning"
```

---

## Phase 4: Integration & Triggers

### Task 4.1: Integrate DiffGutter into ChapterView

**Files:**
- Modify: `components/ChapterView.tsx`
- Reference: `docs/plans/2025-10-16-semantic-diff-heatmap.md`

**Step 1: Import dependencies and hook**

```typescript
// components/ChapterView.tsx (add imports at top)
import { DiffGutter } from './diff/DiffGutter';
import { useDiffMarkers } from '../hooks/useDiffMarkers';
import type { DiffMarker } from '../services/diff/types';
```

**Step 2: Add hook to component**

```typescript
// components/ChapterView.tsx (inside ChapterView component, after existing hooks)
const { markers: diffMarkers, loading: diffMarkersLoading } = useDiffMarkers(currentChapterId);
```

**Step 3: Add marker click handler**

```typescript
// components/ChapterView.tsx (add handler before return statement)
const handleDiffMarkerClick = (marker: DiffMarker) => {
  // Scroll to the paragraph containing this marker
  const targetElement = document.querySelector(`[data-lf-chunk*="para-${marker.position}"]`);
  if (targetElement) {
    targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // Optionally trigger comparison toolbar for this chunk
    // (existing comparison logic can be reused)
  }
};
```

**Step 4: Render DiffGutter in JSX**

```typescript
// components/ChapterView.tsx (add after main content div)
{!diffMarkersLoading && diffMarkers.length > 0 && (
  <DiffGutter markers={diffMarkers} onMarkerClick={handleDiffMarkerClick} />
)}
```

**Step 5: Add data attribute to translation content container**

```typescript
// components/ChapterView.tsx (add to main translation content div)
<div className={styles.translationContent} data-translation-content>
  {/* existing content */}
</div>
```

**Step 6: Manual test**

Run: `npm run dev`
Navigate to a chapter with diff analysis
Expected: See diff markers in gutter on right side

**Step 7: Commit**

```bash
git add components/ChapterView.tsx
git commit -m "feat(ui): integrate DiffGutter into ChapterView with scroll-to-marker"
```

---

### Task 4.2: Trigger Diff Analysis on Translation Complete

**Files:**
- Modify: `services/translationService.ts` (or equivalent translation trigger)
- Create: `tests/services/translationService.diff-trigger.test.ts`

**Step 1: Write failing test for auto-trigger**

```typescript
// tests/services/translationService.diff-trigger.test.ts
import { describe, it, expect, vi } from 'vitest';
import { DiffAnalysisService } from '../../services/diff/DiffAnalysisService';

describe('Translation service diff analysis trigger', () => {
  it('should trigger diff analysis after successful translation', async () => {
    const analyzeDiffSpy = vi.spyOn(DiffAnalysisService.prototype, 'analyzeDiff');

    // Simulate translation completion event
    window.dispatchEvent(new CustomEvent('translation:complete', {
      detail: {
        chapterId: 'ch-test',
        aiTranslation: 'Test translation.',
        fanTranslation: 'Test fan TL.',
        rawText: 'テスト'
      }
    }));

    await new Promise(resolve => setTimeout(resolve, 100)); // Wait for async trigger

    expect(analyzeDiffSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        chapterId: 'ch-test',
        aiTranslation: 'Test translation.',
        fanTranslation: 'Test fan TL.',
        rawText: 'テスト'
      })
    );
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/services/translationService.diff-trigger.test.ts`
Expected: FAIL with "analyzeDiff not called"

**Step 3: Add event listener to trigger diff analysis**

```typescript
// services/translationService.ts (or create services/diff/DiffTriggerService.ts)
import { DiffAnalysisService } from './diff/DiffAnalysisService';
import { DiffResultsRepo } from '../adapters/repo/DiffResultsRepo';

const diffService = new DiffAnalysisService();
const diffRepo = new DiffResultsRepo();

// Listen for translation completion events
window.addEventListener('translation:complete', async (event: CustomEvent) => {
  const { chapterId, aiTranslation, fanTranslation, rawText, previousVersionFeedback } = event.detail;

  try {
    console.log('[DiffTrigger] Starting diff analysis for chapter:', chapterId);

    const result = await diffService.analyzeDiff({
      chapterId,
      aiTranslation,
      fanTranslation: fanTranslation || null,
      rawText,
      previousVersionFeedback
    });

    await diffRepo.save(result);

    console.log('[DiffTrigger] Diff analysis complete:', result.markers.length, 'markers');

    // Notify UI to refresh markers
    window.dispatchEvent(new CustomEvent('diff:updated', { detail: { chapterId } }));
  } catch (error) {
    console.error('[DiffTrigger] Diff analysis failed:', error);
  }
});
```

**Step 4: Dispatch event from translation completion handler**

```typescript
// store/slices/translationsSlice.ts (or wherever translation completes)
// After successful translation and saving to IndexedDB:
window.dispatchEvent(new CustomEvent('translation:complete', {
  detail: {
    chapterId: chapter.id,
    aiTranslation: translationResult.translatedText,
    fanTranslation: chapter.fanTranslation || null,
    rawText: chapter.rawContent,
    previousVersionFeedback: chapter.feedbackSummary || undefined
  }
}));
```

**Step 5: Run test to verify it passes**

Run: `npm test -- tests/services/translationService.diff-trigger.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add services/diff/DiffTriggerService.ts store/slices/translationsSlice.ts tests/services/translationService.diff-trigger.test.ts
git commit -m "feat(diff): auto-trigger diff analysis on translation completion"
```

---

## Phase 5: Export/Import Support

### Task 5.1: Add Diff Results to Session Export

**Files:**
- Modify: `services/exportService.ts` (or equivalent session export logic)
- Modify: `tests/current-system/export-import.test.ts`

**Step 1: Add failing test for export with diff results**

```typescript
// tests/current-system/export-import.test.ts (add new test)
it('should include diffResults in exported session data', async () => {
  const diffRepo = new DiffResultsRepo();
  await diffRepo.save({
    chapterId: 'ch-001',
    aiVersionId: '100',
    fanVersionId: null,
    rawVersionId: 'raw1',
    algoVersion: '1.0.0',
    markers: [],
    analyzedAt: Date.now(),
    costUsd: 0.001,
    model: 'gpt-4o-mini'
  });

  const exported = await exportSessionData();

  expect(exported.diffResults).toBeDefined();
  expect(exported.diffResults).toHaveLength(1);
  expect(exported.diffResults[0].chapterId).toBe('ch-001');
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/current-system/export-import.test.ts`
Expected: FAIL with "diffResults is undefined"

**Step 3: Modify export logic to include diff results**

```typescript
// services/exportService.ts (or store/index.ts export function)
import { DiffResultsRepo } from '../adapters/repo/DiffResultsRepo';

export async function exportSessionData(): Promise<SessionExport> {
  const diffRepo = new DiffResultsRepo();

  // ... existing export logic for chapters, settings, etc. ...

  // Export all diff results
  const allDiffResults = await (async () => {
    const db = await getDatabase();
    return await db.getAll('diffResults');
  })();

  return {
    version: EXPORT_SCHEMA_VERSION,
    exportedAt: Date.now(),
    chapters: exportedChapters,
    settings: exportedSettings,
    diffResults: allDiffResults, // Add diff results
    // ... other export data ...
  };
}
```

**Step 4: Update SessionExport type**

```typescript
// types/export.ts (or wherever SessionExport is defined)
import type { DiffResult } from '../services/diff/types';

export interface SessionExport {
  version: string;
  exportedAt: number;
  chapters: ChapterData[];
  settings: Settings;
  diffResults?: DiffResult[]; // Optional for backward compatibility
  // ... other fields ...
}
```

**Step 5: Run test to verify it passes**

Run: `npm test -- tests/current-system/export-import.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add services/exportService.ts types/export.ts tests/current-system/export-import.test.ts
git commit -m "feat(export): include diff results in session export"
```

---

### Task 5.2: Import Diff Results from Session Data

**Files:**
- Modify: `services/importService.ts` (or equivalent import logic)
- Modify: `tests/current-system/export-import.test.ts`

**Step 1: Add failing test for import**

```typescript
// tests/current-system/export-import.test.ts (add new test)
it('should restore diffResults from imported session data', async () => {
  const sessionData: SessionExport = {
    version: '1.0.0',
    exportedAt: Date.now(),
    chapters: [],
    settings: {},
    diffResults: [
      {
        chapterId: 'ch-import',
        aiVersionId: '200',
        fanVersionId: null,
        rawVersionId: 'raw2',
        algoVersion: '1.0.0',
        markers: [{ chunkId: 'para-0-xyz', colors: ['grey'], reasons: ['stylistic-choice'], aiRange: { start: 0, end: 10 }, position: 0 }],
        analyzedAt: Date.now(),
        costUsd: 0.001,
        model: 'gpt-4o-mini'
      }
    ]
  };

  await importSessionData(sessionData);

  const diffRepo = new DiffResultsRepo();
  const imported = await diffRepo.get('ch-import', '200', null, 'raw2', '1.0.0');

  expect(imported).toBeDefined();
  expect(imported?.markers).toHaveLength(1);
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/current-system/export-import.test.ts`
Expected: FAIL with "imported is null"

**Step 3: Modify import logic to restore diff results**

```typescript
// services/importService.ts (or store/index.ts import function)
import { DiffResultsRepo } from '../adapters/repo/DiffResultsRepo';

export async function importSessionData(data: SessionExport): Promise<void> {
  const diffRepo = new DiffResultsRepo();

  // ... existing import logic for chapters, settings, etc. ...

  // Import diff results if present
  if (data.diffResults && Array.isArray(data.diffResults)) {
    console.log('[Import] Restoring', data.diffResults.length, 'diff results');
    for (const diffResult of data.diffResults) {
      await diffRepo.save(diffResult);
    }
  }

  console.log('[Import] Session data imported successfully');
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/current-system/export-import.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add services/importService.ts tests/current-system/export-import.test.ts
git commit -m "feat(import): restore diff results from session import"
```

---

## Phase 6: Settings & Configuration

### Task 6.1: Add Settings Toggle for Diff Heatmap

**Files:**
- Modify: `components/SettingsModal.tsx`
- Modify: `store/slices/settingsSlice.ts`
- Create: `styles/diff-colors.css`

**Step 1: Add settings field**

```typescript
// store/slices/settingsSlice.ts (add to Settings interface)
export interface Settings {
  // ... existing settings ...
  showDiffHeatmap?: boolean; // Default true
}

// Add default
const DEFAULT_SETTINGS: Settings = {
  // ... existing defaults ...
  showDiffHeatmap: true
};
```

**Step 2: Add toggle to SettingsModal**

```tsx
// components/SettingsModal.tsx (add in UI section)
<div className={styles.settingRow}>
  <label htmlFor="show-diff-heatmap">
    <input
      type="checkbox"
      id="show-diff-heatmap"
      checked={settings.showDiffHeatmap ?? true}
      onChange={(e) => onUpdateSettings({ ...settings, showDiffHeatmap: e.target.checked })}
    />
    Show semantic diff heatmap
  </label>
  <p className={styles.settingDescription}>
    Display visual markers showing where AI translation differs from reference texts
  </p>
</div>
```

**Step 3: Create CSS variables for diff colors**

```css
/* styles/diff-colors.css */
:root {
  --diff-red: #ef4444;       /* Missing content (AI < fan) */
  --diff-orange: #f97316;    /* Raw divergence */
  --diff-green: #10b981;     /* Added detail (AI > source) */
  --diff-grey: #9ca3af;      /* Stylistic only */
}

/* Dark mode adjustments */
@media (prefers-color-scheme: dark) {
  :root {
    --diff-red: #f87171;
    --diff-orange: #fb923c;
    --diff-green: #34d399;
    --diff-grey: #6b7280;
  }
}
```

**Step 4: Import CSS in main app**

```typescript
// main.tsx or App.tsx
import './styles/diff-colors.css';
```

**Step 5: Conditional rendering in ChapterView**

```typescript
// components/ChapterView.tsx (modify DiffGutter render)
const showDiffHeatmap = useStore(state => state.settings.showDiffHeatmap ?? true);

{showDiffHeatmap && !diffMarkersLoading && diffMarkers.length > 0 && (
  <DiffGutter markers={diffMarkers} onMarkerClick={handleDiffMarkerClick} />
)}
```

**Step 6: Manual test**

Run: `npm run dev`
Open Settings → Toggle "Show semantic diff heatmap"
Expected: Gutter markers appear/disappear

**Step 7: Commit**

```bash
git add store/slices/settingsSlice.ts components/SettingsModal.tsx styles/diff-colors.css components/ChapterView.tsx
git commit -m "feat(settings): add toggle for semantic diff heatmap display"
```

---

## Phase 7: Keyboard Navigation & Accessibility

### Task 7.1: Add Keyboard Shortcuts for Marker Navigation

**Files:**
- Create: `hooks/useDiffNavigation.ts`
- Modify: `components/ChapterView.tsx`

**Step 1: Create navigation hook**

```typescript
// hooks/useDiffNavigation.ts
import { useEffect, useRef } from 'react';
import type { DiffMarker } from '../services/diff/types';

export function useDiffNavigation(markers: DiffMarker[], enabled: boolean = true) {
  const currentIndexRef = useRef<number>(-1);

  useEffect(() => {
    if (!enabled || markers.length === 0) return;

    const handleKeyPress = (e: KeyboardEvent) => {
      // Alt+J: Jump to next marker
      if (e.altKey && e.key === 'j') {
        e.preventDefault();
        currentIndexRef.current = (currentIndexRef.current + 1) % markers.length;
        jumpToMarker(markers[currentIndexRef.current]);
      }

      // Alt+K: Jump to previous marker
      if (e.altKey && e.key === 'k') {
        e.preventDefault();
        currentIndexRef.current = currentIndexRef.current <= 0
          ? markers.length - 1
          : currentIndexRef.current - 1;
        jumpToMarker(markers[currentIndexRef.current]);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [markers, enabled]);

  function jumpToMarker(marker: DiffMarker) {
    const targetElement = document.querySelector(`[data-lf-chunk*="para-${marker.position}"]`);
    if (targetElement) {
      targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });

      // Highlight briefly
      targetElement.classList.add('diff-highlight');
      setTimeout(() => targetElement.classList.remove('diff-highlight'), 2000);
    }
  }
}
```

**Step 2: Add CSS for highlight**

```css
/* styles/global.css or ChapterView.module.css */
@keyframes diff-highlight-pulse {
  0%, 100% { background-color: transparent; }
  50% { background-color: rgba(251, 146, 60, 0.2); }
}

.diff-highlight {
  animation: diff-highlight-pulse 2s ease-in-out;
}
```

**Step 3: Use hook in ChapterView**

```typescript
// components/ChapterView.tsx
import { useDiffNavigation } from '../hooks/useDiffNavigation';

// Inside ChapterView component
const showDiffHeatmap = useStore(state => state.settings.showDiffHeatmap ?? true);
useDiffNavigation(diffMarkers, showDiffHeatmap);
```

**Step 4: Add keyboard shortcut help text to UI**

```tsx
// components/SettingsModal.tsx (add in help section or keyboard shortcuts section)
<div className={styles.keyboardShortcuts}>
  <h3>Diff Navigation</h3>
  <ul>
    <li><kbd>Alt+J</kbd> – Next diff marker</li>
    <li><kbd>Alt+K</kbd> – Previous diff marker</li>
  </ul>
</div>
```

**Step 5: Manual test**

Run: `npm run dev`
Navigate to chapter with diff markers
Press Alt+J, Alt+K
Expected: Scroll to markers with highlight animation

**Step 6: Commit**

```bash
git add hooks/useDiffNavigation.ts components/ChapterView.tsx components/SettingsModal.tsx styles/global.css
git commit -m "feat(a11y): add Alt+J/K keyboard shortcuts for diff marker navigation"
```

---

## Final Integration & Testing

### Task 8.1: Run Full Test Suite

**Step 1: Run all tests**

Run: `npm test`
Expected: All tests pass (including new diff tests)

**Step 2: If failures occur, fix them**

Use `${SUPERPOWERS_SKILLS_ROOT}/skills/debugging/systematic-debugging/SKILL.md`

**Step 3: Commit fixes**

```bash
git add <fixed-files>
git commit -m "fix: resolve test failures in diff feature"
```

---

### Task 8.2: Manual End-to-End Testing

**Checklist:**

1. [ ] Translate a new chapter → Verify diff analysis triggers automatically
2. [ ] Check diff markers appear in gutter
3. [ ] Click marker → Verify scroll-to-paragraph works
4. [ ] Test with chapter that has no fan translation (should show orange/grey only)
5. [ ] Test with chapter that has fan translation (should show all colors)
6. [ ] Export session → Verify diffResults in JSON
7. [ ] Import session → Verify diff markers restored
8. [ ] Toggle "Show diff heatmap" setting → Verify gutter appears/disappears
9. [ ] Test Alt+J / Alt+K keyboard navigation
10. [ ] Test on mobile (markers should be smaller, dominant color only)

**Step 1: Perform all manual tests**

**Step 2: Document any issues found**

Create issues or fix immediately

---

### Task 8.3: Merge Feature Branch

**Files:**
- Reference: `${SUPERPOWERS_SKILLS_ROOT}/skills/collaboration/finishing-a-development-branch/SKILL.md`

**Step 1: Ensure all tests pass**

Run: `npm test`
Expected: 0 failures

**Step 2: Switch back to main worktree**

```bash
cd /Users/aditya/Documents/Ongoing\ Local/LexiconForge
```

**Step 3: Merge feature branch**

```bash
git merge feature/semantic-diff-heatmap --no-ff
```

**Step 4: Push to remote**

```bash
git push origin main
```

**Step 5: Clean up worktree**

```bash
git worktree remove .worktrees/semantic-diff-heatmap
git branch -d feature/semantic-diff-heatmap
```

---

## Cost & Performance Notes

**Estimated Costs (per chapter):**
- gpt-4o-mini: ~$0.0011 USD (300 tokens input + 100 tokens output)
- Gemini Flash 2.0: ~$0.0002 USD (highly cost-efficient alternative)

**Performance Targets:**
- Diff analysis: < 3 seconds per chapter
- Marker rendering: < 100ms
- Storage: ~2KB per chapter (IndexedDB)

**Optimization Opportunities:**
- Cache diff results aggressively (only recompute if AI version changes)
- Batch analysis for multiple chapters in background
- Use cheaper model (Gemini Flash) for diff analysis if cost is concern

---

## Deployment Checklist

- [ ] All tests passing
- [ ] Manual E2E testing complete
- [ ] Feature documented in README.md
- [ ] Settings toggle added
- [ ] Keyboard shortcuts documented
- [ ] Export/import tested
- [ ] Mobile responsiveness verified
- [ ] Colorblind-safe design verified
- [ ] Performance acceptable (< 3s analysis, < 100ms render)
- [ ] Cost tracking accurate

---

## Future Enhancements (Not in Scope)

These are documented in `docs/plans/2025-10-16-semantic-diff-heatmap.md`:

1. Inline diff tooltip on hover
2. Diff legend panel with color explanations
3. Batch re-analysis for all chapters
4. Diff comparison mode (side-by-side view)
5. User-editable diff markers
6. Minimap diagonal split rendering
7. Advanced analytics (diff density heatmap over time)

---

**End of Implementation Plan**

> **Next Step:** Use `${SUPERPOWERS_SKILLS_ROOT}/skills/collaboration/executing-plans/SKILL.md` or `${SUPERPOWERS_SKILLS_ROOT}/skills/collaboration/subagent-driven-development/SKILL.md` to execute this plan task-by-task with TDD rigor.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useAppStore } from '../../store';
import type { EnhancedChapter } from '../../services/stableIdService';
import type { TranslationResult } from '../../types';
import type { DiffResult } from '../../services/diff/types';
import {
  AmendmentOps,
  ChapterOps,
  DiffOps,
  ImportOps,
  SessionExportOps,
  SettingsOps,
  TemplatesOps,
  TranslationOps,
} from '../../services/db/operations';
import * as RenderingOps from '../../services/db/operations/rendering';
import { normalizeUrlAggressively } from '../../services/stableIdService';
import type { DiffMarker } from '../../services/diff/types';

const resetStore = () => {
  useAppStore.setState({
    chapters: new Map(),
    urlIndex: new Map(),
    rawUrlIndex: new Map(),
    navigationHistory: [],
    currentChapterId: null,
  });
};

const sampleChapter = (id: string, url: string): EnhancedChapter => ({
  id,
  title: `Title ${id}`,
  content: 'Translated content with <i>styling</i>.',
  originalUrl: url,
  canonicalUrl: url,
  nextUrl: null,
  prevUrl: null,
  sourceUrls: [url],
  fanTranslation: null,
  translationResult: {
    translatedTitle: `Translated ${id}`,
    translation: 'Translated content with <i>styling</i>.',
    proposal: null,
    footnotes: [],
    suggestedIllustrations: [],
    usageMetrics: {
      totalTokens: 1200,
      promptTokens: 700,
      completionTokens: 500,
      estimatedCost: 0.0009,
      requestTime: 3,
      provider: 'Gemini',
      model: 'gemini-2.5-flash',
    },
  } as TranslationResult,
  feedback: [],
});

describe('Session export/import', () => {
  beforeEach(() => {
    resetStore();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('diffResults export/import', () => {
    it('[Integration] should serialize diffResults with full field fidelity on export', async () => {
      // Integration test: Save real data with ALL fields, then verify export captures everything
      const fixedTimestamp = 1703520000000;

      const testDiffResult: DiffResult = {
        chapterId: 'stable-export-fidelity',
        aiVersionId: 'ai-export-123',
        fanVersionId: 'fan-export-456', // Non-null fan version
        rawVersionId: 'raw-export-789',
        algoVersion: '2.1.0',
        aiHash: 'exporthash1',
        fanHash: 'exporthash2',
        rawHash: 'exporthash3',
        markers: [
          {
            chunkId: 'para-0-export',
            colors: ['grey', 'blue'], // Multiple colors
            reasons: ['stylistic-choice', 'fan-divergence'],
            aiRange: { start: 0, end: 50 },
            position: 0,
            explanations: ['Style differs', 'Fan had different wording'],
            confidence: 0.92
          },
          {
            chunkId: 'para-1-export',
            colors: ['purple'],
            reasons: ['sensitivity-filter'],
            aiRange: { start: 51, end: 100 },
            position: 1
          }
        ],
        analyzedAt: fixedTimestamp,
        costUsd: 0.00345,
        model: 'gpt-4o'
      };

      // Save to actual DB (no mocks)
      await DiffOps.save(testDiffResult);

      // Export should retrieve from DB with full fidelity
      const exported = await SessionExportOps.exportFullSession();

      expect(exported.diffResults).toBeDefined();
      const found = exported.diffResults.find((r: DiffResult) => r.chapterId === 'stable-export-fidelity');
      expect(found).toBeDefined();

      // Verify ALL top-level fields survive export
      expect(found).toMatchObject({
        chapterId: 'stable-export-fidelity',
        aiVersionId: 'ai-export-123',
        fanVersionId: 'fan-export-456',
        rawVersionId: 'raw-export-789',
        algoVersion: '2.1.0',
        costUsd: 0.00345,
        model: 'gpt-4o'
      });

      // Verify hash fields
      expect(found?.aiHash).toBe('exporthash1');
      expect(found?.fanHash).toBe('exporthash2');
      expect(found?.rawHash).toBe('exporthash3');
      expect(found?.analyzedAt).toBe(fixedTimestamp);

      // Verify markers structure
      expect(found?.markers).toHaveLength(2);
      expect(found?.markers[0].colors).toEqual(['grey', 'blue']);
      expect(found?.markers[0].reasons).toEqual(['stylistic-choice', 'fan-divergence']);
      expect(found?.markers[0].explanations).toEqual(['Style differs', 'Fan had different wording']);
      expect(found?.markers[0].confidence).toBe(0.92);
      expect(found?.markers[1].colors).toEqual(['purple']);
      expect(found?.markers[1].reasons).toEqual(['sensitivity-filter']);
    });

    it('[Integration] should include diffResults from real DB', async () => {
      // Integration test: Use actual fake-indexeddb to test full data flow
      const testDiffResult: DiffResult = {
        chapterId: 'stable-integration',
        aiVersionId: 'ai-version-123',
        fanVersionId: null,
        rawVersionId: 'raw-version-456',
        algoVersion: '1.0.0',
        markers: [{
          chunkId: 'para-0-test',
          colors: ['orange'],
          reasons: ['raw-divergence'],
          aiRange: { start: 0, end: 15 },
          position: 0
        }],
        analyzedAt: Date.now(),
        costUsd: 0.002,
        model: 'gpt-4o-mini'
      };

      // Save to actual DB
      await DiffOps.save(testDiffResult);

      // Export should retrieve from DB
      const exported = await SessionExportOps.exportFullSession();

      expect(exported.diffResults).toBeDefined();
      expect(exported.diffResults.length).toBeGreaterThanOrEqual(1);

      const found = exported.diffResults.find((r: any) => r.chapterId === 'stable-integration');
      expect(found).toBeDefined();
      expect(found?.aiVersionId).toBe('ai-version-123');
      expect(found?.model).toBe('gpt-4o-mini');
    });

    it('should restore diffResults from imported session data with full field fidelity', async () => {
      // Use fixed timestamp for deterministic testing
      const fixedTimestamp = 1703520000000;

      // Create a comprehensive test case with ALL fields populated, including edge cases
      const testDiffResult: DiffResult = {
        chapterId: 'stable-import-fidelity',
        aiVersionId: '9876543210',
        fanVersionId: null, // imports.ts normalizes null → '' before storage
        rawVersionId: 'xyz98765',
        algoVersion: '2.0.0',
        aiHash: 'abc12345',
        fanHash: null, // Should survive as null
        rawHash: 'def67890',
        markers: [
          {
            chunkId: 'para-0-xyz',
            colors: ['orange', 'grey'], // Multiple colors
            reasons: ['raw-divergence', 'stylistic-choice'], // Multiple reasons
            aiRange: { start: 0, end: 20 },
            position: 0
          },
          {
            chunkId: 'para-1-abc',
            colors: ['red'],
            reasons: ['missing-context'],
            aiRange: { start: 21, end: 50 },
            position: 1,
            explanations: ['Context was omitted from source'],
            confidence: 0.85
          }
        ],
        analyzedAt: fixedTimestamp,
        costUsd: 0.00234,
        model: 'gpt-4o-mini'
      };

      const sessionData = {
        metadata: { format: 'lexiconforge-full-1', exportedAt: new Date().toISOString() },
        settings: null,
        navigation: { history: [], lastActive: null },
        urlMappings: [],
        novels: [],
        chapters: [],
        promptTemplates: [],
        diffResults: [testDiffResult]
      };

      // Import the session data
      await ImportOps.importFullSessionData(sessionData);

      // Verify the diffResult was actually imported with ALL fields preserved
      const allDiffResults = await DiffOps.getAll();
      const imported = allDiffResults.find(r => r.chapterId === 'stable-import-fidelity');

      expect(imported).toBeDefined();

      // Verify ALL top-level fields
      expect(imported).toMatchObject({
        chapterId: 'stable-import-fidelity',
        aiVersionId: '9876543210',
        fanVersionId: null, // null should survive round-trip
        rawVersionId: 'xyz98765',
        algoVersion: '2.0.0',
        costUsd: 0.00234,
        model: 'gpt-4o-mini'
      });

      // Verify hash fields survive
      expect(imported?.aiHash).toBe('abc12345');
      expect(imported?.fanHash).toBeNull();
      expect(imported?.rawHash).toBe('def67890');

      // Verify timestamp (allow small variance for serialization)
      expect(imported?.analyzedAt).toBe(fixedTimestamp);

      // Verify markers array structure preserved completely
      expect(imported?.markers).toHaveLength(2);

      // First marker: multiple colors/reasons
      const marker0 = imported?.markers[0] as DiffMarker;
      expect(marker0.chunkId).toBe('para-0-xyz');
      expect(marker0.colors).toEqual(['orange', 'grey']);
      expect(marker0.reasons).toEqual(['raw-divergence', 'stylistic-choice']);
      expect(marker0.aiRange).toEqual({ start: 0, end: 20 });
      expect(marker0.position).toBe(0);

      // Second marker: with optional fields (explanations, confidence)
      const marker1 = imported?.markers[1] as DiffMarker;
      expect(marker1.chunkId).toBe('para-1-abc');
      expect(marker1.colors).toEqual(['red']);
      expect(marker1.reasons).toEqual(['missing-context']);
      expect(marker1.position).toBe(1);
      expect(marker1.explanations).toEqual(['Context was omitted from source']);
      expect(marker1.confidence).toBe(0.85);
    });

    it('should handle export when no diffResults exist', async () => {
      vi.spyOn(DiffOps, 'getAll').mockResolvedValue([]);

      const exported = await SessionExportOps.exportFullSession();

      expect(exported.diffResults).toBeDefined();
      expect(exported.diffResults).toHaveLength(0);
    });

    it('should handle import when diffResults are not present in payload', async () => {
      const sessionData = {
        metadata: { format: 'lexiconforge-full-1', exportedAt: new Date().toISOString() },
        settings: null,
        navigation: { history: [], lastActive: null },
        urlMappings: [],
        novels: [],
        chapters: [],
        promptTemplates: []
        // No diffResults field
      };

      // Import should not throw even without diffResults
      await expect(ImportOps.importFullSessionData(sessionData)).resolves.not.toThrow();
    });
  });

  describe('amendmentLogs export/import', () => {
    it('[Integration] should export amendment logs with full field fidelity', async () => {
      // Integration test: Store real data, verify export captures everything
      const fixedTimestamp = 1703520000000;

      const testLog = {
        id: 'log-export-fidelity',
        timestamp: fixedTimestamp,
        chapterId: 'stable-amendment-export',
        proposal: {
          observation: 'The AI translation uses "color" instead of "colour"',
          currentRule: 'Use British English spelling throughout',
          proposedChange: 'Add explicit rule: Prefer British spelling (colour, favour, honour)',
          reasoning: 'Consistency with target audience preferences'
        },
        action: 'accepted' as const,
        finalPromptChange: 'Use British English spelling including: colour, favour, honour, etc.',
        notes: 'Approved after user discussion'
      };

      // Save to actual DB (no mocks)
      await AmendmentOps.storeRecord(testLog);

      // Export should capture the log with full fidelity
      const exported = await SessionExportOps.exportFullSession();
      const found = exported.amendmentLogs.find((l: any) => l.id === 'log-export-fidelity');

      expect(found).toBeDefined();

      // Verify ALL fields are preserved
      expect(found).toMatchObject({
        id: 'log-export-fidelity',
        timestamp: fixedTimestamp,
        chapterId: 'stable-amendment-export',
        action: 'accepted',
        finalPromptChange: 'Use British English spelling including: colour, favour, honour, etc.',
        notes: 'Approved after user discussion'
      });

      // Verify nested proposal object
      expect(found?.proposal).toMatchObject({
        observation: 'The AI translation uses "color" instead of "colour"',
        currentRule: 'Use British English spelling throughout',
        proposedChange: 'Add explicit rule: Prefer British spelling (colour, favour, honour)',
        reasoning: 'Consistency with target audience preferences'
      });
    });

    it('[Integration] should round-trip amendment logs with full fidelity', async () => {
      // Integration test: Import → verify in DB → export → verify matches original
      const fixedTimestamp = 1703520000000;

      const testLogs = [
        {
          id: 'log-roundtrip-1',
          timestamp: fixedTimestamp,
          chapterId: 'stable-roundtrip',
          proposal: {
            observation: 'AI added explanatory text not in source',
            currentRule: 'Translate faithfully without additions',
            proposedChange: 'Allow brief clarifications in [brackets]',
            reasoning: 'Some cultural context needs explanation'
          },
          action: 'modified' as const,
          finalPromptChange: 'Allow [bracketed clarifications] for cultural context only',
          notes: 'Compromised with user'
        },
        {
          id: 'log-roundtrip-2',
          timestamp: fixedTimestamp + 1000,
          chapterId: 'stable-roundtrip',
          proposal: {
            observation: 'Names are inconsistently romanized',
            currentRule: 'Use consistent romanization',
            proposedChange: 'Prefer revised romanization for Korean names',
            reasoning: 'More accurate phonetically'
          },
          action: 'rejected' as const,
          finalPromptChange: null,
          notes: 'User prefers McCune-Reischauer'
        }
      ];

      // Import the logs
      await ImportOps.importFullSessionData({
        metadata: { format: 'lexiconforge-full-1' },
        amendmentLogs: testLogs
      });

      // Verify logs were written to DB with all fields
      const retrievedLogs = await AmendmentOps.getLogs();

      const log1 = retrievedLogs.find(l => l.id === 'log-roundtrip-1');
      expect(log1).toBeDefined();
      expect(log1).toMatchObject({
        id: 'log-roundtrip-1',
        chapterId: 'stable-roundtrip',
        action: 'modified',
        finalPromptChange: 'Allow [bracketed clarifications] for cultural context only',
        notes: 'Compromised with user'
      });
      expect(log1?.proposal.observation).toBe('AI added explanatory text not in source');
      expect(log1?.proposal.reasoning).toBe('Some cultural context needs explanation');

      const log2 = retrievedLogs.find(l => l.id === 'log-roundtrip-2');
      expect(log2).toBeDefined();
      expect(log2?.action).toBe('rejected');
      expect(log2?.finalPromptChange).toBeNull();
      expect(log2?.notes).toBe('User prefers McCune-Reischauer');

      // Now export and verify round-trip fidelity
      const exported = await SessionExportOps.exportFullSession();
      const exportedLog1 = exported.amendmentLogs.find((l: any) => l.id === 'log-roundtrip-1');
      const exportedLog2 = exported.amendmentLogs.find((l: any) => l.id === 'log-roundtrip-2');

      expect(exportedLog1).toMatchObject(testLogs[0]);
      expect(exportedLog2).toMatchObject(testLogs[1]);
    });
  });

  describe('exportSessionData()', () => {
    it('serialises chapters in export JSON', async () => {
      const chapterId = 'stable-1';
      const url = 'https://example.com/chapters/1';
      const chapter = sampleChapter(chapterId, url);
      useAppStore.setState({
        chapters: new Map([[chapterId, chapter]]),
      });

      const json = await useAppStore.getState().exportSessionData();
      const snapshot = JSON.parse(json);

      expect(snapshot.chapters).toHaveLength(1);
      expect(snapshot.chapters[0].canonicalUrl).toBe(url);
      expect(snapshot.chapters[0].title).toBe(chapter.title);
      expect(snapshot.chapters[0].translations?.[0]?.translatedTitle).toBe('Translated stable-1');
    });

    it('returns empty chapter list when no chapters are loaded', async () => {
      const json = await useAppStore.getState().exportSessionData();
      const snapshot = JSON.parse(json);
      expect(Array.isArray(snapshot.chapters)).toBe(true);
      expect(snapshot.chapters).toHaveLength(0);
    });
  });

  describe('importSessionData()', () => {
    it('[Integration] imports full session and hydrates store correctly', async () => {
      // True integration test: NO mocks on ImportOps or DB operations
      // Tests entire import pipeline from payload → DB → store hydration
      const chapterId = 'stable-import-integration';
      const url = 'https://example.com/test/chapter/integration';

      const importPayload = {
        metadata: { format: 'lexiconforge-full-1', exportedAt: new Date().toISOString() },
        settings: { fontSize: 18, fontStyle: 'serif' },
        navigation: {
          history: [chapterId],
          lastActive: { id: chapterId, url }
        },
        urlMappings: [
          { url, stableId: chapterId, isCanonical: true, dateAdded: new Date().toISOString() }
        ],
        novels: [],
        chapters: [{
          stableId: chapterId,
          canonicalUrl: url,
          title: 'Integration Test Chapter',
          content: '<p>Original Korean content 한글</p>',
          nextUrl: 'https://example.com/test/chapter/2',
          prevUrl: null,
          translations: [{
            id: 'trans-integration-1',
            version: 1,
            translatedTitle: 'Translated Integration Chapter',
            translation: '<p>Translated English content</p>',
            footnotes: [{ id: 'fn-1', marker: '[1]', content: 'A test footnote' }],
            suggestedIllustrations: [{ marker: '{{IMG:test}}', description: 'Test illustration' }],
            provider: 'OpenAI',
            model: 'gpt-4o',
            temperature: 0.3,
            isActive: true,
            usageMetrics: {
              totalTokens: 1500,
              promptTokens: 1000,
              completionTokens: 500,
              estimatedCost: 0.002,
              requestTime: 2.5
            }
          }],
          feedback: [{
            id: 'fb-integration-1',
            type: 'correction',
            selection: 'Translated',
            comment: 'Could be more natural'
          }]
        }],
        promptTemplates: [{
          id: 'template-integration-1',
          name: 'Integration Test Template',
          description: 'A template for testing',
          content: 'Translate: {{content}}',
          isDefault: false
        }],
        diffResults: [],
        amendmentLogs: []
      };

      // Perform actual import (NO MOCKS)
      await useAppStore.getState().importSessionData(importPayload);

      // Verify store state was hydrated
      const state = useAppStore.getState();
      expect(state.chapters.size).toBe(1);
      expect(state.currentChapterId).toBe(chapterId);
      expect(state.navigationHistory).toContain(chapterId);

      // Verify chapter data made it to store
      const chapter = state.chapters.get(chapterId);
      expect(chapter).toBeDefined();
      expect(chapter?.title).toBe('Integration Test Chapter');
      expect(chapter?.content).toContain('한글');

      // Verify translation result is present
      expect(chapter?.translationResult?.translatedTitle).toBe('Translated Integration Chapter');
      expect(chapter?.translationResult?.footnotes).toHaveLength(1);
      expect(chapter?.translationResult?.footnotes?.[0]?.content).toBe('A test footnote');

      // Verify URL index was built
      const normalized = normalizeUrlAggressively(url);
      expect(normalized).toBeDefined();
      expect(state.urlIndex.get(normalized!)).toBe(chapterId);

      // Verify data actually persisted to DB (not just in-memory)
      const dbChapter = await ChapterOps.getByStableId(chapterId);
      expect(dbChapter).toBeDefined();
      expect(dbChapter?.title).toBe('Integration Test Chapter');
      expect(dbChapter?.nextUrl).toBe('https://example.com/test/chapter/2');

      // Verify translations persisted to DB
      const translations = await TranslationOps.getVersionsByStableId(chapterId);
      expect(translations.length).toBeGreaterThanOrEqual(1);
      const activeTranslation = translations.find(t => t.isActive);
      expect(activeTranslation?.translatedTitle).toBe('Translated Integration Chapter');
      expect(activeTranslation?.provider).toBe('OpenAI');
      expect(activeTranslation?.model).toBe('gpt-4o');

      // Verify settings persisted
      const settings = await SettingsOps.getKey('app-settings');
      expect(settings?.fontSize).toBe(18);
      expect(settings?.fontStyle).toBe('serif');

      // Verify prompt template persisted
      const templates = await TemplatesOps.getAll();
      const importedTemplate = templates.find(t => t.id === 'template-integration-1');
      expect(importedTemplate).toBeDefined();
      expect(importedTemplate?.name).toBe('Integration Test Template');
    });

    it('raises errors for malformed payloads', async () => {
      await expect(useAppStore.getState().importSessionData('not-json')).rejects.toThrow();
      expect(useAppStore.getState().error).toContain('Failed to import session');
    });
  });
});

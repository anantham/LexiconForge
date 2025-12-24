import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useAppStore } from '../../store';
import type { EnhancedChapter } from '../../services/stableIdService';
import type { TranslationResult } from '../../types';
import type { DiffResult } from '../../services/diff/types';
import {
  AmendmentOps,
  DiffOps,
  ImportOps,
  SessionExportOps,
  SettingsOps,
} from '../../services/db/operations';
import * as RenderingOps from '../../services/db/operations/rendering';
import { normalizeUrlAggressively } from '../../services/stableIdService';

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
    it('[Unit] should include diffResults in exported session data (mocked)', async () => {
      // Unit test: Mock DiffOps.getAll() to test export logic in isolation
      const mockDiffResults = [
        {
          chapterId: 'stable-1',
          aiVersionId: '1234567890',
          fanVersionId: null,
          rawVersionId: 'abc12345',
          algoVersion: '1.0.0',
          markers: [{
            chunkId: 'para-0-abc',
            colors: ['grey'],
            reasons: ['stylistic-choice'],
            aiRange: { start: 0, end: 10 },
            position: 0
          }],
          analyzedAt: Date.now(),
          costUsd: 0.001,
          model: 'gpt-4o-mini'
        }
      ] satisfies DiffResult[];

      vi.spyOn(DiffOps, 'getAll').mockResolvedValue(mockDiffResults);

      const exported = await SessionExportOps.exportFullSession();

      expect(exported.diffResults).toBeDefined();
      expect(exported.diffResults).toHaveLength(1);
      expect(exported.diffResults[0].chapterId).toBe('stable-1');
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

    it('should restore diffResults from imported session data', async () => {
      const testDiffResult: DiffResult = {
        chapterId: 'stable-import',
        aiVersionId: '9876543210',
        fanVersionId: null,
        rawVersionId: 'xyz98765',
        algoVersion: '1.0.0',
        markers: [{
          chunkId: 'para-0-xyz',
          colors: ['orange'],
          reasons: ['raw-divergence'],
          aiRange: { start: 0, end: 20 },
          position: 0
        }],
        analyzedAt: Date.now(),
        costUsd: 0.002,
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

      // Verify the diffResult was actually imported by reading it back
      const allDiffResults = await DiffOps.getAll();
      const imported = allDiffResults.find(r => r.chapterId === 'stable-import');

      expect(imported).toBeDefined();
      expect(imported?.aiVersionId).toBe('9876543210');
      expect(imported?.model).toBe('gpt-4o-mini');
      expect(imported?.markers).toHaveLength(1);
      expect(imported?.markers[0].reasons).toContain('raw-divergence');
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
    it('should include amendment logs in exported session data', async () => {
      const logs = [
        {
          id: 'log-1',
          timestamp: Date.now(),
          chapterId: 'stable-123',
          proposal: {
            observation: 'Note',
            currentRule: 'Rule',
            proposedChange: 'Change',
            reasoning: 'Because',
          },
          action: 'accepted' as const,
          finalPromptChange: 'Updated prompt',
          notes: 'Imported',
        },
      ];
      vi.spyOn(AmendmentOps, 'getLogs').mockResolvedValue(logs);

      const exported = await SessionExportOps.exportFullSession();
      expect(exported.amendmentLogs).toEqual(logs);
    });

    it('imports amendment logs when present in payload', async () => {
      const logs = [
        {
          id: 'log-2',
          timestamp: Date.now(),
          chapterId: 'stable-456',
          proposal: {
            observation: 'Detail',
            currentRule: 'Old',
            proposedChange: 'New',
            reasoning: 'Better',
          },
          action: 'modified' as const,
          finalPromptChange: 'Changed prompt',
          notes: 'Imported',
        },
      ];

      await ImportOps.importFullSessionData({
        metadata: { format: 'lexiconforge-full-1' },
        amendmentLogs: logs,
      });

      // Verify amendment logs were written to DB (integration test)
      const retrievedLogs = await AmendmentOps.getLogs();
      const importedLog = retrievedLogs.find(l => l.id === 'log-2');

      expect(importedLog).toBeDefined();
      expect(importedLog?.chapterId).toBe('stable-456');
      expect(importedLog?.action).toBe('modified');
      expect(importedLog?.finalPromptChange).toBe('Changed prompt');
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
    it('imports the full session format via IndexedDB', async () => {
      const importPayload = {
        metadata: { format: 'lexiconforge-full-1' },
      };
      const rendering = [
        {
          stableId: 'stable-1',
          url: 'https://example.com/chapters/1',
          chapterNumber: 1,
          data: {
            chapter: {
              title: 'Imported title',
              content: 'Imported content',
              nextUrl: null,
              prevUrl: null,
            },
            translationResult: sampleChapter('stable-1', 'https://example.com/chapters/1').translationResult,
          },
        },
      ];

      const importSpy = vi.spyOn(ImportOps, 'importFullSessionData').mockResolvedValue();
      vi.spyOn(RenderingOps, 'fetchChaptersForReactRendering').mockResolvedValue(rendering as any);
      vi.spyOn(SettingsOps, 'getKey').mockImplementation(async (key: string) => {
        if (key === 'navigation-history') return { stableIds: ['stable-1'] };
        if (key === 'lastActiveChapter') return { id: 'stable-1', url: rendering[0].url };
        return null;
      });

      await useAppStore.getState().importSessionData(importPayload);

      // Verify import was called (relax assertion - extra undefined param is ok)
      expect(importSpy).toHaveBeenCalled();
      expect(importSpy.mock.calls[0][0]).toEqual(importPayload);

      // Verify the outcome - state was updated correctly
      const state = useAppStore.getState();
      expect(state.chapters.size).toBe(1);
      expect(state.currentChapterId).toBe('stable-1');
      expect(state.navigationHistory).toContain('stable-1');
      const normalized = normalizeUrlAggressively(rendering[0].url)!;
      expect(state.urlIndex.get(normalized)).toBe('stable-1');
    });

    it('raises errors for malformed payloads', async () => {
      await expect(useAppStore.getState().importSessionData('not-json')).rejects.toThrow();
      expect(useAppStore.getState().error).toContain('Failed to import session');
    });
  });
});

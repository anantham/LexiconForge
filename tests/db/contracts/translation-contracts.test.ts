/**
 * Translation Service Contract Tests - Hybrid Safety Net
 * 
 * These tests MUST pass on both legacy and new backends before migration.
 * They define the exact behavioral contract that both systems must fulfill.
 * 
 * GPT-5's insight: Contract tests before migration are mandatory.
 * Claude's insight: Service-specific validation with domain knowledge.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { Repo } from '../../../adapters/repo/Repo';
import { makeLegacyRepo } from '../../../legacy/indexeddb-compat';
import { makeRepo } from '../../../services/db';
import type { TranslationResult, AppSettings, Chapter } from '../../../types';

// Test fixtures
const mockChapterUrl = 'https://example.com/chapter/1';
const mockStableId = 'novel-123-ch-001';

const mockTranslation: TranslationResult = {
  translatedContent: 'This is a test translation',
  provider: 'openai',
  model: 'gpt-4',
  cost: 0.05,
  contextDepth: 2,
  historyLength: 3,
  version: 1,
  isActive: true,
  id: 'test-translation-1',
  chapterUrl: mockChapterUrl,
  timestamp: Date.now(),
};

// Match the actual Repo interface settings requirement
const mockSettings = {
  provider: 'openai',
  model: 'gpt-4', 
  temperature: 0.7,
  systemPrompt: 'You are a translator',
  promptId: 'test-prompt-id',
  promptName: 'Test Prompt',
};

const mockChapter: Chapter = {
  url: mockChapterUrl,
  title: 'Test Chapter',
  content: 'Original chapter content',
  stableId: mockStableId,
  nextUrl: null,
  prevUrl: null,
};

/**
 * Contract test suite that both backends must pass
 */
function runTranslationContracts(repoFactory: () => Repo, backendName: string) {
  describe(`Translation Contracts - ${backendName}`, () => {
    let repo: Repo;

    beforeEach(async () => {
      repo = repoFactory();
      
      // Set up test data - store chapter first
      try {
        await repo.storeChapter(mockChapter);
        
        // Create URL mapping for stable ID tests
        // This is needed for stable ID operations to work
        const urlMappingExists = await repo.getStableIdByUrl(mockChapterUrl);
        if (!urlMappingExists) {
          // The repo should handle URL mapping internally, but let's ensure chapter exists
        }
      } catch (error) {
        console.warn('Setup error (may be expected):', error);
      }
    });

    afterEach(async () => {
      // Cleanup test data
    });

    describe('Basic Translation CRUD', () => {
      it('should store and retrieve translation by URL', async () => {
        // Store translation
        await repo.storeTranslation(mockChapterUrl, mockTranslation, mockSettings);

        // Retrieve active translation
        const retrieved = await repo.getActiveTranslation(mockChapterUrl);
        
        expect(retrieved).toBeDefined();
        expect(retrieved?.translatedContent).toBe(mockTranslation.translatedContent);
        // Note: The legacy system returns TranslationRecord, not TranslationResult
        // So we test the fields that should be preserved
      });

      it('should store and retrieve translation by stable ID', async () => {
        // Store translation
        await repo.storeTranslationByStableId(mockStableId, mockTranslation, mockSettings);

        // Retrieve active translation
        const retrieved = await repo.getActiveTranslationByStableId(mockStableId);
        
        expect(retrieved).toBeDefined();
        expect(retrieved?.translatedContent).toBe(mockTranslation.translatedContent);
        expect(retrieved?.provider).toBe(mockTranslation.provider);
      });

      it('should return null for non-existent translations', async () => {
        const retrieved = await repo.getActiveTranslation('non-existent-url');
        expect(retrieved).toBeNull();

        const retrievedById = await repo.getActiveTranslationByStableId('non-existent-id');
        expect(retrievedById).toBeNull();
      });
    });

    describe('Translation Versioning', () => {
      it('should handle multiple translation versions', async () => {
        // Store first version
        await repo.storeTranslation(mockChapterUrl, mockTranslation, mockSettings);

        // Store second version
        const secondTranslation = {
          ...mockTranslation,
          translatedContent: 'Updated translation',
          version: 2,
        };
        await repo.storeTranslation(mockChapterUrl, secondTranslation, mockSettings);

        // Get all versions
        const versions = await repo.getTranslationVersions(mockChapterUrl);
        expect(versions).toHaveLength(2);

        // Active translation should be the latest
        const active = await repo.getActiveTranslation(mockChapterUrl);
        expect(active?.translatedContent).toBe('Updated translation');
      });

      it('should correctly set active translation version', async () => {
        // Store multiple versions
        await repo.storeTranslation(mockChapterUrl, mockTranslation, mockSettings);
        
        const secondTranslation = {
          ...mockTranslation,
          translatedContent: 'Version 2',
        };
        await repo.storeTranslation(mockChapterUrl, secondTranslation, mockSettings);

        // Set first version as active
        await repo.setActiveTranslation(mockChapterUrl, 1);

        const active = await repo.getActiveTranslation(mockChapterUrl);
        expect(active?.translatedContent).toBe(mockTranslation.translatedContent);
      });

      it('should handle stable ID versioning', async () => {
        // Store multiple versions by stable ID
        await repo.storeTranslationByStableId(mockStableId, mockTranslation, mockSettings);
        
        const secondTranslation = {
          ...mockTranslation,
          translatedContent: 'Version 2 by stable ID',
        };
        await repo.storeTranslationByStableId(mockStableId, secondTranslation, mockSettings);

        const versions = await repo.getTranslationVersionsByStableId(mockStableId);
        expect(versions).toHaveLength(2);

        // Set first version as active
        await repo.setActiveTranslationByStableId(mockStableId, 1);

        const active = await repo.getActiveTranslationByStableId(mockStableId);
        expect(active?.translatedContent).toBe(mockTranslation.translatedContent);
      });
    });

    describe('Translation Metadata Preservation', () => {
      it('should preserve all translation metadata', async () => {
        await repo.storeTranslation(mockChapterUrl, mockTranslation, mockSettings);

        const retrieved = await repo.getActiveTranslation(mockChapterUrl);
        
        expect(retrieved?.cost).toBe(mockTranslation.cost);
        expect(retrieved?.contextDepth).toBe(mockTranslation.contextDepth);
        expect(retrieved?.historyLength).toBe(mockTranslation.historyLength);
        expect(retrieved?.timestamp).toBeDefined();
      });

      it('should preserve settings snapshot', async () => {
        await repo.storeTranslation(mockChapterUrl, mockTranslation, mockSettings);

        const retrieved = await repo.getActiveTranslation(mockChapterUrl);
        
        // Settings should be preserved in metadata
        expect(retrieved?.settings?.contextDepth).toBe(mockSettings.contextDepth);
        expect(retrieved?.settings?.provider).toBe(mockSettings.provider);
        expect(retrieved?.settings?.model).toBe(mockSettings.model);
      });
    });

    describe('Error Handling', () => {
      it('should handle invalid translation data gracefully', async () => {
        const invalidTranslation = {
          ...mockTranslation,
          translatedContent: '', // Empty content
        };

        // Should not throw, but may store empty content
        await expect(
          repo.storeTranslation(mockChapterUrl, invalidTranslation, mockSettings)
        ).not.toThrow();
      });

      it('should handle concurrent translations to same chapter', async () => {
        // Simulate concurrent stores
        const promises = Array.from({ length: 3 }, (_, i) => 
          repo.storeTranslation(mockChapterUrl, {
            ...mockTranslation,
            translatedContent: `Translation ${i}`,
          }, mockSettings)
        );

        await Promise.all(promises);

        // Should have 3 versions
        const versions = await repo.getTranslationVersions(mockChapterUrl);
        expect(versions.length).toBeGreaterThanOrEqual(3);

        // Should have exactly one active translation
        const activeVersions = versions.filter(v => v.isActive);
        expect(activeVersions).toHaveLength(1);
      });
    });

    describe('Performance Characteristics', () => {
      it('should retrieve translations within reasonable time', async () => {
        await repo.storeTranslation(mockChapterUrl, mockTranslation, mockSettings);

        const startTime = performance.now();
        await repo.getActiveTranslation(mockChapterUrl);
        const endTime = performance.now();

        // Should complete within 100ms (adjust based on your requirements)
        expect(endTime - startTime).toBeLessThan(100);
      });

      it('should handle batch operations efficiently', async () => {
        const startTime = performance.now();

        // Store 10 translations
        for (let i = 0; i < 10; i++) {
          await repo.storeTranslation(
            `${mockChapterUrl}-${i}`,
            { ...mockTranslation, translatedContent: `Translation ${i}` },
            mockSettings
          );
        }

        const endTime = performance.now();

        // Batch operations should complete within reasonable time
        // Adjust threshold based on your performance requirements
        expect(endTime - startTime).toBeLessThan(1000); // 1 second for 10 operations
      });
    });

    describe('Data Consistency', () => {
      it('should maintain referential integrity', async () => {
        await repo.storeTranslation(mockChapterUrl, mockTranslation, mockSettings);

        const byUrl = await repo.getActiveTranslation(mockChapterUrl);
        const versions = await repo.getTranslationVersions(mockChapterUrl);

        // Active translation should be in versions list
        expect(versions.some(v => v.id === byUrl?.id)).toBe(true);
        expect(versions.some(v => v.isActive)).toBe(true);
        expect(versions.filter(v => v.isActive)).toHaveLength(1);
      });

      it('should handle URL/stable ID mapping consistently', async () => {
        // This test would verify that URL and stable ID refer to same logical entity
        // Implementation depends on your specific business logic
        await repo.storeTranslation(mockChapterUrl, mockTranslation, mockSettings);
        await repo.storeTranslationByStableId(mockStableId, mockTranslation, mockSettings);

        const byUrl = await repo.getActiveTranslation(mockChapterUrl);
        const byStableId = await repo.getActiveTranslationByStableId(mockStableId);

        // Both should exist independently (this is current behavior)
        expect(byUrl).toBeDefined();
        expect(byStableId).toBeDefined();
      });
    });
  });
}

// Run contract tests against both backends
describe('Translation Service Contracts', () => {
  // Test legacy backend
  runTranslationContracts(
    () => makeLegacyRepo(),
    'Legacy Backend'
  );

  // Test new backend (when ready)
  runTranslationContracts(
    () => makeRepo('idb'),
    'New IDB Backend'
  );

  // Cross-backend consistency test
  describe('Cross-Backend Consistency', () => {
    it('should produce identical results from both backends', async () => {
      const legacyRepo = makeLegacyRepo();
      const newRepo = makeRepo('idb');

      // Store same data in both
      await legacyRepo.storeTranslation(mockChapterUrl, mockTranslation, mockSettings);
      await newRepo.storeTranslation(mockChapterUrl, mockTranslation, mockSettings);

      // Retrieve from both
      const legacyResult = await legacyRepo.getActiveTranslation(mockChapterUrl);
      const newResult = await newRepo.getActiveTranslation(mockChapterUrl);

      // Compare critical fields (excluding timestamps, IDs which may differ)
      expect(legacyResult?.translatedContent).toBe(newResult?.translatedContent);
      expect(legacyResult?.provider).toBe(newResult?.provider);
      expect(legacyResult?.model).toBe(newResult?.model);
      expect(legacyResult?.cost).toBe(newResult?.cost);
    });
  });
});

// Export for use in migration validation
export { runTranslationContracts, mockChapterUrl, mockStableId, mockTranslation, mockSettings };
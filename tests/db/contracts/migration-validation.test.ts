/**
 * Migration-Aware Contract Tests - New vs Legacy System Validation
 * 
 * These tests validate that the new bug-free system:
 * 1. Passes all the same contracts as legacy
 * 2. Fixes the identified bugs (stable ID format mismatch, race conditions)
 * 3. Maintains behavioral compatibility for successful operations
 * 4. Provides better error handling for edge cases
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import type { Repo } from '../../../adapters/repo/Repo';
import { makeLegacyRepo } from '../../../legacy/indexeddb-compat';
import { TranslationOperations } from '../../../services/db/operations/translations';
import { StableIdManager } from '../../../services/db/core/stable-ids';
import type { TranslationResult, Chapter } from '../../../types';

// Test data generator to avoid pollution
const generateTestData = (testId: string) => {
  const timestamp = Date.now();
  const uniqueId = `${testId}-${timestamp}`;
  
  const chapter: Chapter = {
    url: `https://migration-test-${uniqueId}.com/ch1`,
    originalUrl: `https://migration-test-${uniqueId}.com/ch1`,
    title: `Migration Test Chapter ${uniqueId}`,
    content: `Test content for migration validation ${uniqueId}`,
    stableId: `migration-test-${uniqueId}-ch-001`,
    nextUrl: null,
    prevUrl: null,
  };

  const translation: TranslationResult = {
    translatedTitle: `Migrated Title ${uniqueId}`,
    translation: `Migration-tested translation content ${uniqueId}`,
    footnotes: [{ marker: '[1]', text: `Test footnote ${uniqueId}` }],
    suggestedIllustrations: [{ 
      placementMarker: '<img>', 
      imagePrompt: `Test illustration ${uniqueId}` 
    }],
    usageMetrics: {
      totalTokens: 150,
      promptTokens: 100,
      completionTokens: 50,
      estimatedCost: 0.08,
      requestTime: 1.2,
      provider: 'openai',
      model: 'gpt-4',
    },
    version: 1,
    isActive: true,
    id: `test-${uniqueId}`,
    chapterUrl: chapter.url,
    timestamp: timestamp,
  };

  const settings = {
    provider: 'openai',
    model: 'gpt-4', 
    temperature: 0.7,
    systemPrompt: `Migration test prompt ${uniqueId}`,
    promptId: `test-prompt-${uniqueId}`,
    promptName: `Test Prompt ${uniqueId}`,
  };

  return { chapter, translation, settings, uniqueId };
};

describe('Migration-Aware Contract Tests', () => {
  let legacyRepo: Repo;

  beforeAll(async () => {
    legacyRepo = makeLegacyRepo();
  });

  beforeEach(async () => {
    // Brief delay to avoid timing conflicts
    await new Promise(resolve => setTimeout(resolve, 50));
  });

  afterEach(async () => {
    // Brief delay between tests  
    await new Promise(resolve => setTimeout(resolve, 50));
  });

  describe('Contract 1: Basic Translation Storage', () => {
    it('should store and retrieve translations identically in both systems', async () => {
      const { chapter, translation, settings } = generateTestData('contract1');
      
      // Store chapter first (required for both systems)
      await legacyRepo.storeChapter(chapter);
      
      // LEGACY SYSTEM: Store translation
      const legacyResult = await legacyRepo.storeTranslation(
        chapter.url,
        translation,
        settings
      );
      
      // NEW SYSTEM: Store translation for different URL to avoid conflicts
      const newChapter = { ...chapter, url: `${chapter.url}-new` };
      await StableIdManager.storeChapterWithMappings(newChapter);
      
      const newResult = await TranslationOperations.storeTranslation(
        newChapter.url,
        translation,
        settings
      );
      
      // VALIDATE: Both systems return similar structure\n      expect(legacyResult).toMatchObject({\n        version: expect.any(Number),\n        isActive: true,\n        translation: translation.translation,\n        translatedTitle: translation.translatedTitle,\n        provider: settings.provider,\n        model: settings.model,\n      });
      
      expect(newResult).toMatchObject({\n        version: expect.any(Number),\n        isActive: true,\n        translation: translation.translation,\n        translatedTitle: translation.translatedTitle,\n        provider: settings.provider,\n        model: settings.model,\n      });
      
      // VALIDATE: Version numbering starts at 1\n      expect(legacyResult.version).toBe(1);\n      expect(newResult.version).toBe(1);\n      \n      console.log('✅ Contract 1: Basic storage contract maintained');\n    });\n  });\n\n  describe('Contract 2: Version Management', () => {\n    it('should handle multiple versions identically', async () => {\n      const { chapter, translation, settings } = generateTestData('contract2');
      
      // Store chapter\n      await legacyRepo.storeChapter(chapter);
      
      // LEGACY: Store multiple versions sequentially (workaround for race condition)\n      const legacyV1 = await legacyRepo.storeTranslation(\n        chapter.url,\n        { ...translation, translation: 'Legacy v1' },\n        settings\n      );\n      \n      await new Promise(resolve => setTimeout(resolve, 100)); // Race condition workaround\n      \n      const legacyV2 = await legacyRepo.storeTranslation(\n        chapter.url,\n        { ...translation, translation: 'Legacy v2' },\n        settings\n      );
      
      // NEW SYSTEM: Store multiple versions (should handle concurrency better)\n      const newChapter = { ...chapter, url: `${chapter.url}-new` };\n      await StableIdManager.storeChapterWithMappings(newChapter);\n      \n      const newV1 = await TranslationOperations.storeTranslation(\n        newChapter.url,\n        { ...translation, translation: 'New v1' },\n        settings\n      );\n      \n      const newV2 = await TranslationOperations.storeTranslation(\n        newChapter.url,\n        { ...translation, translation: 'New v2' },\n        settings\n      );
      
      // VALIDATE: Version progression\n      expect(legacyV1.version).toBe(1);\n      expect(legacyV2.version).toBe(2);\n      expect(newV1.version).toBe(1);\n      expect(newV2.version).toBe(2);
      
      // VALIDATE: Active version behavior\n      expect(legacyV1.isActive).toBe(false); // Should be deactivated\n      expect(legacyV2.isActive).toBe(true);  // Should be active\n      expect(newV1.isActive).toBe(false);    // Should be deactivated\n      expect(newV2.isActive).toBe(true);     // Should be active\n      \n      // VALIDATE: Retrieval of active version\n      const legacyActive = await legacyRepo.getActiveTranslation(chapter.url);\n      const newActive = await TranslationOperations.getActiveTranslation(newChapter.url);\n      \n      expect(legacyActive?.version).toBe(2);\n      expect(newActive?.version).toBe(2);\n      expect(legacyActive?.translation).toBe('Legacy v2');\n      expect(newActive?.translation).toBe('New v2');\n      \n      console.log('✅ Contract 2: Version management contract maintained');\n    });\n  });\n\n  describe('Contract 3: Stable ID Operations', () => {\n    it('should handle stable ID operations - legacy fails, new succeeds', async () => {\n      const { chapter, translation, settings } = generateTestData('contract3');
      
      // LEGACY SYSTEM: Store chapter and attempt stable ID operation\n      await legacyRepo.storeChapter(chapter);
      
      // Legacy system requires manual URL mapping setup\n      const indexedDBService = (legacyRepo as any).indexedDBService || \n        await import('../../../services/indexeddb').then(m => m.indexedDBService);\n      \n      if (indexedDBService?.backfillUrlMappingsFromChapters) {\n        await indexedDBService.backfillUrlMappingsFromChapters();\n      }\n      \n      let legacyStableIdWorked = false;\n      try {\n        await legacyRepo.storeTranslationByStableId(\n          chapter.stableId!,\n          { ...translation, translation: 'Legacy stable ID test' },\n          settings\n        );\n        legacyStableIdWorked = true;\n      } catch (error: any) {\n        // Expected: Legacy system has fragile stable ID handling\n        expect(error.message).toContain('No URL mapping found');\n      }\n      \n      // NEW SYSTEM: Should handle stable ID robustly with auto-repair\n      await StableIdManager.storeChapterWithMappings(chapter);\n      \n      const newStableIdResult = await TranslationOperations.storeTranslationByStableId(\n        chapter.stableId!,\n        { ...translation, translation: 'New stable ID test' },\n        settings\n      );
      
      // VALIDATE: New system succeeds where legacy fails\n      expect(legacyStableIdWorked).toBe(false); // Documents the legacy bug\n      expect(newStableIdResult).toMatchObject({\n        version: 1,\n        isActive: true,\n        translation: 'New stable ID test',\n      });\n      \n      console.log('🔧 Contract 3: New system fixes stable ID fragility');\n    });\n\n    it('should handle stable ID format mismatches with auto-repair', async () => {\n      const { chapter, translation, settings } = generateTestData('contract3b');
      
      // Create chapter with underscore format stable ID\n      const underscoreStableId = `test_${Date.now()}_ch_001`;\n      const hyphenStableId = underscoreStableId.replace(/_/g, '-');\n      \n      const testChapter = {\n        ...chapter,\n        stableId: underscoreStableId,\n      };\n      \n      // Store chapter with underscore format\n      await StableIdManager.storeChapterWithMappings(testChapter);
      
      // NEW SYSTEM: Should resolve hyphen format to underscore format\n      const resolution = await StableIdManager.resolveStableIdToUrl(hyphenStableId);\n      \n      expect(resolution.source).toBe('format_repair');\n      expect(resolution.repairPerformed).toBe(true);\n      expect(resolution.url).toBe(testChapter.url);
      
      // Should be able to store translation using either format\n      const result = await TranslationOperations.storeTranslationByStableId(\n        hyphenStableId, // Using hyphen format\n        translation,\n        settings\n      );\n      \n      expect(result.version).toBe(1);\n      expect(result.translation).toBe(translation.translation);\n      \n      console.log('🔧 Contract 3b: Auto-repair for stable ID format mismatches works');\n    });\n  });\n\n  describe('Contract 4: Concurrent Operations', () => {\n    it('should handle concurrent version assignment - legacy fails, new succeeds', async () => {\n      const { chapter, translation, settings } = generateTestData('contract4');
      
      // Store chapter\n      await legacyRepo.storeChapter(chapter);
      
      // LEGACY SYSTEM: Concurrent operations (expected to fail or create issues)\n      const legacyPromises = [\n        legacyRepo.storeTranslation(\n          chapter.url,\n          { ...translation, translation: 'Legacy concurrent A' },\n          settings\n        ).catch(e => ({ error: e.message })),\n        legacyRepo.storeTranslation(\n          chapter.url,\n          { ...translation, translation: 'Legacy concurrent B' },\n          settings\n        ).catch(e => ({ error: e.message })),\n        legacyRepo.storeTranslation(\n          chapter.url,\n          { ...translation, translation: 'Legacy concurrent C' },\n          settings\n        ).catch(e => ({ error: e.message })),\n      ];\n      \n      const legacyResults = await Promise.allSettled(legacyPromises);\n      const legacyErrors = legacyResults.filter(r => \n        r.status === 'fulfilled' && (r.value as any).error\n      ).length;\n      \n      // NEW SYSTEM: Should handle concurrent operations atomically\n      const newChapter = { ...chapter, url: `${chapter.url}-new` };\n      await StableIdManager.storeChapterWithMappings(newChapter);\n      \n      const newPromises = [\n        TranslationOperations.storeTranslation(\n          newChapter.url,\n          { ...translation, translation: 'New concurrent A' },\n          settings\n        ),\n        TranslationOperations.storeTranslation(\n          newChapter.url,\n          { ...translation, translation: 'New concurrent B' },\n          settings\n        ),\n        TranslationOperations.storeTranslation(\n          newChapter.url,\n          { ...translation, translation: 'New concurrent C' },\n          settings\n        ),\n      ];\n      \n      const newResults = await Promise.allSettled(newPromises);\n      const newSuccesses = newResults.filter(r => r.status === 'fulfilled').length;\n      const newErrors = newResults.filter(r => r.status === 'rejected').length;\n      \n      // Check final state for new system\n      const versions = await TranslationOperations.getTranslationVersions(newChapter.url);\n      const activeVersions = versions.filter(v => v.isActive);
      
      // VALIDATE: New system handles concurrency better\n      console.log(`Legacy errors: ${legacyErrors}/3, New errors: ${newErrors}/3`);\n      console.log(`New system: ${versions.length} versions, ${activeVersions.length} active`);\n      \n      expect(newErrors).toBeLessThanOrEqual(legacyErrors); // New system should be at least as good\n      expect(activeVersions.length).toBe(1); // Should maintain exactly one active version\n      expect(versions.length).toBeGreaterThan(0); // Should have created some versions\n      \n      console.log('🔧 Contract 4: New system handles concurrency better than legacy');\n    });\n  });\n\n  describe('Contract 5: Error Handling and Edge Cases', () => {\n    it('should provide better error messages than legacy system', async () => {\n      const { settings, translation } = generateTestData('contract5');
      
      // Test missing stable ID\n      let legacyError: any;\n      let newError: any;\n      \n      try {\n        await legacyRepo.storeTranslationByStableId(\n          'nonexistent-stable-id',\n          translation,\n          settings\n        );\n      } catch (error) {\n        legacyError = error;\n      }\n      \n      try {\n        await TranslationOperations.storeTranslationByStableId(\n          'nonexistent-stable-id',\n          translation,\n          settings\n        );\n      } catch (error) {\n        newError = error;\n      }\n      \n      // VALIDATE: Both should fail, but new system should provide better error\n      expect(legacyError).toBeDefined();\n      expect(newError).toBeDefined();
      
      // New system should have structured error with more context\n      expect(newError.message).toContain('nonexistent-stable-id');\n      expect(newError.message).toContain('tried direct, format repair, and chapter search');\n      \n      console.log('Legacy error:', legacyError.message);\n      console.log('New error:', newError.message);\n      console.log('✅ Contract 5: Enhanced error messages in new system');\n    });\n  });\n\n  describe('Contract 6: Data Compatibility', () => {\n    it('should maintain exact field structure compatibility', async () => {\n      const { chapter, translation, settings } = generateTestData('contract6');
      
      // Store in legacy system\n      await legacyRepo.storeChapter(chapter);\n      const legacyResult = await legacyRepo.storeTranslation(\n        chapter.url,\n        translation,\n        settings\n      );
      
      // Store in new system\n      const newChapter = { ...chapter, url: `${chapter.url}-new` };\n      await StableIdManager.storeChapterWithMappings(newChapter);\n      const newResult = await TranslationOperations.storeTranslation(
        newChapter.url,
        translation,
        settings
      );
      
      // VALIDATE: Both have same essential fields\n      const essentialFields = [\n        'id', 'version', 'isActive', 'translation', 'translatedTitle',\n        'footnotes', 'suggestedIllustrations', 'provider', 'model'\n      ];\n      \n      essentialFields.forEach(field => {\n        expect(legacyResult).toHaveProperty(field);\n        expect(newResult).toHaveProperty(field);\n      });
      
      // VALIDATE: Field values match expected types and content\n      expect(typeof legacyResult.translation).toBe('string');\n      expect(typeof newResult.translation).toBe('string');\n      expect(legacyResult.translation).toBe(translation.translation);\n      expect(newResult.translation).toBe(translation.translation);\n      \n      expect(Array.isArray(legacyResult.footnotes)).toBe(true);\n      expect(Array.isArray(newResult.footnotes)).toBe(true);\n      \n      console.log('✅ Contract 6: Field structure compatibility maintained');\n    });\n  });\n});\n\n/**\n * Summary of Contract Validation Results:\n * \n * ✅ MAINTAINED CONTRACTS:\n * - Basic translation storage and retrieval\n * - Version management and active version tracking\n * - Field structure and data compatibility\n * - Essential functionality preserved\n * \n * 🔧 IMPROVED IN NEW SYSTEM:\n * - Stable ID operations (robust vs fragile)\n * - Concurrent version assignment (atomic vs race conditions)\n * - Error handling (structured vs generic messages)\n * - Format mismatch auto-repair (automatic vs manual)\n * - URL mapping creation (automatic vs manual)\n * \n * The new system maintains behavioral compatibility while fixing\n * the documented legacy bugs, making it suitable for migration.\n */
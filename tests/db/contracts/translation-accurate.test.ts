/**
 * Accurate Translation Contract Tests - Fixed Based on Deep Investigation
 * 
 * Tests reflect ACTUAL legacy system behavior after investigating:
 * 1. TranslationRecord vs TranslationResult field mappings
 * 2. Stable ID requires URL mapping setup first
 * 3. Version assignment race conditions in concurrent operations
 * 4. Exact settings schema requirements
 */

import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import type { Repo } from '../../../adapters/repo/Repo';
import { makeLegacyRepo } from '../../../legacy/indexeddb-compat';
import { makeRepo } from '../../../services/db';
import type { TranslationResult, Chapter } from '../../../types';

// ACCURATE test fixtures based on investigation
const testChapter: Chapter = {
  url: 'https://accurate-test.com/novel/ch1',
  originalUrl: 'https://accurate-test.com/novel/ch1', // Legacy system expects this
  title: 'Accurate Test Chapter',
  content: 'Test chapter content for accurate testing.',
  stableId: 'accurate-test-ch-001',
  nextUrl: null,
  prevUrl: null,
};

// TranslationResult that maps correctly to TranslationRecord
const accurateTranslation: TranslationResult = {
  translatedTitle: 'Accurate Translated Chapter Title', // Maps to translatedTitle
  translation: 'This is accurate translated content.',   // Maps to translation (NOT translatedContent!)
  footnotes: [
    { marker: '[1]', text: 'Test footnote' }
  ],
  suggestedIllustrations: [
    { placementMarker: '<img1>', imagePrompt: 'Test illustration' }
  ],
  
  // Usage metrics (may be optional in TranslationResult but required in TranslationRecord)
  usageMetrics: {
    totalTokens: 100,
    promptTokens: 80,
    completionTokens: 20,
    estimatedCost: 0.05,
    requestTime: 1.5,
    provider: 'openai',
    model: 'gpt-4',
  },
  
  // Fields for compatibility
  version: 1, // Will be overridden by version assignment logic
  isActive: true,
  id: 'will-be-generated',
  chapterUrl: testChapter.url,
  timestamp: Date.now(),
};

// EXACT settings schema the legacy system expects
const accurateSettings = {
  provider: 'openai',
  model: 'gpt-4',
  temperature: 0.7,
  systemPrompt: 'You are an accurate translation system test.',
  promptId: 'accurate-test-prompt-id',
  promptName: 'Accurate Test Prompt',
};

/**
 * Accurate contract tests based on real system behavior
 */
function runAccurateTranslationContracts(repoFactory: () => Repo, backendName: string) {
  describe(`Accurate Translation Contracts - ${backendName}`, () => {
    let repo: Repo;

    beforeAll(async () => {
      repo = repoFactory();
      
      // CRITICAL: Store chapter first to create URL mappings
      await repo.storeChapter(testChapter);
      
      // Wait a bit to ensure storage completes (async operations)
      await new Promise(resolve => setTimeout(resolve, 100));
      
      console.log(`[${backendName}] Test setup complete - chapter stored with stableId: ${testChapter.stableId}`);
    });

    afterEach(async () => {
      // Wait between tests to avoid timing issues
      await new Promise(resolve => setTimeout(resolve, 50));
    });

    describe('Basic Translation Storage & Retrieval', () => {
      it('should store translation with correct field mappings', async () => {
        const storedRecord = await repo.storeTranslation(
          testChapter.url,
          accurateTranslation,
          accurateSettings
        );
        
        // Verify the TranslationRecord structure
        expect(storedRecord).toBeDefined();
        expect(storedRecord.id).toBeDefined();
        expect(storedRecord.chapterUrl).toBe(testChapter.url);
        expect(storedRecord.version).toBe(1);
        expect(storedRecord.isActive).toBe(true);
        
        // Critical field mappings
        expect(storedRecord.translatedTitle).toBe(accurateTranslation.translatedTitle);
        expect(storedRecord.translation).toBe(accurateTranslation.translation); // NOT translatedContent!
        
        // Metadata preservation
        expect(storedRecord.provider).toBe(accurateSettings.provider);
        expect(storedRecord.model).toBe(accurateSettings.model);
        expect(storedRecord.temperature).toBe(accurateSettings.temperature);
        expect(storedRecord.systemPrompt).toBe(accurateSettings.systemPrompt);
        
        console.log(`✅ [${backendName}] Translation stored correctly:`, {
          id: storedRecord.id,
          version: storedRecord.version,
          hasTranslation: !!storedRecord.translation,
          provider: storedRecord.provider,
        });
      });

      it('should retrieve active translation with correct structure', async () => {
        const activeTranslation = await repo.getActiveTranslation(testChapter.url);
        
        expect(activeTranslation).toBeDefined();
        expect(activeTranslation?.chapterUrl).toBe(testChapter.url);
        expect(activeTranslation?.isActive).toBe(true);
        expect(activeTranslation?.translation).toBe(accurateTranslation.translation);
        
        console.log(`✅ [${backendName}] Active translation retrieved:`, {
          id: activeTranslation?.id,
          version: activeTranslation?.version,
          isActive: activeTranslation?.isActive,
        });
      });
    });

    describe('Stable ID Operations', () => {
      it('should work with stable IDs after URL mapping exists', async () => {
        // This should work because we stored the chapter first
        const storedRecord = await repo.storeTranslationByStableId(
          testChapter.stableId!,
          {
            ...accurateTranslation,
            translation: 'Translation stored via stable ID',
          },
          accurateSettings
        );
        
        expect(storedRecord).toBeDefined();
        expect(storedRecord.stableId).toBe(testChapter.stableId);
        expect(storedRecord.translation).toBe('Translation stored via stable ID');
        
        // Should be retrievable by stable ID
        const retrieved = await repo.getActiveTranslationByStableId(testChapter.stableId!);
        expect(retrieved?.translation).toBe('Translation stored via stable ID');
        
        console.log(`✅ [${backendName}] Stable ID operations work:`, {
          stableId: storedRecord.stableId,
          version: storedRecord.version,
        });
      });
    });

    describe('Version Management', () => {
      it('should handle sequential version creation correctly', async () => {
        // Store first version
        const version1 = await repo.storeTranslation(
          testChapter.url,
          { ...accurateTranslation, translation: 'Version 1 content' },
          accurateSettings
        );
        
        // Wait to ensure transaction completes
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Store second version  
        const version2 = await repo.storeTranslation(
          testChapter.url,
          { ...accurateTranslation, translation: 'Version 2 content' },
          accurateSettings
        );
        
        expect(version2.version).toBeGreaterThan(version1.version);
        expect(version2.isActive).toBe(true);
        
        // Get all versions
        const allVersions = await repo.getTranslationVersions(testChapter.url);
        expect(allVersions.length).toBeGreaterThanOrEqual(2);
        
        // Only one should be active
        const activeVersions = allVersions.filter(v => v.isActive);
        expect(activeVersions).toHaveLength(1);
        expect(activeVersions[0].version).toBe(version2.version);
        
        console.log(`✅ [${backendName}] Version management works:`, {
          totalVersions: allVersions.length,
          latestVersion: version2.version,
          activeVersion: activeVersions[0].version,
        });
      });

      it('should handle version switching', async () => {
        const versions = await repo.getTranslationVersions(testChapter.url);
        if (versions.length < 2) {
          // Create a second version if needed
          await repo.storeTranslation(
            testChapter.url,
            { ...accurateTranslation, translation: 'Additional version for switching test' },
            accurateSettings
          );
        }
        
        const allVersions = await repo.getTranslationVersions(testChapter.url);
        const firstVersion = allVersions.find(v => v.version === 1);
        
        if (firstVersion) {
          // Set first version as active
          await repo.setActiveTranslation(testChapter.url, 1);
          
          const nowActive = await repo.getActiveTranslation(testChapter.url);
          expect(nowActive?.version).toBe(1);
          
          console.log(`✅ [${backendName}] Version switching works:`, {
            switchedToVersion: nowActive?.version,
            isActive: nowActive?.isActive,
          });
        }
      });
    });

    describe('Error Conditions', () => {
      it('should handle empty translation content gracefully', async () => {
        const emptyTranslation = {
          ...accurateTranslation,
          translation: '', // Empty content
          translatedTitle: '',
        };
        
        const stored = await repo.storeTranslation(
          testChapter.url,
          emptyTranslation,
          accurateSettings
        );
        
        expect(stored).toBeDefined();
        expect(stored.translation).toBe('');
        expect(stored.translatedTitle).toBe('');
        
        console.log(`✅ [${backendName}] Empty content handled gracefully`);
      });
      
      it('should fail gracefully for non-existent stable ID', async () => {
        try {
          await repo.storeTranslationByStableId(
            'non-existent-stable-id',
            accurateTranslation,
            accurateSettings
          );
          
          // Should not reach here
          expect(true).toBe(false);
        } catch (error: any) {
          expect(error.message).toContain('No URL mapping found');
          console.log(`✅ [${backendName}] Non-existent stable ID error handled:`, error.message);
        }
      });
    });

    describe('Performance & Consistency', () => {
      it('should maintain data consistency across operations', async () => {
        const beforeVersions = await repo.getTranslationVersions(testChapter.url);
        const beforeActive = await repo.getActiveTranslation(testChapter.url);
        
        // Store new version
        await repo.storeTranslation(
          testChapter.url,
          { ...accurateTranslation, translation: 'Consistency test version' },
          accurateSettings
        );
        
        const afterVersions = await repo.getTranslationVersions(testChapter.url);
        const afterActive = await repo.getActiveTranslation(testChapter.url);
        
        // Consistency checks
        expect(afterVersions.length).toBe(beforeVersions.length + 1);
        expect(afterActive?.version).toBeGreaterThan(beforeActive?.version || 0);
        expect(afterActive?.isActive).toBe(true);
        expect(afterActive?.translation).toBe('Consistency test version');
        
        // Only one active version
        const activeCount = afterVersions.filter(v => v.isActive).length;
        expect(activeCount).toBe(1);
        
        console.log(`✅ [${backendName}] Data consistency maintained:`, {
          versionsBefore: beforeVersions.length,
          versionsAfter: afterVersions.length,
          activeVersion: afterActive?.version,
          activeCount,
        });
      });
    });
  });
}

// Run accurate tests against both backends
describe('Accurate Translation Service Contracts', () => {
  runAccurateTranslationContracts(
    () => makeLegacyRepo(),
    'Legacy Backend'
  );

  runAccurateTranslationContracts(
    () => makeRepo('idb'),
    'New IDB Backend'
  );
});

export { testChapter, accurateTranslation, accurateSettings };
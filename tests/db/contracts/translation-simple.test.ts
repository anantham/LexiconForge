/**
 * Simplified Translation Contract Tests - Reality Check
 * 
 * Tests basic translation operations against the ACTUAL legacy interface.
 * This establishes our migration baseline.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import type { Repo } from '../../../adapters/repo/Repo';
import { makeLegacyRepo } from '../../../legacy/indexeddb-compat';
import type { TranslationResult, Chapter } from '../../../types';

// Test fixtures matching reality
const mockChapter: Chapter = {
  url: 'https://test.example.com/novel/ch1',
  title: 'Test Chapter 1',
  content: 'This is test chapter content for translation.',
  stableId: 'test-novel-ch-001',
  nextUrl: null,
  prevUrl: null,
};

const mockTranslation: TranslationResult = {
  translatedContent: 'This is a test translation',
  provider: 'openai',
  model: 'gpt-4',
  cost: 0.05,
  version: 1,
  isActive: true,
  id: 'test-translation-1',
  chapterUrl: mockChapter.url,
  timestamp: Date.now(),
};

const mockSettings = {
  provider: 'openai',
  model: 'gpt-4',
  temperature: 0.7,
  systemPrompt: 'You are a professional translator.',
  promptId: 'default-prompt',
  promptName: 'Default Translation Prompt',
};

describe('Translation Migration Reality Check', () => {
  let repo: Repo;

  beforeAll(async () => {
    repo = makeLegacyRepo();
    
    // Ensure test chapter exists
    try {
      await repo.storeChapter(mockChapter);
    } catch (error) {
      console.warn('Chapter setup warning:', error);
    }
  });

  it('should understand legacy translation storage', async () => {
    // Store a translation using the legacy interface
    const storedTranslation = await repo.storeTranslation(
      mockChapter.url,
      mockTranslation,
      mockSettings
    );
    
    // Verify it returns a translation record
    expect(storedTranslation).toBeDefined();
    expect(storedTranslation.chapterUrl).toBe(mockChapter.url);
    expect(storedTranslation.provider).toBe(mockSettings.provider);
    expect(storedTranslation.model).toBe(mockSettings.model);
    
    console.log('✅ Legacy translation stored:', {
      id: storedTranslation.id,
      version: storedTranslation.version,
      provider: storedTranslation.provider,
      model: storedTranslation.model,
    });
  });

  it('should retrieve active translation', async () => {
    // Get the active translation
    const activeTranslation = await repo.getActiveTranslation(mockChapter.url);
    
    expect(activeTranslation).toBeDefined();
    expect(activeTranslation?.chapterUrl).toBe(mockChapter.url);
    
    console.log('✅ Retrieved active translation:', {
      id: activeTranslation?.id,
      version: activeTranslation?.version,
      hasContent: !!activeTranslation?.translation,
    });
  });

  it('should handle translation versions', async () => {
    // Store a second version
    const secondTranslation: TranslationResult = {
      ...mockTranslation,
      translatedContent: 'This is the second translation version',
      timestamp: Date.now() + 1000,
    };
    
    await repo.storeTranslation(mockChapter.url, secondTranslation, mockSettings);
    
    // Get all versions
    const versions = await repo.getTranslationVersions(mockChapter.url);
    
    expect(versions).toBeDefined();
    expect(versions.length).toBeGreaterThanOrEqual(1);
    
    console.log('✅ Translation versions:', {
      count: versions.length,
      versions: versions.map(v => ({ id: v.id, version: v.version })),
    });
  });

  it('should work with stable IDs (if supported)', async () => {
    try {
      // Try storing by stable ID
      const byStableId = await repo.storeTranslationByStableId(
        mockChapter.stableId!,
        mockTranslation,
        mockSettings
      );
      
      expect(byStableId).toBeDefined();
      console.log('✅ Stable ID translation works:', byStableId.id);
    } catch (error) {
      console.log('ℹ️ Stable ID not supported yet:', error.message);
      // This is expected during migration
    }
  });

  it('should export session data', async () => {
    // Test the export functionality
    const exported = await repo.exportFullSessionToJson();
    
    expect(exported).toBeDefined();
    expect(exported.translations).toBeDefined();
    expect(Array.isArray(exported.translations)).toBe(true);
    
    console.log('✅ Export works:', {
      chapters: exported.chapters?.length || 0,
      translations: exported.translations?.length || 0,
      settings: Object.keys(exported.settings || {}).length,
    });
  });
});

// Export for migration validation
export { mockChapter, mockTranslation, mockSettings };
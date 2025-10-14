/**
 * Diagnostic Evidence Collection - What's Really Happening?
 * 
 * This test investigates the actual system behavior to understand
 * why StableIdManager.getUrlForStableId() fails after chapter storage.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import type { Repo } from '../../../adapters/repo/Repo';
import { makeLegacyRepo } from '../../../legacy/indexeddb-compat';
import { StableIdManager } from '../../../services/db/core/stable-ids';
import { indexedDBService } from '../../../services/indexeddb';
import type { Chapter } from '../../../types';

describe('Diagnostic Evidence Collection', () => {
  let legacyRepo: Repo;

  beforeAll(async () => {
    legacyRepo = makeLegacyRepo();
  });

  it('should investigate what happens when we store a chapter', async () => {
    const timestamp = Date.now();
    const chapter: Chapter = {
      url: `https://diagnostic-${timestamp}.com/ch1`,
      originalUrl: `https://diagnostic-${timestamp}.com/ch1`,
      title: 'Diagnostic Chapter',
      content: 'Diagnostic content',
      stableId: `diagnostic-${timestamp}-ch-001`,
      nextUrl: null,
      prevUrl: null,
    };

    // Step 1: Store chapter using legacy repo
    await legacyRepo.storeChapter(chapter);

    // Step 2: Check what URL mappings exist
    let mappingsError: string | null = null;
    let mappingsCount = 0;
    let relevantMappings: any[] = [];
    try {
      const allMappings = await indexedDBService.getAllUrlMappings();
      mappingsCount = allMappings.length;
      relevantMappings = allMappings.filter(m => m.stableId.includes('diagnostic'));
    } catch (error) {
      mappingsError = (error as any)?.message;
    }

    // Step 3: Check if chapter exists in chapters store
    let chapterFound = false;
    let chapterError: string | null = null;
    try {
      const storedChapter = await indexedDBService.getChapterByStableId(chapter.stableId!);
      chapterFound = !!storedChapter;
    } catch (error) {
      chapterError = (error as any)?.message;
    }

    // Step 4: Try StableIdManager.getUrlForStableId
    let stableIdManagerWorked = false;
    let stableIdError: string | null = null;
    try {
      const url = await StableIdManager.getUrlForStableId(chapter.stableId!);
      stableIdManagerWorked = true;
    } catch (error) {
      stableIdError = (error as any)?.message;
    }

    // Step 5: Manually create URL mapping and retry
    await StableIdManager.ensureUrlMappings(chapter.url, chapter.stableId!);

    // Step 6: Retry StableIdManager.getUrlForStableId
    let stableIdManagerWorkedAfter = false;
    let stableIdErrorAfter: string | null = null;
    try {
      const url = await StableIdManager.getUrlForStableId(chapter.stableId!);
      stableIdManagerWorkedAfter = true;
    } catch (error) {
      stableIdErrorAfter = (error as any)?.message;
    }

    // Use assertions to display the evidence
    expect(mappingsError || 'NO_ERROR').toBe('NO_ERROR'); // Show if getting mappings failed
    expect(mappingsCount).toBeGreaterThanOrEqual(0); // Show mapping count
    expect(relevantMappings.length).toBeGreaterThanOrEqual(0); // Show relevant mappings
    expect(chapterError || 'NO_ERROR').toBe('NO_ERROR'); // Show if chapter lookup failed
    expect(chapterFound).toBe(true); // Chapter should be found
    expect(stableIdManagerWorked).toBe(false); // Expected to fail initially
    expect(stableIdError).toContain('StableId not found'); // Should get this specific error
    expect(stableIdManagerWorkedAfter).toBe(true); // Should work after manual mapping
    expect(stableIdErrorAfter || 'NO_ERROR').toBe('NO_ERROR'); // Should not error after
  });

  it('should test the auto-repair fallback mechanism', async () => {
    const timestamp = Date.now();
    const chapter: Chapter = {
      url: `https://fallback-${timestamp}.com/ch1`,
      originalUrl: `https://fallback-${timestamp}.com/ch1`,
      title: 'Fallback Test Chapter',
      content: 'Fallback test content',
      stableId: `fallback-${timestamp}-ch-001`,
      nextUrl: null,
      prevUrl: null,
    };

    console.log('🔍 EVIDENCE: Testing fallback mechanism for:', chapter.stableId);

    // Store chapter
    await legacyRepo.storeChapter(chapter);

    // Check if getChapterByStableId works (this is step 3 in StableIdManager.getUrlForStableId)
    console.log('🔍 EVIDENCE: Testing indexedDBService.getChapterByStableId...');
    try {
      const foundChapter = await indexedDBService.getChapterByStableId(chapter.stableId!);
      console.log('✅ Chapter found via getChapterByStableId:', foundChapter?.url);
      
      if (foundChapter?.url) {
        console.log('💡 INSIGHT: The chapter EXISTS, but URL mapping is missing');
        console.log('💡 This means StableIdManager should auto-repair in step 3');
      }
    } catch (error) {
      console.log('❌ getChapterByStableId failed:', (error as any)?.message);
    }

    expect(true).toBe(true);
  });
});

/**
 * HYPOTHESIS TO TEST:
 * 
 * The legacy repo.storeChapter() stores chapters but doesn't create URL mappings.
 * StableIdManager.getUrlForStableId() expects to find URL mappings first,
 * and should fall back to searching chapters and auto-repairing.
 * 
 * If this hypothesis is correct, the issue might be:
 * 1. Step 3 fallback (getChapterByStableId) isn't working
 * 2. Auto-repair after finding chapter isn't working
 * 3. The chapter isn't being stored with the correct stableId field
 */
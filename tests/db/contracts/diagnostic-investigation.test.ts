/**
 * Diagnostic Investigation - Evidence-Based Bug Analysis
 * 
 * Instead of assuming "bugs", let's gather empirical evidence to test each hypothesis:
 * H1: Race condition causes constraint violations (vs NULL: concurrent operations work fine)
 * H2: Stable ID operations fail without URL mappings (vs NULL: they work or fail gracefully)
 * H3: Field naming causes runtime issues (vs NULL: it's just cosmetic)
 * H4: Transaction isolation causes data corruption (vs NULL: eventual consistency works)
 * H5: Test data pollution affects results (vs NULL: tests are properly isolated)
 */

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import type { Repo } from '../../../adapters/repo/Repo';
import { makeLegacyRepo } from '../../../legacy/indexeddb-compat';
import type { TranslationResult, Chapter } from '../../../types';

// Evidence collection utilities
const evidence: { [key: string]: any[] } = {};
const logEvidence = (category: string, data: any) => {
  if (!evidence[category]) evidence[category] = [];
  evidence[category].push({ timestamp: Date.now(), ...data });
  console.log(`📊 [${category}]`, data);
};

// Test data
const timestamp = Date.now();
const diagnosticChapter: Chapter = {
  url: `https://diagnostic-${timestamp}.com/ch1`,
  originalUrl: `https://diagnostic-${timestamp}.com/ch1`,
  title: 'Diagnostic Investigation Chapter',
  content: 'Chapter content for evidence gathering.',
  stableId: `diagnostic-${timestamp}-ch-001`,
  nextUrl: null,
  prevUrl: null,
};

const diagnosticTranslation: TranslationResult = {
  translatedTitle: 'Diagnostic Translation',
  translation: 'Evidence-based translation content',
  footnotes: [],
  suggestedIllustrations: [],
  usageMetrics: {
    totalTokens: 100,
    promptTokens: 80,
    completionTokens: 20,
    estimatedCost: 0.05,
    requestTime: 1.0,
    provider: 'openai',
    model: 'gpt-4',
  },
  version: 1,
  isActive: true,
  id: 'diagnostic-id',
  chapterUrl: diagnosticChapter.url,
  timestamp: Date.now(),
};

const diagnosticSettings = {
  provider: 'openai',
  model: 'gpt-4',
  temperature: 0.7,
  systemPrompt: 'Diagnostic investigation prompt',
  promptId: 'diagnostic-prompt',
  promptName: 'Diagnostic Prompt',
};

describe('Diagnostic Investigation - Evidence Collection', () => {
  let repo: Repo;

  beforeAll(async () => {
    repo = makeLegacyRepo();
    console.log('🔬 Starting diagnostic investigation');
  });

  beforeEach(() => {
    // Clear evidence for each test
    Object.keys(evidence).forEach(key => evidence[key] = []);
  });

  describe('H1: Race Condition Hypothesis Testing', () => {
    it('should test concurrent version assignment with detailed logging', async () => {
      // HYPOTHESIS: Concurrent operations cause constraint violations
      // NULL HYPOTHESIS: Concurrent operations work fine or fail gracefully
      
      await repo.storeChapter(diagnosticChapter);
      
      // Store initial version to establish baseline
      const baseline = await repo.storeTranslation(
        diagnosticChapter.url,
        { ...diagnosticTranslation, translation: 'Baseline version' },
        diagnosticSettings
      );
      
      logEvidence('version_assignment', {
        test: 'baseline',
        version: baseline.version,
        id: baseline.id,
        isActive: baseline.isActive,
      });

      // Test concurrent operations with timing measurement
      const startTime = performance.now();
      const concurrentPromises = Array.from({ length: 3 }, (_, i) => 
        repo.storeTranslation(
          diagnosticChapter.url,
          { ...diagnosticTranslation, translation: `Concurrent ${i}` },
          diagnosticSettings
        ).then(result => {
          const duration = performance.now() - startTime;
          logEvidence('concurrent_result', {
            index: i,
            version: result.version,
            id: result.id,
            isActive: result.isActive,
            duration_ms: duration,
          });
          return result;
        }).catch(error => {
          const duration = performance.now() - startTime;
          logEvidence('concurrent_error', {
            index: i,
            error: error.message,
            error_type: error.constructor.name,
            duration_ms: duration,
          });
          throw error;
        })
      );

      let results: any[] = [];
      let errors: any[] = [];
      
      await Promise.allSettled(concurrentPromises).then(outcomes => {
        outcomes.forEach((outcome, i) => {
          if (outcome.status === 'fulfilled') {
            results.push(outcome.value);
          } else {
            errors.push({ index: i, error: outcome.reason });
          }
        });
      });

      // Analyze results
      const versions = results.map(r => r.version);
      const uniqueVersions = [...new Set(versions)];
      const hasDuplicateVersions = versions.length !== uniqueVersions.length;
      
      logEvidence('race_condition_analysis', {
        total_attempts: 3,
        successful_results: results.length,
        errors: errors.length,
        versions: versions,
        unique_versions: uniqueVersions,
        has_duplicate_versions: hasDuplicateVersions,
        error_types: errors.map(e => e.error?.message || 'unknown'),
      });

      // Get final state
      const finalVersions = await repo.getTranslationVersions(diagnosticChapter.url);
      const activeVersions = finalVersions.filter(v => v.isActive);
      
      logEvidence('final_state', {
        total_versions: finalVersions.length,
        active_versions: activeVersions.length,
        version_numbers: finalVersions.map(v => ({ version: v.version, active: v.isActive })),
      });

      // Evidence evaluation
      if (errors.length === 0) {
        console.log('💡 NULL HYPOTHESIS SUPPORTED: No constraint violations occurred');
      } else {
        console.log('💡 HYPOTHESIS SUPPORTED: Concurrent operations caused errors');
      }

      if (hasDuplicateVersions) {
        console.log('💡 EVIDENCE: Duplicate version numbers detected');
      } else {
        console.log('💡 EVIDENCE: Version numbers are unique');
      }

      if (activeVersions.length === 1) {
        console.log('💡 EVIDENCE: Exactly one active version (consistency maintained)');
      } else {
        console.log('💡 EVIDENCE: Multiple or zero active versions (consistency issue)');
      }
    });
  });

  describe('H2: Stable ID Dependency Hypothesis Testing', () => {
    it('should test stable ID operations with mapping state diagnostics', async () => {
      // HYPOTHESIS: Stable ID operations fail without URL mappings
      // NULL HYPOTHESIS: Stable ID operations work or fail gracefully with clear errors
      
      const freshChapter: Chapter = {
        ...diagnosticChapter,
        url: `${diagnosticChapter.url}-fresh`,
        originalUrl: `${diagnosticChapter.url}-fresh`,
        stableId: `${diagnosticChapter.stableId}-fresh`,
      };

      // Test 1: Store chapter without triggering URL mapping creation
      await repo.storeChapter(freshChapter);
      
      logEvidence('stable_id_test', {
        phase: 'after_store_chapter',
        chapter_stored: true,
        stable_id: freshChapter.stableId,
      });

      // Test 2: Check if URL mapping exists
      try {
        const mapping = await repo.getStableIdByUrl(freshChapter.url);
        logEvidence('url_mapping_check', {
          url: freshChapter.url,
          stable_id_found: mapping,
          mapping_exists: !!mapping,
        });
      } catch (error) {
        logEvidence('url_mapping_error', {
          error: (error as Error).message,
          error_type: (error as Error).constructor.name,
        });
      }

      // Test 3: Attempt stable ID operation
      try {
        const result = await repo.storeTranslationByStableId(
          freshChapter.stableId!,
          { ...diagnosticTranslation, translation: 'Stable ID test' },
          diagnosticSettings
        );
        
        logEvidence('stable_id_success', {
          stable_id: freshChapter.stableId,
          translation_id: result.id,
          version: result.version,
        });
        
        console.log('💡 NULL HYPOTHESIS SUPPORTED: Stable ID operation succeeded');
        
      } catch (error: any) {
        logEvidence('stable_id_failure', {
          stable_id: freshChapter.stableId,
          error: error.message,
          error_type: error.constructor.name,
          is_mapping_error: error.message.includes('No URL mapping'),
        });
        
        if (error.message.includes('No URL mapping')) {
          console.log('💡 HYPOTHESIS SUPPORTED: Failed due to missing URL mapping');
        } else {
          console.log('💡 UNEXPECTED: Failed for different reason:', error.message);
        }
      }

      // Test 4: Try to manually create URL mapping and retry
      try {
        // Access the underlying indexedDBService to trigger backfill
        const indexedDBService = await import('../../../services/indexeddb').then(m => m.indexedDBService);
        await indexedDBService.backfillUrlMappingsFromChapters();
        
        logEvidence('backfill_attempt', {
          backfill_completed: true,
        });
        
        // Retry stable ID operation
        const retryResult = await repo.storeTranslationByStableId(
          freshChapter.stableId!,
          { ...diagnosticTranslation, translation: 'Post-backfill test' },
          diagnosticSettings
        );
        
        logEvidence('stable_id_retry_success', {
          stable_id: freshChapter.stableId,
          translation_id: retryResult.id,
          version: retryResult.version,
        });
        
        console.log('💡 EVIDENCE: Stable ID worked after backfill');
        
      } catch (error: any) {
        logEvidence('stable_id_retry_failure', {
          stable_id: freshChapter.stableId,
          error: error.message,
          backfill_helps: false,
        });
        
        console.log('💡 EVIDENCE: Stable ID still fails even after backfill');
      }
    });
  });

  describe('H3: Field Naming Impact Assessment', () => {
    it('should test field naming consistency across operations', async () => {
      // HYPOTHESIS: Field naming inconsistencies cause runtime issues
      // NULL HYPOTHESIS: Field naming is cosmetic, runtime adapts correctly
      
      await repo.storeChapter(diagnosticChapter);
      
      // Test field mapping in storage
      const stored = await repo.storeTranslation(
        diagnosticChapter.url,
        diagnosticTranslation,
        diagnosticSettings
      );
      
      logEvidence('field_mapping', {
        input_has_translation: 'translation' in diagnosticTranslation,
        input_has_translatedContent: 'translatedContent' in diagnosticTranslation,
        stored_has_translation: 'translation' in stored,
        stored_has_translatedContent: 'translatedContent' in stored,
        input_translation_value: diagnosticTranslation.translation,
        stored_translation_value: stored.translation,
        values_match: diagnosticTranslation.translation === stored.translation,
      });
      
      // Test retrieval
      const retrieved = await repo.getActiveTranslation(diagnosticChapter.url);
      
      logEvidence('field_retrieval', {
        retrieved_has_translation: retrieved && 'translation' in retrieved,
        retrieved_has_translatedContent: retrieved && 'translatedContent' in retrieved,
        retrieved_translation_value: retrieved?.translation,
        storage_retrieval_match: stored.translation === retrieved?.translation,
      });
      
      if (diagnosticTranslation.translation === stored.translation && 
          stored.translation === retrieved?.translation) {
        console.log('💡 NULL HYPOTHESIS SUPPORTED: Field mapping works correctly');
      } else {
        console.log('💡 HYPOTHESIS SUPPORTED: Field mapping causes data loss');
      }
    });
  });

  describe('H4: Transaction Isolation Testing', () => {
    it('should measure transaction gaps and consistency impact', async () => {
      // HYPOTHESIS: Transaction isolation gaps cause data corruption
      // NULL HYPOTHESIS: Eventual consistency works despite transaction gaps
      
      await repo.storeChapter(diagnosticChapter);
      
      // Measure timing of version assignment vs storage
      const versionAssignmentStart = performance.now();
      
      // This simulates the gap between getNextVersionNumber and actual storage
      const versions1 = await repo.getTranslationVersions(diagnosticChapter.url);
      const versionGapEnd = performance.now();
      
      const stored = await repo.storeTranslation(
        diagnosticChapter.url,
        { ...diagnosticTranslation, translation: 'Transaction timing test' },
        diagnosticSettings
      );
      const storageEnd = performance.now();
      
      logEvidence('transaction_timing', {
        version_lookup_duration: versionGapEnd - versionAssignmentStart,
        total_storage_duration: storageEnd - versionAssignmentStart,
        version_gap_percent: ((versionGapEnd - versionAssignmentStart) / (storageEnd - versionAssignmentStart)) * 100,
        versions_before: versions1.length,
        stored_version: stored.version,
      });
      
      // Test consistency after operation
      const versions2 = await repo.getTranslationVersions(diagnosticChapter.url);
      const activeVersions = versions2.filter(v => v.isActive);
      
      logEvidence('consistency_check', {
        versions_after: versions2.length,
        active_count: activeVersions.length,
        version_increment_correct: versions2.length === versions1.length + 1,
        single_active: activeVersions.length === 1,
        active_version_correct: activeVersions[0]?.version === stored.version,
      });
      
      if (activeVersions.length === 1 && activeVersions[0].version === stored.version) {
        console.log('💡 NULL HYPOTHESIS SUPPORTED: Eventual consistency maintained');
      } else {
        console.log('💡 HYPOTHESIS SUPPORTED: Transaction gaps cause consistency issues');
      }
    });
  });

  describe('H5: Test Isolation Investigation', () => {
    it('should check for data pollution between tests', async () => {
      // HYPOTHESIS: Test data pollution affects results
      // NULL HYPOTHESIS: Tests are properly isolated
      
      // Check initial state
      const initialChapters = await repo.getAllChapters();
      const initialTranslations = await repo.getTranslationVersions(diagnosticChapter.url);
      
      logEvidence('test_isolation', {
        phase: 'initial_state',
        existing_chapters: initialChapters.length,
        existing_translations: initialTranslations.length,
        chapter_urls: initialChapters.map(c => c.url),
      });
      
      // Store test data
      await repo.storeChapter(diagnosticChapter);
      await repo.storeTranslation(
        diagnosticChapter.url,
        { ...diagnosticTranslation, translation: 'Isolation test' },
        diagnosticSettings
      );
      
      const afterStorage = await repo.getAllChapters();
      const afterTranslations = await repo.getTranslationVersions(diagnosticChapter.url);
      
      logEvidence('test_isolation', {
        phase: 'after_storage',
        chapters_count: afterStorage.length,
        translations_count: afterTranslations.length,
        data_created: afterStorage.length > initialChapters.length,
      });
      
      if (initialChapters.length === 0 && initialTranslations.length === 0) {
        console.log('💡 NULL HYPOTHESIS SUPPORTED: Tests start with clean state');
      } else {
        console.log('💡 HYPOTHESIS SUPPORTED: Previous test data found');
      }
    });
  });

  afterAll(() => {
    // Summary report
    console.log('\n🔬 DIAGNOSTIC EVIDENCE SUMMARY');
    console.log('=====================================');
    
    Object.entries(evidence).forEach(([category, events]) => {
      if (events.length > 0) {
        console.log(`\n📊 ${category.toUpperCase()}:`);
        events.forEach((event, i) => {
          console.log(`  ${i + 1}.`, JSON.stringify(event, null, 2));
        });
      }
    });
    
    console.log('\n✅ Investigation complete. Review evidence to determine if hypotheses are supported.');
  });
});
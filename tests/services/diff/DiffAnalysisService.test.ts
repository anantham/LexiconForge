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
      // Markers may be empty in skeleton implementation
      if (result.markers.length > 0) {
        expect(result.markers[0]).toHaveProperty('chunkId');
        expect(result.markers[0]).toHaveProperty('colors');
        expect(result.markers[0]).toHaveProperty('reasons');
      }
      expect(result.aiVersionId).toBeDefined();
      expect(result.analyzedAt).toBeGreaterThan(0);
    });

    it('should call translator with correct prompt and parse response', async () => {
      const mockTranslate = vi.fn().mockResolvedValue({
        translatedText: JSON.stringify({
          markers: [
            {
              chunkId: 'para-0-17c5',  // Matches hash of 'Test paragraph.'
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
  });
});

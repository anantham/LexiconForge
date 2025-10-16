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

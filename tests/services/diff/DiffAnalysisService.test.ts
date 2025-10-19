// tests/services/diff/DiffAnalysisService.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DiffAnalysisService, DiffAnalysisJsonParseError } from '../../../services/diff/DiffAnalysisService';
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
              colors: ['blue'],
              reasons: ['fan-divergence'],
              explanations: ['Fan translation chooses different noun phrasing.'],
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
      expect(result.markers[0].colors).toContain('blue');
      expect(result.markers[0].explanations?.[0]).toContain('Fan translation');
      expect(result.costUsd).toBe(0.0011);
    });

    it('preserves freeform reason text as explanation when schema fields are swapped', async () => {
      const mockTranslate = vi.fn().mockResolvedValue({
        translatedText: JSON.stringify({
          markers: [
            {
              chunkId: 'para-0-17c5',
              colors: ['blue'],
              reasons: ['  AI uses different phrasing for key terms.  '],
              confidence: 0.75
            }
          ]
        }),
        cost: 0.0015,
        model: 'gpt-4o-mini'
      });

      (service as any).translator = { translate: mockTranslate };

      const request: DiffAnalysisRequest = {
        chapterId: 'ch-schema-mismatch',
        aiTranslation: 'Test paragraph.',
        fanTranslation: 'Test para.',
        rawText: 'テスト段落。'
      };

      const result = await service.analyzeDiff(request);

      expect(result.markers).toHaveLength(1);
      expect(result.markers[0].reasons).toEqual(['fan-divergence']);
      expect(result.markers[0].explanations?.[0]).toBe('AI uses different phrasing for key terms.');
      expect(result.markers[0].confidence).toBe(0.75);
    });

    it('supports single explanation field when array is omitted', async () => {
      const mockTranslate = vi.fn().mockResolvedValue({
        translatedText: JSON.stringify({
          markers: [
            {
              chunkId: 'para-0-17c5',
              colors: ['blue'],
              reasons: ['fan-divergence'],
              explanation: 'AI chooses a more literal noun.',
              confidence: 0.6
            }
          ]
        }),
        cost: 0.002,
        model: 'gpt-4o-mini'
      });

      (service as any).translator = { translate: mockTranslate };

      const request: DiffAnalysisRequest = {
        chapterId: 'ch-single-explanation',
        aiTranslation: 'Test paragraph.',
        fanTranslation: 'Test para.',
        rawText: 'テスト段落。'
      };

      const result = await service.analyzeDiff(request);

      expect(result.markers).toHaveLength(1);
      expect(result.markers[0].explanations?.[0]).toBe('AI chooses a more literal noun.');
      expect(result.markers[0].confidence).toBe(0.6);
    });
  });

  it('returns grey fallback markers without explanations when translator is unavailable', async () => {
    const request: DiffAnalysisRequest = {
      chapterId: 'ch-fallback',
      aiTranslation: 'First paragraph.\n\nSecond paragraph.',
      fanTranslation: null,
      rawText: '原文 第一段。\n\n原文 第二段。'
    };

    const result = await service.analyzeDiff(request);

    expect(result.markers.length).toBeGreaterThan(0);
    for (const marker of result.markers) {
      expect(marker.colors).toEqual(['grey']);
      expect(marker.reasons).toEqual(['no-change']);
      expect(marker.explanations).toBeUndefined();
      expect(marker.confidence).toBeUndefined();
    }
  });

  it('splits HTML paragraph separators into multiple chunks', () => {
    const html = [
      'First paragraph line 1',
      '<br><br>',
      'Second paragraph line 1<br />Second paragraph line 2',
      '<hr />',
      'Third paragraph'
    ].join('');

    const chunks = (service as any).chunkAiTranslation(html) as Array<{ text: string; position: number }>;

    expect(chunks).toHaveLength(3);
    expect(chunks[0].text).toContain('First paragraph');
    expect(chunks[0].position).toBe(0);
    expect(chunks[1].text).toContain('Second paragraph line 2');
    expect(chunks[1].position).toBe(1);
    expect(chunks[2].text).toContain('Third paragraph');
    expect(chunks[2].position).toBe(2);
  });

  it('throws DiffAnalysisJsonParseError when response is not JSON', async () => {
    const mockTranslate = vi.fn().mockResolvedValue({
      translatedText: '<html>not json</html>',
      cost: 0,
      model: 'openai/gpt-4o-mini'
    });

    (service as any).translator = { translate: mockTranslate };

    await expect(service.analyzeDiff({
      chapterId: 'ch-parse-fail',
      aiTranslation: 'Paragraph one.\n\nParagraph two.',
      fanTranslation: null,
      rawText: '原文'
    })).rejects.toBeInstanceOf(DiffAnalysisJsonParseError);
  });
});

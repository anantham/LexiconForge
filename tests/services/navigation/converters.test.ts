import { describe, it, expect } from 'vitest';
import { adaptTranslationRecordToResult } from '../../../services/navigation/converters';
import type { TranslationRecord } from '../../../services/db/types';

const baseRecord = (): TranslationRecord => ({
  id: 'tr-1',
  chapterId: 'ch-1',
  translation: '<p>Hello</p>',
  translatedTitle: 'The Title',
  provider: 'anthropic',
  model: 'claude-3',
  version: 1,
  totalTokens: 1000,
  promptTokens: 800,
  completionTokens: 200,
  estimatedCost: 0.01,
  requestTime: 1234,
  createdAt: 1700000000000,
  isActive: true,
  proposal: null,
  footnotes: [],
  suggestedIllustrations: [],
  settingsSnapshot: null,
  stableId: 'stable-1',
  chapterUrl: 'https://example.com/ch1',
  customVersionLabel: undefined,
});

describe('adaptTranslationRecordToResult', () => {
  it('returns null for null record', () => {
    expect(adaptTranslationRecordToResult('ch-1', null)).toBeNull();
  });

  it('returns null for undefined record', () => {
    expect(adaptTranslationRecordToResult('ch-1', undefined)).toBeNull();
  });

  it('maps core fields correctly', () => {
    const result = adaptTranslationRecordToResult('ch-1', baseRecord());
    expect(result).not.toBeNull();
    expect(result!.translation).toBe('<p>Hello</p>');
    expect(result!.translatedTitle).toBe('The Title');
    expect(result!.id).toBe('tr-1');
    expect(result!.version).toBe(1);
    expect(result!.isActive).toBe(true);
    expect(result!.stableId).toBe('stable-1');
    expect(result!.chapterUrl).toBe('https://example.com/ch1');
  });

  it('maps usage metrics correctly', () => {
    const result = adaptTranslationRecordToResult('ch-1', baseRecord());
    expect(result!.usageMetrics).toEqual({
      totalTokens: 1000,
      promptTokens: 800,
      completionTokens: 200,
      estimatedCost: 0.01,
      requestTime: 1234,
      provider: 'anthropic',
      model: 'claude-3',
    });
  });

  it('defaults missing token fields to 0', () => {
    const record = { ...baseRecord(), totalTokens: undefined as any, estimatedCost: undefined as any };
    const result = adaptTranslationRecordToResult('ch-1', record);
    expect(result!.usageMetrics.totalTokens).toBe(0);
    expect(result!.usageMetrics.estimatedCost).toBe(0);
  });

  it('defaults missing provider/model to "unknown"', () => {
    const record = { ...baseRecord(), provider: undefined as any, model: undefined as any };
    const result = adaptTranslationRecordToResult('ch-1', record);
    expect(result!.usageMetrics.provider).toBe('unknown');
    expect(result!.usageMetrics.model).toBe('unknown');
  });

  it('generates fallback id when record.id is missing', () => {
    const record = { ...baseRecord(), id: undefined as any };
    const result = adaptTranslationRecordToResult('ch-1', record);
    expect(result!.id).toContain('ch-1');
    expect(result!.id).toContain('v1');
  });

  it('generates legacy fallback id when both id and version missing', () => {
    const record = { ...baseRecord(), id: undefined as any, version: undefined as any };
    const result = adaptTranslationRecordToResult('ch-1', record);
    expect(result!.id).toContain('ch-1');
    expect(result!.id).toContain('legacy');
  });

  it('maps optional arrays with defaults', () => {
    const record = { ...baseRecord(), footnotes: undefined as any, suggestedIllustrations: undefined as any };
    const result = adaptTranslationRecordToResult('ch-1', record);
    expect(result!.footnotes).toEqual([]);
    expect(result!.suggestedIllustrations).toEqual([]);
  });

  it('passes through proposal as null when absent', () => {
    const result = adaptTranslationRecordToResult('ch-1', baseRecord());
    expect(result!.proposal).toBeNull();
  });
});

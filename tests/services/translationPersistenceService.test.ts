import 'fake-indexeddb/auto';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { TranslationPersistenceService } from '../../services/translationPersistenceService';
import { TranslationOps } from '../../services/db/operations';
import type { TranslationResult } from '../../types';
import type { TranslationRecord } from '../../services/db/types';

// Mock TranslationOps since the real ones need a full DB setup
vi.mock('../../services/db/operations', () => ({
  TranslationOps: {
    storeByStableId: vi.fn(),
    update: vi.fn(),
    setActiveByStableId: vi.fn(),
  },
}));

const mockStoreByStableId = vi.mocked(TranslationOps.storeByStableId);
const mockUpdate = vi.mocked(TranslationOps.update);
const mockSetActive = vi.mocked(TranslationOps.setActiveByStableId);

const baseSettings = {
  provider: 'OpenRouter' as const,
  model: 'google/gemini-3-flash',
  temperature: 0.7,
  systemPrompt: 'Translate this.',
  enableAmendments: true,
  includeFanTranslationInPrompt: false,
};

const baseTranslation: TranslationResult = {
  translatedTitle: 'Chapter 1',
  translation: '<p>Translated text</p>',
  footnotes: [],
  suggestedIllustrations: [],
  proposal: null,
  usageMetrics: {
    totalTokens: 100,
    promptTokens: 50,
    completionTokens: 50,
    estimatedCost: 0.001,
    requestTime: 2000,
    provider: 'OpenRouter',
    model: 'google/gemini-3-flash',
  },
};

const storedRecord: TranslationRecord = {
  id: 'tr-uuid-1',
  chapterUrl: 'https://example.com/ch1',
  stableId: 'ch1_abc_def',
  version: 1,
  translatedTitle: 'Chapter 1',
  translation: '<p>Translated text</p>',
  footnotes: [],
  suggestedIllustrations: [],
  provider: 'OpenRouter',
  model: 'google/gemini-3-flash',
  temperature: 0.7,
  systemPrompt: 'Translate this.',
  totalTokens: 100,
  promptTokens: 50,
  completionTokens: 50,
  estimatedCost: 0.001,
  requestTime: 2000,
  createdAt: '2025-01-01T00:00:00Z',
  isActive: true,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('TranslationPersistenceService', () => {
  describe('persistUpdatedTranslation', () => {
    it('creates new translation when given a TranslationResult (no chapterUrl)', async () => {
      mockStoreByStableId.mockResolvedValue(storedRecord);

      const result = await TranslationPersistenceService.persistUpdatedTranslation(
        'ch1_abc_def',
        baseTranslation,
        baseSettings
      );

      expect(mockStoreByStableId).toHaveBeenCalledWith('ch1_abc_def', baseTranslation, baseSettings);
      expect(mockUpdate).not.toHaveBeenCalled();
      expect(result).toBe(storedRecord);
    });

    it('updates existing record when given a TranslationRecord (has chapterUrl + id)', async () => {
      mockUpdate.mockResolvedValue(undefined);

      const result = await TranslationPersistenceService.persistUpdatedTranslation(
        'ch1_abc_def',
        storedRecord,
        baseSettings
      );

      expect(mockUpdate).toHaveBeenCalledWith(storedRecord);
      expect(mockStoreByStableId).not.toHaveBeenCalled();
      expect(result).toBe(storedRecord);
    });

    it('throws on storage failure (does not swallow errors)', async () => {
      mockStoreByStableId.mockRejectedValue(new Error('IDB write failed'));

      await expect(
        TranslationPersistenceService.persistUpdatedTranslation(
          'ch1_abc_def',
          baseTranslation,
          baseSettings
        )
      ).rejects.toThrow('IDB write failed');
    });
  });

  describe('createNewVersion', () => {
    it('stores new version and sets it as active', async () => {
      const newRecord = { ...storedRecord, id: 'tr-uuid-2', version: 2 };
      mockStoreByStableId.mockResolvedValue(newRecord);

      const result = await TranslationPersistenceService.createNewVersion(
        'ch1_abc_def',
        baseTranslation,
        baseSettings,
        { versionLabel: 'Manual retranslation' }
      );

      expect(mockStoreByStableId).toHaveBeenCalled();
      expect(mockSetActive).toHaveBeenCalledWith('ch1_abc_def', 2);
      expect(result?.customVersionLabel).toBe('Manual retranslation');
    });

    it('throws on storage failure', async () => {
      mockStoreByStableId.mockRejectedValue(new Error('quota exceeded'));

      await expect(
        TranslationPersistenceService.createNewVersion(
          'ch1_abc_def',
          baseTranslation,
          baseSettings
        )
      ).rejects.toThrow('quota exceeded');
    });
  });
});

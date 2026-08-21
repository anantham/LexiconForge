import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TranslationPersistenceService } from '../../services/translationPersistenceService';
import { TranslationOps } from '../../services/db/operations';
import type { TranslationResult } from '../../types';
import type { TranslationRecord } from '../../services/db/types';

// Mock TranslationOps since the real ones need a full DB setup
vi.mock('../../services/db/operations', () => ({
  TranslationOps: {
    storeByStableId: vi.fn(),
    getById: vi.fn(),
    update: vi.fn(),
    setActiveByStableId: vi.fn(),
  },
}));

const mockStoreByStableId = vi.mocked(TranslationOps.storeByStableId);
const mockGetById = vi.mocked(TranslationOps.getById);
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
      mockGetById.mockResolvedValue(storedRecord);
      mockUpdate.mockResolvedValue(undefined);

      const result = await TranslationPersistenceService.persistUpdatedTranslation(
        'ch1_abc_def',
        storedRecord,
        baseSettings
      );

      expect(mockGetById).toHaveBeenCalledWith(storedRecord.id);
      expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
        id: storedRecord.id,
        model: storedRecord.model,
        provider: storedRecord.provider,
      }));
      expect(mockStoreByStableId).not.toHaveBeenCalled();
      expect(result).toEqual(storedRecord);
    });

    it('preserves stored provenance when a hydrated result updates an illustration', async () => {
      const hydratedUpdate = {
        ...baseTranslation,
        id: storedRecord.id,
        version: storedRecord.version,
        chapterUrl: storedRecord.chapterUrl,
        provider: undefined,
        model: undefined,
        usageMetrics: {
          ...baseTranslation.usageMetrics,
          provider: 'unknown',
          model: 'unknown',
        },
        suggestedIllustrations: [{
          placementMarker: '[ILLUSTRATION-1]',
          imagePrompt: 'A riverboat at dusk',
          generatedImage: {
            imageData: '',
            requestTime: 187,
            cost: 0,
          },
        }],
      } as any;
      mockGetById.mockResolvedValue(storedRecord);
      mockUpdate.mockResolvedValue(undefined);

      const result = await TranslationPersistenceService.persistUpdatedTranslation(
        storedRecord.stableId!,
        hydratedUpdate,
        { ...baseSettings, model: 'a-different-current-model' }
      );

      expect(mockGetById).toHaveBeenCalledWith(storedRecord.id);
      expect(mockStoreByStableId).not.toHaveBeenCalled();
      expect(mockUpdate).toHaveBeenCalledTimes(1);
      expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
        id: storedRecord.id,
        version: storedRecord.version,
        provider: storedRecord.provider,
        model: storedRecord.model,
        totalTokens: storedRecord.totalTokens,
        suggestedIllustrations: hydratedUpdate.suggestedIllustrations,
      }));
      expect(result?.model).toBe(storedRecord.model);
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
    it('stores the new version already-active, label included, in ONE write', async () => {
      // Echo the repo's real contract: storeByStableId persists the payload
      // (label included) with isActive:true and deactivates siblings.
      mockStoreByStableId.mockImplementation(async (_id: string, payload: any) => ({
        ...storedRecord,
        id: 'tr-uuid-2',
        version: 2,
        isActive: true,
        customVersionLabel: payload.customVersionLabel,
      }));

      const result = await TranslationPersistenceService.createNewVersion(
        'ch1_abc_def',
        baseTranslation,
        baseSettings,
        { versionLabel: 'Manual retranslation' }
      );

      expect(mockStoreByStableId).toHaveBeenCalledWith(
        'ch1_abc_def',
        expect.objectContaining({ customVersionLabel: 'Manual retranslation' }),
        baseSettings
      );
      // The old second pass (setActiveByStableId: full URL-resolve + cursor
      // walk to set flags the store had already set) is deliberately gone.
      expect(mockSetActive).not.toHaveBeenCalled();
      expect(result?.customVersionLabel).toBe('Manual retranslation');
      expect(result?.isActive).toBe(true);
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

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ImageOps } from '../../../services/db/operations';
import { chapterRepository } from '../../../services/db/repositories/instances';
import { translationFacade } from '../../../services/db/repositories/translationFacade';
import type { TranslationRecord } from '../../../services/db/types';

vi.mock('../../../services/db/repositories/instances', () => ({
  chapterRepository: {
    getChapterByStableId: vi.fn(),
    getChapter: vi.fn(),
  },
}));

vi.mock('../../../services/db/repositories/translationFacade', () => ({
  translationFacade: {
    getActiveByStableId: vi.fn(),
    getActiveByUrl: vi.fn(),
    update: vi.fn(),
  },
}));

const mockedChapterRepo = chapterRepository as unknown as {
  getChapterByStableId: ReturnType<typeof vi.fn>;
  getChapter: ReturnType<typeof vi.fn>;
};

const mockedTranslationFacade = translationFacade as unknown as {
  getActiveByStableId: ReturnType<typeof vi.fn>;
  getActiveByUrl: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
};

const baseChapter = {
  url: 'chapter-1',
  stableId: 'chapter-1',
  title: 'Chapter 1',
  content: '<p>Body</p>',
  originalUrl: 'chapter-1',
  nextUrl: null,
  prevUrl: null,
  dateAdded: new Date().toISOString(),
  lastAccessed: new Date().toISOString(),
};

const createTranslation = (
  imageVersionState: Record<string, any>
): TranslationRecord & { imageVersionState?: Record<string, any> } => ({
  id: 'translation-1',
  chapterUrl: baseChapter.url,
  stableId: baseChapter.stableId,
  version: 2,
  translatedTitle: 'Chapter 1 (Translated)',
  translation: '<p>Translated body</p>',
  footnotes: [],
  suggestedIllustrations: [],
  provider: 'OpenRouter',
  model: 'google/gemini-2.5-flash',
  temperature: 0.7,
  systemPrompt: 'system',
  promptId: 'prompt-1',
  promptName: 'Default',
  customVersionLabel: undefined,
  totalTokens: 1200,
  promptTokens: 800,
  completionTokens: 400,
  estimatedCost: 0.0123,
  requestTime: 12.34,
  createdAt: new Date().toISOString(),
  isActive: true,
  settingsSnapshot: {
    provider: 'OpenRouter',
    model: 'google/gemini-2.5-flash',
    temperature: 0.7,
    systemPrompt: 'system',
    promptId: 'prompt-1',
    promptName: 'Default',
  },
  proposal: undefined,
  imageVersionState,
});

beforeEach(() => {
  mockedChapterRepo.getChapterByStableId.mockReset();
  mockedChapterRepo.getChapter.mockReset();
  mockedTranslationFacade.getActiveByStableId.mockReset();
  mockedTranslationFacade.getActiveByUrl.mockReset();
  mockedTranslationFacade.update.mockReset();

  mockedChapterRepo.getChapterByStableId.mockResolvedValue(baseChapter);
  mockedChapterRepo.getChapter.mockResolvedValue(null);
  mockedTranslationFacade.getActiveByUrl.mockResolvedValue(null);
});

describe('ImageOps.deleteImageVersion', () => {
  it('filters object-based versions and updates metadata', async () => {
    const marker = 'ILLUSTRATION-1';
    const translation = createTranslation({
      [marker]: {
        latestVersion: 3,
        activeVersion: 3,
        versions: {
          1: {
            version: 1,
            prompt: 'A',
            generatedAt: new Date('2024-01-01').toISOString(),
          },
          3: {
            version: 3,
            prompt: 'B',
            generatedAt: new Date('2024-01-02').toISOString(),
          },
        },
      },
    });

    mockedTranslationFacade.getActiveByStableId.mockResolvedValue(translation);
    mockedTranslationFacade.update.mockResolvedValue(undefined);

    // deleteImageVersion now reports the post-delete state so callers can adopt
    // the DB's (non-renumbering) semantics instead of re-deriving their own.
    await expect(ImageOps.deleteImageVersion(baseChapter.stableId!, marker, 3)).resolves.toMatchObject({
      markerRemoved: false,
      survivingVersions: [1],
      activeVersion: 1,
      latestVersion: 1,
    });

    expect(mockedTranslationFacade.update).toHaveBeenCalledTimes(1);
    const updated = mockedTranslationFacade.update.mock.calls[0][0] as TranslationRecord & {
      imageVersionState?: Record<string, any>;
    };
    const updatedMarker = updated.imageVersionState?.[marker];
    expect(updatedMarker).toBeDefined();
    expect(Object.keys(updatedMarker.versions)).toEqual(['1']);
    expect(updatedMarker.latestVersion).toBe(1);
    expect(updatedMarker.activeVersion).toBe(1);
  });

  it('deleting a MIDDLE version keeps the original numbers of the survivors (no renumbering)', async () => {
    // The invariant callers must respect: persisted images are keyed by
    // chapterId:marker:version, so deleting v2 of {1,2,3} must leave {1,3} —
    // NOT a renumbered {1,2}. The store used to renumber contiguously, forking
    // from this record and pointing the active version at cache keys that no
    // longer exist.
    const marker = 'ILLUSTRATION-MID';
    const translation = createTranslation({
      [marker]: {
        latestVersion: 3,
        activeVersion: 2,
        versions: {
          1: { version: 1, prompt: 'A', generatedAt: new Date('2024-01-01').toISOString() },
          2: { version: 2, prompt: 'B', generatedAt: new Date('2024-01-02').toISOString() },
          3: { version: 3, prompt: 'C', generatedAt: new Date('2024-01-03').toISOString() },
        },
      },
    });

    mockedTranslationFacade.getActiveByStableId.mockResolvedValue(translation);
    mockedTranslationFacade.update.mockResolvedValue(undefined);

    const result = await ImageOps.deleteImageVersion(baseChapter.stableId!, marker, 2);

    // Return value: survivors keep their identity; the deleted version was the
    // active one, so active falls to the latest survivor (3, an EXISTING number).
    expect(result.markerRemoved).toBe(false);
    expect(result.survivingVersions.sort()).toEqual([1, 3]);
    expect(result.activeVersion).toBe(3);
    expect(result.latestVersion).toBe(3);

    // Persisted record: v2 is gone, v1 and v3 keep their numbers.
    const updated = mockedTranslationFacade.update.mock.calls[0][0] as TranslationRecord & {
      imageVersionState?: Record<string, any>;
    };
    const updatedMarker = updated.imageVersionState?.[marker];
    expect(Object.keys(updatedMarker.versions).sort()).toEqual(['1', '3']);
    expect(updatedMarker.versions['2']).toBeUndefined();
    expect(updatedMarker.activeVersion).toBe(3);
    expect(updatedMarker.latestVersion).toBe(3);
    // The return value and the persisted record must agree (same object state).
    expect(result.markerState).toEqual(updatedMarker);
  });

  it('deleting a middle version that is NOT active leaves the active version untouched', async () => {
    const marker = 'ILLUSTRATION-MID2';
    const translation = createTranslation({
      [marker]: {
        latestVersion: 3,
        activeVersion: 1,
        versions: {
          1: { version: 1, prompt: 'A', generatedAt: new Date('2024-01-01').toISOString() },
          2: { version: 2, prompt: 'B', generatedAt: new Date('2024-01-02').toISOString() },
          3: { version: 3, prompt: 'C', generatedAt: new Date('2024-01-03').toISOString() },
        },
      },
    });

    mockedTranslationFacade.getActiveByStableId.mockResolvedValue(translation);
    mockedTranslationFacade.update.mockResolvedValue(undefined);

    const result = await ImageOps.deleteImageVersion(baseChapter.stableId!, marker, 2);

    expect(result.activeVersion).toBe(1);
    expect(result.survivingVersions.sort()).toEqual([1, 3]);
    expect(result.latestVersion).toBe(3);
  });

  it('keeps placeholder state when deleting the last version', async () => {
    const marker = 'ILLUSTRATION-3';
    const translation = createTranslation({
      [marker]: {
        latestVersion: 1,
        activeVersion: 1,
        versions: {
          1: {
            version: 1,
            prompt: 'only',
            generatedAt: new Date('2024-03-01').toISOString(),
          },
        },
      },
    });

    mockedTranslationFacade.getActiveByStableId.mockResolvedValue(translation);
    mockedTranslationFacade.update.mockResolvedValue(undefined);

    await ImageOps.deleteImageVersion(baseChapter.stableId!, marker, 1);

    const updated = mockedTranslationFacade.update.mock.calls[0][0] as TranslationRecord & {
      imageVersionState?: Record<string, any>;
    };
    const updatedMarker = updated.imageVersionState?.[marker];
    expect(updatedMarker).toBeDefined();
    expect(updatedMarker.latestVersion).toBe(0);
    expect(updatedMarker.activeVersion).toBeNull();
    expect(updatedMarker.versions).toEqual({});
  });

  it('removes marker entirely when no version entries remain', async () => {
    const marker = 'ILLUSTRATION-4';
    const translation = createTranslation({
      [marker]: {
        latestVersion: 0,
        activeVersion: null,
        versions: {},
      },
    });
    translation.suggestedIllustrations = [
      { placementMarker: marker, imagePrompt: 'prompt' } as any,
      { placementMarker: 'KEEP', imagePrompt: 'keep' } as any,
    ];

    mockedTranslationFacade.getActiveByStableId.mockResolvedValue(translation);
    mockedTranslationFacade.update.mockResolvedValue(undefined);

    await ImageOps.deleteImageVersion(baseChapter.stableId!, marker, 1);

    const updated = mockedTranslationFacade.update.mock.calls[0][0] as TranslationRecord & {
      imageVersionState?: Record<string, any>;
      suggestedIllustrations?: any[];
    };
    expect(updated.imageVersionState?.[marker]).toBeUndefined();
    expect(updated.suggestedIllustrations?.some((ill) => ill.placementMarker === marker)).toBe(false);
    expect(updated.suggestedIllustrations?.length).toBe(1);
  });

  it('normalizes legacy array-based versions before deletion', async () => {
    const marker = 'ILLUSTRATION-2';
    const translation = createTranslation({
      [marker]: {
        latestVersion: 2,
        activeVersion: 2,
        versions: [
          {
            version: 1,
            prompt: 'Legacy',
            generatedAt: new Date('2024-02-01').toISOString(),
          },
          {
            version: 2,
            prompt: 'Current',
            generatedAt: new Date('2024-02-02').toISOString(),
          },
        ],
      },
    });

    mockedTranslationFacade.getActiveByStableId.mockResolvedValue(translation);
    mockedTranslationFacade.update.mockResolvedValue(undefined);

    await ImageOps.deleteImageVersion(baseChapter.stableId!, marker, 1);

    const updated = mockedTranslationFacade.update.mock.calls[0][0] as TranslationRecord & {
      imageVersionState?: Record<string, any>;
    };
    const updatedMarker = updated.imageVersionState?.[marker];
    expect(updatedMarker).toBeDefined();
    expect(Array.isArray(updatedMarker.versions)).toBe(false);
    expect(Object.keys(updatedMarker.versions)).toEqual(['2']);
    expect(updatedMarker.latestVersion).toBe(2);
    expect(updatedMarker.activeVersion).toBe(2);
  });
});

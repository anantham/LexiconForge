/**
 * Regression tests for the image-version delete renumbering fork.
 *
 * Pre-fix bug: the DB (ImageOps.deleteImageVersion) keeps ORIGINAL version
 * numbers — deleting v2 of {1,2,3} leaves {1,3} — but the store renumbered
 * contiguously (total-1, active shifted), then persistImageVersionState wrote
 * the STALE in-memory map (still containing the deleted version) back over the
 * DB's correct record. Result: the active version could point at a version
 * number with no persisted image (cache-key lookups miss), and the deleted
 * version was resurrected in the persisted record.
 *
 * Post-fix: the store adopts the DB's post-delete state (survivors keep their
 * numbers, active is always an EXISTING number), syncs the in-memory
 * imageVersionState FROM the DB record, and never persists the stale map back.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppSettings } from '../../../types';
import { createImageSlice, type ImageSlice } from '../../../store/slices/imageSlice';

const { deleteImageVersionMock, removeImageMock, persistMock } = vi.hoisted(() => ({
  deleteImageVersionMock: vi.fn(),
  removeImageMock: vi.fn(),
  persistMock: vi.fn(),
}));

vi.mock('../../../services/db/operations', () => ({
  ImageOps: {
    deleteImageVersion: deleteImageVersionMock,
  },
}));

vi.mock('../../../services/imageCacheService', () => ({
  ImageCacheStore: {
    removeImage: removeImageMock,
    migrateBase64Image: vi.fn(),
  },
}));

vi.mock('../../../services/translationPersistenceService', () => ({
  TranslationPersistenceService: {
    persistUpdatedTranslation: persistMock,
  },
}));

vi.mock('../../../services/imageGenerationService', () => ({
  ImageGenerationService: {
    retryImage: vi.fn(),
    generateImages: vi.fn(),
    loadExistingImages: vi.fn(() => ({})),
  },
}));

vi.mock('../../../utils/debug', () => ({
  debugLog: vi.fn(),
  debugWarn: vi.fn(),
}));

const mockSettings = {
  provider: 'OpenAI',
  model: 'gpt-4o-mini',
  imageModel: 'openrouter/google/gemini-2.5-flash-image',
  temperature: 0.7,
  systemPrompt: '',
} as AppSettings;

const CHAPTER_ID = 'chapter-1';
const MARKER = '[ILLUSTRATION-1]';
const KEY = `${CHAPTER_ID}:${MARKER}`;

type TestState = ImageSlice & {
  chapters: Map<string, any>;
  settings: AppSettings;
  activePromptTemplate: null;
  showNotification: ReturnType<typeof vi.fn>;
};

const makeVersionMeta = (version: number) => ({
  version,
  prompt: `prompt v${version}`,
  generatedAt: new Date(2024, 0, version).toISOString(),
});

const createSlice = (): TestState => {
  const state: Partial<TestState> = {};
  const chapter = {
    id: CHAPTER_ID,
    translationResult: {
      translation: '<p>Body</p>',
      suggestedIllustrations: [{ placementMarker: MARKER, imagePrompt: 'Hero on ridge' }],
      imageVersionState: {
        [MARKER]: {
          latestVersion: 3,
          activeVersion: 2,
          versions: {
            1: makeVersionMeta(1),
            2: makeVersionMeta(2),
            3: makeVersionMeta(3),
          },
        },
      },
    },
  };

  Object.assign(state, {
    chapters: new Map([[chapter.id, chapter]]),
    settings: mockSettings,
    activePromptTemplate: null,
    showNotification: vi.fn(),
  });

  const set = (partial: Partial<TestState> | ((prev: TestState) => Partial<TestState> | void)) => {
    const next = typeof partial === 'function' ? partial(state as TestState) : partial;
    if (!next) return;
    Object.assign(state, next);
  };
  const get = () => state as TestState;
  const api = { setState: set, getState: get, subscribe: () => () => {}, destroy: () => {} } as never;

  Object.assign(state, createImageSlice(set as never, get as never, api));

  // Session-memory maps mirror a hydrated 3-version chapter with v2 active.
  Object.assign(state, {
    imageVersions: { [KEY]: 3 },
    activeImageVersion: { [KEY]: 2 },
  });

  return state as TestState;
};

describe('imageSlice.deleteVersion — adopts the DB non-renumbering semantics', () => {
  beforeEach(() => {
    deleteImageVersionMock.mockReset();
    removeImageMock.mockReset().mockResolvedValue(undefined);
    persistMock.mockReset().mockResolvedValue(undefined);
  });

  it('deleting middle version v2 of {1,2,3}: active becomes an EXISTING number and v2 disappears from the persisted state', async () => {
    const slice = createSlice();

    // DB reports the post-delete state: survivors {1,3}, active fell to 3.
    const markerState = {
      versions: { 1: makeVersionMeta(1), 3: makeVersionMeta(3) },
      activeVersion: 3,
      latestVersion: 3,
    };
    deleteImageVersionMock.mockResolvedValue({
      markerRemoved: false,
      markerState,
      survivingVersions: [1, 3],
      activeVersion: 3,
      latestVersion: 3,
    });

    await slice.deleteVersion(CHAPTER_ID, MARKER, 2);

    // The DB delete was asked for exactly version 2, and the cache entry for
    // v2 (its cache key) was removed — surviving keys stay resolvable.
    expect(deleteImageVersionMock).toHaveBeenCalledWith(CHAPTER_ID, MARKER, 2);
    expect(removeImageMock).toHaveBeenCalledWith({
      chapterId: CHAPTER_ID,
      placementMarker: MARKER,
      version: 2,
    });

    // Active is an EXISTING version number (the old renumbering code set it to
    // 2 — a version that no longer exists — so its cache lookup missed).
    const active = slice.activeImageVersion[KEY];
    expect([1, 3]).toContain(active);
    expect(active).toBe(3);
    // Latest keeps the surviving max, not a renumbered count.
    expect(slice.imageVersions[KEY]).toBe(3);

    // In-memory chapter state was synced FROM the DB record: v2 gone, no
    // renumbering, active pointing at a surviving version.
    const chapterState = slice.chapters.get(CHAPTER_ID)?.translationResult?.imageVersionState?.[MARKER];
    expect(chapterState).toBeDefined();
    expect(Object.keys(chapterState.versions).sort()).toEqual(['1', '3']);
    expect(chapterState.activeVersion).toBe(3);
    expect(chapterState.latestVersion).toBe(3);

    // The stale in-memory map (which still contained v2) must NOT be persisted
    // back over the DB's correct record. The DB write already happened inside
    // ImageOps.deleteImageVersion; no second write is needed.
    expect(persistMock).not.toHaveBeenCalled();
  });

  it('deleting a non-active version keeps the active version untouched', async () => {
    const slice = createSlice();
    slice.activeImageVersion[KEY] = 1;

    const markerState = {
      versions: { 1: makeVersionMeta(1), 3: makeVersionMeta(3) },
      activeVersion: 1,
      latestVersion: 3,
    };
    deleteImageVersionMock.mockResolvedValue({
      markerRemoved: false,
      markerState,
      survivingVersions: [1, 3],
      activeVersion: 1,
      latestVersion: 3,
    });

    await slice.deleteVersion(CHAPTER_ID, MARKER, 2);

    expect(slice.activeImageVersion[KEY]).toBe(1);
    expect(slice.imageVersions[KEY]).toBe(3);
    expect(persistMock).not.toHaveBeenCalled();
  });

  it('deleting the only version clears the marker maps and syncs the emptied DB state', async () => {
    const slice = createSlice();
    // Single-version chapter.
    const chapter = slice.chapters.get(CHAPTER_ID);
    chapter.translationResult.imageVersionState = {
      [MARKER]: { latestVersion: 1, activeVersion: 1, versions: { 1: makeVersionMeta(1) } },
    };
    Object.assign(slice, {
      imageVersions: { [KEY]: 1 },
      activeImageVersion: { [KEY]: 1 },
    });

    deleteImageVersionMock.mockResolvedValue({
      markerRemoved: false,
      markerState: { versions: {}, activeVersion: null, latestVersion: 0 },
      survivingVersions: [],
      activeVersion: null,
      latestVersion: 0,
    });

    await slice.deleteVersion(CHAPTER_ID, MARKER, 1);

    expect(slice.imageVersions[KEY]).toBeUndefined();
    expect(slice.activeImageVersion[KEY]).toBeUndefined();
    const chapterState = slice.chapters.get(CHAPTER_ID)?.translationResult?.imageVersionState?.[MARKER];
    expect(chapterState).toEqual({ versions: {}, activeVersion: null, latestVersion: 0 });
    expect(persistMock).not.toHaveBeenCalled();
  });
});

describe('imageSlice.resetAdvancedControls — copy-on-write (no in-place mutation)', () => {
  it('does not mutate the previous state objects and clears the key in the new state', async () => {
    const slice = createSlice();
    const OTHER_KEY = `${CHAPTER_ID}:[ILLUSTRATION-2]`;

    Object.assign(slice, {
      steeringImages: { [KEY]: 'steer.png', [OTHER_KEY]: 'keep.png' },
      negativePrompts: { [KEY]: 'blurry' },
      guidanceScales: { [KEY]: 5 },
      loraModels: { [KEY]: 'lora-x' },
      loraStrengths: { [KEY]: 0.5 },
    });

    // Capture the ORIGINAL nested map objects.
    const prevSteering = slice.steeringImages;
    const prevNegative = slice.negativePrompts;

    slice.resetAdvancedControls(CHAPTER_ID, MARKER);

    // The originals must be untouched (the old shallow-copy implementation
    // deleted keys from these exact objects, so subscribers holding the old
    // reference saw the data vanish with no re-render).
    expect(prevSteering[KEY]).toBe('steer.png');
    expect(prevNegative[KEY]).toBe('blurry');

    // New state: key removed, references replaced, unrelated keys preserved.
    expect(slice.steeringImages).not.toBe(prevSteering);
    expect(slice.steeringImages[KEY]).toBeUndefined();
    expect(slice.steeringImages[OTHER_KEY]).toBe('keep.png');
    expect(slice.negativePrompts[KEY]).toBeUndefined();
    expect(slice.guidanceScales[KEY]).toBeUndefined();
    expect(slice.loraModels[KEY]).toBeUndefined();
    expect(slice.loraStrengths[KEY]).toBeUndefined();
  });
});

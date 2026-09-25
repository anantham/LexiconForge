/**
 * The real generateIllustrationForSelection action (TEST-01): the selected
 * text gets a marker in the chapter's translation plus a matching illustration
 * entry, and a rejected planning call leaves the chapter untouched.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { create } from 'zustand';

const planIllustration = vi.hoisted(() => vi.fn());
vi.mock('../../../services/illustrationService', () => ({
  IllustrationService: { generateIllustrationForSelection: planIllustration },
}));

const persist = vi.hoisted(() => vi.fn());
vi.mock('../../../services/translationPersistenceService', () => ({
  TranslationPersistenceService: { persistUpdatedTranslation: persist },
}));

import { createTranslationsSlice } from '../../../store/slices/translationsSlice';

const CHAPTER_ID = 'ch-1';
const TRANSLATION = '<p>The knight <em>raised</em> his sword.</p>';

const createStore = () => {
  const chapter = {
    id: CHAPTER_ID,
    translationResult: {
      translation: TRANSLATION,
      suggestedIllustrations: [{ placementMarker: '[ILLUSTRATION-1]', imagePrompt: 'existing' }],
    },
  };
  const store = create<any>()((set, get, api) => ({
    ...createTranslationsSlice(set as any, get as any, api as any),
    chapters: new Map([[CHAPTER_ID, chapter]]),
    settings: { provider: 'Gemini', model: 'gemini-2.5-flash', imageModel: 'none' },
    activePromptTemplate: null,
    showNotification: vi.fn(),
    handleRetryImage: vi.fn(),
    updateChapter: (id: string, patch: object) => set((state: any) => {
      const chapters = new Map(state.chapters);
      chapters.set(id, { ...(chapters.get(id) as object), ...patch });
      return { chapters };
    }),
  }));
  return store;
};

const translationOf = (store: ReturnType<typeof createStore>) =>
  store.getState().chapters.get(CHAPTER_ID).translationResult;

beforeEach(() => {
  planIllustration.mockReset();
  persist.mockReset().mockResolvedValue(null);
});

describe('generateIllustrationForSelection', () => {
  it('marks the selected text and records the next illustration', async () => {
    planIllustration.mockResolvedValue({ imagePrompt: 'a knight lifts a blade', imagePlan: undefined });
    const store = createStore();

    await store.getState().generateIllustrationForSelection(CHAPTER_ID, 'The knight raised');

    const result = translationOf(store);
    expect(result.translation).toBe('<p>The knight <em>raised [ILLUSTRATION-2]</em> his sword.</p>');
    expect(result.suggestedIllustrations.map((i: any) => i.placementMarker)).toEqual(['[ILLUSTRATION-1]', '[ILLUSTRATION-2]']);
    expect(result.suggestedIllustrations[1].imagePrompt).toBe('a knight lifts a blade');
    expect(persist).toHaveBeenCalledWith(CHAPTER_ID, expect.objectContaining({ translation: result.translation }), expect.anything());
  });

  it('leaves the chapter untouched when illustration planning is rejected', async () => {
    planIllustration.mockResolvedValue(null);
    const store = createStore();
    const before = translationOf(store);

    await store.getState().generateIllustrationForSelection(CHAPTER_ID, 'The knight raised');

    expect(translationOf(store)).toBe(before);
    expect(persist).not.toHaveBeenCalled();
    expect(store.getState().showNotification).toHaveBeenCalledWith('Failed to generate illustration prompt', 'error');
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AppSettings, ImagePlan } from '../../../types';
import { createImageSlice, type ImageSlice } from '../../../store/slices/imageSlice';

const { generateImagePlanFromCaptionMock, persistUpdatedTranslationMock } = vi.hoisted(() => ({
  generateImagePlanFromCaptionMock: vi.fn(),
  persistUpdatedTranslationMock: vi.fn(),
}));

vi.mock('../../../services/imagePlanPlanner', () => ({
  generateImagePlanFromCaption: generateImagePlanFromCaptionMock,
}));

vi.mock('../../../services/translationPersistenceService', () => ({
  TranslationPersistenceService: {
    persistUpdatedTranslation: persistUpdatedTranslationMock,
  },
}));

vi.mock('../../../utils/debug', () => ({
  debugLog: vi.fn(),
}));

type TestState = ImageSlice & {
  chapters: Map<string, any>;
  settings: AppSettings;
  activePromptTemplate: null;
  updateChapter: (chapterId: string, updates: Record<string, unknown>) => void;
  showNotification: ReturnType<typeof vi.fn>;
};

const mockSettings: AppSettings = {
  contextDepth: 0,
  preloadCount: 0,
  fontSize: 16,
  fontStyle: 'sans',
  lineHeight: 1.4,
  systemPrompt: '',
  provider: 'OpenAI',
  model: 'gpt-4o-mini',
  imageModel: 'openrouter/google/gemini-2.5-flash-image',
  temperature: 0.7,
};

const autoPlan: ImagePlan = {
  subject: 'Refined scene subject',
  characters: ['hero'],
  scene: 'Stormy mountain ridge.',
  composition: 'Wide shot.',
  camera: 'Low angle.',
  lighting: 'Cold lightning.',
  style: 'Painterly fantasy.',
  mood: 'Tense.',
  details: ['wind-blown cloak'],
  mustKeep: ['hero'],
  avoid: ['daylight'],
  negativePrompt: ['watermark'],
};

const createSlice = (illustrationOverrides: Record<string, unknown> = {}): TestState => {
  const state: Partial<TestState> = {};
  const chapter = {
    id: 'chapter-1',
    translationResult: {
      translation: '<p>Storm clouds gathered over the ridge.</p>',
      suggestedIllustrations: [
        {
          placementMarker: '[ILLUSTRATION-1]',
          imagePrompt: 'Hero on a mountain ridge',
          imagePlan: autoPlan,
          imagePlanMode: 'auto',
          imagePlanSourceCaption: 'Hero on a mountain ridge',
          ...illustrationOverrides,
        },
      ],
    },
  };

  Object.assign(state, {
    chapters: new Map([[chapter.id, chapter]]),
    settings: mockSettings,
    activePromptTemplate: null,
    showNotification: vi.fn(),
    updateChapter: (chapterId: string, updates: Record<string, unknown>) => {
      const current = (state.chapters as Map<string, any>).get(chapterId);
      if (!current) return;
      (state.chapters as Map<string, any>).set(chapterId, {
        ...current,
        ...updates,
      });
    },
  });

  const set = (partial: Partial<TestState> | ((prev: TestState) => Partial<TestState> | void)) => {
    const next = typeof partial === 'function' ? partial(state as TestState) : partial;
    if (!next) return;
    Object.assign(state, next);
  };
  const get = () => state as TestState;
  const api = {
    setState: set,
    getState: get,
    subscribe: () => () => {},
    destroy: () => {},
  };

  Object.assign(state, createImageSlice(set as any, get as any, api as any));
  return state as TestState;
};

describe('imageSlice image planning', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    persistUpdatedTranslationMock.mockResolvedValue(undefined);
    generateImagePlanFromCaptionMock.mockResolvedValue({
      imagePrompt: 'Ignored refined caption',
      imagePlan: autoPlan,
      source: 'model',
    });
  });

  it('regenerates auto plans from caption edits', async () => {
    const slice = createSlice();

    await slice.updateIllustrationPrompt('chapter-1', '[ILLUSTRATION-1]', 'Hero under lightning');

    expect(generateImagePlanFromCaptionMock).toHaveBeenCalledWith(
      'Hero under lightning',
      mockSettings,
      expect.objectContaining({
        context: '<p>Storm clouds gathered over the ridge.</p>',
      })
    );

    const updated = slice.chapters.get('chapter-1')?.translationResult?.suggestedIllustrations?.[0];
    expect(updated.imagePrompt).toBe('Hero under lightning');
    expect(updated.imagePlan).toEqual(autoPlan);
    expect(updated.imagePlanMode).toBe('auto');
    expect(updated.imagePlanSourceCaption).toBe('Hero under lightning');
  });

  it('preserves manual plans when only the human-facing caption changes', async () => {
    const manualPlan: ImagePlan = {
      ...autoPlan,
      subject: 'Manual JSON subject',
    };
    const slice = createSlice({
      imagePlan: manualPlan,
      imagePlanMode: 'manual',
      imagePlanSourceCaption: 'Original caption',
    });

    await slice.updateIllustrationPrompt('chapter-1', '[ILLUSTRATION-1]', 'New reader-facing caption');

    expect(generateImagePlanFromCaptionMock).not.toHaveBeenCalled();
    const updated = slice.chapters.get('chapter-1')?.translationResult?.suggestedIllustrations?.[0];
    expect(updated.imagePrompt).toBe('New reader-facing caption');
    expect(updated.imagePlan).toEqual(manualPlan);
    expect(updated.imagePlanMode).toBe('manual');
    expect(updated.imagePlanSourceCaption).toBe('Original caption');
  });

  it('lets the AI regenerate JSON from the current caption and return ownership to auto mode', async () => {
    const manualPlan: ImagePlan = {
      ...autoPlan,
      subject: 'Manual JSON subject',
    };
    const slice = createSlice({
      imagePlan: manualPlan,
      imagePlanMode: 'manual',
      imagePlanSourceCaption: 'Older caption',
    });

    await slice.regenerateIllustrationPlanFromCaption('chapter-1', '[ILLUSTRATION-1]');

    expect(generateImagePlanFromCaptionMock).toHaveBeenCalledWith(
      'Hero on a mountain ridge',
      mockSettings,
      expect.objectContaining({
        context: '<p>Storm clouds gathered over the ridge.</p>',
      })
    );

    const updated = slice.chapters.get('chapter-1')?.translationResult?.suggestedIllustrations?.[0];
    expect(updated.imagePlan).toEqual(autoPlan);
    expect(updated.imagePlanMode).toBe('auto');
    expect(updated.imagePlanSourceCaption).toBe('Hero on a mountain ridge');
    expect(slice.showNotification).toHaveBeenCalledWith('JSON plan regenerated from caption.', 'success');
  });
});

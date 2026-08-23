import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppSettings } from '../../../types';
import type { DiffResult } from '../../../services/diff/types';
import { defaultSettings } from '../../../services/sessionManagementService';
import { createMockAppSettings } from '../../utils/test-data';

const mocks = vi.hoisted(() => ({
  settings: {} as AppSettings,
  get: vi.fn(),
  findByHashes: vi.fn(),
  save: vi.fn(),
  createAdapter: vi.fn(),
}));

vi.mock('../../../store', () => ({
  useAppStore: {
    getState: () => ({ settings: mocks.settings }),
  },
}));

vi.mock('../../../services/db/operations', () => ({
  DiffOps: {
    get: (...args: unknown[]) => mocks.get(...args),
    findByHashes: (...args: unknown[]) => mocks.findByHashes(...args),
    save: (...args: unknown[]) => mocks.save(...args),
  },
}));

vi.mock('../../../services/diff/SimpleLLMAdapter', () => ({
  createSimpleLLMAdapter: (...args: unknown[]) => mocks.createAdapter(...args),
}));

import { DiffAnalysisService } from '../../../services/diff/DiffAnalysisService';
import {
  cleanupDiffTriggerService,
  handleTranslationComplete,
} from '../../../services/diff/DiffTriggerService';

const cachedResult: DiffResult = {
  chapterId: 'chapter-1',
  aiVersionId: 'ai-version-1',
  fanVersionId: null,
  rawVersionId: 'raw-version-1',
  algoVersion: '1.0.0',
  aiHash: 'ai-hash',
  fanHash: null,
  rawHash: 'raw-hash',
  markers: [],
  analyzedAt: 1,
  costUsd: 0,
  model: 'openai/gpt-4o-mini',
};

const translationCompleteEvent = () => new CustomEvent('translation:complete', {
  detail: {
    chapterId: 'chapter-1',
    aiTranslation: 'AI translation',
    fanTranslation: null,
    rawText: 'Raw text',
  },
});

describe('DiffTriggerService credential boundary', () => {
  beforeEach(() => {
    cleanupDiffTriggerService();
    mocks.settings = createMockAppSettings({
      ...defaultSettings,
      showDiffHeatmap: true,
      apiKeyOpenRouter: '',
    });
    mocks.get.mockReset().mockResolvedValue(null);
    mocks.findByHashes.mockReset().mockResolvedValue(null);
    mocks.save.mockReset().mockResolvedValue(undefined);
    mocks.createAdapter.mockReset().mockReturnValue({ translate: vi.fn() });
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not analyze or persist an uncached placeholder without a Settings key', async () => {
    const analyzeSpy = vi.spyOn(DiffAnalysisService.prototype, 'analyzeDiff');

    await handleTranslationComplete(translationCompleteEvent());

    expect(mocks.findByHashes).toHaveBeenCalledOnce();
    expect(mocks.createAdapter).not.toHaveBeenCalled();
    expect(analyzeSpy).not.toHaveBeenCalled();
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it('still serves a valid cache entry without a Settings key', async () => {
    mocks.findByHashes.mockResolvedValueOnce(cachedResult);
    const analyzeSpy = vi.spyOn(DiffAnalysisService.prototype, 'analyzeDiff');
    const updatedListener = vi.fn();
    window.addEventListener('diff:updated', updatedListener);

    await handleTranslationComplete(translationCompleteEvent());

    expect(updatedListener).toHaveBeenCalledOnce();
    expect(analyzeSpy).not.toHaveBeenCalled();
    expect(mocks.save).not.toHaveBeenCalled();
    window.removeEventListener('diff:updated', updatedListener);
  });

  it('honors a key removal that occurs while awaiting the cache lookup', async () => {
    mocks.settings = createMockAppSettings({
      ...defaultSettings,
      showDiffHeatmap: true,
      apiKeyOpenRouter: 'key-removed-during-cache-read',
    });
    mocks.findByHashes.mockImplementationOnce(async () => {
      mocks.settings = createMockAppSettings({
        ...defaultSettings,
        showDiffHeatmap: true,
        apiKeyOpenRouter: '',
      });
      return null;
    });
    const analyzeSpy = vi.spyOn(DiffAnalysisService.prototype, 'analyzeDiff');

    await handleTranslationComplete(translationCompleteEvent());

    expect(mocks.createAdapter).not.toHaveBeenCalled();
    expect(analyzeSpy).not.toHaveBeenCalled();
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it('creates a request-local analyzer and saves its result when a key exists', async () => {
    mocks.settings = createMockAppSettings({
      ...defaultSettings,
      showDiffHeatmap: true,
      apiKeyOpenRouter: 'settings-openrouter-key',
      openRouterTextEndpoint: 'deepinfra',
    });
    const analyzeSpy = vi
      .spyOn(DiffAnalysisService.prototype, 'analyzeDiff')
      .mockResolvedValueOnce(cachedResult);

    await handleTranslationComplete(translationCompleteEvent());

    expect(mocks.createAdapter).toHaveBeenCalledWith('settings-openrouter-key', {
      only: ['deepinfra'],
      allow_fallbacks: false,
      data_collection: 'deny',
      zdr: true,
    });
    expect(analyzeSpy).toHaveBeenCalledOnce();
    expect(mocks.save).toHaveBeenCalledWith(cachedResult);
  });
});

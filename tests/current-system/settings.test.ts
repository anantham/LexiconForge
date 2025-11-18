import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useAppStore } from '../../store';
import { defaultSettings } from '../../services/sessionManagementService';
import { createMockStorage, applyStorageMock } from '../utils/storage-mocks';
import type { EnhancedChapter } from '../../services/stableIdService';
import type { AppSettings, TranslationResult } from '../../types';

const resetStoreState = () => {
  useAppStore.setState({
    chapters: new Map(),
    novels: new Map(),
    currentChapterId: null,
    navigationHistory: [],
    urlIndex: new Map(),
    rawUrlIndex: new Map(),
    settings: { ...defaultSettings },
  });
};

type Snapshot = Pick<AppSettings, 'provider' | 'model' | 'systemPrompt' | 'temperature'>;

const makeChapter = (id: string, url: string, snapshot: Snapshot): EnhancedChapter => ({
  id,
  title: `Chapter ${id}`,
  content: 'Translated text',
  originalUrl: url,
  canonicalUrl: url,
  nextUrl: null,
  prevUrl: null,
  sourceUrls: [url],
  translationResult: {
    translatedTitle: 'Translated Title',
    translation: 'Translated content.',
    proposal: null,
    footnotes: [],
    suggestedIllustrations: [],
    usageMetrics: {
      totalTokens: 0,
      promptTokens: 0,
      completionTokens: 0,
      estimatedCost: 0,
      requestTime: 0,
      provider: snapshot.provider,
      model: snapshot.model,
    },
  } as TranslationResult,
  translationSettingsSnapshot: snapshot,
  feedback: [],
});

describe('Settings slice integration', () => {
  const storage = createMockStorage();

  beforeEach(() => {
    applyStorageMock(storage);
    storage.setItem.mockClear();
    resetStoreState();
    vi.clearAllMocks();
  });

  afterEach(() => {
    resetStoreState();
  });

  it('persists settings updates to localStorage', () => {
    const store = useAppStore.getState();
    const partial = {
      provider: 'OpenAI' as const,
      model: 'gpt-5-mini',
      temperature: 0.8,
      contextDepth: 4,
      apiKeyOpenAI: 'sk-test',
      systemPrompt: 'Custom system prompt',
    };

    store.updateSettings(partial);

    expect(storage.setItem).toHaveBeenCalledWith(
      'app-settings',
      expect.stringContaining('"provider":"OpenAI"')
    );

    const payload = JSON.parse(storage.setItem.mock.calls[0][1]);
    expect(payload.provider).toBe('OpenAI');
    expect(payload.model).toBe('gpt-5-mini');
    expect(payload.temperature).toBe(0.8);
    expect(payload.contextDepth).toBe(4);
    expect(payload.apiKeyOpenAI).toBe('sk-test');
    expect(payload.systemPrompt).toBe('Custom system prompt');
  });

  it('loads stored settings when requested', () => {
    const stored = {
      ...defaultSettings,
      provider: 'DeepSeek' as const,
      model: 'deepseek-chat',
      temperature: 0.2,
      contextDepth: 5,
      apiKeyDeepSeek: 'stored-key',
      systemPrompt: 'Stored prompt',
    };
    storage.data['app-settings'] = JSON.stringify(stored);

    useAppStore.getState().loadSettings();

    const updated = useAppStore.getState().settings;
    expect(updated.provider).toBe('DeepSeek');
    expect(updated.model).toBe('deepseek-chat');
    expect(updated.temperature).toBe(0.2);
    expect(updated.contextDepth).toBe(5);
    expect(updated.apiKeyDeepSeek).toBe('stored-key');
    expect(updated.systemPrompt).toBe('Stored prompt');
  });

  it('falls back to defaults when no stored settings exist', () => {
    delete storage.data['app-settings'];
    useAppStore.getState().loadSettings();
    const settings = useAppStore.getState().settings;
    expect(settings.provider).toBe(defaultSettings.provider);
    expect(settings.model).toBe(defaultSettings.model);
    expect(settings.temperature).toBe(defaultSettings.temperature);
    expect(settings.contextDepth).toBe(defaultSettings.contextDepth);
    expect(settings.systemPrompt).toBe(defaultSettings.systemPrompt);
  });

  it('detects translation-relevant setting changes', () => {
    const chapterId = 'stable-1';
    const url = 'https://example.com/ch1';
    const snapshot: Snapshot = {
      provider: 'Gemini',
      model: 'gemini-2.5-flash',
      systemPrompt: defaultSettings.systemPrompt,
      temperature: 0.3,
    };

    useAppStore.setState({
      chapters: new Map([[chapterId, makeChapter(chapterId, url, snapshot)]]),
    });
    useAppStore.setState(state => ({
      settings: { ...state.settings, ...snapshot },
    }));

    expect(useAppStore.getState().hasTranslationSettingsChanged(chapterId)).toBe(false);

    useAppStore.getState().updateSettings({ provider: 'OpenAI' });
    expect(useAppStore.getState().hasTranslationSettingsChanged(chapterId)).toBe(true);

    const updatedSnapshot: Snapshot = { ...snapshot, provider: 'OpenAI', model: 'gpt-5-mini' };
    useAppStore.setState({
      chapters: new Map([[chapterId, makeChapter(chapterId, url, updatedSnapshot)]]),
    });
    useAppStore.setState(state => ({
      settings: {
        ...state.settings,
        provider: 'OpenAI',
        model: 'gpt-5-mini',
        systemPrompt: snapshot.systemPrompt,
        temperature: 0.3,
      },
    }));
    expect(useAppStore.getState().hasTranslationSettingsChanged(chapterId)).toBe(false);

    useAppStore.getState().updateSettings({ systemPrompt: 'Adjusted prompt' });
    expect(useAppStore.getState().hasTranslationSettingsChanged(chapterId)).toBe(true);
  });

  it('continues working when localStorage fails', () => {
    const originalSetItem = window.localStorage.setItem;
    window.localStorage.setItem = () => {
      const err = new Error('QuotaExceededError');
      err.name = 'QuotaExceededError';
      throw err;
    };

    expect(() => useAppStore.getState().updateSettings({ systemPrompt: 'Still updates in memory' })).not.toThrow();
    expect(useAppStore.getState().settings.systemPrompt).toBe('Still updates in memory');

    window.localStorage.setItem = originalSetItem;
  });
});

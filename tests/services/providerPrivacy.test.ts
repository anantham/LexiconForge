import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppSettings } from '../../types';
import { createMockAppSettings } from '../utils/test-data';

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  settings: {} as AppSettings,
  findByHashes: vi.fn(),
  save: vi.fn(),
  recordMetric: vi.fn(),
}));

// Inject the mock into the real SDK: OpenAI 4's externalized node-fetch does not
// use global fetch. Native Google/Anthropic SDK transports use the global mock.
vi.mock('openai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('openai')>();
  class MockTransportOpenAI extends actual.OpenAI {
    constructor(options: ConstructorParameters<typeof actual.OpenAI>[0]) {
      super({ ...options, fetch: mocks.fetch, maxRetries: 0 });
    }
  }
  return { ...actual, default: MockTransportOpenAI, OpenAI: MockTransportOpenAI };
});
vi.mock('../../services/ai/cost', () => ({ calculateCost: vi.fn(async () => 0) }));
vi.mock('../../services/rateLimitService', () => ({ rateLimitService: { acquireRequestSlot: vi.fn(async () => undefined) } }));
vi.mock('../../services/apiMetricsService', () => ({ apiMetricsService: { recordMetric: mocks.recordMetric } }));
vi.mock('../../store', () => ({ useAppStore: { getState: () => ({ settings: mocks.settings }) } }));
vi.mock('../../services/db/operations', () => ({
  DiffOps: {
    get: vi.fn(async () => null),
    findByHashes: mocks.findByHashes,
    save: mocks.save,
  },
}));

import { ComparisonService } from '../../services/comparisonService';
import { ExplanationService } from '../../services/explanationService';
import { cleanupDiffTriggerService, handleTranslationComplete } from '../../services/diff/DiffTriggerService';

const routes = [
  { provider: 'OpenAI', model: 'gpt-4o-mini', keyField: 'apiKeyOpenAI', host: 'api.openai.com', path: '/v1/chat/completions' },
  { provider: 'DeepSeek', model: 'deepseek-chat', keyField: 'apiKeyDeepSeek', host: 'api.deepseek.com', path: '/v1/chat/completions' },
  { provider: 'Gemini', model: 'gemini-2.0-flash', keyField: 'apiKeyGemini', host: 'generativelanguage.googleapis.com', path: '/v1beta/models/gemini-2.0-flash:generateContent' },
  { provider: 'Claude', model: 'claude-sonnet-4-20250514', keyField: 'apiKeyClaude', host: 'api.anthropic.com', path: '/v1/messages' },
  { provider: 'OpenRouter', model: 'openai/gpt-4o-mini', keyField: 'apiKeyOpenRouter', host: 'openrouter.ai', path: '/api/v1/chat/completions' },
] as const;

const settingsFor = (route: typeof routes[number]) => createMockAppSettings({
  provider: route.provider,
  model: route.model,
  showDiffHeatmap: true,
  apiKeyOpenAI: 'synthetic-openai-key',
  apiKeyDeepSeek: 'synthetic-deepseek-key',
  apiKeyGemini: 'synthetic-gemini-key',
  apiKeyClaude: 'synthetic-claude-key',
  apiKeyOpenRouter: 'synthetic-openrouter-key',
  openRouterTextEndpoint: 'saved-endpoint',
});

const contentFor = (feature: string) => feature === 'explanation'
  ? 'An explanation from the selected provider.'
  : feature === 'comparison' ? '{"fanExcerpt":"Compared excerpt"}' : '{"markers":[]}';

const invoke = async (feature: string, settings: AppSettings) => {
  if (feature === 'comparison') {
    return ComparisonService.requestFocusedComparison({
      chapterId: 'synthetic-chapter',
      selectedTranslation: 'Synthetic selection',
      fullTranslation: 'Synthetic translation',
      fullFanTranslation: 'Synthetic fan translation',
      fullRawText: 'Synthetic source',
      settings,
    });
  }
  if (feature === 'explanation') {
    return ExplanationService.generateExplanationFootnote(
      'Synthetic source', 'Synthetic translation', 'Synthetic selection', settings,
    );
  }
  mocks.settings = settings;
  return handleTranslationComplete(new CustomEvent('translation:complete', {
    detail: {
      chapterId: 'synthetic-chapter',
      aiTranslation: 'Synthetic translation',
      fanTranslation: 'Synthetic fan translation',
      rawText: 'Synthetic source',
      // Stale metadata is deliberately a different recipient and model.
      preferredProvider: settings.provider === 'OpenRouter' ? 'Gemini' : 'OpenRouter',
      preferredModel: 'stale-unselected-model',
    },
  }));
};

const requestedUrl = () => {
  const request = mocks.fetch.mock.calls[0][0];
  return new URL(typeof request === 'string' ? request : request instanceof URL ? request.href : request.url);
};

const requestBody = () => JSON.parse(mocks.fetch.mock.calls[0][1].body as string);

beforeEach(() => {
  cleanupDiffTriggerService();
  mocks.fetch.mockReset();
  mocks.findByHashes.mockReset().mockResolvedValue(null);
  mocks.save.mockReset().mockResolvedValue(undefined);
  mocks.recordMetric.mockReset().mockResolvedValue(undefined);
  vi.stubGlobal('fetch', mocks.fetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe.each(['comparison', 'explanation', 'diff'])('%s recipient boundary', (feature) => {
  it.each(routes)('sends only to selected $provider endpoint with its Settings key', async (route) => {
    const content = contentFor(feature);
    mocks.fetch.mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content } }],
      model: route.model,
      content: [{ type: 'text', text: content }],
      candidates: [{ content: { parts: [{ text: content }] }, finishReason: 'STOP' }],
    }), { status: 200, headers: { 'content-type': 'application/json' } }));

    const settings = settingsFor(route);
    const result = await invoke(feature, settings);

    expect(mocks.fetch).toHaveBeenCalledOnce();
    expect(requestedUrl().host).toBe(route.host);
    expect(requestedUrl().pathname).toBe(route.path);
    const request = mocks.fetch.mock.calls[0][1];
    const headers = new Headers(request.headers);
    const auth = headers.get('authorization') || headers.get('x-api-key') || headers.get('x-goog-api-key');
    expect(auth || requestedUrl().searchParams.get('key')).toContain(settings[route.keyField]);
    const body = requestBody();
    if (route.provider !== 'Gemini') expect(body.model).toBe(route.model);
    expect(JSON.stringify(body)).toContain('Synthetic source');
    expect(JSON.stringify(body)).toContain('Synthetic translation');
    expect(JSON.stringify(body)).not.toContain('stale-unselected-model');
    if (route.provider === 'OpenRouter') {
      expect(body.provider).toMatchObject({ only: ['saved-endpoint'], allow_fallbacks: false, data_collection: 'deny', zdr: true });
    } else {
      expect(body).not.toHaveProperty('provider');
    }
    if (feature === 'explanation') {
      expect(result).toBe(content);
      expect(body).not.toHaveProperty('response_format');
      if (route.provider === 'Gemini') expect(body.generationConfig.responseMimeType).toBe('text/plain');
    } else if (feature === 'comparison') {
      expect(result).toMatchObject({ fanExcerpt: 'Compared excerpt' });
    } else {
      expect(mocks.save).toHaveBeenCalledOnce();
    }
  });

  it.each(routes)('does not use another configured key when $provider key is missing', async (route) => {
    const settings = settingsFor(route);
    settings[route.keyField] = '  ';
    if (feature === 'comparison') {
      await expect(invoke(feature, settings)).rejects.toThrow(`API key for ${route.provider} is missing`);
    } else {
      await invoke(feature, settings);
    }
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it.each(routes)('does not change recipient after $provider rejects the request', async (route) => {
    mocks.fetch.mockImplementation(async () => new Response(JSON.stringify({
      error: { message: 'Synthetic unauthorized request', status: 'UNAUTHENTICATED' },
    }), { status: 401, headers: { 'content-type': 'application/json' } }));
    const settings = settingsFor(route);
    if (feature === 'comparison') {
      await expect(invoke(feature, settings)).rejects.toThrow();
    } else {
      await invoke(feature, settings);
    }
    expect(mocks.fetch).toHaveBeenCalledOnce();
    expect(requestedUrl().host).toBe(route.host);
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it('fails closed on an unrecognized selected provider', async () => {
    const settings = settingsFor(routes[0]);
    settings.provider = 'unrecognized' as AppSettings['provider'];
    if (feature === 'comparison') {
      await expect(invoke(feature, settings)).rejects.toThrow('Provider not registered');
    } else {
      await invoke(feature, settings);
    }
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(mocks.save).not.toHaveBeenCalled();
  });
});

it('does not make a diff request when the feature is disabled', async () => {
  await invoke('diff', { ...settingsFor(routes[0]), showDiffHeatmap: false });
  expect(mocks.findByHashes).not.toHaveBeenCalled();
  expect(mocks.fetch).not.toHaveBeenCalled();
});

it('does not retry malformed diff JSON with an unselected default model', async () => {
  mocks.fetch.mockResolvedValue(new Response(JSON.stringify({
    choices: [{ message: { content: 'invalid JSON' } }],
  }), { status: 200, headers: { 'content-type': 'application/json' } }));
  await invoke('diff', settingsFor(routes[0]));
  expect(mocks.fetch).toHaveBeenCalledOnce();
  expect(requestedUrl().host).toBe('api.openai.com');
  expect(requestBody().model).toBe('gpt-4o-mini');
  expect(mocks.save).not.toHaveBeenCalled();
});

it('uses the latest Settings recipient after an asynchronous diff cache lookup', async () => {
  const latestSettings = settingsFor(routes[2]);
  mocks.findByHashes.mockImplementationOnce(async () => {
    mocks.settings = latestSettings;
    return null;
  });
  mocks.fetch.mockResolvedValue(new Response(JSON.stringify({
    candidates: [{ content: { parts: [{ text: '{"markers":[]}' }] }, finishReason: 'STOP' }],
  }), { status: 200, headers: { 'content-type': 'application/json' } }));
  await invoke('diff', settingsFor(routes[0]));
  expect(mocks.fetch).toHaveBeenCalledOnce();
  expect(requestedUrl().host).toBe('generativelanguage.googleapis.com');
  expect(mocks.save).toHaveBeenCalledOnce();
});

it('honors a diff disable that occurs during the asynchronous cache lookup', async () => {
  mocks.findByHashes.mockImplementationOnce(async () => {
    mocks.settings = { ...mocks.settings, showDiffHeatmap: false };
    return null;
  });
  await invoke('diff', settingsFor(routes[0]));
  expect(mocks.fetch).not.toHaveBeenCalled();
  expect(mocks.save).not.toHaveBeenCalled();
});

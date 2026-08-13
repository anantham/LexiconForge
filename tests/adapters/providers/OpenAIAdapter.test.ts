import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { AppSettings } from '../../../types';
import type { TranslationRequest } from '../../../services/translate/Translator';
import { OpenAIAdapter } from '../../../adapters/providers/OpenAIAdapter';
import { createMockAppSettings } from '../../utils/test-data';

const openAiMocks = vi.hoisted(() => {
  const create = vi.fn();
  const ctor = vi.fn();
  class OpenAI {
    chat = {
      completions: {
        create: (...args: any[]) => create(...args),
      },
    };
    constructor(...args: any[]) {
      ctor(...args);
    }
  }
  return { OpenAI, create, ctor };
});

vi.mock('openai', () => ({ __esModule: true, default: openAiMocks.OpenAI }));

const supportsStructuredOutputsMock = vi.fn().mockResolvedValue(true);
const supportsParametersMock = vi.fn().mockResolvedValue(true);
// Source-aware capability answer (integrity item 1). Default: metadata-backed, driven by the
// boolean mock so existing tests keep controlling supported-ness with one knob.
type CapabilitySupportAnswer = { supported: boolean; source: 'metadata' | 'default-error' | 'default-miss' };
const getStructuredOutputsSupportMock = vi.fn(async (...args: any[]): Promise<CapabilitySupportAnswer> => ({
  supported: await supportsStructuredOutputsMock(...args),
  source: 'metadata',
}));
const recordParameterFailureMock = vi.fn();

vi.mock('../../../services/capabilityService', () => ({
  supportsStructuredOutputs: (...args: any[]) => supportsStructuredOutputsMock(...args),
  getStructuredOutputsSupport: (...args: any[]) => getStructuredOutputsSupportMock(...args),
  supportsParameters: (...args: any[]) => supportsParametersMock(...args),
  // Added when OpenAIAdapter started recording per-parameter rejection
  // failures (so future calls skip the offending param).
  recordParameterFailure: (...args: any[]) => recordParameterFailureMock(...args),
  hasRecordedParameterFailure: vi.fn(() => false),
}));

const rateLimitMock = vi.fn().mockResolvedValue(undefined);

vi.mock('../../../services/rateLimitService', () => ({
  rateLimitService: {
    acquireRequestSlot: (...args: any[]) => rateLimitMock(...args),
  },
}));

const calculateCostMock = vi.fn().mockResolvedValue(0.42);
vi.mock('../../../services/ai/cost', () => ({
  calculateCost: (...args: any[]) => calculateCostMock(...args),
}));

const recordMetricMock = vi.fn().mockResolvedValue(undefined);
vi.mock('../../../services/apiMetricsService', () => ({
  apiMetricsService: {
    recordMetric: (...args: any[]) => recordMetricMock(...args),
  },
}));

const baseSettings: AppSettings = createMockAppSettings({
  provider: 'OpenAI',
  model: 'gpt-4o',
  systemPrompt: 'Translate text.',
  temperature: 0.7,
  apiKeyOpenAI: 'user-openai-key',
  apiKeyGemini: '',
  apiKeyDeepSeek: '',
  apiKeyOpenRouter: 'user-openrouter-key',
});

// Use realistic translation length to avoid triggering corruption detection
const realisticTranslation = 'This is a properly translated chapter with enough content to pass validation checks. The story continues with the protagonist facing new challenges.';

const successResponse = {
  choices: [{
    finish_reason: 'stop',
    message: { content: JSON.stringify({ translatedTitle: 'Chapter Title', translation: realisticTranslation }) },
  }],
  usage: { prompt_tokens: 12, completion_tokens: 5 },
};

describe('OpenAIAdapter processResponse', () => {
  beforeEach(() => {
    calculateCostMock.mockClear();
    recordMetricMock.mockClear();
  });

  it('parses JSON payloads and records metrics', async () => {
    const adapter = new OpenAIAdapter() as any;
    const result = await adapter.processResponse(successResponse, baseSettings, 0, 1000, 'chapter-1');

    expect(result.translation).toBe(realisticTranslation);
    expect(result.translatedTitle).toBe('Chapter Title');
    expect(result.usageMetrics.totalTokens).toBe(17);
    expect(calculateCostMock).toHaveBeenCalledWith('gpt-4o', 12, 5);
    expect(recordMetricMock).toHaveBeenCalledWith(expect.objectContaining({ success: true, chapterId: 'chapter-1' }));
  });

  it('strips markdown fences via helper', () => {
    const adapter = new OpenAIAdapter() as any;
    const cleaned = adapter.stripMarkdownCodeFences('```json\n{"translatedTitle":"T"}\n```');
    expect(cleaned).toBe('{"translatedTitle":"T"}');
  });

  it('throws when finish reason indicates truncation', async () => {
    const adapter = new OpenAIAdapter() as any;
    const truncatedResponse = {
      choices: [{
        finish_reason: 'length',
        message: { content: '{"partial": true' },
      }],
    };

    await expect(adapter.processResponse(truncatedResponse, baseSettings, 0, 0)).rejects.toThrow(/length_cap/);
  });

  it('throws when JSON cannot be recovered', async () => {
    const adapter = new OpenAIAdapter() as any;
    const malformed = {
      choices: [{
        finish_reason: 'stop',
        message: { content: '{"number": NaN}' }, // invalid JSON but passes truncation heuristics
      }],
    };

    await expect(adapter.processResponse(malformed, baseSettings, 0, 0)).rejects.toThrow(/Failed to parse JSON response/);
  });

  it('does not mistake brackets in the prose for truncation', async () => {
    // The truncation check used to count [ ] { } across the whole response, string contents
    // included. A footnote marker plus a lone bracket in dialogue made a complete response look
    // unbalanced, which threw length_cap and sent a perfectly good translation into the chunked
    // retry path — billing the model a second time for nothing.
    const adapter = new OpenAIAdapter() as any;
    const prose = `${realisticTranslation} He hesitated [ then spoke again, recalling the note.[1]`;
    const response = {
      choices: [{
        finish_reason: 'stop',
        message: { content: JSON.stringify({ translatedTitle: 'T', translation: prose }) },
      }],
      usage: { prompt_tokens: 12, completion_tokens: 5 },
    };

    const result = await adapter.processResponse(response, baseSettings, 0, 1000);

    expect(result.translation).toBe(prose);
    expect(recordMetricMock).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  it('does not mistake a ```json fence for truncation', async () => {
    // The truncation check ran on the RAW text, before fences were stripped — so a fenced
    // response did not end with `}` and was read as truncated.
    const adapter = new OpenAIAdapter() as any;
    const payload = JSON.stringify({ translatedTitle: 'T', translation: realisticTranslation });
    const response = {
      choices: [{
        finish_reason: 'stop',
        message: { content: '```json\n' + payload + '\n```' },
      }],
      usage: { prompt_tokens: 12, completion_tokens: 5 },
    };

    const result = await adapter.processResponse(response, baseSettings, 0, 1000);

    expect(result.translation).toBe(realisticTranslation);
  });

  it('extracts JSON whose strings end in an escaped backslash', async () => {
    // The old scanner decided a quote was escaped by looking at the previous character, so the
    // closing quote of a string ending in `\\` was read as escaped, the scan ran past the end of
    // the object, and a recoverable response was rejected as "no balanced JSON found".
    const adapter = new OpenAIAdapter() as any;
    const prose = `${realisticTranslation} The sign read: C:\\`;
    const payload = JSON.stringify({ translatedTitle: 'T', translation: prose });
    const response = {
      choices: [{
        finish_reason: 'stop',
        // Preamble forces the direct parse to fail, so extraction is what has to recover it.
        message: { content: `Here is the translation:\n${payload}` },
      }],
      usage: { prompt_tokens: 12, completion_tokens: 5 },
    };

    const result = await adapter.processResponse(response, baseSettings, 0, 1000);

    expect(result.translation).toBe(prose);
  });

  it('records the spend on a billed-but-unparseable response', async () => {
    // The provider bills whether or not the JSON parses. Recording nothing on the failure path
    // made that spend invisible to the cost ledger and the budget gate (TECH-DEBT P1.4).
    const adapter = new OpenAIAdapter() as any;
    const malformed = {
      choices: [{ finish_reason: 'stop', message: { content: '{"number": NaN}' } }],
      usage: { prompt_tokens: 900, completion_tokens: 100 },
    };

    await expect(adapter.processResponse(malformed, baseSettings, 0, 1000)).rejects.toThrow(/Failed to parse/);

    expect(recordMetricMock).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      costUsd: 0.42,
      tokens: { prompt: 900, completion: 100, total: 1000 },
    }));
  });

  it('records the spend on a truncated response', async () => {
    const adapter = new OpenAIAdapter() as any;
    const truncated = {
      choices: [{ finish_reason: 'length', message: { content: '{"partial": true' } }],
      usage: { prompt_tokens: 900, completion_tokens: 100 },
    };

    await expect(adapter.processResponse(truncated, baseSettings, 0, 1000)).rejects.toThrow(/length_cap/);

    expect(recordMetricMock).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
  });

  it('records the spend on an EMPTY response before throwing (review #2)', async () => {
    // An empty response is still billed (usage present). It used to throw before the metric block,
    // so the paid call was invisible to the budget ledger.
    const adapter = new OpenAIAdapter() as any;
    const empty = {
      choices: [{ finish_reason: 'stop', message: { content: '' } }],
      usage: { prompt_tokens: 900, completion_tokens: 0 },
    };

    await expect(adapter.processResponse(empty, baseSettings, 0, 1000)).rejects.toThrow(/Empty response/);

    expect(recordMetricMock).toHaveBeenCalledWith(expect.objectContaining({ success: false, costUsd: 0.42 }));
  });
});

describe('OpenAIAdapter translate() parameter handling', () => {
  beforeEach(() => {
    openAiMocks.create.mockReset();
    openAiMocks.ctor.mockClear();
    recordMetricMock.mockClear();
    supportsStructuredOutputsMock.mockResolvedValue(false);
  });

  it('retries without advanced params when parameter error occurs', async () => {
    const adapter = new OpenAIAdapter();
    openAiMocks.create
      .mockRejectedValueOnce(new Error('temperature not supported'))
      .mockResolvedValueOnce(successResponse);

    const settings: AppSettings = {
      ...baseSettings,
      temperature: 0.9,
      topP: 0.5,
      frequencyPenalty: 1,
      presencePenalty: 0.2,
      seed: 123,
    };

    const request: TranslationRequest = {
      title: 'T',
      content: 'Body',
      settings,
      history: [],
    };

    await adapter.translate(request);

    expect(openAiMocks.create).toHaveBeenCalledTimes(2);
    const firstCallArgs = openAiMocks.create.mock.calls[0][0];
    expect(firstCallArgs.temperature).toBeDefined();

    const retryArgs = openAiMocks.create.mock.calls[1][0];
    expect(retryArgs.temperature).toBeUndefined();
    expect(retryArgs.top_p).toBeUndefined();
    expect(recordMetricMock).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });
});

describe('OpenAIAdapter adversarial scenarios', () => {
  beforeEach(() => {
    openAiMocks.create.mockReset();
    openAiMocks.ctor.mockClear();
    recordMetricMock.mockClear();
    supportsStructuredOutputsMock.mockResolvedValue(false);
  });

  const makeRequest = (): TranslationRequest => ({
    title: 'Test',
    content: 'Content',
    settings: baseSettings,
    history: [],
  });

  it('handles rate limit (429) errors with informative message', async () => {
    const rateLimitError = new Error('Rate limit exceeded');
    (rateLimitError as any).status = 429;
    (rateLimitError as any).headers = { 'retry-after': '30' };

    openAiMocks.create.mockRejectedValueOnce(rateLimitError);

    const adapter = new OpenAIAdapter();

    await expect(adapter.translate(makeRequest())).rejects.toThrow('Rate limit exceeded');
    expect(recordMetricMock).toHaveBeenCalledWith(
      expect.objectContaining({ success: false })
    );
  });

  it('handles network timeout errors', async () => {
    const timeoutError = new Error('Request timed out');
    (timeoutError as any).code = 'ETIMEDOUT';

    openAiMocks.create.mockRejectedValueOnce(timeoutError);

    const adapter = new OpenAIAdapter();

    await expect(adapter.translate(makeRequest())).rejects.toThrow('timed out');
    expect(recordMetricMock).toHaveBeenCalledWith(
      expect.objectContaining({ success: false })
    );
  });

  it('handles empty response gracefully', async () => {
    openAiMocks.create.mockResolvedValueOnce({
      choices: [],
      usage: { prompt_tokens: 0, completion_tokens: 0 },
    });

    const adapter = new OpenAIAdapter();

    await expect(adapter.translate(makeRequest())).rejects.toThrow();
  });

  it('handles null message content', async () => {
    openAiMocks.create.mockResolvedValueOnce({
      choices: [{ finish_reason: 'stop', message: { content: null } }],
      usage: { prompt_tokens: 10, completion_tokens: 0 },
    });

    const adapter = new OpenAIAdapter();

    await expect(adapter.translate(makeRequest())).rejects.toThrow();
  });

  it('handles response with missing required fields', async () => {
    // JSON is valid but missing translatedTitle - use realistic content length
    const contentOnly = 'This translation has enough content to pass validation but is missing the translatedTitle field which should be handled gracefully.';
    openAiMocks.create.mockResolvedValueOnce({
      choices: [{
        finish_reason: 'stop',
        message: { content: JSON.stringify({ translation: contentOnly }) },
      }],
      usage: { prompt_tokens: 10, completion_tokens: 5 },
    });

    const adapter = new OpenAIAdapter();
    const result = await adapter.translate(makeRequest());

    // Should not crash - missing fields should be handled gracefully
    expect(result.translation).toBe(contentOnly);
  });
});

describe('OpenAIAdapter buildRequest placeholder expansion', () => {
  it('expands {{glossary}} via the canonical helper — the literal placeholder must not ship', async () => {
    const adapter = new OpenAIAdapter() as any;
    const settings = createMockAppSettings({
      ...baseSettings,
      systemPrompt: 'Translate text.\n\nPart C: Glossary\n{{glossary}}\n',
      glossary: [{ source: '道', target: 'Dao', note: 'keep untranslated' }],
    });
    const payload = await adapter.buildRequest(settings, 'Title', 'Content', []);
    const sys = payload.messages.find(
      (m: any) => m.role === 'system' && typeof m.content === 'string' && m.content.includes('Part C')
    );
    expect(sys).toBeDefined();
    expect(sys.content).toContain('- 道: Dao (keep untranslated)');
    expect(sys.content).not.toContain('{{glossary}}');
  });
});

describe('OpenAIAdapter chatJSON strict-schema dialect (production wiring)', () => {
  beforeEach(() => {
    openAiMocks.create.mockReset();
    recordMetricMock.mockClear();
    supportsStructuredOutputsMock.mockResolvedValue(true);
    supportsParametersMock.mockResolvedValue(true);
  });

  const jsonOk = {
    choices: [{ finish_reason: 'stop', message: { content: '{"ok":true}' } }],
    usage: { prompt_tokens: 5, completion_tokens: 2 },
  };

  // Optional property + open map — the two shapes the transform must handle.
  const schema = {
    type: 'object',
    properties: {
      english: { type: 'string' },
      nuance: { type: 'string' },
      ripples: { type: 'object', additionalProperties: { type: 'string' } },
    },
    required: ['english'],
  };

  const chatInput = (model: string, provider: 'OpenRouter' | 'OpenAI' = 'OpenRouter') => ({
    settings: createMockAppSettings({ ...baseSettings, provider, model } as any),
    model,
    messages: [{ role: 'user' as const, content: 'go' }],
    schema,
    schemaName: 'test_schema',
    structuredOutputs: true,
  });

  it('applies toOpenAIStrictSchema for OpenRouter openai/* slugs', async () => {
    openAiMocks.create.mockResolvedValueOnce(jsonOk);
    const adapter = new OpenAIAdapter('OpenRouter');
    await adapter.chatJSON(chatInput('openai/gpt-5.4-mini') as any);

    const sent = openAiMocks.create.mock.calls[0][0].response_format.json_schema.schema;
    // Strict dialect: every (surviving) property required, null-union optionality.
    expect(sent.required.sort()).toEqual(['english', 'nuance']);
    expect(sent.properties.nuance.type).toEqual(['string', 'null']);
    // Open maps are inexpressible in the strict dialect — dropped, disclosed.
    expect(sent.properties.ripples).toBeUndefined();
    expect(sent.additionalProperties).toBe(false);
  });

  it('applies the transform for the direct OpenAI provider (unprefixed slugs)', async () => {
    openAiMocks.create.mockResolvedValueOnce(jsonOk);
    const adapter = new OpenAIAdapter('OpenAI');
    await adapter.chatJSON(chatInput('gpt-5.2', 'OpenAI') as any);

    const sent = openAiMocks.create.mock.calls[0][0].response_format.json_schema.schema;
    expect(sent.required.sort()).toEqual(['english', 'nuance']);
    expect(sent.properties.ripples).toBeUndefined();
  });

  it('passes the schema through UNCHANGED for non-OpenAI slugs (ripples survives)', async () => {
    openAiMocks.create.mockResolvedValueOnce(jsonOk);
    const adapter = new OpenAIAdapter('OpenRouter');
    await adapter.chatJSON(chatInput('google/gemini-3-flash-preview') as any);

    const sent = openAiMocks.create.mock.calls[0][0].response_format.json_schema.schema;
    expect(sent).toBe(schema); // referentially untouched
    expect(sent.properties.ripples).toBeDefined();
    expect(sent.required).toEqual(['english']);
  });
});

describe('OpenAIAdapter capability-default downgrade logging (integrity item 1)', () => {
  beforeEach(() => {
    openAiMocks.create.mockReset();
    recordMetricMock.mockClear();
  });

  it('buildRequest warns with the model id when the json_object downgrade rests on a failure-default', async () => {
    // A fetch failure used to downgrade the paid request to json_object with NO log or signal.
    getStructuredOutputsSupportMock.mockResolvedValueOnce({ supported: false, source: 'default-error' });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const adapter = new OpenAIAdapter() as any;
      const payload = await adapter.buildRequest(baseSettings, 'T', 'Content', []);

      expect(payload.response_format).toEqual({ type: 'json_object' });
      const downgradeWarns = warnSpy.mock.calls.filter(c => /DOWNGRADED/.test(String(c[0])));
      expect(downgradeWarns.length).toBe(1);
      expect(String(downgradeWarns[0][0])).toContain('gpt-4o');
      expect(String(downgradeWarns[0][0])).toContain('failure default');
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('buildRequest does NOT warn when metadata genuinely says unsupported', async () => {
    getStructuredOutputsSupportMock.mockResolvedValueOnce({ supported: false, source: 'metadata' });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const adapter = new OpenAIAdapter() as any;
      const payload = await adapter.buildRequest(baseSettings, 'T', 'Content', []);

      expect(payload.response_format).toEqual({ type: 'json_object' });
      expect(warnSpy.mock.calls.filter(c => /DOWNGRADED/.test(String(c[0])))).toHaveLength(0);
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('chatJSON warns on a miss-default downgrade when the caller did not pin structuredOutputs', async () => {
    getStructuredOutputsSupportMock.mockResolvedValueOnce({ supported: false, source: 'default-miss' });
    openAiMocks.create.mockResolvedValueOnce({
      choices: [{ finish_reason: 'stop', message: { content: '{"ok":true}' } }],
      usage: { prompt_tokens: 5, completion_tokens: 2 },
    });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const adapter = new OpenAIAdapter('OpenRouter');
      await adapter.chatJSON({
        settings: createMockAppSettings({ ...baseSettings, provider: 'OpenRouter', model: 'mystery/model' } as any),
        model: 'mystery/model',
        messages: [{ role: 'user' as const, content: 'go' }],
        schema: { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'] },
        // structuredOutputs deliberately NOT set — the capability service decides.
      } as any);

      const sent = openAiMocks.create.mock.calls[0][0];
      expect(sent.response_format).toEqual({ type: 'json_object' });
      const downgradeWarns = warnSpy.mock.calls.filter(c => /DOWNGRADED/.test(String(c[0])));
      expect(downgradeWarns.length).toBe(1);
      expect(String(downgradeWarns[0][0])).toContain('mystery/model');
    } finally {
      warnSpy.mockRestore();
    }
  });
});

describe('OpenAIAdapter "No endpoints found" adaptive retry (integrity item 3)', () => {
  // OpenRouter's REAL failure shape for require_parameters routing: a 404 whose message names
  // no parameter, so the per-parameter failure net could never fire on it.
  const NO_ENDPOINTS_MSG = 'No endpoints found that can handle the requested parameters';

  const jsonOk = {
    choices: [{ finish_reason: 'stop', message: { content: '{"ok":true}' } }],
    usage: { prompt_tokens: 5, completion_tokens: 2 },
  };

  beforeEach(() => {
    openAiMocks.create.mockReset();
    recordMetricMock.mockClear();
    recordParameterFailureMock.mockClear();
    supportsStructuredOutputsMock.mockResolvedValue(true);
    supportsParametersMock.mockResolvedValue(true);
  });

  it('chatJSON retries ONCE without require_parameters and records the failure', async () => {
    openAiMocks.create
      .mockRejectedValueOnce(Object.assign(new Error(NO_ENDPOINTS_MSG), { status: 404 }))
      .mockResolvedValueOnce(jsonOk);

    const adapter = new OpenAIAdapter('OpenRouter');
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const result = await adapter.chatJSON({
        settings: createMockAppSettings({ ...baseSettings, provider: 'OpenRouter', model: 'openai/gpt-5.2' } as any),
        model: 'openai/gpt-5.2',
        messages: [{ role: 'user' as const, content: 'go' }],
        schema: { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'] },
        structuredOutputs: true,
      } as any);

      expect(result.text).toBe('{"ok":true}');
      expect(openAiMocks.create).toHaveBeenCalledTimes(2);

      const firstSent = openAiMocks.create.mock.calls[0][0];
      expect(firstSent.provider?.require_parameters).toBe(true);

      // The adapted retry drops require_parameters (the routing filter), keeps the rest.
      const retrySent = openAiMocks.create.mock.calls[1][0];
      expect(retrySent.provider?.require_parameters).toBeUndefined();
      expect(retrySent.response_format?.type).toBe('json_schema');

      expect(recordParameterFailureMock).toHaveBeenCalledWith('openai/gpt-5.2', 'require_parameters');
      expect(warnSpy.mock.calls.some(c => /no endpoints/i.test(String(c[0])) && String(c[0]).includes('openai/gpt-5.2'))).toBe(true);
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('chatJSON retry is BOUNDED: a second "No endpoints" failure propagates (no loop)', async () => {
    openAiMocks.create.mockRejectedValue(Object.assign(new Error(NO_ENDPOINTS_MSG), { status: 404 }));

    const adapter = new OpenAIAdapter('OpenRouter');
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      await expect(adapter.chatJSON({
        settings: createMockAppSettings({ ...baseSettings, provider: 'OpenRouter', model: 'openai/gpt-5.2' } as any),
        model: 'openai/gpt-5.2',
        messages: [{ role: 'user' as const, content: 'go' }],
        schema: { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'] },
        structuredOutputs: true,
      } as any)).rejects.toThrow(/No endpoints found/);

      expect(openAiMocks.create).toHaveBeenCalledTimes(2); // original + ONE adapted retry
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('chatJSON does NOT consume the retry when require_parameters was never sent', async () => {
    openAiMocks.create.mockRejectedValue(Object.assign(new Error(NO_ENDPOINTS_MSG), { status: 404 }));

    const adapter = new OpenAIAdapter('OpenAI');
    await expect(adapter.chatJSON({
      settings: createMockAppSettings({ ...baseSettings, provider: 'OpenAI', model: 'gpt-5.2' } as any),
      model: 'gpt-5.2',
      messages: [{ role: 'user' as const, content: 'go' }],
      schema: { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'] },
      structuredOutputs: true,
    } as any)).rejects.toThrow(/No endpoints found/);

    // No provider.require_parameters in the request → nothing to adapt → single call.
    expect(openAiMocks.create).toHaveBeenCalledTimes(1);
    expect(recordParameterFailureMock).not.toHaveBeenCalled();
  });

  it('translate() also adapts: one retry without require_parameters', async () => {
    const translationOk = {
      choices: [{
        finish_reason: 'stop',
        message: { content: JSON.stringify({ translatedTitle: 'T', translation: realisticTranslation }) },
      }],
      usage: { prompt_tokens: 12, completion_tokens: 5 },
    };
    openAiMocks.create
      .mockRejectedValueOnce(Object.assign(new Error(NO_ENDPOINTS_MSG), { status: 404 }))
      .mockResolvedValueOnce(translationOk);

    const settings = createMockAppSettings({
      ...baseSettings,
      provider: 'OpenRouter',
      model: 'openai/gpt-5.2',
      apiKeyOpenRouter: 'or-key',
    } as any);

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const adapter = new OpenAIAdapter('OpenRouter');
      const result = await adapter.translate({ title: 'T', content: 'Body', settings, history: [] });

      expect(result.translation).toBe(realisticTranslation);
      expect(openAiMocks.create).toHaveBeenCalledTimes(2);
      expect(openAiMocks.create.mock.calls[0][0].provider?.require_parameters).toBe(true);
      expect(openAiMocks.create.mock.calls[1][0].provider?.require_parameters).toBeUndefined();
      expect(recordParameterFailureMock).toHaveBeenCalledWith('openai/gpt-5.2', 'require_parameters');
    } finally {
      warnSpy.mockRestore();
    }
  });
});

describe('OpenAIAdapter short-translation corruption gate', () => {
  const shortResponse = {
    choices: [{
      finish_reason: 'stop',
      message: { content: JSON.stringify({ translatedTitle: 'T', translation: 'Yes.' }) },
    }],
    usage: { prompt_tokens: 5, completion_tokens: 2 },
  };

  it('accepts a valid short translation when the SOURCE was short too', async () => {
    const adapter = new OpenAIAdapter() as any;
    const result = await adapter.processResponse(shortResponse, baseSettings, 0, 1000, 'ch1', 10);
    expect(result.translation).toBe('Yes.');
  });

  it('still throws on a short translation of a LONG source (corruption)', async () => {
    const adapter = new OpenAIAdapter() as any;
    await expect(
      adapter.processResponse(shortResponse, baseSettings, 0, 1000, 'ch1', 5000)
    ).rejects.toThrow(/corrupted or truncated/);
  });

  it('still throws when source length is unknown (direct calls keep the guard)', async () => {
    const adapter = new OpenAIAdapter() as any;
    await expect(
      adapter.processResponse(shortResponse, baseSettings, 0, 1000, 'ch1')
    ).rejects.toThrow(/corrupted or truncated/);
  });
});

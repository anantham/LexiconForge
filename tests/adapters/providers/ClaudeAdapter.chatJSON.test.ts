/**
 * Tests for ClaudeAdapter.chatJSON — the Sutta Studio / general chat path.
 *
 * The existing ClaudeAdapter.test.ts only covers the translate() delegation;
 * chatJSON was at 0% and dragged the file below the project's 50% line /
 * 40% function thresholds. These tests cover the load-bearing branches:
 * settings/key validation, abort handling, success path, response shape
 * validation, and failure metric recording.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClaudeAdapter } from '../../../adapters/providers/ClaudeAdapter';
import type { ChatRequest } from '../../../adapters/providers/Provider';
import { createMockAppSettings } from '../../utils/test-data';

const { messagesCreateMock, recordMetricMock, calculateCostMock, getEnvVarMock } = vi.hoisted(() => ({
  messagesCreateMock: vi.fn(),
  recordMetricMock: vi.fn().mockResolvedValue(undefined),
  calculateCostMock: vi.fn().mockResolvedValue(0.001),
  getEnvVarMock: vi.fn(),
}));

// Anthropic is invoked via `new Anthropic(...)`. Define the class inside
// the factory so vi.mock's hoisting doesn't reorder around it.
vi.mock('@anthropic-ai/sdk', () => {
  class AnthropicMock {
    messages = { create: messagesCreateMock };
    constructor(_opts?: unknown) { /* ignore opts */ }
  }
  return { default: AnthropicMock };
});

vi.mock('../../../services/aiService', () => ({
  calculateCost: calculateCostMock,
  validateApiKey: vi.fn(),
  translateChapter: vi.fn(),
}));

vi.mock('../../../services/apiMetricsService', () => ({
  apiMetricsService: { recordMetric: recordMetricMock },
}));

vi.mock('../../../services/env', () => ({
  getEnvVar: getEnvVarMock,
}));

// translateWithClaude is unused in chatJSON but the module is imported
vi.mock('../../../services/claudeService', () => ({
  translateWithClaude: vi.fn(),
}));

const buildRequest = (overrides: Partial<ChatRequest> = {}): ChatRequest => ({
  settings: createMockAppSettings({
    provider: 'Claude',
    model: 'claude-3-5-sonnet',
    apiKeyClaude: 'sk-ant-test-key',
    temperature: 0.5,
  }),
  system: 'You are a helpful assistant.',
  user: 'Hello',
  apiType: 'sutta_studio',
  chapterId: 'chapter-test-1',
  ...overrides,
});

const buildSuccessResponse = (text = 'response text', inputTokens = 10, outputTokens = 20) => ({
  content: [{ type: 'text', text }],
  usage: { input_tokens: inputTokens, output_tokens: outputTokens },
});

describe('ClaudeAdapter.chatJSON', () => {
  beforeEach(() => {
    messagesCreateMock.mockReset();
    recordMetricMock.mockClear();
    calculateCostMock.mockClear();
    calculateCostMock.mockResolvedValue(0.001);
    getEnvVarMock.mockReset();
  });

  it('throws when settings is missing', async () => {
    const adapter = new ClaudeAdapter();
    await expect(adapter.chatJSON({ user: 'hi' } as any)).rejects.toThrow(
      'chatJSON requires settings'
    );
  });

  it('throws when no API key is configured (settings + env both empty)', async () => {
    getEnvVarMock.mockReturnValue('');
    const adapter = new ClaudeAdapter();
    const request = buildRequest({
      settings: createMockAppSettings({
        provider: 'Claude',
        model: 'claude-3-5-sonnet',
        apiKeyClaude: undefined,
      }),
    });

    await expect(adapter.chatJSON(request)).rejects.toThrow(
      /Claude API key is missing/
    );
  });

  it('falls back to CLAUDE_API_KEY env var when settings.apiKeyClaude is empty', async () => {
    getEnvVarMock.mockReturnValue('sk-ant-from-env');
    messagesCreateMock.mockResolvedValue(buildSuccessResponse());

    const adapter = new ClaudeAdapter();
    const request = buildRequest({
      settings: createMockAppSettings({
        provider: 'Claude',
        model: 'claude-3-5-sonnet',
        apiKeyClaude: undefined,
      }),
    });

    const result = await adapter.chatJSON(request);
    expect(result.text).toBe('response text');
    expect(getEnvVarMock).toHaveBeenCalledWith('CLAUDE_API_KEY');
  });

  it('throws AbortError when abortSignal is already aborted at entry', async () => {
    const adapter = new ClaudeAdapter();
    const controller = new AbortController();
    controller.abort();

    await expect(
      adapter.chatJSON(buildRequest({ abortSignal: controller.signal }))
    ).rejects.toThrow('Aborted');
    expect(messagesCreateMock).not.toHaveBeenCalled();
  });

  it('returns text + tokens + cost on a successful response', async () => {
    messagesCreateMock.mockResolvedValue(buildSuccessResponse('Hello there', 100, 50));
    calculateCostMock.mockResolvedValue(0.0042);

    const adapter = new ClaudeAdapter();
    const result = await adapter.chatJSON(buildRequest());

    expect(result.text).toBe('Hello there');
    expect(result.tokens).toEqual({ prompt: 100, completion: 50, total: 150 });
    expect(result.costUsd).toBe(0.0042);
    expect(result.model).toBe('claude-3-5-sonnet');
  });

  it('passes system message + user message via system/user shorthand', async () => {
    messagesCreateMock.mockResolvedValue(buildSuccessResponse());

    const adapter = new ClaudeAdapter();
    await adapter.chatJSON(buildRequest({ system: 'SYS', user: 'USR' }));

    expect(messagesCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        system: 'SYS',
        messages: expect.arrayContaining([
          expect.objectContaining({
            role: 'user',
            content: [{ type: 'text', text: 'USR' }],
          }),
        ]),
      })
    );
  });

  it('clamps temperature to [0, 1] and maxTokens to [1, 200000]', async () => {
    messagesCreateMock.mockResolvedValue(buildSuccessResponse());

    const adapter = new ClaudeAdapter();
    await adapter.chatJSON(buildRequest({ temperature: 5, maxTokens: 999999 }));

    expect(messagesCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        temperature: 1,
        max_tokens: 200000,
      })
    );

    messagesCreateMock.mockClear();
    await adapter.chatJSON(buildRequest({ temperature: -1, maxTokens: 0 }));

    expect(messagesCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        temperature: 0,
        max_tokens: 1,
      })
    );
  });

  it('throws when response content is non-text', async () => {
    messagesCreateMock.mockResolvedValue({
      content: [{ type: 'tool_use', id: 't1', name: 'x', input: {} }],
      usage: { input_tokens: 1, output_tokens: 1 },
    });

    const adapter = new ClaudeAdapter();
    await expect(adapter.chatJSON(buildRequest())).rejects.toThrow(
      'Claude returned non-text response'
    );
  });

  it('throws when response text is empty', async () => {
    messagesCreateMock.mockResolvedValue(buildSuccessResponse('   '));

    const adapter = new ClaudeAdapter();
    await expect(adapter.chatJSON(buildRequest())).rejects.toThrow(
      'Empty response from Claude'
    );
  });

  it('records a success metric on the happy path', async () => {
    messagesCreateMock.mockResolvedValue(buildSuccessResponse('ok', 11, 22));
    calculateCostMock.mockResolvedValue(0.005);

    const adapter = new ClaudeAdapter();
    await adapter.chatJSON(buildRequest());

    expect(recordMetricMock).toHaveBeenCalledWith(
      expect.objectContaining({
        apiType: 'sutta_studio',
        model: 'claude-3-5-sonnet',
        costUsd: 0.005,
        tokens: { prompt: 11, completion: 22, total: 33 },
        chapterId: 'chapter-test-1',
        success: true,
      })
    );
  });

  it('records a failure metric and re-throws when the SDK call rejects', async () => {
    const apiError = new Error('Anthropic 500');
    messagesCreateMock.mockRejectedValue(apiError);

    const adapter = new ClaudeAdapter();
    await expect(adapter.chatJSON(buildRequest())).rejects.toThrow('Anthropic 500');

    expect(recordMetricMock).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        errorMessage: 'Anthropic 500',
        costUsd: 0,
        tokens: { prompt: 0, completion: 0, total: 0 },
      })
    );
  });

  it('still records a success metric with costUsd=0 when calculateCost throws', async () => {
    messagesCreateMock.mockResolvedValue(buildSuccessResponse());
    calculateCostMock.mockRejectedValue(new Error('cost lookup down'));

    const adapter = new ClaudeAdapter();
    const result = await adapter.chatJSON(buildRequest());

    expect(result.text).toBeTruthy();
    expect(result.costUsd).toBe(0);
    expect(recordMetricMock).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, costUsd: 0 })
    );
  });
});

/**
 * Review #3: a Translator timeout must actually CANCEL the in-flight provider request, not just
 * abandon the promise while the original keeps running (and billing) as the retry fires. OpenAI
 * already forwarded the signal; Claude took no signal at all and Gemini only checked it AFTER the
 * call returned. These tests assert the signal is threaded into each SDK call — the thing the old
 * "the signal became aborted" test never checked.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockAppSettings } from '../../utils/test-data';

const geminiGenerateContent = vi.hoisted(() => vi.fn());
const claudeCreate = vi.hoisted(() => vi.fn());

vi.mock('@google/generative-ai', async (importOriginal) => {
  // Keep the real module (SchemaType etc. are used at load by translationResponseSchema); only
  // swap the client so we can capture the generateContent call.
  const actual = await importOriginal<any>();
  return {
    ...actual,
    GoogleGenerativeAI: class {
      getGenerativeModel() { return { generateContent: geminiGenerateContent }; }
    },
  };
});
vi.mock('@anthropic-ai/sdk', () => {
  class AnthropicMock { messages = { create: claudeCreate }; constructor(_o?: unknown) {} }
  return { default: AnthropicMock };
});

vi.mock('../../../services/aiService', () => ({ calculateCost: vi.fn().mockResolvedValue(0) }));
vi.mock('../../../services/apiMetricsService', () => ({ apiMetricsService: { recordMetric: vi.fn().mockResolvedValue(undefined) } }));
vi.mock('../../../services/rateLimitService', () => ({ rateLimitService: { canMakeRequest: vi.fn().mockResolvedValue(undefined) } }));
vi.mock('../../../services/env', () => ({ getEnvVar: () => undefined }));

import { GeminiAdapter } from '../../../adapters/providers/GeminiAdapter';
import { translateWithClaude } from '../../../services/claudeService';

describe('abort signal threading into provider SDKs (review #3)', () => {
  beforeEach(() => {
    geminiGenerateContent.mockReset();
    claudeCreate.mockReset();
  });

  it('GeminiAdapter passes the abort signal into generateContent', async () => {
    // Reject so we exit early; we only care that the SDK call received the signal.
    geminiGenerateContent.mockRejectedValue(new Error('stop after capture'));
    const controller = new AbortController();

    await new GeminiAdapter().translate({
      title: 'T',
      content: 'C',
      settings: createMockAppSettings({ provider: 'Gemini', model: 'gemini-2.0-flash', apiKeyGemini: 'k' }),
      history: [],
      fanTranslation: null,
      abortSignal: controller.signal,
    }).catch(() => {});

    expect(geminiGenerateContent).toHaveBeenCalledTimes(1);
    expect(geminiGenerateContent.mock.calls[0][1]).toEqual({ signal: controller.signal });
  });

  it('translateWithClaude passes the abort signal into messages.create', async () => {
    claudeCreate.mockRejectedValue(new Error('stop after capture'));
    const controller = new AbortController();

    await translateWithClaude(
      'T', 'C',
      createMockAppSettings({ provider: 'Claude', model: 'claude-3', apiKeyClaude: 'k' }),
      [], null, controller.signal,
    ).catch(() => {});

    expect(claudeCreate).toHaveBeenCalledTimes(1);
    expect(claudeCreate.mock.calls[0][1]).toEqual({ signal: controller.signal });
  });
});

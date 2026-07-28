/**
 * capabilityService — direct-provider namespace resolution + failure-default provenance
 * (integrity items 1 and 2).
 *
 * The capability map is keyed by OpenRouter slugs ('openai/gpt-4o'), but direct OpenAI/DeepSeek
 * requests carry bare ids ('gpt-5') — before the namespace fix that was a PERMANENT miss:
 * structured outputs permanently OFF for direct OpenAI, supportsParameters permanently
 * fail-open. And any fetch failure/map miss silently answered a hardcoded default with no log.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import {
  getStructuredOutputsSupport,
  supportsStructuredOutputs,
  supportsParameters,
  clearCapabilityCache,
} from '../../services/capabilityService';

const fetchMock = vi.fn();

const MODELS_FIXTURE = {
  data: [
    // OpenRouter slugs — the ONLY namespace the capability map speaks.
    { id: 'openai/gpt-5', supported_parameters: ['structured_outputs', 'response_format', 'temperature'] },
    { id: 'deepseek/deepseek-chat', supported_parameters: ['response_format', 'temperature'] },
  ],
};

const okJson = (payload: unknown) => ({ ok: true, status: 200, json: async () => payload });
// HTTP 400 is deliberately non-transient for the service's retry predicate — the failure path
// resolves immediately instead of walking 4 backoff attempts.
const http400 = { ok: false, status: 400, json: async () => ({}) };

const modelsOnlyFetch = () => {
  fetchMock.mockImplementation(async (url: string) => {
    if (String(url).includes('/endpoints')) return http400;
    return okJson(MODELS_FIXTURE);
  });
};

const defaultWarns = (spy: ReturnType<typeof vi.spyOn>) =>
  spy.mock.calls.filter(c => /DEFAULT/.test(String(c[0])));

describe('capabilityService', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    clearCapabilityCache();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
    vi.unstubAllGlobals();
  });

  describe('direct-provider namespace resolution (item 2)', () => {
    it("resolves a bare direct-OpenAI id via the 'openai/<id>' OpenRouter slug", async () => {
      // RED pre-fix: 'gpt-5' missed the map forever → structured outputs permanently OFF for
      // direct OpenAI, which supports them.
      modelsOnlyFetch();

      const support = await getStructuredOutputsSupport('OpenAI', 'gpt-5');

      expect(support).toEqual({ supported: true, source: 'metadata' });
      expect(await supportsStructuredOutputs('OpenAI', 'gpt-5')).toBe(true);
      expect(defaultWarns(warnSpy)).toHaveLength(0);
    });

    it("resolves a bare DeepSeek id via 'deepseek/<id>' and answers from REAL metadata", async () => {
      // RED pre-fix: the miss fail-opened to true for ANY parameter list. Now metadata answers:
      // 'seed' is not in deepseek-chat's supported_parameters → false, from knowledge.
      modelsOnlyFetch();

      expect(await supportsParameters('DeepSeek', 'deepseek-chat', ['temperature'])).toBe(true);
      expect(await supportsParameters('DeepSeek', 'deepseek-chat', ['seed'])).toBe(false);
      expect(defaultWarns(warnSpy)).toHaveLength(0);
    });

    it('leaves ids that already carry a slash untouched (OpenRouter slugs pass through)', async () => {
      modelsOnlyFetch();
      expect(await supportsStructuredOutputs('OpenRouter', 'openai/gpt-5')).toBe(true);
    });

    it('does NOT prefix for providers outside the mapping', async () => {
      modelsOnlyFetch();
      // 'Gemini' has no OpenRouter author mapping → bare id misses → miss default (true) + warn.
      const result = await supportsParameters('Gemini', 'gpt-5', ['temperature']);
      expect(result).toBe(true);
      expect(defaultWarns(warnSpy)).toHaveLength(1);
    });
  });

  describe('failure-default provenance + loud logging (item 1)', () => {
    it('reports source default-error and warns ONCE when the models fetch fails', async () => {
      fetchMock.mockResolvedValue(http400);

      const first = await getStructuredOutputsSupport('OpenRouter', 'openai/gpt-5');
      expect(first).toEqual({ supported: false, source: 'default-error' });

      const warnsAfterFirst = defaultWarns(warnSpy).length;
      expect(warnsAfterFirst).toBe(1);
      expect(String(defaultWarns(warnSpy)[0][0])).toContain('openai/gpt-5');

      // Second call, same model: memoized — no second warn.
      const second = await getStructuredOutputsSupport('OpenRouter', 'openai/gpt-5');
      expect(second.source).toBe('default-error');
      expect(defaultWarns(warnSpy)).toHaveLength(warnsAfterFirst);
    });

    it('reports source default-miss when metadata loads fine but lacks the model', async () => {
      modelsOnlyFetch();

      const support = await getStructuredOutputsSupport('OpenRouter', 'vendor/unknown-model');

      expect(support).toEqual({ supported: false, source: 'default-miss' });
      expect(defaultWarns(warnSpy)).toHaveLength(1);
      expect(String(defaultWarns(warnSpy)[0][0])).toContain('missing from capability metadata');
    });

    it('supportsParameters warns when it fail-opens on a fetch failure', async () => {
      fetchMock.mockResolvedValue(http400);

      const result = await supportsParameters('OpenRouter', 'openai/gpt-5', ['temperature']);

      expect(result).toBe(true); // historical fail-open behavior preserved
      expect(defaultWarns(warnSpy)).toHaveLength(1);
      const msg = String(defaultWarns(warnSpy)[0][0]);
      expect(msg).toContain('openai/gpt-5');
      expect(msg).toContain('temperature');
    });

    it('an endpoint-verification failure is default-error, not a metadata "no"', async () => {
      fetchMock.mockImplementation(async (url: string) => {
        if (String(url).includes('/endpoints')) return http400;
        return okJson({
          data: [{
            id: 'vendor/so-model',
            canonical_slug: 'vendor/so-model',
            supported_parameters: ['structured_outputs'],
          }],
        });
      });

      const support = await getStructuredOutputsSupport('OpenRouter', 'vendor/so-model');

      // Conservative false preserved, but disclosed as a default: the model-level metadata
      // said yes and only the verification fetch failed.
      expect(support).toEqual({ supported: false, source: 'default-error' });
      expect(defaultWarns(warnSpy)).toHaveLength(1);
    });

    it('a genuine metadata "no" carries source metadata and does not warn', async () => {
      fetchMock.mockImplementation(async () => okJson({
        data: [{ id: 'vendor/plain-model', supported_parameters: ['temperature'] }],
      }));

      const support = await getStructuredOutputsSupport('OpenRouter', 'vendor/plain-model');

      expect(support).toEqual({ supported: false, source: 'metadata' });
      expect(defaultWarns(warnSpy)).toHaveLength(0);
    });
  });
});

describe('learned require_parameters failure is CONSULTED, not just recorded (codex)', () => {
  it('hasRecordedParameterFailure flips after recordParameterFailure', async () => {
    const { recordParameterFailure, hasRecordedParameterFailure, clearCapabilityCache } = await import('../../services/capabilityService');
    clearCapabilityCache();
    expect(hasRecordedParameterFailure('m/x', 'require_parameters')).toBe(false);
    recordParameterFailure('m/x', 'require_parameters');
    expect(hasRecordedParameterFailure('m/x', 'require_parameters')).toBe(true);
  });
});

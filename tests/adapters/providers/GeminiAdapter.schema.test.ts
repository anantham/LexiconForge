import { afterEach, describe, expect, it, vi } from 'vitest';
import { GeminiAdapter } from '../../../adapters/providers/GeminiAdapter';
import { getProposalResponseJsonSchema } from '../../../services/translate/translationResponseSchema';
import { createMockAppSettings } from '../../utils/test-data';

vi.mock('../../../services/rateLimitService', () => ({
  rateLimitService: { acquireRequestSlot: vi.fn().mockResolvedValue(undefined) },
}));
vi.mock('../../../services/apiMetricsService', () => ({
  apiMetricsService: { recordMetric: vi.fn().mockResolvedValue(undefined) },
}));
vi.mock('../../../services/ai/cost', () => ({ calculateCost: vi.fn().mockResolvedValue(0) }));

const settings = createMockAppSettings({
  provider: 'Gemini', model: 'gemini-test', apiKeyGemini: 'synthetic-key',
  systemPrompt: 'Translate into English as JSON.',
});

// Keep the real SDK: a generateContent mock cannot verify nullable JSON schema conversion.
function captureRequest(payload: object) {
  const fetch = vi.fn(async () => new Response(JSON.stringify({
    candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(payload) }] } }],
    usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1 },
  }), { status: 200, headers: { 'content-type': 'application/json' } }));
  vi.stubGlobal('fetch', fetch);
  return () => JSON.parse((fetch.mock.calls[0] as unknown as [string, RequestInit])[1].body as string).generationConfig.responseSchema;
}

afterEach(() => vi.unstubAllGlobals());

describe('Gemini canonical JSON schemas through the real SDK', () => {
  it('converts nullable arrays and nested illustration plans for translation', async () => {
    const wireSchema = captureRequest({ translatedTitle: 'Title', translation: 'Text', footnotes: null, suggestedIllustrations: null });
    const result = await new GeminiAdapter().translate({ title: 'Title', content: 'Text', history: [], settings });
    const schema = wireSchema();
    expect(schema.required).toEqual(['translatedTitle', 'translation', 'footnotes', 'suggestedIllustrations']);
    expect(schema.properties.footnotes).toMatchObject({ type: 'ARRAY', nullable: true, items: { required: ['marker', 'text'] } });
    expect(schema.properties.suggestedIllustrations.items.properties.imagePlan).toMatchObject({ type: 'OBJECT', nullable: true });
    expect(result.footnotes).toEqual([]);
    expect(result.suggestedIllustrations).toEqual([]);
  });

  it('preserves proposal enums and nullable objects in chatJSON', async () => {
    const wireSchema = captureRequest({ proposal: null });
    const result = await new GeminiAdapter().chatJSON({ settings, user: 'Review this translation.', schema: getProposalResponseJsonSchema() });
    const proposal = wireSchema().properties.proposal;
    expect(proposal).toMatchObject({ type: 'OBJECT', nullable: true });
    expect(proposal.properties.kind.enum).toEqual(['prompt', 'glossary']);
    expect(proposal.properties.glossaryOperation.enum).toEqual(['add', 'replace']);
    expect(proposal.properties.glossaryEntry).toMatchObject({ type: 'OBJECT', nullable: true, required: ['source', 'target'] });
    expect(JSON.parse(result.text)).toEqual({ proposal: null });
  });
});

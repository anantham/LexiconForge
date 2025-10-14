import { describe, it, expect, vi, afterEach } from 'vitest';
import { calculateCost } from '../../services/aiService';
import { openrouterService } from '../../services/openrouterService';
import { calculateImageCost } from '../../services/imageService';
import { COSTS_PER_MILLION_TOKENS, IMAGE_COSTS } from '../../config/costs';

const expectCost = async (model: string, promptTokens: number, completionTokens: number, expected: number) => {
  const cost = await calculateCost(model, promptTokens, completionTokens);
  expect(cost).toBeCloseTo(expected, 8);
  return cost;
};

describe('Text model cost calculation', () => {
  it('computes Gemini 2.5 Pro costs', async () => {
    const expected = (1800 * 1.25 + 700 * 10.0) / 1_000_000;
    const cost = await expectCost('gemini-2.5-pro', 1800, 700, expected);
    expect(cost).toBeCloseTo(0.00925, 6);
  });

  it('computes Gemini 2.5 Flash costs', async () => {
    const expected = (1000 * 0.30 + 500 * 2.50) / 1_000_000;
    const cost = await expectCost('gemini-2.5-flash', 1000, 500, expected);
    expect(cost).toBeCloseTo(0.00155, 6);
  });

  it('computes GPT-5 costs', async () => {
    const expected = (2000 * 1.25 + 800 * 10.0) / 1_000_000;
    const cost = await expectCost('gpt-5', 2000, 800, expected);
    expect(cost).toBeCloseTo(0.0105, 6);
  });

  it('falls back for date-suffixed models', async () => {
    const prompt = 1000;
    const completion = 500;
    const base = await calculateCost('gpt-5', prompt, completion);
    const withSuffix = await calculateCost('gpt-5-2025-01-12', prompt, completion);
    expect(withSuffix).toBeCloseTo(base, 8);
    expect(withSuffix).toBeGreaterThan(0);
  });

  it('computes DeepSeek chat costs', async () => {
    const expected = (2000 * 0.56 + 1000 * 1.68) / 1_000_000;
    const cost = await expectCost('deepseek-chat', 2000, 1000, expected);
    expect(cost).toBeCloseTo(0.0028, 6);
  });

  it('supports dynamic OpenRouter pricing when available', async () => {
    const promptTokens = 750;
    const completionTokens = 250;
    const promptPrice = 1e-6; // $0.000001 per token
    const completionPrice = 2e-6; // $0.000002 per token

    const pricingSpy = vi.spyOn(openrouterService, 'getPricingForModel').mockResolvedValue({
      prompt: promptPrice,
      completion: completionPrice,
    });
    vi.spyOn(openrouterService, 'fetchModels').mockResolvedValue({ data: [], fetchedAt: new Date().toISOString() });

    const cost = await calculateCost('openai/gpt-4o', promptTokens, completionTokens);
    const expected = promptTokens * promptPrice + completionTokens * completionPrice;
    expect(cost).toBeCloseTo(expected, 10);
    expect(pricingSpy).toHaveBeenCalledWith('openai/gpt-4o');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });
});

describe('Edge cases', () => {
  it('returns 0 for zero tokens', async () => {
    const cost = await calculateCost('gemini-2.5-flash', 0, 0);
    expect(cost).toBe(0);
  });

  it('handles large token counts without precision issues', async () => {
    const expected = (100_000 * 0.30 + 50_000 * 2.50) / 1_000_000;
    const cost = await expectCost('gemini-2.5-flash', 100_000, 50_000, expected);
    expect(cost).toBeCloseTo(0.155, 6);
  });

  it('returns 0 for unknown models instead of throwing', async () => {
    const cost = await calculateCost('unknown-model-2025', 1000, 500);
    expect(cost).toBe(0);
  });

  it('rejects negative token counts', async () => {
    await expect(calculateCost('gemini-2.5-flash', -100, 50)).rejects.toThrow('Invalid token counts');
    await expect(calculateCost('gemini-2.5-flash', 100, -50)).rejects.toThrow('Invalid token counts');
  });

  it('maintains floating point precision for tiny requests', async () => {
    const cost = await calculateCost('gemini-2.5-flash', 1, 1);
    expect(cost).toBeCloseTo((1 * 0.30 + 1 * 2.50) / 1_000_000, 12);
  });
});

describe('Pricing table integrity', () => {
  it('has pricing data for all registered models', async () => {
    for (const [model, pricing] of Object.entries(COSTS_PER_MILLION_TOKENS)) {
      expect(pricing.input).toBeGreaterThan(0);
      expect(pricing.output).toBeGreaterThan(0);
      const cost = await calculateCost(model, 1000, 500);
      expect(cost).toBeGreaterThan(0);
      expect(Number.isFinite(cost)).toBe(true);
    }
  });

  it('produces reasonable costs for practical scenarios', async () => {
    const scenarios = [
      { prompt: 500, completion: 300 },
      { prompt: 2000, completion: 1500 },
      { prompt: 5000, completion: 4000 },
    ];

    for (const scenario of scenarios) {
      const results = await Promise.all([
        calculateCost('gemini-2.5-flash', scenario.prompt, scenario.completion),
        calculateCost('gpt-5-mini', scenario.prompt, scenario.completion),
        calculateCost('deepseek-chat', scenario.prompt, scenario.completion),
      ]);

      results.forEach(cost => {
        expect(cost).toBeGreaterThan(0);
        expect(cost).toBeLessThan(0.1);
      });
    }
  });
});

describe('Image generation costs', () => {
  it('uses configured per-image prices', () => {
    expect(calculateImageCost('imagen-3.0-generate-002')).toBe(IMAGE_COSTS['imagen-3.0-generate-002']);
    expect(calculateImageCost('imagen-4.0-ultra-generate-preview-06-06')).toBe(IMAGE_COSTS['imagen-4.0-ultra-generate-preview-06-06']);
    expect(calculateImageCost('Qubico/flux1-schnell')).toBe(IMAGE_COSTS['Qubico/flux1-schnell']);
  });

  it('returns 0 for unknown image models', () => {
    expect(calculateImageCost('unknown-image-model')).toBe(0);
  });
});

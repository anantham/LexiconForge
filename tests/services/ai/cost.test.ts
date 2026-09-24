import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * services/ai/cost.ts owns two money contracts:
 *   - calculateCost runs AFTER a paid response. It may record $0 for an unpriced
 *     model, but it must never throw away the completed work.
 *   - hasKnownPricing is the budget gate's pre-flight. It must fail CLOSED:
 *     anything short of two finite prices means "unknown".
 * Other suites mock hasKnownPricing; these tests run its real logic.
 */
const openrouter = vi.hoisted(() => ({
  getPricingForModel: vi.fn(),
  fetchModels: vi.fn(),
}));
vi.mock('../../../services/openrouterService', () => ({ openrouterService: openrouter }));

import { calculateCost, hasKnownPricing } from '../../../services/ai/cost';

const SLASH_MODEL = 'vendor/some-model';

beforeEach(() => {
  openrouter.getPricingForModel.mockReset().mockResolvedValue(null);
  openrouter.fetchModels.mockReset().mockResolvedValue({ data: [], fetchedAt: '' });
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

describe('calculateCost', () => {
  it('prices a date-suffixed model from its undated base entry', async () => {
    const cost = await calculateCost('gemini-2.5-flash-2025-06-17', 1_000_000, 1_000_000);

    expect(cost).toBeCloseTo(0.30 + 2.50, 8);
    expect(openrouter.getPricingForModel).not.toHaveBeenCalled();
  });

  it('refreshes the OpenRouter catalog once when a slash model is not cached', async () => {
    openrouter.getPricingForModel
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ prompt: '0.000002', completion: '0.000004' });

    const cost = await calculateCost(SLASH_MODEL, 1000, 500);

    expect(openrouter.fetchModels).toHaveBeenCalledTimes(1);
    expect(cost).toBeCloseTo(1000 * 0.000002 + 500 * 0.000004, 12);
  });

  it('records $0 rather than throwing when the catalog refresh fails after a paid call', async () => {
    openrouter.fetchModels.mockRejectedValue(new Error('OpenRouter models fetch failed: 503'));

    await expect(calculateCost(SLASH_MODEL, 1000, 500)).resolves.toBe(0);
  });

  it('records $0 for a model with no pricing anywhere', async () => {
    await expect(calculateCost('mystery-model', 1000, 500)).resolves.toBe(0);
    expect(openrouter.getPricingForModel).not.toHaveBeenCalled();
  });
});

describe('hasKnownPricing (budget gate pre-flight)', () => {
  it('trusts the static table, including date-suffixed variants, without the network', async () => {
    await expect(hasKnownPricing('gemini-2.5-flash')).resolves.toBe(true);
    await expect(hasKnownPricing('gemini-2.5-flash-2025-06-17')).resolves.toBe(true);
    expect(openrouter.getPricingForModel).not.toHaveBeenCalled();
  });

  it('rejects an unpriced non-OpenRouter model without the network', async () => {
    await expect(hasKnownPricing('mystery-model')).resolves.toBe(false);
    expect(openrouter.getPricingForModel).not.toHaveBeenCalled();
  });

  it.each([
    ['string prices', { prompt: '0.000001', completion: '0.000002' }],
    ['numeric prices', { prompt: 1e-6, completion: 2e-6 }],
    ['a free model', { prompt: '0', completion: '0' }],
  ])('accepts an OpenRouter model with %s', async (_label, pricing) => {
    openrouter.getPricingForModel.mockResolvedValue(pricing);

    await expect(hasKnownPricing(SLASH_MODEL)).resolves.toBe(true);
  });

  it.each([
    ['a missing completion price', { prompt: '0.000001' }],
    ['a non-numeric price', { prompt: 'n/a', completion: '0.000002' }],
  ])('fails closed on %s', async (_label, pricing) => {
    openrouter.getPricingForModel.mockResolvedValue(pricing);

    await expect(hasKnownPricing(SLASH_MODEL)).resolves.toBe(false);
  });

  it('fails closed when the model is absent even after refreshing the catalog', async () => {
    await expect(hasKnownPricing(SLASH_MODEL)).resolves.toBe(false);
    expect(openrouter.fetchModels).toHaveBeenCalledTimes(1);
  });

  it('fails closed when the catalog refresh throws', async () => {
    openrouter.fetchModels.mockRejectedValue(new Error('offline'));

    await expect(hasKnownPricing(SLASH_MODEL)).resolves.toBe(false);
  });
});

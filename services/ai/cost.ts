import { COSTS_PER_MILLION_TOKENS } from '../../config/costs';
import { openrouterService } from '../openrouterService';

export class UnknownModelPricingError extends Error {
  constructor(public readonly model: string) {
    super(
      `No pricing information found for model "${model}". Budget mode cannot safely continue until this model is priced.`
    );
    this.name = 'UnknownModelPricingError';
  }
}

const fetchDynamicPricing = async (model: string) => {
  let pricing = await openrouterService.getPricingForModel(model);
  if (!pricing) {
    console.warn(`[Cost] Pricing for ${model} not found in cache. Fetching from OpenRouter...`);
    await openrouterService.fetchModels();
    pricing = await openrouterService.getPricingForModel(model);
  }
  return pricing;
};

const resolveModelCosts = (model: string) => {
  let modelCosts = COSTS_PER_MILLION_TOKENS[model];

  if (!modelCosts) {
    const baseModel = model.replace(/-\d{4}-\d{2}-\d{2}$/, '');
    modelCosts = COSTS_PER_MILLION_TOKENS[baseModel];
    if (modelCosts) {
      console.log(`[Cost] Using pricing for base model '${baseModel}' for '${model}'`);
    }
  }

  return modelCosts;
};

const parseTokenPrice = (value: number | string | undefined): number | null => {
  const parsed = typeof value === 'string' ? parseFloat(value) : value;
  return typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : null;
};

const resolveTokenRates = async (model: string): Promise<{ input: number; output: number } | null> => {
  const modelCosts = resolveModelCosts(model);
  if (modelCosts) {
    return {
      input: modelCosts.input / 1_000_000,
      output: modelCosts.output / 1_000_000,
    };
  }

  if (model.includes('/')) {
    const pricing = await fetchDynamicPricing(model);
    if (pricing) {
      const promptCost = parseTokenPrice(pricing.prompt);
      const completionCost = parseTokenPrice(pricing.completion);
      if (promptCost !== null && completionCost !== null) {
        return {
          input: promptCost,
          output: completionCost,
        };
      }
    }
  }

  return null;
};

export const assertModelCostKnown = async (model: string): Promise<void> => {
  const rates = await resolveTokenRates(model);
  if (!rates) {
    throw new UnknownModelPricingError(model);
  }
};

export const calculateCost = async (
  model: string,
  promptTokens: number,
  completionTokens: number
): Promise<number> => {
  if (promptTokens < 0 || completionTokens < 0) {
    throw new Error(
      `Invalid token counts: promptTokens=${promptTokens}, completionTokens=${completionTokens}. Token counts must be non-negative.`
    );
  }

  const rates = await resolveTokenRates(model);
  if (!rates) {
    throw new UnknownModelPricingError(model);
  }

  const inputCost = promptTokens * rates.input;
  const outputCost = completionTokens * rates.output;
  return inputCost + outputCost;
};

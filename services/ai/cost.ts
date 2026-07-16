import { COSTS_PER_MILLION_TOKENS } from '../../config/costs';
import { openrouterService } from '../openrouterService';

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

  const modelCosts = resolveModelCosts(model);
  if (modelCosts) {
    const inputCost = (promptTokens / 1_000_000) * modelCosts.input;
    const outputCost = (completionTokens / 1_000_000) * modelCosts.output;
    return inputCost + outputCost;
  }

  if (model.includes('/')) {
    const pricing = await fetchDynamicPricing(model);
    if (pricing) {
      const promptCost =
        (typeof pricing.prompt === 'string' ? parseFloat(pricing.prompt) : pricing.prompt) || 0;
      const completionCost =
        (typeof pricing.completion === 'string'
          ? parseFloat(pricing.completion)
          : pricing.completion) || 0;

      const inputCost = promptTokens * promptCost;
      const outputCost = completionTokens * completionCost;
      return inputCost + outputCost;
    }
  }

  // FAIL-OPEN, tolerated only for post-hoc accounting: this runs AFTER a paid
  // response, so throwing here would destroy completed work. The budget GATE
  // must never rely on this path — it pre-flights hasKnownPricing() and
  // refuses to translate unpriceable models (TECH-DEBT P0.4).
  console.error(`[Cost] No pricing information found for model: ${model}. Cost recorded as 0 — budget accounting for this call is WRONG.`);
  return 0;
};

/**
 * Can this model's cost actually be computed? The spend-budget gate must
 * refuse to proceed when this is false: an unpriced model records $0 per
 * chapter, so the gate would believe a 999-chapter preload is free.
 */
export const hasKnownPricing = async (model: string): Promise<boolean> => {
  if (resolveModelCosts(model)) return true;
  if (model.includes('/')) {
    try {
      const pricing = await fetchDynamicPricing(model);
      if (!pricing) return false;
      const prompt = typeof pricing.prompt === 'string' ? parseFloat(pricing.prompt) : pricing.prompt;
      const completion =
        typeof pricing.completion === 'string' ? parseFloat(pricing.completion) : pricing.completion;
      return Number.isFinite(prompt) && Number.isFinite(completion);
    } catch {
      return false;
    }
  }
  return false;
};

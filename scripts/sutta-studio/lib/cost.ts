/**
 * Shared cost accounting for the one-off experiment/generation scripts.
 *
 * Integrity finding (2026-07 scan, P2): run-phase-experiment.ts and
 * generate-new-phases.ts carried verbatim-twin cost blocks that (a) never asked
 * OpenRouter for its own accounting (`usage: { include: true }` → usage.cost,
 * which includes reasoning tokens and per-request charges token math misses —
 * audit finding B5) and (b) nulled cost whenever pricing lookup failed. The
 * canonical resolver already lives in spend-guard.ts (the benchmark's money
 * path); this module REUSES it rather than forking a third copy.
 */
import { getModelPricing } from '../../../services/capabilityService';
import { resolveCostUsd } from '../spend-guard';

export { resolveCostUsd };

/**
 * Resolve one call's USD cost from a raw OpenRouter response `usage` object.
 * Prefers provider accounting (usage.cost); falls back to token math against
 * cached pricing; returns null when neither is available (callers should
 * surface null as "unpriced", never as $0).
 */
export const resolveCallCostUsd = async (
  usage: { cost?: unknown; prompt_tokens?: unknown; completion_tokens?: unknown } | null | undefined,
  model: string,
): Promise<number | null> => {
  let pricing: { input: number; output: number } | null = null;
  try {
    pricing = await getModelPricing(model);
  } catch {
    pricing = null;
  }
  return resolveCostUsd(usage, pricing);
};

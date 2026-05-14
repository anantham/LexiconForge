/**
 * Grounding orchestration facade.
 *
 * Combines all grounding providers into a single lookup surface. The
 * `groundingPass` consumes this — providers themselves stay
 * single-responsibility (one registry / corpus per provider).
 *
 * Per GROUNDING.md: providers are deterministic, no LLM fallback. Missing
 * entries return `[]` and the pass marks the corresponding sense as
 * interpretive rather than fabricating a citation.
 */

import { ContestedTermProvider, loadRegistry } from './contestedTermProvider';
import type { GroundedClaim, GroundingProvider } from './types';

export type { GroundedClaim, GroundingProvider, MatchStrategy, Match } from './types';
export { ContestedTermProvider, loadRegistry } from './contestedTermProvider';

/**
 * Default production registry composition. Currently just contested-terms;
 * Phase 3 will add the translator-bank provider, Phase 4 will add the
 * commentarial-gloss provider, each wired here.
 */
export async function buildDefaultProviders(): Promise<GroundingProvider[]> {
  const registry = await loadRegistry();
  return [new ContestedTermProvider(registry)];
}

/**
 * Convenience facade — runs every provider's lookup against a term and
 * concatenates the claims. The pass uses this to query "all known
 * citations for this term" without caring which provider supplied them.
 */
export async function lookupAcrossProviders(
  providers: GroundingProvider[],
  term: string
): Promise<GroundedClaim[]> {
  const all: GroundedClaim[] = [];
  for (const provider of providers) {
    const claims = await provider.lookup(term);
    all.push(...claims);
  }
  return all;
}

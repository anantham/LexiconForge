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
import { CommentarialGlossProvider, loadCommentarialGlosses } from './commentarialGlossProvider';
import type { GroundedClaim, GroundingProvider } from './types';

export type { GroundedClaim, GroundingProvider, MatchStrategy, Match } from './types';
export { ContestedTermProvider, loadRegistry } from './contestedTermProvider';
export { CommentarialGlossProvider, loadCommentarialGlosses } from './commentarialGlossProvider';

/**
 * Default production registry composition: contested-terms (hand-curated
 * MN10/DN22 vocabulary) + commentarial-glosses (909 Vism glossary entries
 * from Ñāṇamoli, via the Eudoxos / edhamma TEI corpus).
 *
 * Phase 3 (translator-bank via SC Bilara) is wired separately in the
 * compiler pass. Phase 4 (this provider) added 2026-05-14 via Eudoxos
 * find — see docs/sutta-studio/RESEARCH_RESULTS.md.
 */
export async function buildDefaultProviders(): Promise<GroundingProvider[]> {
  const [registry, glossFile] = await Promise.all([
    loadRegistry(),
    loadCommentarialGlosses(),
  ]);
  return [
    new ContestedTermProvider(registry),
    new CommentarialGlossProvider(glossFile),
  ];
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

/**
 * Types for the grounding layer.
 *
 * Per docs/sutta-studio/GROUNDING.md — providers expose verified citations
 * for Pāli terms. Each claim is a fact-with-source pairing, not an LLM
 * assertion. The pass that consumes these is deterministic; the LLM has
 * no role in this layer.
 *
 * Provider interface mirrors the existing services/providers/ pattern
 * (DPD, SC Bilara, etc.) — but for hand-curated registries rather than
 * machine-parseable corpora.
 */

import type { Citation } from '../../../types/suttaStudio';

/**
 * A grounded claim — a set of verified citations for a single Pāli term
 * (or compound). The optional `narrative` is curator synthesis that ties
 * the citations together; the pass does not require it.
 *
 * `term` is the lemma form (e.g., 'satipaṭṭhāna', 'nibbāna') — providers
 * match against word surfaces using their own normalization strategy.
 */
export type GroundedClaim = {
  term: string;
  citations: Citation[];
  narrative?: string;
};

/**
 * Provider that exposes verified citations for Pāli terms.
 *
 * Providers are deterministic — same term in, same citations out. No LLM,
 * no network roundtrip during compilation (registries are loaded at init
 * and held in memory). Adding a new provider type means adding a new
 * implementation of this interface plus wiring it in `grounding/index.ts`.
 *
 * Per GROUNDING.md anti-pattern guard: providers MUST NOT fall back to
 * LLM for missing entries. Returning `[]` is correct when no verified
 * citation exists — the grounding pass marks the term as "interpretive"
 * (no source) rather than fabricating one.
 */
export interface GroundingProvider {
  /** Stable identifier for telemetry / logs. */
  readonly name: string;

  /**
   * Looks up claims for a term. Returns empty array if no entry matches.
   * MUST be synchronous when the underlying registry is in-memory; async
   * is allowed only when the provider genuinely needs to fetch (e.g., a
   * future translator-bank that hits SC Bilara at compile time).
   */
  lookup(term: string): Promise<GroundedClaim[]>;
}

/**
 * Match strategy used when matching a registry term against a Pāli word
 * surface. Exposed for telemetry — the pass logs which match level a
 * citation came from so curators can audit the matching.
 */
export type MatchStrategy =
  | 'exact'           // Term equals word surface
  | 'substring'       // Term is a substring of surface (e.g., 'dukkha' in 'dukkhadomanassānaṁ')
  | 'stem-prefix'     // Term-minus-final-vowel is a prefix (e.g., 'satipaṭṭhāna' → 'satipaṭṭhānā')
  | 'segment-exact';  // A segment text exactly equals the term

export type Match = {
  strategy: MatchStrategy;
  matchedAgainst: string; // word surface OR segment text
};

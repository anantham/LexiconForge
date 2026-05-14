/**
 * Grounding pass — attaches verified citations to a compiled phase.
 *
 * Per docs/sutta-studio/GROUNDING.md Phase 2: replaces the one-shot
 * `scripts/sutta-studio/apply-contested-terms.py` script with a
 * production pass that runs after LLM compilation. Pure function:
 * same phase + same providers in, same citation wiring out.
 *
 * Anti-patterns this pass refuses to instantiate (per GROUNDING.md
 * §"Anti-patterns to guard against"):
 *   - LLM-as-DB-fallback: missing entries yield no citation. No
 *     fabrication, no "trust me bro" labels.
 *   - Citation theater: every attached citation has a verified URL via
 *     the provider's source registry.
 */

import type { PaliWord, PhaseView, Citation } from '../../../types/suttaStudio';
import type { GroundingProvider, GroundedClaim, Match } from '../grounding/types';
import { lookupAcrossProviders } from '../grounding';

const PALI_VOWELS = new Set('aāiīuūeoṁ');

/**
 * Result of a single pass invocation. Reports both the attached
 * citations (for downstream packet assembly) and structured telemetry
 * about which matches fired (for audit / curator review).
 */
export type GroundingPassResult = {
  /** New citations to add to packet.citations[]. Idempotent — caller
   *  should filter against existing citation IDs before appending. */
  citationsAdded: Citation[];
  /** Map of `wordId` → array of citation IDs to attach to every sense
   *  of that word. */
  citationIdsByWord: Map<string, string[]>;
  /** Audit log: which match level each attached claim came from. */
  matches: Array<{
    phaseId: string;
    wordId: string;
    term: string;
    match: Match;
    citationCount: number;
  }>;
};

/**
 * Determines how a registry term matches a word. Returns the strongest
 * match found, or null if no match. Same logic as the python script's
 * `term_matches_word` — kept in sync deliberately.
 */
function classifyMatch(term: string, word: PaliWord): Match | null {
  const surface = word.segments.map((s) => s.text).join('');

  if (surface === term) {
    return { strategy: 'exact', matchedAgainst: surface };
  }
  if (surface.includes(term)) {
    return { strategy: 'substring', matchedAgainst: surface };
  }
  // Segment exact match
  for (const seg of word.segments) {
    if (seg.text === term) {
      return { strategy: 'segment-exact', matchedAgainst: seg.text };
    }
  }
  // Stem-prefix: strip final vowel, check prefix.
  if (term.length >= 4) {
    const lastChar = term[term.length - 1].toLowerCase();
    if (PALI_VOWELS.has(lastChar)) {
      const stem = term.slice(0, -1);
      if (surface.startsWith(stem)) {
        return { strategy: 'stem-prefix', matchedAgainst: surface };
      }
    }
  }
  return null;
}

/**
 * Returns the set of GroundedClaims that apply to a word, with their
 * match metadata. A claim "applies" when the registry term it covers
 * matches the word via any of the four strategies.
 */
async function claimsForWord(
  word: PaliWord,
  providers: GroundingProvider[]
): Promise<Array<{ claim: GroundedClaim; match: Match }>> {
  // Build the lookup key from the word's full surface — providers
  // handle the inclusive matching internally.
  const surface = word.segments.map((s) => s.text).join('');
  const claims = await lookupAcrossProviders(providers, surface);

  // For each claim, classify the match level (the provider already
  // confirmed a match exists; we just need to know which strategy).
  const result: Array<{ claim: GroundedClaim; match: Match }> = [];
  for (const claim of claims) {
    const match = classifyMatch(claim.term, word);
    if (match) result.push({ claim, match });
  }
  return result;
}

/**
 * Runs the grounding pass on a single phase.
 *
 * Returns NEW citations to add to packet.citations[] and a map of
 * `wordId → [citationId]` arrays to attach to every sense of that
 * word. Caller (packet assembler or compiler post-step) applies the
 * results to the packet.
 *
 * The pass is idempotent w.r.t. its own output — running twice on the
 * same phase + providers produces the same Citation IDs.
 */
export async function runGroundingPass(
  phase: PhaseView,
  providers: GroundingProvider[]
): Promise<GroundingPassResult> {
  const citationsAdded: Citation[] = [];
  const citationsAddedIds = new Set<string>();
  const citationIdsByWord = new Map<string, string[]>();
  const matches: GroundingPassResult['matches'] = [];

  for (const word of phase.paliWords ?? []) {
    const wordClaims = await claimsForWord(word, providers);
    if (wordClaims.length === 0) continue;

    const idsForThisWord: string[] = [];
    for (const { claim, match } of wordClaims) {
      for (const cite of claim.citations) {
        if (!citationsAddedIds.has(cite.id)) {
          citationsAddedIds.add(cite.id);
          citationsAdded.push(cite);
        }
        if (!idsForThisWord.includes(cite.id)) {
          idsForThisWord.push(cite.id);
        }
      }
      matches.push({
        phaseId: phase.id,
        wordId: word.id,
        term: claim.term,
        match,
        citationCount: claim.citations.length,
      });
    }
    citationIdsByWord.set(word.id, idsForThisWord);
  }

  return { citationsAdded, citationIdsByWord, matches };
}

/**
 * Applies pass output to a phase in-place. Wires `citationIds` onto
 * every sense of every word in the `citationIdsByWord` map. Idempotent —
 * existing citation IDs are preserved, only NEW ones are merged.
 *
 * Separated from `runGroundingPass` so callers can inspect the result
 * before committing it (or batch multiple phases before assembly).
 */
export function applyGroundingToPhase(
  phase: PhaseView,
  result: GroundingPassResult
): void {
  for (const word of phase.paliWords ?? []) {
    const ids = result.citationIdsByWord.get(word.id);
    if (!ids || ids.length === 0) continue;
    for (const sense of word.senses ?? []) {
      const existing = new Set(sense.citationIds ?? []);
      for (const id of ids) existing.add(id);
      sense.citationIds = Array.from(existing).sort();
    }
  }
}

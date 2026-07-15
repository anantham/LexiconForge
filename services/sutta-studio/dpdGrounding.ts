/**
 * DPD grounding for the Anatomist pass — shared by production (services/compiler) and the
 * benchmark (scripts/sutta-studio/benchmark.ts) so the two ground the Anatomist IDENTICALLY.
 *
 * Parity is the whole point (ADR SUTTA-014): the benchmark used to ground the Anatomist while
 * production did not, so the leaderboard ranked a pass real users never ran. Both now call
 * buildAnatomistGrounding, so there is exactly one tokenization and one lookup path.
 */
import type { CanonicalSegment } from '../../types/suttaStudio';
import type { LexiconEntry } from '../providers/types';
import type { DpdProvider } from '../providers/dpd';

/**
 * Strip characters that are not letters from the ENDS of a token: trailing daṇḍa, period,
 * semicolon, comma, quote marks. None are part of the Pāli word, and the DPD `normalize` only
 * trims + lowercases, so a token like `Idha,` or `abhijjhādomanassaṁ.` misses on the punctuation
 * alone. Interior marks are left untouched (they may be meaningful, e.g. the elision apostrophe).
 *
 * Measured on mn10: this lifts the Anatomist DPD hit rate from ~59% (raw whitespace split) to
 * ~89% — 42 of 55 raw misses were nothing but trailing punctuation.
 */
export const stripTokenEnds = (word: string): string =>
  word.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, '');

/**
 * The surface tokens to ground the Anatomist with: whitespace-split each segment's Pāli, strip
 * end punctuation, drop empties, dedupe. Order-independent (the result is a set of words to look
 * up), so the returned order is not significant.
 */
export const extractAnatomistGroundingTokens = (segments: CanonicalSegment[]): string[] =>
  Array.from(
    new Set(
      segments
        .flatMap((s) => (s.pali || '').split(/\s+/))
        .map(stripTokenEnds)
        .filter(Boolean),
    ),
  );

/**
 * Build DPD attestations for the Anatomist: look up every grounding token, keep the hits, key the
 * result by the (cleaned) surface word — which is exactly how renderAnatomistDpdBlock labels each
 * entry. Returns {} when no provider is available (e.g. a work with no bundled DPD subset), which
 * makes the Anatomist gracefully fall back to ungrounded rather than fail.
 */
export const buildAnatomistGrounding = async (
  provider: DpdProvider | null,
  segments: CanonicalSegment[],
): Promise<Record<string, LexiconEntry[]>> => {
  const out: Record<string, LexiconEntry[]> = {};
  if (!provider) return out;
  await Promise.all(
    extractAnatomistGroundingTokens(segments).map(async (token) => {
      try {
        const entries = await provider.lookup(token);
        if (entries.length > 0) out[token] = entries;
      } catch {
        /* skip this token on lookup error — grounding is best-effort */
      }
    }),
  );
  return out;
};

/**
 * DPD grounding for the Anatomist pass, shared by production and benchmark so tokenization,
 * lookup behavior, and failure visibility cannot drift independently.
 *
 * Boundary-punctuation normalization raises the committed MN10 subset's hit rate from about
 * 59% to 89%; interior marks remain intact.
 */
import type { CanonicalSegment } from '../../types/suttaStudio';
import type { LexiconEntry, LexiconProvider } from '../providers/types';

export type GroundingWarning = (message: string, error: unknown) => void;

/**
 * Strip non-letters from token boundaries. Interior marks can be meaningful and are preserved.
 */
export const stripTokenEnds = (word: string): string =>
  word.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, '');

export const extractAnatomistGroundingTokens = (
  segments: CanonicalSegment[],
): string[] =>
  Array.from(
    new Set(
      segments
        .flatMap((segment) => (segment.pali || '').split(/\s+/))
        .map(stripTokenEnds)
        .filter(Boolean),
    ),
  );

/**
 * Build the lookup map rendered by the Anatomist prompt.
 *
 * Individual lookup failures are visible but do not discard successful attestations for the
 * rest of the phase. This keeps grounding best-effort without turning provider failures silent.
 */
export const buildAnatomistGrounding = async (
  provider: Pick<LexiconProvider, 'lookup'> | null,
  segments: CanonicalSegment[],
  warn: GroundingWarning = (message, error) => console.warn(message, error),
): Promise<Record<string, LexiconEntry[]>> => {
  if (!provider) return {};

  const results = await Promise.all(
    extractAnatomistGroundingTokens(segments).map(async (token) => {
      try {
        return [token, await provider.lookup(token)] as const;
      } catch (error) {
        warn(`[AnatomistGrounding] DPD lookup failed for token "${token}"; continuing with remaining tokens.`, error);
        return [token, []] as const;
      }
    }),
  );

  return Object.fromEntries(results.filter(([, entries]) => entries.length > 0));
};

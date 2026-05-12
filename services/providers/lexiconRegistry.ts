/**
 * Lexicon provider registry.
 *
 * Holds a list of LexiconProvider instances and exposes a single `lookup(lemma)`
 * method that runs every provider in parallel and merges the responses while
 * preserving provider-local identity.
 *
 * Behaviour invariants:
 *   - One provider's failure never poisons another. Each provider's lookup is
 *     wrapped so an error is observed as "no entries" for that provider only.
 *   - Empty/missing responses are reflected explicitly (`hasAny: false`) — never
 *     papered over with an invented entry.
 *   - Per-provider entries are preserved in `entriesBySource` so source
 *     disagreement is visible downstream (see ADR §UI Vision #7).
 */

import type {
  LexiconEntry,
  LexiconProvider,
  LexiconProviderId,
  LookupOptions,
} from './types';

export interface MergedLexiconLookup {
  /** The lemma that was looked up (post-normalisation). */
  lemma: string;
  /** Per-provider entries. Preserves source so disagreement is visible. */
  entriesBySource: Partial<Record<LexiconProviderId, LexiconEntry[]>>;
  /** Flattened convenience view — every entry from every provider in registration order. */
  allEntries: LexiconEntry[];
  /** Provider ids that returned at least one entry. */
  respondingProviders: LexiconProviderId[];
  /** True iff any provider returned at least one entry. */
  hasAny: boolean;
}

export interface MergeOptions {
  /**
   * Default true. Never collapse one provider's data into another's.
   * Disagreements are surfaced downstream rather than papered over.
   */
  preserveSource?: boolean;
  /**
   * Hint for downstream consumers (e.g., MorphHint extraction): prefer this
   * provider when multiple supply structured morphology. Currently advisory —
   * the merged structure preserves all sources; consumers decide.
   */
  preferStructuredMorphology?: LexiconProviderId;
}

export interface ProviderResponseTuple {
  providerId: LexiconProviderId;
  entries: LexiconEntry[];
}

/**
 * Merge per-provider responses into a single MergedLexiconLookup. Pure function;
 * no I/O. Useful for tests + for callers that want to assemble responses manually.
 */
export const mergeLexiconEntries = (
  lemma: string,
  responses: ProviderResponseTuple[],
  // Reserved for future use — currently advisory; the merge preserves all sources unconditionally.
  _opts: MergeOptions = {},
): MergedLexiconLookup => {
  const entriesBySource: Partial<Record<LexiconProviderId, LexiconEntry[]>> = {};
  const allEntries: LexiconEntry[] = [];
  const respondingProviders: LexiconProviderId[] = [];
  for (const { providerId, entries } of responses) {
    if (!entries || entries.length === 0) continue;
    entriesBySource[providerId] = entries;
    respondingProviders.push(providerId);
    allEntries.push(...entries);
  }
  return {
    lemma,
    entriesBySource,
    allEntries,
    respondingProviders,
    hasAny: allEntries.length > 0,
  };
};

export class LexiconProviderRegistry {
  private readonly providers: LexiconProvider[] = [];
  private readonly defaultMergeOptions: MergeOptions;

  constructor(opts: MergeOptions = {}) {
    this.defaultMergeOptions = { preserveSource: true, ...opts };
  }

  /** Register a provider. Returns the registry for chaining. */
  register(provider: LexiconProvider): this {
    if (this.providers.some((p) => p.id === provider.id)) {
      throw new Error(`LexiconProviderRegistry: provider '${provider.id}' already registered`);
    }
    this.providers.push(provider);
    return this;
  }

  /** Read-only view of registered providers in registration order. */
  list(): LexiconProvider[] {
    return [...this.providers];
  }

  /** Look up a lemma across every registered provider in parallel. */
  async lookup(lemma: string, opts?: LookupOptions): Promise<MergedLexiconLookup> {
    const responses = await Promise.all(
      this.providers.map(async (p): Promise<ProviderResponseTuple> => {
        try {
          const entries = await p.lookup(lemma, opts);
          return { providerId: p.id, entries: entries ?? [] };
        } catch {
          return { providerId: p.id, entries: [] };
        }
      }),
    );
    return mergeLexiconEntries(lemma, responses, this.defaultMergeOptions);
  }
}

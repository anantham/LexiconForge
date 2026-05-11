/**
 * Deterministic citation materialisation.
 *
 * Given a provider response, mint a Citation entry suitable for adding to
 * `packet.citations`. The transformation is mechanical: the same upstream
 * record always mints the same Citation.id. Hand-glued sourceCitationIds
 * are the failure mode this prevents.
 */

import type { Citation, CitationProvenance } from '../../types/suttaStudio';
import type { ProviderId, ProviderResponseBase } from './types';

/**
 * Compute the deterministic citation id for a provider response.
 *
 * Format:
 *   `cite:{providerId}:{sourceId}` — preferred; sourceId is upstream-stable
 *   `cite:{providerId}:q:{query}`  — fallback when the provider didn't supply a sourceId
 *
 * @param providerId Provider id (e.g., 'sc-dictionary-full', 'dpd', 'vri-attha').
 * @param sourceId   Provider-local handle if available.
 * @param query      The lookup query (lemma or canonical segment id) — used in the fallback.
 */
export const citationIdFor = (
  providerId: ProviderId,
  sourceId: string | undefined,
  query: string,
): string => {
  if (sourceId && sourceId.length > 0) return `cite:${providerId}:${sourceId}`;
  return `cite:${providerId}:q:${query}`;
};

/** Optional inputs for materialising a Citation. */
export interface MaterializeOptions {
  /** ISO date when the upstream was fetched. Defaults to today (YYYY-MM-DD). */
  fetchedAt?: string;
  /** Human label for the citation's `short` field. Defaults to `${providerLabel} s.v. ${query}`. */
  short?: string;
  /** Override URL on the citation. */
  url?: string;
  /** Override license string. Defaults to the provider's license. */
  license?: string;
}

/**
 * Mint a Citation entry from a provider response.
 *
 * The output is mechanical — no creative renaming, no inference. The provider
 * supplies the raw excerpt + sourceId; this helper composes a Citation with
 * a deterministic id, the provider's licence stamp, and a fetch timestamp.
 */
export const materializeCitation = (
  providerId: ProviderId,
  providerLabel: string,
  providerLicense: string,
  response: ProviderResponseBase & { rawExcerpt?: string },
  query: string,
  opts: MaterializeOptions = {},
): Citation => {
  const id = response.citationId ?? citationIdFor(providerId, response.sourceId, query);
  const fetchedAt = opts.fetchedAt ?? new Date().toISOString().slice(0, 10);
  return {
    id,
    short: opts.short ?? `${providerLabel} s.v. ${query}`,
    provenance: providerId as CitationProvenance,
    query,
    excerpt: response.rawExcerpt,
    license: opts.license ?? providerLicense,
    fetchedAt,
    ...(opts.url ? { url: opts.url } : {}),
  };
};

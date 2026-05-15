/**
 * Contested-Term Provider.
 *
 * Reads `data/sutta-studio/grounding/contested-terms.json` and exposes
 * each entry as a GroundedClaim. Each entry's translator renderings,
 * encyclopedic references, and primary scholarship URLs become Citation
 * objects with stable IDs.
 *
 * Per GROUNDING.md: this is the operational consumer of the registry.
 * Phase 1 seeded the registry; this provider is Phase 2's interpretation
 * layer. The previous `scripts/sutta-studio/apply-contested-terms.py`
 * does the same work as a one-shot script; this is the production version
 * that runs inside the compiler pass.
 */

import type { Citation } from '../../../types/suttaStudio';
import type { GroundedClaim, GroundingProvider } from './types';

/**
 * Shape of an entry in contested-terms.json. Permissive on optional
 * fields — the registry schema is additive-safe by design.
 */
type RegistryEntry = {
  parses?: Array<{
    morphology?: string;
    gloss?: string;
    summary?: string;
    translatorRenderings?: TranslatorRendering[];
    encyclopedicReferences?: Reference[];
    needsVerification?: string;
  }>;
  encyclopedicReferences?: Reference[];
  primaryScholarship?: Reference[];
  translatorRenderings?: TranslatorRendering[];
  doctrinalContext?: {
    name?: string;
    summary?: string;
    encyclopedicReferences?: Reference[];
    needsVerification?: string;
  };
  curatorNote?: string;
};

type TranslatorRendering = {
  translator?: string;
  rendering?: string;
  context?: string;
  url?: string;
  verified?: string;
};

type Reference = {
  source?: string;
  ref?: string;
  url?: string;
  quotedClaim?: string;
  verified?: string;
  note?: string;
};

type Registry = Record<string, RegistryEntry | unknown>;

/**
 * Stable short key for the citation ID, derived from URL. Same convention
 * as `scripts/sutta-studio/apply-contested-terms.py:slugify_url` so the
 * two consumers produce identical IDs (important for idempotency when
 * both the script and the pass run on the same packet).
 */
function slugifyUrl(url: string): string {
  if (url.includes('wikipedia.org')) return 'wikipedia';
  if (url.includes('dhammatalks.org')) return 'thanissaro-dhammatalks';
  if (url.includes('suttacentral.net/mn10/en/bodhi')) return 'sc-bodhi-mn10';
  if (url.includes('suttacentral.net/mn10/en/sujato')) return 'sc-sujato-mn10';
  if (url.includes('suttacentral.net/mn10/en/anandajoti')) return 'sc-anandajoti-mn10';
  if (url.includes('windhorsepublications.com')) return 'analayo-monograph';
  if (url.includes('tipitaka.org')) return 'vri-tipitaka';
  return url
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 40)
    .replace(/^-|-$/g, '');
}

/**
 * Walks a registry entry, collecting every URL-bearing object as a
 * Citation. Recursive because parse-level and entry-level references
 * are at different depths in the schema.
 */
function collectCitationsForTerm(term: string, entry: RegistryEntry): Citation[] {
  const citations: Citation[] = [];
  const seenUrls = new Set<string>();

  const walk = (obj: unknown): void => {
    if (!obj || typeof obj !== 'object') return;
    if (Array.isArray(obj)) {
      for (const item of obj) walk(item);
      return;
    }
    const record = obj as Record<string, unknown>;
    const url = typeof record.url === 'string' ? record.url : undefined;
    if (url && !seenUrls.has(url)) {
      seenUrls.add(url);
      const sourceKey = slugifyUrl(url);

      const translator = typeof record.translator === 'string' ? record.translator : undefined;
      const rendering = typeof record.rendering === 'string' ? record.rendering : undefined;
      const source = typeof record.source === 'string' ? record.source : undefined;
      const ref = typeof record.ref === 'string' ? record.ref : undefined;

      let short: string;
      if (translator && rendering) {
        short = `${translator}: "${rendering}" (${term})`;
      } else if (source) {
        short = source;
      } else if (ref) {
        short = ref.length > 80 ? `${ref.slice(0, 80)}…` : ref;
      } else {
        short = `${term} — source`;
      }

      const excerpt =
        (typeof record.quotedClaim === 'string' ? record.quotedClaim : undefined) ??
        (typeof record.context === 'string' ? record.context : undefined) ??
        (typeof record.note === 'string' ? record.note : undefined) ??
        '';

      const verified =
        typeof record.verified === 'string' ? record.verified : undefined;

      const license = url.includes('wikipedia')
        ? 'CC BY-SA 3.0 (Wikipedia)'
        : 'see source for license';

      citations.push({
        id: `cite:term:${term}:${sourceKey}`,
        short,
        url,
        excerpt,
        provenance: 'manual',
        query: term,
        fetchedAt: verified ?? '2026-05-14',
        license,
      });
    }
    for (const value of Object.values(record)) walk(value);
  };

  walk(entry);
  return citations;
}

export class ContestedTermProvider implements GroundingProvider {
  readonly name = 'contested-terms';
  private readonly registry: Registry;
  private readonly cache = new Map<string, GroundedClaim[]>();

  constructor(registry: Registry) {
    this.registry = registry;
  }

  /**
   * Returns claims for any registry entry whose term is a substring of
   * the input OR for which the input is a stem-prefix variant. The
   * matching is INCLUSIVE on purpose — the consumer (groundingPass)
   * filters to the relevant word at attachment time.
   *
   * Returns empty array if no entries match. MUST NOT fall back to LLM
   * or invent citations.
   */
  async lookup(term: string): Promise<GroundedClaim[]> {
    if (this.cache.has(term)) return this.cache.get(term)!;

    const claims: GroundedClaim[] = [];
    for (const [registryTerm, entry] of Object.entries(this.registry)) {
      if (registryTerm.startsWith('_')) continue; // meta entries like _meta
      if (!entry || typeof entry !== 'object') continue;

      // Match: term contains registryTerm, OR stem-prefix
      const matches =
        term.includes(registryTerm) ||
        this.stemPrefixMatch(registryTerm, term);

      if (!matches) continue;

      const citations = collectCitationsForTerm(registryTerm, entry as RegistryEntry);
      if (citations.length === 0) continue;

      const curatorNote = (entry as RegistryEntry).curatorNote;
      claims.push({
        term: registryTerm,
        citations,
        narrative: curatorNote,
      });
    }

    this.cache.set(term, claims);
    return claims;
  }

  /**
   * Strip final Pāli vowel from registryTerm; check if it's a prefix of
   * `term`. Catches lemma/inflection pairs like `satipaṭṭhāna`/`satipaṭṭhānā`.
   */
  private stemPrefixMatch(registryTerm: string, term: string): boolean {
    if (registryTerm.length < 4) return false;
    const vowels = new Set('aāiīuūeoṁ');
    const lastChar = registryTerm[registryTerm.length - 1].toLowerCase();
    if (!vowels.has(lastChar)) return false;
    const stem = registryTerm.slice(0, -1);
    return term.startsWith(stem);
  }
}

/**
 * Lazy-load the registry from the data dir. Used by production
 * orchestration; tests inject a registry directly via the constructor.
 */
export async function loadRegistry(
  fetchFn?: () => Promise<Registry>
): Promise<Registry> {
  if (fetchFn) return fetchFn();

  // Dynamic import so this works in both Node (build scripts) and
  // browser (vite dev server) without eagerly bundling the JSON.
  const mod = await import(
    '../../../data/sutta-studio/grounding/contested-terms.json'
  );
  return (mod.default ?? mod) as Registry;
}

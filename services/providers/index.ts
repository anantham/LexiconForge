/**
 * Provider abstraction barrel. Consumers import from `services/providers`.
 *
 * The default registry registers the SuttaCentral dictionary_full provider.
 * Subsequent commits (per ADR SUTTA-008 §Build order) register DpdProvider,
 * VriEditionProvider, AṭṭhakathāCommentaryProvider, etc.
 */

export * from './types';
export * from './citationHelpers';
export * from './lexiconRegistry';
export { SuttaCentralDictionaryProvider, suttaCentralDictionaryProvider } from './suttaCentralDictionary';
export { DpdProvider, mergeDpdData, type DpdData, type DpdHeadwords, type DpdForms } from './dpd';

import { LexiconProviderRegistry } from './lexiconRegistry';
import { suttaCentralDictionaryProvider } from './suttaCentralDictionary';

/**
 * Default lexicon provider registry. Hand-curation tooling and the live
 * compiler share this single registry instance. Tests should construct
 * their own registry; do not mutate the default.
 *
 * `DpdProvider` is intentionally NOT registered here — registration requires
 * loading per-sutta JSON subsets at startup, which is environment-specific
 * (Vite glob in browser, fs.readFileSync in Node/scripts). Commit B.3 wires
 * the appropriate loader into the live compiler boot path; for now,
 * hand-curation scripts construct DpdProvider directly via the FS loader
 * in `dpd-loader-fs.ts`.
 */
export const defaultLexiconRegistry: LexiconProviderRegistry = new LexiconProviderRegistry()
  .register(suttaCentralDictionaryProvider);

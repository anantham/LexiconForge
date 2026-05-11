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

import { LexiconProviderRegistry } from './lexiconRegistry';
import { suttaCentralDictionaryProvider } from './suttaCentralDictionary';

/**
 * Default lexicon provider registry. Hand-curation tooling and the live
 * compiler share this single registry instance. Tests should construct
 * their own registry; do not mutate the default.
 */
export const defaultLexiconRegistry: LexiconProviderRegistry = new LexiconProviderRegistry()
  .register(suttaCentralDictionaryProvider);

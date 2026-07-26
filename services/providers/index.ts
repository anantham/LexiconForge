/**
 * Provider abstraction barrel. Consumers import from `services/providers`.
 *
 * The default registry registers the SuttaCentral dictionary_full provider.
 * DpdProvider is deliberately excluded from the registry — see the note on
 * `defaultLexiconRegistry` below.
 */

export * from './types';
export * from './citationHelpers';
export * from './lexiconRegistry';
export { SuttaCentralDictionaryProvider, suttaCentralDictionaryProvider } from './suttaCentralDictionary';
export { DpdProvider, mergeDpdData, type DpdData, type DpdHeadwords, type DpdForms } from './dpd';
export {
  SuttaCentralBilaraVariantsProvider,
  suttaCentralBilaraVariantsProvider,
  type VariantReading,
} from './scBilaraVariants';
export {
  SuttaCentralSuttaplexParallelProvider,
  suttaCentralSuttaplexParallelProvider,
  type SuttaplexParallelRef,
} from './scSuttaplex';

import { LexiconProviderRegistry } from './lexiconRegistry';
import { suttaCentralDictionaryProvider } from './suttaCentralDictionary';

/**
 * Default lexicon provider registry. Hand-curation tooling and the live
 * compiler share this single registry instance. Tests should construct
 * their own registry; do not mutate the default.
 *
 * `DpdProvider` is intentionally NOT registered here — its data loading is
 * environment-specific (Vite glob in browser, fs.readFileSync in Node/scripts).
 * The live compiler (`services/compiler/index.ts`) constructs DpdProvider
 * directly, feeding it `getBundledDpdData()` from `dpd-loader-vite`, at both
 * of its construction sites; Node-side hand-curation scripts construct it via
 * the FS loader in `dpd-loader-fs.ts`.
 */
export const defaultLexiconRegistry: LexiconProviderRegistry = new LexiconProviderRegistry()
  .register(suttaCentralDictionaryProvider);

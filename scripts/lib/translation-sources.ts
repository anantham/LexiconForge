/**
 * Translation source adapter registry.
 *
 * Supported:
 * - EPUB files
 * - TXT directories
 * - Monolithic TXT files
 * - PDF files
 * - Polyglotta JSON
 */

export * from './translation-source-types';
export { EpubAdapter } from './adapters/epub-adapter';
export { TxtDirectoryAdapter } from './adapters/txt-directory-adapter';
export { TxtFileAdapter } from './adapters/txt-file-adapter';
export { PdfAdapter } from './adapters/pdf-adapter';
export { PolyglottaJsonAdapter } from './adapters/polyglotta-json-adapter';
export { NovelHiAdapter } from './adapters/novelhi-adapter';

import { EpubAdapter } from './adapters/epub-adapter';
import { TxtDirectoryAdapter } from './adapters/txt-directory-adapter';
import { TxtFileAdapter } from './adapters/txt-file-adapter';
import { PdfAdapter } from './adapters/pdf-adapter';
import { PolyglottaJsonAdapter } from './adapters/polyglotta-json-adapter';
import { NovelHiAdapter } from './adapters/novelhi-adapter';
import type { TranslationSourceAdapter } from './translation-source-types';

export const adapters: TranslationSourceAdapter[] = [
  new EpubAdapter(),
  new TxtDirectoryAdapter(),
  new TxtFileAdapter(),
  new PdfAdapter(),
  new PolyglottaJsonAdapter(),
  new NovelHiAdapter(),
];

export function findAdapter(input: string): TranslationSourceAdapter | null {
  for (const adapter of adapters) {
    if (adapter.canHandle(input)) {
      return adapter;
    }
  }
  return null;
}

/**
 * Vite-eager loader for DPD per-sutta subsets.
 *
 * Imports every `data/dpd/<sutta>/headwords.json` and `forms.json` at build
 * time via Vite's `import.meta.glob`. The merged DpdData is exposed as a
 * lazy singleton so the live compiler can call it without I/O at runtime.
 *
 * Browser / Vite-bundle only. Node + tsx scripts should use `dpd-loader-fs.ts`
 * instead. Tests that go through this module rely on vitest's vite resolver,
 * which understands the same glob syntax.
 *
 * Wrapped in try/catch so a missing or empty DPD subset never breaks the
 * compiler — the lexicographer pass falls through to SC-only data.
 */

import type { DpdData, DpdForms, DpdHeadwords } from './dpd';
import { mergeDpdData } from './dpd';

const loadFromGlob = (): DpdData => {
  try {
    const headwordModules = import.meta.glob<DpdHeadwords>(
      '../../data/dpd/*/headwords.json',
      { eager: true, import: 'default' },
    );
    const formsModules = import.meta.glob<DpdForms>(
      '../../data/dpd/*/forms.json',
      { eager: true, import: 'default' },
    );
    const datasets: DpdData[] = [];
    for (const [pathKey, headwords] of Object.entries(headwordModules)) {
      // Match the sibling forms.json by replacing the filename.
      const formsPath = pathKey.replace('/headwords.json', '/forms.json');
      const forms = formsModules[formsPath];
      datasets.push({ headwords, forms });
    }
    return mergeDpdData(...datasets);
  } catch (e) {
    if (typeof console !== 'undefined') {
      console.warn('[dpd-loader-vite] failed to load DPD subsets via import.meta.glob:', e);
    }
    return { headwords: {}, forms: {} };
  }
};

let cached: DpdData | undefined;

/**
 * Returns the merged DpdData for all per-sutta subsets present in the
 * bundle. Lazy singleton — first call computes; subsequent calls return
 * the same object.
 */
export const getBundledDpdData = (): DpdData => {
  if (!cached) cached = loadFromGlob();
  return cached;
};

/** Test helper — reset the singleton. Do not call from production code. */
export const _resetBundledDpdDataForTests = (): void => {
  cached = undefined;
};

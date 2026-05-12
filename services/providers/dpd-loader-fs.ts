/**
 * Filesystem loader for DPD per-sutta subsets.
 *
 * Node-only — intentionally a separate module so importing `DpdProvider` from
 * `./dpd` in browser code never accidentally pulls `node:fs` into the bundle.
 *
 * Used by:
 *   - `scripts/build-dpd.ts` ingestion tooling (indirectly, for sanity checks)
 *   - vitest tests that exercise the real MN10 dataset
 *   - hand-curation scripts (the curation helper in commit B/E will use this)
 *
 * Browser-side loading happens via Vite's `import.meta.glob` in commit B.3
 * when the live compiler is wired to consume DPD data.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { DpdData, DpdForms, DpdHeadwords } from './dpd';
import { mergeDpdData } from './dpd';

const DEFAULT_DATA_ROOT = 'data/dpd';

const readJson = <T>(filePath: string): T => {
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw) as T;
};

/**
 * Load a single per-sutta DPD subset from disk.
 *
 * @param suttaUid    e.g. 'mn10'
 * @param dataRoot    directory containing per-sutta subdirectories. Default
 *                    is the repo's data/dpd/. Pass an absolute path to
 *                    decouple from process.cwd().
 *
 * @throws if the headwords file doesn't exist. The forms file is optional.
 */
export const loadDpdSubsetFromFs = (suttaUid: string, dataRoot: string = DEFAULT_DATA_ROOT): DpdData => {
  const subsetDir = path.join(dataRoot, suttaUid);
  const headwordsPath = path.join(subsetDir, 'headwords.json');
  const formsPath = path.join(subsetDir, 'forms.json');

  if (!fs.existsSync(headwordsPath)) {
    throw new Error(`DPD subset not found: ${headwordsPath}. Run \`npm run build:dpd -- ${suttaUid}\` to generate it.`);
  }

  const headwords = readJson<DpdHeadwords>(headwordsPath);
  let forms: DpdForms | undefined;
  if (fs.existsSync(formsPath)) {
    forms = readJson<DpdForms>(formsPath);
  }
  return { headwords, forms };
};

/**
 * Load every per-sutta DPD subset under `dataRoot` and merge into a single
 * DpdData. Convenience for tests + hand-curation tools that want one
 * provider covering all built suttas.
 *
 * Silently skips directories that lack a headwords.json — the user may
 * have a `_raw/` cache directory or similar siblings.
 */
export const loadAllDpdSubsetsFromFs = (dataRoot: string = DEFAULT_DATA_ROOT): DpdData => {
  if (!fs.existsSync(dataRoot)) return { headwords: {}, forms: {} };
  const subdirs = fs.readdirSync(dataRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('_'))
    .map((d) => d.name);
  const datasets: DpdData[] = [];
  for (const uid of subdirs) {
    const headwordsPath = path.join(dataRoot, uid, 'headwords.json');
    if (!fs.existsSync(headwordsPath)) continue;
    datasets.push(loadDpdSubsetFromFs(uid, dataRoot));
  }
  return mergeDpdData(...datasets);
};

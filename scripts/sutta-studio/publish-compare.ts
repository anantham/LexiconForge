/**
 * publish-compare — emit per-model golden-vs-model comparison artifacts for the
 * PUBLISHED leaderboard, so the site's "View" link can show actual results side by
 * side with the golden (not just a number).
 *
 * For each model in the given run dir(s), reads its per-phase pipeline-<phase>.json
 * (each already carries BOTH golden and model output), aligns words to the golden
 * (LCS by surface), and writes a compact JSON to
 *   public/benchmarks/compare/<modelId>.json
 * consumed by SuttaStudioBenchmarkView's side-by-side comparison panel.
 *
 * Usage:
 *   npx tsx scripts/sutta-studio/publish-compare.ts <reportDir> [<reportDir> ...]
 *   LEADERBOARD_DIRS=<ts1>,<ts2> npx tsx scripts/sutta-studio/publish-compare.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { alignWords } from './quality-scorer';
import type { AnatomistPass, LexicographerPass } from '../../types/suttaStudio';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '../..');
const REPORTS = path.join(REPO, 'reports/sutta-studio');
const OUT_DIR = path.join(REPO, 'public/benchmarks/compare');

const segText = (w: { segmentIds?: string[] }, a: AnatomistPass): string =>
  (w.segmentIds || []).map((id) => (a.segments || []).find((s) => s.id === id)?.text ?? '?').join('·');

const segTips = (w: { segmentIds?: string[] }, a: AnatomistPass): string[] => {
  const tips: string[] = [];
  for (const id of w.segmentIds || []) {
    const s = (a.segments || []).find((x) => x.id === id);
    for (const t of s?.tooltips || []) tips.push(t);
  }
  return tips;
};

const wordSenses = (wordId: string, lex: LexicographerPass | null): string[] =>
  ((lex?.senses || []).find((x) => x.wordId === wordId)?.senses || []).map((s) => s.english).filter(Boolean);

type CompareWord = {
  surface: string;
  golden: { seg: string; tips: string[]; senses: string[] };
  model: { seg: string; tips: string[]; senses: string[]; segMatch: boolean } | null;
};

function buildPhase(data: any, phaseId: string) {
  const ga: AnatomistPass | null = data.golden?.anatomist ?? null;
  const oa: AnatomistPass | null = data.output?.anatomist ?? null;
  const gl: LexicographerPass | null = data.golden?.lexicographer ?? null;
  const ol: LexicographerPass | null = data.output?.lexicographer ?? null;
  const pali = (data.segments || []).map((s: any) => s.pali).join(' ');
  if (!ga?.words?.length || !oa) return null; // only phases the golden grades

  const pairs = alignWords(ga.words, oa.words || []);
  const modelMatched = new Set(pairs.map(([, mi]) => mi));

  const words: CompareWord[] = ga.words.map((gw, gi) => {
    const gSeg = segText(gw, ga);
    const golden = { seg: gSeg, tips: segTips(gw, ga), senses: wordSenses(gw.id, gl) };
    const pair = pairs.find(([g]) => g === gi);
    if (!pair) return { surface: gw.surface, golden, model: null };
    const mw = oa.words[pair[1]];
    const mSeg = segText(mw, oa);
    return {
      surface: gw.surface,
      golden,
      model: { seg: mSeg, tips: segTips(mw, oa), senses: wordSenses(mw.id, ol), segMatch: mSeg === gSeg },
    };
  });

  const unmatched = (oa.words || [])
    .filter((_, mi) => !modelMatched.has(mi))
    .map((w) => ({ surface: w.surface, seg: segText(w, oa), tips: segTips(w, oa).slice(0, 3) }));

  return { phaseId, pali, goldenWordCount: ga.words.length, modelWordCount: (oa.words || []).length, words, unmatched };
}

function main() {
  const dirs = (process.argv.slice(2).length
    ? process.argv.slice(2)
    : (process.env.LEADERBOARD_DIRS || '').split(',').filter(Boolean).map((t) => path.join(REPORTS, t))
  ).map((d) => path.resolve(d));
  if (!dirs.length) throw new Error('give report dir(s) as args or LEADERBOARD_DIRS');

  fs.mkdirSync(OUT_DIR, { recursive: true });
  let written = 0;
  for (const reportDir of dirs) {
    const outputsDir = path.join(reportDir, 'outputs');
    if (!fs.existsSync(outputsDir)) continue;
    const run = path.basename(reportDir);
    for (const model of fs.readdirSync(outputsDir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name)) {
      const modelDir = path.join(outputsDir, model);
      const phaseFiles = fs.readdirSync(modelDir).filter((f) => f.startsWith('pipeline-') && f.endsWith('.json')).sort();
      const phases = [];
      for (const pf of phaseFiles) {
        const phaseId = pf.replace('pipeline-', '').replace('.json', '');
        const data = JSON.parse(fs.readFileSync(path.join(modelDir, pf), 'utf8'));
        const built = buildPhase(data, phaseId);
        if (built) phases.push(built);
      }
      if (!phases.length) continue;
      const outPath = path.join(OUT_DIR, `${model}.json`);
      fs.writeFileSync(outPath, JSON.stringify({ model, run, phases }, null, 2));
      console.log(`  ${model}: ${phases.length} phases → ${path.relative(REPO, outPath)}`);
      written++;
    }
  }
  console.log(`\nWrote ${written} comparison artifact(s) to public/benchmarks/compare/`);
}

main();

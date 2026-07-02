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
 * The artifact makes the SCORING itself auditable, per stage:
 *  - Anatomist stage:     golden vs model morpheme split (segMatch)
 *  - Lexicographer stage: the exact content-fidelity token diff the scorer counted
 *                         (matched / model-only=fp / golden-only=fn) via the SAME
 *                         tokenize + wordKnowledgeTokensById the scorer uses
 *  - Judge (SUTTA-010):   per-word semantic verdict + one-line rationale
 *  - Per-phase score strip from quality-scores.json (seg F1, content F1, overall…)
 *
 * Usage:
 *   npx tsx scripts/sutta-studio/publish-compare.ts <reportDir> [<reportDir> ...]
 *   LEADERBOARD_DIRS=<ts1>,<ts2> npx tsx scripts/sutta-studio/publish-compare.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import {
  alignWords,
  tokenize,
  wordKnowledgeTokensById,
  scoreSegmentationFidelity,
  scoreContentFidelity,
} from './quality-scorer';
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

type TokenDiff = { matched: string[]; modelOnly: string[]; goldenOnly: string[]; f1: number | null };
type JudgeEntry = { score: number; verdict: string; hallucination: boolean; rationale: string };

type CompareWord = {
  surface: string;
  golden: { seg: string; tips: string[]; senses: string[] };
  model: { seg: string; tips: string[]; senses: string[]; segMatch: boolean } | null;
  /** The content-fidelity token diff the scorer actually counted (null = golden silent → unscored). */
  tokens: TokenDiff | null;
  /** SUTTA-010 semantic judge verdict for this word (null = not judged). */
  judge: JudgeEntry | null;
};

/** The exact per-word token diff scoreContentFidelity pools — same helpers, zero drift. */
function tokenDiff(
  goldWordId: string, modelWordId: string,
  ga: AnatomistPass, gl: LexicographerPass | null,
  oa: AnatomistPass, ol: LexicographerPass | null
): TokenDiff | null {
  const gold = new Set(wordKnowledgeTokensById(goldWordId, ga, gl));
  if (gold.size === 0) return null; // golden silent on this word → contributes nothing to content F1
  const model = new Set(wordKnowledgeTokensById(modelWordId, oa, ol));
  const matched: string[] = [], modelOnly: string[] = [], goldenOnly: string[] = [];
  for (const t of model) (gold.has(t) ? matched : modelOnly).push(t);
  for (const t of gold) if (!model.has(t)) goldenOnly.push(t);
  const denom = 2 * matched.length + modelOnly.length + goldenOnly.length;
  return { matched, modelOnly, goldenOnly, f1: denom > 0 ? (2 * matched.length) / denom : 1 };
}

function buildPhase(
  data: any,
  phaseId: string,
  judgeByWord: Map<string, JudgeEntry> | undefined,
  phaseScores: any | undefined
) {
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
    const judge = judgeByWord?.get(gw.id) ?? null;
    const pair = pairs.find(([g]) => g === gi);
    if (!pair) return { surface: gw.surface, golden, model: null, tokens: null, judge };
    const mw = (oa.words || [])[pair[1]];
    const mSeg = segText(mw, oa);
    return {
      surface: gw.surface,
      golden,
      model: { seg: mSeg, tips: segTips(mw, oa), senses: wordSenses(mw.id, ol), segMatch: mSeg === gSeg },
      tokens: tokenDiff(gw.id, mw.id, ga, gl, oa, ol),
      judge,
    };
  });

  const unmatched = (oa.words || [])
    .filter((_, mi) => !modelMatched.has(mi))
    .map((w) => ({ surface: w.surface, seg: segText(w, oa), tips: segTips(w, oa).slice(0, 3) }));

  // Per-phase stage scores — recomputed with the scorer's own functions (identical to
  // quality-scores.json; kept live here so the artifact can't drift from the metric).
  const judged = words.map((w) => w.judge).filter(Boolean) as JudgeEntry[];
  const scores = {
    segF1: scoreSegmentationFidelity(oa, ga),
    contentF1: scoreContentFidelity(oa, ga, ol, gl),
    semantic: judged.length ? judged.reduce((a, j) => a + j.score, 0) / judged.length : null,
    coverage: ga.words.length ? pairs.length / ga.words.length : null,
    overall: phaseScores?.overallScore ?? null,
    textIntegrity: phaseScores?.textIntegrity ?? null,
  };

  return {
    phaseId, pali,
    goldenWordCount: ga.words.length, modelWordCount: (oa.words || []).length,
    scores, words, unmatched,
  };
}

/** judge-scores-<model>.json → phase → (golden wordId → entry). */
function loadJudge(reportDir: string, model: string): Map<string, Map<string, JudgeEntry>> {
  const byPhase = new Map<string, Map<string, JudgeEntry>>();
  const p = path.join(reportDir, `judge-scores-${model}.json`);
  if (!fs.existsSync(p)) return byPhase;
  try {
    const d = JSON.parse(fs.readFileSync(p, 'utf8'));
    for (const w of d.words || []) {
      if (!w?.phase || !w?.wordId) continue;
      if (!byPhase.has(w.phase)) byPhase.set(w.phase, new Map());
      byPhase.get(w.phase)!.set(w.wordId, {
        score: w.score, verdict: w.verdict, hallucination: !!w.hallucination, rationale: w.rationale || '',
      });
    }
  } catch { /* judge file unreadable → artifact just omits judge rows */ }
  return byPhase;
}

function loadPhaseScores(modelDir: string): Map<string, any> {
  const byPhase = new Map<string, any>();
  const p = path.join(modelDir, 'quality-scores.json');
  if (!fs.existsSync(p)) return byPhase;
  try {
    const d = JSON.parse(fs.readFileSync(p, 'utf8'));
    for (const ph of d.phases || []) if (ph?.phase) byPhase.set(ph.phase, ph);
  } catch { /* absent → phase strip omits overall/gate */ }
  return byPhase;
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
      const judgeByPhase = loadJudge(reportDir, model);
      const scoresByPhase = loadPhaseScores(modelDir);
      const phaseFiles = fs.readdirSync(modelDir).filter((f) => f.startsWith('pipeline-') && f.endsWith('.json')).sort();
      const phases = [];
      for (const pf of phaseFiles) {
        const phaseId = pf.replace('pipeline-', '').replace('.json', '');
        const data = JSON.parse(fs.readFileSync(path.join(modelDir, pf), 'utf8'));
        const built = buildPhase(data, phaseId, judgeByPhase.get(phaseId), scoresByPhase.get(phaseId));
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

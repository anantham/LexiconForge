/**
 * golden-diff — render a READABLE golden-vs-model comparison for a benchmark run.
 *
 * The scores tell you *how much*; this tells you *what*. For each phase it aligns the
 * model's anatomist output to the golden (LCS by surface) and prints, per word, the
 * golden segmentation + tooltips + senses next to the model's — so you can eyeball the
 * actual quality (segmentation, etymology, glosses) rather than trust a number. Words
 * the golden is silent on are shown too, flagged, so the golden's own COVERAGE is visible.
 *
 * Usage:
 *   npx tsx scripts/sutta-studio/golden-diff.ts [reportDir] [modelId]
 *   (defaults: latest report dir; every model in it)
 *
 * Writes golden-diff-<model>.md into the report dir and prints a summary.
 */
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { alignWords, scorePhase } from './quality-scorer';
import type { AnatomistPass, LexicographerPass } from '../../types/suttaStudio';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPORTS = path.resolve(__dirname, '../../reports/sutta-studio');

const latestReportDir = (): string => {
  const dirs = fs.readdirSync(REPORTS)
    .filter(n => /^\d{4}-\d{2}-\d{2}/.test(n))
    .filter(n => fs.existsSync(path.join(REPORTS, n, 'outputs')))
    .sort();
  if (!dirs.length) throw new Error('no report dirs found');
  return path.join(REPORTS, dirs[dirs.length - 1]);
};

const segText = (w: { segmentIds?: string[] }, a: AnatomistPass): string =>
  (w.segmentIds || []).map(id => (a.segments || []).find(s => s.id === id)?.text ?? '?').join('·');

const segTips = (w: { segmentIds?: string[] }, a: AnatomistPass): string[] => {
  const tips: string[] = [];
  for (const id of (w.segmentIds || [])) {
    const s = (a.segments || []).find(x => x.id === id);
    for (const t of (s?.tooltips || [])) tips.push(t);
  }
  return tips;
};

const wordSenses = (wordId: string, lex: LexicographerPass | null): string[] => {
  const e = (lex?.senses || []).find(x => x.wordId === wordId);
  return (e?.senses || []).map(s => s.english).filter(Boolean);
};

const renderPhase = (data: any, phaseId: string, modelId: string): string => {
  const out: string[] = [];
  const ga: AnatomistPass | null = data.golden?.anatomist ?? null;
  const oa: AnatomistPass = data.output.anatomist;
  const gl: LexicographerPass | null = data.golden?.lexicographer ?? null;
  const ol: LexicographerPass | null = data.output.lexicographer ?? null;
  const pali = (data.segments || []).map((s: any) => s.pali).join(' ');

  const score = scorePhase(
    { output: { anatomist: oa, lexicographer: ol as any, weaver: data.output.weaver, typesetter: data.output.typesetter ?? null }, segments: (data.segments || []).map((s: any) => ({ pali: s.pali || '' })), golden: data.golden ?? undefined } as any,
    phaseId, modelId,
  );

  out.push(`## ${phaseId}`);
  out.push('');
  out.push(`> **Pāli:** ${pali}`);
  out.push('');
  out.push(`**overall ${score.overallScore.toFixed(3)}** · fidelity ${score.fidelityScore == null ? 'n/a' : score.fidelityScore.toFixed(3)} `
    + `(seg ${score.segmentationFidelity == null ? 'n/a' : score.segmentationFidelity.toFixed(2)}, content ${score.contentFidelity == null ? 'n/a' : score.contentFidelity.toFixed(2)}) `
    + `· textIntegrity ${score.textIntegrity.toFixed(2)} · paliCov ${score.paliWordCoverage.toFixed(2)}`);
  out.push('');
  const goldenWordCount = ga?.words?.length ?? 0;
  const modelWordCount = oa?.words?.length ?? 0;
  out.push(`**Golden covers ${goldenWordCount} word(s); model produced ${modelWordCount}.** `
    + (goldenWordCount < modelWordCount ? `⚠️ ${modelWordCount - goldenWordCount} model word(s) have NO golden reference (unscored).` : ''));
  out.push('');

  if (!ga?.words?.length) {
    out.push('_No golden for this phase — model output shown without a reference._');
    out.push('');
    for (const w of (oa.words || [])) {
      out.push(`- **${w.surface}** → \`${segText(w, oa)}\``);
      const tips = segTips(w, oa); if (tips.length) out.push(`    - tips: ${tips.join(' · ')}`);
      const sen = wordSenses(w.id, ol); if (sen.length) out.push(`    - senses: ${sen.join(' | ')}`);
    }
    out.push('');
    return out.join('\n');
  }

  const pairs = alignWords(ga.words, oa.words || []);
  const modelMatched = new Set(pairs.map(([, mi]) => mi));

  out.push('### Golden words (with the model aligned to each)');
  out.push('');
  for (let gi = 0; gi < ga.words.length; gi++) {
    const gw = ga.words[gi];
    const pair = pairs.find(([g]) => g === gi);
    const gSeg = segText(gw, ga), gTips = segTips(gw, ga), gSen = wordSenses(gw.id, gl);
    out.push(`#### \`${gw.surface}\``);
    out.push(`- **golden:** \`${gSeg}\``);
    if (gTips.length) out.push(`    - tips: ${gTips.join(' · ')}`);
    if (gSen.length) out.push(`    - senses: ${gSen.join(' | ')}`);
    if (pair) {
      const mw = oa.words[pair[1]];
      const mSeg = segText(mw, oa), mTips = segTips(mw, oa), mSen = wordSenses(mw.id, ol);
      const segMatch = mSeg === gSeg ? '✅ same split' : '❌ different split';
      out.push(`- **model:** \`${mSeg}\`  (${segMatch})`);
      if (mTips.length) out.push(`    - tips: ${mTips.join(' · ')}`);
      if (mSen.length) out.push(`    - senses: ${mSen.join(' | ')}`);
    } else {
      out.push(`- **model:** ⚠️ no aligned word (dropped / different surface)`);
    }
    out.push('');
  }

  const unmatched = (oa.words || []).filter((_, mi) => !modelMatched.has(mi));
  if (unmatched.length) {
    out.push(`### Model words with NO golden reference (${unmatched.length}) — unscored`);
    out.push('');
    for (const w of unmatched) {
      out.push(`- **${w.surface}** → \`${segText(w, oa)}\``);
      const tips = segTips(w, oa); if (tips.length) out.push(`    - tips: ${tips.slice(0, 3).join(' · ')}`);
    }
    out.push('');
  }
  return out.join('\n');
};

const main = () => {
  const argDir = process.argv[2];
  const argModel = process.argv[3];
  const reportDir = argDir ? path.resolve(argDir) : latestReportDir();
  const outputsDir = path.join(reportDir, 'outputs');
  const models = fs.readdirSync(outputsDir, { withFileTypes: true })
    .filter(e => e.isDirectory()).map(e => e.name)
    .filter(m => !argModel || m === argModel);

  console.log(`\ngolden-diff — ${path.basename(reportDir)}\n`);
  for (const model of models) {
    const modelDir = path.join(outputsDir, model);
    const phaseFiles = fs.readdirSync(modelDir).filter(f => f.startsWith('pipeline-') && f.endsWith('.json')).sort();
    const md: string[] = [`# Golden-vs-model diff — ${model}`, `_report: ${path.basename(reportDir)}_`, ''];
    for (const pf of phaseFiles) {
      const phaseId = pf.replace('pipeline-', '').replace('.json', '');
      const data = JSON.parse(fs.readFileSync(path.join(modelDir, pf), 'utf8'));
      if (!data.output?.anatomist) continue;
      md.push(renderPhase(data, phaseId, model));
    }
    const outPath = path.join(reportDir, `golden-diff-${model}.md`);
    fs.writeFileSync(outPath, md.join('\n'), 'utf8');
    console.log(`  ${model}: wrote ${path.relative(process.cwd(), outPath)}`);
  }
  console.log('');
};

main();

/**
 * judge-content — a SEMANTIC content examiner for the sutta-studio benchmark.
 *
 * WHY: the deterministic `contentFidelity` is strict token-F1 against ONE golden. It
 * catches regressions well but structurally CANNOT reward enrichment — a model that adds
 * correct commentarial depth (or just words it differently) scores LOWER, not higher.
 * This judge fixes that with an asymmetric rubric an LLM applies per word:
 *   - REWARD correct enrichment (extra attested etymology / commentary / debate)  → up to 1.0
 *   - IGNORE paraphrase (different wording, same/greater correct meaning)
 *   - PENALIZE hallucination HARD (a confident false claim about the Pāli)          → ≤ 0.4
 *   - PENALIZE omission mildly (misses an essential golden point)
 *
 * This is a SEPARATE, optional dimension (contentSemantic) — it never replaces the
 * deterministic core, so the benchmark stays reproducible (ADR SUTTA-009). Scores are
 * stamped with judgeModel + judgeVersion; the judge runs at temperature 0.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/sutta-studio/judge-content.ts <reportDir> [modelId] [--judge <slug>]
 * Writes judge-scores-<model>.json into the report dir and prints per-model averages.
 */
import * as fs from 'fs';
import * as path from 'path';
import { alignWords } from './quality-scorer';
import type { AnatomistPass, LexicographerPass } from '../../types/suttaStudio';

const JUDGE_VERSION = '1.0';
const DEFAULT_JUDGE = 'google/gemini-2.5-flash';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

// ── content extraction (mirrors golden-diff) ─────────────────────────────────
const segsFor = (w: { segmentIds?: string[] }, a: AnatomistPass) =>
  (w.segmentIds || []).map((id) => (a.segments || []).find((s) => s.id === id)).filter(Boolean) as AnatomistPass['segments'];
const segLine = (w: { segmentIds?: string[] }, a: AnatomistPass) =>
  segsFor(w, a).map((s) => s.text).join('·');
const tips = (w: { segmentIds?: string[] }, a: AnatomistPass) =>
  segsFor(w, a).flatMap((s) => s.tooltips || []);
const senses = (wordId: string, lex: LexicographerPass | null) =>
  ((lex?.senses || []).find((e) => e.wordId === wordId)?.senses || []).map((s) => `${s.english}${s.nuance ? ` (${s.nuance})` : ''}`);

const wordContent = (w: any, a: AnatomistPass, lex: LexicographerPass | null) => ({
  surface: w.surface,
  segmentation: segLine(w, a),
  tooltips: tips(w, a),
  senses: senses(w.id, lex),
});

// ── judge prompt ─────────────────────────────────────────────────────────────
const JUDGE_RUBRIC = `You are a Pāli philology examiner scoring an automated analysis pipeline.

For each word you are given the GOLDEN reference analysis and a MODEL analysis of the SAME Pāli word (segmentation, etymology tooltips, English senses). Score how good the MODEL analysis is from 0.0 to 1.0. This rubric is deliberately ASYMMETRIC — read it carefully:

- REWARD ENRICHMENT: if the MODEL adds CORRECT depth the golden lacks (more etymology, attested commentary, canonical/Visuddhimagga references, genuine translator debate), that is BETTER. Score can EXCEED a plain golden match — up to 1.0. Do NOT cap a richer-but-correct analysis at the golden's level.
- IGNORE PARAPHRASE: different wording that conveys the same or greater correct meaning is fine. Never penalize a model for not using the golden's exact phrasing.
- PENALIZE HALLUCINATION HARD: if the MODEL states something FALSE about the Pāli — wrong root, invented etymology, wrong grammatical role, fabricated reference — score ≤ 0.4 even if the rest is good. A confident error is worse than an omission.
- PENALIZE OMISSION MILDLY: if the MODEL misses an ESSENTIAL point the golden carries (core meaning, key grammatical role), dock some points — but less than for a hallucination.

Anchors: faithful match of the golden's substance ≈ 0.8; faithful AND correctly enriched → up to 1.0; a real factual error → ≤ 0.4; mostly-right but missing the core sense ≈ 0.5.

Return JSON ONLY: { "words": [ { "wordId": string, "score": number, "verdict": "faithful"|"enriched"|"omission"|"error", "hallucination": boolean, "rationale": string } ] } — one entry per word, rationale one sentence.`;

const buildJudgePrompt = (
  items: Array<{ wordId: string; gold: ReturnType<typeof wordContent>; model: ReturnType<typeof wordContent> }>
): string => {
  const lines = items.map((it) => {
    const g = it.gold, m = it.model;
    return [
      `WORD ${it.wordId} — surface "${g.surface}"`,
      `  GOLDEN: seg=${g.segmentation} | tooltips=${JSON.stringify(g.tooltips)} | senses=${JSON.stringify(g.senses)}`,
      `  MODEL:  seg=${m.segmentation} | tooltips=${JSON.stringify(m.tooltips)} | senses=${JSON.stringify(m.senses)}`,
    ].join('\n');
  });
  return `${JUDGE_RUBRIC}\n\nWords to score:\n${lines.join('\n\n')}`;
};

const extractJson = (text: string): any => {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('no JSON object in judge response');
  return JSON.parse(body.slice(start, end + 1));
};

const callJudge = async (judgeModel: string, prompt: string): Promise<any> => {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error('OPENROUTER_API_KEY not set (run with --env-file=.env.local)');
  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: judgeModel,
      messages: [{ role: 'system', content: 'Return JSON only.' }, { role: 'user', content: prompt }],
      temperature: 0,
      response_format: { type: 'json_object' },
    }),
  });
  if (!res.ok) throw new Error(`judge HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content ?? '';
  return extractJson(text);
};

const judgeModelForRun = async (reportDir: string, modelId: string, judgeModel: string) => {
  const modelDir = path.join(reportDir, 'outputs', modelId);
  const phaseFiles = fs.readdirSync(modelDir).filter((f) => f.startsWith('pipeline-') && f.endsWith('.json')).sort();
  const perWord: any[] = [];
  for (const pf of phaseFiles) {
    const data = JSON.parse(fs.readFileSync(path.join(modelDir, pf), 'utf8'));
    const ga: AnatomistPass | null = data.golden?.anatomist ?? null;
    const oa: AnatomistPass | null = data.output?.anatomist ?? null;
    if (!ga?.words?.length || !oa?.words?.length) continue;
    const gl: LexicographerPass | null = data.golden?.lexicographer ?? null;
    const ol: LexicographerPass | null = data.output?.lexicographer ?? null;
    const pairs = alignWords(ga.words, oa.words);
    const items = pairs.map(([gi, mi]) => ({
      wordId: ga.words[gi].id,
      gold: wordContent(ga.words[gi], ga, gl),
      model: wordContent(oa.words[mi], oa, ol),
    })).filter((it) => it.gold.tooltips.length || it.gold.senses.length); // only golden-graded words
    if (!items.length) continue;
    const phaseId = pf.replace('pipeline-', '').replace('.json', '');
    const judged = await callJudge(judgeModel, buildJudgePrompt(items));
    for (const w of (judged.words || [])) perWord.push({ phase: phaseId, ...w });
    console.log(`  ${modelId}/${phaseId}: judged ${items.length} words`);
  }
  return perWord;
};

const main = async () => {
  const args = process.argv.slice(2);
  const judgeFlag = args.indexOf('--judge');
  const judgeModel = judgeFlag !== -1 ? args[judgeFlag + 1] : DEFAULT_JUDGE;
  const positional = args.filter((a, i) => a !== '--judge' && args[i - 1] !== '--judge');
  const reportDir = path.resolve(positional[0]);
  const onlyModel = positional[1];

  const outputsDir = path.join(reportDir, 'outputs');
  const models = fs.readdirSync(outputsDir, { withFileTypes: true })
    .filter((e) => e.isDirectory()).map((e) => e.name)
    .filter((m) => !onlyModel || m === onlyModel);

  console.log(`\njudge-content v${JUDGE_VERSION} — judge=${judgeModel} — ${path.basename(reportDir)}\n`);
  const summary: Array<{ model: string; avg: number; n: number; errors: number; enriched: number }> = [];
  for (const model of models) {
    let perWord: any[] = [];
    try {
      perWord = await judgeModelForRun(reportDir, model, judgeModel);
    } catch (e: any) {
      console.warn(`  ${model}: judge failed — ${e?.message || e}`);
      continue;
    }
    if (!perWord.length) continue;
    const avg = perWord.reduce((s, w) => s + (w.score ?? 0), 0) / perWord.length;
    const errors = perWord.filter((w) => w.hallucination || w.verdict === 'error').length;
    const enriched = perWord.filter((w) => w.verdict === 'enriched').length;
    fs.writeFileSync(
      path.join(reportDir, `judge-scores-${model}.json`),
      JSON.stringify({ judgeVersion: JUDGE_VERSION, judgeModel, model, avgContentSemantic: avg, words: perWord }, null, 2),
      'utf8',
    );
    summary.push({ model, avg, n: perWord.length, errors, enriched });
  }

  console.log('\n=== SEMANTIC CONTENT (judge) ===');
  console.log('Model            | words | avg    | enriched | errors');
  console.log('-----------------|-------|--------|----------|-------');
  for (const s of summary.sort((a, b) => b.avg - a.avg)) {
    console.log(`${s.model.padEnd(16)} | ${String(s.n).padStart(5)} | ${s.avg.toFixed(3).padStart(6)} | ${String(s.enriched).padStart(8)} | ${s.errors}`);
  }
};

main().catch((e) => { console.error('[judge] failed:', e); process.exitCode = 1; });

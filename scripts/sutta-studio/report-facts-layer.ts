/**
 * SUTTA-013 advisory report — the facts layer computed over EXISTING runs.
 *
 * Zero API cost: stored per-phase outputs re-score deterministically. This is
 * the dry-run that validates the v2.2 fidelity decomposition before adoption:
 * does splitting facts from prose change the picture, and does the flat
 * prose-precision band (0.29-0.37 across all models on v2.1) open up once
 * wording overlap stops being the yardstick?
 *
 * Usage:
 *   npx tsx scripts/sutta-studio/report-facts-layer.ts [runDir ...]
 *   (defaults to the two dirs pinned by the live leaderboard)
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { loadDpdSubsetFromFs } from '../../services/providers/dpd-loader-fs';
import type { LexiconEntry } from '../../services/providers/types';
import { scoreContentFidelityDetail, scoreSegmentationFidelity } from './quality-scorer';
import { scoreFactsDetail, scoreSenseFidelityDetail, type DpdLookup, type GrammarLookup, type MorphReading } from './facts-scorer';

const ROOT = 'reports/sutta-studio';
const DEFAULT_DIRS = ['2026-07-01T10-11-40-333Z', '2026-07-01T17-39-07-313Z'];
const dirs = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const runDirs = (dirs.length ? dirs : DEFAULT_DIRS).map((d) => path.join(ROOT, d));

// surface → entries: direct headword hit, else forms→lemma (verify-golden.ts resolution)
const dpd = loadDpdSubsetFromFs('mn10');
const HW = dpd.headwords as Record<string, LexiconEntry[]>;
const FORMS = (dpd.forms ?? {}) as Record<string, string[]>;
const dpdLookup: DpdLookup = (surface) => {
  const q = (surface || '').trim().toLowerCase().normalize('NFC');
  if (!q) return [];
  if (HW[q]?.length) return HW[q];
  const out: LexiconEntry[] = [];
  const seen = new Set<string>();
  for (const c of FORMS[q] ?? []) {
    for (const e of HW[c] ?? []) {
      const k = (e as { sourceId?: string }).sourceId ?? `${e.lemma}:${e.senses?.[0]?.english ?? ''}`;
      if (!seen.has(k)) {
        seen.add(k);
        out.push(e);
      }
    }
  }
  return out;
};

const grammarData = fs.existsSync('data/dpd/mn10/grammar.json')
  ? (JSON.parse(fs.readFileSync('data/dpd/mn10/grammar.json', 'utf8')).readings as Record<string, MorphReading[]>)
  : {};
const grammarLookup: GrammarLookup = (s) => grammarData[s];

type Row = {
  model: string;
  phases: number;
  contentF1: number;
  senseF1: number;
  senseP: number;
  senseR: number;
  facts: number;
  root: string;
  pos: string;
  morph: string;
};

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);

const byModel = new Map<string, ReturnType<typeof collectPhase>[]>();

function collectPhase(file: string) {
  const d = JSON.parse(fs.readFileSync(file, 'utf8'));
  const outAnat = d.output?.anatomist;
  const goldAnat = d.golden?.anatomist;
  const outLex = d.output?.lexicographer;
  const goldLex = d.golden?.lexicographer;
  if (!outAnat || !goldAnat) return null;
  return {
    content: scoreContentFidelityDetail(outAnat, goldAnat, outLex, goldLex),
    sense: scoreSenseFidelityDetail(outAnat, goldAnat, outLex, goldLex),
    facts: scoreFactsDetail(outAnat, goldAnat, dpdLookup, grammarLookup),
    seg: scoreSegmentationFidelity(outAnat, goldAnat),
  };
}

for (const runDir of runDirs) {
  const outputsDir = path.join(runDir, 'outputs');
  if (!fs.existsSync(outputsDir)) continue;
  for (const model of fs.readdirSync(outputsDir)) {
    const modelDir = path.join(outputsDir, model);
    if (!fs.statSync(modelDir).isDirectory()) continue;
    for (const f of fs.readdirSync(modelDir).filter((f) => f.startsWith('pipeline-phase-'))) {
      const r = collectPhase(path.join(modelDir, f));
      if (!r) continue;
      const arr = byModel.get(model) || [];
      arr.push(r);
      byModel.set(model, arr);
    }
  }
}

// judge means (independent instrument) for the weight-grid agreement check
const judgeMean = new Map<string, number>();
for (const runDir of runDirs) {
  for (const f of fs.existsSync(runDir) ? fs.readdirSync(runDir) : []) {
    const m = f.match(/^judge-scores-(.+)\.json$/);
    if (!m) continue;
    const j = JSON.parse(fs.readFileSync(path.join(runDir, f), 'utf8'));
    if (typeof j.avgContentSemantic === 'number') judgeMean.set(m[1], j.avgContentSemantic);
  }
}

const rows: Row[] = [];
const perModel = new Map<string, { seg: number; factsMacro: number; sense: number }>();
for (const [model, phases] of byModel) {
  const c = phases.map((p) => p?.content?.f1).filter((x): x is number => x != null);
  const sf = phases.map((p) => p?.sense?.f1).filter((x): x is number => x != null);
  const sp = phases.map((p) => p?.sense?.precision).filter((x): x is number => x != null);
  const sr = phases.map((p) => p?.sense?.recall).filter((x): x is number => x != null);
  const fa = phases.map((p) => p?.facts?.accuracy).filter((x): x is number => x != null);
  const fm = phases.map((p) => p?.facts?.macro).filter((x): x is number => x != null);
  const sg = phases.map((p) => p?.seg).filter((x): x is number => x != null);
  const sum = (fn: (p: NonNullable<ReturnType<typeof collectPhase>>['facts']) => number) =>
    phases.reduce((a, p) => a + (p?.facts ? fn(p.facts) : 0), 0);
  const rootCorrect = sum((f) => f!.root.correct);
  const rootTotal = sum((f) => f!.root.total);
  const rootFab = sum((f) => f!.root.fabricated);
  const rootSil = sum((f) => f!.root.silent);
  const rootDrop = sum((f) => f!.root.dropped);
  const rootSpray = sum((f) => f!.root.sprayed);
  const agg = (k: 'pos') => {
    const correct = sum((f) => f![k].correct);
    const total = sum((f) => f![k].total);
    return total ? `${((100 * correct) / total).toFixed(0)}% (${correct}/${total})` : '—';
  };
  const morphC = sum((f) => f!.morph.correct);
  const morphT = sum((f) => f!.morph.total);
  const covA = sum((f) => f!.morphCoverage.asserted);
  const covE = sum((f) => f!.morphCoverage.eligible);
  const morphCol = morphT
    ? `${((100 * morphC) / morphT).toFixed(0)}% of ${morphT} · cov ${covE ? ((100 * covA) / covE).toFixed(0) : 0}%`
    : `— · cov ${covE ? ((100 * covA) / covE).toFixed(0) : 0}%`;
  perModel.set(model, { seg: mean(sg), factsMacro: mean(fm), sense: mean(sf) });
  rows.push({
    model,
    phases: phases.length,
    contentF1: mean(c),
    senseF1: mean(sf),
    senseP: mean(sp),
    senseR: mean(sr),
    facts: mean(fm),
    root: rootTotal
      ? `${((100 * rootCorrect) / rootTotal).toFixed(0)}% (fab ${rootFab}·sil ${rootSil}·drop ${rootDrop}·spray ${rootSpray})`
      : '—',
    pos: agg('pos'),
    morph: morphCol,
  });
}

rows.sort((a, b) => b.contentF1 - a.contentF1);
const f = (x: number) => (Number.isNaN(x) ? '  —  ' : x.toFixed(3));
console.log('SUTTA-013 facts-layer dry run (facts = MACRO mean of root/pos/morph accuracies)');
console.log('');
console.log('model                | ph | contentF1 | senseF1 | senseP | senseR | facts | root                                   | pos           | morph');
console.log('---------------------|----|-----------|---------|--------|--------|-------|----------------------------------------|---------------|--------------');
for (const r of rows) {
  console.log(
    `${r.model.padEnd(20)} | ${String(r.phases).padStart(2)} | ${f(r.contentF1).padStart(9)} | ${f(r.senseF1).padStart(7)} | ${f(r.senseP).padStart(6)} | ${f(r.senseR).padStart(6)} | ${f(r.facts).padStart(5)} | ${r.root.padEnd(38)} | ${r.pos.padEnd(13)} | ${r.morph}`
  );
}

// ── weight-grid sensitivity: does the v2.2 fidelity ordering depend on the weights? ──
const GRID: Array<[number, number, number]> = [
  [0.5, 0.25, 0.25],
  [0.4, 0.3, 0.3],
  [0.34, 0.33, 0.33],
  [0.3, 0.4, 0.3],
  [0.3, 0.3, 0.4],
  [0.25, 0.5, 0.25],
];

const spearman = (a: string[], b: string[]): number => {
  const rank = (xs: string[]) => new Map(xs.map((x, i) => [x, i]));
  const ra = rank(a);
  const rb = rank(b);
  const common = a.filter((x) => rb.has(x));
  const n = common.length;
  if (n < 3) return NaN;
  let d2 = 0;
  for (const x of common) d2 += (ra.get(x)! - rb.get(x)!) ** 2;
  return 1 - (6 * d2) / (n * (n * n - 1));
};

const judgeOrder = [...judgeMean.entries()].sort((a, b) => b[1] - a[1]).map(([m]) => m);
console.log('\nWeight-grid sensitivity — fidelity = w_seg·segF1 + w_facts·facts(macro) + w_sense·senseF1');
console.log('(ranking per weights; ρ = Spearman rank agreement with the semantic judge, the independent instrument)');
console.log('');
for (const [ws, wf, wn] of GRID) {
  const ranked = [...perModel.entries()]
    .filter(([, v]) => !Number.isNaN(v.seg) && !Number.isNaN(v.factsMacro) && !Number.isNaN(v.sense))
    .map(([m, v]) => [m, ws * v.seg + wf * v.factsMacro + wn * v.sense] as const)
    .sort((a, b) => b[1] - a[1]);
  const rho = spearman(ranked.map(([m]) => m), judgeOrder);
  console.log(
    `  ${ws}/${wf}/${wn}`.padEnd(16) +
      `ρ=${Number.isNaN(rho) ? ' — ' : rho.toFixed(2)}  ` +
      ranked.map(([m, s]) => `${m}:${s.toFixed(3)}`).join(' > ')
  );
}
console.log('\nREPORT COMPLETE');

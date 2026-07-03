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
import { scoreContentFidelityDetail } from './quality-scorer';
import { scoreFactsDetail, scoreSenseFidelityDetail, type DpdLookup } from './facts-scorer';

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
    facts: scoreFactsDetail(outAnat, goldAnat, dpdLookup),
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

const rows: Row[] = [];
for (const [model, phases] of byModel) {
  const c = phases.map((p) => p?.content?.f1).filter((x): x is number => x != null);
  const sf = phases.map((p) => p?.sense?.f1).filter((x): x is number => x != null);
  const sp = phases.map((p) => p?.sense?.precision).filter((x): x is number => x != null);
  const sr = phases.map((p) => p?.sense?.recall).filter((x): x is number => x != null);
  const fa = phases.map((p) => p?.facts?.accuracy).filter((x): x is number => x != null);
  const agg = (k: 'root' | 'pos' | 'morph') => {
    const correct = phases.reduce((a, p) => a + (p?.facts?.[k].correct ?? 0), 0);
    const total = phases.reduce((a, p) => a + (p?.facts?.[k].total ?? 0), 0);
    return total ? `${((100 * correct) / total).toFixed(0)}% (${correct}/${total})` : '—';
  };
  rows.push({
    model,
    phases: phases.length,
    contentF1: mean(c),
    senseF1: mean(sf),
    senseP: mean(sp),
    senseR: mean(sr),
    facts: mean(fa),
    root: agg('root'),
    pos: agg('pos'),
    morph: agg('morph'),
  });
}

rows.sort((a, b) => b.contentF1 - a.contentF1);
const f = (x: number) => (Number.isNaN(x) ? '  —  ' : x.toFixed(3));
console.log('SUTTA-013 facts-layer dry run (v2.1 contentF1 vs facts/sense decomposition)');
console.log('');
console.log('model                | ph | contentF1 | senseF1 | senseP | senseR | facts | root         | pos           | morph');
console.log('---------------------|----|-----------|---------|--------|--------|-------|--------------|---------------|--------------');
for (const r of rows) {
  console.log(
    `${r.model.padEnd(20)} | ${String(r.phases).padStart(2)} | ${f(r.contentF1).padStart(9)} | ${f(r.senseF1).padStart(7)} | ${f(r.senseP).padStart(6)} | ${f(r.senseR).padStart(6)} | ${f(r.facts).padStart(5)} | ${r.root.padEnd(12)} | ${r.pos.padEnd(13)} | ${r.morph}`
  );
}
console.log('\nREPORT COMPLETE');

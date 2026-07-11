/**
 * SUTTA-013 part 2, stage 4 — the Align scorer + dry run.
 *
 * Scores a model's weaver links against the alignment golden. Pairs are
 * (golden word, english token) where tokens are identified by folded text +
 * occurrence number, NOT position — model tokenization need not match the
 * golden's, and both link encodings (linkedPaliId, linkedSegmentId→word)
 * are normalized. Model words map onto golden words via the same LCS
 * surface alignment the other fidelity metrics use.
 *
 * Scope rules, consistent with the house metric philosophy:
 *  - only golden-LINKED words are graded (golden-silent words contribute
 *    nothing — a golden gap, not a model error)
 *  - a graded word the model dropped still owes its links (drop penalty)
 *  - groups with empty English (Sujato merges segments) are ungraded
 *
 * Run:  npx tsx scripts/sutta-studio/align-scorer.ts   (dry run over the
 * leaderboard's pinned run dirs; deterministic, zero API cost)
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { alignWords } from './quality-scorer';
import type { AnatomistPass } from '../../types/suttaStudio';

type GoldenGroup = {
  phaseIds: string[];
  english: string;
  tokens: string[];
  links: Array<{ phaseId: string; wordId: string; surface: string; tokenIdxs: number[] }>;
};

const goldenFx = JSON.parse(fs.readFileSync('test-fixtures/sutta-studio-alignment-golden.json', 'utf8')) as { groups: GoldenGroup[] };
const anatGolden = JSON.parse(fs.readFileSync('test-fixtures/sutta-studio-anatomist-golden.json', 'utf8')).anatomist as Record<string, AnatomistPass>;

const groupByPhase = new Map<string, GoldenGroup>();
for (const g of goldenFx.groups) for (const pid of g.phaseIds) groupByPhase.set(pid, g);

const foldKey = (t: string) => {
  let x = (t || '').toLowerCase().normalize('NFC').replace(/[^a-z''-]/g, '');
  if (x.endsWith('ies') && x.length > 4) x = x.slice(0, -3) + 'y';
  else if (x.endsWith('es') && x.length > 4) x = x.slice(0, -2);
  else if (x.endsWith('s') && x.length > 3 && !x.endsWith('ss')) x = x.slice(0, -1);
  return x;
};

/** token list → per-position key "foldedText#occurrence" (empty folds get no key). */
const occurrenceKeys = (tokens: string[]): Array<string | null> => {
  const seen = new Map<string, number>();
  return tokens.map((t) => {
    const k = foldKey(t);
    if (!k) return null;
    const n = seen.get(k) ?? 0;
    seen.set(k, n + 1);
    return `${k}#${n}`;
  });
};

type WeaverToken = { tokenIndex?: number; text?: string; isGhost?: boolean; linkedPaliId?: string; linkedSegmentId?: string };

export function scoreAlignment(
  phaseId: string,
  outAnat: AnatomistPass,
  weaverTokens: WeaverToken[]
): { f1: number; precision: number; recall: number; tp: number; fp: number; fn: number } | null {
  const group = groupByPhase.get(phaseId);
  const goldAnat = anatGolden[phaseId];
  if (!group || !goldAnat || group.tokens.length === 0) return null; // empty-English groups ungraded
  const goldenLinks = group.links.filter((l) => l.phaseId === phaseId);
  if (goldenLinks.length === 0) return null;

  const goldenKeys = occurrenceKeys(group.tokens);
  const goldenPairs = new Set<string>();
  const gradedGoldWords = new Set<string>();
  for (const l of goldenLinks) {
    gradedGoldWords.add(l.wordId);
    for (const idx of l.tokenIdxs) {
      const k = goldenKeys[idx];
      if (k) goldenPairs.add(`${l.wordId}|${k}`);
    }
  }

  // model word -> golden word (LCS on surfaces)
  const pairs = alignWords(goldAnat.words, outAnat.words || []);
  const modelToGold = new Map<string, string>();
  for (const [gi, mi] of pairs) {
    const mw = (outAnat.words || [])[mi];
    if (mw) modelToGold.set(mw.id, goldAnat.words[gi].id);
  }

  // model english tokens in tokenIndex order → occurrence keys
  const ordered = [...weaverTokens].sort((a, b) => (a.tokenIndex ?? 0) - (b.tokenIndex ?? 0));
  const modelKeys = occurrenceKeys(ordered.map((t) => t.text || ''));

  let tp = 0;
  let fp = 0;
  const claimed = new Set<string>();
  ordered.forEach((t, i) => {
    if (t.isGhost) return;
    const rawWord = t.linkedPaliId || (t.linkedSegmentId ? t.linkedSegmentId.replace(/s\d+$/, '') : null);
    if (!rawWord) return;
    const goldWord = modelToGold.get(rawWord);
    if (!goldWord || !gradedGoldWords.has(goldWord)) return; // golden-silent → ungraded
    const k = modelKeys[i];
    if (!k) return;
    const pair = `${goldWord}|${k}`;
    if (goldenPairs.has(pair)) {
      tp++;
      claimed.add(pair);
    } else fp++;
  });
  const fn = goldenPairs.size - claimed.size; // includes dropped words' links (drop penalty)
  const denom = 2 * tp + fp + fn;
  if (goldenPairs.size === 0) return null;
  return {
    f1: denom > 0 ? (2 * tp) / denom : 0,
    precision: tp + fp > 0 ? tp / (tp + fp) : 0,
    recall: tp + fn > 0 ? tp / (tp + fn) : 0,
    tp,
    fp,
    fn,
  };
}

// ── dry run ──────────────────────────────────────────────────────────────────
if (process.argv[1]?.endsWith('align-scorer.ts')) {
  const ROOT = 'reports/sutta-studio';
  const DIRS = ['2026-07-01T10-11-40-333Z', '2026-07-01T17-39-07-313Z'];
  const rows = new Map<string, number[]>();
  const prs = new Map<string, { p: number[]; r: number[] }>();
  for (const d of DIRS) {
    const outputs = path.join(ROOT, d, 'outputs');
    if (!fs.existsSync(outputs)) continue;
    for (const model of fs.readdirSync(outputs)) {
      const mdir = path.join(outputs, model);
      if (!fs.statSync(mdir).isDirectory()) continue;
      for (const f of fs.readdirSync(mdir).filter((f) => f.startsWith('pipeline-phase-'))) {
        const data = JSON.parse(fs.readFileSync(path.join(mdir, f), 'utf8'));
        const outAnat = data.output?.anatomist;
        const weaver = data.output?.weaver;
        if (!outAnat || !weaver?.tokens) continue;
        const s = scoreAlignment(data.phaseId, outAnat, weaver.tokens);
        if (!s) continue;
        rows.set(model, [...(rows.get(model) ?? []), s.f1]);
        const pr = prs.get(model) ?? { p: [], r: [] };
        pr.p.push(s.precision);
        pr.r.push(s.recall);
        prs.set(model, pr);
      }
    }
  }
  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
  console.log('Align dry run (advisory) — F1 over (golden word ↔ english token) link pairs\n');
  console.log('model                | graded phases | alignF1 | P     | R');
  console.log('---------------------|---------------|---------|-------|------');
  [...rows.entries()]
    .sort((a, b) => mean(b[1]) - mean(a[1]))
    .forEach(([m, xs]) => {
      const pr = prs.get(m)!;
      console.log(`${m.padEnd(20)} | ${String(xs.length).padStart(13)} | ${mean(xs).toFixed(3).padStart(7)} | ${mean(pr.p).toFixed(3)} | ${mean(pr.r).toFixed(3)}`);
    });
  console.log('\nALIGN DRY RUN COMPLETE');
}

/**
 * SUTTA-013 part 1 — the deterministic FACTS layer.
 *
 * A word's root, POS, and morphology are FACTS with a human authority (DPD);
 * its explanation is PROSE. v2.1 grades both by token overlap with one
 * teacher's phrasing, which pushes models to mimic the golden's writing style
 * and is the main circularity residue (the golden's prose is Claude-worded).
 * This module splits them:
 *
 *   - scoreFactsDetail  — root/POS/morph checks per aligned CONTENT word,
 *     graded against DPD (golden's structured fields as fallback for the
 *     ~55 words DPD can't resolve). Deterministic; fabricated etymologies
 *     become a mechanical catch instead of a judge judgment call.
 *   - scoreSenseFidelityDetail — pooled micro-F1 over the lexicographer
 *     SENSES' english strings ONLY (golden-v2-curated, DPD-verbatim).
 *     Tooltip prose and sense nuance leave the deterministic metric
 *     entirely — they are the judge's territory (SUTTA-010).
 *
 * Both carry the SUTTA-012 drop penalty: a golden content word the model
 * dropped still owes its facts and its senses.
 *
 * Scoring stance on silence: a model that asserts NO root/morph for a word
 * whose authority has one is WRONG, not ungraded — otherwise models learn to
 * stay safe by omitting facts (the same survivorship shape SUTTA-012 killed).
 *
 * NOT wired into the ranked total yet: that is the v2.2 bump (with
 * SUTTA-014), and the 0.4·seg + 0.3·facts + 0.3·senseF1 weights need a
 * cross-family review first. Until then report-facts-layer.ts publishes the
 * advisory numbers.
 */

import type { AnatomistPass, LexicographerPass } from '../../types/suttaStudio';
import type { LexiconEntry } from '../../services/providers/types';
import { alignWords, tokenize } from './quality-scorer';

// ── DPD helpers (lifted from verify-golden.ts, the #27 audit script) ─────────

const norm = (s: string) => (s || '').trim().toLowerCase().normalize('NFC');

/** Strip a √root token to its bare stem: "√bhikkh 1 a (beg)" → "bhikkh". */
export const rootStem = (tok: string): string =>
  norm(tok)
    .replace(/^√/, '')
    .replace(/[0-9].*$/, '')
    .replace(/[^a-zāīūṁṅñṭḍṇḷṃ].*$/i, '')
    .trim();

/** All √roots asserted anywhere in a blob of text. */
export const extractRoots = (text: string): Set<string> => {
  const out = new Set<string>();
  const re = /√\s*([a-zāīūṁṅñṭḍḷṇṃ]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const stem = rootStem('√' + m[1]);
    if (stem) out.add(stem);
  }
  return out;
};

/** DPD's authoritative root set for a word: √roots from every homonym entry +
 *  the Sanskrit-root bracket in citations ("Sanskrit: bhikṣu [bhikṣ]"). */
export const dpdRoots = (entries: LexiconEntry[]): Set<string> => {
  const out = new Set<string>();
  for (const e of entries) {
    const raw = (e.rawExcerpt ?? '') + ' ' + (e.senses?.map((s) => s.citation ?? '').join(' ') ?? '');
    for (const r of extractRoots(raw)) out.add(r);
    const cite = e.senses?.map((s) => s.citation ?? '').join(' ') ?? '';
    const br = /\[([a-zāīūṁṅñṭḍḷṇṃ√\s]+)\]/gi;
    let m: RegExpExecArray | null;
    while ((m = br.exec(cite)) !== null) out.add(norm(m[1].replace(/√/g, '')));
  }
  return out;
};

export type DpdLookup = (surface: string) => LexiconEntry[];

// ── facts layer ──────────────────────────────────────────────────────────────

export type FactsBreakdown = { correct: number; total: number };

/** Root checks distinguish HOW a model was wrong: asserting alien roots is
 * fabrication (a deterministic hallucination signal, cross-checkable against
 * the judge's flags); asserting none is omission; a dropped word never got
 * the chance. All three are wrong, but they are different vices. */
export type RootBreakdown = FactsBreakdown & {
  fabricated: number;
  silent: number;
  dropped: number;
};

export type FactsDetail = {
  /** Micro accuracy: correct/total over all pooled checks. Dominated by
   * whichever category has the most checks — use macro for ranking. */
  accuracy: number | null;
  /** Macro accuracy: mean of the available categories' accuracies, so 111
   * easy word-class checks cannot drown 82 discriminative root checks. */
  macro: number | null;
  correct: number;
  total: number;
  root: RootBreakdown;
  pos: FactsBreakdown;
  morph: FactsBreakdown;
};

const wordTooltipBlob = (wordId: string, anat: AnatomistPass): string =>
  (anat.segments || [])
    .filter((s) => s.wordId === wordId)
    .flatMap((s) => s.tooltips || [])
    .join(' ');

const wordMorphPairs = (wordId: string, anat: AnatomistPass): Set<string> => {
  const out = new Set<string>();
  for (const seg of (anat.segments || []).filter((s) => s.wordId === wordId)) {
    for (const [k, v] of Object.entries(seg.morph || {})) {
      if (v != null && v !== '') out.add(`${k}=${String(v).toLowerCase()}`);
    }
  }
  return out;
};

/**
 * Root / POS / morph accuracy over golden CONTENT words.
 *
 * Per aligned golden content word:
 *  - ROOT (1 check when an authority root set exists — DPD for the surface,
 *    else the golden's own √tooltips): correct iff the model asserts ≥1 root
 *    in that set. Asserting none, or only alien roots, is wrong.
 *  - POS (1 check): model wordClass === golden wordClass (golden classes are
 *    DPD-verified upstream by verify-golden.ts).
 *  - MORPH (1 check per golden morph key=value pair): correct iff the model
 *    asserts the same pair anywhere in that word's segments.
 * A dropped golden content word contributes ALL its available checks as
 * wrong (SUTTA-012 drop penalty).
 */
export function scoreFactsDetail(
  outAnat: AnatomistPass,
  goldAnat: AnatomistPass | null | undefined,
  dpdLookup?: DpdLookup
): FactsDetail | null {
  if (!goldAnat?.words?.length) return null;
  const pairs = new Map(alignWords(goldAnat.words, outAnat.words || []).map(([gi, mi]) => [gi, mi]));
  const root: RootBreakdown = { correct: 0, total: 0, fabricated: 0, silent: 0, dropped: 0 };
  const pos: FactsBreakdown = { correct: 0, total: 0 };
  const morph: FactsBreakdown = { correct: 0, total: 0 };

  goldAnat.words.forEach((gw, gi) => {
    if (gw.wordClass !== 'content') return;
    const mi = pairs.get(gi);
    const mw = mi != null ? (outAnat.words || [])[mi] : undefined;

    // ROOT
    const dpdSet = dpdLookup ? dpdRoots(dpdLookup(gw.surface)) : new Set<string>();
    const authority = dpdSet.size > 0 ? dpdSet : extractRoots(wordTooltipBlob(gw.id, goldAnat));
    if (authority.size > 0) {
      root.total += 1;
      if (!mw) {
        root.dropped += 1;
      } else {
        const modelRoots = extractRoots(wordTooltipBlob(mw.id, outAnat));
        if ([...modelRoots].some((r) => authority.has(r))) root.correct += 1;
        else if (modelRoots.size > 0) root.fabricated += 1;
        else root.silent += 1;
      }
    }

    // POS
    pos.total += 1;
    if (mw && mw.wordClass === gw.wordClass) pos.correct += 1;

    // MORPH
    const goldPairs = wordMorphPairs(gw.id, goldAnat);
    if (goldPairs.size > 0) {
      const modelPairs = mw ? wordMorphPairs(mw.id, outAnat) : new Set<string>();
      for (const pair of goldPairs) {
        morph.total += 1;
        if (modelPairs.has(pair)) morph.correct += 1;
      }
    }
  });

  const total = root.total + pos.total + morph.total;
  const correct = root.correct + pos.correct + morph.correct;
  if (total === 0) return null;
  const catAccs = [root, pos, morph]
    .filter((c) => c.total > 0)
    .map((c) => c.correct / c.total);
  const macro = catAccs.length ? catAccs.reduce((a, b) => a + b, 0) / catAccs.length : null;
  return { accuracy: correct / total, macro, correct, total, root, pos, morph };
}

// ── senses-only fidelity ─────────────────────────────────────────────────────

/** A word's sense tokens: the lexicographer senses' ENGLISH strings only.
 * Nuance is Claude-worded prose → judge territory, excluded here. */
export const senseTokensById = (wordId: string, lex: LexicographerPass | null | undefined): string[] => {
  const entry = (lex?.senses || []).find((e) => e.wordId === wordId);
  if (!entry) return [];
  return (entry.senses || []).flatMap((s) => tokenize(s.english));
};

export type SenseFidelityDetail = {
  f1: number;
  precision: number;
  recall: number;
  tp: number;
  fp: number;
  fn: number;
};

/**
 * STRICT pooled micro-F1 over sense-english tokens of aligned words, with the
 * SUTTA-012 drop penalty. Same skeleton as scoreContentFidelityDetail, minus
 * tooltip prose and sense nuance. Words the golden is sense-silent on
 * contribute nothing.
 */
export function scoreSenseFidelityDetail(
  outAnat: AnatomistPass,
  goldAnat: AnatomistPass | null | undefined,
  outLex: LexicographerPass | null | undefined,
  goldLex: LexicographerPass | null | undefined
): SenseFidelityDetail | null {
  if (!goldAnat?.words?.length) return null;
  const pairs = alignWords(goldAnat.words, outAnat.words || []);
  const alignedG = new Set(pairs.map(([gi]) => gi));
  let tp = 0;
  let fp = 0;
  let fn = 0;
  let scored = 0;
  for (const [gi, mi] of pairs) {
    const goldTokens = new Set(senseTokensById(goldAnat.words[gi].id, goldLex));
    if (goldTokens.size === 0) continue;
    scored++;
    const modelTokens = new Set(senseTokensById((outAnat.words || [])[mi].id, outLex));
    for (const t of modelTokens) (goldTokens.has(t) ? tp++ : fp++);
    for (const t of goldTokens) if (!modelTokens.has(t)) fn++;
  }
  goldAnat.words.forEach((gw, gi) => {
    if (alignedG.has(gi)) return;
    const goldTokens = new Set(senseTokensById(gw.id, goldLex));
    if (goldTokens.size === 0) return;
    scored++;
    fn += goldTokens.size;
  });
  if (scored === 0) return null;
  const denom = 2 * tp + fp + fn;
  return {
    f1: denom > 0 ? (2 * tp) / denom : 0,
    precision: tp + fp > 0 ? tp / (tp + fp) : 0,
    recall: tp + fn > 0 ? tp / (tp + fn) : 0,
    tp,
    fp,
    fn,
  };
}

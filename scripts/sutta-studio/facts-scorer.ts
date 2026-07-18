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
/** English fragments the citation-bracket regex sometimes captures ("[in]",
 * "[of]") — never legitimate Pāli root stems; they would leniently credit
 * fabricated roots and pollute probe answer keys. */
const ROOT_NOISE = new Set(['in', 'of', 'to', 'on', 'or', 'and', 'the', 'is', 'a', 'an', 'at', 'it']);

export const dpdRoots = (entries: LexiconEntry[]): Set<string> => {
  const out = new Set<string>();
  const add = (stem: string) => {
    const s = stem.trim();
    if (s && !ROOT_NOISE.has(s)) out.add(s);
  };
  for (const e of entries) {
    const raw = (e.rawExcerpt ?? '') + ' ' + (e.senses?.map((s) => s.citation ?? '').join(' ') ?? '');
    for (const r of extractRoots(raw)) add(r);
    const cite = e.senses?.map((s) => s.citation ?? '').join(' ') ?? '';
    const br = /\[([a-zāīūṁṅñṭḍḷṇṃ√\s]+)\]/gi;
    let m: RegExpExecArray | null;
    while ((m = br.exec(cite)) !== null) add(norm(m[1].replace(/√/g, '')));
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

/** One legitimate DPD analysis of an inflected surface form. */
export type MorphReading = { pos?: string; gender?: string; case?: string; number?: string };
export type GrammarLookup = (cleanSurface: string) => MorphReading[] | undefined;

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
  /** Morph is a CONSISTENCY check on inflection (gender/case/number): each ADJUDICABLE
   * assertion — one on a key some DPD reading (or golden hint) actually specifies — is graded,
   * correct iff the model's value (canonicalised: `ins`≡`instr`, `m`≡`masc`, …) is an accepted
   * value for that key. Keys no reading covers are ignored, so a bogus assertion can't inflate
   * the macro. Omission of a known key is not charged; morphCoverage makes coverage visible. */
  morph: FactsBreakdown;
  morphCoverage: { asserted: number; eligible: number };
};

const wordTooltipBlob = (wordId: string, anat: AnatomistPass): string =>
  (anat.segments || [])
    .filter((s) => s.wordId === wordId)
    .flatMap((s) => s.tooltips || [])
    .join(' ');

const wordMorphMap = (wordId: string, anat: AnatomistPass): Map<string, string> => {
  const out = new Map<string, string>();
  for (const seg of (anat.segments || []).filter((s) => s.wordId === wordId)) {
    for (const [k, v] of Object.entries(seg.morph || {})) {
      if (v != null && v !== '') out.set(k, String(v).toLowerCase());
    }
  }
  return out;
};

const cleanSurface = (s: string) => (s || '').toLowerCase().normalize('NFC').replace(/[^a-zāīūṁṃṅñṭḍṇḷ'']/g, '');

/**
 * Canonical forms for the inflectional morph values, so equivalent abbreviations compare equal —
 * a model's `ins` and DPD's `instr` are the SAME case. Unknown values pass through lowercased.
 * Fixes review #4's `ins` vs `instr` false-negative.
 */
const MORPH_CANON: Record<string, Record<string, string>> = {
  case: {
    nom: 'nom', nominative: 'nom',
    acc: 'acc', accusative: 'acc',
    gen: 'gen', genitive: 'gen',
    dat: 'dat', dative: 'dat',
    ins: 'instr', instr: 'instr', instrumental: 'instr',
    abl: 'abl', ablative: 'abl',
    loc: 'loc', locative: 'loc',
    voc: 'voc', vocative: 'voc',
  },
  gender: {
    m: 'masc', masc: 'masc', masculine: 'masc',
    f: 'fem', fem: 'fem', feminine: 'fem',
    n: 'neut', nt: 'neut', neut: 'neut', neuter: 'neut',
  },
  number: {
    sg: 'sing', sing: 'sing', singular: 'sing',
    pl: 'plur', plur: 'plur', plural: 'plur',
    du: 'dual', dual: 'dual',
  },
};
/** The inflectional keys graded in morph. `pos` is deliberately excluded — part-of-speech is
 *  covered by the word-class check, and its vocabulary is open-ended. */
const GRADEABLE_MORPH_KEYS = ['gender', 'case', 'number'] as const;
const canonMorph = (key: string, value: string): string => {
  const v = value.trim().toLowerCase();
  return MORPH_CANON[key]?.[v] ?? v;
};

/**
 * Root / POS / morph accuracy over golden CONTENT words.
 *
 * Per aligned golden content word:
 *  - ROOT (1 check when an authority root set exists — DPD for the surface,
 *    else the golden's own √tooltips): correct iff the model asserts ≥1 root
 *    in that set. Asserting none, or only alien roots, is wrong.
 *  - POS (1 check): really a WORD-CLASS agreement check — model wordClass === golden wordClass
 *    (content/function; golden classes are DPD-verified upstream by verify-golden.ts). It is NOT
 *    morphological part-of-speech; the field is named `pos` for continuity.
 *  - MORPH (1 check per AUTHORITY-KNOWN gender/case/number key the model asserts): correct iff
 *    the model's canonicalised value is accepted by some reading. Denominator is authority-set,
 *    not model-chosen, so extra assertions can't game it.
 * A dropped golden content word contributes ALL its available checks as
 * wrong (SUTTA-012 drop penalty).
 */
export function scoreFactsDetail(
  outAnat: AnatomistPass,
  goldAnat: AnatomistPass | null | undefined,
  dpdLookup?: DpdLookup,
  grammarLookup?: GrammarLookup
): FactsDetail | null {
  if (!goldAnat?.words?.length) return null;
  const pairs = new Map(alignWords(goldAnat.words, outAnat.words || []).map(([gi, mi]) => [gi, mi]));
  const root: RootBreakdown = { correct: 0, total: 0, fabricated: 0, silent: 0, dropped: 0 };
  const pos: FactsBreakdown = { correct: 0, total: 0 };
  const morph: FactsBreakdown = { correct: 0, total: 0 };
  const morphCoverage = { asserted: 0, eligible: 0 };

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

    // MORPH — grade the model's inflectional claims (gender/case/number) against the DPD reading
    // set (golden hints as fallback). Scored per AUTHORITY-KNOWN key, over adjudicable assertions
    // only: a key that no reading specifies (e.g. an invented "note") is ignored, so a bogus
    // assertion can't add a free 1.0 category and inflate the macro (review #4). Omission of a
    // known key is NOT charged — silence ≠ wrong — but an unconfirmable assertion is not free.
    const dpdReadings = grammarLookup?.(cleanSurface(gw.surface));
    const goldHint = wordMorphMap(gw.id, goldAnat);
    const readings: MorphReading[] =
      dpdReadings && dpdReadings.length
        ? dpdReadings
        : goldHint.size
          ? [Object.fromEntries(goldHint) as MorphReading]
          : [];
    if (readings.length > 0 && mw) {
      morphCoverage.eligible += 1;
      const asserted = wordMorphMap(mw.id, outAnat);
      // Gradeable keys: ones the model asserts AND at least one reading specifies. A key no reading
      // covers is ignored (a bogus assertion can't inflate the macro — review #4); omission of a
      // known key is not charged (silence ≠ wrong).
      const gradeableKeys = GRADEABLE_MORPH_KEYS.filter(
        (key) =>
          asserted.get(key) != null &&
          readings.some((r) => {
            const rv = (r as Record<string, string | undefined>)[key];
            return rv != null && rv !== '';
          }),
      );
      if (gradeableKeys.length > 0) {
        morphCoverage.asserted += 1;
        morph.total += gradeableKeys.length;
        // Correlation-preserving: score against the SINGLE reading that matches the MOST of the
        // model's asserted keys — NOT per-key over the union of all readings, which would accept a
        // model that assembles a valid-looking analysis from keys drawn from different, mutually
        // exclusive readings (e.g. case from one reading, number from another). (codex review)
        let best = 0;
        for (const r of readings) {
          let matched = 0;
          for (const key of gradeableKeys) {
            const rv = (r as Record<string, string | undefined>)[key];
            if (
              rv != null &&
              rv !== '' &&
              canonMorph(key, String(rv)) === canonMorph(key, String(asserted.get(key)))
            ) {
              matched += 1;
            }
          }
          if (matched > best) best = matched;
        }
        morph.correct += best;
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
  return { accuracy: correct / total, macro, correct, total, root, pos, morph, morphCoverage };
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

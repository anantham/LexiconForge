/**
 * Segment builder for the Gītā deep reader — hand-authored curation in, the
 * concept reader's `AlignSegment` model out (types/liturgyAlign.ts).
 *
 * The Malayalam lane hand-writes its AlignSegments; Sanskrit gets a builder
 * because every written word ALSO carries a per-akshara sound row, and those
 * sounds must never be guessed (see components/liturgy/concept/devanagari.ts).
 * The builder enforces the two laws mechanically:
 *
 *  - SURFACE LAW (the SUTTA-025 rule, as in data/malayalam/urakam-*.ts):
 *    a token's pieces are the aksharas of its exact written surface, so they
 *    concatenate back to it by construction (segmentAksharas is lossless).
 *    Sandhi-fused words are NOT split into fake sub-tokens — the fused surface
 *    stays one written word, and the morpheme cut lives in the sound layer
 *    (each akshara binds to the morpheme(s) its sound overlaps), exactly how
 *    deriveAlignSegment.ts maps SPLIT compounds.
 *
 *  - SELF-VALIDATION (no guessed sounds on sacred text): a word renders its
 *    per-akshara sounds ONLY when romanizing its Devanāgarī reproduces the
 *    authoritative IAST (`romanizationMatches`). A word that fails and is
 *    explicitly flagged `iastFallback` renders as a single piece whose sound
 *    is the curated IAST itself. A word that fails WITHOUT the flag is a
 *    curation bug — it still falls back safely at runtime, and the surface
 *    test (tests/components/gita/gita-surface.test.ts) fails loudly.
 *
 * Anything inconsistent (morph slices that don't concatenate, unknown unit
 * references from the English witness) is recorded in BUILD_DIAGNOSTICS,
 * which the test asserts empty — a data error can never crash the page, and
 * can never ship silently either.
 */

import type { AlignSegment, AlignToken, AlignUnit, AlignSegmentPiece } from '../../types/liturgyAlign';
import { aksharasOf, romanizationMatches } from '../../components/liturgy/concept/devanagari';

/** A morpheme of one written word: an IAST slice of the surface + its meaning. */
export type MorphSpec = {
  /**
   * IAST slice of the WRITTEN surface (slices concatenate to the word's `i`).
   * Where sandhi welds two words into one vowel (jahāti + iha → jahātīha),
   * cut on either side of the shared vowel — the akshara containing it
   * overlaps both slices and honestly binds to BOTH units.
   */
  i: string;
  /** Plain-English meaning — becomes the unit gloss (tooltip + threads). */
  g: string;
  /** Segment-local unit id. Repeats share (tat tat → one unit). */
  u: string;
};

/** One written word of the verse line (source-verbatim surface). */
export type WordSpec = {
  d: string; // exact written Devanāgarī surface
  i: string; // authoritative IAST of that written surface
  /** Simple word: its meaning (defines unit `u`). Compounds use `m` instead. */
  g?: string;
  u?: string;
  /** Compound / sandhi-fused word: the morpheme cut. */
  m?: MorphSpec[];
  /** Scholarly aside (underlying pada before sandhi, contested reading…). */
  note?: string;
  /** Explicit honesty flag — see file header. */
  iastFallback?: boolean;
};

/** Punctuation / verse-marker token: rendered faint, never sounded. */
export type PunctSpec = { p: string; g?: string };

export type TokenSpec = WordSpec | PunctSpec;
const isPunct = (t: TokenSpec): t is PunctSpec => 'p' in t;

/** Curation-integrity findings; the surface test asserts this stays empty. */
export const BUILD_DIAGNOSTICS: string[] = [];

/** Words that shipped WITH the iastFallback flag (test cross-checks the list). */
export const IAST_FALLBACKS: string[] = [];

// Silent-in-Devanāgarī characters of an IAST slice: the avagraha apostrophe
// (elided a) and compound hyphens. Stripped for sound-length accounting only.
const soundLen = (iast: string) => iast.replace(/['’-]/g, '').length;

// English words the witness supplies that Sanskrit does not write (articles,
// copulas…). Unbound occurrences render as faint "ghost" glue — same move as
// deriveAlignSegment's EN_FUNCTION. An explicit {unit} binding always wins.
const EN_SUPPLIED = new Set([
  'the', 'a', 'an', 'of', 'and', 'or', 'is', 'are', 'was', 'were', 'be', 'been', 'am',
  'to', 'in', 'on', 'at', 'by', 'as', 'with', 'that', 'this', 'these', 'those',
  'it', 'its', 'he', 'his', 'him', 'she', 'her', 'they', 'their', 'them',
  'who', 'whom', 'whose', 'which', 'what', 'when', 'then', 'than', 'so', 'for',
  'from', 'do', 'does', 'did', 'has', 'have', 'had', 'will', 'would', 'let',
  'one', 'o', '—', '–',
]);
const bareWord = (s: string) =>
  s.toLowerCase().replace(/^[.,;:!?"'’“”—–()]+/u, '').replace(/[.,;:!?"'’“”—–()]+$/u, '');

/**
 * Parse an English witness line with inline bindings:
 *   `word{u-x}`  ·  `[multi word chunk]{u-x,u-y}`  ·  bare words unbound.
 */
export function parseWitness(src: string): { text: string; units: string[] }[] {
  const out: { text: string; units: string[] }[] = [];
  const re = /\[([^\]]+)\]\{([^}]+)\}|(\S+?)\{([^}]+)\}|(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    if (m[1] !== undefined) out.push({ text: m[1], units: m[2].split(',') });
    else if (m[3] !== undefined) out.push({ text: m[3], units: m[4].split(',') });
    else out.push({ text: m[5], units: [] });
  }
  return out;
}

export function gitaSegment(cfg: {
  id: string;
  title?: boolean;
  tokens: TokenSpec[];
  /** English witness line (Fable draft) with inline unit bindings. */
  en: string;
}): AlignSegment {
  const units: AlignUnit[] = [];
  const known = new Set<string>();
  const defineUnit = (id: string, gloss: string) => {
    if (!known.has(id)) {
      known.add(id);
      units.push({ id, gloss });
    }
    return id;
  };

  const saToken = (w: WordSpec): AlignToken => {
    const morphs: MorphSpec[] =
      w.m ?? (w.u && w.g !== undefined ? [{ i: w.i, g: w.g, u: w.u }] : []);
    for (const mo of morphs) defineUnit(mo.u, mo.g);
    const unitIds = [...new Set(morphs.map((mo) => mo.u))];

    const token: AlignToken = { text: w.d, units: unitIds, pronunciation: w.i };
    if (unitIds.length) token.relation = 'semantic';
    else if (w.g) token.gloss = w.g;
    if (w.note) token.note = w.note;

    if (w.m && w.m.map((mo) => mo.i).join('') !== w.i) {
      BUILD_DIAGNOSTICS.push(`${cfg.id}: "${w.i}" morph slices join to "${w.m.map((mo) => mo.i).join('')}"`);
    }

    const matches = romanizationMatches(w.d, w.i);
    if (w.iastFallback || !matches) {
      // Honest fallback: one piece, sound = the curated IAST — never a guess.
      if (w.iastFallback) IAST_FALLBACKS.push(w.d);
      if (!w.iastFallback && !matches) {
        BUILD_DIAGNOSTICS.push(`${cfg.id}: "${w.d}" ⇏ IAST "${w.i}" and not flagged iastFallback`);
      }
      return token;
    }

    // Akshara sound row: each orthographic syllable stacked with its sound,
    // bound to the morpheme(s) its sound overlaps (shared sandhi vowels → both).
    const ak = aksharasOf(w.d);
    const bounds: { start: number; end: number; u: string }[] = [];
    let p = 0;
    for (const mo of morphs) {
      const len = soundLen(mo.i);
      bounds.push({ start: p, end: p + len, u: mo.u });
      p += len;
    }
    const total = ak.reduce((n, a) => n + a.rom.length, 0);
    if (morphs.length && p !== total) {
      BUILD_DIAGNOSTICS.push(`${cfg.id}: "${w.i}" morph sound-length ${p} ≠ akshara sound-length ${total}`);
    }
    let cur = 0;
    token.segments = ak.map((a) => {
      const start = cur;
      const end = cur + a.rom.length;
      cur = end;
      const us = [...new Set(bounds.filter((b) => b.start < end && start < b.end).map((b) => b.u))];
      const piece: AlignSegmentPiece = { text: a.text, pronunciation: a.rom, akshara: true };
      if (us.length && morphs.length > 1) piece.units = us; // sub-word cut only where there is one
      return piece;
    });
    return token;
  };

  const punctToken = (t: PunctSpec): AlignToken => {
    const tok: AlignToken = { text: t.p, units: [], segments: [{ text: t.p, faint: true }] };
    if (t.g) tok.gloss = t.g;
    return tok;
  };

  const saTokens = cfg.tokens.map((t) => (isPunct(t) ? punctToken(t) : saToken(t)));

  const enParsed = parseWitness(cfg.en);
  const enTokens: AlignToken[] = enParsed.map((t) => {
    if (t.units.length) {
      for (const u of t.units) {
        if (!known.has(u)) BUILD_DIAGNOSTICS.push(`${cfg.id}: EN "${t.text}" binds unknown unit "${u}"`);
      }
      return { text: t.text, units: t.units, relation: 'interpretive' as const };
    }
    return EN_SUPPLIED.has(bareWord(t.text))
      ? { text: t.text, units: [], relation: 'ghost' as const }
      : { text: t.text, units: [] };
  });

  return {
    id: cfg.id,
    ...(cfg.title ? { title: true } : {}),
    gloss: enParsed.map((t) => t.text).join(' '),
    units,
    renderings: [
      { lang: 'sa-Deva', label: 'Sanskrit', tokens: saTokens },
      { lang: 'en', label: 'English (Fable draft)', by: 'fable-draft', tokens: enTokens },
    ],
  };
}

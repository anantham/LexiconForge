/**
 * Devanāgarī akshara segmenter + IAST romanizer — deterministic, and SELF-
 * VALIDATED: `romanizationMatches()` checks that romanizing a word's Devanāgarī
 * (`scriptAlt`) reproduces its authoritative IAST (`form`). The reader only
 * shows the Devanāgarī aksharas for words that pass, so it never displays a
 * guessed sound on sacred text — a failing word falls back to IAST.
 *
 * An akshara is the orthographic syllable: a base consonant + any virāma-joined
 * conjunct consonants + a vowel (inherent 'a', a mātrā, or an independent vowel)
 * + optional anusvāra/visarga. That's also the chanting beat.
 */

const VIRAMA = '्';
const ANUSVARA = 'ं';
const VISARGA = 'ः';
const CANDRABINDU = 'ँ';

// Consonant → IAST (without the inherent 'a'; that's added by the romanizer).
const CONS: Record<string, string> = {
  क: 'k', ख: 'kh', ग: 'g', घ: 'gh', ङ: 'ṅ',
  च: 'c', छ: 'ch', ज: 'j', झ: 'jh', ञ: 'ñ',
  ट: 'ṭ', ठ: 'ṭh', ड: 'ḍ', ढ: 'ḍh', ण: 'ṇ',
  त: 't', थ: 'th', द: 'd', ध: 'dh', न: 'n',
  प: 'p', फ: 'ph', ब: 'b', भ: 'bh', म: 'm',
  य: 'y', र: 'r', ल: 'l', व: 'v',
  श: 'ś', ष: 'ṣ', स: 's', ह: 'h', ळ: 'ḻ',
};
// Independent vowels.
const VOWEL: Record<string, string> = {
  अ: 'a', आ: 'ā', इ: 'i', ई: 'ī', उ: 'u', ऊ: 'ū',
  ऋ: 'ṛ', ॠ: 'ṝ', ऌ: 'ḷ', ॡ: 'ḹ',
  ए: 'e', ऐ: 'ai', ओ: 'o', औ: 'au', ऍ: 'ê', ऑ: 'ô',
};
// Dependent vowel signs (mātrās).
const MATRA: Record<string, string> = {
  'ा': 'ā', 'ि': 'i', 'ी': 'ī', 'ु': 'u', 'ू': 'ū',
  'ृ': 'ṛ', 'ॄ': 'ṝ', 'ॢ': 'ḷ', 'ॣ': 'ḹ',
  'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'au', 'ॅ': 'ê', 'ॉ': 'ô',
};

const isBase = (c: string) => CONS[c] !== undefined || VOWEL[c] !== undefined;

/** Split a Devanāgarī string into orthographic syllables (aksharas). */
export function segmentAksharas(s: string): string[] {
  const out: string[] = [];
  let cur = '';
  let prevVirama = false;
  for (const c of [...s]) {
    if (isBase(c) && !prevVirama && cur) {
      out.push(cur);
      cur = '';
    }
    cur += c;
    prevVirama = c === VIRAMA;
  }
  if (cur) out.push(cur);
  return out;
}

/** Romanize one Devanāgarī akshara to IAST. */
export function romanizeAkshara(a: string): string {
  let out = '';
  let pending = false; // a consonant emitted that still needs its vowel (inherent 'a')
  for (const c of [...a]) {
    if (CONS[c] !== undefined) {
      if (pending) out += 'a';
      out += CONS[c];
      pending = true;
    } else if (c === VIRAMA) {
      pending = false;
    } else if (MATRA[c] !== undefined) {
      out += MATRA[c];
      pending = false;
    } else if (VOWEL[c] !== undefined) {
      if (pending) { out += 'a'; pending = false; }
      out += VOWEL[c];
    } else if (c === ANUSVARA) {
      if (pending) { out += 'a'; pending = false; }
      out += 'ṃ';
    } else if (c === VISARGA) {
      if (pending) { out += 'a'; pending = false; }
      out += 'ḥ';
    } else if (c === CANDRABINDU) {
      if (pending) { out += 'a'; pending = false; }
      out += 'm̐';
    }
    // unknown marks (nukta, vedic accents) are dropped — they'd fail the gate
  }
  if (pending) out += 'a';
  return out;
}

/** Segment + romanize a Devanāgarī word into its aksharas with IAST sounds. */
export function aksharasOf(deva: string): { text: string; rom: string }[] {
  return segmentAksharas(deva).map((a) => ({ text: a, rom: romanizeAkshara(a) }));
}

// Normalize for the gate comparison. Beyond compose+lowercase, fold the
// orthographic/sandhi variants that differ between an IAST source and a
// Devanāgarī source for the SAME word (so they aren't false romanizer failures):
//   • the two anusvāra glyphs (ṁ ↔ ṃ);
//   • word-final m ≡ anusvāra (रूपम् "rūpam" ↔ IAST "rūpaṃ");
//   • word-final visarga / r / s are sandhi variants (धातुः "dhātuḥ" ↔ "dhātur").
// Applied to both sides, so it can only fold a known equivalence, never mask a
// real mid-word romanization error.
const norm = (s: string) =>
  s
    .normalize('NFC')
    .toLowerCase()
    .replace(/-/g, '') // IAST compounds use hyphens; Devanāgarī writes them solid
    .replace(/ṁ/g, 'ṃ')
    .replace(/m$/, 'ṃ')
    .replace(/[ḥrs]$/, 'ḥ');

/** Does romanizing `deva` reproduce the authoritative IAST `iast`? */
export function romanizationMatches(deva: string, iast: string): boolean {
  return norm(aksharasOf(deva).map((a) => a.rom).join('')) === norm(iast);
}

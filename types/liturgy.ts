/**
 * Liturgy Reader — types.
 *
 * Per the project's design philosophy (Live Machinery / Pluralism, Sahil 2024):
 * each chant is its own kind of thing. We don't force every chant into one
 * template. Each section in a chant has a `shape` field; the renderer
 * dispatches to a per-shape component.
 *
 * No single English rendering is canonical. Witnesses are attributed.
 * Original (Pāli, Devanāgarī, kanji, dharani phonemes) is the load-bearing
 * element; everything else is supporting triangulation evidence.
 */

/** Discriminated-union shape tag — extend as new chant types are added. */
export type SectionShape =
  | 'triple-script-witness'  // Pali + Devanāgarī + multiple English witnesses + words
  | 'comparative-translation' // Full prose with multiple English renderings side-by-side
  | 'verse-decomposed'        // Per-verse romaji + kanji + word-by-word
  | 'sound-formula'           // Dharani: phonemes prominent, speculative reconstruction aside
  | 'dedication-formula'      // Romaji + kanji/script + multiple renderings + tradition note
  | 'prose-commentary';       // Pure prose block — section header / framing text

export type Witness = {
  /** Who renders it this way — institution name, translator, or compiler. */
  by: string;
  /** Their text. */
  text: string;
  /** Optional URL to the source for verification (cite carefully). */
  url?: string;
  /** Optional copyright/license posture so we can render attribution honestly. */
  license?: string;
};

export type WordGloss = {
  /** The surface form as it appears in the chant (Pali romanized, kanji, etc.). */
  form: string;
  /** Optional script-alt — e.g. Devanāgarī for a Pali word, kanji for a romaji. */
  scriptAlt?: string;
  /**
   * Practical respelling for English readers (NOT IPA).
   * Example: "nah-MOH", "boo-DHAH-sah". Capital letters mark stress.
   */
  pronunciation?: string;
  /** Optional verbal root — e.g. √nam, √budh, √śri. */
  root?: string;
  /**
   * Morphological breakdown — compound parts, prefix decomposition,
   * derivational suffixes. Kept distinct from `gloss` so structure
   * surfaces before meaning. Example: "*bhaga* 'fortune' + *-vant* 'possessing'".
   */
  etymology?: string;
  /** Concise English meaning. */
  gloss: string;
  /** Optional further note (doctrinal context). */
  note?: string;
  /**
   * Citations grounding the etymology / gloss / pronunciation claims for
   * this word. Reuses the existing Citation type from types/suttaStudio.ts —
   * same chip aesthetic + same provenance contract as the Sutta Studio reader.
   */
  citations?: import('./suttaStudio').Citation[];
};

// ─────────────────────────────────────────────────────────────────────────────
// Per-shape section types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * One chant phrase — Pāli line + its parallel English in each witness +
 * optional per-phrase word data. This is the atomic unit the renderer
 * interleaves: Pāli line, then English line, then the next segment.
 *
 * For a Refuge formula this is one line ("Buddhaṁ saraṇaṁ gacchāmi."
 * paired with "I take refuge in the Buddha."). The Homage is one segment
 * with one Pāli line.
 */
export type TripleScriptWitnessSegment = {
  id: string;
  /** Pāli (Roman/IAST). One line typically, can be a short verse. */
  pali: string;
  /** Pāli in Devanāgarī. Same content, different script. */
  paliDeva?: string;
  /**
   * Parallel English per witness. Each witness's text is the English for
   * THIS segment (not the whole section). Renderer pairs this segment's
   * pali with this segment's witness text — that's the interleave.
   */
  witnesses: Witness[];
  /**
   * Word-by-word data scoped to this segment. The renderer can show these
   * as hover-tooltip detail on the segment's Pāli line.
   */
  words?: WordGloss[];
};

export type TripleScriptWitnessSection = {
  id: string;
  shape: 'triple-script-witness';
  /** Per-phrase segments. The whole section is rendered as interleaved Pāli + English pairs. */
  segments: TripleScriptWitnessSegment[];
  /** How many times the section is chanted (3× for the Refuges block, etc.). */
  repetitions?: number;
  /** Free-prose commentary, in a curator's voice (attributed at chant level). */
  commentary?: string;
};

export type ComparativeTranslationSection = {
  id: string;
  shape: 'comparative-translation';
  pali: string;          // Full prose Pali, line-broken with newlines
  paliDeva?: string;     // Optional Devanāgarī parallel
  witnesses: Witness[];  // 3-5 institutional renderings, each multi-line
  notesPerLine?: string; // Optional alignment guidance
  commentary?: string;
};

export type VerseDecomposedSection = {
  id: string;
  shape: 'verse-decomposed';
  /** A heading for the verse (e.g. "1. Kan Ze On"). */
  heading: string;
  /** Romanized form. */
  romaji: string;
  /** Native script (kanji + kana). */
  native: string;
  /** Per-character or per-word gloss. */
  words: WordGloss[];
  /** Commentary specific to this verse. */
  commentary?: string;
};

export type SoundFormulaSection = {
  id: string;
  shape: 'sound-formula';
  /** The dharani as phonemes, line-broken for chanting cadence. */
  phonemes: string;
  /** Native script (if known). */
  native?: string;
  /** Scholarly reconstruction notes — speculative Sanskrit etymology. */
  reconstruction?: string;
  /** A note acknowledging that semantic translation isn't the point of dharani. */
  framing?: string;
};

export type DedicationFormulaSection = {
  id: string;
  shape: 'dedication-formula';
  romaji: string;
  native?: string;
  witnesses: Witness[];
  /** Tradition / lineage note (e.g. "Compiled by Zhiyi from various Mahāyāna sources"). */
  traditionNote?: string;
  repetitions?: number;
};

export type ProseCommentarySection = {
  id: string;
  shape: 'prose-commentary';
  heading?: string;
  body: string;
};

export type LiturgySection =
  | TripleScriptWitnessSection
  | ComparativeTranslationSection
  | VerseDecomposedSection
  | SoundFormulaSection
  | DedicationFormulaSection
  | ProseCommentarySection;

// ─────────────────────────────────────────────────────────────────────────────
// Document-level
// ─────────────────────────────────────────────────────────────────────────────

export type LiturgySourceRef = {
  label: string;
  url?: string;
  note?: string;
};

export type LiturgyDoc = {
  /** URL slug. Must be unique and stable. */
  slug: string;
  /** Display title. */
  title: string;
  /** Subtitle / one-line framing for the chant. */
  subtitle?: string;
  /** Buddhist tradition tag. */
  tradition: 'theravada' | 'mahayana' | 'zen' | 'vajrayana' | 'lakota' | 'maple' | 'mixed';
  /** Practice context — when chanted, by whom. */
  context?: string;
  /** Sources — canonical (textual provenance) and ritual (where this version comes from). */
  sources?: {
    canonical?: LiturgySourceRef[];
    ritual?: LiturgySourceRef[];
  };
  /** Curator note — voice + attribution for commentary. */
  curator?: string;
  /** Top-level framing for the whole chant (before sections). */
  preamble?: string;
  /** Sections in order. */
  sections: LiturgySection[];
  /** Closing notes — historical context, related practices. */
  postamble?: string;
};

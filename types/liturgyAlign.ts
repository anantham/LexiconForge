/**
 * Concept-aligned phrase model — PROTOTYPE.
 *
 * The shipped liturgy renderer is Sanskrit-word-centric: each non-Latin
 * script hangs off a Sanskrit `WordGloss` via a single `scriptAlts[lang]`
 * string, matched 1:1. That breaks whenever a target language segments
 * meaning differently — Tibetan grammatical particles (ཀྱི/འི/ལ/ན) have no
 * Sanskrit word to attach to and render dead; one Sanskrit compound
 * (prajñāpāramitācaryā) explodes into many Tibetan tokens; repeated tokens
 * collide. Measured: 63% of Tibetan tokens, 52% Japanese, 38% Chinese
 * resolve to NO gloss.
 *
 * This model fixes the root cause: there is no canonical language. A phrase
 * is a shared spine of language-neutral **units** plus one **rendering**
 * (token stream) per language. Each token binds explicitly to the unit(s)
 * it realizes — so 1→many, many→1, reordering, repeated tokens, and
 * language-supplied grammatical glue ("ghost" units) are all representable.
 *
 * Units optionally point into the GLOBAL concept registry
 * (`types/conceptGraph.ts`, `data/concepts/*`) via `conceptId`, which stays
 * the cross-phrase identity layer (prajñā is "the same idea" everywhere).
 * This file is the per-phrase, in-context alignment layer that the global
 * surface→concept index cannot provide (it can't tell two identical
 * surface tokens apart within one phrase).
 */

/**
 * How a token relates to the unit it realizes. Mirrors the concept-graph's
 * `AttestationRelation` so the two layers speak the same vocabulary.
 *  - semantic        — the token *means* the unit in its language.
 *  - calque          — native compound built morpheme-for-morpheme (Tibetan
 *                      ཤེས་རབ "supreme-knowing" for prajñā).
 *  - transliteration — sounds like the source, carries no native meaning
 *                      (Chinese 般若 for prajñā).
 *  - interpretive    — a translator's chosen rendering (Conze "wisdom" vs
 *                      TNH "understanding").
 *  - ghost           — grammatical glue the target language supplies and the
 *                      source omits (Tibetan ཀྱི "of"); rendered faint.
 */
export type AlignRelation =
  | 'semantic'
  | 'calque'
  | 'transliteration'
  | 'interpretive'
  | 'ghost';

/** A language-neutral semantic slot within ONE phrase. */
export type AlignUnit = {
  /** Phrase-local id, e.g. `u-wisdom`. */
  id: string;
  /**
   * Plain-English meaning shown to the reader. MUST avoid grammar jargon
   * (no "genitive/accusative/…") per CURATION_PROTOCOL §3.4 — say it plainly
   * ("of", "in", "while").
   */
  gloss: string;
  /** Optional link into the global concept registry (`concept.<slug>`). */
  conceptId?: string;
  /**
   * `true` for grammatical glue some languages supply and the source omits.
   * Rendered faint; still glossed (never dead).
   */
  ghost?: boolean;
};

/**
 * A sub-piece of a token — a syllable (Tibetan), character (Chinese), or
 * morpheme (a Sanskrit compound). Rendered stacked: glyph on top, its
 * romanization directly beneath, so the pairing is unambiguous and each
 * piece is independently hoverable.
 */
export type AlignSegmentPiece = {
  text: string;
  pronunciation?: string;
  /**
   * Multiple named readings for one glyph — e.g. a Han character read in both
   * Mandarin (`zh`) and Sino-Japanese (`ja`). Shown as stacked sound lines.
   * Takes precedence over `pronunciation` when present.
   */
  readings?: Record<string, string>;
  /** This piece's own meaning (for the hover tooltip). */
  gloss?: string;
  /**
   * Override the parent token's unit binding for THIS piece — for precise
   * sub-alignment (e.g. the `prajñā` morpheme of a compound highlights only
   * the wisdom matches). Omit to inherit the token's units.
   */
  units?: string[];
  /** Grammatical sub-piece (nominalizer, agreement marker) — rendered faint. */
  faint?: boolean;
  /**
   * This piece carries SOUND, not meaning — a character in a phonetic
   * transliteration (Chinese 般 spelling "pra-", not meaning anything).
   * Rendered with a dotted underline; the tooltip says it's a sound, never a
   * false gloss. `gloss` holds the source syllable it spells (e.g. "pra").
   */
  phonetic?: boolean;
  /**
   * An akshara — one orthographic syllable of a meaning-bearing native-script
   * word (the प्र of प्रज्ञा). It carries SOUND, not its own meaning, so the
   * tooltip says "the sound X · part of [word]" and never glosses the syllable
   * as the whole word. Set `units` on the akshara only inside a multi-meaning
   * compound, so alignment threads stay precise; otherwise it inherits.
   */
  akshara?: boolean;
};

/** One token in one language's rendering of the phrase. */
export type AlignToken = {
  /** Surface form in this script. */
  text: string;
  /**
   * Which unit id(s) this token realizes. A Sanskrit compound token realizes
   * several; a particle realizes one ghost unit. `[]` is reserved for the
   * genuinely meaningless (pure punctuation) — never used to hide a real word.
   */
  units: string[];
  relation?: AlignRelation;
  pronunciation?: string;
  /**
   * Direct plain-English gloss for a token that realizes NO meaning-unit — a
   * pure grammatical particle (`units: []`). Shown in the hover tooltip so the
   * particle is never dead. Plain words only (no grammar jargon).
   */
  gloss?: string;
  /** Multiple named readings of one glyph (e.g. `{ zh, ja }`) — see AlignSegmentPiece. */
  readings?: Record<string, string>;
  /**
   * Optional finer breakdown into syllables/characters/morphemes. When present
   * the renderer stacks each piece with its romanization; when absent the
   * whole token is one stack.
   */
  segments?: AlignSegmentPiece[];
  /** Optional disambiguating aside (e.g. why a calque, scholarly note). */
  note?: string;
};

/** One language/script rendering of the phrase — a row in the interlinear. */
export type AlignRendering = {
  /** BCP-47 lang+script, e.g. `sa-Latn`, `bo-Tibt`, `zh-Hant`, `en`. */
  lang: string;
  /** Display label, e.g. `Sanskrit`, `Tibetan`, `Chinese (Xuanzang)`. */
  label: string;
  /** Witness/translator id for translations. */
  by?: string;
  tokens: AlignToken[];
};

/** A phrase: a shared unit spine + per-language token streams. */
export type AlignSegment = {
  id: string;
  /** Display gloss of the whole phrase. */
  gloss?: string;
  units: AlignUnit[];
  renderings: AlignRendering[];
};

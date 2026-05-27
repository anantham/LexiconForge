/**
 * Concept graph — cross-language, cross-script anchors.
 *
 * A `ConceptNode` is the abstract idea a word points to, *independent of which
 * language the word is in*. `śūnyatā` (Sa) · `suññatā` (Pi) · `空` (Zh) · `སྟོང་པ་ཉིད་` (Bo)
 * · `emptiness` (En) all attest the same Concept. Nobody is canonical; no
 * language is the pivot.
 *
 * This is the alignment primitive the liturgy reader uses for hover semantics.
 * Hovering any attestation surfaces *all other attestations of the same concept*
 * across every language/script/witness on the page.
 *
 * Spec lineage: this is the runtime implementation of `ConceptNode` defined in
 * docs/sutta-studio/TEXT_GRAPH.md §4 and used by docs/sutta-studio/POLYGLOT.md §3.
 *
 * Pluralism principles (per docs/Vision.md):
 *  - No language is the canonical anchor. Concept identity travels across all.
 *  - Multiple witnesses can disagree on which surface forms attest which concept.
 *    Tag attestations per-witness when divergence matters (e.g. Conze choosing
 *    one English word vs Red Pine choosing another).
 *  - Some cross-language relations are **not** conceptual — phonetic loans
 *    (`般若` ↔ `prajñā`) sound the same without sharing meaning. Mark those
 *    with `relation: 'transliteration'` on the attestation, so the renderer
 *    can show them differently (dashed line, separate panel, etc.).
 *  - Concepts can be contested. Use `Claim<T>` for confidence + source. A
 *    contested concept (`Ekāyano` = "Direct" vs "Solitary" vs "Convergent")
 *    is multiple ConceptNodes whose attestation sets overlap on the same
 *    Pāli word — the Polysemy Rotator pattern from Vision.md §3.A.
 */

import type { Citation } from './suttaStudio';

/** ISO language code. Open-ended — accepts canonical codes plus project-defined ones. */
export type LangCode =
  | 'sa'  // Sanskrit
  | 'pi'  // Pāli
  | 'zh'  // Chinese (classical / Buddhist Chinese)
  | 'ja'  // Japanese (incl. Sino-Japanese kanbun-yomi)
  | 'ko'  // Korean
  | 'vi'  // Vietnamese
  | 'bo'  // Tibetan
  | 'mn'  // Mongolian
  | 'en'  // English
  | 'he'  // Hebrew
  | 'el'  // Greek (classical / Koine)
  | 'la'  // Latin
  | 'ar'  // Arabic
  | string;

/**
 * Script identifier following BCP-47 / ISO 15924 conventions where
 * available. `Latn` covers IAST + general romanization. Project-defined
 * scripts (e.g. `IAST-Sujato` for Sujato's pronunciation respelling) are
 * allowed.
 */
export type ScriptCode =
  | 'Latn'   // Latin / IAST / romanization
  | 'Deva'   // Devanāgarī
  | 'Hant'   // Traditional Han
  | 'Hans'   // Simplified Han
  | 'Jpan'   // Japanese mixed (kanji + kana)
  | 'Hang'   // Hangul
  | 'Tibt'   // Tibetan
  | 'Mong'   // Mongolian
  | 'Hebr'   // Hebrew
  | 'Grek'   // Greek
  | 'Arab'   // Arabic
  | 'IPA'    // International Phonetic Alphabet
  | string;

/**
 * The kind of relationship between an attestation and its concept. Most
 * attestations are `semantic` — the surface word *means* the concept in
 * its language. The other kinds carry the cross-language relationships
 * that aren't translation in the meaning-equivalence sense.
 *
 * Renderer uses this to vary visual treatment: `semantic` attestations
 * get the default highlight; `transliteration` gets a dashed arrow or
 * differently-coloured halo to mark "same sound, not same meaning".
 */
export type AttestationRelation =
  /** Standard case: this surface form means the concept in its language. */
  | 'semantic'
  /**
   * Phonetic loan: the surface form sounds like another language's word
   * for the concept but doesn't carry the meaning natively. Buddhist
   * Chinese 般若 transliterates Sanskrit *prajñā* — pronounced bōrě, the
   * characters' usual meanings ("kind of" + "if") are unrelated to wisdom.
   */
  | 'transliteration'
  /**
   * Native compound translating the foreign concept morpheme-for-morpheme.
   * Tibetan ཤེས་རབ ("supreme knowing") calques Sanskrit *prajñā* via a
   * native two-syllable compound, not phonetics.
   */
  | 'calque'
  /**
   * The attestation is *interpretive* — the translator/witness chose this
   * word as their rendering, but other translators of the same source chose
   * differently. "Wisdom" vs "Insight" vs "Knowledge" for *prajñā* are
   * different interpretive renderings, each `relation: 'interpretive'`.
   */
  | 'interpretive'
  /**
   * Word supplied by the target language but absent in the source. English
   * articles ("the"), copulas ("is"), prepositions ("of") that Sanskrit
   * compresses into morphology or omits. Rendered at low opacity per
   * docs/Vision.md §3.B "Transparent Loom".
   */
  | 'ghost';

/**
 * One attestation of a concept — a specific surface form in a specific
 * language/script/witness that points to the concept.
 */
export type ConceptAttestation = {
  language: LangCode;
  script: ScriptCode;
  text: string;
  /**
   * Optional witness identifier (translator/recension/sangha). Use when the
   * attestation is witness-specific — e.g. MAPLE chant text vs Conze 1958.
   * If absent, the attestation belongs to the language/script generally
   * (canonical Sanskrit, canonical Chinese T251, etc.).
   */
  witness?: string;
  /** How this attestation relates to the concept. Defaults to `semantic` if omitted. */
  relation?: AttestationRelation;
  /** Optional pronunciation respelling (display-only). */
  pronunciation?: string;
  /** Optional note — disambiguating, scope, scholarly aside. */
  note?: string;
};

/**
 * A concept that surfaces in multiple languages/scripts/witnesses. The
 * canonical reference point for cross-tradition alignment.
 */
export type ConceptNode = {
  /** Stable ID. Convention: `concept.<english-slug>` e.g. `concept.wisdom-prajna`. */
  id: string;
  /** Display label (defaults to English when omitted). */
  preferredLabel: string;
  /** Display language for the label. */
  preferredLanguage?: LangCode;
  /** All the surface forms across languages/scripts/witnesses. */
  attestations: ConceptAttestation[];
  /** Free-prose definition. Should be grounded — see `citations`. */
  definition?: string;
  /**
   * Citations supporting the definition + the cross-language equivalences.
   * Every authoritative claim should trace to a source. AI-drafted concepts
   * without citations should be flagged via `ungroundedCitation()`.
   */
  citations?: Citation[];
  /**
   * `true` if scholars disagree on the meaning, scope, or correct rendering.
   * Renders a contested-badge in the UI; invites comparison rather than
   * single-answer presentation.
   */
  contested?: boolean;
  /**
   * Other concepts this one is closely related to (siblings, broader/narrower
   * concepts). Free-form linking; not a strict ontology.
   */
  relatedConcepts?: string[];
  /** Project notes, scope, what's-not-included. */
  notes?: string;
};

/** Registry shape — a flat keyed-by-id lookup. */
export type ConceptRegistry = Record<string, ConceptNode>;

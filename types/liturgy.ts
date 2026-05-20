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
  /**
   * Word-level alignment from this English witness back to the segment's Pāli
   * words. Parallel-indexed to the witness's whitespace-split word array;
   * `alignTo[i]` is the index of the Pāli word (in the segment's `words[]`)
   * that English word `i` corresponds to, or `-1` for no alignment (articles,
   * conjunctions, supplied English with no Pāli source).
   *
   * Multiple English words can map to the same Pāli word (n-to-1 is common —
   * e.g., "Fully Self-Enlightened One" all aligns to *sammā-sambuddhassa*).
   */
  alignTo?: number[];
  /**
   * Optional per-token morpheme target. Parallel-indexed to `alignTo`.
   * `morphemeAlignTo[i]` is the morpheme index (within the Pāli word that
   * `alignTo[i]` points to) that English word `i` should anchor its arrow
   * to. `null`/absent → the renderer falls back to its positional heuristic
   * (i-th English token mapped to a word → i-th morpheme).
   *
   * Why this exists: when English reorders the morphemes of a Pāli word,
   * the positional heuristic crosses the arrows. Example: `kusalena` =
   * `kusal` (skilled) + `ena` (by-an-agent); Amaravati renders it "one …
   * skilled", reversing the order, so the heuristic sends `kusal`'s arrow
   * to "one". Authoring `morphemeAlignTo` fixes the pairing explicitly.
   */
  morphemeAlignTo?: (number | null)[];
};

/**
 * A morpheme is a sub-unit of a Pāli word — root, prefix, suffix, or stem.
 * Each morpheme is independently hover-targetable. Mirrors Sutta Studio's
 * `WordSegment` pattern (types/suttaStudio.ts) so the same hover-glimpse
 * aesthetic carries over.
 *
 * Example: the word `Namo` has two morphemes:
 *   - {text: 'Nam', type: 'root', gloss: 'to bow', root: '√nam'}
 *   - {text: 'o',   type: 'suffix', gloss: 'nominative singular ending'}
 *
 * The renderer splits the surface form by morpheme `text`, emits one hover
 * span per morpheme, each with its own tooltip.
 *
 * Morphemes must be listed in order and their concatenation must reproduce
 * the surface form (case-insensitive). If they don't, the whole word falls
 * back to the word-level tooltip.
 */
export type WordMorpheme = {
  /** The literal surface fragment, matching a substring of WordGloss.form (case-insensitive). */
  text: string;
  /**
   * Kind of morpheme. `root | prefix | suffix | stem` are the standard
   * Indo-European decomposition types. `phonetic` and `semantic` cover
   * Buddhist Chinese decompositions where each character either
   * transliterates a Sanskrit syllable (phonetic loan — 般 for "pra-",
   * 涅 for "nir-") or carries an actual meaning that contributes to the
   * compound (semantic — 觀 "observe" + 自 "self" + 在 "exist" = the
   * meaning of Avalokita).
   */
  type: 'root' | 'prefix' | 'suffix' | 'stem' | 'phonetic' | 'semantic';
  /** Concise meaning shown in the tooltip. */
  gloss: string;
  /** Pronunciation respelling for this morpheme specifically (optional; usually on the root). */
  pronunciation?: string;
  /** Verbal root marker — e.g. √nam, √budh — when applicable. */
  root?: string;
  /** Optional further note (etymology trace, sandhi behavior). */
  note?: string;
  /** Per-morpheme grounding citations. */
  citations?: import('./suttaStudio').Citation[];
  /**
   * Concept node IDs this morpheme attests. When set, hovering this
   * morpheme highlights every other token on the page (any language,
   * any script, any witness) that attests the same concept.
   *
   * Looked up against the concept registry at render time. See
   * types/conceptGraph.ts and data/concepts/.
   */
  conceptIds?: string[];
};

/**
 * Subtle text-color accents for marking refrain rhythm. The Refuges chant
 * has `X saraṇaṁ gacchāmi` repeating with X varying — coloring `buddhaṁ`
 * one hue, `dhammaṁ` another, `saṅghaṁ` a third makes the substitution
 * pattern visible. Accent rides on alignment: English words aligned to a
 * Pāli word inherit its accent.
 */
export type AccentColor = 'sky' | 'amber' | 'rose' | 'violet' | 'emerald';

export type WordGloss = {
  /** The surface form as it appears in the chant (Pali romanized, kanji, etc.). */
  form: string;
  /**
   * Optional subtle text-color accent. Use sparingly — only when a word
   * carries pattern/rhythm information (e.g. the variable position in a
   * repeated formula). Leaving this unset = neutral slate.
   */
  accent?: AccentColor;
  /** Optional script-alt — e.g. Devanāgarī for a Pali word, kanji for a romaji. */
  scriptAlt?: string;
  /**
   * Per-script alternates keyed by BCP-47 lang tag. When the active
   * script matches one of these keys, the renderer uses this string to
   * match tokens — i.e. hovering 般若 in Chinese mode shows this WordGloss's
   * tooltip iff `scriptAlts['zh-Hant'] === '般若'`. Pair with a ScriptVariant
   * `tokens` hint that emits 般若 as a single token rather than 般 and 若
   * separately.
   */
  scriptAlts?: { [lang: string]: string };
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
   * Per-morpheme breakdown for sub-token hover. When present, the renderer
   * shows separate tooltips per morpheme (each part of the word independently).
   * When absent, the whole word gets a single hover tooltip from etymology+gloss.
   */
  morphemes?: WordMorpheme[];
  /**
   * Per-script morpheme breakdowns keyed by BCP-47 lang tag. When the
   * active script matches, the renderer uses this array (instead of
   * `morphemes`) to split the token. Useful for Chinese:
   *   - phonetic loans like 般若 = 般 ("pra-") + 若 ("-jñā")
   *   - semantic doublets like 罣礙 = 罣 ("obstruct") + 礙 ("block")
   *
   * Each morpheme.text must be a substring of `scriptAlts[lang]` and the
   * concatenation must reproduce the alt-form, same contract as the
   * Latin morphemes.
   */
  scriptMorphemes?: { [lang: string]: WordMorpheme[] };
  /**
   * Citations grounding the etymology / gloss / pronunciation claims for
   * this word. Reuses the existing Citation type from types/suttaStudio.ts —
   * same chip aesthetic + same provenance contract as the Sutta Studio reader.
   */
  citations?: import('./suttaStudio').Citation[];
  /**
   * Concept-graph IDs this whole word attests. Used when the word doesn't
   * have a `morphemes` breakdown — a single-morpheme word can still
   * participate in the concept graph at word level.
   *
   * When `morphemes` is present, prefer tagging morphemes individually
   * (more granular hover filtering).
   */
  conceptIds?: string[];
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
/**
 * One script representation of the source text. Used for chants whose
 * canonical form lives in more than two scripts — e.g. the Heart Sutra is
 * received in Sanskrit (IAST + Devanāgarī), Chinese (Xuanzang's 玄奘
 * 7th-century recension), Tibetan, Japanese, Korean. A segment can carry
 * many of these and the script-cycle UI cycles through all of them.
 *
 * `lang` is a BCP-47 tag (`sa-Latn`, `sa-Deva`, `zh-Hant`, `bo-Tibt`,
 * `ja-Jpan`, …). The renderer reads the script subtag (`Latn`, `Deva`)
 * to decide tokenisation + hover behaviour:
 *   - `Latn` → IAST tokenizer + per-word hover (matches WordGloss.form)
 *   - `Deva` → Devanāgarī tokenizer + per-word hover (matches WordGloss.scriptAlt)
 *   - anything else → plain styled text, no tokenisation
 *
 * Backward-compat: if a segment lacks `scripts`, the renderer derives
 * a two-element list from `pali` + `paliDeva` so existing chants are
 * unchanged.
 */
export type ScriptVariant = {
  /** BCP-47 tag — language + script subtag. */
  lang: string;
  /** Display label for the script-cycle indicator (e.g. "Sanskrit", "Chinese (Xuanzang)"). */
  label: string;
  /** The text in this script. */
  text: string;
  /** Optional source attribution / translator / recension note. */
  source?: string;
  /**
   * Optional tokenisation hint. When present, the renderer splits `text`
   * into these units rather than running the per-script default tokenizer.
   * Crucial for Chinese / Japanese where the natural unit is a multi-char
   * compound (般若, 波羅蜜多) but the per-character fallback would split it.
   *
   * Each token must be a substring of `text`; their concatenation (with
   * any gaps between them) reproduces the original. The renderer scans
   * for them left-to-right and emits everything between as a gap token.
   */
  tokens?: string[];
  /**
   * Optional Roman / phonetic transliteration of the whole line. Rendered
   * as a smaller line beneath the script text when the reader has the
   * "Show transliteration" setting on — so non-readers of Tibetan / Chinese
   * / Sanskrit can still pronounce it. Use:
   *   - pinyin for `zh-Hant` / `zh-Hans`
   *   - romaji (Sino-Japanese) for `ja-Jpan`
   *   - Tibetan phonetic ("chen-ré-zig" style) for `bo-Tibt`
   *   - IAST for `sa-Deva` (matches the parallel `sa-Latn` content)
   *
   * Omit for `sa-Latn` / `pi-Latn` — those scripts are already Roman.
   */
  transliteration?: string;
};

export type TripleScriptWitnessSegment = {
  id: string;
  /** Pāli (Roman/IAST). One line typically, can be a short verse. */
  pali: string;
  /** Pāli in Devanāgarī. Same content, different script. */
  paliDeva?: string;
  /**
   * Optional N-ary multi-script representation. When present, the
   * renderer's script-cycle ignores `pali` + `paliDeva` and cycles
   * through these instead. Useful for trans-tradition chants (Heart Sutra
   * in Sanskrit + Chinese + Tibetan + Japanese).
   */
  scripts?: ScriptVariant[];
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
  /**
   * Optional per-segment commentary in the curator's voice. Rendered as a
   * collapsed-by-default disclosure below the English line. Supports
   * markdown-lite (italic, bold) plus `[[term]]` wiki-style references
   * which the renderer italicises in place.
   */
  note?: string;
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
  /**
   * Render segments with the larger "stone marker" text size, independent of
   * whether this is the opening section. Use when a chant has a title-as-artifact
   * section first (which gets isOpening + the 80vh centering), but the body that
   * follows should stay visually weighty rather than drop a size level.
   * Defaults to the isOpening behavior when omitted.
   */
  large?: boolean;
  /**
   * When the section is the page's opening, default to a vertically-centred
   * 80vh "stone marker" layout — good for a single recognizable line like the
   * Namo Tassa homage. Set `compactOpening: true` for short title-like
   * artifacts that shouldn't take a full viewport height before the chant
   * body begins below.
   */
  compactOpening?: boolean;
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
  /** Native script (if known) — single-script convenience field. */
  native?: string;
  /**
   * Alternative script representations. When present, the renderer cycles
   * through them on click — same N-ary script model used in
   * triple-script-witness. Use this when a dharani is received in more
   * than one script-tradition (Sanskrit Devanāgarī + Chinese + Tibetan…).
   */
  scripts?: ScriptVariant[];
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

/**
 * A Buddhist community — monastery, lay sangha, or practice group whose
 * particular form of a chant lives in this reader. Each LiturgyDoc belongs
 * to exactly one sangha; the same chant (e.g. the Heart Sutra) is
 * represented as separate docs when multiple sanghas chant it with
 * distinct English translations or recensions.
 *
 * Routing: `/liturgy/<sangha-slug>` lists a sangha's chants; the chant
 * page lives at `/liturgy/<sangha-slug>/<chant-slug>`. Sluggs are unique
 * within a sangha; can repeat across sanghas (Heart Sutra exists under
 * both `maple/heart-sutra` and `bodhi-sangha/heart-sutra`).
 */
/**
 * One milestone in a sangha's daily rhythm — the bell that wakes
 * everyone up, the start of chanting, work-period, meal, sitting,
 * evening close, or a specific chant in the morning service order.
 * Rendered as a small visual timeline on the sangha-index page; chants
 * placed in time-context, not as a flat list.
 */
export type ScheduleEvent = {
  /**
   * Time-of-day in human-readable form ("4:15 AM", "before sleep"). May
   * be empty for events that follow the previous one in sequence (e.g.
   * a chain of morning chants chanted in immediate succession).
   */
  time: string;
  /** Short label for the event ("Wake-up bell", "Morning chanting begins"). */
  event: string;
  /** Optional icon hint — renderer maps to an SVG. */
  icon?: 'bell' | 'cushion' | 'meal' | 'walk' | 'work' | 'rest';
  /**
   * Optional chant slug. When present, the event label becomes a
   * clickable link to `/liturgy/<sangha>/<chantSlug>`. Lets the daily
   * rhythm itself serve as the morning-service navigation.
   */
  chantSlug?: string;
};

export type Sangha = {
  /** URL slug + foreign key on LiturgyDoc.sangha. */
  slug: string;
  /** Short display name. */
  name: string;
  /** Optional longer / formal name. */
  fullName?: string;
  /** One-paragraph description for the sangha-index card. */
  description?: string;
  /** Where the community is physically based. */
  location?: string;
  /** Founding year (string for "2014" / "c. 1992" flexibility). */
  founded?: string;
  /** Optional canonical website. */
  url?: string;
  /** Primary Buddhist tradition tag — what colours the sangha most strongly. */
  primaryTradition?: 'theravada' | 'mahayana' | 'zen' | 'vajrayana' | 'lakota' | 'maple' | 'mixed';
  /**
   * Optional daily-rhythm timeline. Rendered as a visual strip at the
   * top of the sangha's chant-index page, with bell icons and times.
   * Anchors the chants in lived context — chanting isn't decontextualised
   * from when (and after what) it happens.
   */
  schedule?: ScheduleEvent[];
};

export type LiturgyDoc = {
  /** URL slug. Unique within a sangha; can repeat across sanghas. */
  slug: string;
  /**
   * Sangha this version of the chant comes from. Foreign key into the
   * sangha registry (data/liturgy/sanghas.ts). Routing lives at
   * `/liturgy/<sangha>/<slug>`.
   */
  sangha: string;
  /** Display title. */
  title: string;
  /** Subtitle / one-line framing for the chant. */
  subtitle?: string;
  /** Buddhist tradition tag. */
  tradition: 'theravada' | 'mahayana' | 'zen' | 'vajrayana' | 'lakota' | 'maple' | 'mixed';
  /** Practice context — when chanted, by whom. */
  context?: string;
  /**
   * Position in the sangha's chant sequence. Lower comes first. The
   * sangha-index page sorts by this. Used for the morning service
   * order: morning-chants first (1), then enmei-jikku (2), sho-sai (3),
   * heart-sutra (4), and so on. Omit for one-off / unscheduled chants.
   */
  order?: number;
  /**
   * Optional time-of-day stamp shown next to the chant on the
   * sangha-index card ("4:35 AM", "evening before sleep").
   */
  time?: string;
  /**
   * How often the chant is practiced. Drives sangha-index page
   * sectioning — daily chants are listed first in their order; weekly
   * and occasional chants are grouped beneath in their own sections.
   * Defaults to 'daily' when omitted.
   */
  frequency?: 'daily' | 'weekly' | 'occasional';
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

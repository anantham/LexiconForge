import React, { useState, useRef, useLayoutEffect, useEffect, useMemo } from 'react';
import { AnimatePresence } from 'framer-motion';
import type {
  TripleScriptWitnessSection,
  TripleScriptWitnessSegment,
  WordGloss,
  WordMorpheme,
  AccentColor,
  Witness,
  ScriptVariant,
} from '../../../types/liturgy';

// Accent → Tailwind text-color class. 300 level reads as a hint, not a shout,
// on the slate-950 background.
const ACCENT_CLASS: Record<AccentColor, string> = {
  sky: 'text-sky-300',
  amber: 'text-amber-300',
  rose: 'text-rose-300',
  violet: 'text-violet-300',
  emerald: 'text-emerald-300',
};
import { Tooltip } from '../../sutta-studio/Tooltip';
import { ProseBlock } from '../ProseBlock';
import { useLiturgySettings } from '../LiturgySettings';
import { conceptsForToken } from '../../../data/concepts/lookup';
import { conceptFacets } from '../../../data/concepts/tooltipFacets';

// Per-script font stacks. Latn/IAST uses Cardo (already loaded for diacritics).
// Other scripts use Noto Serif Web Fonts pulled in index.html.
const SCRIPT_FONT: Record<string, string> = {
  Latn: "'Cardo', 'Gentium Plus', 'Noto Serif', serif",
  Deva: "'Noto Serif Devanagari', 'Cardo', serif",
  Tibt: "'Noto Serif Tibetan', 'Cardo', serif",
  Hant: "'Noto Serif SC', serif",
  Hans: "'Noto Serif SC', serif",
  Jpan: "'Noto Serif JP', serif",
  Hang: "'Noto Serif KR', serif",
};

/**
 * Per-script size multipliers. Latin (IAST/Pāli) is the baseline (1.0).
 * CJK and Devanāgarī benefit from slightly larger rendering because their
 * glyphs carry more visual detail per unit; the reader needs more pixels
 * to resolve them comfortably. The English translation line below the
 * chant body gets its own bump so the gloss reads as easily as the chant.
 */
const SCRIPT_SIZE_MULTIPLIER: Record<string, number> = {
  Latn: 1.0,
  Deva: 1.05,
  Hant: 1.2,
  Hans: 1.2,
  Jpan: 1.2,
  Tibt: 1.1,
  Hang: 1.15,
};
const ENGLISH_LINE_MULTIPLIER = 1.4;

/** Resolve the script subtag from a BCP-47 tag (e.g. "sa-Latn" → "Latn"). */
function scriptSubtag(lang: string): string {
  const parts = lang.split('-');
  return parts.length >= 2 ? parts[1] : 'Latn';
}

/** Resolve the primary language subtag from a BCP-47 tag (e.g. "sa-Latn" → "sa"). */
function languageSubtag(lang: string): string {
  return lang.split('-')[0] ?? lang;
}

/**
 * Merge two conceptId lists into a unique, space-separated string, or
 * return undefined if both are empty. Used by HoverSpan to combine
 * explicit author-tagged conceptIds with registry-resolved ones.
 */
function mergeConceptIds(a?: string[], b?: string[]): string | undefined {
  const set = new Set<string>();
  a?.forEach((id) => id && set.add(id));
  b?.forEach((id) => id && set.add(id));
  return set.size > 0 ? Array.from(set).join(' ') : undefined;
}

/**
 * Derive the list of scripts a segment supports. New chants populate
 * `scripts` directly; legacy chants (morning-chants) use `pali` + `paliDeva`,
 * which we splice into the same shape so the rest of the renderer doesn't
 * branch on the data form.
 */
function deriveScripts(seg: TripleScriptWitnessSegment): ScriptVariant[] {
  if (seg.scripts && seg.scripts.length > 0) return seg.scripts;
  const out: ScriptVariant[] = [{ lang: 'pi-Latn', label: 'Pāli', text: seg.pali }];
  // Carry the IAST as the Devanāgarī variant's transliteration so the
  // reader gets a phonetic line beneath the Devanāgarī when the
  // `showTransliteration` setting is on. Without this, legacy chants
  // (morning-chants, ti-sarana) rendered Devanāgarī silently — no
  // phonetic respelling underneath.
  if (seg.paliDeva) {
    out.push({
      lang: 'pi-Deva',
      label: 'Devanāgarī',
      text: seg.paliDeva,
      transliteration: seg.pali,
    });
  }
  return out;
}

/**
 * Shape: triple-script-witness — per-segment interleaved layout.
 *
 * Each segment renders as a Pāli line directly above its English line.
 * The next segment follows. No "all Pāli then all English" bulk.
 *
 * Borrowed from Sutta Studio:
 *  - Tooltip component (hover popover with auto-flip / viewport-clamp)
 *  - Color + typography aesthetic (Cardo serif, slate palette, emerald accent)
 *
 * Liturgy-specific (no equivalent in Sutta Studio):
 *  - Witness cycling per segment (MAPLE → Sujato → Thanissaro)
 *  - Script cycling per section (roman ↔ Devanāgarī)
 *  - The "stone marker" opening treatment
 *
 * Audit-panel intent: hover a Pāli word → Tooltip shows pronunciation,
 * etymology, gloss. No inline structure dump. Citation chips and deeper
 * detail will move to a real slide-in audit panel in the next iteration;
 * this iteration delivers the interleave + hover-glimpse.
 */

const SERIF_STACK = "'Cardo', 'Gentium Plus', 'Noto Serif', serif";
const DEVA_STACK = "'Noto Serif Devanagari', 'Cardo', serif";

/**
 * Renders a small Roman / phonetic transliteration line beneath a non-Latin
 * script. Only shows when the script variant carries a `transliteration`
 * and the user's "Show transliteration" setting is on. Skipped for Latn —
 * Roman scripts don't need a Roman gloss of themselves.
 */
/**
 * Build a per-word pronunciation respelling line for Latin-script
 * (IAST) chants. Walks the text's word tokens, looks each one up in
 * the segment's `words` registry by surface form, and joins each
 * word's `pronunciation` field (a chant-friendly respelling like
 * "nah-MOH" or "kah-rah-NEE-yah"). Gaps and unknown words pass
 * through as-is. Returns null when no word has a pronunciation
 * authored (most chants do; metta-sutta's sparse data falls through).
 *
 * Why: IAST diacritics are phonemic but opaque to English-readers
 * who haven't studied Sanskritic transcription. The per-word
 * pronunciation respelling makes the chant readable for anyone.
 */
function buildRespelling(text: string, words: WordGloss[] | undefined): string | null {
  if (!words || words.length === 0) return null;
  const idx = buildWordIndex(words, 'form');
  const tokens = tokenize(text);
  let haveAny = false;
  const parts: string[] = [];
  for (const t of tokens) {
    if (t.kind === 'gap') {
      parts.push(t.text);
      continue;
    }
    const w = matchWord(t.text, idx);
    if (w?.pronunciation) {
      parts.push(w.pronunciation);
      haveAny = true;
    } else {
      // Unknown / un-glossed token — keep the surface form so the line
      // stays aligned with the chant. The reader's eye can fill the gap.
      parts.push(t.text);
    }
  }
  return haveAny ? parts.join('') : null;
}

const TransliterationLine: React.FC<{
  variant: ScriptVariant;
  /**
   * The segment's word registry. Used to aggregate per-word
   * `pronunciation` respellings into a phonetic line when the active
   * script is Latin (IAST) — see `buildRespelling`. For non-Latin
   * scripts, the variant's own `transliteration` field is shown
   * instead.
   */
  words?: WordGloss[];
}> = ({ variant, words }) => {
  const { settings } = useLiturgySettings();
  if (!settings.showTransliteration) return null;
  const script = scriptSubtag(variant.lang);
  // Latin script: aggregate per-word pronunciation respellings from
  // the words[] registry. Falls through to null if no word in this
  // segment has an authored pronunciation.
  if (script === 'Latn') {
    const respelling = buildRespelling(variant.text, words);
    if (!respelling) return null;
    return (
      <div
        className="relative z-0 text-slate-500 italic text-sm mt-1 leading-relaxed select-text tracking-wide"
        style={{ fontFamily: SCRIPT_FONT.Latn }}
        aria-label={`Pronunciation respelling of ${variant.label}`}
      >
        {respelling}
      </div>
    );
  }
  // Non-Latin script: show the variant's own transliteration string.
  if (!variant.transliteration) return null;
  return (
    <div
      className="relative z-0 text-slate-500 italic text-sm mt-1 leading-relaxed select-text"
      style={{ fontFamily: SCRIPT_FONT.Latn }}
      aria-label={`Transliteration of ${variant.label}`}
    >
      {variant.transliteration}
    </div>
  );
};

/** Tokenise a Roman Pāli line into hover-enabled words + plain gaps. */
function tokenize(text: string): Array<{ kind: 'word' | 'gap'; text: string }> {
  const out: Array<{ kind: 'word' | 'gap'; text: string }> = [];
  const re = /([A-Za-zĀāĪīŪūṚṛṂṃṄṅÑñṬṭḌḍṆṇŚśṢṣḤḥṁÀ-ɏ]+|[^A-Za-zĀāĪīŪūṚṛṂṃṄṅÑñṬṭḌḍṆṇŚśṢṣḤḥṁÀ-ɏ]+)/g;
  for (const m of text.matchAll(re)) {
    const tok = m[0];
    const isWord = /^[A-Za-zĀāĪīŪūṚṛṂṃṄṅÑñṬṭḌḍṆṇŚśṢṣḤḥṁÀ-ɏ]+$/.test(tok);
    out.push({ kind: isWord ? 'word' : 'gap', text: tok });
  }
  return out;
}

/**
 * Tokenise a Devanāgarī Pāli line into words + gaps. The word class is
 * U+0900–U+097F minus the dandas (U+0964, U+0965) so single/double-danda
 * punctuation goes into gap tokens, parallel to the Roman tokenizer.
 *
 * Crucially: same word ORDER as the Roman line, so a position-based
 * `data-pali-idx` lines up across scripts and the existing alignTo array
 * (English → Pāli word position) keeps working unchanged.
 */
function tokenizeDeva(text: string): Array<{ kind: 'word' | 'gap'; text: string }> {
  const out: Array<{ kind: 'word' | 'gap'; text: string }> = [];
  const re = /([ऀ-ॣ०-ॿ]+|[^ऀ-ॣ०-ॿ]+)/g;
  for (const m of text.matchAll(re)) {
    const tok = m[0];
    const isWord = /^[ऀ-ॣ०-ॿ]+$/.test(tok);
    out.push({ kind: isWord ? 'word' : 'gap', text: tok });
  }
  return out;
}

/**
 * Tokenise CJK text (Chinese / Japanese kanji + kana) into per-character
 * tokens. No inter-word whitespace exists; each character is its own unit.
 * Hiragana / katakana ranges are included so mixed-script Japanese works.
 *
 * Each character becomes a separately hoverable token. Tooltips depend on
 * a WordGloss whose `scriptAlt` matches the character — multi-char terms
 * are out of scope for this first cut (would need a tokenization hint
 * field on the script variant).
 */
function tokenizeCJK(text: string): Array<{ kind: 'word' | 'gap'; text: string }> {
  const out: Array<{ kind: 'word' | 'gap'; text: string }> = [];
  // CJK Unified Ideographs + Extension A + Hiragana + Katakana
  const wordRe = /^[一-鿿㐀-䶿぀-ゟ゠-ヿ]$/;
  let runStart = 0;
  let runIsNonCJK = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const isCJK = wordRe.test(ch);
    if (isCJK) {
      if (runStart < i && runIsNonCJK) {
        out.push({ kind: 'gap', text: text.slice(runStart, i) });
      } else if (runStart < i && !runIsNonCJK) {
        // Flush prior CJK chars as individual word tokens
        for (let j = runStart; j < i; j++) {
          out.push({ kind: 'word', text: text[j] });
        }
      }
      runStart = i;
      runIsNonCJK = false;
    } else {
      if (runStart < i && !runIsNonCJK) {
        for (let j = runStart; j < i; j++) {
          out.push({ kind: 'word', text: text[j] });
        }
        runStart = i;
      }
      runIsNonCJK = true;
    }
  }
  // Flush the tail
  if (runStart < text.length) {
    if (runIsNonCJK) {
      out.push({ kind: 'gap', text: text.slice(runStart) });
    } else {
      for (let j = runStart; j < text.length; j++) {
        out.push({ kind: 'word', text: text[j] });
      }
    }
  }
  return out;
}

/**
 * Tokenise Tibetan text into tsek-separated syllables. The tsek (U+0F0B)
 * is the standard Tibetan syllable separator; shads (U+0F0D-U+0F0E) are
 * sentence/clause punctuation.
 */
function tokenizeTibetan(text: string): Array<{ kind: 'word' | 'gap'; text: string }> {
  const out: Array<{ kind: 'word' | 'gap'; text: string }> = [];
  // Word = run of Tibetan letters/marks excluding tsek/shads.
  const re = /([ༀ-༊༌༏-࿿]+|[^ༀ-༊༌༏-࿿]+)/g;
  for (const m of text.matchAll(re)) {
    const tok = m[0];
    const isWord = /^[ༀ-༊༌༏-࿿]+$/.test(tok);
    out.push({ kind: isWord ? 'word' : 'gap', text: tok });
  }
  return out;
}

function normalizeForMatch(s: string): string {
  return s.toLowerCase().replace(/[.,;:!?"'()\[\]।॥-]/g, '').trim();
}

/**
 * Build a normalized-form → WordGloss index. `by` is:
 *   - 'form'      → match against `w.form` (Latin/IAST)
 *   - 'scriptAlt' → match against `w.scriptAlt` (Devanāgarī)
 *   - 'lang:XX'   → match against `w.scriptAlts[XX]` (any registered script)
 *
 * The third form lets Chinese/Japanese/Tibetan tokens light up tooltips
 * once authoring fills in `scriptAlts: { 'zh-Hant': '般若', … }` per-term.
 */
function buildWordIndex(
  words: WordGloss[],
  by: 'form' | 'scriptAlt' | `lang:${string}`
): Map<string, WordGloss> {
  const idx = new Map<string, WordGloss>();
  const langKey = by.startsWith('lang:') ? by.slice(5) : undefined;
  for (const w of words) {
    let raw: string | undefined;
    if (by === 'form') raw = w.form;
    else if (by === 'scriptAlt') raw = w.scriptAlt;
    else if (langKey) raw = w.scriptAlts?.[langKey];
    if (!raw) continue;
    const key = normalizeForMatch(raw);
    if (key) idx.set(key, w);
  }
  return idx;
}

/**
 * Tokenise text by an explicit list of hint substrings. Walks left-to-right,
 * locating each hint after the previous one's end; anything between hints
 * becomes a gap token (whitespace, punctuation, gap kanji not in the hint
 * list). Hints not found cause the remainder to render as a single gap —
 * a signal to the curator that the data is out of sync.
 */
function tokenizeWithHints(
  text: string,
  hints: string[]
): Array<{ kind: 'word' | 'gap'; text: string }> {
  const out: Array<{ kind: 'word' | 'gap'; text: string }> = [];
  let cursor = 0;
  for (const hint of hints) {
    const i = text.indexOf(hint, cursor);
    if (i < 0) break;
    if (i > cursor) out.push({ kind: 'gap', text: text.slice(cursor, i) });
    out.push({ kind: 'word', text: hint });
    cursor = i + hint.length;
  }
  if (cursor < text.length) out.push({ kind: 'gap', text: text.slice(cursor) });
  return out;
}

function matchWord(token: string, idx: Map<string, WordGloss>): WordGloss | undefined {
  const norm = normalizeForMatch(token);
  if (!norm) return undefined;
  // 1. Exact match wins.
  if (idx.has(norm)) return idx.get(norm);
  // 2. Longest-prefix match — pick the entry whose form is the longest
  //    prefix of the token (or vice versa). Prevents short-prefix entries
  //    (e.g. "sam-") from swallowing surface tokens like "sambuddhassa".
  let best: { w: WordGloss; len: number } | undefined;
  for (const [key, w] of idx) {
    if (key.length < 3) continue;
    if (norm.startsWith(key) || key.startsWith(norm)) {
      const matchLen = Math.min(key.length, norm.length);
      if (!best || matchLen > best.len) best = { w, len: matchLen };
    }
  }
  return best?.w;
}

// ─────────────────────────────────────────────────────────────────────────────
// SegmentRow — one chant phrase: Pāli line + English line, paired
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Split a Pāli surface token by a list of morphemes. Each output slice carries
 * the original token's casing (so "Namo" → "Nam" + "o", not "nam" + "o").
 *
 * Returns null if the morpheme texts don't reconstruct the surface (which
 * means morphemes are stale relative to the form — falls back to word-level
 * hover so we never render incorrect splits).
 */
function splitByMorphemes(
  surface: string,
  morphemes: WordMorpheme[]
): Array<{ text: string; morpheme: WordMorpheme }> | null {
  const out: Array<{ text: string; morpheme: WordMorpheme }> = [];
  const surfaceLower = surface.toLowerCase();
  let cursor = 0;
  for (const m of morphemes) {
    const mText = m.text.toLowerCase();
    if (surfaceLower.slice(cursor, cursor + mText.length) !== mText) {
      return null;
    }
    out.push({ text: surface.slice(cursor, cursor + mText.length), morpheme: m });
    cursor += mText.length;
  }
  if (cursor !== surface.length) return null;
  return out;
}

const HoverSpan: React.FC<{
  text: string;
  tooltipText: string;
  bold?: boolean;
  /**
   * Optional morpheme index within the parent word. Emitted as
   * `data-morpheme-idx={N}` so the alignment-line computer can find
   * the per-morpheme sub-spans and distribute English-side arrows
   * across them when multiple English words map to one Pāli word.
   */
  morphemeIdx?: number;
  /**
   * Optional concept-graph IDs this morpheme attests. Emitted as a
   * space-separated `data-concept-ids` attribute that the hover handler
   * uses for cross-language highlighting (see types/conceptGraph.ts and
   * data/concepts/lookup.ts).
   */
  conceptIds?: string[];
  /**
   * BCP-47 language tag (e.g. "sa-Latn"). When provided, the registry is
   * queried for additional conceptIds that attest this surface form, so
   * the author doesn't have to manually annotate every morpheme — if the
   * registry already names `prajñā` as `concept.wisdom-prajna`, the
   * hover-highlighting works automatically. Explicit `conceptIds` merge
   * with registry-resolved ones.
   */
  lang?: string;
}> = ({ text, tooltipText, bold = false, morphemeIdx, conceptIds, lang }) => {
  const [open, setOpen] = useState(false);
  const [facetIdx, setFacetIdx] = useState(0);
  const registryIds = lang
    ? conceptsForToken(languageSubtag(lang), scriptSubtag(lang), text)
    : undefined;
  const conceptAttr = mergeConceptIds(conceptIds, registryIds);
  // Build facets: the surface-gloss is always facet 0; each concept the
  // token attests adds one short facet (preferredLabel + first sentence
  // of the registry definition). When there's more than one facet, click
  // cycles between them (mn10 pattern — see sutta-studio/Tooltip.tsx).
  const allConceptIds = conceptAttr ? conceptAttr.split(/\s+/).filter(Boolean) : [];
  const extraFacets = conceptFacets(allConceptIds);
  const facets = [tooltipText, ...extraFacets];
  const currentFacet = facets[facetIdx % facets.length] ?? tooltipText;
  const hasFacets = facets.length > 1;
  return (
    <span
      data-hover-span="true"
      data-morpheme-idx={morphemeIdx}
      data-concept-ids={conceptAttr}
      // Each morpheme gets its own underline + tiny horizontal padding so
      // adjacent morphemes don't merge visually. mn10 pattern: the eye
      // sees per-segment breaks (kar · aṇī · yam) rather than one long
      // continuous underline under the whole word.
      className={`relative inline-block cursor-help px-[2px] border-b border-dotted border-emerald-700/40 hover:border-emerald-300 hover:text-emerald-100 transition-colors ${
        bold ? 'font-semibold' : ''
      }`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onClick={(e) => {
        // Click advances the tooltip facet when there are multiple. We
        // stop propagation so the click doesn't bubble to parents that
        // might also bind onClick (alignment-line clear, etc.). When
        // there's only one facet, click is a no-op — the cursor:help
        // hint is unchanged.
        if (!hasFacets) return;
        e.stopPropagation();
        setFacetIdx((i) => (i + 1) % facets.length);
      }}
      title={hasFacets ? 'Click: next facet' : undefined}
    >
      {text}
      <AnimatePresence>
        {open && (
          <Tooltip
            text={currentFacet}
            facetIndex={hasFacets ? facetIdx % facets.length : undefined}
            facetTotal={hasFacets ? facets.length : undefined}
          />
        )}
      </AnimatePresence>
    </span>
  );
};

function tooltipForMorpheme(m: WordMorpheme, hidePron = false): string {
  // Plain-English tooltip — no grammar jargon. Root marker only when present
  // (advanced reader cue, not required vocabulary). `hidePron` is set when
  // a transliteration line is rendered beneath the script; the line already
  // shows pronunciation, so repeating `[pron]` here is redundant clutter
  // that crowds out the gloss.
  const parts: string[] = [];
  if (!hidePron && m.pronunciation) parts.push(`[${m.pronunciation}]`);
  if (m.root) parts.push(m.root);
  parts.push(m.gloss);
  return parts.filter(Boolean).join(' · ');
}

function tooltipForWord(w: WordGloss, hidePron = false): string {
  return [!hidePron && w.pronunciation ? `[${w.pronunciation}]` : '', w.etymology ?? '', w.gloss]
    .filter(Boolean)
    .join(' · ');
}

const HoverWord: React.FC<{
  text: string;
  word: WordGloss;
  /**
   * Override the morphemes used for sub-token splitting. When omitted,
   * falls back to `word.morphemes` (Sanskrit/IAST). For CJK/Tibetan, the
   * caller passes `word.scriptMorphemes[activeLang]` so e.g. 般若 splits
   * into 般 + 若 with phonetic-loan tooltips.
   */
  morphemes?: WordMorpheme[];
  /** Suppress the `[pronunciation]` prefix when a transliteration line is shown beneath. */
  hidePron?: boolean;
  /**
   * BCP-47 language tag of the active script (e.g. "sa-Latn", "zh-Hant").
   * Threaded down so HoverSpan can query the concept registry by surface
   * form — see HoverSpan.lang.
   */
  lang?: string;
}> = ({ text, word, morphemes: morphemesOverride, hidePron = false, lang }) => {
  const morphemes = morphemesOverride ?? word.morphemes;
  // If we have morphemes and they cleanly reconstruct the surface, render
  // one hover span per morpheme. Root morphemes render bold so the eye
  // lands on the meaning-carrier.
  if (morphemes && morphemes.length > 0) {
    const split = splitByMorphemes(text, morphemes);
    if (split) {
      return (
        <>
          {split.map((piece, i) => (
            <HoverSpan
              key={i}
              text={piece.text}
              tooltipText={tooltipForMorpheme(piece.morpheme, hidePron)}
              bold={piece.morpheme.type === 'root'}
              morphemeIdx={i}
              conceptIds={piece.morpheme.conceptIds}
              lang={lang}
            />
          ))}
        </>
      );
    }
  }
  return (
    <HoverSpan
      text={text}
      tooltipText={tooltipForWord(word, hidePron)}
      conceptIds={word.conceptIds}
      lang={lang}
    />
  );
};

const PaliLine: React.FC<{
  text: string;
  words?: WordGloss[];
  large?: boolean;
  /**
   * BCP-47 lang tag of the text (e.g. `sa-Latn`, `sa-Deva`, `zh-Hant`,
   * `bo-Tibt`, `ja-Jpan`). Drives tokeniser selection + WordGloss lookup
   * key. Latn → `.form`, Deva → `.scriptAlt`, anything else →
   * `scriptAlts[lang]` if authored.
   */
  lang: string;
  /**
   * Optional tokenisation hint. When present, the text is split by these
   * substrings — useful for Chinese / Japanese where the natural unit
   * is a multi-char compound (般若, 波羅蜜多) not a single character.
   */
  tokens?: string[];
}> = ({ text, words = [], large = false, lang, tokens: tokenHints }) => {
  const { settings } = useLiturgySettings();
  const script = scriptSubtag(lang);
  // Base font sizes (rem). Reader can tune via the settings slider, which
  // sets `--liturgy-scale` on the LiturgyChantPage wrapper. Each script
  // also carries its own multiplier — CJK + Tibetan glyphs benefit from
  // a slight upscale so the visual weight matches Latin chant body.
  const baseRem = (large ? 1.875 : 1.5) * (SCRIPT_SIZE_MULTIPLIER[script] ?? 1);
  const fontStack = SCRIPT_FONT[script] ?? SCRIPT_FONT.Latn;

  const tokens = (() => {
    if (tokenHints && tokenHints.length > 0) return tokenizeWithHints(text, tokenHints);
    switch (script) {
      case 'Latn':
        return tokenize(text);
      case 'Deva':
        return tokenizeDeva(text);
      case 'Hant':
      case 'Hans':
      case 'Jpan':
        return tokenizeCJK(text);
      case 'Tibt':
        return tokenizeTibetan(text);
      default:
        return [{ kind: 'gap' as const, text }];
    }
  })();

  // Pick the right index key: Latn → form, Deva → scriptAlt, else
  // scriptAlts[lang]. With tokenisation hints the compound tokens (般若)
  // can match scriptAlts entries; without hints, only single characters
  // would match.
  const indexKey: 'form' | 'scriptAlt' | `lang:${string}` =
    script === 'Latn' ? 'form' : script === 'Deva' ? 'scriptAlt' : `lang:${lang}`;
  const idx = buildWordIndex(words, indexKey);

  // Track surface position separately from token index. data-pali-idx is
  // what alignment lines use; it counts only "word" tokens.
  let paliSurfaceIdx = -1;

  // If a transliteration line will render beneath this script (set on the
  // ScriptVariant + user's preference on), suppress the [pronunciation]
  // prefix from word/morpheme tooltips — it'd be redundant with the line
  // below and crowds out the gloss.
  const hidePron =
    settings.showTransliteration && script !== 'Latn';

  return (
    <div
      className="text-slate-100 leading-loose"
      style={{ fontFamily: fontStack, fontSize: `calc(${baseRem}rem * var(--liturgy-scale, 1))` }}
      lang={lang}
    >
      {tokens.map((t, i) => {
        if (t.kind === 'gap') return <React.Fragment key={i}>{t.text}</React.Fragment>;
        paliSurfaceIdx += 1;
        const word = matchWord(t.text, idx);
        const accentClass = settings.showAccents && word?.accent ? ACCENT_CLASS[word.accent] : '';
        // Pick the right morpheme list for the active script: Latn uses
        // the default `word.morphemes` (Sanskrit/IAST decomposition); other
        // scripts use `word.scriptMorphemes[lang]` if authored (Chinese
        // phonetic-loans, semantic doublets).
        const scriptMorphemes =
          word && script !== 'Latn' ? word.scriptMorphemes?.[lang] : undefined;
        const content = !word ? (
          t.text
        ) : script === 'Latn' || scriptMorphemes ? (
          <HoverWord
            text={t.text}
            word={word}
            morphemes={script === 'Latn' ? undefined : scriptMorphemes}
            hidePron={hidePron}
            lang={lang}
          />
        ) : (
          <HoverSpan
            text={t.text}
            tooltipText={tooltipForWord(word, hidePron)}
            conceptIds={word.conceptIds}
            lang={lang}
          />
        );
        return (
          <span
            key={i}
            data-pali-idx={paliSurfaceIdx}
            // bg + z-10 so the alignment-line SVG (sibling rendered last,
            // would otherwise stack on top) visually goes BEHIND the word.
            // The bg matches the page bg so it's invisible to the eye but
            // hides the line where it crosses this word's bounding box.
            className={`relative z-10 inline-block bg-slate-950 ${accentClass}`}
          >
            {content}
          </span>
        );
      })}
    </div>
  );
};

/** Tokenize English on whitespace, preserving punctuation as part of each word. */
function tokenizeEnglish(text: string): string[] {
  return text.split(/(\s+)/).filter((s) => s.length > 0);
}

const EnglishLine: React.FC<{
  text: string;
  accentByEnIdx?: Map<number, AccentColor>;
  /**
   * Witness identifier (e.g. `"MAPLE chant sheet (after Sheng-yen)"`,
   * `"Conze (1958)"`). Used to look up per-witness conceptIds for each
   * English word, so MAPLE's "wisdom" can attest a different concept
   * than Conze's "Wisdom" if the registry has witness-specific
   * attestations.
   */
  witnessBy?: string;
  /**
   * Witness's per-English-word mapping to Pāli surface position. When
   * an entry is -1, the English word is "glue" — connective tissue
   * English needs that has no Pāli counterpart ("This is what should be
   * done" → "is", "what", "be" carry no Pāli, only "done" maps). The
   * mn10 reader dims those words so the eye lands on content words.
   * Without alignTo, all words render at full opacity.
   */
  alignTo?: number[];
}> = ({ text, accentByEnIdx, witnessBy, alignTo }) => {
  const { settings } = useLiturgySettings();
  const tokens = tokenizeEnglish(text);
  let engIdx = -1;
  return (
    <>
      {tokens.map((t, i) => {
        if (/^\s+$/.test(t)) return <React.Fragment key={i}>{t}</React.Fragment>;
        engIdx += 1;
        const accent = accentByEnIdx?.get(engIdx);
        const accentClass = settings.showAccents && accent ? ACCENT_CLASS[accent] : '';
        const concepts = conceptsForToken('en', 'Latn', t, witnessBy);
        const conceptAttr = concepts.length > 0 ? concepts.join(' ') : undefined;
        // Glue word: English-only scaffolding with no Pāli source. mn10
        // renders these at 0.55 opacity (Legend.tsx uses 0.3 for "ghost
        // words"; we settle higher because liturgy glue is more often
        // unavoidable English syntax than fully supplied content).
        const isGlue = alignTo !== undefined && alignTo[engIdx] === -1;
        return (
          <span
            key={i}
            data-en-idx={engIdx}
            data-concept-ids={conceptAttr}
            // bg + z-10 to hide alignment-line strokes behind the word (see
            // PaliLine sibling above for the same treatment).
            className={`relative z-10 inline-block bg-slate-950 ${accentClass}`}
            style={isGlue ? { opacity: 0.55 } : undefined}
          >
            {t}
          </span>
        );
      })}
    </>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// WitnessDots — subtle, section-level citation indicator
// ─────────────────────────────────────────────────────────────────────────────
//
// Dots are aria-hidden anchors for hover; click cycling happens by clicking
// the English line itself (handled in SegmentRow). Hovering a dot reveals
// the witness's name — the name itself is the link (if a URL exists), so
// the reader can move smoothly from hover → click without losing the popover.

export const WitnessDots: React.FC<{
  witnesses: Witness[];
  activeIdx: number;
  onSelect: (idx: number) => void;
}> = ({ witnesses, activeIdx, onSelect }) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [pinned, setPinned] = useState(false);
  const visibleIdx = pinned ? hoveredIdx : hoveredIdx;
  const hovered = visibleIdx !== null ? witnesses[visibleIdx] : null;

  return (
    <div
      className="relative inline-flex gap-2 items-center"
      onMouseLeave={() => {
        if (!pinned) setHoveredIdx(null);
      }}
    >
      {witnesses.map((w, i) => {
        const active = i === activeIdx;
        return (
          <button
            key={i}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelect(i);
            }}
            onMouseEnter={() => setHoveredIdx(i)}
            className={`w-1.5 h-1.5 rounded-full transition-all ${
              active
                ? 'bg-emerald-400/70'
                : 'border border-slate-700 bg-transparent hover:border-emerald-400/60'
            }`}
            aria-label={`Show ${w.by}${active ? ' (active)' : ''}`}
          />
        );
      })}
      {hovered && (
        <div
          className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50 px-2.5 py-1.5 rounded bg-slate-900/85 border border-slate-800 shadow-lg text-[11px] whitespace-nowrap pointer-events-auto"
          onMouseEnter={() => setPinned(true)}
          onMouseLeave={() => {
            setPinned(false);
            setHoveredIdx(null);
          }}
        >
          {hovered.url ? (
            <a
              href={hovered.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-300 hover:text-emerald-300 transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              {hovered.by}
            </a>
          ) : (
            <span className="text-slate-400">{hovered.by}</span>
          )}
          {hovered.license && (
            <span className="text-slate-600 ml-2">{hovered.license}</span>
          )}
        </div>
      )}
    </div>
  );
};

type Line = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  engIdx: number;
  paliIdx: number;
  /**
   * Which morpheme inside the Pāli word this line anchors to, if the
   * word was rendered with morpheme-split HoverSpans. Lets the renderer
   * distribute multiple-English-into-one-Pāli mappings across the Pāli
   * morphemes (training-rule → sikkhā-pada) instead of fanning all
   * arrows at the word's centre.
   */
  morphemeIdx?: number;
};

function computeAlignmentLines(
  container: HTMLDivElement,
  alignTo: number[] | undefined
): Line[] {
  if (!alignTo) return [];
  const cRect = container.getBoundingClientRect();
  const paliEls = container.querySelectorAll<HTMLElement>('[data-pali-idx]');
  const enEls = container.querySelectorAll<HTMLElement>('[data-en-idx]');

  // Group English indices by the Pāli idx they map to. When multiple
  // English words map to the same Pāli word, we want to distribute them
  // across that word's morphemes (by order) so the arrows land on
  // sub-tokens instead of all converging at the word centre.
  const groupedByPali = new Map<number, number[]>();
  for (let engIdx = 0; engIdx < alignTo.length; engIdx++) {
    const paliIdx = alignTo[engIdx];
    if (paliIdx < 0) continue;
    if (!groupedByPali.has(paliIdx)) groupedByPali.set(paliIdx, []);
    groupedByPali.get(paliIdx)!.push(engIdx);
  }

  const lines: Line[] = [];
  for (const [paliIdx, engIndices] of groupedByPali) {
    const paliEl = paliEls[paliIdx];
    if (!paliEl) continue;
    const morphemeEls = paliEl.querySelectorAll<HTMLElement>('[data-morpheme-idx]');
    const wordRect = paliEl.getBoundingClientRect();

    for (let i = 0; i < engIndices.length; i++) {
      const engIdx = engIndices[i];
      const enEl = enEls[engIdx];
      if (!enEl) continue;

      // Three positioning strategies, in order of preference:
      //   1. Authored morpheme spans exist → anchor on morpheme #i
      //      (clamped to last morpheme if more English than morphemes).
      //   2. No morpheme spans but the group has >1 English mapping to
      //      this word → distribute proportionally along the word's
      //      width so the arrows fan into separate landing zones
      //      instead of converging at the centre. Works for any
      //      script, any word, no authoring required.
      //   3. Single English → just point at the word's centre.
      let x1: number;
      let y1: number;
      let subIdx: number | undefined = undefined;
      if (morphemeEls.length > 0) {
        const clamped = Math.min(i, morphemeEls.length - 1);
        const mr = morphemeEls[clamped].getBoundingClientRect();
        x1 = mr.left + mr.width / 2 - cRect.left;
        y1 = mr.bottom - cRect.top;
        subIdx = clamped;
      } else if (engIndices.length > 1) {
        const xOffset = ((i + 0.5) / engIndices.length) * wordRect.width;
        x1 = wordRect.left + xOffset - cRect.left;
        y1 = wordRect.bottom - cRect.top;
        subIdx = i;
      } else {
        x1 = wordRect.left + wordRect.width / 2 - cRect.left;
        y1 = wordRect.bottom - cRect.top;
      }

      const er = enEl.getBoundingClientRect();
      lines.push({
        x1,
        y1,
        x2: er.left + er.width / 2 - cRect.left,
        y2: er.top - cRect.top,
        engIdx,
        paliIdx,
        morphemeIdx: subIdx,
      });
    }
  }
  return lines;
}

type HoverTarget = {
  kind: 'pali' | 'en';
  idx: number;
  /**
   * The most-specific element actually under the cursor — usually the
   * morpheme HoverSpan for Pāli, or the English word span. Used to attach
   * the arrow's endpoint to where the user is actually hovering, not the
   * centre of the whole word.
   */
  element: HTMLElement;
} | null;

const AlignmentLines: React.FC<{ lines: Line[]; containerWidth: number }> = ({
  lines,
}) => {
  // The caller (SegmentRow.adjustedLines) is responsible for filtering by
  // hover state + concept overlap. This component just renders the lines
  // it's given.
  //
  // Path shape: a gentle, near-vertical bezier — both control points
  // share the endpoint's x-coordinate, so the line goes essentially
  // straight down with a mild S-curve. The earlier margin-arc variant
  // (control points pulled to a side lane) read as visually
  // overwrought; the user explicitly preferred a "gentle, directly
  // connecting" line. We disambiguate termination via the endpoint
  // dots below, not the curve shape itself.
  const visible = lines;
  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      style={{ width: '100%', height: '100%', overflow: 'visible' }}
      aria-hidden="true"
    >
      {visible.map((l) => {
        const dy = l.y2 - l.y1;
        const cp1y = l.y1 + dy * 0.5;
        const cp2y = l.y2 - dy * 0.5;
        const d = `M ${l.x1},${l.y1} C ${l.x1},${cp1y} ${l.x2},${cp2y} ${l.x2},${l.y2}`;
        return (
          <g key={`${l.paliIdx}-${l.engIdx}`}>
            <path
              d={d}
              fill="none"
              stroke="rgb(110, 231, 183)"
              strokeOpacity="0.9"
              strokeWidth="2"
            />
            {/* Endpoint markers — small filled circles so the termination
                point is unambiguous, the dot says "this is where the
                line actually ends" even if the curve appears to brush
                past other text on its way. */}
            <circle cx={l.x1} cy={l.y1} r="2.5" fill="rgb(110, 231, 183)" />
            <circle cx={l.x2} cy={l.y2} r="2.5" fill="rgb(110, 231, 183)" />
          </g>
        );
      })}
    </svg>
  );
};

const SegmentRow: React.FC<{
  segment: TripleScriptWitnessSegment;
  /** Active script index (into deriveScripts(segment)). Clamped per-segment in case lengths differ. */
  scriptIdx: number;
  /** Witness preference (by `.by` field). Falls back to first available. */
  preferredWitnessBy: string;
  /** Called when user clicks the English line — section cycles all segments. */
  onCycleWitness: () => void;
  /** Called when user clicks the Pāli line — section cycles all segments. */
  onCycleScript: () => void;
  large?: boolean;
}> = ({
  segment,
  scriptIdx,
  preferredWitnessBy,
  onCycleWitness,
  onCycleScript,
  large = false,
}) => {
  const segmentScripts = deriveScripts(segment);
  const activeScript = segmentScripts[scriptIdx % segmentScripts.length] ?? segmentScripts[0];
  // Pick the witness whose `by` matches the section's preference, falling
  // back to the first available if this segment doesn't have it (e.g. some
  // refuge-repeat segments only have MAPLE + Sujato, no Thanissaro).
  const witnessIdx = (() => {
    const i = segment.witnesses.findIndex((w) => w.by === preferredWitnessBy);
    return i >= 0 ? i : 0;
  })();
  const currentWitness = segment.witnesses[witnessIdx];
  const containerRef = useRef<HTMLDivElement>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [hovered, setHovered] = useState<HoverTarget>(null);

  // Compute accent-by-surface-Pāli-position for this segment.
  // Then map to accent-by-English-index via the current witness's alignment.
  const accentByPaliPos = useMemo(() => {
    const map = new Map<number, AccentColor>();
    if (!segment.words) return map;
    const wordIdx = buildWordIndex(segment.words, 'form');
    const tokens = tokenize(segment.pali);
    let pos = -1;
    for (const t of tokens) {
      if (t.kind === 'gap') continue;
      pos += 1;
      const w = matchWord(t.text, wordIdx);
      if (w?.accent) map.set(pos, w.accent);
    }
    return map;
  }, [segment.pali, segment.words]);

  const accentByEnIdx = useMemo(() => {
    const map = new Map<number, AccentColor>();
    if (!currentWitness?.alignTo) return map;
    for (let engIdx = 0; engIdx < currentWitness.alignTo.length; engIdx++) {
      const paliPos = currentWitness.alignTo[engIdx];
      if (paliPos < 0) continue;
      const accent = accentByPaliPos.get(paliPos);
      if (accent) map.set(engIdx, accent);
    }
    return map;
  }, [currentWitness?.alignTo, accentByPaliPos]);

  // Compute alignment lines after layout, recompute on resize / witness /
  // script change. Alignment is only meaningful in Latn/Deva where
  // data-pali-idx positions correspond to Sanskrit word positions; CJK
  // and Tibetan use per-character / per-syllable indices that don't match
  // the witness's alignTo (which is in Sanskrit-word-index space).
  //
  // Layout-shift hazards we must defend against:
  //   1. Window resize — covered by `resize` listener.
  //   2. Internal layout shifts (script swap re-flows the line) — covered
  //      by ResizeObserver on the container.
  //   3. Async font load (e.g. Noto Serif Devanagari arrives ~50-200ms
  //      after the script swaps to Deva, shifting word positions when
  //      the fallback font is replaced) — covered by
  //      `document.fonts.ready` recompute.
  useLayoutEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const activeScriptKind = scriptSubtag(activeScript.lang);
    const wordIndexed = activeScriptKind === 'Latn' || activeScriptKind === 'Deva';
    let cancelled = false;
    const compute = () => {
      if (cancelled || !containerRef.current) return;
      if (!wordIndexed) {
        setLines([]);
        return;
      }
      setLines(computeAlignmentLines(containerRef.current, currentWitness?.alignTo));
    };
    compute();
    const raf = requestAnimationFrame(compute);
    const onResize = () => compute();
    window.addEventListener('resize', onResize);

    // Catch internal layout shifts (font load, sibling reflows, …).
    const ro = new ResizeObserver(() => compute());
    ro.observe(container);

    // Defer one more recompute until web fonts settle. Devanāgarī /
    // Tibetan / CJK fonts arrive async; the first measurement uses
    // fallback metrics, the post-load measurement uses the real ones.
    if (typeof document !== 'undefined' && (document as Document & { fonts?: FontFaceSet }).fonts) {
      (document as Document & { fonts: FontFaceSet }).fonts.ready.then(() => {
        if (!cancelled) compute();
      });
    }

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      ro.disconnect();
    };
  }, [witnessIdx, segment.id, currentWitness?.text, currentWitness?.alignTo, activeScript.lang]);

  // Clear stale hover state when the active script or witness changes.
  // Without this, hovered.element points at a DOM node from before the
  // swap — on mobile especially, that node is detached and its
  // getBoundingClientRect() returns zeros, painting the alignment line
  // from the viewport corner. (See task #73.)
  useEffect(() => {
    setHovered(null);
  }, [activeScript.lang, witnessIdx]);

  // Hover detection via event delegation on the segment container.
  // mouseover bubbles up; we check whether the target sits inside any
  // [data-pali-idx] or [data-en-idx] span and set hovered accordingly.
  // mouseout to outside the segment clears it.
  //
  // For Pāli we prefer the most-specific element under the cursor — the
  // morpheme/word HoverSpan (data-hover-span="true") if present, else the
  // whole-word [data-pali-idx] span. The alignment arrow's endpoint then
  // anchors to where the user is actually hovering, not the word centre.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onMove = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t) return;
      const paliEl = t.closest('[data-pali-idx]') as HTMLElement | null;
      if (paliEl) {
        const idx = parseInt(paliEl.getAttribute('data-pali-idx') || '-1', 10);
        if (idx >= 0) {
          const inner = t.closest('[data-hover-span="true"]') as HTMLElement | null;
          const element = inner && paliEl.contains(inner) ? inner : paliEl;
          setHovered({ kind: 'pali', idx, element });
          return;
        }
      }
      const enEl = t.closest('[data-en-idx]') as HTMLElement | null;
      if (enEl) {
        const idx = parseInt(enEl.getAttribute('data-en-idx') || '-1', 10);
        if (idx >= 0) {
          setHovered({ kind: 'en', idx, element: enEl });
          return;
        }
      }
      setHovered(null);
    };
    const onLeave = () => setHovered(null);
    el.addEventListener('mousemove', onMove);
    el.addEventListener('mouseleave', onLeave);
    return () => {
      el.removeEventListener('mousemove', onMove);
      el.removeEventListener('mouseleave', onLeave);
    };
  }, []);

  // Click-to-cycle handler that respects active text selection (drag-to-copy
  // should not also fire a cycle).
  const onLineClick = (cb: () => void) => (e: React.MouseEvent) => {
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed) return;
    e.stopPropagation();
    cb();
  };

  // Compute the visible arrow lines for the current hover state.
  //
  // Pipeline:
  //   1. Bail to empty list if nothing is hovered → no arrows.
  //   2. Recompute lines fresh from the live DOM — the cached `lines`
  //      state can be stale after a script swap (computeAlignmentLines
  //      ran when fonts hadn't loaded, returning zero-size rects).
  //   3. Filter by index match: hovered Pāli word keeps lines with that
  //      paliIdx; hovered English word keeps lines with that engIdx.
  //   4. Concept-graph filter: if the hovered element has
  //      `data-concept-ids`, narrow further to lines whose OTHER endpoint
  //      also attests at least one of those concepts. This is the
  //      "hover prajñā → show only the wisdom arrow, not the pāramitā
  //      arrow" behavior. Falls through if no concepts are tagged.
  //   5. Adjust endpoints to anchor at the hover element when the line
  //      has no morphemeIdx (otherwise the auto-distributed fan stays).
  const adjustedLines: Line[] = (() => {
    if (!hovered || !containerRef.current) return [];
    // Guard against stale hover state: if the user swapped scripts while
    // a hover was active, hovered.element is now detached from the DOM
    // tree. getBoundingClientRect() on a detached node returns all-zero,
    // which would paint the line's source endpoint at the viewport corner.
    // (See task #73, user-reported mobile Devanāgarī bug.)
    if (!containerRef.current.contains(hovered.element)) return [];
    const fresh = computeAlignmentLines(containerRef.current, currentWitness?.alignTo);
    const cRect = containerRef.current.getBoundingClientRect();
    const r = hovered.element.getBoundingClientRect();

    // Step 3 — idx match. When the user is hovering a specific morpheme
    // within a Pāli word (the inner HoverSpan emits `data-morpheme-idx`),
    // narrow to lines that anchor at that morpheme. Without this, every
    // arrow for the whole word stays visible regardless of which morpheme
    // the cursor is on — and the per-morpheme tooltips feel decoupled
    // from the arrow shown. See screenshot feedback (verse 1 karaṇīyam).
    const hoveredEl = hovered.element as HTMLElement;
    const hoveredMorphemeStr = hoveredEl.dataset.morphemeIdx;
    const hoveredMorphemeIdx =
      hovered.kind === 'pali' && hoveredMorphemeStr !== undefined
        ? parseInt(hoveredMorphemeStr, 10)
        : null;
    const idxMatched = fresh.filter((l) => {
      if (hovered.kind === 'pali') {
        if (l.paliIdx !== hovered.idx) return false;
        if (hoveredMorphemeIdx !== null && l.morphemeIdx !== undefined) {
          return l.morphemeIdx === hoveredMorphemeIdx;
        }
        return true;
      }
      return l.engIdx === hovered.idx;
    });

    // Step 4 — concept overlap (hoveredEl already declared above)
    const hoveredConceptStr = hoveredEl.dataset.conceptIds;
    const hoveredConcepts = hoveredConceptStr
      ? new Set(hoveredConceptStr.split(/\s+/).filter(Boolean))
      : null;
    const conceptMatched = !hoveredConcepts
      ? idxMatched
      : idxMatched.filter((l) => {
          const otherSelector =
            hovered.kind === 'pali'
              ? `[data-en-idx="${l.engIdx}"]`
              : `[data-pali-idx="${l.paliIdx}"]`;
          const otherEl = containerRef.current!.querySelector<HTMLElement>(otherSelector);
          if (!otherEl) return true; // can't verify → keep (don't suppress on missing data)
          const otherConcepts: string[] = [];
          const direct = otherEl.dataset.conceptIds;
          if (direct) otherConcepts.push(...direct.split(/\s+/).filter(Boolean));
          // Pāli word may have morpheme sub-spans each with their own concepts
          otherEl.querySelectorAll<HTMLElement>('[data-concept-ids]').forEach((child) => {
            const ids = child.dataset.conceptIds;
            if (ids) otherConcepts.push(...ids.split(/\s+/).filter(Boolean));
          });
          if (otherConcepts.length === 0) return true; // untagged endpoint → keep
          return otherConcepts.some((c) => hoveredConcepts.has(c));
        });

    // Step 5 — anchor endpoints at hover element
    return conceptMatched.map((l) => {
      if (
        hovered.kind === 'pali' &&
        l.paliIdx === hovered.idx &&
        l.morphemeIdx === undefined
      ) {
        return {
          ...l,
          x1: r.left + r.width / 2 - cRect.left,
          y1: r.bottom - cRect.top,
        };
      }
      if (hovered.kind === 'en' && l.engIdx === hovered.idx) {
        return {
          ...l,
          x2: r.left + r.width / 2 - cRect.left,
          y2: r.top - cRect.top,
        };
      }
      return l;
    });
  })();

  return (
    <div className="mb-8 relative" id={segment.id} ref={containerRef}>
      {/* Pāli line — click cycles through the segment's scripts at the
          section level. Latin/Devanāgarī get per-word hover; CJK / Tibetan
          tokenise per-character/syllable unless the script variant carries
          a `tokens` hint, which groups multi-char compounds (般若, 波羅蜜多)
          into single hover units. If a `transliteration` is authored and
          the user's setting is on, a smaller Roman line renders beneath
          for pronunciation. */}
      <div
        className="text-center cursor-pointer select-text"
        onClick={onLineClick(onCycleScript)}
        title={segmentScripts.length > 1 ? `Click to switch script (${activeScript.label})` : undefined}
      >
        <PaliLine
          text={activeScript.text}
          words={segment.words}
          large={large}
          lang={activeScript.lang}
          tokens={activeScript.tokens}
        />
        <TransliterationLine variant={activeScript} words={segment.words} />
      </div>

      {/* English line — click cycles witness at the section level */}
      {currentWitness && (
        <div
          className="w-full text-center mt-6 px-2 py-1 cursor-pointer select-text"
          onClick={onLineClick(onCycleWitness)}
          title={segment.witnesses.length > 1 ? 'Click to switch translation' : undefined}
        >
          <div
            className="text-slate-300 italic leading-relaxed"
            style={{
              fontFamily: SERIF_STACK,
              // English translation line — 1.125rem base × ENGLISH_LINE_MULTIPLIER
              // (1.4 by default) so the gloss reads as easily as the chant.
              fontSize: `calc(${1.125 * ENGLISH_LINE_MULTIPLIER}rem * var(--liturgy-scale, 1))`,
            }}
          >
            <EnglishLine
              text={currentWitness.text}
              accentByEnIdx={accentByEnIdx}
              witnessBy={currentWitness.by}
              alignTo={currentWitness.alignTo}
            />
          </div>
        </div>
      )}

      {/* SVG alignment overlay — only renders lines for the hovered word.
          Endpoints are adjusted to the actual hovered element so the
          arrow anchors to the morpheme/word under the cursor. */}
      <AlignmentLines
        lines={adjustedLines}
        containerWidth={containerRef.current?.offsetWidth ?? 0}
      />

    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Section — wraps multiple segments + repetition marker + inline notes
// ─────────────────────────────────────────────────────────────────────────────

export const TripleScriptWitness: React.FC<{
  section: TripleScriptWitnessSection;
  /**
   * Page-level witness preference. Each segment renders whichever of its
   * witnesses matches `by`; falls back to the segment's first witness when
   * the active one isn't present. Lifted to LiturgyChantPage so the picker
   * lives once at the top instead of per-section.
   */
  preferredWitnessBy: string;
  /**
   * Cycle to the next witness at the page level. Clicking any English line
   * inside this section invokes this; the page's WitnessDots updates with it.
   */
  onCycleWitness: () => void;
  isOpening?: boolean;
}> = ({ section, preferredWitnessBy, onCycleWitness, isOpening = false }) => {
  // Section-level script index — kept local because different sections may
  // legitimately have different active scripts (e.g. the title might be
  // cycled to Hanzi while the body stays in Sino-Japanese).
  const [scriptIdx, setScriptIdx] = useState(0);

  // Union of scripts across segments — for the script-cycle ceiling. We
  // count by max segment-script-count rather than dedupe by lang, because
  // different segments may carry different orderings (e.g. one has SA-Latn
  // + SA-Deva + ZH-Hant, another has SA-Latn + BO-Tibt). Cycling advances
  // the index everywhere; each SegmentRow clamps internally to its own length.
  const maxScripts = useMemo(() => {
    let m = 1;
    for (const seg of section.segments) {
      const n = deriveScripts(seg).length;
      if (n > m) m = n;
    }
    return m;
  }, [section.segments]);

  const cycleScript = () => {
    if (maxScripts <= 1) return;
    setScriptIdx((s) => (s + 1) % maxScripts);
  };

  const sectionClass = isOpening
    ? section.compactOpening
      ? 'pt-24 pb-12 px-6 flex flex-col items-center'
      : 'min-h-[80vh] flex flex-col items-center justify-center px-6 py-16'
    : 'pt-16 pb-16 px-6 border-t border-slate-900';

  return (
    <section className={sectionClass} id={section.id}>
      <div className="w-full max-w-3xl mx-auto">
        {/* Segments interleaved Pali + English */}
        <div className="space-y-2">
          {section.segments.map((seg) => (
            <SegmentRow
              key={seg.id}
              segment={seg}
              scriptIdx={scriptIdx}
              preferredWitnessBy={preferredWitnessBy}
              onCycleWitness={onCycleWitness}
              onCycleScript={cycleScript}
              large={section.large ?? isOpening}
            />
          ))}
        </div>

        {/* Three dots for repetition (3×) — visual rhythm */}
        {section.repetitions && section.repetitions > 1 && (
          <div className="text-center text-slate-500 text-2xl tracking-[0.5em] mt-10 mb-4 select-none">
            {'•'.repeat(section.repetitions).split('').join(' ')}
          </div>
        )}

        {/* Chanter's note — inline, low-opacity, no toggle/label */}
        {section.commentary && (
          <ProseBlock
            text={section.commentary}
            className="space-y-3 text-slate-500 text-xs italic leading-relaxed mt-10 max-w-2xl mx-auto text-center"
          />
        )}
      </div>
    </section>
  );
};

export default TripleScriptWitness;

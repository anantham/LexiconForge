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

/** Resolve the script subtag from a BCP-47 tag (e.g. "sa-Latn" → "Latn"). */
function scriptSubtag(lang: string): string {
  const parts = lang.split('-');
  return parts.length >= 2 ? parts[1] : 'Latn';
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
  if (seg.paliDeva) out.push({ lang: 'pi-Deva', label: 'Devanāgarī', text: seg.paliDeva });
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
const TransliterationLine: React.FC<{ variant: ScriptVariant }> = ({ variant }) => {
  const { settings } = useLiturgySettings();
  if (!settings.showTransliteration) return null;
  if (!variant.transliteration) return null;
  const script = scriptSubtag(variant.lang);
  if (script === 'Latn') return null;
  return (
    <div
      className="text-slate-500 italic text-sm mt-1 leading-relaxed select-text"
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
}> = ({ text, tooltipText, bold = false, morphemeIdx }) => {
  const [open, setOpen] = useState(false);
  return (
    <span
      data-hover-span="true"
      data-morpheme-idx={morphemeIdx}
      className={`relative inline-block cursor-help border-b border-dotted border-emerald-700/40 hover:border-emerald-300 hover:text-emerald-100 transition-colors ${
        bold ? 'font-semibold' : ''
      }`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      {text}
      <AnimatePresence>{open && <Tooltip text={tooltipText} />}</AnimatePresence>
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
}> = ({ text, word, morphemes: morphemesOverride, hidePron = false }) => {
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
            />
          ))}
        </>
      );
    }
  }
  return <HoverSpan text={text} tooltipText={tooltipForWord(word, hidePron)} />;
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
  const sizeClass = large ? 'text-2xl md:text-3xl' : 'text-xl md:text-2xl';
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
      className={`text-slate-100 leading-loose ${sizeClass}`}
      style={{ fontFamily: fontStack }}
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
          />
        ) : (
          <HoverSpan text={t.text} tooltipText={tooltipForWord(word, hidePron)} />
        );
        return (
          <span
            key={i}
            data-pali-idx={paliSurfaceIdx}
            className={`inline-block ${accentClass}`}
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
}> = ({ text, accentByEnIdx }) => {
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
        return (
          <span
            key={i}
            data-en-idx={engIdx}
            className={`inline-block ${accentClass}`}
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

const AlignmentLines: React.FC<{ lines: Line[]; hovered: HoverTarget }> = ({
  lines,
  hovered,
}) => {
  // Hover-triggered: show ONLY the line(s) involving the hovered word.
  // Hover Pāli word → all English fragments aligned to it light up.
  // Hover English word → its single Pāli counterpart lights up.
  // No hover → no lines (the chant breathes uncluttered).
  const visible = hovered
    ? lines.filter((l) =>
        hovered.kind === 'pali' ? l.paliIdx === hovered.idx : l.engIdx === hovered.idx
      )
    : [];
  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      style={{ width: '100%', height: '100%' }}
      aria-hidden="true"
    >
      {visible.map((l, i) => {
        const dy = l.y2 - l.y1;
        const cp1y = l.y1 + dy * 0.5;
        const cp2y = l.y2 - dy * 0.5;
        const d = `M ${l.x1},${l.y1} C ${l.x1},${cp1y} ${l.x2},${cp2y} ${l.x2},${l.y2}`;
        return (
          <path
            key={`${l.paliIdx}-${l.engIdx}`}
            d={d}
            fill="none"
            stroke="rgb(110, 231, 183)"
            strokeOpacity="0.6"
            strokeWidth="1.5"
          />
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

  // Adjust the endpoint of any hovered line so it anchors to the actual
  // morpheme/word element under the cursor, not the centre of the whole
  // Pāli word. Cheap — only runs while something is hovered.
  //
  // Important: when lines already carry a `morphemeIdx` (because the
  // Pāli word was rendered with per-morpheme HoverSpans), each line is
  // already anchored at its correct morpheme position. The Pāli-side
  // override must only fire when the line has no morphemeIdx — otherwise
  // hovering a morpheme would yank every arrow on the word over to that
  // one morpheme's centre, collapsing the auto-distributed fan.
  const adjustedLines = (() => {
    if (!hovered || !containerRef.current) return lines;
    // Recompute lines fresh from current DOM — defensive against a stale
    // `lines` cache. The cache can be wrong when computeAlignmentLines
    // ran during a transient state (e.g. script swap before Devanāgarī
    // fonts loaded), giving zero-size element rects and negative-space
    // coordinates. We're hovering now, so the DOM is settled.
    const fresh = computeAlignmentLines(containerRef.current, currentWitness?.alignTo);
    const cRect = containerRef.current.getBoundingClientRect();
    const r = hovered.element.getBoundingClientRect();
    return fresh.map((l) => {
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
        <TransliterationLine variant={activeScript} />
      </div>

      {/* English line — click cycles witness at the section level */}
      {currentWitness && (
        <div
          className="w-full text-center mt-6 px-2 py-1 cursor-pointer select-text"
          onClick={onLineClick(onCycleWitness)}
          title={segment.witnesses.length > 1 ? 'Click to switch translation' : undefined}
        >
          <div
            className="text-slate-300 italic leading-relaxed text-base md:text-lg"
            style={{ fontFamily: SERIF_STACK }}
          >
            <EnglishLine text={currentWitness.text} accentByEnIdx={accentByEnIdx} />
          </div>
        </div>
      )}

      {/* SVG alignment overlay — only renders lines for the hovered word.
          Endpoints are adjusted to the actual hovered element so the
          arrow anchors to the morpheme/word under the cursor. */}
      <AlignmentLines lines={adjustedLines} hovered={hovered} />

      {/* Per-segment note — collapsed by default, expands on click. */}
      {segment.note && <SegmentNote text={segment.note} />}
    </div>
  );
};

const SegmentNote: React.FC<{ text: string }> = ({ text }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-3 text-center">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="text-[10px] uppercase tracking-widest text-slate-600 hover:text-emerald-400/80 transition-colors"
      >
        {open ? '— hide note —' : '+ note'}
      </button>
      {open && (
        <ProseBlock
          text={text}
          className="space-y-2 text-slate-400 text-xs italic leading-relaxed mt-3 max-w-xl mx-auto text-left"
        />
      )}
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

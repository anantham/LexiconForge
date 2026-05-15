import React, { useState, useRef, useLayoutEffect, useEffect, useMemo } from 'react';
import { AnimatePresence } from 'framer-motion';
import type {
  TripleScriptWitnessSection,
  TripleScriptWitnessSegment,
  WordGloss,
  WordMorpheme,
  AccentColor,
  Witness,
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

/** Tokenise a Pāli line into hover-enabled words + plain gaps. */
function tokenize(text: string): Array<{ kind: 'word' | 'gap'; text: string }> {
  const out: Array<{ kind: 'word' | 'gap'; text: string }> = [];
  const re = /([A-Za-zĀāĪīŪūṚṛṂṃṄṅÑñṬṭḌḍṆṇŚśṢṣḤḥṁÀ-ɏ]+|[^A-Za-zĀāĪīŪūṚṛṂṃṄṅÑñṬṭḌḍṆṇŚśṢṣḤḥṁÀ-ɏ]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const tok = m[0];
    const isWord = /^[A-Za-zĀāĪīŪūṚṛṂṃṄṅÑñṬṭḌḍṆṇŚśṢṣḤḥṁÀ-ɏ]+$/.test(tok);
    out.push({ kind: isWord ? 'word' : 'gap', text: tok });
  }
  return out;
}

function normalizeForMatch(s: string): string {
  return s.toLowerCase().replace(/[.,;:!?"'()\[\]।॥-]/g, '').trim();
}

function buildWordIndex(words: WordGloss[]): Map<string, WordGloss> {
  const idx = new Map<string, WordGloss>();
  for (const w of words) {
    const key = normalizeForMatch(w.form);
    if (key) idx.set(key, w);
  }
  return idx;
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
}> = ({ text, tooltipText, bold = false }) => {
  const [open, setOpen] = useState(false);
  return (
    <span
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

function tooltipForMorpheme(m: WordMorpheme): string {
  // Plain-English tooltip — no grammar jargon. Root marker only when present
  // (advanced reader cue, not required vocabulary).
  const parts: string[] = [];
  if (m.pronunciation) parts.push(`[${m.pronunciation}]`);
  if (m.root) parts.push(m.root);
  parts.push(m.gloss);
  return parts.filter(Boolean).join(' · ');
}

function tooltipForWord(w: WordGloss): string {
  return [w.pronunciation ? `[${w.pronunciation}]` : '', w.etymology ?? '', w.gloss]
    .filter(Boolean)
    .join(' · ');
}

const HoverWord: React.FC<{
  text: string;
  word: WordGloss;
}> = ({ text, word }) => {
  // If the word has morphemes and they cleanly reconstruct the surface,
  // render one hover span per morpheme — each independently tooltipped.
  // Root morphemes render bold so the eye lands on the meaning-carrier.
  if (word.morphemes && word.morphemes.length > 0) {
    const split = splitByMorphemes(text, word.morphemes);
    if (split) {
      return (
        <>
          {split.map((piece, i) => (
            <HoverSpan
              key={i}
              text={piece.text}
              tooltipText={tooltipForMorpheme(piece.morpheme)}
              bold={piece.morpheme.type === 'root'}
            />
          ))}
        </>
      );
    }
  }
  return <HoverSpan text={text} tooltipText={tooltipForWord(word)} />;
};

const PaliLine: React.FC<{
  text: string;
  words?: WordGloss[];
  large?: boolean;
}> = ({ text, words = [], large = false }) => {
  const idx = buildWordIndex(words);
  const tokens = tokenize(text);
  const sizeClass = large ? 'text-2xl md:text-3xl' : 'text-xl md:text-2xl';

  // Track surface-Pāli-word position separately from token index (which
  // includes whitespace/punctuation "gap" tokens). data-pali-idx is what
  // alignment lines use to find each word.
  let paliSurfaceIdx = -1;

  return (
    <div
      className={`text-slate-100 leading-loose ${sizeClass}`}
      style={{ fontFamily: SERIF_STACK }}
    >
      {tokens.map((t, i) => {
        if (t.kind === 'gap') return <React.Fragment key={i}>{t.text}</React.Fragment>;
        paliSurfaceIdx += 1;
        const word = matchWord(t.text, idx);
        const accentClass = word?.accent ? ACCENT_CLASS[word.accent] : '';
        return (
          <span
            key={i}
            data-pali-idx={paliSurfaceIdx}
            className={`inline-block ${accentClass}`}
          >
            {word ? <HoverWord text={t.text} word={word} /> : t.text}
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
  const tokens = tokenizeEnglish(text);
  let engIdx = -1;
  return (
    <>
      {tokens.map((t, i) => {
        if (/^\s+$/.test(t)) return <React.Fragment key={i}>{t}</React.Fragment>;
        engIdx += 1;
        const accent = accentByEnIdx?.get(engIdx);
        const accentClass = accent ? ACCENT_CLASS[accent] : '';
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
// WitnessDots — interactive citation indicator
// ─────────────────────────────────────────────────────────────────────────────

const WitnessDots: React.FC<{
  witnesses: Witness[];
  activeIdx: number;
  onSelect: (idx: number) => void;
}> = ({ witnesses, activeIdx, onSelect }) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const hovered = hoveredIdx !== null ? witnesses[hoveredIdx] : null;
  return (
    <div className="relative inline-flex gap-2 items-center">
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
            onMouseLeave={() => setHoveredIdx(null)}
            className={`w-2 h-2 rounded-full transition-all ${
              active
                ? 'bg-emerald-400'
                : 'border border-slate-600 bg-transparent hover:border-emerald-400 hover:bg-emerald-500/30'
            }`}
            aria-label={`Show ${w.by}${active ? ' (active)' : ''}`}
          />
        );
      })}
      {hovered && (
        <div
          className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50 px-3 py-2 rounded bg-slate-900/95 border border-slate-700 shadow-xl text-xs whitespace-normal text-left pointer-events-auto"
          style={{ maxWidth: 'min(20rem, calc(100vw - 1rem))', minWidth: '12rem' }}
        >
          <div className="text-slate-200 font-medium">{hovered.by}</div>
          {hovered.license && (
            <div className="text-slate-500 mt-0.5">{hovered.license}</div>
          )}
          {hovered.url && (
            <a
              href={hovered.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-emerald-400/80 hover:text-emerald-300 mt-1 break-all"
              onClick={(e) => e.stopPropagation()}
            >
              {hovered.url} ↗
            </a>
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
};

function computeAlignmentLines(
  container: HTMLDivElement,
  alignTo: number[] | undefined
): Line[] {
  if (!alignTo) return [];
  const cRect = container.getBoundingClientRect();
  const paliEls = container.querySelectorAll<HTMLElement>('[data-pali-idx]');
  const enEls = container.querySelectorAll<HTMLElement>('[data-en-idx]');
  const lines: Line[] = [];
  for (let engIdx = 0; engIdx < alignTo.length; engIdx++) {
    const paliIdx = alignTo[engIdx];
    if (paliIdx < 0) continue;
    const paliEl = paliEls[paliIdx];
    const enEl = enEls[engIdx];
    if (!paliEl || !enEl) continue;
    const pr = paliEl.getBoundingClientRect();
    const er = enEl.getBoundingClientRect();
    lines.push({
      x1: pr.left + pr.width / 2 - cRect.left,
      y1: pr.bottom - cRect.top,
      x2: er.left + er.width / 2 - cRect.left,
      y2: er.top - cRect.top,
      engIdx,
      paliIdx,
    });
  }
  return lines;
}

type HoverTarget = { kind: 'pali' | 'en'; idx: number } | null;

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
  script: 'roman' | 'deva';
  primaryWitness: string;
  large?: boolean;
}> = ({ segment, script, primaryWitness, large = false }) => {
  const witnessStart = Math.max(
    0,
    segment.witnesses.findIndex((w) => w.by === primaryWitness)
  );
  const [witnessIdx, setWitnessIdx] = useState(witnessStart);
  const currentWitness = segment.witnesses[witnessIdx];
  const containerRef = useRef<HTMLDivElement>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [hovered, setHovered] = useState<HoverTarget>(null);

  // Compute accent-by-surface-Pāli-position for this segment.
  // Then map to accent-by-English-index via the current witness's alignment.
  const accentByPaliPos = useMemo(() => {
    const map = new Map<number, AccentColor>();
    if (!segment.words) return map;
    const wordIdx = buildWordIndex(segment.words);
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

  // Compute alignment lines after layout, recompute on resize / witness change.
  useLayoutEffect(() => {
    if (!containerRef.current) return;
    const compute = () => {
      if (!containerRef.current) return;
      setLines(computeAlignmentLines(containerRef.current, currentWitness?.alignTo));
    };
    compute();
    const raf = requestAnimationFrame(compute);
    const onResize = () => compute();
    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
    };
  }, [witnessIdx, segment.id, currentWitness?.text, currentWitness?.alignTo]);

  // Hover detection via event delegation on the segment container.
  // mouseover bubbles up; we check whether the target sits inside any
  // [data-pali-idx] or [data-en-idx] span and set hovered accordingly.
  // mouseout to outside the segment clears it.
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
          setHovered({ kind: 'pali', idx });
          return;
        }
      }
      const enEl = t.closest('[data-en-idx]') as HTMLElement | null;
      if (enEl) {
        const idx = parseInt(enEl.getAttribute('data-en-idx') || '-1', 10);
        if (idx >= 0) {
          setHovered({ kind: 'en', idx });
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

  return (
    <div className="mb-8 relative" id={segment.id} ref={containerRef}>
      {/* Pali line */}
      <div className="text-center">
        {script === 'roman' ? (
          <PaliLine text={segment.pali} words={segment.words} large={large} />
        ) : segment.paliDeva ? (
          <div
            className={`text-slate-100 leading-loose ${large ? 'text-2xl md:text-3xl' : 'text-xl md:text-2xl'}`}
            style={{ fontFamily: DEVA_STACK }}
            lang="pi-Deva"
          >
            {segment.paliDeva}
          </div>
        ) : (
          <PaliLine text={segment.pali} words={segment.words} large={large} />
        )}
      </div>

      {/* English line — text always selectable. The witness dots below give
          direct access to alternative renderings + source citations on hover. */}
      {currentWitness && (
        <div className="w-full text-center mt-6 px-2 py-1">
          <div
            className="text-slate-300 italic leading-relaxed text-base md:text-lg select-text"
            style={{ fontFamily: SERIF_STACK }}
          >
            <EnglishLine text={currentWitness.text} accentByEnIdx={accentByEnIdx} />
          </div>
          <div className="mt-3 flex justify-center">
            <WitnessDots
              witnesses={segment.witnesses}
              activeIdx={witnessIdx}
              onSelect={setWitnessIdx}
            />
          </div>
        </div>
      )}

      {/* SVG alignment overlay — only renders lines for the hovered word */}
      <AlignmentLines lines={lines} hovered={hovered} />
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Section — wraps multiple segments + repetition marker + inline notes
// ─────────────────────────────────────────────────────────────────────────────

export const TripleScriptWitness: React.FC<{
  section: TripleScriptWitnessSection;
  primaryWitness: string;
  isOpening?: boolean;
}> = ({ section, primaryWitness, isOpening = false }) => {
  // Script: Pāli roman only. Devanāgarī availability is in the data and may
  // surface later as a user preference, not a per-section toggle.
  const sectionClass = isOpening
    ? 'min-h-[80vh] flex flex-col items-center justify-center px-6 py-16'
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
              script="roman"
              primaryWitness={primaryWitness}
              large={isOpening}
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
            className="space-y-3 text-slate-500 text-xs italic leading-relaxed mt-12 max-w-2xl mx-auto text-center"
          />
        )}
      </div>
    </section>
  );
};

export default TripleScriptWitness;

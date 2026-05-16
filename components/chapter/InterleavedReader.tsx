/**
 * components/chapter/InterleavedReader.tsx — Issue #15 Phase 3
 *
 * Renders source + target text as aligned word pairs (using Phase 1's
 * WordAlignment) with hover-fetch tooltips (Phase 2's lookupWord).
 *
 * UX model (mirrors sutta-studio's PaliWord/EnglishWord):
 *  - Each WordPair renders source ABOVE target, vertically stacked
 *  - Hover a pair → tooltip with all alternative senses (glossary + deepl + google)
 *  - Click a pair → cycle through senses (currently shown sense rotates)
 *  - Pairs with target="" are rendered muted (dropped in translation)
 *  - Source/target chars OUTSIDE any pair render as plain text (gap fill)
 */
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import type { WordAlignment, WordPair } from '../../services/wordAlignment';
import { lookupWord, type Sense } from '../../services/perWordTranslation';
import type { GlossaryEntry } from '../../types';

export interface InterleavedReaderProps {
  source: string;
  target: string;
  alignment: WordAlignment | null;
  glossary?: GlossaryEntry[];
  sourceLang?: string;
  targetLang?: string;
  apiKeys?: { deepl?: string; google?: string };
  /** Called when no alignment is available; UI shows "Compute alignment" button */
  onRequestAlignment?: () => void;
  isComputingAlignment?: boolean;
}

interface RenderSegment {
  kind: 'pair' | 'source-gap' | 'target-gap';
  source?: string;
  target?: string;
  pairIndex?: number; // index into alignment.pairs (only for kind=='pair')
}

/**
 * Walk the alignment + raw text and produce a flat list of RenderSegments
 * that can be rendered in order. Source-gap segments are unaligned source
 * chars between pairs (e.g., punctuation, particles); target-gap likewise.
 */
const buildSegments = (
  alignment: WordAlignment,
  source: string,
  target: string,
): RenderSegment[] => {
  // Sort by source order (alignment.pairs is supposed to already be in order
  // but we don't trust it).
  const sorted = [...alignment.pairs]
    .map((p, i) => ({ ...p, originalIndex: i }))
    .sort((a, b) => a.sourceStart - b.sourceStart);

  const segments: RenderSegment[] = [];
  let sourceCursor = 0;
  let targetCursor = 0;

  for (const p of sorted) {
    // Source-gap before this pair
    if (p.sourceStart > sourceCursor) {
      const gap = source.slice(sourceCursor, p.sourceStart);
      if (gap.length > 0) {
        segments.push({ kind: 'source-gap', source: gap });
      }
    }
    // Target-gap before this pair (linearly, may not exactly match if target
    // was reordered — we just emit any unclaimed prefix)
    if (p.targetStart > targetCursor && p.target.length > 0) {
      const gap = target.slice(targetCursor, p.targetStart);
      if (gap.length > 0) {
        segments.push({ kind: 'target-gap', target: gap });
      }
    }
    segments.push({
      kind: 'pair',
      source: p.source,
      target: p.target,
      pairIndex: p.originalIndex,
    });
    sourceCursor = Math.max(sourceCursor, p.sourceEnd);
    if (p.target.length > 0) {
      targetCursor = Math.max(targetCursor, p.targetEnd);
    }
  }

  // Trailing gaps
  if (sourceCursor < source.length) {
    segments.push({ kind: 'source-gap', source: source.slice(sourceCursor) });
  }
  if (targetCursor < target.length) {
    segments.push({ kind: 'target-gap', target: target.slice(targetCursor) });
  }

  return segments;
};

/**
 * Single aligned word pair. Hovering fetches alternative senses; clicking
 * cycles which sense is "active" (displayed in the larger target text).
 */
const WordPairToken: React.FC<{
  pair: WordPair;
  glossary?: GlossaryEntry[];
  sourceLang?: string;
  targetLang?: string;
  apiKeys?: { deepl?: string; google?: string };
}> = ({ pair, glossary, sourceLang, targetLang, apiKeys }) => {
  const [senses, setSenses] = useState<Sense[]>([
    // The translation's own rendering is always the first "sense"
    { english: pair.target, provider: 'cache' },
  ]);
  const [activeSenseIdx, setActiveSenseIdx] = useState(0);
  const [hovered, setHovered] = useState(false);

  // No `fetched` guard: lookupWord has its own per-process cache (in
  // perWordTranslation.ts), so re-calling it is essentially free. This
  // matters because glossary or apiKeys can change after first hover, and
  // we need the next hover to surface the new alternatives.
  const handleMouseEnter = useCallback(async () => {
    setHovered(true);
    if (!pair.source) return;
    const alts = await lookupWord({
      sourceWord: pair.source,
      sourceLang: sourceLang || 'auto',
      targetLang: targetLang || 'en',
      glossary,
      apiKeys,
    });
    // Merge: keep the translation's own rendering as sense 0, append novel
    // alternatives. Re-deduped on each hover so glossary/apiKeys changes
    // surface immediately.
    setSenses((prev) => {
      const base = prev[0]?.english === pair.target ? [prev[0]] : [{ english: pair.target, provider: 'cache' as const }];
      const existing = new Set(base.map((s) => s.english));
      const novel = alts.filter((a) => !existing.has(a.english));
      return [...base, ...novel];
    });
  }, [pair.source, pair.target, glossary, sourceLang, targetLang, apiKeys]);

  const handleClick = useCallback(() => {
    if (senses.length <= 1) return;
    setActiveSenseIdx((i) => (i + 1) % senses.length);
  }, [senses.length]);

  const activeTarget = senses[activeSenseIdx]?.english ?? pair.target;
  const isMuted = pair.target === '';

  return (
    <span
      className={`inline-flex flex-col items-center mx-0.5 my-0.5 px-1 rounded cursor-pointer transition-colors ${
        hovered ? 'bg-amber-50 dark:bg-amber-900/20' : ''
      } ${isMuted ? 'opacity-50' : ''}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setHovered(false)}
      onClick={handleClick}
      title={pair.source}
      data-testid="interleaved-pair"
      data-source={pair.source}
      data-target={activeTarget}
      data-sense-count={senses.length}
    >
      <span className="text-xs text-gray-500 dark:text-gray-400 font-mono leading-tight">
        {pair.source}
      </span>
      <span className="text-base text-gray-900 dark:text-gray-100 leading-tight">
        {isMuted ? <span className="italic">·</span> : activeTarget}
      </span>
      {hovered && senses.length > 1 && (
        <span
          className="absolute z-50 mt-12 w-56 p-2 rounded-lg shadow-xl bg-gray-800 text-white text-xs text-left"
          data-testid="interleaved-pair-tooltip"
        >
          <div className="font-medium text-gray-300 mb-1 border-b border-gray-700 pb-1">
            {pair.source}
          </div>
          {senses.map((s, idx) => (
            <div
              key={`${s.provider}-${idx}-${s.english}`}
              className={`py-0.5 ${idx === activeSenseIdx ? 'text-amber-300 font-medium' : 'text-gray-100'}`}
            >
              <span className="opacity-60 mr-1">[{s.provider}]</span>
              {s.english}
              {s.note && <span className="opacity-50 italic ml-1">({s.note})</span>}
            </div>
          ))}
          <div className="text-[10px] text-gray-500 mt-1">click to cycle</div>
        </span>
      )}
    </span>
  );
};

const InterleavedReader: React.FC<InterleavedReaderProps> = ({
  source,
  target,
  alignment,
  glossary,
  sourceLang,
  targetLang,
  apiKeys,
  onRequestAlignment,
  isComputingAlignment,
}) => {
  const segments = useMemo(() => {
    if (!alignment || alignment.pairs.length === 0) return [];
    return buildSegments(alignment, source, target);
  }, [alignment, source, target]);

  if (!alignment || alignment.pairs.length === 0) {
    return (
      <div className="p-6 border border-amber-300/50 dark:border-amber-700/50 rounded-lg bg-amber-50 dark:bg-amber-900/10">
        <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
          Word alignment hasn't been computed for this chapter yet. The
          interleaved reader needs alignment to map source words to their
          English translations.
        </p>
        {onRequestAlignment && (
          <button
            onClick={onRequestAlignment}
            disabled={isComputingAlignment}
            className="px-4 py-2 bg-amber-200 dark:bg-amber-800 text-amber-900 dark:text-amber-100 rounded font-medium hover:bg-amber-300 dark:hover:bg-amber-700 disabled:opacity-50"
            data-testid="interleaved-request-alignment"
          >
            {isComputingAlignment ? 'Computing alignment…' : 'Compute word alignment'}
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      className="leading-relaxed text-gray-900 dark:text-gray-100 font-serif"
      data-testid="interleaved-reader"
    >
      {segments.map((seg, idx) => {
        if (seg.kind === 'pair' && seg.pairIndex !== undefined) {
          const pair = alignment.pairs[seg.pairIndex];
          return (
            <WordPairToken
              key={`pair-${idx}`}
              pair={pair}
              glossary={glossary}
              sourceLang={sourceLang}
              targetLang={targetLang}
              apiKeys={apiKeys}
            />
          );
        }
        if (seg.kind === 'source-gap') {
          // Render source-gap inline (e.g., punctuation between aligned pairs)
          return (
            <span
              key={`sgap-${idx}`}
              className="text-xs text-gray-400 dark:text-gray-500 mx-0.5"
              data-testid="interleaved-source-gap"
            >
              {seg.source}
            </span>
          );
        }
        // target-gap
        return (
          <span
            key={`tgap-${idx}`}
            className="text-base text-gray-700 dark:text-gray-300 italic"
            data-testid="interleaved-target-gap"
          >
            {seg.target}
          </span>
        );
      })}
    </div>
  );
};

export default InterleavedReader;

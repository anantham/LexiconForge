import { AnimatePresence, motion } from 'framer-motion';
import { memo } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { PaliWord, WordClass, WordSegment } from '../../types/suttaStudio';
import type { Focus } from './types';
import { REFRAIN_COLORS, RELATION_COLORS, RELATION_GLYPHS, RELATION_HOOK } from './palette';
import { hasTextSelection, resolveSenseId, resolveSegmentTooltip, segDomId, segmentIdToDomId, wordDomId } from './utils';
import { Tooltip } from './Tooltip';

/**
 * Derive text color from wordClass.
 * content → green (semantic words)
 * function → white (grammatical glue)
 */
const getWordColor = (wordClass?: WordClass, fallbackColor?: string): string => {
  if (wordClass === 'content') return 'text-emerald-400';
  if (wordClass === 'function') return 'text-slate-200';
  // Fallback to explicit color or default white
  return fallbackColor || 'text-white';
};

export const PaliWordEngine = memo(function PaliWordEngine({
  phaseId,
  wordData,
  activeIndex,
  studyMode,
  cycle,
  hovered,
  pinned,
  setHovered,
  setPinned,
}: {
  phaseId: string;
  wordData: PaliWord;
  activeIndex: number;
  studyMode: boolean;
  cycle: (wordId: string) => void;
  hovered: Focus | null;
  pinned: Focus | null;
  setHovered: Dispatch<SetStateAction<Focus | null>>;
  setPinned: Dispatch<SetStateAction<Focus | null>>;
}) {
  const wDomId = wordDomId(phaseId, wordData.id);
  const isWordFocused = (pinned?.wordId ?? hovered?.wordId) === wordData.id;

  // Refrain colors (for repeated formulas) - only in study mode
  const refrainStyle = wordData.refrainId && studyMode ? REFRAIN_COLORS[wordData.refrainId] : null;

  const onWordClick = () => {
    console.log('[PaliWord] CLICK', { wordId: wordData.id, surface: wordData.segments.map(s => s.text).join(''), hasSelection: hasTextSelection() });
    if (hasTextSelection()) return;
    cycle(wordData.id);
  };

  return (
    <motion.div
      layoutId={`${phaseId}-${wordData.id}`}
      id={wDomId}
      data-interactive="true"
      className={`flex flex-col items-center mx-1 md:mx-2 bg-slate-950 relative z-10 ${
        isWordFocused ? 'ring-1 ring-emerald-900/50 rounded' : ''
      } ${refrainStyle ? `border-b-2 ${refrainStyle.underline} pb-1` : ''}`}
      onClick={onWordClick}
      title="Click: rotate meaning"
    >
      <div className={`text-3xl md:text-5xl lg:text-6xl font-serif flex items-end ${getWordColor(wordData.wordClass, wordData.color)}`}>
        {wordData.segments.map((seg: WordSegment, i: number) => {
          // Use segment ID if available, fall back to index-based ID
          const sDomId = seg.id
            ? segmentIdToDomId(phaseId, seg.id)
            : segDomId(phaseId, wordData.id, i);
          const isHovered = hovered?.kind === 'segment' && hovered.segmentDomId === sDomId;
          const isPinned = pinned?.kind === 'segment' && pinned.segmentDomId === sDomId;

          const activeSenseId = resolveSenseId(wordData, activeIndex);
          const tooltipText = seg.relation?.label || resolveSegmentTooltip(seg, activeSenseId, activeIndex);
          const showTooltip = studyMode && isHovered && !pinned;

          // Debug: log tooltip decision when hovered
          if (isHovered) {
            console.log('[PaliWord] TOOLTIP_CHECK', {
              segmentText: seg.text,
              showTooltip,
              studyMode,
              isHovered,
              pinned: !!pinned,
              tooltipText: tooltipText || '(empty)',
              segTooltips: seg.tooltips,
              segTooltip: seg.tooltip,
            });
          }

          const showHook = false;
          const relationStyle = seg.relation ? RELATION_COLORS[seg.relation.type] : null;
          const segmentClass =
            studyMode && relationStyle
              ? `${relationStyle.tailwind} font-semibold border-b border-slate-700/40 pb-0.5`
              : studyMode
                ? 'border-b border-slate-700/30 pb-0.5'
                : '';

          return (
            <div
              key={i}
              id={sDomId}
              data-interactive="true"
              className={`relative px-[2px] rounded transition-all duration-150 ${
                isHovered || isPinned
                  ? 'bg-white/5 z-20 border-b-2 border-white/60 pb-1 -mb-1'
                  : 'border-b-2 border-transparent pb-0'
              } ${segmentClass} ${studyMode ? 'cursor-help' : ''}`}
              onMouseEnter={() => {
                console.log('[PaliWord] HOVER_ENTER', { segmentText: seg.text, segmentId: seg.id, sDomId, pinned: !!pinned, studyMode, tooltipText });
                if (pinned) return;
                setHovered({
                  kind: 'segment',
                  wordId: wordData.id,
                  segmentId: seg.id,
                  segmentIndex: i,
                  segmentDomId: sDomId,
                  data: seg,
                });
              }}
              onMouseLeave={() => {
                console.log('[PaliWord] HOVER_LEAVE', { segmentText: seg.text, sDomId, pinned: !!pinned });
                if (pinned) return;
                setHovered(null);
              }}
              title={studyMode && !showTooltip ? 'Hover: segment details' : ''}
            >
              {seg.text}

              <AnimatePresence>
                {showHook && seg.relation && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 4 }}
                    className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] px-2 py-0.5 rounded border bg-slate-950/80 border-slate-800 text-slate-500 pointer-events-none select-none"
                  >
                    <span className={RELATION_COLORS[seg.relation.type].tailwind}>
                      {RELATION_GLYPHS[seg.relation.type]}
                    </span>{' '}
                    {RELATION_HOOK[seg.relation.type]}
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence>{showTooltip && tooltipText && <Tooltip text={tooltipText} />}</AnimatePresence>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
});

import { AnimatePresence, motion } from 'framer-motion';
import { memo } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { PaliWord, WordSegment } from '../../types/suttaStudio';
import type { Focus } from './types';
import { RELATION_COLORS } from './palette';
import { hasTextSelection, resolveSenseId, resolveSegmentTooltip, segDomId, wordDomId } from './utils';
import { Tooltip } from './Tooltip';

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

  const onWordClick = () => {
    if (hasTextSelection()) return;
    cycle(wordData.id);
  };

  return (
    <motion.div
      layoutId={`${phaseId}-${wordData.id}`}
      id={wDomId}
      data-interactive="true"
      className={`flex flex-col items-center mx-1 md:mx-2 ${
        isWordFocused ? 'ring-1 ring-emerald-900/50 rounded' : ''
      }`}
      onClick={onWordClick}
      title="Click: rotate meaning"
    >
      <div className={`text-3xl md:text-5xl font-serif flex items-end ${wordData.color || 'text-white'}`}>
        {wordData.segments.map((seg: WordSegment, i: number) => {
          const sDomId = segDomId(phaseId, wordData.id, i);
          const isHovered = hovered?.kind === 'segment' && hovered.segmentDomId === sDomId;
          const isPinned = pinned?.kind === 'segment' && pinned.segmentDomId === sDomId;

          const activeSenseId = resolveSenseId(wordData, activeIndex);
          const tooltipText = seg.relation?.label || resolveSegmentTooltip(seg, activeSenseId, activeIndex);
          const showTooltip = studyMode && isHovered && !pinned;

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
                if (pinned) return;
                setHovered({
                  kind: 'segment',
                  wordId: wordData.id,
                  segmentIndex: i,
                  segmentDomId: sDomId,
                  data: seg,
                });
              }}
              onMouseLeave={() => {
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

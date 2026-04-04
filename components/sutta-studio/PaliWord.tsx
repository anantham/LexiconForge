import { AnimatePresence, motion } from 'framer-motion';
import { memo } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { PaliWord, WordSegment } from '../../types/suttaStudio';
import type { Focus } from './types';
import type { StudioSettings } from './SettingsPanel';
import { REFRAIN_COLORS, RELATION_COLORS, RELATION_GLYPHS, RELATION_HOOK } from './palette';
import { getWordColor, hasTextSelection, resolveSenseId, resolveSegmentTooltip, segDomId, segmentIdToDomId, stripEmoji, stripGrammarTerms, wordDomId } from './utils';
import { Tooltip } from './Tooltip';

export const PaliWordEngine = memo(function PaliWordEngine({
  phaseId,
  wordData,
  activeIndex,
  activeSegmentIndices,
  settings,
  cycle,
  cycleSegment,
  hovered,
  pinned,
  setHovered,
  setPinned,
}: {
  phaseId: string;
  wordData: PaliWord;
  activeIndex: number;
  activeSegmentIndices?: Record<string, number>;
  settings: StudioSettings;
  cycle: (wordId: string) => void;
  cycleSegment?: (phaseId: string, segmentId: string) => void;
  hovered: Focus | null;
  pinned: Focus | null;
  setHovered: Dispatch<SetStateAction<Focus | null>>;
  setPinned: Dispatch<SetStateAction<Focus | null>>;
}) {
  const wDomId = wordDomId(phaseId, wordData.id);
  const focus = pinned ?? hovered;
  const isWordFocused = focus?.phaseId === phaseId && focus?.wordId === wordData.id;

  // Refrain colors (for repeated formulas) - gated by settings
  const refrainStyle = wordData.refrainId && settings.refrainColors ? REFRAIN_COLORS[wordData.refrainId] : null;

  const onWordClick = () => {
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

          // Resolve active sense for this segment (segment-level senses take priority over word-level)
          const segKey = seg.id ? `${phaseId}-${seg.id}` : null;
          const activeSegmentIdx = segKey ? (activeSegmentIndices?.[segKey] ?? 0) : 0;
          const activeSenseId = resolveSenseId(wordData, activeIndex);
          const segSenseText = seg.senses?.length ? seg.senses[activeSegmentIdx]?.english : null;
          const rawTooltip = segSenseText || seg.relation?.label || resolveSegmentTooltip(seg, activeSenseId, activeIndex);
          // Apply filters based on settings
          let tooltipText = rawTooltip;
          if (!settings.grammarTerms) tooltipText = stripGrammarTerms(tooltipText);
          if (!settings.emojiInTooltips) tooltipText = stripEmoji(tooltipText);
          // Show tooltip on hover (when nothing pinned) OR persistently when this segment is pinned
          const showTooltip = settings.tooltips && (isPinned || (isHovered && !pinned));

          const showHook = false;
          const relationStyle = seg.relation ? RELATION_COLORS[seg.relation.type] : null;
          // Grammar styling shown when grammar arrows enabled
          const segmentClass =
            settings.grammarArrows && relationStyle
              ? `${relationStyle.tailwind} font-semibold border-b border-slate-700/40 pb-0.5`
              : settings.grammarArrows
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
              } ${segmentClass} ${settings.tooltips ? 'cursor-help' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                if (hasTextSelection()) return;
                const segFocus: Focus = {
                  kind: 'segment',
                  phaseId,
                  wordId: wordData.id,
                  segmentId: seg.id,
                  segmentIndex: i,
                  segmentDomId: sDomId,
                  data: seg,
                };
                // Toggle pin: click pinned segment → unpin; click elsewhere → pin
                setPinned((prev) =>
                  prev?.kind === 'segment' && prev.segmentDomId === sDomId ? null : segFocus
                );
                // Cycle segment senses if available
                if (seg.senses?.length && seg.id) {
                  cycleSegment?.(phaseId, seg.id);
                }
              }}
              onMouseEnter={() => {
                if (pinned) return;
                setHovered({
                  kind: 'segment',
                  phaseId,
                  wordId: wordData.id,
                  segmentId: seg.id,
                  segmentIndex: i,
                  segmentDomId: sDomId,
                  data: seg,
                });
              }}
              onMouseLeave={() => {
                if (pinned) return;
                setHovered(null);
              }}
              title={settings.tooltips && !showTooltip ? 'Click: pin • Hover: segment details' : ''}
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

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
  tooltipFacetIndices,
  settings,
  cycle,
  cycleSegment,
  cycleSegmentTooltipFacet,
  hovered,
  setHovered,
}: {
  phaseId: string;
  wordData: PaliWord;
  activeIndex: number;
  activeSegmentIndices?: Record<string, number>;
  tooltipFacetIndices?: Record<string, number>;
  settings: StudioSettings;
  cycle: (wordId: string) => void;
  cycleSegment?: (phaseId: string, segmentId: string) => void;
  cycleSegmentTooltipFacet?: (phaseId: string, segmentId: string) => void;
  hovered: Focus | null;
  setHovered: Dispatch<SetStateAction<Focus | null>>;
}) {
  const wDomId = wordDomId(phaseId, wordData.id);
  const isWordFocused = hovered?.phaseId === phaseId && hovered?.wordId === wordData.id;

  // Refrain colors (for repeated formulas) - gated by settings
  const refrainStyle = wordData.refrainId && settings.refrainColors ? REFRAIN_COLORS[wordData.refrainId] : null;

  const onWordClick = () => {
    if (hasTextSelection()) return;
    cycle(wordData.id);
  };

  // Anchor styling: when a word is the semantic centerpiece of its phase
  // (PaliWord.isAnchor), give it a subtle warm underline + slight weight increase.
  // The cue is implicit — no badge, no "★", no label. Just a felt difference.
  // Refrain styling takes precedence on the wrapper underline; anchor still
  // gets the slight weight bump.
  const isAnchor = Boolean(wordData.isAnchor);

  return (
    <motion.div
      layoutId={`${phaseId}-${wordData.id}`}
      id={wDomId}
      data-interactive="true"
      className={`flex flex-col items-center mx-1 md:mx-2 bg-slate-950 relative z-10 ${
        isWordFocused ? 'ring-1 ring-emerald-900/50 rounded' : ''
      } ${refrainStyle ? `border-b-2 ${refrainStyle.underline} pb-1` : ''} ${
        isAnchor && !refrainStyle ? 'border-b-2 border-amber-700/30 pb-0.5' : ''
      }`}
      onClick={onWordClick}
      title="Click: rotate meaning"
    >
      <div className={`text-3xl md:text-5xl lg:text-6xl font-serif flex items-end ${getWordColor(wordData.wordClass, wordData.color)} ${
        isAnchor ? 'font-medium' : ''
      }`}>
        {wordData.segments.map((seg: WordSegment, i: number) => {
          // Use segment ID if available, fall back to index-based ID
          const sDomId = seg.id
            ? segmentIdToDomId(phaseId, seg.id)
            : segDomId(phaseId, wordData.id, i);
          const isHovered = hovered?.kind === 'segment' && hovered.segmentDomId === sDomId;

          // Resolve active sense for this segment (segment-level senses take priority over word-level)
          const segKey = seg.id ? `${phaseId}-${seg.id}` : null;
          const activeSegmentIdx = segKey ? (activeSegmentIndices?.[segKey] ?? 0) : 0;
          const activeSenseId = resolveSenseId(wordData, activeIndex);
          const segSenseText = seg.senses?.length ? seg.senses[activeSegmentIdx]?.english : null;
          // Tooltip facet index — advanced by clicking the Pāli segment.
          // When a segment has multiple `tooltips[]` strings, each click
          // cycles to the next facet (Meaning / What English hides / etc.).
          // If the segment has only one tooltip, this index stays at 0.
          const tooltipFacetIdx = segKey ? (tooltipFacetIndices?.[segKey] ?? 0) : 0;
          const tooltipsArr = seg.tooltips ?? [];
          const facetTooltip = tooltipsArr.length > 0 ? tooltipsArr[tooltipFacetIdx % tooltipsArr.length] : '';
          // Precedence: segment-level English sense → segment's own tooltips
          // (cycled by click) → relation arrow label → utility fallback.
          // The relation.label belongs to the arrow's visual; if the segment
          // has its own tooltip content, show that and let the arrow speak
          // for itself. Otherwise relation.label is a useful fallback.
          const rawTooltip = segSenseText || facetTooltip || seg.relation?.label || resolveSegmentTooltip(seg, activeSenseId, activeIndex);
          // Apply filters based on settings
          let tooltipText = rawTooltip;
          if (!settings.grammarTerms) tooltipText = stripGrammarTerms(tooltipText);
          if (!settings.emojiInTooltips) tooltipText = stripEmoji(tooltipText);
          // Show tooltip on hover only — no persistent pinned state.
          const showTooltip = settings.tooltips && isHovered;

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
                isHovered
                  ? 'bg-white/5 z-20 border-b-2 border-white/60 pb-1 -mb-1'
                  : 'border-b-2 border-transparent pb-0'
              } ${segmentClass} ${settings.tooltips ? 'cursor-help' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                if (hasTextSelection()) return;
                // Click cycles through the segment's tooltip facets (when
                // there's more than one) and through segment-level senses
                // (when the segment has its own senses). No pin side-effect;
                // tooltips are hover-only.
                if (seg.id && (seg.tooltips?.length ?? 0) > 1) {
                  cycleSegmentTooltipFacet?.(phaseId, seg.id);
                }
                if (seg.senses?.length && seg.id) {
                  cycleSegment?.(phaseId, seg.id);
                }
              }}
              onMouseEnter={() => {
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
                setHovered(null);
              }}
              title={settings.tooltips && !showTooltip ? 'Hover: details · Click: cycle facets' : ''}
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

              <AnimatePresence>
                {showTooltip && tooltipText && (
                  <Tooltip
                    text={tooltipText}
                    facetIndex={tooltipsArr.length > 1 ? tooltipFacetIdx % tooltipsArr.length : undefined}
                    facetTotal={tooltipsArr.length > 1 ? tooltipsArr.length : undefined}
                  />
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
});

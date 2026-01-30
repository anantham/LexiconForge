import { AnimatePresence, motion } from 'framer-motion';
import { memo } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { EnglishToken, PaliWord } from '../../types/suttaStudio';
import type { Focus } from './types';
import { hasTextSelection, targetDomId } from './utils';

export const EnglishWordEngine = memo(function EnglishWordEngine({
  phaseId,
  structure,
  paliWords,
  activeIndices,
  hovered,
  pinned,
  setHovered,
  setPinned,
  cycle,
  ghostOpacity,
}: {
  phaseId: string;
  structure: EnglishToken;
  paliWords: PaliWord[];
  activeIndices: Record<string, number>;
  hovered: Focus | null;
  pinned: Focus | null;
  setHovered: Dispatch<SetStateAction<Focus | null>>;
  setPinned: Dispatch<SetStateAction<Focus | null>>;
  cycle: (wordId: string) => void;
  ghostOpacity: number;
}) {
  let content = structure.label ?? '';
  let isActive = false;
  let paliWordId: string | undefined;

  if (structure.linkedPaliId) {
    // Word-level linking
    paliWordId = structure.linkedPaliId;
    const paliWord = paliWords.find((p) => p.id === structure.linkedPaliId);
    if (paliWord) {
      const idx = activeIndices[`${phaseId}-${paliWord.id}`] ?? 0;
      content = paliWord.senses[idx]?.english ?? '';
      const focusedWordId = pinned?.wordId ?? hovered?.wordId;
      isActive = focusedWordId === paliWord.id;
    }
  } else if (structure.linkedSegmentId) {
    // Segment-level linking: find the parent word that contains this segment
    const parentWord = paliWords.find((word) =>
      word.segments.some((seg) => seg.id === structure.linkedSegmentId)
    );
    if (parentWord) {
      paliWordId = parentWord.id;
      const idx = activeIndices[`${phaseId}-${parentWord.id}`] ?? 0;
      const linkedSegment = parentWord.segments.find((seg) => seg.id === structure.linkedSegmentId);
      const segmentSenses = linkedSegment?.senses;

      if (segmentSenses && segmentSenses.length > 0) {
        // 1. Segment has its own senses - use them
        content = segmentSenses[idx % segmentSenses.length]?.english ?? '';
      } else {
        // 2. Fall back to word-level senses (NOT tooltip - word senses contain the translation)
        content = parentWord.senses[idx % parentWord.senses.length]?.english ?? '';
      }
      const focusedWordId = pinned?.wordId ?? hovered?.wordId;
      isActive = focusedWordId === parentWord.id;
    }
  } else {
    // Check for ripple overrides from active senses
    paliWords.forEach((word) => {
      const idx = activeIndices[`${phaseId}-${word.id}`] ?? 0;
      const t = word.senses[idx];
      if (t?.ripples && t.ripples[structure.id]) content = t.ripples[structure.id];
    });
  }

  const domTarget = targetDomId(phaseId, structure.id);

  const handleEnter = () => {
    if (!paliWordId) return;
    setHovered({ kind: 'word', wordId: paliWordId });
  };

  const handleLeave = () => {
    if (!paliWordId) return;
    setHovered(null);
  };

  const onClick = () => {
    if (!paliWordId) return; // Works for both linkedPaliId and linkedSegmentId
    if (hasTextSelection()) return;
    cycle(paliWordId);
  };

  const isGhost = Boolean(structure.isGhost);
  const ghostKind = structure.ghostKind ?? (structure.id.startsWith('ghost') ? 'required' : 'interpretive');

  return (
    <motion.div
      layout
      id={domTarget}
      data-interactive={!isGhost ? 'true' : undefined}
      onClick={onClick}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      className={`
        px-2 py-1 rounded transition-all border text-xl md:text-2xl lg:text-3xl
        ${
          isGhost
            ? 'italic font-serif cursor-help border-transparent'
            : 'font-sans cursor-pointer border-transparent'
        }
        ${
          isActive
            ? 'text-emerald-400 bg-slate-900 border-emerald-900/50'
            : isGhost
              ? 'text-slate-400'
              : 'text-slate-400 hover:text-slate-200'
        }
      `}
      style={isGhost ? { opacity: ghostOpacity } : undefined}
      title={
        paliWordId
          ? 'Click: rotate meaning'
          : isGhost
            ? 'Ghost word (English scaffolding)'
            : ''
      }
    >
      <AnimatePresence mode="popLayout">
        <motion.span
          key={content}
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -5 }}
          transition={{ duration: 0.15 }}
          className={`block whitespace-nowrap ${
            isGhost && ghostKind === 'required' ? 'border-b border-dotted border-slate-800' : ''
          }`}
        >
          {content}
        </motion.span>
      </AnimatePresence>
    </motion.div>
  );
});

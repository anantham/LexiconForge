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
    paliWordId = structure.linkedPaliId;
    const paliWord = paliWords.find((p) => p.id === structure.linkedPaliId);
    if (paliWord) {
      const idx = activeIndices[paliWord.id] ?? 0;
      content = paliWord.senses[idx]?.english ?? '';
      const focusedWordId = pinned?.wordId ?? hovered?.wordId;
      isActive = focusedWordId === paliWord.id;
    }
  } else {
    paliWords.forEach((word) => {
      const idx = activeIndices[word.id] ?? 0;
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
    if (!structure.linkedPaliId) return;
    if (hasTextSelection()) return;
    cycle(structure.linkedPaliId);
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
        structure.linkedPaliId
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

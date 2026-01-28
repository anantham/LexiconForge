import { AnimatePresence, LayoutGroup, motion } from 'framer-motion';
import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import Xarrow, { Xwrapper } from 'react-xarrows';
import type { DeepLoomPacket } from '../../types/suttaStudio';
import { EnglishWordEngine } from './EnglishWord';
import { PaliWordEngine } from './PaliWord';
import { RELATION_COLORS, RELATION_HOOK } from './palette';
import type { Focus } from './types';
import { formatDuration, segDomId, targetDomId, wordDomId } from './utils';
import { XarrowUpdater } from './XarrowUpdater';
import { StudioHeader } from './StudioHeader';
import { usePhaseNavigation } from './hooks/usePhaseNavigation';
import { useEtaCountdown } from './hooks/useEtaCountdown';

export function SuttaStudioView({
  packet,
  backToReaderUrl,
}: {
  packet: DeepLoomPacket;
  backToReaderUrl?: string | null;
}) {
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [hovered, setHovered] = useState<Focus | null>(null);
  const [hoveredRelation, setHoveredRelation] = useState<string | null>(null);
  const pinned: Focus | null = null;
  const setPinned = useCallback(() => {}, []);
  const [activeIndices, setActiveIndices] = useState<Record<string, number>>({});
  const [studyMode, setStudyMode] = useState<boolean>(
    packet.renderDefaults?.studyToggleDefault ?? true
  );
  const [layoutTick, setLayoutTick] = useState(0);

  const phases = packet.phases ?? [];
  const totalPhases =
    packet.progress?.totalPhases ?? (phases.length > 0 ? phases.length : 0);
  const readyPhases =
    packet.progress?.readyPhases ?? phases.length;
  const progressState = packet.progress?.state;
  const etaCountdownMs = useEtaCountdown(packet.progress?.etaMs, progressState === 'building');
  const etaLabel = formatDuration(etaCountdownMs);
  const etaOverdue = etaCountdownMs != null && etaCountdownMs < 0;
  const readyPhaseCount = Math.max(0, Math.min(readyPhases, totalPhases || 0));
  const visiblePhases = phases.slice(0, Math.max(readyPhases, 0));
  const currentPhase = visiblePhases[phaseIndex];
  const focus = hovered;
  const focusWordId = focus?.kind === 'word' ? focus.wordId : focus?.wordId ?? null;

  const showRelationArrows = studyMode;
  const showAlignmentArrows = true;
  const ghostOpacity = packet.renderDefaults?.ghostOpacity ?? 0.3;
  const englishVisible = packet.renderDefaults?.englishVisible ?? true;
  const showProgressChip = totalPhases > 0 && readyPhases < totalPhases;
  const progressLabel =
    totalPhases > 0
      ? `Phase ${readyPhaseCount}/${totalPhases}${etaLabel ? ` · ${etaLabel}` : ''}`
      : '';

  const goNext = useCallback(() => {
    setPhaseIndex((i) =>
      Math.min(visiblePhases.length > 0 ? visiblePhases.length - 1 : 0, i + 1)
    );
  }, [visiblePhases.length]);

  const goPrev = useCallback(() => {
    setPhaseIndex((i) => Math.max(0, i - 1));
  }, []);

  useEffect(() => {
    setHovered(null);
    setHoveredRelation(null);
  }, [phaseIndex]);

  useEffect(() => {
    if (visiblePhases.length === 0) return;
    if (phaseIndex > visiblePhases.length - 1) {
      setPhaseIndex(visiblePhases.length - 1);
    }
  }, [phaseIndex, visiblePhases.length]);

  useLayoutEffect(() => {
    setLayoutTick((tick) => tick + 1);
  }, [phaseIndex, studyMode, visiblePhases.length]);

  const cycle = useCallback(
    (wordId: string) => {
      const word = currentPhase?.paliWords.find((w) => w.id === wordId);
      if (!word) return;
      setActiveIndices((prev) => {
        const current = prev[wordId] ?? 0;
        const next = (current + 1) % word.senses.length;
        return { ...prev, [wordId]: next };
      });
    },
    [currentPhase]
  );

  const setActiveIndex = useCallback((wordId: string, idx: number) => {
    setActiveIndices((prev) => ({ ...prev, [wordId]: idx }));
  }, []);

  const { onPointerDown, onPointerUp } = usePhaseNavigation({
    onNext: goNext,
    onPrev: goPrev,
    onEscape: () => {},
    disabled: false,
  });

  const toggleStudy = () => setStudyMode((v) => !v);

  const phaseId = currentPhase?.id ?? 'phase-1';

  const isTargetAbove = (startId: string, endId: string) => {
    if (!layoutTick || typeof window === 'undefined') return false;
    const startEl = document.getElementById(startId);
    const endEl = document.getElementById(endId);
    if (!startEl || !endEl) return false;
    const startRect = startEl.getBoundingClientRect();
    const endRect = endEl.getBoundingClientRect();
    const startCenter = startRect.top + startRect.height / 2;
    const endCenter = endRect.top + endRect.height / 2;
    return endCenter < startCenter - 4;
  };

  if (!currentPhase) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-200 flex items-center justify-center">
        <div className="text-slate-500">No phases available for this packet.</div>
      </div>
    );
  }

  const resolveBlocks = (phase: typeof currentPhase) => {
    const wordIds = phase.paliWords.map((w) => w.id);
    if (phase.layoutBlocks && phase.layoutBlocks.length > 0) {
      const normalized = phase.layoutBlocks
        .map((block) => block.filter((id) => wordIds.includes(id)))
        .filter((block) => block.length > 0);
      const covered = new Set(normalized.flat());
      const remaining = wordIds.filter((id) => !covered.has(id));
      if (remaining.length) normalized.push(remaining);
      return normalized;
    }
    if (phase.paliWords.length > 5) {
      const blocks: string[][] = [];
      for (let i = 0; i < wordIds.length; i += 5) {
        blocks.push(wordIds.slice(i, i + 5));
      }
      return blocks;
    }
    return [wordIds];
  };

  const assignEnglishBlocks = (phase: typeof currentPhase, blocks: string[][]) => {
    const blockIndex = new Map<string, number>();
    blocks.forEach((block, idx) => {
      block.forEach((id) => blockIndex.set(id, idx));
    });
    const tokens = phase.englishStructure;
    const nextLinked: Array<string | null> = new Array(tokens.length).fill(null);
    let upcoming: string | null = null;
    for (let i = tokens.length - 1; i >= 0; i--) {
      const id = tokens[i].linkedPaliId ?? null;
      if (id) upcoming = id;
      nextLinked[i] = upcoming;
    }
    const blocksOut: typeof tokens[] = blocks.map(() => []);
    let lastLinked: string | null = null;
    tokens.forEach((token, idx) => {
      const linked = token.linkedPaliId ?? null;
      if (linked) lastLinked = linked;
      const targetId = linked || lastLinked || nextLinked[idx];
      const idxBlock = targetId && blockIndex.has(targetId) ? blockIndex.get(targetId)! : 0;
      blocksOut[idxBlock].push(token);
    });
    return blocksOut;
  };

  const blocks = resolveBlocks(currentPhase);
  const englishBlocks = assignEnglishBlocks(currentPhase, blocks);

  return (
    <div
      className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 relative overflow-x-hidden overflow-y-visible"
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
    >
      <StudioHeader
        backToReaderUrl={backToReaderUrl}
        showProgress={showProgressChip}
        progressLabel={progressLabel}
        progressOverdue={etaOverdue}
        studyMode={studyMode}
        onToggleStudy={toggleStudy}
      />

      <Xwrapper>
        <XarrowUpdater
          deps={[
            phaseIndex,
            studyMode,
            hovered?.kind,
            hovered?.wordId,
            hovered?.kind === 'segment' ? hovered.segmentDomId : '',
            JSON.stringify(activeIndices),
          ]}
        />

        <AnimatePresence mode="popLayout" custom={phaseIndex}>
          <motion.div
            key={phaseIndex}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.3, ease: 'anticipate' }}
            className="flex flex-col items-center w-full max-w-5xl"
          >
            <LayoutGroup>
              {blocks.map((block, blockIndex) => {
                const blockWords = block
                  .map((id) => currentPhase.paliWords.find((w) => w.id === id))
                  .filter(Boolean) as typeof currentPhase.paliWords;
                const englishTokens = englishBlocks[blockIndex] || [];
                return (
                  <div key={`block-${blockIndex}`} className="flex flex-col items-center w-full">
                    <div className="flex flex-wrap justify-center gap-4 md:gap-8 mb-8 relative z-10 pt-10 overflow-visible">
                      {blockWords.map((word) => (
                        <div key={word.id} className="relative">
                          <PaliWordEngine
                            phaseId={phaseId}
                            wordData={word}
                            activeIndex={activeIndices[word.id] ?? 0}
                            studyMode={studyMode}
                            cycle={cycle}
                            hovered={hovered}
                            pinned={pinned}
                            setHovered={setHovered}
                            setPinned={setPinned}
                          />

                          {showRelationArrows &&
                            word.segments.map((seg, i) => {
                              const sId = segDomId(phaseId, word.id, i);
                              const focusedSegmentId =
                                (hovered?.kind === 'segment' && hovered.segmentDomId) || null;

                              if (!seg.relation) return null;
                              const isFocused = focusedSegmentId === sId;
                              const style = RELATION_COLORS[seg.relation.type];
                              const isOwnership = seg.relation.type === 'ownership';
                              const targetId = wordDomId(phaseId, seg.relation.targetId);
                              const above = isTargetAbove(sId, targetId);
                              const isArrowHovered = hoveredRelation === sId;
                              const baseArc = isOwnership
                                ? 2.4
                                : seg.relation.type === 'direction'
                                  ? 1.7
                                  : 1.5;
                              const arc = above ? baseArc + 0.4 : baseArc;
                              const extendCanvas = isOwnership ? 48 : 32;
                              const canvasStyle = { overflow: 'visible', pointerEvents: 'auto' as const };
                              const startAnchor = 'top';
                              const endAnchor = above ? 'bottom' : 'top';

                              return (
                                <Xarrow
                                  key={`arrow-${sId}`}
                                  start={sId}
                                  end={targetId}
                                  color={style.color}
                                  strokeWidth={isFocused ? 2.2 : 1.2}
                                  path="smooth"
                                  curveness={arc}
                                  _extendSVGcanvas={extendCanvas}
                                  SVGcanvasStyle={canvasStyle}
                                  passProps={{
                                    pointerEvents: 'stroke',
                                    onMouseEnter: () => setHoveredRelation(sId),
                                    onMouseLeave: () =>
                                      setHoveredRelation((current) => (current === sId ? null : current)),
                                  }}
                                  dashness={isFocused ? false : { strokeLen: 4, nonStrokeLen: 6 }}
                                  showHead={true}
                                  startAnchor={startAnchor}
                                  endAnchor={endAnchor}
                                  zIndex={1}
                                  labels={
                                    isArrowHovered ? (
                                      <div
                                        className={`bg-slate-900 text-[10px] ${style.tailwind} px-2 py-1 border ${style.border} rounded -translate-y-4 shadow-lg pointer-events-none select-none`}
                                      >
                                        {RELATION_HOOK[seg.relation.type]}
                                      </div>
                                    ) : null
                                  }
                                />
                              );
                            })}
                        </div>
                      ))}
                    </div>

                    {englishVisible && (
                      <div className="flex flex-wrap justify-center items-center gap-x-3 gap-y-2 w-full pb-8 border-b border-slate-900/50">
                        {englishTokens.map((item, i) => (
                          <div key={`${item.id}-${blockIndex}-${i}`} className="relative">
                            <EnglishWordEngine
                              phaseId={phaseId}
                              structure={item}
                              paliWords={currentPhase.paliWords}
                              activeIndices={activeIndices}
                              hovered={hovered}
                              pinned={pinned}
                              setHovered={setHovered}
                              setPinned={setPinned}
                              cycle={cycle}
                              ghostOpacity={ghostOpacity}
                            />

                            {showAlignmentArrows && item.linkedPaliId && (() => {
                              const isFocused = focusWordId === item.linkedPaliId;
                              return (
                                <Xarrow
                                  start={wordDomId(phaseId, item.linkedPaliId)}
                                  end={targetDomId(phaseId, item.id)}
                                  color={isFocused ? '#34d399' : 'rgba(148,163,184,0.35)'}
                                  strokeWidth={isFocused ? 2 : 1}
                                  showHead={false}
                                  startAnchor="bottom"
                                  endAnchor="top"
                                  path="smooth"
                                  curveness={0.5}
                                  dashness={isFocused ? false : { strokeLen: 3, nonStrokeLen: 6 }}
                                  zIndex={0}
                                />
                              );
                            })()}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </LayoutGroup>
          </motion.div>
        </AnimatePresence>
      </Xwrapper>

      <div className="fixed bottom-10 flex items-center gap-6 z-50 select-none">
        <button
          data-interactive="true"
          onClick={goPrev}
          disabled={phaseIndex === 0}
          className="w-12 h-12 rounded-full flex items-center justify-center bg-slate-900 border border-slate-700 text-slate-200 hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all text-xl"
          title="Previous (←)"
        >
          ←
        </button>
        <div className="text-slate-500 font-mono text-sm tracking-widest">
          {phaseIndex + 1} / {visiblePhases.length}
        </div>
        <button
          data-interactive="true"
          onClick={goNext}
          disabled={phaseIndex === visiblePhases.length - 1}
          className="w-12 h-12 rounded-full flex items-center justify-center bg-slate-900 border border-slate-700 text-slate-200 hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all text-xl"
          title="Next (→)"
        >
          →
        </button>
      </div>
    </div>
  );
}

import { LayoutGroup } from 'framer-motion';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import Xarrow, { Xwrapper } from 'react-xarrows';
import type { DeepLoomPacket } from '../../types/suttaStudio';
import { EnglishWordEngine } from './EnglishWord';
import { PaliWordEngine } from './PaliWord';
import { RELATION_COLORS, RELATION_HOOK } from './palette';
import type { Focus } from './types';
import { formatDuration, segDomId, segmentIdToDomId, targetDomId, wordDomId } from './utils';
import { XarrowUpdater } from './XarrowUpdater';
import { StudioHeader } from './StudioHeader';
import { useEtaCountdown } from './hooks/useEtaCountdown';
import { SuttaStudioDebugButton } from './SuttaStudioDebugButton';
import { loadSettings, saveSettings, type StudioSettings } from './SettingsPanel';

export function SuttaStudioView({
  packet,
  backToReaderUrl,
}: {
  packet: DeepLoomPacket;
  backToReaderUrl?: string | null;
}) {
  const [hovered, setHovered] = useState<Focus | null>(null);
  const [hoveredRelation, setHoveredRelation] = useState<string | null>(null);
  const pinned: Focus | null = null;
  const setPinned = useCallback(() => {}, []);
  const [activeIndices, setActiveIndices] = useState<Record<string, number>>({});
  const [settings, setSettings] = useState<StudioSettings>(() => loadSettings());
  const [layoutTick, setLayoutTick] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

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
  const focus = hovered;
  const focusWordId = focus?.kind === 'word' ? focus.wordId : focus?.wordId ?? null;

  // Derive feature flags from settings
  const showRelationArrows = settings.grammarArrows;
  const showAlignmentArrows = settings.alignmentLines;
  const ghostOpacity = packet.renderDefaults?.ghostOpacity ?? 0.3;
  const englishVisible = packet.renderDefaults?.englishVisible ?? true;
  const showProgressChip = totalPhases > 0 && readyPhases < totalPhases;
  const progressLabel =
    totalPhases > 0
      ? `Phase ${readyPhaseCount}/${totalPhases}${etaLabel ? ` · ${etaLabel}` : ''}`
      : '';

  // Hash navigation: scroll to element on load
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (hash) {
      // Small delay to ensure DOM is ready
      requestAnimationFrame(() => {
        const el = document.getElementById(hash);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      });
    }
  }, []);

  useLayoutEffect(() => {
    setLayoutTick((tick) => tick + 1);
  }, [settings, visiblePhases.length]);

  const handleSettingsChange = useCallback((newSettings: StudioSettings) => {
    setSettings(newSettings);
    saveSettings(newSettings);
  }, []);

  // Returns position info for arrow rendering
  type ArrowGeometry = {
    verticalPos: 'above' | 'below' | 'same';
    horizontalDist: number; // pixel distance between centers
    isLeftToRight: boolean; // true if target is to the right of start
  };

  const getArrowGeometry = (startId: string, endId: string): ArrowGeometry => {
    const defaultResult: ArrowGeometry = { verticalPos: 'same', horizontalDist: 100, isLeftToRight: true };
    if (!layoutTick || typeof window === 'undefined') return defaultResult;
    const startEl = document.getElementById(startId);
    const endEl = document.getElementById(endId);
    if (!startEl || !endEl) return defaultResult;

    const startRect = startEl.getBoundingClientRect();
    const endRect = endEl.getBoundingClientRect();

    // Vertical position
    const startCenterY = startRect.top + startRect.height / 2;
    const endCenterY = endRect.top + endRect.height / 2;
    const vertThreshold = 20;
    let verticalPos: 'above' | 'below' | 'same' = 'same';
    if (endCenterY < startCenterY - vertThreshold) verticalPos = 'above';
    else if (endCenterY > startCenterY + vertThreshold) verticalPos = 'below';

    // Horizontal distance
    const startCenterX = startRect.left + startRect.width / 2;
    const endCenterX = endRect.left + endRect.width / 2;
    const horizontalDist = Math.abs(endCenterX - startCenterX);
    const isLeftToRight = endCenterX > startCenterX;

    return { verticalPos, horizontalDist, isLeftToRight };
  };

  if (visiblePhases.length === 0) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-200 flex items-center justify-center">
        <div className="text-slate-500">No phases available for this packet.</div>
      </div>
    );
  }

  // Cycle through senses for a word (searches across all phases)
  const cycle = (wordId: string, phaseId: string) => {
    const phase = visiblePhases.find((p) => p.id === phaseId);
    const word = phase?.paliWords.find((w) => w.id === wordId);
    if (!word) return;
    const key = `${phaseId}-${wordId}`;
    setActiveIndices((prev) => {
      const current = prev[key] ?? 0;
      const next = (current + 1) % word.senses.length;
      return { ...prev, [key]: next };
    });
  };

  type PhaseType = (typeof visiblePhases)[0];

  const resolveBlocks = (phase: PhaseType) => {
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

  const assignEnglishBlocks = (phase: PhaseType, blocks: string[][]) => {
    const blockIndex = new Map<string, number>();
    blocks.forEach((block, idx) => {
      block.forEach((id) => blockIndex.set(id, idx));
    });

    // Build segment-to-word lookup for segment-linked tokens
    const segmentToWord = new Map<string, string>();
    phase.paliWords.forEach((word) => {
      word.segments.forEach((seg) => {
        if (seg.id) segmentToWord.set(seg.id, word.id);
      });
    });

    // Helper to get the linked word ID (handles both linkedPaliId and linkedSegmentId)
    const getLinkedWordId = (token: (typeof phase.englishStructure)[0]): string | null => {
      if (token.linkedPaliId) return token.linkedPaliId;
      if (token.linkedSegmentId) return segmentToWord.get(token.linkedSegmentId) ?? null;
      return null;
    };

    const tokens = phase.englishStructure;
    const nextLinked: Array<string | null> = new Array(tokens.length).fill(null);
    let upcoming: string | null = null;
    for (let i = tokens.length - 1; i >= 0; i--) {
      const id = getLinkedWordId(tokens[i]);
      if (id) upcoming = id;
      nextLinked[i] = upcoming;
    }
    const blocksOut: typeof tokens[] = blocks.map(() => []);
    let lastLinked: string | null = null;
    tokens.forEach((token, idx) => {
      const linked = getLinkedWordId(token);
      if (linked) lastLinked = linked;
      const targetId = linked || lastLinked || nextLinked[idx];
      const idxBlock = targetId && blockIndex.has(targetId) ? blockIndex.get(targetId)! : 0;
      blocksOut[idxBlock].push(token);
    });
    return blocksOut;
  };

  return (
    <div
      ref={scrollContainerRef}
      className="min-h-screen bg-slate-950 text-slate-100 overflow-y-auto overflow-x-hidden"
    >
      <StudioHeader
        backToReaderUrl={backToReaderUrl}
        showProgress={showProgressChip}
        progressLabel={progressLabel}
        progressOverdue={etaOverdue}
        settings={settings}
        onSettingsChange={handleSettingsChange}
        debugButton={<SuttaStudioDebugButton packet={packet} uid={packet.source?.workId} />}
      />

      <Xwrapper>
        <XarrowUpdater
          deps={[
            settings.grammarArrows,
            settings.alignmentLines,
            hovered?.kind,
            hovered?.wordId,
            hovered?.kind === 'segment' ? hovered.segmentDomId : '',
            JSON.stringify(activeIndices),
            visiblePhases.length,
          ]}
        />

        <div className="flex flex-col items-center w-full max-w-5xl mx-auto px-4 py-8">
          <LayoutGroup>
            {visiblePhases.map((phase) => {
              const phaseId = phase.id;
              const blocks = resolveBlocks(phase);
              const englishBlocks = assignEnglishBlocks(phase, blocks);

              return (
                <section
                  key={phaseId}
                  id={phaseId}
                  className="w-full mb-12"
                >
                  {blocks.map((block, blockIdx) => {
                    const blockWords = block
                      .map((id) => phase.paliWords.find((w) => w.id === id))
                      .filter(Boolean) as typeof phase.paliWords;
                    const englishTokens = englishBlocks[blockIdx] || [];

                    return (
                      <div key={`${phaseId}-block-${blockIdx}`} className="flex flex-col items-center w-full">
                        <div className="flex flex-wrap justify-center gap-4 md:gap-8 mb-16 relative z-10 pt-10 overflow-visible">
                          {blockWords.map((word) => (
                            <div key={word.id} id={`${phaseId}-${word.id}`} className="relative">
                              <PaliWordEngine
                                phaseId={phaseId}
                                wordData={word}
                                activeIndex={activeIndices[`${phaseId}-${word.id}`] ?? 0}
                                settings={settings}
                                cycle={(wordId) => cycle(wordId, phaseId)}
                                hovered={hovered}
                                pinned={pinned}
                                setHovered={setHovered}
                                setPinned={setPinned}
                              />

                              {showRelationArrows &&
                                word.segments.map((seg, i) => {
                                  const sId = seg.id
                                    ? segmentIdToDomId(phaseId, seg.id)
                                    : segDomId(phaseId, word.id, i);
                                  const focusedSegmentId =
                                    (hovered?.kind === 'segment' && hovered.segmentDomId) || null;

                                  if (!seg.relation) return null;
                                  // Highlight arrow when hovering source segment OR any segment of target word
                                  const isFocused = focusedSegmentId === sId ||
                                    (hovered?.wordId === seg.relation.targetWordId);
                                  const style = RELATION_COLORS[seg.relation.type];
                                  const isOwnership = seg.relation.type === 'ownership';
                                  const targetDomIdStr = seg.relation.targetSegmentId
                                    ? segmentIdToDomId(phaseId, seg.relation.targetSegmentId)
                                    : seg.relation.targetWordId
                                      ? wordDomId(phaseId, seg.relation.targetWordId)
                                      : null;
                                  if (!targetDomIdStr) return null;
                                  const geom = getArrowGeometry(sId, targetDomIdStr);
                                  const isArrowHovered = hoveredRelation === sId;
                                  const extendCanvas = isOwnership ? 80 : 60;
                                  const canvasStyle = { overflow: 'visible', pointerEvents: 'none' as const };

                                  // Anchors: both top for same-row, bottom->top for target-below
                                  const startAnchor = geom.verticalPos === 'below' ? 'bottom' : 'top';
                                  const endAnchor = 'top';

                                  // Control point offsets for same-row arrows:
                                  // CP1 above (negative) = curve arcs up from start
                                  // CP2 below (positive) = curve descends into endpoint, arrowhead points DOWN
                                  const arcHeight = geom.verticalPos === 'same'
                                    ? Math.max(50, Math.min(100, geom.horizontalDist * 0.5))
                                    : 0;
                                  const cpy1Offset = -arcHeight;  // First CP above - curve goes up
                                  const cpy2Offset = arcHeight * 0.2;  // Second CP below - curve descends, arrow points down

                                  // Visual weight: prominent when focused, subtle when not
                                  const arrowOpacity = isFocused ? 0.9 : 0.4;
                                  const arrowColor = isFocused ? style.color : style.color + '99'; // Add alpha

                                  return (
                                    <Xarrow
                                      key={`arrow-${sId}`}
                                      start={sId}
                                      end={targetDomIdStr}
                                      color={arrowColor}
                                      strokeWidth={isFocused ? 2 : 1}
                                      path="smooth"
                                      curveness={0.8}
                                      _cpy1Offset={cpy1Offset}
                                      _cpy2Offset={cpy2Offset}
                                      _extendSVGcanvas={extendCanvas}
                                      SVGcanvasStyle={canvasStyle}
                                      passProps={{
                                        pointerEvents: 'stroke',
                                        opacity: arrowOpacity,
                                        onMouseEnter: () => setHoveredRelation(sId),
                                        onMouseLeave: () =>
                                          setHoveredRelation((current) => (current === sId ? null : current)),
                                      }}
                                      dashness={isFocused ? false : { strokeLen: 3, nonStrokeLen: 5 }}
                                      showHead={isFocused && geom.verticalPos !== 'same'}
                                      headSize={4}
                                      startAnchor={startAnchor}
                                      endAnchor={endAnchor}
                                      zIndex={-1}
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
                              <div key={`${item.id}-${blockIdx}-${i}`} className="relative">
                                <EnglishWordEngine
                                  phaseId={phaseId}
                                  structure={item}
                                  paliWords={phase.paliWords}
                                  activeIndices={activeIndices}
                                  hovered={hovered}
                                  pinned={pinned}
                                  setHovered={setHovered}
                                  setPinned={setPinned}
                                  cycle={(wordId) => cycle(wordId, phaseId)}
                                  ghostOpacity={ghostOpacity}
                                  showGhosts={settings.ghostWords}
                                />

                                {showAlignmentArrows && (item.linkedSegmentId || item.linkedPaliId) && (() => {
                                  const startId = item.linkedSegmentId
                                    ? segmentIdToDomId(phaseId, item.linkedSegmentId)
                                    : wordDomId(phaseId, item.linkedPaliId!);

                                  const focusedSegmentId = hovered?.kind === 'segment' ? hovered.segmentId : null;
                                  const isFocused = item.linkedSegmentId
                                    ? focusedSegmentId === item.linkedSegmentId
                                    : focusWordId === item.linkedPaliId;

                                  return (
                                    <Xarrow
                                      start={startId}
                                      end={targetDomId(phaseId, item.id)}
                                      color={isFocused ? '#34d399' : 'rgba(148,163,184,0.25)'}
                                      strokeWidth={isFocused ? 1.5 : 0.75}
                                      showHead={false}
                                      startAnchor="bottom"
                                      endAnchor="top"
                                      path="smooth"
                                      curveness={0.8}
                                      dashness={isFocused ? false : { strokeLen: 3, nonStrokeLen: 6 }}
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
                </section>
              );
            })}
          </LayoutGroup>
        </div>
      </Xwrapper>
    </div>
  );
}

import { useEffect } from 'react';
import type { Chapter } from '../../types';
import type { CanonicalSegment, DeepLoomPacket } from '../../types/suttaStudio';
import { useEtaCountdown } from './hooks/useEtaCountdown';
import { formatDuration } from './utils';
import { isSuttaFlowDebug, logSuttaFlow, warnSuttaFlow } from '../../services/suttaStudioDebug';
import { SuttaStudioDebugButton } from './SuttaStudioDebugButton';

export function SuttaStudioFallback({
  chapter,
  backToReaderUrl,
  progress,
  canonicalSegments,
}: {
  chapter: Chapter | null;
  backToReaderUrl: string;
  progress?: DeepLoomPacket['progress'] | null;
  canonicalSegments?: CanonicalSegment[] | null;
}) {
  const totalPhases = progress?.totalPhases ?? 0;
  const readyPhases = progress?.readyPhases ?? 0;
  const progressState = progress?.state;
  const currentStage = progress?.currentStage;
  const etaCountdownMs = useEtaCountdown(progress?.etaMs, progressState === 'building');
  const etaLabel = formatDuration(etaCountdownMs);
  const etaOverdue = etaCountdownMs != null && etaCountdownMs < 0;
  const readyPhaseCount = Math.max(0, Math.min(readyPhases, totalPhases || 0));

  // Show progress even when totalPhases is 0 but we're building
  const isBuilding = progressState === 'building';
  const isError = progressState === 'error';
  const errorMessage = progress?.errorMessage;
  const stageLabel = currentStage === 'fetching' ? 'Fetching...' : currentStage === 'skeleton' ? 'Analyzing structure...' : null;
  const phaseLabel = totalPhases > 0 ? `Phase ${readyPhaseCount}/${totalPhases}` : (isBuilding ? stageLabel : null);
  const progressLabel = phaseLabel ? `${phaseLabel}${etaLabel ? ` · ${etaLabel}` : ''}` : (isBuilding ? 'Starting compilation...' : null);
  const blocks: Array<{ pali: string; english: string | null }> = [];
  const CHUNK_SIZE = 8;

  if (canonicalSegments && canonicalSegments.length > 0) {
    const hasProgressCount = typeof progress?.readySegments === 'number';
    const readySegments = hasProgressCount ? Math.max(0, progress?.readySegments || 0) : canonicalSegments.length;
    const lengthToShow = Math.min(readySegments, canonicalSegments.length);
    for (let i = 0; i < lengthToShow; i++) {
      const seg = canonicalSegments[i];
      blocks.push({ pali: seg.pali, english: seg.baseEnglish ?? null });
    }
  } else if (chapter?.content) {
    const paliChunks = chapter.content.split(/\n{2,}/);
    const englishChunks = chapter.fanTranslation ? chapter.fanTranslation.split(/\n{2,}/) : [];
    const max = Math.max(paliChunks.length, englishChunks.length);
    for (let i = 0; i < max; i++) {
      blocks.push({
        pali: paliChunks[i] || '',
        english: englishChunks[i] || null,
      });
    }
  }

  const groupedBlocks: Array<Array<{ pali: string; english: string | null }>> = [];
  for (let i = 0; i < blocks.length; i += CHUNK_SIZE) {
    groupedBlocks.push(blocks.slice(i, i + CHUNK_SIZE));
  }

  const groupedCount = groupedBlocks.length;
  const canonicalCount = canonicalSegments?.length ?? 0;
  const hasCanonical = canonicalCount > 0;
  const hasChapterContent = Boolean(chapter?.content && chapter.content.length > 0);

  useEffect(() => {
    if (!isSuttaFlowDebug()) return;
    logSuttaFlow('fallback render', {
      chapterId: chapter?.id ?? null,
      hasCanonical,
      canonicalCount,
      hasChapterContent,
      readySegments: typeof progress?.readySegments === 'number' ? progress?.readySegments : null,
      progressState,
      groupedBlocks: groupedCount,
    });

    if (groupedCount === 0) {
      warnSuttaFlow('fallback empty blocks', {
        hasCanonical,
        canonicalCount,
        hasChapterContent,
        progressState,
      });
    }
  }, [
    canonicalCount,
    groupedCount,
    hasCanonical,
    hasChapterContent,
    progress?.readySegments,
    progressState,
    chapter?.id,
  ]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-start p-6">
      <a
        href={backToReaderUrl}
        className="absolute top-6 left-6 w-10 h-10 rounded-full flex items-center justify-center border border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-500 hover:bg-slate-900/60 transition"
        title="Back to Reader"
        aria-label="Back to Reader"
      >
        <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
          <path fill="currentColor" d="M14.5 6l-6 6 6 6 1.4-1.4L11.3 12l4.6-4.6L14.5 6z" />
        </svg>
      </a>

      <div className="absolute top-6 right-6 flex items-center gap-2">
        <SuttaStudioDebugButton
          packet={chapter?.suttaStudio ?? null}
          uid={chapter?.suttaStudio?.source?.workId ?? null}
        />
        {isError && (
          <div className="text-xs border border-rose-500/60 text-rose-400 rounded-full px-3 py-1 flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-rose-400" />
            Error
          </div>
        )}
        {progressLabel && !isError && (
          <>
            <div
              className={`text-xs border rounded-full px-3 py-1 flex items-center gap-2 ${
                etaOverdue ? 'text-rose-400 border-rose-500/60' : 'text-slate-400 border-slate-800'
              }`}
            >
              <span
                className={`inline-block w-2 h-2 rounded-full animate-pulse ${
                  etaOverdue ? 'bg-rose-400' : 'bg-emerald-400'
                }`}
              />
              {progressLabel}
            </div>
            {/* Only show expanded details when we have phase counts (not just stage label) */}
            {totalPhases > 0 && (phaseLabel || etaLabel) && (
              <div
                className={`hidden md:flex flex-col items-end text-[11px] border rounded-2xl px-3 py-2 bg-slate-950/70 ${
                  etaOverdue ? 'text-rose-400 border-rose-500/60' : 'text-slate-400 border-slate-800'
                }`}
              >
                {phaseLabel && <div>{phaseLabel}</div>}
                {etaLabel && <div>{etaLabel}</div>}
              </div>
            )}
          </>
        )}
      </div>

      <div className="w-full max-w-5xl mt-20 space-y-10">
        {isError && (
          <div className="rounded-lg border border-rose-500/40 bg-rose-950/30 px-4 py-3 text-rose-200">
            <div className="flex items-center gap-2 font-medium text-rose-300">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Compilation Error
            </div>
            {errorMessage && (
              <div className="mt-2 text-sm text-rose-200/80 font-mono break-all">
                {errorMessage}
              </div>
            )}
          </div>
        )}
        {groupedBlocks.length === 0 && !isBuilding && !isError && (
          <div className="text-slate-400">No content available.</div>
        )}
        {groupedBlocks.map((group, groupIndex) => (
          <div key={groupIndex} className="border-b border-slate-900 pb-8 space-y-6">
            {group.map((seg, idx) => (
              <div key={`${groupIndex}-${idx}`} className="space-y-2">
                <div className="text-2xl leading-relaxed font-serif text-slate-100 whitespace-pre-wrap">
                  {seg.pali || '…'}
                </div>
                <div className="text-lg leading-relaxed text-slate-200 whitespace-pre-wrap">
                  {seg.english || '…'}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

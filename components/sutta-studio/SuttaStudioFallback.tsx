import { useEffect } from 'react';
import type { EnhancedChapter } from '../../services/stableIdService';
import type { CanonicalSegment, DeepLoomPacket } from '../../types/suttaStudio';
import { useEtaCountdown } from './hooks/useEtaCountdown';
import { formatDuration } from './utils';
import { isSuttaFlowDebug, logSuttaFlow, warnSuttaFlow } from '../../services/suttaStudioDebug';
import { SuttaStudioDebugButton } from './SuttaStudioDebugButton';
import { makeSpaClickHandler } from '../../utils/spaNavigate';

/**
 * Normalise HTML-formatted AI translation output into plain text with
 * paragraph boundaries preserved as `\n\n`. The LexiconForge translator
 * emits HTML (<i>, <em>, <br />, <p>, footnote markers) by design — fine
 * for the chapter view which renders HTML, but the studio fallback expects
 * plain text it can split into parallel-reading blocks.
 */
function htmlTranslationToText(html: string): string {
  return html
    // Block-level tags become paragraph breaks.
    .replace(/<\/p\s*>/gi, '\n\n')
    .replace(/<p[^>]*>/gi, '')
    .replace(/<\/div\s*>/gi, '\n\n')
    .replace(/<div[^>]*>/gi, '')
    // Line breaks become single newlines.
    .replace(/<br\s*\/?>/gi, '\n')
    // Strip footnote anchor wrappers but keep their text.
    .replace(/<a[^>]*>(.*?)<\/a>/gi, '$1')
    // All remaining tags removed (italics, bold, spans, etc.).
    .replace(/<[^>]+>/g, '')
    // Decode the handful of entities the translator actually emits.
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    // Collapse 3+ blank lines to exactly one paragraph break.
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function SuttaStudioFallback({
  chapter,
  backToReaderUrl,
  progress,
  canonicalSegments,
}: {
  chapter: EnhancedChapter | null;
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
  const stageMessage = progress?.stageMessage;
  const currentPassName = progress?.currentPassName;
  const stageLabel = stageMessage ?? (currentStage === 'fetching' ? 'Fetching...' : currentStage === 'skeleton' ? 'Analyzing structure...' : null);
  const passLabel = currentPassName ? ` (${currentPassName})` : '';
  const phaseLabel = totalPhases > 0 ? `Phase ${readyPhaseCount}/${totalPhases}${passLabel}` : (isBuilding ? stageLabel : null);
  const progressLabel = phaseLabel ? `${phaseLabel}${etaLabel ? ` · ${etaLabel}` : ''}` : (isBuilding ? 'Starting compilation...' : null);
  const blocks: Array<{ pali: string; english: string | null }> = [];
  const CHUNK_SIZE = 8;

  // Pre-compute the chapter's English source string (raw text, regardless of
  // layout choice below). HTML-formatted AI translation gets normalised to
  // text + paragraph breaks before display.
  const aiTranslation = (chapter as any).translationResult?.translation as string | undefined;
  const chapterEnglishRaw =
    chapter?.fanTranslation
    || (aiTranslation ? htmlTranslationToText(aiTranslation) : '')
    || '';

  // Decide layout mode:
  //   PAIRED — when canonicalSegments are aligned 1:1 with English (Bilara
  //            from SuttaCentral). Each pair stacks vertically.
  //   COLUMNS — when raw and English come from independent sources (FoJin
  //            Chinese + 84000 English fan translation, or AI translation).
  //            Paragraph counts don't match; we render two scrollable
  //            columns side-by-side instead of forcing wrong alignment.
  const layoutMode: 'paired' | 'columns' =
    canonicalSegments && canonicalSegments.length > 0 ? 'paired' : 'columns';

  if (layoutMode === 'paired' && canonicalSegments) {
    const hasProgressCount = typeof progress?.readySegments === 'number';
    const readySegments = hasProgressCount ? Math.max(0, progress?.readySegments || 0) : canonicalSegments.length;
    const lengthToShow = Math.min(readySegments, canonicalSegments.length);
    for (let i = 0; i < lengthToShow; i++) {
      const seg = canonicalSegments[i];
      blocks.push({ pali: seg.pali, english: seg.baseEnglish ?? null });
    }
  }
  // For 'columns' mode we don't build the blocks array — the columns layout
  // renders chapter.content and chapterEnglishRaw directly as two scrollable
  // panels (see render block below).

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
        onClick={makeSpaClickHandler(backToReaderUrl)}
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

      <div className="w-full max-w-6xl mt-20 space-y-6">
        {/* Header: title + source metadata strip. The chapter view's header
            isn't visible in the studio, so source provenance (translator,
            dynasty, CBETA id, etc.) gets re-surfaced here. The FoJin adapter
            populates `blurb` with translator + dynasty; for SuttaCentral
            chapters the blurb is the SuttaPlex text. */}
        {chapter?.title && (
          <header className="space-y-1 border-b border-slate-800 pb-4">
            <h1 className="text-3xl font-serif text-slate-100">{chapter.title}</h1>
            {chapter.blurb && (
              <p className="text-sm text-slate-400 italic">{chapter.blurb}</p>
            )}
            {chapter.sourceLanguage && (
              <p className="text-xs text-slate-500">
                Source language: {chapter.sourceLanguage}
                {chapter.originalUrl && (
                  <> · <a href={chapter.originalUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">source</a></>
                )}
              </p>
            )}
          </header>
        )}

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

        {layoutMode === 'columns' ? (
          /* Two scrollable columns — used when raw and translation come from
             independent sources (FoJin Chinese + 84000 English fan, or AI
             translation). Paragraph counts don't reliably match across
             sources so we don't try to pair them; users compare visually
             by scrolling. Stacks on mobile. */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h2 className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Original</h2>
              <div className="text-2xl leading-relaxed font-serif text-slate-100 whitespace-pre-wrap">
                {chapter?.content || <span className="text-slate-500 text-base">No content available.</span>}
              </div>
            </div>
            <div className="space-y-3">
              <h2 className="text-xs uppercase tracking-wider text-slate-500 font-semibold">
                English {chapter?.fanTranslation ? '(Fan translation)' : aiTranslation ? '(AI translation)' : ''}
              </h2>
              <div className="text-lg leading-relaxed text-slate-200 whitespace-pre-wrap">
                {chapterEnglishRaw || <span className="text-slate-500 text-base">English translation not yet loaded.</span>}
              </div>
            </div>
          </div>
        ) : (
          <>
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
          </>
        )}
      </div>
    </div>
  );
}

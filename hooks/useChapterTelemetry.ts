import { useEffect, useRef } from 'react';
import { telemetryService } from '../services/telemetryService';
import { debugLog } from '../utils/debug';
import { useAppStore } from '../store';

const getTimestamp = () =>
  (typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now());

interface UseChapterTelemetryArgs {
  selection: { text: string; rect: DOMRect } | null;
  currentChapterId: string | null;
  chapters: Map<string, any>;
  chapter: any;
  translationResult: any;
  isLoading: { fetching: boolean };
  translationInProgress: boolean;
  isHydratingCurrent: boolean;
  viewMode: 'original' | 'fan' | 'english';
  feedbackCount: number;
}

export const useChapterTelemetry = ({
  selection,
  currentChapterId,
  chapters,
  chapter,
  translationResult,
  isLoading,
  translationInProgress,
  isHydratingCurrent,
  viewMode,
  feedbackCount,
}: UseChapterTelemetryArgs) => {
  const navigationStartTime = useAppStore(s => s.navigationStartTime);
  const setNavigationStartTime = useAppStore(s => s.setNavigationStartTime);
  const lastLoggedChapterRef = useRef<string | null>(null);

  useEffect(() => {
    if (selection) {
      debugLog('comparison', 'summary', '[ChapterView] Selection state updated', {
        text: selection.text.slice(0, 50) + (selection.text.length > 50 ? '...' : ''),
        textLength: selection.text.length,
        rectTop: selection.rect.top,
        rectLeft: selection.rect.left,
      });
    }
  }, [selection]);

  const mountStartRef = useRef<number>(getTimestamp());
  const initialChapterIdRef = useRef<string | null>(currentChapterId);
  const initialHasChapterRef = useRef<boolean>(currentChapterId ? chapters.has(currentChapterId) : false);

  useEffect(() => {
    const end = getTimestamp();
    telemetryService.capturePerformance('ux:component:ChapterView:mount', end - mountStartRef.current, {
      chapterId: initialChapterIdRef.current,
      hasChapter: initialHasChapterRef.current,
    });
  }, []);

  useEffect(() => {
    const activeChapterId = currentChapterId;
    if (!activeChapterId) return;
    
    // Only proceed if we have a start time to measure against
    if (navigationStartTime == null) return;

    if (isLoading.fetching || translationInProgress || isHydratingCurrent) return;
    if (!chapter) return;

    // Avoid duplicate logging for the same chapter/version state
    const versionToken = `${activeChapterId}:${Boolean(translationResult)}`;
    if (lastLoggedChapterRef.current === versionToken) return;
    
    const end = getTimestamp();
    const duration = end - navigationStartTime;
    telemetryService.capturePerformance('ux:component:ChapterView:ready', duration, {
      chapterId: activeChapterId,
      hasTranslation: Boolean(translationResult),
      viewMode,
      feedbackCount,
    });
    
    lastLoggedChapterRef.current = versionToken;
    setNavigationStartTime(null);
  }, [
    chapter,
    translationResult,
    isLoading.fetching,
    translationInProgress,
    isHydratingCurrent,
    currentChapterId,
    viewMode,
    feedbackCount,
    navigationStartTime,
    setNavigationStartTime
  ]);
};

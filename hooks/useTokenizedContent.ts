import { RefObject, useCallback } from 'react';
import type { AppSettings, DiffMarkerVisibilitySettings } from '../types';
import type { UiDiffMarker } from '../components/chapter/diffVisibility';
import { useTranslationTokens } from './useTranslationTokens';
import { useChapterDiffs } from './useChapterDiffs';
import { useInlineTranslationEditor } from './useInlineTranslationEditor';

interface UseTokenizedContentArgs {
  currentChapterId: string | null;
  chapterId: string | null;
  viewMode: 'original' | 'fan' | 'english';
  translationResult: any;
  activePromptTemplate: { id?: string; name?: string } | null;
  settings: AppSettings;
  showNotification?: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
  resolveChunkElement: (node: Node | null) => HTMLElement | null;
  editableContainerRef: RefObject<HTMLDivElement>;
  markerVisibilitySettings: DiffMarkerVisibilitySettings;
  showDiffHeatmap: boolean;
}

export const useTokenizedContent = ({
  currentChapterId,
  chapterId,
  viewMode,
  translationResult,
  activePromptTemplate,
  settings,
  showNotification,
  resolveChunkElement,
  editableContainerRef,
  markerVisibilitySettings,
  showDiffHeatmap,
}: UseTokenizedContentArgs) => {
  const { translationTokensData, translationTokensRef } = useTranslationTokens(
    viewMode,
    translationResult?.translation ?? '',
    chapterId
  );

  const { diffMarkersLoading, markersByPosition } = useChapterDiffs(
    currentChapterId,
    markerVisibilitySettings,
    showDiffHeatmap
  );

  const inlineEditor = useInlineTranslationEditor({
    currentChapterId,
    viewMode,
    translationResult,
    translationTokensRef,
    activePromptTemplate,
    settings,
    showNotification,
    resolveChunkElement,
    editableContainerRef,
  });

  const handleDiffMarkerClick = useCallback((marker: UiDiffMarker) => {
    const targetElement = document.querySelector<HTMLElement>(`[data-diff-position="${marker.position}"]`);
    targetElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  return {
    translationTokensData,
    diffMarkersLoading,
    markersByPosition,
    handleDiffMarkerClick,
    ...inlineEditor,
  };
};

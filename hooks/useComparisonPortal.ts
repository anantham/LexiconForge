import { RefObject, useCallback, useEffect, useRef, useState } from 'react';
import type { AppSettings } from '../types';
import { ComparisonService } from '../services/comparisonService';
import { debugLog } from '../utils/debug';

export type ComparisonChunk = {
  selection: string;
  fanExcerpt: string;
  fanContextBefore: string | null;
  fanContextAfter: string | null;
  rawExcerpt: string | null;
  rawContextBefore: string | null;
  rawContextAfter: string | null;
  confidence?: number;
};

interface UseComparisonPortalDeps {
  currentChapterId: string | null;
  canCompare: boolean;
  translationResult: any;
  fanTranslation?: string;
  chapterContent: string;
  settings: AppSettings;
  showNotification?: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
  resolveChunkElement: (node: Node | null) => HTMLElement | null;
  repairedTranslation: string;
  contentRef: RefObject<HTMLDivElement>;
  clearSelection: () => void;
}

export const useComparisonPortal = ({
  currentChapterId,
  canCompare,
  translationResult,
  fanTranslation,
  chapterContent,
  settings,
  showNotification,
  resolveChunkElement,
  repairedTranslation,
  contentRef,
  clearSelection,
}: UseComparisonPortalDeps) => {
  const [comparisonChunk, setComparisonChunk] = useState<ComparisonChunk | null>(null);
  const [comparisonLoading, setComparisonLoading] = useState(false);
  const [comparisonError, setComparisonError] = useState<string | null>(null);
  const [showRawComparison, setShowRawComparison] = useState(false);
  const [comparisonExpanded, setComparisonExpanded] = useState(true);
  const [comparisonPortalNode, setComparisonPortalNode] = useState<HTMLDivElement | null>(null);
  const comparisonPortalRef = useRef<HTMLDivElement | null>(null);
  const requestIdRef = useRef(0);

  const removeComparisonPortal = useCallback(() => {
    if (comparisonPortalRef.current?.parentNode) {
      comparisonPortalRef.current.parentNode.removeChild(comparisonPortalRef.current);
    }
    comparisonPortalRef.current = null;
    setComparisonPortalNode(null);
  }, []);

  const dismissComparison = useCallback(() => {
    requestIdRef.current += 1;
    setComparisonChunk(null);
    setComparisonError(null);
    setComparisonLoading(false);
    setShowRawComparison(false);
    setComparisonExpanded(true);
    removeComparisonPortal();
  }, [removeComparisonPortal]);

  useEffect(() => () => removeComparisonPortal(), [removeComparisonPortal]);

  useEffect(() => {
    if (!canCompare) {
      dismissComparison();
    }
  }, [canCompare, dismissComparison]);

  useEffect(() => {
    if (!comparisonChunk) {
      setComparisonError(null);
      setShowRawComparison(false);
      setComparisonExpanded(true);
      removeComparisonPortal();
    }
  }, [comparisonChunk, removeComparisonPortal]);

  const handleCompareRequest = useCallback(async () => {
    debugLog('comparison', 'summary', '[Comparison] Request triggered');
    if (comparisonLoading) {
      debugLog('comparison', 'summary', '[Comparison] Already loading, skipping');
      return;
    }
    if (!canCompare || !translationResult || !currentChapterId) {
      debugLog('comparison', 'summary', '[Comparison] Cannot compare - prerequisites missing', {
        canCompare,
        hasTranslationResult: !!translationResult,
        currentChapterId,
      });
      return;
    }

    const selectionRange = window.getSelection && window.getSelection();
    const selectedText = selectionRange?.toString()?.trim() ?? '';
    debugLog('comparison', 'summary', '[Comparison] Selection info', {
      hasSelection: !!selectionRange,
      isCollapsed: selectionRange?.isCollapsed,
      selectedLength: selectedText.length,
    });

    if (!selectedText) {
      showNotification?.('Select text to compare.', 'info');
      return;
    }

    const anchorElement = resolveChunkElement(selectionRange?.anchorNode ?? null);
    let insertionTarget: HTMLElement | null = null;
    if (anchorElement) {
      insertionTarget = (anchorElement.closest('[data-lf-type="text"]') as HTMLElement | null) ?? anchorElement;
    } else if (selectionRange?.anchorNode instanceof HTMLElement) {
      insertionTarget = selectionRange.anchorNode;
    }
    const parentElement = insertionTarget?.parentElement ?? contentRef.current;

    if (!parentElement) {
      showNotification?.('Unable to place comparison card in the document.', 'warning');
      return;
    }

    if (comparisonPortalRef.current && comparisonPortalRef.current.parentNode) {
      comparisonPortalRef.current.parentNode.removeChild(comparisonPortalRef.current);
    }

    const marker = document.createElement('div');
    marker.className = 'lf-comparison-card-container mt-4';
    if (insertionTarget && insertionTarget.nextSibling) {
      parentElement.insertBefore(marker, insertionTarget.nextSibling);
    } else {
      parentElement.appendChild(marker);
    }
    comparisonPortalRef.current = marker;
    setComparisonPortalNode(marker);
    setComparisonExpanded(true);
    setShowRawComparison(false);

    const fanFullText = fanTranslation ?? '';
    if (!fanFullText.trim()) {
      showNotification?.('Fan translation unavailable for this chapter.', 'info');
      return;
    }

    const requestId = ++requestIdRef.current;
    setComparisonLoading(true);
    setComparisonError(null);
    setComparisonChunk({
      selection: selectedText,
      fanExcerpt: '',
      fanContextBefore: null,
      fanContextAfter: null,
      rawExcerpt: null,
      rawContextBefore: null,
      rawContextAfter: null,
      confidence: undefined,
    });

    try {
      const response = await ComparisonService.requestFocusedComparison({
        chapterId: currentChapterId,
        selectedTranslation: selectedText,
        fullTranslation: repairedTranslation,
        fullFanTranslation: fanFullText,
        fullRawText: chapterContent,
        settings,
      });

      if (requestIdRef.current !== requestId) {
        return;
      }
      setComparisonChunk({
        selection: selectedText,
        fanExcerpt: response.fanExcerpt ?? '',
        fanContextBefore: response.fanContextBefore ?? null,
        fanContextAfter: response.fanContextAfter ?? null,
        rawExcerpt: response.rawExcerpt ?? null,
        rawContextBefore: response.rawContextBefore ?? null,
        rawContextAfter: response.rawContextAfter ?? null,
        confidence: response.confidence,
      });
      setShowRawComparison(false);
    } catch (error) {
      console.warn('[Comparison] Focused comparison failed', error);
      if (requestIdRef.current === requestId) {
        setComparisonChunk((prev) =>
          prev
            ? {
                ...prev,
                fanExcerpt: '',
                fanContextBefore: null,
                fanContextAfter: null,
                rawExcerpt: null,
                rawContextBefore: null,
                rawContextAfter: null,
              }
            : prev
        );
      }
      const message = 'Comparison failed. Check console for details.';
      if (requestIdRef.current === requestId) {
        setComparisonError(message);
        showNotification?.(message, 'error');
      }
    } finally {
      if (requestIdRef.current === requestId) {
        setComparisonLoading(false);
        clearSelection();
      }
    }
  }, [
    comparisonLoading,
    canCompare,
    translationResult,
    currentChapterId,
    fanTranslation,
    chapterContent,
    settings,
    resolveChunkElement,
    showNotification,
    repairedTranslation,
    contentRef,
    clearSelection,
  ]);

  return {
    comparisonChunk,
    comparisonLoading,
    comparisonError,
    showRawComparison,
    setShowRawComparison,
    comparisonExpanded,
    setComparisonExpanded,
    comparisonPortalNode,
    handleCompareRequest,
    dismissComparison,
  };
};

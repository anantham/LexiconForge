
import React, { useRef, useMemo, useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { FeedbackItem, Footnote, UsageMetrics } from '../types';
import Loader from './Loader';
import { useTextSelection } from '../hooks/useTextSelection';
import FeedbackPopover from './FeedbackPopover';
import FeedbackDisplay from './FeedbackDisplay';
import RefreshIcon from './icons/RefreshIcon';
import { useAppStore } from '../store';
import Illustration from './Illustration';
import AudioPlayer from './AudioPlayer';
import { TranslationPersistenceService } from '../services/translationPersistenceService';
import { ComparisonService } from '../services/comparisonService';
import { debugLog } from '../utils/debug';

type TranslationToken =
  | { type: 'text'; chunkId: string; text: string }
  | { type: 'footnote'; marker: string; raw: string }
  | { type: 'illustration'; marker: string; raw: string }
  | { type: 'linebreak'; raw: string }
  | { type: 'italic' | 'bold' | 'emphasis'; children: TranslationToken[] };

interface TokenizationResult {
  tokens: TranslationToken[];
  nodes: React.ReactNode[];
}

const TOKEN_SPLIT_REGEX = /(\[\d+\]|<i>[\s\S]*?<\/i>|<b>[\s\S]*?<\/b>|\*[\s\S]*?\*|\[ILLUSTRATION-\d+\]|<br\s*\/?>)/g;
const ILLUSTRATION_RE = /^\[(ILLUSTRATION-\d+)\]$/;
const FOOTNOTE_RE = /^\[(\d+)\]$/;
const ITALIC_HTML_RE = /^<i>[\s\S]*<\/i>$/;
const BOLD_HTML_RE = /^<b>[\s\S]*<\/b>$/;
const EMPHASIS_RE = /^\*[\s\S]*\*$/;
const BR_RE = /^<br\s*\/?>$/i;

const buildTranslationTokens = (text: string, baseId: string, counter: { value: number }): TranslationToken[] => {
  if (!text) return [];
  const parts = text.split(TOKEN_SPLIT_REGEX).filter(Boolean);
  const tokens: TranslationToken[] = [];

  for (const part of parts) {
    const illustration = part.match(ILLUSTRATION_RE);
    if (illustration) {
      tokens.push({ type: 'illustration', marker: illustration[1], raw: part });
      continue;
    }

    const footnote = part.match(FOOTNOTE_RE);
    if (footnote) {
      tokens.push({ type: 'footnote', marker: footnote[1], raw: part });
      continue;
    }

    if (BR_RE.test(part)) {
      tokens.push({ type: 'linebreak', raw: part });
      continue;
    }

    if (ITALIC_HTML_RE.test(part)) {
      const inner = part.slice(3, -4);
      tokens.push({ type: 'italic', children: buildTranslationTokens(inner, baseId, counter) });
      continue;
    }

    if (BOLD_HTML_RE.test(part)) {
      const inner = part.slice(3, -4);
      tokens.push({ type: 'bold', children: buildTranslationTokens(inner, baseId, counter) });
      continue;
    }

    if (EMPHASIS_RE.test(part)) {
      const inner = part.slice(1, -1);
      tokens.push({ type: 'emphasis', children: buildTranslationTokens(inner, baseId, counter) });
      continue;
    }

    const chunkId = `${baseId}-chunk-${counter.value++}`;
    tokens.push({ type: 'text', chunkId, text: part });
  }

  return tokens;
};

const renderTranslationTokens = (tokens: TranslationToken[], keyPrefix = ''): React.ReactNode[] => {
  return tokens.map((token, index) => {
    const key = `${keyPrefix}-${index}`;
    switch (token.type) {
      case 'text':
        return (
          <span
            key={key}
            data-lf-type="text"
            data-lf-chunk={token.chunkId}
            className="inline"
          >
            {token.text}
          </span>
        );
      case 'footnote':
        return (
          <sup key={key} id={`footnote-ref-${token.marker}`} data-lf-type="footnote" className="font-sans">
            <a href={`#footnote-def-${token.marker}`} className="text-blue-500 hover:underline no-underline">[{token.marker}]</a>
          </sup>
        );
      case 'illustration':
        return <Illustration key={key} marker={token.marker} />;
      case 'linebreak':
        return <br key={key} />;
      case 'italic':
        return <i key={key}>{renderTranslationTokens(token.children, key)}</i>;
      case 'bold':
        return <b key={key}>{renderTranslationTokens(token.children, key)}</b>;
      case 'emphasis':
        return <i key={key}>{renderTranslationTokens(token.children, key)}</i>;
      default:
        return null;
    }
  });
};

const tokenizeTranslation = (text: string, baseId: string): TokenizationResult => {
  const counter = { value: 0 };
  const tokens = buildTranslationTokens(text, baseId, counter);

  // DIAGNOSTIC: Count token types
  const footnoteTokens = tokens.filter(t => t.type === 'footnote');
  const illustrationTokens = tokens.filter(t => t.type === 'illustration');
  // console.log(`[ChapterView:tokenizeTranslation] baseId=${baseId}`, {
  //   totalTokens: tokens.length,
  //   footnoteCount: footnoteTokens.length,
  //   illustrationCount: illustrationTokens.length,
  //   footnoteMarkers: footnoteTokens.map(t => t.type === 'footnote' ? t.marker : ''),
  //   illustrationMarkers: illustrationTokens.map(t => t.type === 'illustration' ? t.marker : ''),
  //   textSample: text.slice(0, 200)
  // });

  const nodes = renderTranslationTokens(tokens);
  return { tokens, nodes };
};

const cloneTokens = (tokens: TranslationToken[]): TranslationToken[] =>
  tokens.map((token) => {
    if (token.type === 'italic' || token.type === 'bold' || token.type === 'emphasis') {
      return { ...token, children: cloneTokens(token.children) };
    }
    return { ...token };
  });

const updateTokenText = (tokens: TranslationToken[], chunkId: string, newText: string): boolean => {
  for (const token of tokens) {
    if (token.type === 'text' && token.chunkId === chunkId) {
      token.text = newText;
      return true;
    }
    if ((token.type === 'italic' || token.type === 'bold' || token.type === 'emphasis') && updateTokenText(token.children, chunkId, newText)) {
      return true;
    }
  }
  return false;
};

const findTokenText = (tokens: TranslationToken[], chunkId: string): string | null => {
  for (const token of tokens) {
    if (token.type === 'text' && token.chunkId === chunkId) {
      return token.text;
    }
    if (token.type === 'italic' || token.type === 'bold' || token.type === 'emphasis') {
      const result = findTokenText(token.children, chunkId);
      if (result !== null) return result;
    }
  }
  return null;
};

const tokensToString = (tokens: TranslationToken[]): string => {
  return tokens
    .map((token) => {
      switch (token.type) {
        case 'text':
          return token.text;
        case 'footnote':
          return `[${token.marker}]`;
        case 'illustration':
          return `[${token.marker}]`;
        case 'linebreak':
          return '<br />';
        case 'italic':
          return `<i>${tokensToString(token.children)}</i>`;
        case 'bold':
          return `<b>${tokensToString(token.children)}</b>`;
        case 'emphasis':
          return `*${tokensToString(token.children)}*`;
        default:
          return '';
      }
    })
    .join('');
};

interface InlineEditState {
  chunkId: string;
  element: HTMLElement;
  originalText: string;
  saveAsNewVersion: boolean;
}

// Touch detection hook using media queries
function useIsTouch() {
  const [isTouch, setIsTouch] = React.useState(false);
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(hover: none) and (pointer: coarse)');
    const on = (e: MediaQueryListEvent | MediaQueryList) =>
      setIsTouch('matches' in e ? e.matches : (e as MediaQueryList).matches);
    on(mq);
    mq.addEventListener?.('change', on as any);
    return () => mq.removeEventListener?.('change', on as any);
  }, []);
  return isTouch;
}

// Simple bottom sheet that never overlaps the OS selection bubble
const SelectionSheet: React.FC<{
  text: string;
  onReact: (emoji: '👍' | '❤️' | '😂' | '🎨' | '✏️' | '🔍') => void;
  onCopy: () => void;
  onClose: () => void;
  canCompare: boolean;
  isComparing: boolean;
}> = ({ onReact, onCopy, onClose, canCompare, isComparing }) => {
  // Trap contextmenu only while visible (prevents Android long-press menu)
  React.useEffect(() => {
    const block = (e: Event) => e.preventDefault();
    document.addEventListener('contextmenu', block, { passive: false });
    return () => document.removeEventListener('contextmenu', block as any);
  }, []);

  return createPortal(
    <div className="fixed inset-x-0 bottom-0 z-[70] pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto max-w-xl rounded-t-2xl bg-gray-900/95 text-white shadow-2xl p-3">
        <div className="flex items-center gap-2">
          <button className="p-3 text-xl" onClick={() => onReact('👍')}>👍</button>
          <button className="p-3 text-xl" onClick={() => onReact('❤️')}>❤️</button>
          <button className="p-3 text-xl" onClick={() => onReact('😂')}>😂</button>
          <button className="p-3 text-xl" onClick={() => onReact('🎨')}>🎨</button>
          <button className="p-3 text-xl" onClick={() => onReact('✏️')}>✏️</button>
          <button
            className={`p-3 text-xl ${canCompare && !isComparing ? '' : 'opacity-40 cursor-not-allowed'}`}
            onClick={() => {
              debugLog('comparison', 'summary', '[SelectionSheet] Compare button clicked', { canCompare, isComparing });
              if (canCompare && !isComparing) {
                debugLog('comparison', 'summary', '[SelectionSheet] Invoking compare action');
                onReact('🔍');
              }
            }}
            disabled={!canCompare || isComparing}
          >
            🔍
          </button>
          <div className="grow" />
          <button 
            className="px-3 py-2 rounded bg-white/10" 
            onClick={() => {
              navigator.vibrate?.(10);
              onCopy();
            }}
          >
            Copy
          </button>
          <button className="px-3 py-2 rounded bg-white/10" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>,
    document.body
  );
};

const ChapterView: React.FC = () => {
  const contentRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<HTMLDivElement>(null);
  const { selection, clearSelection } = useTextSelection(contentRef);
  const isTouch = useIsTouch();

  // Log selection state changes for comparison workflow
  useEffect(() => {
    if (selection) {
      debugLog('comparison', 'summary', '[ChapterView] Selection state updated', {
        text: selection.text.slice(0, 50) + (selection.text.length > 50 ? '...' : ''),
        textLength: selection.text.length,
        rectTop: selection.rect.top,
        rectLeft: selection.rect.left
      });
    }
    // Note: We don't log when selection is cleared to avoid noise
  }, [selection]);

  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState('');

  // <-- REFACTOR: Use new individual selectors
  const currentChapterId = useAppStore(s => s.currentChapterId);
  const chapters = useAppStore(s => s.chapters);
  const isLoading = useAppStore(s => s.isLoading);
  const viewMode = useAppStore(s => s.viewMode);
  const settings = useAppStore(s => s.settings);
  const activePromptTemplate = useAppStore(s => s.activePromptTemplate);
  const error = useAppStore(s => s.error);
  const handleToggleLanguage = useAppStore(s => s.setViewMode);
  const handleNavigate = useAppStore(s => s.handleNavigate);
  const addFeedback = useAppStore(s => s.addFeedback);
  const deleteFeedback = useAppStore(s => s.deleteFeedback);
  const updateFeedbackComment = useAppStore(s => s.updateFeedbackComment);
  const handleRetranslateCurrent = useAppStore(s => s.handleRetranslateCurrent);
  const cancelTranslation = useAppStore(s => s.cancelTranslation);
  const isTranslationActive = useAppStore(s => s.isTranslationActive);
  const shouldEnableRetranslation = useAppStore(s => s.shouldEnableRetranslation);
  const imageGenerationMetrics = useAppStore(s => s.imageGenerationMetrics);
  const hydratingMap = useAppStore(s => s.hydratingChapters);
  const chapterAudioMap = useAppStore(s => s.chapterAudioMap);
  const showNotification = useAppStore(s => s.showNotification);

  const editableContainerRef = useRef<HTMLDivElement>(null);
  const [inlineEditState, setInlineEditState] = useState<InlineEditState | null>(null);
  const [toolbarCoords, setToolbarCoords] = useState<{ top: number; left: number } | null>(null);
  const [comparisonChunk, setComparisonChunk] = useState<{
    selection: string;
    fanExcerpt: string;
    fanContextBefore: string | null;
    fanContextAfter: string | null;
    rawExcerpt: string | null;
    rawContextBefore: string | null;
    rawContextAfter: string | null;
    confidence?: number;
  } | null>(null);
  const [comparisonLoading, setComparisonLoading] = useState(false);
  const [comparisonError, setComparisonError] = useState<string | null>(null);
  const [showRawComparison, setShowRawComparison] = useState(false);
  const [comparisonExpanded, setComparisonExpanded] = useState(true);
  const [comparisonPortalNode, setComparisonPortalNode] = useState<HTMLDivElement | null>(null);
  const comparisonPortalRef = useRef<HTMLDivElement | null>(null);

  const removeComparisonPortal = useCallback(() => {
    if (comparisonPortalRef.current?.parentNode) {
      comparisonPortalRef.current.parentNode.removeChild(comparisonPortalRef.current);
    }
    comparisonPortalRef.current = null;
    setComparisonPortalNode(null);
  }, []);

  const chapter = currentChapterId ? chapters.get(currentChapterId) : null;
  const translationResult = chapter?.translationResult;
  const feedbackForChapter = chapter?.feedback ?? [];
  const fanTranslation = (chapter as any)?.fanTranslation as string | undefined;
  const canCompare = viewMode === 'english' && !!fanTranslation;

  // DIAGNOSTIC: Log chapter data when it changes
  useEffect(() => {
    if (chapter && translationResult) {
      debugLog('translation', 'full', '[ChapterView] Chapter Data Update', {
        chapterId: chapter.id,
        chapterTitle: chapter.title,
        hasTranslation: !!translationResult,
        translationLength: translationResult.translation?.length || 0,
        footnotes: translationResult.footnotes?.length || 0,
        footnotesData: translationResult.footnotes,
        suggestedIllustrations: translationResult.suggestedIllustrations?.length || 0,
        illustrationsData: translationResult.suggestedIllustrations,
        viewMode
      });
    }
  }, [chapter?.id, translationResult, viewMode]);

  const translationTokensData = useMemo(() => {
    if (viewMode !== 'english') {
      return { tokens: [] as TranslationToken[], nodes: [] as React.ReactNode[] };
    }
    return tokenizeTranslation(translationResult?.translation ?? '', chapter?.id ?? 'chapter');
  }, [viewMode, translationResult?.translation, chapter?.id]);

  const translationTokensRef = useRef<TranslationToken[]>(translationTokensData.tokens);

  useEffect(() => {
    translationTokensRef.current = translationTokensData.tokens;
  }, [translationTokensData.tokens]);

  useEffect(() => {
    if (!canCompare) {
      setComparisonChunk(null);
      setComparisonError(null);
      setComparisonLoading(false);
      setShowRawComparison(false);
      setComparisonExpanded(true);
      removeComparisonPortal();
    }
  }, [canCompare, removeComparisonPortal]);

  useEffect(() => {
    if (!comparisonChunk) {
      setComparisonError(null);
      setShowRawComparison(false);
      setComparisonExpanded(true);
      removeComparisonPortal();
    }
  }, [comparisonChunk, removeComparisonPortal]);

  useEffect(() => () => {
    removeComparisonPortal();
  }, [removeComparisonPortal]);

  // Debug logging for chapter loading
  React.useEffect(() => {
    const fanTranslation = (chapter as any)?.fanTranslation;
    const hasFanTranslation = !!fanTranslation;
    
    // Debug logging muted to reduce console noise during normal development.
    // To enable detailed logs, uncomment the block below.
    /*
    console.log('[ChapterView] State update:', {
      currentChapterId,
      hasChapter: !!chapter,
      chaptersMapSize: chapters.size,
      chapterTitle: chapter?.title,
      chapterContent: chapter?.content ? `${chapter.content.length} chars` : 'no content',
      hasTranslation: !!translationResult,
      hasFanTranslation,
      fanTranslationLength: fanTranslation ? `${fanTranslation.length} chars` : 'none',
      isLoading: isLoading,
      viewMode,
      error,
      // Content lengths by mode
      contentLengths: {
        original: chapter?.content?.length || 0,
        fan: fanTranslation?.length || 0,
        english: translationResult?.translation?.length || 0
      }
    });
    */
    
    // Log fan translation status specifically
    if (chapter) {
      if (hasFanTranslation) {
        // Fan translation exists; keep quiet unless debugging is required.
        // console.log(`[ChapterView] ✅ Fan translation found: ${fanTranslation.length} characters`);
      } else {
        // console.log(`[ChapterView] ❌ No fan translation for chapter: ${chapter.title}`);
      }
    }
    
    if (currentChapterId && !chapter) {
      // Lightweight UI guard: suppress noisy error while chapter is being hydrated from cache.
      // The `hydratingChapters` map is set by IDB loader to indicate in-flight hydration.
      const isHydrating = !!hydratingMap?.[currentChapterId];
      if (isHydrating) {
        // Keep a low-verbosity debug entry so we can enable it during deeper diagnostics.
        // console.debug('[ChapterView] Waiting for chapter hydration:', { currentChapterId });
      } else {
        console.error('[ChapterView] Chapter ID exists but chapter not found in map:', {
          currentChapterId,
          availableChapterIds: Array.from(chapters.keys()).slice(0, 10) // First 10 IDs
        });
      }
    }
  }, [currentChapterId, chapter, chapters, translationResult, isLoading, viewMode, error]);

  const resolveChunkElement = useCallback((node: Node | null): HTMLElement | null => {
    if (!node) return null;
    if (node instanceof HTMLElement && node.dataset.lfChunk) return node;
    const baseElement = node instanceof HTMLElement ? node : (node as Text | null)?.parentElement;
    if (!baseElement) return null;
    const element = baseElement.closest('[data-lf-chunk]');
    return element as HTMLElement | null;
  }, []);

  const cleanupInlineEdit = useCallback((restoreOriginal = false) => {
    debugLog('translation', 'summary', '[InlineEdit] Cleanup called', { restoreOriginal });
    setInlineEditState((current) => {
      if (current) {
        debugLog('translation', 'summary', '[InlineEdit] Restoring previous element state');
        if (restoreOriginal) {
          debugLog('translation', 'summary', '[InlineEdit] Restoring original text');
          current.element.textContent = current.originalText;
        }
        current.element.removeAttribute('contentEditable');
        current.element.classList.remove('outline', 'outline-2', 'outline-blue-500', 'rounded-sm', 'bg-blue-100', 'dark:bg-blue-900/40');
      }
      return null;
    });
    setToolbarCoords(null);
    clearSelection();
  }, [clearSelection]);

  useEffect(() => () => cleanupInlineEdit(), [cleanupInlineEdit]);

  const updateToolbarCoords = useCallback(() => {
    if (!inlineEditState || !editableContainerRef.current) {
      setToolbarCoords(null);
      return;
    }
    const rect = inlineEditState.element.getBoundingClientRect();
    const parentRect = editableContainerRef.current.getBoundingClientRect();
    setToolbarCoords({
      top: rect.bottom - parentRect.top + 8,
      left: rect.left - parentRect.left + rect.width / 2,
    });
  }, [inlineEditState]);

  useEffect(() => {
    updateToolbarCoords();
  }, [inlineEditState, updateToolbarCoords]);

  useEffect(() => {
    if (!inlineEditState) return;
    const handler = () => updateToolbarCoords();
    window.addEventListener('resize', handler);
    window.addEventListener('scroll', handler, true);
    return () => {
      window.removeEventListener('resize', handler);
      window.removeEventListener('scroll', handler, true);
    };
  }, [inlineEditState, updateToolbarCoords]);

  const beginInlineEdit = useCallback(() => {
    debugLog('translation', 'summary', '[InlineEdit] Attempting to start inline edit');
    if (viewMode !== 'english' || !translationResult || !currentChapterId) return;
    const selectionRange = window.getSelection && window.getSelection();
    debugLog('translation', 'summary', '[InlineEdit] Selection object', selectionRange);
    if (!selectionRange || selectionRange.rangeCount === 0 || selectionRange.isCollapsed) {
      debugLog('translation', 'summary', '[InlineEdit] Selection missing or collapsed');
      showNotification?.('Select text within the translation to edit.', 'info');
      return;
    }

    const anchorEl = resolveChunkElement(selectionRange.anchorNode);
    const focusEl = resolveChunkElement(selectionRange.focusNode);

    debugLog('translation', 'summary', '[InlineEdit] Anchor element', anchorEl);
    debugLog('translation', 'summary', '[InlineEdit] Focus element', focusEl);

    if (!anchorEl || !focusEl || anchorEl !== focusEl) {
      debugLog('translation', 'summary', '[InlineEdit] Anchor and focus do not match or element not found');
      showNotification?.('Inline edits must stay within a single paragraph for now.', 'warning');
      return;
    }

    if (anchorEl.dataset.lfType !== 'text') {
      debugLog('translation', 'summary', '[InlineEdit] Selected element type is not editable text', anchorEl.dataset.lfType);
      showNotification?.('Footnotes and metadata are edited elsewhere.', 'warning');
      return;
    }

    const chunkId = anchorEl.dataset.lfChunk;
    debugLog('translation', 'summary', '[InlineEdit] Resolved chunk ID', chunkId);
    if (!chunkId) {
      showNotification?.('Unable to edit this selection. Please try a different section.', 'error');
      return;
    }

    const existingText = findTokenText(translationTokensRef.current, chunkId);
    debugLog('translation', 'summary', '[InlineEdit] Existing chunk text', existingText);
    if (existingText === null) {
      showNotification?.('Unable to map selection to translation chunk.', 'error');
      return;
    }

    cleanupInlineEdit();

    debugLog('translation', 'summary', '[InlineEdit] Applying contentEditable to element');
    anchorEl.setAttribute('contentEditable', 'true');
    anchorEl.classList.add('outline', 'outline-2', 'outline-blue-500', 'rounded-sm', 'bg-blue-100', 'dark:bg-blue-900/40');
    const range = document.createRange();
    range.selectNodeContents(anchorEl);
    const selection = window.getSelection();
    if (selection) {
      selection.removeAllRanges();
      selection.addRange(range);
    }
    anchorEl.focus();

    debugLog('translation', 'summary', '[InlineEdit] Inline edit state initialized');

    setInlineEditState({
      chunkId,
      element: anchorEl,
      originalText: existingText,
      saveAsNewVersion: false,
    });
    clearSelection();
  }, [viewMode, translationResult, currentChapterId, resolveChunkElement, cleanupInlineEdit, clearSelection, translationTokensRef, showNotification]);

  const toggleInlineNewVersion = useCallback(() => {
    setInlineEditState((current) => {
      if (!current) return current;
      return { ...current, saveAsNewVersion: !current.saveAsNewVersion };
    });
  }, []);

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
        currentChapterId
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
      insertionTarget = anchorElement.closest('[data-lf-type="text"]') as HTMLElement | null ?? anchorElement;
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
        fullTranslation: translationResult.translation ?? '',
        fullFanTranslation: fanFullText,
        fullRawText: chapter?.content ?? '',
        settings,
      });

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
      const message = 'Comparison failed. Check console for details.';
      setComparisonError(message);
      showNotification?.(message, 'error');
    } finally {
      setComparisonLoading(false);
    }
    clearSelection();
  }, [
    comparisonLoading,
    canCompare,
    translationResult?.translation,
    currentChapterId,
    fanTranslation,
    chapter?.content,
    settings,
    resolveChunkElement,
    showNotification,
    selection,
    clearSelection,
  ]);

  const saveInlineEdit = useCallback(async () => {
    debugLog('translation', 'summary', '[InlineEdit] Save triggered');
    if (!inlineEditState || !translationResult || !currentChapterId) {
      debugLog('translation', 'summary', '[InlineEdit] Missing state for save, cleaning up');
      cleanupInlineEdit();
      return;
    }

    const updatedText = inlineEditState.element.innerText;
    debugLog('translation', 'summary', '[InlineEdit] Updated text', updatedText);
    if (updatedText === inlineEditState.originalText) {
      debugLog('translation', 'summary', '[InlineEdit] Text unchanged, cleaning up');
      cleanupInlineEdit();
      return;
    }

    const tokens = cloneTokens(translationTokensRef.current);
    debugLog('translation', 'summary', '[InlineEdit] Cloned tokens count', tokens.length);
    if (!updateTokenText(tokens, inlineEditState.chunkId, updatedText)) {
      showNotification?.('Failed to apply edit to selection.', 'error');
      cleanupInlineEdit(true);
      return;
    }

    const updatedTranslation = tokensToString(tokens);
    const baseResult = {
      ...translationResult,
      translation: updatedTranslation,
    };

    const snapshot = {
      provider: settings.provider,
      model: settings.model,
      temperature: settings.temperature,
      systemPrompt: settings.systemPrompt,
      promptId: activePromptTemplate?.id,
      promptName: activePromptTemplate?.name,
    };

    try {
      if (inlineEditState.saveAsNewVersion) {
        debugLog('translation', 'summary', '[InlineEdit] Saving as new version');
        const rawLabel = window.prompt('Enter a name to append to this version (optional):');
        if (rawLabel === null) {
          debugLog('translation', 'summary', '[InlineEdit] New version prompt cancelled');
          return;
        }
        const versionLabel = rawLabel.trim() || undefined;
        const stored = await TranslationPersistenceService.createNewVersion(
          currentChapterId,
          { ...baseResult, customVersionLabel: versionLabel },
          snapshot,
          { versionLabel }
        );
        if (stored) {
          debugLog('translation', 'summary', '[InlineEdit] New version stored', { id: stored.id, version: stored.version });
          const appState = useAppStore.getState();
          appState.updateChapter(currentChapterId, {
            translationResult: stored as any,
            translationSettingsSnapshot: snapshot,
          });
        }
      } else {
        debugLog('translation', 'summary', '[InlineEdit] Persisting update in place');
        const stored = await TranslationPersistenceService.persistUpdatedTranslation(
          currentChapterId,
          baseResult as any,
          snapshot
        );
        if (stored) {
          debugLog('translation', 'summary', '[InlineEdit] Update persisted', stored.id);
          const appState = useAppStore.getState();
          appState.updateChapter(currentChapterId, {
            translationResult: stored as any,
            translationSettingsSnapshot: snapshot,
          });
        }
      }
      cleanupInlineEdit();
    } catch (error) {
      console.warn('[ChapterView] Failed to persist inline edit:', error);
      showNotification?.('Failed to save edit. Please try again.', 'error');
    }
  }, [inlineEditState, translationResult, currentChapterId, cleanupInlineEdit, translationTokensRef, settings, activePromptTemplate, showNotification]);

  const cancelInlineEdit = useCallback(() => {
    cleanupInlineEdit(true);
  }, [cleanupInlineEdit]);

  const handleFeedbackSubmit = (feedback: Omit<FeedbackItem, 'id'>) => {
    if (!currentChapterId) return;
    if (feedback.type === '🎨') {
      // Call a new handler for illustration requests
      handleIllustrationRequest(feedback.selection);
    } else {
      addFeedback(currentChapterId, feedback);
    }
    clearSelection();
  };

  const handleIllustrationRequest = (selection: string) => {
    if (!currentChapterId) return;
    // This will be a new action in the store
    useAppStore.getState().generateIllustrationForSelection(currentChapterId, selection);
  };

  const handleScrollToText = (selectedText: string) => {
    if (!contentRef.current) return;
    const walker = document.createTreeWalker(contentRef.current, NodeFilter.SHOW_TEXT, null);
    let node;
    while (node = walker.nextNode()) {
      const textContent = node.textContent || '';
      const index = textContent.indexOf(selectedText);
      if (index !== -1) {
        const parentElement = node.parentElement;
        if (parentElement) {
          parentElement.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
          const range = document.createRange();
          range.setStart(node, index);
          range.setEnd(node, index + selectedText.length);
          const selection = window.getSelection();
          selection?.removeAllRanges();
          selection?.addRange(range);
          setTimeout(() => selection?.removeAllRanges(), 2000);
          break;
        }
      }
    }
  };

  const displayTitle = useMemo(() => {
    if (viewMode === 'english' && translationResult?.translatedTitle) {
      return translationResult.translatedTitle;
    }
    return chapter?.title ?? '';
  }, [viewMode, chapter, translationResult]);

  const contentToDisplay = useMemo(() => {
    switch (viewMode) {
      case 'english':
        return translationResult?.translation ?? '';
      case 'fan':
        return (chapter as any)?.fanTranslation ?? '';
      case 'original':
      default:
        return chapter?.content ?? '';
    }
  }, [viewMode, chapter, translationResult]);

  

  const hasFanTranslation = useMemo(() => {
    return !!(chapter as any)?.fanTranslation;
  }, [chapter]);

  const renderFootnotes = (footnotes: Footnote[] | undefined) => {
    // DIAGNOSTIC: Log footnotes rendering
    // console.log('[ChapterView:renderFootnotes]', {
    //   hasFootnotes: !!footnotes,
    //   footnoteCount: footnotes?.length || 0,
    //   footnotes: footnotes
    // });

    if (!footnotes || footnotes.length === 0) return null;
    return (
      <div className="mt-12 pt-6 border-t border-gray-300 dark:border-gray-600">
        <h3 className="text-lg font-bold mb-4 font-sans">Notes</h3>
        <ol className="list-decimal list-inside space-y-2 text-sm">
          {footnotes.map((note) => {
            const raw = String(note.marker ?? '');
            const normalizedMarker = raw.replace(/^\[|\]$/g, '');
            const baseId = `${chapter?.id ?? 'chapter'}-footnote-${normalizedMarker}`;
            const rendered = tokenizeTranslation(note.text || '', baseId);
            return (
              <li key={raw} id={`footnote-def-${normalizedMarker}`} className="text-gray-600 dark:text-gray-400">
                {rendered.nodes.map((node, idx) => {
                  if (React.isValidElement(node)) {
                    const props: Record<string, any> = {
                      key: node.key ?? `${baseId}-node-${idx}`,
                    };
                    if (node.props['data-lf-chunk']) props['data-lf-chunk'] = undefined;
                    if (node.props['data-lf-type'] === 'text') props['data-lf-type'] = 'static';
                    return React.cloneElement(node, props);
                  }
                  return node;
                })}{' '}
                <a href={`#footnote-ref-${normalizedMarker}`} className="text-blue-500 hover:underline">↑</a>
              </li>
            );
          })}
        </ol>
      </div>
    );
  };

  const renderContent = () => {
    if (isLoading.fetching) {
      return <Loader text="Fetching chapter raws..." />;
    }
    if (!chapter) {
      return (
        <div className="text-center py-10 text-gray-500 dark:text-gray-400">
          <h2 className="text-2xl font-bold mb-2">Welcome!</h2>
          <p>Enter a web novel chapter URL above to get started.</p>
        </div>
      );
    }

    const currentChapterTranslating = currentChapterId ? isTranslationActive(currentChapterId) : false;
    const isHydrating = currentChapterId ? !!hydratingMap[currentChapterId] : false;
    
    if (viewMode === 'english' && currentChapterTranslating && !translationResult) {
      return <Loader text={`Translating with ${settings.provider}${settings.model ? ' — ' + settings.model : ''}...`} />;
    }

    if (viewMode === 'english' && !translationResult && !error) {
      return <Loader text={`Translating with ${settings.provider}${settings.model ? ' — ' + settings.model : ''}...`} />;
    }

    // Only show cache hydration spinner when not actively translating
    if (isHydrating && !currentChapterTranslating) {
      return <Loader text="Loading chapter from cache..." />;
    }
    
    return (
      <div className="relative" ref={editableContainerRef}>
        {isEditing ? (
          <textarea
            value={editedContent}
            onChange={(e) => setEditedContent(e.target.value)}
            className={`w-full min-h-[400px] p-4 border border-blue-300 dark:border-blue-600 rounded-lg bg-blue-50 dark:bg-blue-900/20 resize-y focus:outline-none focus:ring-2 focus:ring-blue-500 ${settings.fontStyle === 'serif' ? 'font-serif' : 'font-sans'}`}
            style={{ fontSize: `${settings.fontSize}px`, lineHeight: settings.lineHeight }}
            placeholder="Edit the translation..."
            autoFocus
          />
        ) : (
          <div
            ref={contentRef}
            className={`prose prose-lg dark:prose-invert max-w-none whitespace-pre-wrap ${settings.fontStyle === 'serif' ? 'font-serif' : 'font-sans'}`}
            style={{ fontSize: `${settings.fontSize}px`, lineHeight: settings.lineHeight }}
          >
            {viewMode === 'english' ? translationTokensData.nodes : contentToDisplay}
          </div>
        )}

        {inlineEditState && toolbarCoords && (
          <div
            className="absolute z-50 flex items-center gap-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg px-3 py-2 text-xs -translate-x-1/2"
            style={{ top: toolbarCoords.top, left: toolbarCoords.left }}
          >
            <button
              onClick={saveInlineEdit}
              className="px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
            >
              Save
            </button>
            <button
              onClick={cancelInlineEdit}
              className="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition"
            >
              Cancel
            </button>
            <label className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-300">
              <input
                type="checkbox"
                className="rounded border-gray-300 dark:border-gray-600"
                checked={inlineEditState.saveAsNewVersion}
                onChange={toggleInlineNewVersion}
              />
              New version
            </label>
          </div>
        )}
      </div>
    );
  };
  
  const shouldShowPopover = viewMode === 'english' && selection && !isTouch && !inlineEditState;
  const shouldShowSheet = viewMode === 'english' && selection && isTouch && !inlineEditState;
  // Version selector moved to SessionInfo top bar

  // Footnote navigation within the reader container
  useEffect(() => {
    const container = viewRef.current;
    if (!container) return;

    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      const anchor = target?.closest('a') as HTMLAnchorElement | null;
      const href = anchor?.getAttribute('href') || '';
      if (anchor && href.startsWith('#footnote-')) {
        e.preventDefault();
        const id = href.slice(1);
        const el = document.getElementById(id);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'nearest' });
          try { history.replaceState(null, '', `#${id}`); } catch {}
        }
      }
    };

    container.addEventListener('click', onClick);
    return () => container.removeEventListener('click', onClick);
  }, [viewRef, viewMode, currentChapterId]);

  // Handle hash navigation (e.g., when hash already set or on back navigation)
  useEffect(() => {
    const handleHash = () => {
      const hash = typeof location !== 'undefined' ? location.hash : '';
      if (hash && hash.startsWith('#footnote-')) {
        const id = hash.slice(1);
        const el = document.getElementById(id);
        el?.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'nearest' });
      }
    };
    window.addEventListener('hashchange', handleHash);
    // Run once on mount or when chapter changes
    handleHash();
    return () => window.removeEventListener('hashchange', handleHash);
  }, [currentChapterId, viewMode]);

  const NavigationControls = () => chapter && (
    <div className="flex justify-between items-center w-full">
        <button
            onClick={() => chapter.prevUrl && handleNavigate(chapter.prevUrl)}
            disabled={!chapter.prevUrl || isLoading.fetching}
            className="px-5 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 font-semibold rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            &larr; Previous
        </button>
        <button
            onClick={() => chapter.nextUrl && handleNavigate(chapter.nextUrl)}
            disabled={!chapter.nextUrl || isLoading.fetching}
            className="px-5 py-2 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 disabled:bg-blue-400 dark:disabled:bg-blue-800 disabled:cursor-not-allowed transition"
        >
            Next &rarr;
        </button>
    </div>
  );

  const MetricsDisplay = ({ metrics }: { metrics: UsageMetrics }) => {
    // Format actual parameters that were sent to API
    const formatParams = (params?: UsageMetrics['actualParams']) => {
      if (!params || Object.keys(params).length === 0) return '';
      
      const paramStrings = [];
      if (params.temperature !== undefined) paramStrings.push(`temp=${params.temperature}`);
      if (params.topP !== undefined) paramStrings.push(`top_p=${params.topP}`);
      if (params.frequencyPenalty !== undefined) paramStrings.push(`freq_pen=${params.frequencyPenalty}`);
      if (params.presencePenalty !== undefined) paramStrings.push(`pres_pen=${params.presencePenalty}`);
      if (params.seed !== undefined && params.seed !== null) paramStrings.push(`seed=${params.seed}`);
      
      return paramStrings.length > 0 ? ` [${paramStrings.join(', ')}]` : '';
    };
    
    return (
      <div className="text-xs text-center text-gray-500 dark:text-gray-400 mt-2">
        Translated in {metrics.requestTime.toFixed(2)}s with <span className="font-semibold">{metrics.model}</span>{formatParams(metrics.actualParams)} (~${metrics.estimatedCost.toFixed(5)})
      </div>
    );
  };

  const ImageMetricsDisplay = ({ metrics }: { metrics: { count: number; totalTime: number; totalCost: number; lastModel?: string } }) => (
    <div className="text-xs text-center text-gray-500 dark:text-gray-400 mt-1">
      Generated {metrics.count} images{metrics.lastModel ? ` with ${metrics.lastModel}` : ''} in {metrics.totalTime.toFixed(2)}s (~${metrics.totalCost.toFixed(5)})
    </div>
  );

  return (
    <div ref={viewRef} className="relative w-full max-w-4xl mx-auto mt-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 sm:p-8">
      {chapter && (
        <header className="mb-6 pb-4 border-b border-gray-200 dark:border-gray-700 space-y-4">
          <h1 className={`text-3xl sm:text-4xl font-bold text-gray-900 dark:text-gray-100 text-center ${settings.fontStyle === 'serif' ? 'font-serif' : 'font-sans'}`}>
            {displayTitle}
          </h1>

          {/* Desktop: Single row layout */}
          <div className="hidden md:flex justify-between items-center">
            <button
                onClick={() => chapter.prevUrl && handleNavigate(chapter.prevUrl)}
                disabled={!chapter.prevUrl || isLoading.fetching}
                className="px-5 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 font-semibold rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                &larr; Previous
            </button>
            
            <div className="flex justify-center items-center gap-4 ml-6">
              {chapter?.originalUrl && (
                <a
                  href={chapter.originalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:underline font-semibold text-sm"
                  title="View original source"
                >
                  Source
                </a>
              )}
              <div className="relative inline-flex items-center p-1 bg-gray-200 dark:bg-gray-700 rounded-full">
                <button
                  onClick={() => handleToggleLanguage('original')}
                  className={`px-4 py-1 text-sm font-semibold rounded-full transition-colors ${viewMode === 'original' ? 'bg-white dark:bg-gray-900 text-gray-800 dark:text-white shadow' : 'text-gray-600 dark:text-gray-400'}`}
                >
                  Original
                </button>
                {hasFanTranslation && (
                  <button
                    onClick={() => handleToggleLanguage('fan')}
                    className={`px-4 py-1 text-sm font-semibold rounded-full transition-colors ${viewMode === 'fan' ? 'bg-white dark:bg-gray-900 text-gray-800 dark:text-white shadow' : 'text-gray-600 dark:text-gray-400'}`}
                  >
                    Fan
                  </button>
                )}
                <button
                  onClick={() => handleToggleLanguage('english')}
                  className={`px-4 py-1 text-sm font-semibold rounded-full transition-colors ${viewMode === 'english' ? 'bg-white dark:bg-gray-900 text-gray-800 dark:text-white shadow' : 'text-gray-600 dark:text-gray-400'}`}
                >
                  {settings.targetLanguage || 'English'}
                </button>
              </div>
              {viewMode === 'english' && (
                <button
                  onClick={() => {
                    if (!currentChapterId) return;
                    console.log('🔘 [ChapterView] Retranslate button clicked (desktop), chapterId:', currentChapterId);
                    const isActive = isTranslationActive(currentChapterId);
                    console.log('🔘 [ChapterView] isTranslationActive result:', isActive);
                    if (isActive) {
                      console.log('🔴 [ChapterView] Cancelling translation');
                      cancelTranslation(currentChapterId);
                    } else {
                      console.log('🟢 [ChapterView] Starting retranslation');
                      handleRetranslateCurrent();
                    }
                  }}
                  disabled={!shouldEnableRetranslation(currentChapterId || '') && !(currentChapterId && isTranslationActive(currentChapterId))}
                  className={`p-2 rounded-full border transition-all duration-200 ml-6 ${
                    currentChapterId && isTranslationActive(currentChapterId)
                      ? 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700 hover:bg-red-100 dark:hover:bg-red-900/40'
                      : shouldEnableRetranslation(currentChapterId || '')
                      ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900/40 hover:text-blue-700 dark:hover:text-blue-300'
                      : 'opacity-50 cursor-not-allowed text-gray-400 dark:text-gray-600 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                  }`}
                  title={currentChapterId && isTranslationActive(currentChapterId) ? 'Cancel translation' : 'Retranslate chapter'}
                >
                  <RefreshIcon className={`w-5 h-5 ${currentChapterId && isTranslationActive(currentChapterId) ? 'animate-spin' : ''}`} />
                </button>
              )}
            </div>

            <div className="flex items-center justify-end">
              <button
                  onClick={() => chapter.nextUrl && handleNavigate(chapter.nextUrl)}
                  disabled={!chapter.nextUrl || isLoading.fetching}
                  className="px-5 py-2 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 disabled:bg-blue-400 dark:disabled:bg-blue-800 disabled:cursor-not-allowed transition"
                >
                  Next &rarr;
              </button>
            </div>
          </div>

          {/* Mobile: Two row layout */}
          <div className="md:hidden space-y-3">
            {/* Row 1: Prev/Next navigation */}
            <div className="flex justify-between items-center">
              <button
                  onClick={() => chapter.prevUrl && handleNavigate(chapter.prevUrl)}
                  disabled={!chapter.prevUrl || isLoading.fetching}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 font-medium rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition text-sm"
                >
                  &larr; Prev
              </button>

              <button
                  onClick={() => chapter.nextUrl && handleNavigate(chapter.nextUrl)}
                  disabled={!chapter.nextUrl || isLoading.fetching}
                  className="px-4 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 disabled:bg-blue-400 dark:disabled:bg-blue-800 disabled:cursor-not-allowed transition text-sm"
                >
                  Next &rarr;
              </button>
            </div>

            {/* Row 2: Language toggle and retranslate */}
            <div className="flex justify-center items-center gap-3">
              <div className="relative inline-flex items-center p-1 bg-gray-200 dark:bg-gray-700 rounded-full">
                <button
                  onClick={() => handleToggleLanguage('original')}
                  className={`px-3 py-1 text-xs font-semibold rounded-full transition-colors ${viewMode === 'original' ? 'bg-white dark:bg-gray-900 text-gray-800 dark:text-white shadow' : 'text-gray-600 dark:text-gray-400'}`}
                >
                  Original
                </button>
                {hasFanTranslation && (
                  <button
                    onClick={() => handleToggleLanguage('fan')}
                    className={`px-3 py-1 text-xs font-semibold rounded-full transition-colors ${viewMode === 'fan' ? 'bg-white dark:bg-gray-900 text-gray-800 dark:text-white shadow' : 'text-gray-600 dark:text-gray-400'}`}
                  >
                    Fan
                  </button>
                )}
                <button
                  onClick={() => handleToggleLanguage('english')}
                  className={`px-3 py-1 text-xs font-semibold rounded-full transition-colors ${viewMode === 'english' ? 'bg-white dark:bg-gray-900 text-gray-800 dark:text-white shadow' : 'text-gray-600 dark:text-gray-400'}`}
                >
                  {settings.targetLanguage || 'English'}
                </button>
              </div>
              
              {viewMode === 'english' && (
                <button
                  onClick={() => {
                    if (!currentChapterId) return;
                    console.log('🔘 [ChapterView] Retranslate button clicked (mobile), chapterId:', currentChapterId);
                    const isActive = isTranslationActive(currentChapterId);
                    console.log('🔘 [ChapterView] isTranslationActive result:', isActive);
                    if (isActive) {
                      console.log('🔴 [ChapterView] Cancelling translation');
                      cancelTranslation(currentChapterId);
                    } else {
                      console.log('🟢 [ChapterView] Starting retranslation');
                      handleRetranslateCurrent();
                    }
                  }}
                  disabled={!shouldEnableRetranslation(currentChapterId || '') && !(currentChapterId && isTranslationActive(currentChapterId))}
                  className={`p-2 rounded-full border transition-all duration-200 ${
                    currentChapterId && isTranslationActive(currentChapterId)
                      ? 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700 hover:bg-red-100 dark:hover:bg-red-900/40'
                      : shouldEnableRetranslation(currentChapterId || '')
                      ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900/40 hover:text-blue-700 dark:hover:text-blue-300'
                      : 'opacity-50 cursor-not-allowed text-gray-400 dark:text-gray-600 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                  }`}
                  title={currentChapterId && isTranslationActive(currentChapterId) ? 'Cancel translation' : 'Retranslate chapter'}
                >
                  <RefreshIcon className={`w-4 h-4 ${currentChapterId && isTranslationActive(currentChapterId) ? 'animate-spin' : ''}`} />
                </button>
              )}
            </div>
          </div>
          {currentChapterId && isTranslationActive(currentChapterId) && (
            <div className="text-xs text-center text-gray-500 dark:text-gray-400 mt-2">
              Translating: <span className="font-semibold">{settings.provider}</span>{settings.model ? ` — ${settings.model}` : ''}
            </div>
          )}
          {viewMode === 'english' && translationResult?.usageMetrics && !isLoading.fetching && !(currentChapterId ? isTranslationActive(currentChapterId) : false) && !(currentChapterId ? !!hydratingMap[currentChapterId] : false) && (
            <MetricsDisplay metrics={translationResult.usageMetrics} />
          )}
          {viewMode === 'english' && imageGenerationMetrics && !isLoading.fetching && !(currentChapterId ? isTranslationActive(currentChapterId) : false) && !(currentChapterId ? !!hydratingMap[currentChapterId] : false) && (
            <ImageMetricsDisplay metrics={imageGenerationMetrics} />
          )}
        </header>
      )}

      <div className="min-h-[400px]">
        {renderContent()}
        {viewMode === 'english' && renderFootnotes(translationResult?.footnotes)}
        {viewMode === 'english' && feedbackForChapter.length > 0 && (
            <div className="mt-8">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                Reader Feedback
              </h3>
              <FeedbackDisplay 
                  feedback={feedbackForChapter}
                  onDelete={(id) => deleteFeedback(id)}
                  onUpdate={(id, comment) => updateFeedbackComment(id, comment)}
                  onScrollToText={handleScrollToText}
              />
            </div>
        )}
      </div>

      {shouldShowPopover && (
        <FeedbackPopover
          selectionText={selection.text}
          position={selection.rect}
          positioningParentRef={viewRef}
          onFeedback={handleFeedbackSubmit}
          onEdit={beginInlineEdit}
          onCompare={handleCompareRequest}
          canCompare={canCompare && !comparisonLoading}
        />
      )}

      {shouldShowSheet && (
        <SelectionSheet
          text={selection.text}
          onReact={(emoji) => {
            if (emoji === '✏️') {
              beginInlineEdit();
            } else if (emoji === '🔍') {
              handleCompareRequest();
            } else {
              handleFeedbackSubmit({ type: emoji, selection: selection.text });
            }
          }}
          onCopy={async () => { 
            try { 
              await navigator.clipboard.writeText(selection.text); 
            } catch {} 
          }}
          onClose={() => clearSelection()}
          canCompare={canCompare}
          isComparing={comparisonLoading}
        />
      )}

      {viewMode === 'english' && comparisonChunk && comparisonPortalNode && createPortal(
        comparisonExpanded ? (
          <div className="mt-4 rounded-xl border border-teal-500/60 dark:border-teal-400/40 bg-teal-100/70 dark:bg-teal-900/50 shadow-lg px-4 py-3 space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="text-sm font-semibold text-teal-700 dark:text-teal-300">
                  Comparison with fan translation
                </h3>
                <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                  Selected:&nbsp;
                  <span className="font-medium text-gray-800 dark:text-gray-100">{comparisonChunk.selection}</span>
                </p>
                {typeof comparisonChunk.confidence === 'number' && !Number.isNaN(comparisonChunk.confidence) && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Confidence {(Math.max(0, Math.min(1, comparisonChunk.confidence)) * 100).toFixed(0)}%
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {comparisonChunk.rawExcerpt && (
                  <button
                    onClick={() => setShowRawComparison((prev) => !prev)}
                    className="flex items-center gap-1 text-xs px-3 py-1 rounded bg-amber-200 dark:bg-amber-900/40 text-amber-900 dark:text-amber-200 hover:bg-amber-300 dark:hover:bg-amber-900/60 transition"
                    title={showRawComparison ? 'Show fan translation' : 'Show raw text'}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      className="w-4 h-4"
                    >
                      <path d="M12 4a1 1 0 011 1v1.079A6.001 6.001 0 0118 12a1 1 0 11-2 0 4 4 0 10-4 4 1 1 0 010 2 6 6 0 01-5.917-5H4a1 1 0 110-2h2.083A6 6 0 0112 4zm7 8a1 1 0 011-1h2a1 1 0 110 2h-2a1 1 0 01-1-1zm-7 7a1 1 0 011-1h.917A6.001 6.001 0 0118 12a1 1 0 112 0 8 8 0 01-7.083 7.917V20a1 1 0 01-2 0v-1a7.963 7.963 0 01-3.535-.917A1 1 0 018.5 16.5a1 1 0 011.366.366A6 6 0 0011 19a1 1 0 011 1z" />
                    </svg>
                    <span>{showRawComparison ? 'Fan translation' : 'Raw text'}</span>
                  </button>
                )}
                <button
                  className="text-xs text-teal-600 dark:text-teal-300 hover:underline"
                  onClick={() => setComparisonExpanded(false)}
                >
                  Collapse
                </button>
                <button
                  className="text-xs text-red-500 dark:text-red-400 hover:underline"
                  onClick={() => setComparisonChunk(null)}
                >
                  Dismiss
                </button>
              </div>
            </div>
            {comparisonLoading && (
              <p className="text-xs text-gray-500 dark:text-gray-300">Loading comparison…</p>
            )}
            {comparisonError && (
              <p className="text-xs text-red-600 dark:text-red-400">{comparisonError}</p>
            )}
            {!comparisonLoading && !comparisonError && (
              <div className="space-y-3 text-sm">
                {(() => {
                  const before = showRawComparison
                    ? comparisonChunk.rawContextBefore ?? comparisonChunk.fanContextBefore
                    : comparisonChunk.fanContextBefore;
                  return before ? (
                    <p className="text-gray-600 dark:text-gray-400">{before}</p>
                  ) : null;
                })()}
                <div
                  className={`rounded-lg px-3 py-2 ${
                    showRawComparison
                      ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-900 dark:text-amber-100'
                      : 'bg-blue-100 dark:bg-blue-900/40 text-blue-900 dark:text-blue-100'
                  }`}
                >
                  {showRawComparison
                    ? comparisonChunk.rawExcerpt || 'Raw excerpt unavailable.'
                    : comparisonChunk.fanExcerpt || 'Fan excerpt unavailable.'}
                </div>
                {(() => {
                  const after = showRawComparison
                    ? comparisonChunk.rawContextAfter ?? comparisonChunk.fanContextAfter
                    : comparisonChunk.fanContextAfter;
                  return after ? (
                    <p className="text-gray-600 dark:text-gray-400">{after}</p>
                  ) : null;
                })()}
              </div>
            )}
          </div>
        ) : (
          <div className="mt-4 flex items-center gap-3 rounded-full bg-teal-100/70 dark:bg-teal-900/40 px-3 py-2">
            <button
              className="text-xs font-medium text-teal-700 dark:text-teal-200 hover:underline"
              onClick={() => setComparisonExpanded(true)}
            >
              Show fan comparison
            </button>
            <button
              className="text-xs text-gray-500 dark:text-gray-400 hover:underline"
              onClick={() => setComparisonChunk(null)}
            >
              Dismiss
            </button>
          </div>
        ),
        comparisonPortalNode
      )}

      {chapter && (
        <footer className="mt-8 pt-4 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <NavigationControls />
        </footer>
      )}
      
      {/* Audio Player Section */}
      <AudioPlayer 
        chapterId={currentChapterId || ''} 
        isVisible={!!currentChapterId && !!chapter} 
      />
    </div>
  );
};

export default ChapterView;

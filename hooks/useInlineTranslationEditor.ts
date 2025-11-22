import { MutableRefObject, RefObject, useCallback, useEffect, useRef, useState } from 'react';
import type { AppSettings } from '../types';
import { TranslationPersistenceService } from '../services/translationPersistenceService';
import { cloneTokens, updateTokenText, tokensToString, TranslationToken } from '../components/chapter/translationTokens';
import { debugLog } from '../utils/debug';
import { useAppStore } from '../store';

export interface InlineEditState {
  chunkId: string;
  element: HTMLElement;
  originalText: string;
  saveAsNewVersion: boolean;
}

interface InlineEditorDeps {
  currentChapterId: string | null;
  viewMode: string;
  translationResult: any;
  translationTokensRef: MutableRefObject<TranslationToken[]>;
  activePromptTemplate: { id?: string; name?: string } | null;
  settings: AppSettings;
  showNotification?: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
  resolveChunkElement: (node: Node | null) => HTMLElement | null;
  editableContainerRef: RefObject<HTMLDivElement>;
}

const clearWindowSelection = () => {
  const selection = window.getSelection();
  selection?.removeAllRanges();
};

export const useInlineTranslationEditor = ({
  currentChapterId,
  viewMode,
  translationResult,
  translationTokensRef,
  activePromptTemplate,
  settings,
  showNotification,
  resolveChunkElement,
  editableContainerRef,
}: InlineEditorDeps) => {
  const [inlineEditState, setInlineEditState] = useState<InlineEditState | null>(null);
  const [toolbarCoords, setToolbarCoords] = useState<{ top: number; left: number } | null>(null);

  const cleanupInlineEdit = useCallback((restoreOriginal = false) => {
    setInlineEditState((current) => {
      if (current) {
        if (restoreOriginal) {
          current.element.textContent = current.originalText;
        }
        current.element.removeAttribute('contentEditable');
        current.element.classList.remove(
          'outline',
          'outline-2',
          'outline-blue-500',
          'rounded-sm',
          'bg-blue-100',
          'dark:bg-blue-900/40'
        );
      }
      return null;
    });
    setToolbarCoords(null);
    clearWindowSelection();
  }, []);

  useEffect(() => () => cleanupInlineEdit(), [cleanupInlineEdit]);

  const beginInlineEdit = useCallback(() => {
    debugLog('translation', 'summary', '[InlineEdit] Attempting to start inline edit');
    if (viewMode !== 'english' || !translationResult || !currentChapterId) return;
    const selectionRange = window.getSelection && window.getSelection();
    if (!selectionRange || selectionRange.rangeCount === 0 || selectionRange.isCollapsed) {
      showNotification?.('Select text within the translation to edit.', 'info');
      return;
    }

    const anchorEl = resolveChunkElement(selectionRange.anchorNode);
    const focusEl = resolveChunkElement(selectionRange.focusNode);

    if (!anchorEl || !focusEl || anchorEl !== focusEl) {
      showNotification?.('Inline edits must stay within a single paragraph for now.', 'warning');
      return;
    }

    if (anchorEl.dataset.lfType !== 'text') {
      showNotification?.('Footnotes and metadata are edited elsewhere.', 'warning');
      return;
    }

    const chunkId = anchorEl.dataset.lfChunk;
    if (!chunkId) {
      showNotification?.('Unable to edit this selection. Please try a different section.', 'error');
      return;
    }

    const tokens = translationTokensRef.current;
    const token = tokens.find((t) => t.type === 'text' && (t as any).chunkId === chunkId) as any | undefined;
    const existingText = token ? token.text : null;
    if (existingText === null) {
      showNotification?.('Unable to map selection to translation chunk.', 'error');
      return;
    }

    cleanupInlineEdit();

    anchorEl.setAttribute('contentEditable', 'true');
    anchorEl.classList.add(
      'outline',
      'outline-2',
      'outline-blue-500',
      'rounded-sm',
      'bg-blue-100',
      'dark:bg-blue-900/40'
    );
    const range = document.createRange();
    range.selectNodeContents(anchorEl);
    const selection = window.getSelection();
    if (selection) {
      selection.removeAllRanges();
      selection.addRange(range);
    }
    anchorEl.focus();

    setInlineEditState({
      chunkId,
      element: anchorEl,
      originalText: existingText,
      saveAsNewVersion: false,
    });
    clearWindowSelection();
  }, [
    viewMode,
    translationResult,
    currentChapterId,
    translationTokensRef,
    resolveChunkElement,
    cleanupInlineEdit,
    showNotification,
  ]);

  const toggleInlineNewVersion = useCallback(() => {
    setInlineEditState((current) => (current ? { ...current, saveAsNewVersion: !current.saveAsNewVersion } : current));
  }, []);

  const saveInlineEdit = useCallback(async () => {
    if (!inlineEditState || !translationResult || !currentChapterId) {
      cleanupInlineEdit();
      return;
    }

    const updatedText = inlineEditState.element.innerText;
    if (updatedText === inlineEditState.originalText) {
      cleanupInlineEdit();
      return;
    }

    const tokens = cloneTokens(translationTokensRef.current);
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
        const rawLabel = window.prompt('Enter a name to append to this version (optional):');
        if (rawLabel === null) {
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
          useAppStore.getState().updateChapter(currentChapterId, {
            translationResult: stored as any,
            translationSettingsSnapshot: snapshot,
          });
        }
      } else {
        const stored = await TranslationPersistenceService.persistUpdatedTranslation(
          currentChapterId,
          baseResult as any,
          snapshot
        );
        if (stored) {
          useAppStore.getState().updateChapter(currentChapterId, {
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
  }, [
    inlineEditState,
    translationResult,
    currentChapterId,
    cleanupInlineEdit,
    translationTokensRef,
    settings,
    activePromptTemplate,
    showNotification,
  ]);

  const cancelInlineEdit = useCallback(() => {
    cleanupInlineEdit(true);
  }, [cleanupInlineEdit]);

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
  }, [inlineEditState, editableContainerRef]);

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

  return {
    inlineEditState,
    toolbarCoords,
    beginInlineEdit,
    toggleInlineNewVersion,
    saveInlineEdit,
    cancelInlineEdit,
  };
};

/**
 * SessionInfo - Main session control bar component
 *
 * This component has been decomposed into smaller, focused components:
 * - ChapterDropdown: Chapter navigation
 * - VersionSelector: Desktop version dropdown
 * - MobileVersionPicker: Mobile version modal
 * - DeleteConfirmationDialog: Delete mode selection
 * - ExportModal: JSON/EPUB export options
 * - PublishWizard: Multi-step publish flow
 *
 * This parent component orchestrates state and interactions between them.
 */

import React, { useState, useEffect, useRef } from 'react';
import { useAppStore } from '../store';
import SettingsIcon from './icons/SettingsIcon';
import { useChapterDropdownOptions } from '../hooks/useChapterDropdownOptions';
import { telemetryService } from '../services/telemetryService';
import { ChapterOps } from '../services/db/operations';

import {
  ChapterDropdown,
  VersionSelector,
  MobileVersionPicker,
  DeleteConfirmationDialog,
  ExportModal,
  PublishWizard,
  type TranslationVersion,
  type DeleteMode,
} from './session-info';

const getTimestamp = () =>
  typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();

const SessionInfo: React.FC = () => {
  // Store selectors
  const currentChapterId = useAppStore(s => s.currentChapterId);
  const chapters = useAppStore(s => s.chapters);
  const setShowSettingsModal = useAppStore(s => s.setShowSettingsModal);
  const fetchTranslationVersions = useAppStore(s => s.fetchTranslationVersions);
  const setActiveTranslationVersion = useAppStore(s => s.setActiveTranslationVersion);
  const deleteTranslationVersion = useAppStore(s => s.deleteTranslationVersion);
  const exportProgress = useAppStore(s => s.exportProgress);
  const currentChapter = useAppStore(s => s.chapters.get(s.currentChapterId || ''));
  const translationResult = currentChapter?.translationResult;

  // Chapter dropdown hook
  const { isEmpty: sessionIsEmpty } = useChapterDropdownOptions();

  // UI state
  const [showExportModal, setShowExportModal] = useState(false);
  const [showVersionPicker, setShowVersionPicker] = useState(false);
  const [versions, setVersions] = useState<TranslationVersion[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<number | ''>('');

  // Delete dialog state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteMode, setDeleteMode] = useState<DeleteMode>('translation-only');
  const [pendingDeleteTarget, setPendingDeleteTarget] = useState<TranslationVersion | null>(null);

  // Publish wizard state
  const [publishTrigger, setPublishTrigger] = useState(false);

  // Derived state
  const isExporting = exportProgress !== null && exportProgress.phase !== 'done';

  // Telemetry refs
  const mountStartRef = useRef<number>(getTimestamp());
  const initialChapterCountRef = useRef<number>(chapters.size);

  // Mount telemetry
  useEffect(() => {
    telemetryService.capturePerformance('ux:component:SessionInfo:mount', getTimestamp() - mountStartRef.current, {
      chaptersInStore: initialChapterCountRef.current,
    });
  }, []);

  // Load translation versions for current chapter
  useEffect(() => {
    let cancelled = false;
    if (!currentChapterId) {
      setVersions([]);
      setSelectedVersion('');
      telemetryService.capturePerformance('ux:component:SessionInfo:versionsLoad', 0, {
        outcome: 'no_chapter',
      });
      return () => { cancelled = true; };
    }

    const versionLoadStart = getTimestamp();
    let resolvedCount = 0;
    let outcome: 'success' | 'error' = 'success';
    let errorMessage: string | undefined;

    (async () => {
      try {
        const v = await fetchTranslationVersions(currentChapterId);
        if (cancelled) return;
        resolvedCount = Array.isArray(v) ? v.length : 0;
        setVersions(v);
        const active = v.find((x: TranslationVersion) => x.isActive);
        setSelectedVersion(active ? active.version : (v[0]?.version ?? ''));
      } catch (error) {
        outcome = 'error';
        errorMessage = error instanceof Error ? error.message : String(error);
        if (!cancelled) {
          setVersions([]);
          setSelectedVersion('');
        }
      } finally {
        if (!cancelled) {
          telemetryService.capturePerformance('ux:component:SessionInfo:versionsLoad', getTimestamp() - versionLoadStart, {
            chapterId: currentChapterId,
            versionCount: resolvedCount,
            outcome,
            error: outcome === 'error' ? errorMessage : undefined,
          });
        }
      }
    })();

    return () => { cancelled = true; };
  }, [currentChapterId, fetchTranslationVersions, translationResult]);

  // Version selection handlers
  const handleVersionSelect = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const v = parseInt(e.target.value, 10);
    setSelectedVersion(isNaN(v) ? '' : v);
    if (currentChapterId && !Number.isNaN(v)) {
      await setActiveTranslationVersion(currentChapterId, v);
    }
  };

  const handleMobileVersionSelect = async (version: number) => {
    setSelectedVersion(version);
    setShowVersionPicker(false);
    if (currentChapterId) {
      await setActiveTranslationVersion(currentChapterId, version);
    }
  };

  // Delete handlers
  const handleDeleteVersion = async (versionToDelete?: TranslationVersion) => {
    if (!currentChapterId) return;
    const target = versionToDelete || versions.find(v => v.version === selectedVersion);
    if (!target) return;

    const isLastVersion = versions.length === 1;

    if (isLastVersion) {
      setPendingDeleteTarget(target);
      setDeleteMode('translation-only');
      setShowDeleteDialog(true);
    } else {
      if (confirm(`Are you sure you want to delete version ${target.version}? This cannot be undone.`)) {
        await performDeleteTranslation(target);
      }
    }
  };

  const performDeleteTranslation = async (target: TranslationVersion) => {
    if (!currentChapterId) return;

    const refreshStart = getTimestamp();
    let resolvedCount = 0;
    try {
      await deleteTranslationVersion(currentChapterId, target.id);
      const v = await fetchTranslationVersions(currentChapterId);
      resolvedCount = Array.isArray(v) ? v.length : 0;
      setVersions(v);
      const active = v.find((x: TranslationVersion) => x.isActive);
      setSelectedVersion(active ? active.version : (v[0]?.version ?? ''));
    } finally {
      telemetryService.capturePerformance('ux:component:SessionInfo:versionsRefreshAfterDelete', getTimestamp() - refreshStart, {
        chapterId: currentChapterId,
        versionCount: resolvedCount,
      });
    }
  };

  const handleConfirmDelete = async () => {
    if (!pendingDeleteTarget || !currentChapterId) return;

    setShowDeleteDialog(false);

    if (deleteMode === 'chapter') {
      try {
        const chapter = chapters.get(currentChapterId);
        if (!chapter) return;

        await ChapterOps.deleteByUrl(chapter.originalUrl);

        const removeChapter = useAppStore.getState().removeChapter;
        if (removeChapter) {
          removeChapter(currentChapterId);
        }

        console.log(`[SessionInfo] Deleted chapter completely: ${currentChapterId}`);
      } catch (error) {
        console.error('[SessionInfo] Failed to delete chapter:', error);
        const setError = useAppStore.getState().setError;
        if (setError) {
          setError('Failed to delete chapter');
        }
      }
    } else {
      await performDeleteTranslation(pendingDeleteTarget);
    }

    setPendingDeleteTarget(null);
  };

  const handleCancelDelete = () => {
    setShowDeleteDialog(false);
    setPendingDeleteTarget(null);
  };

  return (
    <div className="w-full max-w-4xl mx-auto -mt-2 mb-6 p-3 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm rounded-b-xl shadow-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-t border-gray-200 dark:border-gray-700">
      <div className="flex-grow w-full sm:w-auto flex flex-col gap-2 min-w-0">
        {/* Chapter dropdown row */}
        <div className="flex items-center gap-2">
          <label htmlFor="chapter-select" className="font-semibold text-gray-600 dark:text-gray-300 flex-shrink-0">
            Chapter:
          </label>
          <ChapterDropdown currentChapterId={currentChapterId} />
        </div>

        {/* Version row - only show when versions exist */}
        {!sessionIsEmpty && versions.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <label className="text-sm font-semibold text-gray-600 dark:text-gray-300">Version:</label>

            {/* Desktop version selector */}
            <VersionSelector
              versions={versions}
              selectedVersion={selectedVersion}
              onVersionSelect={handleVersionSelect}
              onDeleteVersion={() => handleDeleteVersion()}
            />

            {/* Mobile version picker */}
            <MobileVersionPicker
              versions={versions}
              selectedVersion={selectedVersion}
              isOpen={showVersionPicker}
              onOpen={() => setShowVersionPicker(true)}
              onClose={() => setShowVersionPicker(false)}
              onVersionSelect={handleMobileVersionSelect}
              onDeleteVersion={handleDeleteVersion}
            />

            {/* Export button */}
            <button
              onClick={() => setShowExportModal(true)}
              disabled={sessionIsEmpty || isExporting}
              className="px-3 py-1.5 bg-green-600 text-white text-sm font-semibold rounded-md shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 dark:focus:ring-offset-gray-800 disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed transition duration-300 ease-in-out"
            >
              {isExporting ? 'Exporting...' : 'Export Book'}
            </button>
          </div>
        )}
      </div>

      {/* Settings button */}
      <div className="flex items-center gap-2 flex-shrink-0 w-full sm:w-auto justify-center sm:justify-end">
        <button
          onClick={() => setShowSettingsModal(true)}
          className="p-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 font-semibold rounded-full shadow-sm hover:bg-gray-300 dark:hover:bg-gray-600 transition"
          title="Settings"
        >
          <SettingsIcon className="w-5 h-5" />
        </button>
      </div>

      {/* Modals */}
      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        onPublishClick={() => {
          // Don't close export modal yet - wait for wizard to successfully start
          setPublishTrigger(true);
        }}
        sessionIsEmpty={sessionIsEmpty}
      />

      <DeleteConfirmationDialog
        isOpen={showDeleteDialog}
        deleteMode={deleteMode}
        onDeleteModeChange={setDeleteMode}
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
      />

      <PublishWizard
        trigger={publishTrigger}
        onStart={() => setShowExportModal(false)}
        onComplete={() => setPublishTrigger(false)}
      />
    </div>
  );
};

export default SessionInfo;

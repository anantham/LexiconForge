/**
 * PublishWizard - Multi-step wizard for publishing to library
 *
 * States: idle | confirm-action | version-form | new-book-form | writing | done
 *
 * Extracted from SessionInfo.tsx for better separation of concerns.
 */

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { ExportService } from '../../services/exportService';
import type { NovelEntry } from '../../types/novel';

type PublishStep = 'idle' | 'confirm-action' | 'version-form' | 'new-book-form' | 'writing' | 'done';

interface VersionDetails {
  versionName: string;
  translatorName: string;
  translatorLink: string;
  description: string;
  style: 'faithful' | 'liberal' | 'image-heavy' | 'other';
  completionStatus: 'In Progress' | 'Complete';
}

interface NovelDetails {
  id: string;
  title: string;
  author: string;
  originalLanguage: string;
  genres: string[];
  description: string;
}

interface PublishResult {
  success: boolean;
  filesWritten: string[];
  error?: string;
  sessionSizeBytes?: number;
}

const formatSize = (bytes?: number | null): string => {
  if (bytes == null || Number.isNaN(bytes)) return '—';
  if (bytes < 1024) return `${Math.max(bytes, 0).toFixed(0)} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(kb >= 10 ? 0 : 1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(mb >= 10 ? 1 : 2)} MB`;
  const gb = mb / 1024;
  return `${gb.toFixed(2)} GB`;
};

const initialVersionDetails: VersionDetails = {
  versionName: '',
  translatorName: '',
  translatorLink: '',
  description: '',
  style: 'faithful',
  completionStatus: 'In Progress',
};

const initialNovelDetails: NovelDetails = {
  id: '',
  title: '',
  author: '',
  originalLanguage: 'Korean',
  genres: [],
  description: '',
};

interface PublishWizardProps {
  /** Whether to trigger the publish flow */
  trigger: boolean;
  /** Called when wizard starts showing UI (directory selected successfully) */
  onStart?: () => void;
  /** Called when wizard completes or is cancelled */
  onComplete: () => void;
}

export const PublishWizard: React.FC<PublishWizardProps> = ({
  trigger,
  onStart,
  onComplete,
}) => {
  const [step, setStep] = useState<PublishStep>('idle');
  const [existingMetadata, setExistingMetadata] = useState<NovelEntry | null>(null);
  const [selectedDirHandle, setSelectedDirHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [publishResult, setPublishResult] = useState<PublishResult | null>(null);
  const [versionDetails, setVersionDetails] = useState<VersionDetails>(initialVersionDetails);
  const [novelDetails, setNovelDetails] = useState<NovelDetails>(initialNovelDetails);
  const [hasTriggered, setHasTriggered] = useState(false);

  const resetState = () => {
    setStep('idle');
    setExistingMetadata(null);
    setSelectedDirHandle(null);
    setPublishResult(null);
    setVersionDetails(initialVersionDetails);
    setNovelDetails(initialNovelDetails);
    setHasTriggered(false);
    onComplete();
  };

  // Trigger the publish flow when trigger changes to true
  React.useEffect(() => {
    if (trigger && !hasTriggered) {
      setHasTriggered(true);
      handlePublishClick();
    }
  }, [trigger, hasTriggered]);

  const handlePublishClick = async () => {
    try {
      // Check browser support for File System Access API
      if (!('showDirectoryPicker' in window)) {
        const useManualExport = confirm(
          'Direct folder access requires Chrome or Edge.\n\n' +
          'Would you like to download the files separately instead?\n\n' +
          'You can manually place them in your library folder:\n' +
          '• metadata.json - Novel info and version details\n' +
          '• session.json - Full translation data'
        );

        if (useManualExport) {
          const sessionData = await ExportService.generateQuickExport();
          const stats = await ExportService.calculateSessionStats();

          let storedMeta: any = {};
          try {
            const stored = localStorage.getItem('novelMetadata');
            if (stored) storedMeta = JSON.parse(stored);
          } catch {}

          const novelId = storedMeta.title?.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'novel';

          const metadata = {
            id: novelId,
            metadata: {
              title: storedMeta.title || 'Untitled',
              author: storedMeta.author || 'Unknown',
              originalLanguage: storedMeta.originalLanguage || 'ko',
              genres: storedMeta.genres || [],
              description: storedMeta.description || '',
              lastUpdated: new Date().toISOString().split('T')[0]
            },
            versions: [{
              versionId: 'v1',
              versionName: 'Primary Translation',
              translator: { name: 'LexiconForge' },
              lastUpdated: new Date().toISOString().split('T')[0],
              chapterRange: stats.chapterRange,
              completionStatus: 'In Progress' as const,
              style: 'faithful' as const,
              stats: {
                content: {
                  totalImages: stats.totalImages,
                  totalFootnotes: stats.totalFootnotes,
                  totalRawChapters: stats.totalRawChapters,
                  totalTranslatedChapters: stats.totalTranslatedChapters
                },
                translation: {
                  totalCost: stats.totalCost,
                  totalTokens: stats.totalTokens,
                  mostUsedModel: stats.mostUsedModel
                }
              },
              files: { session: 'session.json' }
            }]
          };

          await ExportService.downloadJSON(metadata, 'metadata.json');
          await ExportService.downloadJSON(sessionData, 'session.json');

          alert(
            'Files downloaded!\n\n' +
            'To add to your library:\n' +
            `1. Create folder: library/${novelId}/\n` +
            '2. Drag metadata.json and session.json into that folder\n' +
            '3. Commit and push to your repo'
          );
        }
        return;
      }

      // Open folder picker
      const dirHandle = await window.showDirectoryPicker({
        mode: 'readwrite',
      });
      setSelectedDirHandle(dirHandle);

      // Check if metadata.json exists
      const result = await ExportService.detectExistingNovel(dirHandle);

      // Signal that wizard is starting to show UI (directory selected successfully)
      onStart?.();

      if (result.exists && result.metadata) {
        setExistingMetadata(result.metadata);
        setStep('confirm-action');
      } else {
        setExistingMetadata(null);
        setStep('new-book-form');
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('[Publish] Failed to open folder:', error);
        alert(`Failed to open folder: ${error.message || 'Unknown error'}`);
      }
      resetState();
    }
  };

  const handlePublishAction = async (action: 'update-stats' | 'new-version') => {
    if (action === 'update-stats') {
      await executePublish('update-stats');
    } else {
      setStep('version-form');
    }
  };

  const executePublish = async (mode: 'update-stats' | 'new-version' | 'new-book') => {
    if (!selectedDirHandle) return;

    setStep('writing');
    try {
      const result = await ExportService.publishToLibrary({
        mode,
        dirHandle: selectedDirHandle,
        existingMetadata: existingMetadata || undefined,
        versionDetails: mode !== 'update-stats' ? versionDetails : undefined,
        novelDetails: mode === 'new-book' ? novelDetails : undefined,
        includeImages: true,
      });

      setPublishResult(result);
      setStep('done');
    } catch (error: any) {
      console.error('[Publish] Failed to publish:', error);
      setPublishResult({ success: false, filesWritten: [], error: error.message || 'Unknown error' });
      setStep('done');
    }
  };

  // Only render if in a non-idle step
  if (step === 'idle') return null;

  return (
    <>
      {/* Confirm Action Modal */}
      {step === 'confirm-action' && existingMetadata && createPortal(
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={resetState}>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                Existing Book Found
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                <strong>{existingMetadata.title}</strong> by {existingMetadata.author}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                What would you like to do?
              </p>

              <div className="space-y-3">
                <button
                  onClick={() => handlePublishAction('update-stats')}
                  className="w-full p-4 text-left border-2 border-gray-200 dark:border-gray-600 rounded-lg hover:border-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 transition-all"
                >
                  <div className="font-medium text-gray-900 dark:text-gray-100">Update Stats Only</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Overwrite session.json and update stats in metadata.json
                  </div>
                </button>

                <button
                  onClick={() => handlePublishAction('new-version')}
                  className="w-full p-4 text-left border-2 border-gray-200 dark:border-gray-600 rounded-lg hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all"
                >
                  <div className="font-medium text-gray-900 dark:text-gray-100">Add New Version</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Create a new version entry with different chapter range or translator
                  </div>
                </button>
              </div>

              <div className="flex justify-end mt-6">
                <button
                  onClick={resetState}
                  className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Version Form Modal */}
      {step === 'version-form' && createPortal(
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={resetState}>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                Version Details
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Version Name *
                  </label>
                  <input
                    type="text"
                    value={versionDetails.versionName}
                    onChange={e => setVersionDetails(prev => ({ ...prev, versionName: e.target.value }))}
                    placeholder="e.g., Complete AI Translation v2"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Translator Name *
                  </label>
                  <input
                    type="text"
                    value={versionDetails.translatorName}
                    onChange={e => setVersionDetails(prev => ({ ...prev, translatorName: e.target.value }))}
                    placeholder="Your name or handle"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Translator Website (optional)
                  </label>
                  <input
                    type="url"
                    value={versionDetails.translatorLink}
                    onChange={e => setVersionDetails(prev => ({ ...prev, translatorLink: e.target.value }))}
                    placeholder="https://..."
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Description
                  </label>
                  <textarea
                    value={versionDetails.description}
                    onChange={e => setVersionDetails(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Brief notes about this version..."
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Style
                    </label>
                    <select
                      value={versionDetails.style}
                      onChange={e => setVersionDetails(prev => ({ ...prev, style: e.target.value as VersionDetails['style'] }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    >
                      <option value="faithful">Faithful</option>
                      <option value="liberal">Liberal</option>
                      <option value="image-heavy">Image-heavy</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Status
                    </label>
                    <select
                      value={versionDetails.completionStatus}
                      onChange={e => setVersionDetails(prev => ({ ...prev, completionStatus: e.target.value as VersionDetails['completionStatus'] }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    >
                      <option value="In Progress">In Progress</option>
                      <option value="Complete">Complete</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={resetState}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  onClick={() => executePublish(existingMetadata ? 'new-version' : 'new-book')}
                  disabled={!versionDetails.versionName || !versionDetails.translatorName}
                  className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  Publish
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* New Book Form Modal */}
      {step === 'new-book-form' && createPortal(
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={resetState}>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                Create New Book
              </h3>

              <div className="space-y-4">
                <h4 className="font-medium text-gray-800 dark:text-gray-200 border-b border-gray-200 dark:border-gray-600 pb-2">
                  Book Details
                </h4>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Book ID *
                  </label>
                  <input
                    type="text"
                    value={novelDetails.id}
                    onChange={e => setNovelDetails(prev => ({ ...prev, id: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') }))}
                    placeholder="e.g., dungeon-defense-wn"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Lowercase letters, numbers, and hyphens only</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Title *
                  </label>
                  <input
                    type="text"
                    value={novelDetails.title}
                    onChange={e => setNovelDetails(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Novel title"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Author *
                  </label>
                  <input
                    type="text"
                    value={novelDetails.author}
                    onChange={e => setNovelDetails(prev => ({ ...prev, author: e.target.value }))}
                    placeholder="Original author"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Original Language
                  </label>
                  <select
                    value={novelDetails.originalLanguage}
                    onChange={e => setNovelDetails(prev => ({ ...prev, originalLanguage: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  >
                    <option value="Korean">Korean</option>
                    <option value="Japanese">Japanese</option>
                    <option value="Chinese">Chinese</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Description (optional)
                  </label>
                  <textarea
                    value={novelDetails.description}
                    onChange={e => setNovelDetails(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Brief synopsis..."
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                </div>

                <h4 className="font-medium text-gray-800 dark:text-gray-200 border-b border-gray-200 dark:border-gray-600 pb-2 pt-4">
                  Version Details
                </h4>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Version Name *
                  </label>
                  <input
                    type="text"
                    value={versionDetails.versionName}
                    onChange={e => setVersionDetails(prev => ({ ...prev, versionName: e.target.value }))}
                    placeholder="e.g., Initial AI Translation"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Translator Name *
                  </label>
                  <input
                    type="text"
                    value={versionDetails.translatorName}
                    onChange={e => setVersionDetails(prev => ({ ...prev, translatorName: e.target.value }))}
                    placeholder="Your name or handle"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Style
                    </label>
                    <select
                      value={versionDetails.style}
                      onChange={e => setVersionDetails(prev => ({ ...prev, style: e.target.value as VersionDetails['style'] }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    >
                      <option value="faithful">Faithful</option>
                      <option value="liberal">Liberal</option>
                      <option value="image-heavy">Image-heavy</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Status
                    </label>
                    <select
                      value={versionDetails.completionStatus}
                      onChange={e => setVersionDetails(prev => ({ ...prev, completionStatus: e.target.value as VersionDetails['completionStatus'] }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    >
                      <option value="In Progress">In Progress</option>
                      <option value="Complete">Complete</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={resetState}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  onClick={() => executePublish('new-book')}
                  disabled={!novelDetails.id || !novelDetails.title || !novelDetails.author || !versionDetails.versionName || !versionDetails.translatorName}
                  className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  Create Book
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Writing Progress */}
      {step === 'writing' && createPortal(
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-sm w-full p-6">
            <div className="flex flex-col items-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mb-4"></div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                Publishing...
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
                Writing session.json and metadata.json to the selected folder
              </p>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Done Modal */}
      {step === 'done' && publishResult && createPortal(
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={resetState}>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              {publishResult.success ? (
                <>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                      <span className="text-xl">✓</span>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                      Published Successfully!
                    </h3>
                  </div>

                  <div className="mb-4">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Files written:</p>
                    <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                      {publishResult.filesWritten.map((file, i) => (
                        <li key={i} className="flex items-center gap-2">
                          <span className="text-green-600 dark:text-green-400">•</span>
                          {file}
                        </li>
                      ))}
                    </ul>
                    {publishResult.sessionSizeBytes && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                        Session size: {formatSize(publishResult.sessionSizeBytes)}
                      </p>
                    )}
                  </div>

                  <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-3 mb-4">
                    <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Next steps:</p>
                    <code className="text-xs text-gray-600 dark:text-gray-400 block">
                      git add . && git commit -m "Update translation" && git push
                    </code>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                      <span className="text-xl">✗</span>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                      Publish Failed
                    </h3>
                  </div>
                  <p className="text-sm text-red-600 dark:text-red-400 mb-4">
                    {publishResult.error || 'Unknown error occurred'}
                  </p>
                </>
              )}

              <button
                onClick={resetState}
                className="w-full px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

export default PublishWizard;

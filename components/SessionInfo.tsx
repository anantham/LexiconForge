import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAppStore } from '../store';
import { MODEL_ABBREVIATIONS } from '../constants';
import SettingsIcon from './icons/SettingsIcon';
import TrashIcon from './icons/TrashIcon';

import { ImportTransformationService } from '../services/importTransformationService';
import type { ChapterSummary } from '../types';

// Prefer a human-facing number if the title contains "Chapter 147", "Ch 147", etc.
const numberFromTitle = (s?: string): number | undefined => {
    if (!s) return undefined;
    const m = s.match(/\b(?:Ch(?:apter)?\.?\s*)(\d{1,5})\b/i);
    return m ? parseInt(m[1], 10) : undefined;
};

const SessionInfo: React.FC = () => {
    const currentChapterId = useAppStore(s => s.currentChapterId);
    const chapters = useAppStore(s => s.chapters);
    const handleNavigate = useAppStore(s => s.handleNavigate);
    const exportSessionData = useAppStore(s => s.exportSessionData);
    const exportEpub = useAppStore(s => s.exportEpub);
    const setShowSettingsModal = useAppStore(s => s.setShowSettingsModal);
    const fetchTranslationVersions = useAppStore(s => s.fetchTranslationVersions);
    const setActiveTranslationVersion = useAppStore(s => s.setActiveTranslationVersion);
    const deleteTranslationVersion = useAppStore(s => s.deleteTranslationVersion);
    const currentChapter = useAppStore(s => s.chapters.get(s.currentChapterId || ''));
    const translationResult = currentChapter?.translationResult;
    
    const [showExportModal, setShowExportModal] = useState(false);
    const [showVersionPicker, setShowVersionPicker] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [chapterOptions, setChapterOptions] = useState<ChapterSummary[]>([]);
    const [summariesLoading, setSummariesLoading] = useState<boolean>(true);
    const [versions, setVersions] = useState<any[]>([]);
    const [selectedVersion, setSelectedVersion] = useState<number | ''>('');

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                setSummariesLoading(true);
                const summaries = await ImportTransformationService.getChapterSummaries();
                if (cancelled) return;

                const byId = new Map<string, ChapterSummary>();
                summaries.forEach(summary => byId.set(summary.stableId, { ...summary }));

                if (chapters.size > 0) {
                    for (const [stableId, ch] of chapters.entries()) {
                        const existing = byId.get(stableId);
                        const candidate: ChapterSummary = existing ? { ...existing } : {
                            stableId,
                            canonicalUrl: (ch as any).canonicalUrl || ch.originalUrl,
                            title: ch.title || 'Untitled Chapter',
                            translatedTitle: ch.translationResult?.translatedTitle || undefined,
                            chapterNumber: ch.chapterNumber,
                            hasTranslation: Boolean(ch.translationResult),
                            hasImages: Boolean(ch.translationResult?.suggestedIllustrations?.some((ill: any) => !!ill?.url || !!ill?.generatedImage)),
                            lastAccessed: undefined,
                            lastTranslatedAt: undefined,
                        };

                        if ((ch as any).canonicalUrl) {
                            candidate.canonicalUrl = (ch as any).canonicalUrl;
                        }
                        if (ch.title && ch.title !== candidate.title) {
                            candidate.title = ch.title;
                        }
                        if (typeof ch.chapterNumber === 'number') {
                            candidate.chapterNumber = ch.chapterNumber;
                        }
                        if (ch.translationResult?.translatedTitle) {
                            candidate.translatedTitle = ch.translationResult.translatedTitle;
                        }
                        if (ch.translationResult) {
                            candidate.hasTranslation = true;
                            const hasImages = ch.translationResult.suggestedIllustrations?.some((ill: any) => !!ill?.url || !!ill?.generatedImage) || false;
                            candidate.hasImages = candidate.hasImages || hasImages;
                            candidate.lastTranslatedAt = candidate.lastTranslatedAt || new Date().toISOString();
                        }

                        byId.set(stableId, candidate);
                    }
                }

                const list = Array.from(byId.values());
                list.sort((a, b) => {
                    const aTranslated = a.translatedTitle;
                    const bTranslated = b.translatedTitle;
                    const aNumFromTitle = numberFromTitle(aTranslated);
                    const bNumFromTitle = numberFromTitle(bTranslated);
                    const aDisplay = aNumFromTitle ?? a.chapterNumber ?? Number.POSITIVE_INFINITY;
                    const bDisplay = bNumFromTitle ?? b.chapterNumber ?? Number.POSITIVE_INFINITY;

                    if (aDisplay !== bDisplay) return aDisplay - bDisplay;
                    return (a.title || '').localeCompare(b.title || '');
                });

                setChapterOptions(list);
            } catch (error) {
                if (!cancelled) {
                    console.error('[SessionInfo] Failed to load chapters for rendering:', error);
                    setChapterOptions([]);
                }
            } finally {
                if (!cancelled) {
                    setSummariesLoading(false);
                }
            }
        })();
        return () => { cancelled = true; };
    }, [chapters]);

    const sessionIsEmpty = chapterOptions.length === 0;

    // Load translation versions for current chapter
    useEffect(() => {
        let cancelled = false;
        (async () => {
            if (!currentChapterId) { setVersions([]); setSelectedVersion(''); return; }
            try {
                const v = await fetchTranslationVersions(currentChapterId);
                if (cancelled) return;
                setVersions(v);
                const active = v.find((x: any) => x.isActive);
                setSelectedVersion(active ? active.version : (v[0]?.version ?? ''));
            } catch {
                if (!cancelled) { setVersions([]); setSelectedVersion(''); }
            }
        })();
        return () => { cancelled = true; };
    }, [currentChapterId, fetchTranslationVersions, translationResult]);

    const handleVersionSelect = async (e: React.ChangeEvent<HTMLSelectElement>) => {
        const v = parseInt(e.target.value, 10);
        setSelectedVersion(isNaN(v) ? '' : v);
        if (currentChapterId && !Number.isNaN(v)) {
            await setActiveTranslationVersion(currentChapterId, v);
        }
    };

    const handleVersionPickerSelect = async (version: number) => {
        setSelectedVersion(version);
        setShowVersionPicker(false);
        if (currentChapterId) {
            await setActiveTranslationVersion(currentChapterId, version);
        }
    };

    const handleDeleteVersion = async (versionToDelete?: any) => {
        if (!currentChapterId) return;
        const target = versionToDelete || versions.find(v => v.version === selectedVersion);
        if (!target) return;

        if (confirm(`Are you sure you want to delete version ${target.version}? This cannot be undone.`)) {
            await deleteTranslationVersion(currentChapterId, target.id);
            // Refresh the list after deletion
            const v = await fetchTranslationVersions(currentChapterId);
            setVersions(v);
            const active = v.find((x: any) => x.isActive);
            setSelectedVersion(active ? active.version : (v[0]?.version ?? ''));
        }
    };

    const handleChapterSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const selectedId = e.target.value;
        const selectedChapter = chapterOptions.find(c => c.stableId === selectedId);
        if (selectedChapter) {
            const fallback = chapters.get(selectedId || '');
            const targetUrl = selectedChapter.canonicalUrl || fallback?.canonicalUrl || fallback?.originalUrl;
            if (targetUrl) {
                handleNavigate(targetUrl);
            }
        }
    };

    const handleExportFormat = async (format: 'json' | 'epub') => {
        setIsExporting(true);
        try {
            if (format === 'json') {
                exportSessionData();
            } else {
                await exportEpub();
            }
            setShowExportModal(false);
        } catch (error: any) {
            console.error('[Export] Export failed:', error);
            alert(`Export failed: ${error.message || 'Unknown error'}`);
        } finally {
            setIsExporting(false);
        }
    }

  return (
    <div className="w-full max-w-4xl mx-auto -mt-2 mb-6 p-3 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm rounded-b-xl shadow-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-t border-gray-200 dark:border-gray-700">
      <div className="flex-grow w-full sm:w-auto flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <label htmlFor="chapter-select" className="font-semibold text-gray-600 dark:text-gray-300 flex-shrink-0">
            Chapter:
          </label>
          {summariesLoading ? (
            <span className="text-sm text-gray-500 dark:text-gray-400 animate-pulse">Loading chapters…</span>
          ) : sessionIsEmpty ? (
            <span className="text-sm text-gray-500 dark:text-gray-400">No chapter loaded</span>
          ) : (
            <select
              id="chapter-select"
              value={currentChapterId || ''}
              onChange={handleChapterSelect}
              disabled={sessionIsEmpty || summariesLoading}
              className="flex-grow w-full sm:w-auto min-w-[12rem] px-3 py-2 text-sm text-gray-800 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 border-2 border-transparent rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
              aria-label="Select a chapter to navigate to"
            >
              {chapterOptions.map((chapter) => {
                  const titleNum = numberFromTitle(chapter.translatedTitle);
                  const dbNum = chapter.chapterNumber as number | undefined;
                  const displayNum = titleNum ?? dbNum;

                  const numPrefix = Number.isFinite(displayNum) && (displayNum as number) > 0 ? `Ch ${displayNum}: ` : '';
                  const title = chapter.translatedTitle || chapter.title || 'Untitled Chapter';
                  const label = `${numPrefix}${title}`;

                  return (
                    <option key={chapter.stableId} value={chapter.stableId}>
                      {label}
                    </option>
                  );
              })}
            </select>
          )}
        </div>
        {!sessionIsEmpty && versions.length > 0 && (
          <div className="flex items-center gap-2">
            <label className="text-sm font-semibold text-gray-600 dark:text-gray-300">Version:</label>
            
            {/* Desktop: Native select */}
            <div className="hidden md:flex items-center gap-2">
              <select
                value={selectedVersion}
                onChange={handleVersionSelect}
                className="px-2 py-1 text-xs text-gray-800 dark:text-gray-200 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded max-w-[22rem]"
              >
                {versions.sort((a: any,b: any)=>a.version-b.version).map((v: any) => {
                  const abbr = MODEL_ABBREVIATIONS[v.model] || v.model;
                  const ts = v.createdAt ? new Date(v.createdAt).toLocaleString(undefined, { month: 'short', day: '2-digit', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }) : '';
                  const baseLabel = ts ? `v${v.version} — ${abbr} • ${ts}` : `v${v.version} — ${abbr}`;
                  const label = v.customVersionLabel ? `${baseLabel} • ${v.customVersionLabel}` : baseLabel;
                  return (
                    <option key={v.id} value={v.version} title={ts}>{label}</option>
                  );
                })}
              </select>
              <button
                onClick={() => handleDeleteVersion()}
                disabled={!selectedVersion}
                className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Delete selected version"
              >
                <TrashIcon className="w-4 h-4" />
              </button>
            </div>

            {/* Mobile: Custom button */}
            <button
              onClick={() => setShowVersionPicker(true)}
              className="md:hidden px-2 py-1 text-xs text-gray-800 dark:text-gray-200 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded max-w-[12rem] truncate text-left"
            >
              {(() => {
                const current = versions.find(v => v.version === selectedVersion);
                if (!current) return 'Select version';
                const abbr = MODEL_ABBREVIATIONS[current.model] || current.model;
                const base = `v${current.version} — ${abbr}`;
                return current.customVersionLabel ? `${base} • ${current.customVersionLabel}` : base;
              })()}
            </button>
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0 w-full sm:w-auto justify-center">
        <button
            onClick={() => setShowSettingsModal(true)}
            className="p-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 font-semibold rounded-full shadow-sm hover:bg-gray-300 dark:hover:bg-gray-600 transition"
            title="Settings"
        >
            <SettingsIcon className="w-5 h-5"/>
        </button>
        <div className="relative">
          <button
              onClick={() => setShowExportModal(true)}
              disabled={sessionIsEmpty || isExporting}
              className="px-4 py-2 bg-green-600 text-white font-semibold rounded-md shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 dark:focus:ring-offset-gray-800 disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed transition duration-300 ease-in-out"
          >
              {isExporting ? 'Exporting...' : 'Export Session'}
          </button>
          
          {showExportModal && createPortal(
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowExportModal(false)}>
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md w-full mx-4" onClick={e => e.stopPropagation()}>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Choose Export Format</h3>
                
                <div className="space-y-3">
                  <button
                    onClick={() => handleExportFormat('json')}
                    disabled={isExporting}
                    className="w-full p-4 text-left border-2 border-gray-200 dark:border-gray-600 rounded-lg hover:border-blue-500 dark:hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-gray-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="font-medium text-gray-900 dark:text-gray-100">JSON Format</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Export session data as JSON file for backup or sharing</div>
                  </button>
                  
                  <button
                    onClick={() => handleExportFormat('epub')}
                    disabled={isExporting}
                    className="w-full p-4 text-left border-2 border-gray-200 dark:border-gray-600 rounded-lg hover:border-blue-500 dark:hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-gray-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="font-medium text-gray-900 dark:text-gray-100">EPUB Format</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Generate readable e-book with active translations and images</div>
                  </button>
                </div>
                
                <div className="flex justify-end mt-6">
                  <button
                    onClick={() => setShowExportModal(false)}
                    disabled={isExporting}
                    className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )}

          {showVersionPicker && createPortal(
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end md:items-center justify-center z-50" onClick={() => setShowVersionPicker(false)}>
              <div className="bg-white dark:bg-gray-800 rounded-t-lg md:rounded-lg shadow-xl w-full md:max-w-md md:mx-4 max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Select Version</h3>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4">
                  <ul className="space-y-1">
                    {versions.sort((a: any, b: any) => a.version - b.version).map((v: any) => {
                      const abbr = MODEL_ABBREVIATIONS[v.model] || v.model;
                      const tsLong = v.createdAt ? new Date(v.createdAt).toLocaleString(undefined, { 
                        weekday: 'short',
                        month: 'short', 
                        day: '2-digit', 
                        year: 'numeric', 
                        hour: 'numeric', 
                        minute: '2-digit', 
                        hour12: true 
                      }) : '';
                      
                      return (
                        <li key={v.id} className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                          <input 
                            type="radio" 
                            id={`version-${v.version}`}
                            name="version" 
                            checked={selectedVersion === v.version}
                            onChange={() => handleVersionPickerSelect(v.version)}
                            className="mt-1 text-blue-600 focus:ring-blue-500 dark:focus:ring-blue-400"
                          />
                          <label htmlFor={`version-${v.version}`} className="flex-1 cursor-pointer">
                            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                              v{v.version} — {abbr}
                            </div>
                            {tsLong && (
                              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                {tsLong}
                              </div>
                            )}
                          </label>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteVersion(v);
                            }}
                            className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                            title={`Delete version ${v.version}`}
                          >
                            🗑️
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
                
                <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                  <button
                    onClick={() => setShowVersionPicker(false)}
                    className="w-full px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )}
        </div>
      </div>
    </div>
  );
};

export default SessionInfo;

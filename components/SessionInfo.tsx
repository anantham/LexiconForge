import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAppStore } from '../store';
import { MODEL_ABBREVIATIONS } from '../config/constants';
import SettingsIcon from './icons/SettingsIcon';
import TrashIcon from './icons/TrashIcon';

import { ImportTransformationService } from '../services/importTransformationService';
import type { ChapterSummary } from '../types';
import type { NovelEntry } from '../types/novel';
import { telemetryService } from '../services/telemetryService';
import { ChapterOps } from '../services/db/operations';
import { ExportService } from '../services/exportService';

// Prefer a human-facing number if the title contains "Chapter 147", "Ch 147", etc.
const numberFromTitle = (s?: string): number | undefined => {
    if (!s) return undefined;
    const m = s.match(/\b(?:Ch(?:apter)?\.?\s*)(\d{1,5})\b/i);
    return m ? parseInt(m[1], 10) : undefined;
};

const getTimestamp = () =>
    (typeof performance !== 'undefined' && typeof performance.now === 'function'
        ? performance.now()
        : Date.now());

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

const DEFAULT_EXPORT_OPTIONS = {
    includeChapters: true,
    includeTelemetry: true,
    includeImages: false,
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

    const [exportOptions, setExportOptions] = useState(() => ({ ...DEFAULT_EXPORT_OPTIONS }));
    const [imageUsage, setImageUsage] = useState<{ images: number; totalSizeMB: number } | null>(null);
    const [telemetrySizeBytes, setTelemetrySizeBytes] = useState<number | null>(null);

    const approxChapterSizeBytes = useMemo(() => {
        try {
            if (typeof TextEncoder === 'undefined') {
                return null;
            }
            const encoder = new TextEncoder();
            let total = 0;
            chapters.forEach((chapter: any) => {
                total += encoder.encode(chapter?.title || '').length;
                total += encoder.encode(chapter?.content || '').length;

                if (chapter?.translationResult?.translation) {
                    total += encoder.encode(chapter.translationResult.translation).length;
                }
                if (chapter?.translationResult?.footnotes) {
                    total += encoder.encode(JSON.stringify(chapter.translationResult.footnotes)).length;
                }
                if (Array.isArray(chapter?.feedback)) {
                    total += encoder.encode(JSON.stringify(chapter.feedback)).length;
                }
            });
            return total;
        } catch {
            return null;
        }
    }, [chapters]);

    const imageSizeBytes = imageUsage ? imageUsage.totalSizeMB * 1024 * 1024 : null;
    const imageUsageLabel = imageUsage
        ? `${formatSize(imageSizeBytes)} • ${imageUsage.images} asset${imageUsage.images === 1 ? '' : 's'}`
        : 'calculating…';
    const telemetrySizeLabel = formatSize(telemetrySizeBytes);
    const chapterSizeLabel = formatSize(approxChapterSizeBytes);
    const imagesDisabled = !exportOptions.includeChapters;
    const hasJsonContent = exportOptions.includeChapters || exportOptions.includeTelemetry || exportOptions.includeImages;

    const mountStartRef = useRef<number>(getTimestamp());
    const initialChapterCountRef = useRef<number>(chapters.size);

    useEffect(() => {
        telemetryService.capturePerformance('ux:component:SessionInfo:mount', getTimestamp() - mountStartRef.current, {
            chaptersInStore: initialChapterCountRef.current,
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const [showExportModal, setShowExportModal] = useState(false);
    const [showVersionPicker, setShowVersionPicker] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [chapterOptions, setChapterOptions] = useState<ChapterSummary[]>([]);
    const [summariesLoading, setSummariesLoading] = useState<boolean>(true);
    const [versions, setVersions] = useState<any[]>([]);
    const [selectedVersion, setSelectedVersion] = useState<number | ''>('');
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [deleteMode, setDeleteMode] = useState<'translation-only' | 'chapter'>('translation-only');
    const [pendingDeleteTarget, setPendingDeleteTarget] = useState<any>(null);

    // Publish to Library state
    const [publishStep, setPublishStep] = useState<
        'idle' | 'confirm-action' | 'version-form' | 'new-book-form' | 'writing' | 'done'
    >('idle');
    const [existingMetadata, setExistingMetadata] = useState<NovelEntry | null>(null);
    const [selectedDirHandle, setSelectedDirHandle] = useState<FileSystemDirectoryHandle | null>(null);
    const [publishResult, setPublishResult] = useState<{ success: boolean; filesWritten: string[]; error?: string; sessionSizeBytes?: number } | null>(null);
    const [versionDetails, setVersionDetails] = useState({
        versionName: '',
        translatorName: '',
        translatorLink: '',
        description: '',
        style: 'faithful' as 'faithful' | 'liberal' | 'image-heavy' | 'other',
        completionStatus: 'In Progress' as 'In Progress' | 'Complete',
    });
    const [novelDetails, setNovelDetails] = useState({
        id: '',
        title: '',
        author: '',
        originalLanguage: 'Korean',
        genres: [] as string[],
        description: '',
    });

    useEffect(() => {
        if (!showExportModal) {
            return;
        }

        let cancelled = false;
        setImageUsage(null);
        setTelemetrySizeBytes(null);

        (async () => {
            try {
                const telemetryJson = telemetryService.exportTelemetry();
                if (!cancelled) {
                    let bytes: number;
                    try {
                        bytes = new TextEncoder().encode(telemetryJson ?? '').length;
                    } catch {
                        bytes = telemetryJson ? telemetryJson.length : 0;
                    }
                    setTelemetrySizeBytes(bytes);
                }
            } catch {
                if (!cancelled) setTelemetrySizeBytes(null);
            }

            try {
                const imageCache = await import('../services/imageCacheService');
                if (cancelled) return;
                if (typeof window !== 'undefined' && imageCache.ImageCacheStore.isSupported()) {
                    const stats = await imageCache.ImageCacheStore.getUsage();
                    if (!cancelled) {
                        setImageUsage(stats);
                    }
                } else if (!cancelled) {
                    setImageUsage({ images: 0, totalSizeMB: 0 });
                }
            } catch (error) {
                console.warn('[Export] Failed to inspect image cache usage', error);
                if (!cancelled) setImageUsage(null);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [showExportModal]);

    useEffect(() => {
        let cancelled = false;
        const summaryLoadStart = getTimestamp();
        let resolvedCount = 0;
        (async () => {
            try {
                setSummariesLoading(true);
                console.log(`[🎯 DROPDOWN] Starting dropdown population, chapters in store: ${chapters.size}`);

                const summaries = await ImportTransformationService.getChapterSummaries();
                if (cancelled) return;

                console.log(`[📊 DROPDOWN] Received ${summaries.length} summaries from IndexedDB`);

                const byId = new Map<string, ChapterSummary>();
                summaries.forEach(summary => byId.set(summary.stableId, { ...summary }));

                console.log(`[🔍 DROPDOWN] Merging with Zustand store (${chapters.size} chapters)`);

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

                        if (!existing) {
                            console.log(`[⚠️ DROPDOWN] Chapter in store but NO SUMMARY in IndexedDB: #${ch.chapterNumber} "${ch.title}"`);
                        }

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
                console.log(`[📝 DROPDOWN] Final merged list has ${list.length} items`);

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

                console.log(`[🔢 DROPDOWN] Sorted dropdown list:`);
                list.forEach((item, idx) => {
                    console.log(`[📌 DROPDOWN]   ${idx + 1}. Ch #${item.chapterNumber}: "${item.translatedTitle || item.title}"`);
                });

                setChapterOptions(list);
                resolvedCount = list.length;
            } catch (error) {
                if (!cancelled) {
                    console.error('[SessionInfo] Failed to load chapters for rendering:', error);
                    setChapterOptions([]);
                }
            } finally {
                if (!cancelled) {
                    setSummariesLoading(false);
                    telemetryService.capturePerformance('ux:component:SessionInfo:summariesLoad', getTimestamp() - summaryLoadStart, {
                        resultCount: resolvedCount,
                        chaptersInStore: chapters.size,
                    });
                }
            }
        })();
        return () => { cancelled = true; };
    }, [chapters]);

    const sessionIsEmpty = chapterOptions.length === 0;

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
                const active = v.find((x: any) => x.isActive);
                setSelectedVersion(active ? active.version : (v[0]?.version ?? ''));
            } catch (error) {
                outcome = 'error';
                errorMessage = error instanceof Error ? error.message : String(error);
                if (!cancelled) { setVersions([]); setSelectedVersion(''); }
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

        // Check if this is the last translation version
        const isLastVersion = versions.length === 1;

        if (isLastVersion) {
            // Show dialog for last translation
            setPendingDeleteTarget(target);
            setDeleteMode('translation-only'); // Default to translation-only
            setShowDeleteDialog(true);
        } else {
            // Normal deletion with simple confirm
            if (confirm(`Are you sure you want to delete version ${target.version}? This cannot be undone.`)) {
                await performDeleteTranslation(target);
            }
        }
    };

    const performDeleteTranslation = async (target: any) => {
        if (!currentChapterId) return;

        const refreshStart = getTimestamp();
        let resolvedCount = 0;
        try {
            await deleteTranslationVersion(currentChapterId, target.id);
            // Refresh the list after deletion
            const v = await fetchTranslationVersions(currentChapterId);
            resolvedCount = Array.isArray(v) ? v.length : 0;
            setVersions(v);
            const active = v.find((x: any) => x.isActive);
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
            // Delete chapter completely from IndexedDB + store
            try {
                const currentChapter = chapters.get(currentChapterId);
                if (!currentChapter) return;

                await ChapterOps.deleteByUrl(currentChapter.originalUrl);

                // Remove from store
                const removeChapter = useAppStore.getState().removeChapter;
                if (removeChapter) {
                    removeChapter(currentChapterId);
                }

                console.log(`[SessionInfo] Deleted chapter completely: ${currentChapterId}`);

                // Navigate away (will be handled by store update)
            } catch (error) {
                console.error('[SessionInfo] Failed to delete chapter:', error);
                const setError = useAppStore.getState().setError;
                if (setError) {
                    setError('Failed to delete chapter');
                }
            }
        } else {
            // Delete translation only (normal path)
            await performDeleteTranslation(pendingDeleteTarget);
        }

        setPendingDeleteTarget(null);
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

    const handleExportOptionChange = (key: keyof typeof exportOptions) => (event: React.ChangeEvent<HTMLInputElement>) => {
        const checked = event.target.checked;
        setExportOptions(prev => {
            const next = { ...prev, [key]: checked };
            if (key === 'includeChapters' && !checked) {
                next.includeImages = false;
            }
            if (key === 'includeImages' && checked) {
                next.includeChapters = true;
            }
            return next;
        });
    };

    const handleExportFormat = async (format: 'json' | 'epub') => {
        setIsExporting(true);
        try {
            if (format === 'json') {
                const hasContent = exportOptions.includeChapters || exportOptions.includeTelemetry || exportOptions.includeImages;
                if (!hasContent) {
                    alert('Select at least one data type to include in the JSON export.');
                    return;
                }
                await exportSessionData(exportOptions);
            } else {
                // EPUB export - check for metadata and cover image
                let novelMeta: { title?: string; author?: string; coverImage?: any } = {};
                try {
                    const stored = localStorage.getItem('novelMetadata');
                    if (stored) novelMeta = JSON.parse(stored);
                } catch {}

                const missingFields: string[] = [];
                if (!novelMeta.title?.trim()) missingFields.push('Title');
                if (!novelMeta.author?.trim()) missingFields.push('Author');

                // Warn about missing metadata
                if (missingFields.length > 0) {
                    const proceed = confirm(
                        `The following metadata fields are empty:\n• ${missingFields.join('\n• ')}\n\n` +
                        `Your EPUB will have generic metadata. Would you like to continue anyway?\n\n` +
                        `(Click Cancel to go to Settings → Novel Info to fill in the details)`
                    );
                    if (!proceed) {
                        setIsExporting(false);
                        setShowExportModal(false);
                        setShowSettingsModal(true);
                        return;
                    }
                }

                // Warn about missing cover image
                if (!novelMeta.coverImage?.cacheKey) {
                    const proceed = confirm(
                        `No cover image selected for your EPUB.\n\n` +
                        `Would you like to continue without a cover?\n\n` +
                        `(Click Cancel to go to Settings → Novel Info to select a cover from your gallery)`
                    );
                    if (!proceed) {
                        setIsExporting(false);
                        setShowExportModal(false);
                        setShowSettingsModal(true);
                        return;
                    }
                }

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

    // Publish to Library handlers
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
                    // Generate and download files manually
                    const sessionData = await ExportService.generateQuickExport();
                    const stats = await ExportService.calculateSessionStats();

                    // Get novel metadata from localStorage
                    let storedMeta: any = {};
                    try {
                        const stored = localStorage.getItem('novelMetadata');
                        if (stored) storedMeta = JSON.parse(stored);
                    } catch {}

                    const novelId = storedMeta.title?.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'novel';

                    // Create a basic metadata structure
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

                    // Download both files
                    await ExportService.downloadJSON(metadata, `${novelId}-metadata.json`);
                    await ExportService.downloadJSON(sessionData, `${novelId}-session.json`);

                    alert(
                        'Files downloaded!\n\n' +
                        'To add to your library:\n' +
                        `1. Create folder: library/${novelId}/\n` +
                        '2. Rename and move files:\n' +
                        `   • ${novelId}-metadata.json → metadata.json\n` +
                        `   • ${novelId}-session.json → session.json\n` +
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
            if (result.exists && result.metadata) {
                setExistingMetadata(result.metadata);
                setPublishStep('confirm-action');
            } else {
                setExistingMetadata(null);
                setPublishStep('new-book-form');
            }
        } catch (error: any) {
            if (error.name !== 'AbortError') {
                console.error('[Publish] Failed to open folder:', error);
                alert(`Failed to open folder: ${error.message || 'Unknown error'}`);
            }
        }
    };

    const handlePublishAction = async (action: 'update-stats' | 'new-version') => {
        if (action === 'update-stats') {
            // Directly write files without version form
            await executePublish('update-stats');
        } else {
            // Show version details form
            setPublishStep('version-form');
        }
    };

    const executePublish = async (mode: 'update-stats' | 'new-version' | 'new-book') => {
        if (!selectedDirHandle) return;

        setPublishStep('writing');
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
            setPublishStep('done');
        } catch (error: any) {
            console.error('[Publish] Failed to publish:', error);
            setPublishResult({ success: false, filesWritten: [], error: error.message || 'Unknown error' });
            setPublishStep('done');
        }
    };

    const resetPublishState = () => {
        setPublishStep('idle');
        setExistingMetadata(null);
        setSelectedDirHandle(null);
        setPublishResult(null);
        setVersionDetails({
            versionName: '',
            translatorName: '',
            translatorLink: '',
            description: '',
            style: 'faithful',
            completionStatus: 'In Progress',
        });
        setNovelDetails({
            id: '',
            title: '',
            author: '',
            originalLanguage: 'Korean',
            genres: [],
            description: '',
        });
    };

  return (
    <div className="w-full max-w-4xl mx-auto -mt-2 mb-6 p-3 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm rounded-b-xl shadow-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-t border-gray-200 dark:border-gray-700">
      <div className="flex-grow w-full sm:w-auto flex flex-col gap-2 min-w-0">
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
              className="flex-grow w-full sm:w-auto min-w-[12rem] max-w-full px-3 py-2 text-sm text-gray-800 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 border-2 border-transparent rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
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
          <div className="flex items-center gap-2 flex-wrap">
            <label className="text-sm font-semibold text-gray-600 dark:text-gray-300">Version:</label>

            {/* Desktop: Native select */}
            <div className="hidden md:flex items-center gap-2 min-w-0">
              <select
                value={selectedVersion}
                onChange={handleVersionSelect}
                className="px-2 py-1 text-xs text-gray-800 dark:text-gray-200 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded max-w-[22rem]"
              >
                {versions.sort((a: any,b: any)=>a.version-b.version).map((v: any) => {
                  // Handle undefined/unknown model gracefully
                  const modelName = v.model && v.model !== 'unknown' ? v.model : null;
                  const abbr = modelName ? (MODEL_ABBREVIATIONS[modelName] || modelName) : 'Unknown';
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
                // Handle undefined/unknown model gracefully
                const modelName = current.model && current.model !== 'unknown' ? current.model : null;
                const abbr = modelName ? (MODEL_ABBREVIATIONS[modelName] || modelName) : 'Unknown';
                const base = `v${current.version} — ${abbr}`;
                return current.customVersionLabel ? `${base} • ${current.customVersionLabel}` : base;
              })()}
            </button>

            {/* Export button - moved to version row */}
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
      <div className="flex items-center gap-2 flex-shrink-0 w-full sm:w-auto justify-center sm:justify-end">
        <button
            onClick={() => setShowSettingsModal(true)}
            className="p-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 font-semibold rounded-full shadow-sm hover:bg-gray-300 dark:hover:bg-gray-600 transition"
            title="Settings"
        >
            <SettingsIcon className="w-5 h-5"/>
        </button>
      </div>

      {/* Export modal - moved outside button container */}
      {showExportModal && createPortal(
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowExportModal(false)}>
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md w-full mx-4" onClick={e => e.stopPropagation()}>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Choose Export Format</h3>
                
                <div className="space-y-4">
                  <fieldset className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 space-y-3">
                    <legend className="text-sm font-semibold text-gray-700 dark:text-gray-200 px-1">JSON contents</legend>
                    <label className="flex items-start gap-3 text-sm text-gray-800 dark:text-gray-200">
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4"
                        checked={exportOptions.includeChapters}
                        onChange={handleExportOptionChange('includeChapters')}
                      />
                      <span className="flex-1">
                        Chapters & versions
                        <span className="block text-xs text-gray-500 dark:text-gray-400">~{chapterSizeLabel}</span>
                      </span>
                    </label>
                    <label className="flex items-start gap-3 text-sm text-gray-800 dark:text-gray-200">
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4"
                        checked={exportOptions.includeTelemetry}
                        onChange={handleExportOptionChange('includeTelemetry')}
                      />
                      <span className="flex-1">
                        Telemetry events
                        <span className="block text-xs text-gray-500 dark:text-gray-400">~{telemetrySizeLabel}</span>
                      </span>
                    </label>
                    <label className={`flex items-start gap-3 text-sm ${imagesDisabled ? 'opacity-60 cursor-not-allowed' : 'text-gray-800 dark:text-gray-200'}`}>
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4"
                        checked={exportOptions.includeImages}
                        onChange={handleExportOptionChange('includeImages')}
                        disabled={imagesDisabled}
                      />
                      <span className="flex-1">
                        Illustrations (Cache API)
                        <span className="block text-xs text-gray-500 dark:text-gray-400">{imageUsageLabel}</span>
                        {imagesDisabled && (
                          <span className="block text-xs text-amber-600 dark:text-amber-400 mt-1">Enable chapters to attach illustrations.</span>
                        )}
                      </span>
                    </label>
                  </fieldset>

                  <button
                    onClick={() => handleExportFormat('json')}
                    disabled={isExporting || !hasJsonContent}
                    className="w-full p-4 text-left border-2 border-gray-200 dark:border-gray-600 rounded-lg hover:border-blue-500 dark:hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-gray-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="font-medium text-gray-900 dark:text-gray-100">Export JSON</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {hasJsonContent ? 'Download a session snapshot with your selected data.' : 'Select at least one data type to enable JSON export.'}
                    </div>
                  </button>

                  <button
                    onClick={() => handleExportFormat('epub')}
                    disabled={isExporting}
                    className="w-full p-4 text-left border-2 border-gray-200 dark:border-gray-600 rounded-lg hover:border-blue-500 dark:hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-gray-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="font-medium text-gray-900 dark:text-gray-100">Export EPUB</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Generate a readable e-book with the active translations and images</div>
                  </button>

                  <div className="border-t border-gray-200 dark:border-gray-600 my-2" />

                  <button
                    onClick={handlePublishClick}
                    disabled={isExporting || sessionIsEmpty}
                    className="w-full p-4 text-left border-2 border-purple-200 dark:border-purple-600 rounded-lg hover:border-purple-500 dark:hover:border-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="font-medium text-gray-900 dark:text-gray-100">Publish to Library</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      Save to local git repo (metadata.json + session.json)
                    </div>
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

      {/* Version picker modal */}
      {showVersionPicker && createPortal(
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end md:items-center justify-center z-50" onClick={() => setShowVersionPicker(false)}>
              <div className="bg-white dark:bg-gray-800 rounded-t-lg md:rounded-lg shadow-xl w-full md:max-w-md md:mx-4 max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Select Version</h3>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4">
                  <ul className="space-y-1">
                    {versions.sort((a: any, b: any) => a.version - b.version).map((v: any) => {
                      // Handle undefined/unknown model gracefully
                      const modelName = v.model && v.model !== 'unknown' ? v.model : null;
                      const abbr = modelName ? (MODEL_ABBREVIATIONS[modelName] || modelName) : 'Unknown';
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

      {/* Delete Confirmation Dialog */}
      {showDeleteDialog && createPortal(
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                Delete Last Translation?
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                This is the last translation for this chapter. What would you like to do?
              </p>

              <div className="space-y-3 mb-6">
                <label className="flex items-start p-3 border-2 rounded-lg cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  style={{
                    borderColor: deleteMode === 'translation-only'
                      ? 'rgb(59, 130, 246)'
                      : 'rgb(229, 231, 235)'
                  }}
                >
                  <input
                    type="radio"
                    name="deleteMode"
                    value="translation-only"
                    checked={deleteMode === 'translation-only'}
                    onChange={(e) => setDeleteMode(e.target.value as any)}
                    className="mt-1 mr-3"
                  />
                  <div>
                    <div className="font-medium text-gray-900 dark:text-gray-100">
                      Delete translation only
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Keeps the raw chapter in database. Auto-translate will create a new translation.
                    </div>
                  </div>
                </label>

                <label className="flex items-start p-3 border-2 rounded-lg cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  style={{
                    borderColor: deleteMode === 'chapter'
                      ? 'rgb(59, 130, 246)'
                      : 'rgb(229, 231, 235)'
                  }}
                >
                  <input
                    type="radio"
                    name="deleteMode"
                    value="chapter"
                    checked={deleteMode === 'chapter'}
                    onChange={(e) => setDeleteMode(e.target.value as any)}
                    className="mt-1 mr-3"
                  />
                  <div>
                    <div className="font-medium text-gray-900 dark:text-gray-100">
                      Delete chapter from database
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Removes chapter completely. Use this to clean up accidentally fetched chapters.
                    </div>
                  </div>
                </label>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowDeleteDialog(false);
                    setPendingDeleteTarget(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmDelete}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Publish to Library - Confirm Action Modal */}
      {publishStep === 'confirm-action' && existingMetadata && createPortal(
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={resetPublishState}>
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
                  onClick={resetPublishState}
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

      {/* Publish to Library - Version Form Modal */}
      {publishStep === 'version-form' && createPortal(
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={resetPublishState}>
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
                      onChange={e => setVersionDetails(prev => ({ ...prev, style: e.target.value as typeof versionDetails.style }))}
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
                      onChange={e => setVersionDetails(prev => ({ ...prev, completionStatus: e.target.value as typeof versionDetails.completionStatus }))}
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
                  onClick={resetPublishState}
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

      {/* Publish to Library - New Book Form Modal */}
      {publishStep === 'new-book-form' && createPortal(
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={resetPublishState}>
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
                      onChange={e => setVersionDetails(prev => ({ ...prev, style: e.target.value as typeof versionDetails.style }))}
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
                      onChange={e => setVersionDetails(prev => ({ ...prev, completionStatus: e.target.value as typeof versionDetails.completionStatus }))}
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
                  onClick={resetPublishState}
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

      {/* Publish to Library - Writing Progress */}
      {publishStep === 'writing' && createPortal(
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

      {/* Publish to Library - Done Modal */}
      {publishStep === 'done' && publishResult && createPortal(
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={resetPublishState}>
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
                onClick={resetPublishState}
                className="w-full px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default SessionInfo;

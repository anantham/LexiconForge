/**
 * useChapterDropdownOptions Hook
 *
 * Encapsulates the logic for building chapter dropdown options by merging
 * data from IndexedDB summaries and the Zustand store.
 *
 * This provides a single source of truth for chapter display data,
 * avoiding the previous issue where ChapterSummary.translatedTitle and
 * store.chapter.translationResult.translatedTitle could conflict.
 *
 * Priority order (highest to lowest):
 * 1. Store chapter data (most current, in-memory)
 * 2. IndexedDB summaries (persisted, may be stale)
 */

import { useState, useEffect } from 'react';
import { useAppStore } from '../store';
import { ImportTransformationService } from '../services/importTransformationService';
import { telemetryService } from '../services/telemetryService';
import { buildVirtualCatalog, isVirtualStableId } from '../services/chapterCatalog';
import type { ChapterSummary } from '../types';
import { debugLog } from '../utils/debug';

// Prefer a human-facing number if the title contains "Chapter 147", "Ch 147", etc.
const numberFromTitle = (s?: string): number | undefined => {
  if (!s) return undefined;
  const m = s.match(/\b(?:Ch(?:apter)?\.?\s*)(\d{1,5})\b/i);
  return m ? parseInt(m[1], 10) : undefined;
};

/**
 * Returns true if the title already begins with "Chapter N" or "Ch N"
 * (case-insensitive), so we don't prepend a redundant "Ch N: " prefix.
 */
const titleAlreadyStartsWithNumber = (title: string, chapterNumber: number): boolean => {
  const escapedNumber = String(chapterNumber).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`^\\s*(?:Ch(?:apter)?\\.?\\s*)${escapedNumber}(?:\\b|\\s*[:\\-–—])`, 'i');
  return pattern.test(title);
};

/**
 * Strips internally-duplicated titles.
 * Scrapers sometimes produce "Chapter 304: Foggy Booth Chapter 304: Foggy Booth"
 * where the entire "Chapter N: Name" is repeated. This detects and removes the repeat.
 */
const deduplicateTitle = (title: string): string => {
  const trimmed = title.trim();
  const len = trimmed.length;
  if (len < 6) return trimmed;

  // Try splitting at each space near the midpoint to find a repeated half
  const mid = Math.floor(len / 2);
  // Search a window around the midpoint for a space
  for (let offset = 0; offset <= 10; offset++) {
    for (const delta of [offset, -offset]) {
      const pos = mid + delta;
      if (pos <= 0 || pos >= len - 1) continue;
      if (trimmed[pos] !== ' ') continue;
      const left = trimmed.slice(0, pos);
      const right = trimmed.slice(pos + 1);
      if (left === right) return left;
    }
  }

  return trimmed;
};

/**
 * Builds the display label for a chapter in the dropdown.
 * If the title already starts with a chapter number reference, returns the title
 * as-is to avoid duplication like "Ch 5: Chapter 5: The Title".
 */
export const buildChapterDisplayLabel = (
  title: string,
  displayNumber: number | null
): string => {
  const cleanTitle = deduplicateTitle(title);

  if (displayNumber === null || displayNumber <= 0) {
    return cleanTitle;
  }

  if (titleAlreadyStartsWithNumber(cleanTitle, displayNumber)) {
    return cleanTitle;
  }

  return `Ch ${displayNumber}: ${cleanTitle}`;
};

const getTimestamp = () =>
  typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();

export interface ChapterDropdownOption extends ChapterSummary {
  // Display label computed from merged data
  displayLabel: string;
  // Display number for sorting
  displayNumber: number | null;
}

export interface UseChapterDropdownOptionsResult {
  options: ChapterDropdownOption[];
  isLoading: boolean;
  isEmpty: boolean;
}

/**
 * Hook to get chapter dropdown options with merged data from IndexedDB and store.
 */
export function useChapterDropdownOptions(): UseChapterDropdownOptionsResult {
  const chapters = useAppStore(s => s.chapters);
  const activeNovelId = useAppStore(s => s.activeNovelId);
  const activeVersionId = useAppStore(s => s.activeVersionId);
  const [options, setOptions] = useState<ChapterDropdownOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const loadStart = getTimestamp();
    let resolvedCount = 0;

    (async () => {
      try {
        setIsLoading(true);

        const matchesScope = (chapter: {
          novelId?: string | null;
          libraryVersionId?: string | null;
        }): boolean => {
          if (!activeNovelId) {
            return true;
          }

          return (
            (chapter.novelId ?? null) === activeNovelId &&
            (chapter.libraryVersionId ?? null) === (activeVersionId ?? null)
          );
        };

        // 1. Build a virtual catalog from the registry (full novel range).
        // Without this the dropdown only shows chapters that have ever been
        // ingested into IDB, which for a 3500-chapter novel where the user
        // has visited 13 means a 13-row dropdown — defeats the purpose.
        // Virtual entries are placeholders; clicking one triggers the existing
        // handleNavigate(canonicalUrl) fetch path.
        const virtualEntries = activeNovelId
          ? await buildVirtualCatalog(activeNovelId, activeVersionId ?? null).catch((error) => {
              console.warn('[Dropdown] virtual catalog fetch failed; falling back to IDB-only', error);
              return [] as ChapterSummary[];
            })
          : [];
        if (cancelled) return;

        // 2. Load summaries from IndexedDB for the active library scope.
        // Ephemeral/manual sessions without an active novel rely on in-memory chapters only.
        const summaries = activeNovelId
          ? await ImportTransformationService.getChapterSummariesByScope(activeNovelId, activeVersionId ?? null)
          : [];
        if (cancelled) return;

        debugLog('ui', 'summary', '[Dropdown] scoped summaries loaded', {
          activeNovelId: activeNovelId ?? null,
          activeVersionId: activeVersionId ?? null,
          virtualCount: virtualEntries.length,
          realSummaryCount: summaries.length,
          summaryStableIds: summaries.map((summary) => summary.stableId),
        });

        // 3. Build a map for merging.
        //   Layer order (lowest to highest precedence):
        //     a. virtual catalog (placeholder for every chapter in range)
        //     b. real IDB summaries (real titles, hasTranslation, etc.)
        //     c. in-memory chapters (freshest data, handled below)
        //   Virtual entries with a real counterpart at the same chapterNumber
        //   are dropped at the end so the dropdown shows one row per chapter.
        const byId = new Map<string, ChapterSummary>();
        virtualEntries.forEach(entry => byId.set(entry.stableId, { ...entry }));
        summaries.forEach(summary => byId.set(summary.stableId, { ...summary }));

        const inMemoryDiagnostics = Array.from(chapters.entries()).map(([stableId, chapter]) => ({
          stableId,
          chapterNumber: chapter.chapterNumber ?? null,
          canonicalUrl: (chapter as any).canonicalUrl || null,
          originalUrl: chapter.originalUrl || null,
          title: chapter.title || null,
          translatedTitle: chapter.translationResult?.translatedTitle || null,
          hasTranslation: Boolean(chapter.translationResult),
        }));

        // 3. Merge with store data (store takes precedence)
        if (chapters.size > 0) {
          const consideredInMemoryStableIds: string[] = [];
          const skippedInMemoryStableIds: string[] = [];
          for (const [stableId, ch] of chapters.entries()) {
            if (!matchesScope(ch)) {
              skippedInMemoryStableIds.push(stableId);
              continue;
            }

            consideredInMemoryStableIds.push(stableId);

            const existing = byId.get(stableId);
            const candidate: ChapterSummary = existing
              ? { ...existing }
              : {
                  stableId,
                  canonicalUrl: (ch as any).canonicalUrl || ch.originalUrl,
                  title: ch.title || 'Untitled Chapter',
                  translatedTitle: ch.translationResult?.translatedTitle || undefined,
                  chapterNumber: ch.chapterNumber,
                  hasTranslation: Boolean(ch.translationResult),
                  hasImages: Boolean(
                    ch.translationResult?.suggestedIllustrations?.some(
                      (ill: any) => !!ill?.url || !!ill?.generatedImage
                    )
                  ),
                  lastAccessed: undefined,
                  lastTranslatedAt: undefined,
                };

            // Store data overrides IndexedDB data
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
              const hasImages =
                ch.translationResult.suggestedIllustrations?.some(
                  (ill: any) => !!ill?.url || !!ill?.generatedImage
                ) || false;
              candidate.hasImages = candidate.hasImages || hasImages;
              candidate.lastTranslatedAt =
                candidate.lastTranslatedAt || new Date().toISOString();
            }

            byId.set(stableId, candidate);
          }

          debugLog('ui', 'summary', '[Dropdown] in-memory merge', {
            activeNovelId: activeNovelId ?? null,
            activeVersionId: activeVersionId ?? null,
            consideredInMemoryStableIds,
            skippedInMemoryStableIds,
            reintroducedFromMemoryStableIds: consideredInMemoryStableIds.filter(
              (stableId) => !summaries.some((summary) => summary.stableId === stableId)
            ),
          });
        }

        // 3a. Dedupe: when a real summary or in-memory chapter exists for the
        // same chapterNumber as a virtual placeholder, drop the placeholder
        // (real data wins). This prevents the dropdown from showing both
        // "Chapter 339" virtual and "Chapter 339 — First-degree State of War"
        // real on the same row.
        const realByNumber = new Map<number, string[]>();
        for (const entry of byId.values()) {
          if (typeof entry.chapterNumber !== 'number') continue;
          if (isVirtualStableId(entry.stableId)) continue;
          const list = realByNumber.get(entry.chapterNumber) ?? [];
          list.push(entry.stableId);
          realByNumber.set(entry.chapterNumber, list);
        }
        let droppedVirtuals = 0;
        for (const entry of [...byId.values()]) {
          if (
            isVirtualStableId(entry.stableId) &&
            typeof entry.chapterNumber === 'number' &&
            realByNumber.has(entry.chapterNumber)
          ) {
            byId.delete(entry.stableId);
            droppedVirtuals++;
          }
        }
        if (droppedVirtuals > 0) {
          debugLog('ui', 'full', '[Dropdown] dedupe dropped virtual placeholders', {
            droppedVirtuals,
          });
        }

        // 4. Convert to array and compute display values
        const list = Array.from(byId.values()).map((summary): ChapterDropdownOption => {
          const titleNum = numberFromTitle(summary.translatedTitle);
          const dbNum = summary.chapterNumber as number | undefined;
          const displayNumber = titleNum ?? dbNum ?? null;

          const title = summary.translatedTitle || summary.title || 'Untitled Chapter';
          const displayLabel = buildChapterDisplayLabel(title, displayNumber);

          return {
            ...summary,
            displayLabel,
            displayNumber,
          };
        });

        // 5. Sort by display number, then by title
        list.sort((a, b) => {
          const aNum = a.displayNumber ?? Number.POSITIVE_INFINITY;
          const bNum = b.displayNumber ?? Number.POSITIVE_INFINITY;
          if (aNum !== bNum) return aNum - bNum;
          return (a.title || '').localeCompare(b.title || '');
        });

        resolvedCount = list.length;
        const duplicateNumberGroups = new Map<number, string[]>();
        list.forEach((entry) => {
          if (typeof entry.chapterNumber !== 'number') return;
          const existing = duplicateNumberGroups.get(entry.chapterNumber) || [];
          existing.push(entry.stableId);
          duplicateNumberGroups.set(entry.chapterNumber, existing);
        });

        // Combined diagnostics: HEAD's duplicate-detection + Codex's scope tracking.
        // Both serve different debugging needs — keep both.
        debugLog('ui', 'summary', '[Dropdown] diagnostics', {
          activeNovelId: activeNovelId ?? null,
          activeVersionId: activeVersionId ?? null,
          summaryStableIds: summaries.map((summary) => summary.stableId),
          inMemoryDiagnostics,
          finalOptions: list.map((entry) => ({
            stableId: entry.stableId,
            chapterNumber: entry.chapterNumber ?? null,
            canonicalUrl: entry.canonicalUrl ?? null,
            title: entry.title ?? null,
            translatedTitle: entry.translatedTitle ?? null,
            displayLabel: entry.displayLabel,
          })),
          duplicateNumberGroups: Array.from(duplicateNumberGroups.entries())
            .filter(([, stableIds]) => stableIds.length > 1)
            .map(([chapterNumber, stableIds]) => ({ chapterNumber, stableIds })),
        });
        setOptions(list);
      } catch (error) {
        if (!cancelled) {
          console.error('[useChapterDropdownOptions] Failed to load chapters:', error);
          setOptions([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
          telemetryService.capturePerformance(
            'ux:hook:useChapterDropdownOptions:load',
            getTimestamp() - loadStart,
            {
              resultCount: resolvedCount,
              chaptersInStore: chapters.size,
            }
          );
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [chapters, activeNovelId, activeVersionId]);

  return {
    options,
    isLoading,
    isEmpty: options.length === 0,
  };
}

export default useChapterDropdownOptions;

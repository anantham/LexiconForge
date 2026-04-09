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
  const [options, setOptions] = useState<ChapterDropdownOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const loadStart = getTimestamp();
    let resolvedCount = 0;

    (async () => {
      try {
        setIsLoading(true);

        // 1. Load summaries from IndexedDB
        const summaries = await ImportTransformationService.getChapterSummaries();
        if (cancelled) return;

        // 2. Build a map for merging
        const byId = new Map<string, ChapterSummary>();
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
          for (const [stableId, ch] of chapters.entries()) {
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

          // 3a. Filter to only chapters loaded for the current novel.
          // Without this, IDB summaries from previously opened novels
          // pollute the dropdown when switching books.
          for (const key of byId.keys()) {
            if (!chapters.has(key)) {
              byId.delete(key);
            }
          }
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

        debugLog('ui', 'summary', '[Dropdown] diagnostics', {
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
  }, [chapters]);

  return {
    options,
    isLoading,
    isEmpty: options.length === 0,
  };
}

export default useChapterDropdownOptions;

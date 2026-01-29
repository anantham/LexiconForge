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

// Prefer a human-facing number if the title contains "Chapter 147", "Ch 147", etc.
const numberFromTitle = (s?: string): number | undefined => {
  if (!s) return undefined;
  const m = s.match(/\b(?:Ch(?:apter)?\.?\s*)(\d{1,5})\b/i);
  return m ? parseInt(m[1], 10) : undefined;
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
        }

        // 4. Convert to array and compute display values
        const list = Array.from(byId.values()).map((summary): ChapterDropdownOption => {
          const titleNum = numberFromTitle(summary.translatedTitle);
          const dbNum = summary.chapterNumber as number | undefined;
          const displayNumber = titleNum ?? dbNum ?? null;

          const numPrefix =
            displayNumber !== null && displayNumber > 0 ? `Ch ${displayNumber}: ` : '';
          const title = summary.translatedTitle || summary.title || 'Untitled Chapter';
          const displayLabel = `${numPrefix}${title}`;

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

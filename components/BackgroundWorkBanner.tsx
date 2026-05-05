/**
 * BackgroundWorkBanner — surfaces in-flight translations for chapters the
 * user is NOT currently viewing.
 *
 * Per CORE-012 Q4 ratification:
 *   - Toggle on the active translate button is the cancel surface for the
 *     CURRENT chapter (visible inline).
 *   - This banner is the cancel surface for BACKGROUND chapters (the work
 *     the user can't perceive otherwise).
 *
 * v1: name + count + click-to-navigate. No Cancel-by-default. A "Stop"
 * affordance can land in v2 behind an overflow menu.
 *
 * See: issues/19-translation-survives-nav-policy/README.md
 *      issues/_themes/proposed-adrs/CORE-012-background-work-survives-navigation.md
 */

import React from 'react';
import { Loader2 } from 'lucide-react';
import { useAppStore } from '../store';

const truncate = (s: string, n: number) =>
  s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s;

const BackgroundWorkBanner: React.FC = () => {
  const pendingTranslations = useAppStore((s) => s.pendingTranslations);
  const currentChapterId = useAppStore((s) => s.currentChapterId);
  const chapters = useAppStore((s) => s.chapters);
  const setCurrentChapter = useAppStore((s) => s.setCurrentChapter);

  // Compute background work: pending translations whose chapter isn't current
  const backgroundIds = React.useMemo(() => {
    if (!pendingTranslations || pendingTranslations.size === 0) return [];
    return [...pendingTranslations].filter((id) => id !== currentChapterId);
  }, [pendingTranslations, currentChapterId]);

  if (backgroundIds.length === 0) return null;

  const firstId = backgroundIds[0];
  const firstChapter = chapters?.get?.(firstId) as any;
  const firstTitle =
    firstChapter?.translationResult?.translatedTitle ||
    firstChapter?.title ||
    firstId;
  const more = backgroundIds.length - 1;

  return (
    <div
      className="fixed bottom-4 right-4 z-40 max-w-xs"
      role="status"
      aria-live="polite"
    >
      <button
        type="button"
        onClick={() => setCurrentChapter(firstId)}
        className="flex w-full items-center gap-2 rounded-lg border border-sky-300 bg-sky-50 px-3 py-2 text-sm text-sky-900 shadow-md transition hover:bg-sky-100 dark:border-sky-700 dark:bg-sky-950/80 dark:text-sky-100 dark:hover:bg-sky-900/80"
        title={
          more > 0
            ? `${backgroundIds.length} background translations in flight. Click to jump to "${firstTitle}".`
            : `Translating "${firstTitle}" in the background. Click to jump to it.`
        }
      >
        <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
        <span className="flex-1 text-left">
          <span className="font-medium">
            Translating "{truncate(firstTitle, 40)}"
          </span>
          {more > 0 && (
            <span className="ml-1 text-xs opacity-75">
              +{more} more
            </span>
          )}
        </span>
      </button>
    </div>
  );
};

export default BackgroundWorkBanner;

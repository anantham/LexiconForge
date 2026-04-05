/**
 * Auto-Translate Mediator
 *
 * Single owner of the "should we auto-translate?" decision.
 * Replaces three independent triggers that raced with each other:
 *   1. chaptersSlice post-hydration inline check (removed)
 *   2. ChapterView useEffect (removed in 17141dd)
 *   3. preload worker (kept — different concern: adjacent chapters)
 *
 * This subscriber watches the store for state changes that could require
 * auto-translation and applies a single policy function to decide.
 *
 * Trigger conditions (ANY of these changing can trigger evaluation):
 *   - currentChapterId changes (navigation)
 *   - viewMode changes (user switches to 'english')
 *   - current chapter's translationResult changes (hydration completes)
 *   - current chapter's hydrating state clears
 */

import type { StoreState } from './storeTypes';

interface AutoTranslateSnapshot {
  currentChapterId: string | null;
  viewMode: string;
  hasTranslation: boolean;
  isHydrating: boolean;
  isTranslationActive: boolean;
  isPending: boolean;
}

function deriveSnapshot(state: StoreState): AutoTranslateSnapshot {
  const s = state as any;
  const chapterId = s.currentChapterId ?? null;
  const chapter = chapterId ? s.chapters?.get?.(chapterId) : null;
  return {
    currentChapterId: chapterId,
    viewMode: s.viewMode ?? 'original',
    hasTranslation: !!chapter?.translationResult,
    isHydrating: chapterId ? !!s.hydratingChapters?.[chapterId] : false,
    isTranslationActive: chapterId ? !!s.isTranslationActive?.(chapterId) : false,
    isPending: chapterId ? !!s.pendingTranslations?.has?.(chapterId) : false,
  };
}

function shouldAutoTranslate(snap: AutoTranslateSnapshot): boolean {
  return (
    snap.viewMode === 'english' &&
    !!snap.currentChapterId &&
    !snap.hasTranslation &&
    !snap.isHydrating &&
    !snap.isTranslationActive &&
    !snap.isPending
  );
}

/**
 * Call once after store is created. Returns an unsubscribe function.
 */
export function setupAutoTranslateMediator(
  subscribe: (listener: (state: StoreState, prev: StoreState) => void) => () => void,
  getState: () => StoreState
): () => void {
  let prev = deriveSnapshot(getState());

  return subscribe((state, _prevState) => {
    const curr = deriveSnapshot(state);

    // Only evaluate if something relevant changed
    const changed =
      curr.currentChapterId !== prev.currentChapterId ||
      curr.viewMode !== prev.viewMode ||
      curr.hasTranslation !== prev.hasTranslation ||
      curr.isHydrating !== prev.isHydrating;

    prev = curr;
    if (!changed) return;

    if (shouldAutoTranslate(curr)) {
      console.log(`[AutoTranslateMediator] ✅ Triggering auto-translate for ${curr.currentChapterId}`);
      const s = state as any;
      if (typeof s.handleTranslate === 'function') {
        void s.handleTranslate(curr.currentChapterId, 'auto_translate');
      }
    } else if (curr.viewMode === 'english' && curr.currentChapterId && curr.hasTranslation) {
      console.log(`[AutoTranslateMediator] Translation already cached for ${curr.currentChapterId}`);
    }
  });
}

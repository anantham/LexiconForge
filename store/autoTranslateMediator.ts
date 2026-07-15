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

  /**
   * Chapters this mediator has already auto-triggered, so it never does so twice.
   *
   * Auto-translate is a PAID call, and nothing else stops a repeat: after a failed attempt the
   * chapter still has no translation, so shouldAutoTranslate() is true again, and any later
   * change to the watched state — the user toggling viewMode back to 'english', hydration
   * flapping — would fire another billed request, indefinitely.
   *
   * The suppression used to live in MainApp and was dropped when the decision moved here; the
   * test that covered it was skipped with a note that a focused mediator test should replace it
   * (tests/store/appScreen.integration.test.tsx). This is that guard, and
   * tests/store/autoTranslateMediator.test.ts is that test.
   *
   * A manual retranslate does not go through the mediator, so the user can always retry.
   */
  const autoTriggered = new Set<string>();

  return subscribe((state, _prevState) => {
    const curr = deriveSnapshot(state);

    // Only evaluate if something relevant changed. isPending/isTranslationActive belong here:
    // shouldAutoTranslate() reads them, so a chapter skipped *because* a translation was already
    // in flight was never re-evaluated once that cleared, and could be left permanently
    // untranslated. Watching them is only safe because of the autoTriggered guard above — it is
    // what keeps a released pending flag from immediately re-firing a failed translation.
    const changed =
      curr.currentChapterId !== prev.currentChapterId ||
      curr.viewMode !== prev.viewMode ||
      curr.hasTranslation !== prev.hasTranslation ||
      curr.isHydrating !== prev.isHydrating ||
      curr.isTranslationActive !== prev.isTranslationActive ||
      curr.isPending !== prev.isPending;

    prev = curr;
    if (!changed) return;

    console.log(`[AutoTranslateMediator] State change detected`, {
      chapterId: curr.currentChapterId,
      viewMode: curr.viewMode,
      hasTranslation: curr.hasTranslation,
      isHydrating: curr.isHydrating,
      isTranslationActive: curr.isTranslationActive,
      isPending: curr.isPending,
    });

    if (shouldAutoTranslate(curr)) {
      const chapterId = curr.currentChapterId!;
      if (autoTriggered.has(chapterId)) {
        console.log(`[AutoTranslateMediator] ⏸ Already auto-translated ${chapterId} this session; not retrying`);
        return;
      }
      console.log(`[AutoTranslateMediator] ✅ Triggering auto-translate for ${chapterId}`);
      const s = state as any;
      if (typeof s.handleTranslate === 'function') {
        autoTriggered.add(chapterId);
        void s.handleTranslate(chapterId, 'auto_visit');
      }
    } else if (curr.viewMode === 'english' && curr.currentChapterId) {
      if (curr.hasTranslation) {
        console.log(`[AutoTranslateMediator] Translation already cached for ${curr.currentChapterId}`);
      } else {
        console.log(`[AutoTranslateMediator] ⏸ Skipped auto-translate for ${curr.currentChapterId}`, {
          isHydrating: curr.isHydrating,
          isTranslationActive: curr.isTranslationActive,
          isPending: curr.isPending,
        });
      }
    }
  });
}

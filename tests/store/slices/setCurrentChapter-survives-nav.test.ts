/**
 * Regression tests for issue #19 (translation-survives-nav-policy)
 *
 * Pre-fix behavior (Shape B): setCurrentChapter calls cancelTranslation(prevId)
 * on every navigation, killing in-flight translations and dropping LLM work.
 *
 * Post-fix behavior: SPA navigation does NOT cancel in-flight translations.
 * Cancellation is explicit-only (toggle button, future "Stop all" affordance).
 *
 * See: issues/19-translation-survives-nav-policy/README.md
 *      docs/adr/CORE-012-background-work-survives-navigation.md
 */

import { describe, it, expect, vi } from 'vitest';
import { create } from 'zustand';
import { createChaptersSlice } from '../../../store/slices/chaptersSlice';

const createStore = () => {
  const cancelTranslation = vi.fn();
  const store = create<any>()((set, get, api) => ({
    ...createChaptersSlice(set as any, get as any, api as any),
    // Stub the cross-slice action that setCurrentChapter looks up via get()
    cancelTranslation,
    // Other cross-slice actions setCurrentChapter touches; no-op stubs
    setReaderReady: vi.fn(),
  }));
  return { store, cancelTranslation };
};

describe('chaptersSlice — setCurrentChapter does not cancel in-flight translation on nav', () => {
  it('does NOT call cancelTranslation when navigating from one chapter to another', () => {
    const { store, cancelTranslation } = createStore();

    // Establish "we're on chapter A"
    store.setState({ currentChapterId: 'chapter-A' });

    // Navigate to chapter B (simulates SPA nav while translation A may be in flight)
    store.getState().setCurrentChapter('chapter-B');

    // The whole point of issue #19: nav must NOT cancel work for prevChapterId
    expect(cancelTranslation).not.toHaveBeenCalled();
    expect(store.getState().currentChapterId).toBe('chapter-B');
  });

  it('does NOT call cancelTranslation when navigating to null (e.g., back to library)', () => {
    const { store, cancelTranslation } = createStore();

    store.setState({ currentChapterId: 'chapter-A' });
    store.getState().setCurrentChapter(null);

    expect(cancelTranslation).not.toHaveBeenCalled();
    expect(store.getState().currentChapterId).toBeNull();
  });

  it('does NOT call cancelTranslation when navigating from null to a chapter (initial load)', () => {
    const { store, cancelTranslation } = createStore();

    // currentChapterId starts null (initial state)
    store.getState().setCurrentChapter('chapter-A');

    expect(cancelTranslation).not.toHaveBeenCalled();
    expect(store.getState().currentChapterId).toBe('chapter-A');
  });

  it('does NOT call cancelTranslation when re-selecting the same chapter (no-op nav)', () => {
    const { store, cancelTranslation } = createStore();

    store.setState({ currentChapterId: 'chapter-A' });
    store.getState().setCurrentChapter('chapter-A');

    expect(cancelTranslation).not.toHaveBeenCalled();
  });
});

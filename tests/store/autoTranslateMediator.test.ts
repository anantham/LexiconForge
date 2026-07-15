import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setupAutoTranslateMediator } from '../../store/autoTranslateMediator';

/**
 * The focused mediator test that tests/store/appScreen.integration.test.tsx's skipped
 * "does not auto-retry the same chapter after an unexpected auto-translate failure" asked for.
 * That suppression used to live in MainApp and was lost when the decision moved to the mediator.
 */

type Listener = (state: any, prev: any) => void;

/** A minimal stand-in for the zustand store: just enough surface for deriveSnapshot. */
const makeStore = (initial: Partial<any> = {}) => {
  let listener: Listener | null = null;
  const handleTranslate = vi.fn();

  const state: any = {
    currentChapterId: 'ch-1',
    viewMode: 'english',
    chapters: new Map<string, any>([['ch-1', {}]]), // present, but no translationResult
    hydratingChapters: {},
    pendingTranslations: new Set<string>(),
    isTranslationActive: (id: string) => state._active.has(id),
    _active: new Set<string>(),
    handleTranslate,
    ...initial,
  };

  const subscribe = (l: Listener) => { listener = l; return () => { listener = null; }; };
  const getState = () => state;

  /** Apply a state change and notify the mediator, the way zustand would. */
  const update = (patch: (s: any) => void) => {
    patch(state);
    listener?.(state, state);
  };

  return { state, subscribe, getState, update, handleTranslate };
};

describe('autoTranslateMediator', () => {
  beforeEach(() => { vi.spyOn(console, 'log').mockImplementation(() => {}); });

  it('auto-translates a visible, untranslated chapter once', () => {
    const store = makeStore({ viewMode: 'original' });
    setupAutoTranslateMediator(store.subscribe as any, store.getState as any);

    store.update(s => { s.viewMode = 'english'; });

    expect(store.handleTranslate).toHaveBeenCalledTimes(1);
    expect(store.handleTranslate).toHaveBeenCalledWith('ch-1', 'auto_visit');
  });

  it('does NOT auto-retry a chapter whose translation failed', () => {
    // The failure path leaves the chapter with no translation and clears pending — so
    // shouldAutoTranslate() is true all over again. Without a guard, every later state change
    // (a viewMode toggle, hydration flapping) fires another PAID request, forever.
    const store = makeStore({ viewMode: 'original' });
    setupAutoTranslateMediator(store.subscribe as any, store.getState as any);

    store.update(s => { s.viewMode = 'english'; });
    expect(store.handleTranslate).toHaveBeenCalledTimes(1);

    // Translation starts, then fails: pending is set and released, no translationResult lands.
    store.update(s => { s.pendingTranslations = new Set(['ch-1']); });
    store.update(s => { s.pendingTranslations = new Set(); });

    // User toggles away and back — the classic re-trigger.
    store.update(s => { s.viewMode = 'original'; });
    store.update(s => { s.viewMode = 'english'; });

    // Hydration flaps.
    store.update(s => { s.hydratingChapters = { 'ch-1': true }; });
    store.update(s => { s.hydratingChapters = {}; });

    expect(store.handleTranslate).toHaveBeenCalledTimes(1);
  });

  it('re-evaluates once an in-flight translation clears, instead of skipping forever', () => {
    // The `changed` gate did not watch isPending, so a chapter skipped BECAUSE something else was
    // already translating it was never reconsidered when that finished — and if that other
    // attempt produced no translation, the chapter stayed untranslated with nothing to wake it.
    const store = makeStore({
      viewMode: 'english',
      pendingTranslations: new Set(['ch-1']),
    });
    setupAutoTranslateMediator(store.subscribe as any, store.getState as any);

    // Something else was mid-flight, so the mediator must not fire.
    store.update(s => { s.hydratingChapters = {}; });
    expect(store.handleTranslate).not.toHaveBeenCalled();

    // That attempt clears without producing a translation. This must wake the mediator.
    store.update(s => { s.pendingTranslations = new Set(); });

    expect(store.handleTranslate).toHaveBeenCalledTimes(1);
  });

  it('does not auto-translate a chapter that already has a translation', () => {
    const store = makeStore({
      viewMode: 'original',
      chapters: new Map([['ch-1', { translationResult: { translation: 'done' } }]]),
    });
    setupAutoTranslateMediator(store.subscribe as any, store.getState as any);

    store.update(s => { s.viewMode = 'english'; });

    expect(store.handleTranslate).not.toHaveBeenCalled();
  });

  it('still auto-translates a DIFFERENT chapter after one has been attempted', () => {
    const store = makeStore({ viewMode: 'original' });
    setupAutoTranslateMediator(store.subscribe as any, store.getState as any);

    store.update(s => { s.viewMode = 'english'; });
    expect(store.handleTranslate).toHaveBeenCalledTimes(1);

    store.update(s => {
      s.currentChapterId = 'ch-2';
      s.chapters = new Map([['ch-2', {}]]);
    });

    expect(store.handleTranslate).toHaveBeenCalledTimes(2);
    expect(store.handleTranslate).toHaveBeenLastCalledWith('ch-2', 'auto_visit');
  });
});

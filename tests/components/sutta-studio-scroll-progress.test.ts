import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Mock IntersectionObserver as a class (must be constructable with `new`)
let observerCallback: IntersectionObserverCallback;
let observedElements: Element[] = [];
const disconnectSpy = vi.fn();
const observeSpy = vi.fn((el: Element) => observedElements.push(el));

class MockIntersectionObserver {
  constructor(callback: IntersectionObserverCallback) {
    observerCallback = callback;
  }
  observe = observeSpy;
  unobserve = vi.fn();
  disconnect = disconnectSpy;
  readonly root = null;
  readonly rootMargin = '';
  readonly thresholds = [] as number[];
  takeRecords = () => [] as IntersectionObserverEntry[];
}

vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);

// Import after mock is installed
import { useScrollProgress } from '../../components/sutta-studio/hooks/useScrollProgress';

describe('useScrollProgress', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    observedElements = [];
    observeSpy.mockClear();
    disconnectSpy.mockClear();

    container = document.createElement('div');

    // Create phase elements in the DOM
    ['phase-1', 'phase-2', 'phase-3'].forEach((id) => {
      const el = document.createElement('section');
      el.id = id;
      container.appendChild(el);
    });
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (container.parentNode) {
      document.body.removeChild(container);
    }
  });

  it('initializes with index 0 and not visible', () => {
    const ref = { current: container };
    const { result } = renderHook(() =>
      useScrollProgress(['phase-1', 'phase-2', 'phase-3'], ref)
    );

    expect(result.current.currentIndex).toBe(0);
    expect(result.current.total).toBe(3);
    expect(result.current.visible).toBe(false);
  });

  it('observes all phase elements', () => {
    const ref = { current: container };
    renderHook(() => useScrollProgress(['phase-1', 'phase-2', 'phase-3'], ref));

    expect(observeSpy).toHaveBeenCalledTimes(3);
    expect(observedElements.map((el) => el.id)).toEqual(['phase-1', 'phase-2', 'phase-3']);
  });

  it('updates currentIndex when intersection changes', () => {
    const ref = { current: container };
    const { result } = renderHook(() =>
      useScrollProgress(['phase-1', 'phase-2', 'phase-3'], ref)
    );

    // Simulate phase-2 becoming most visible
    act(() => {
      observerCallback(
        [
          { target: { id: 'phase-1' }, intersectionRatio: 0.1 } as unknown as IntersectionObserverEntry,
          { target: { id: 'phase-2' }, intersectionRatio: 0.8 } as unknown as IntersectionObserverEntry,
        ],
        {} as IntersectionObserver
      );
    });

    expect(result.current.currentIndex).toBe(1);
  });

  it('becomes visible on scroll and hides after timeout', () => {
    vi.useFakeTimers();
    const ref = { current: container };
    const { result } = renderHook(() =>
      useScrollProgress(['phase-1', 'phase-2'], ref)
    );

    expect(result.current.visible).toBe(false);

    // Simulate scroll event
    act(() => {
      container.dispatchEvent(new Event('scroll'));
    });

    expect(result.current.visible).toBe(true);

    // After 1.5s it should auto-hide
    act(() => {
      vi.advanceTimersByTime(1500);
    });

    expect(result.current.visible).toBe(false);
    vi.useRealTimers();
  });

  it('resets hide timer on subsequent scrolls', () => {
    vi.useFakeTimers();
    const ref = { current: container };
    const { result } = renderHook(() =>
      useScrollProgress(['phase-1', 'phase-2'], ref)
    );

    act(() => {
      container.dispatchEvent(new Event('scroll'));
    });
    expect(result.current.visible).toBe(true);

    // Scroll again after 1s (before the 1.5s timeout)
    act(() => {
      vi.advanceTimersByTime(1000);
      container.dispatchEvent(new Event('scroll'));
    });
    expect(result.current.visible).toBe(true);

    // After another 1s (only 1s since last scroll, not 1.5s)
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.visible).toBe(true);

    // After the full 1.5s from last scroll
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current.visible).toBe(false);

    vi.useRealTimers();
  });

  it('disconnects observer on unmount', () => {
    const ref = { current: container };
    const { unmount } = renderHook(() =>
      useScrollProgress(['phase-1'], ref)
    );

    unmount();
    expect(disconnectSpy).toHaveBeenCalled();
  });

  it('returns total matching phaseIds length', () => {
    const ref = { current: container };
    const { result } = renderHook(() =>
      useScrollProgress(['phase-1', 'phase-2', 'phase-3'], ref)
    );

    expect(result.current.total).toBe(3);
  });

  it('handles empty phaseIds', () => {
    const ref = { current: container };
    const { result } = renderHook(() => useScrollProgress([], ref));

    expect(result.current.currentIndex).toBe(0);
    expect(result.current.total).toBe(0);
  });
});

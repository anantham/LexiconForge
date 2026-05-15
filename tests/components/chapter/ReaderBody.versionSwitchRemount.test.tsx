/**
 * Regression test for issue #16 — version-switch-comments-vanish.
 *
 * Bug: ReaderBody rendered <InlineCommentMarkers feedback={feedbackForChapter} ...>
 * without a `key` derived from the active translation. When the user switched
 * translation versions, `setActiveTranslationVersion` did `updateChapter({
 * translationResult })` which left `chapter.feedback` reference unchanged. So
 * InlineCommentMarkers' useCallback(computePositions, [feedback, contentRef])
 * kept the same callback identity; its useEffect did NOT re-fire; `positions`
 * stayed pointing at coordinates of the OLD translation's text. Markers then
 * vanished on the next unrelated trigger (resize, StrictMode re-render).
 *
 * Fix (commit landing this test): added
 *   key={translationResult?.id ?? translationResult?.version ?? 'default'}
 * to <InlineCommentMarkers> in ReaderBody so React force-remounts the markers
 * on translation switch. Fresh mount = fresh useEffect = positions recomputed
 * against the new DOM.
 *
 * This test mocks InlineCommentMarkers with a mount-counter to detect remount.
 * On unfixed code (no key prop), the mount counter is called once per render
 * lifecycle (no remount). On fixed code, it's called twice — once per distinct
 * translation key.
 *
 * See: issues/16-version-switch-comments-vanish/README.md §5.
 */
import React, { createRef } from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import ReaderBody from '../../../components/chapter/ReaderBody';
import type { FeedbackItem } from '../../../types';

// Capture every mount of InlineCommentMarkers.
const mountSpy = vi.fn();
const unmountSpy = vi.fn();

vi.mock('../../../components/chapter/InlineCommentMarkers', () => ({
  __esModule: true,
  default: () => {
    React.useEffect(() => {
      mountSpy();
      return () => unmountSpy();
    }, []);
    return <div data-testid="inline-comment-markers" />;
  },
}));

// Stub heavy/store-dependent siblings so ReaderBody renders in isolation.
vi.mock('../../../components/chapter/ChapterContent', () => ({
  __esModule: true,
  default: () => <div data-testid="chapter-content" />,
}));
vi.mock('../../../components/chapter/FootnotesPanel', () => ({
  __esModule: true,
  default: () => null,
}));
vi.mock('../../../components/chapter/ReaderFeedbackPanel', () => ({
  __esModule: true,
  default: () => null,
}));
vi.mock('../../../components/chapter/ChapterSelectionOverlay', () => ({
  __esModule: true,
  default: () => null,
}));
vi.mock('../../../components/chapter/ComparisonPortal', () => ({
  __esModule: true,
  default: () => null,
}));
vi.mock('../../../components/chapter/FooterNavigation', () => ({
  __esModule: true,
  default: () => null,
}));
vi.mock('../../../components/AudioPlayer', () => ({
  __esModule: true,
  default: () => null,
}));

// Stub the Zustand store hook used in ReaderBody for showInlineComments + audio.
vi.mock('../../../store', () => ({
  useAppStore: (selector: (s: any) => any) =>
    selector({ settings: { showInlineComments: true, enableAudio: false } }),
}));

const feedback: FeedbackItem[] = [
  {
    id: 'fb-1',
    selection: 'hello world',
    type: '👍',
    comment: 'great',
    timestamp: 0,
  } as any,
];

const baseProps = (overrides: any = {}) => ({
  chapter: { id: 'ch1' } as any,
  viewMode: 'english' as const,
  feedbackForChapter: feedback, // SAME reference across re-renders — this is the bug shape
  selection: null,
  isTouch: false,
  inlineEditActive: false,
  canCompare: false,
  comparisonLoading: false,
  beginInlineEdit: () => {},
  handleCompareRequest: () => {},
  handleFeedbackSubmit: () => {},
  clearSelection: () => {},
  viewRef: createRef<HTMLDivElement>(),
  chapterContentProps: { contentRef: createRef<HTMLDivElement>() } as any,
  comparisonPortalProps: {} as any,
  footerProps: {} as any,
  audioProps: {} as any,
  onDeleteFeedback: () => {},
  onUpdateFeedback: () => {},
  onScrollToText: () => {},
  ...overrides,
});

describe('ReaderBody — InlineCommentMarkers remount on translation switch (issue #16)', () => {
  beforeEach(() => {
    mountSpy.mockClear();
    unmountSpy.mockClear();
  });

  it('mounts InlineCommentMarkers once on initial render', () => {
    const trA = { id: 'trans-a', version: 1, translation: 'A body' };
    render(<ReaderBody {...(baseProps({ translationResult: trA }) as any)} />);
    expect(mountSpy).toHaveBeenCalledTimes(1);
  });

  it('REMOUNTS InlineCommentMarkers when translationResult.id changes (THE FIX)', () => {
    const trA = { id: 'trans-a', version: 1, translation: 'A body' };
    const trB = { id: 'trans-b', version: 2, translation: 'B body' };

    const { rerender } = render(
      <ReaderBody {...(baseProps({ translationResult: trA }) as any)} />,
    );
    expect(mountSpy).toHaveBeenCalledTimes(1);

    // Simulate translation switch: SAME feedback reference, NEW translationResult.
    // On unfixed code (no key prop on InlineCommentMarkers), React would reuse
    // the existing instance — mountSpy stays at 1. On fixed code, key changes
    // → React unmounts the old + mounts a new → mountSpy hits 2.
    rerender(<ReaderBody {...(baseProps({ translationResult: trB }) as any)} />);

    expect(unmountSpy).toHaveBeenCalledTimes(1);
    expect(mountSpy).toHaveBeenCalledTimes(2);
  });

  it('does NOT remount when translation reference stays the same (no regression)', () => {
    const trA = { id: 'trans-a', version: 1, translation: 'A body' };

    const { rerender } = render(
      <ReaderBody {...(baseProps({ translationResult: trA }) as any)} />,
    );
    expect(mountSpy).toHaveBeenCalledTimes(1);

    // Same translation, just a re-render (e.g., from an unrelated state change).
    rerender(<ReaderBody {...(baseProps({ translationResult: trA }) as any)} />);

    // Should stay at 1 mount — no spurious remounts on unrelated re-renders.
    expect(mountSpy).toHaveBeenCalledTimes(1);
    expect(unmountSpy).not.toHaveBeenCalled();
  });

  it('falls back to translationResult.version when .id is absent', () => {
    const trA = { version: 1, translation: 'A body' };
    const trB = { version: 2, translation: 'B body' };

    const { rerender } = render(
      <ReaderBody {...(baseProps({ translationResult: trA }) as any)} />,
    );
    expect(mountSpy).toHaveBeenCalledTimes(1);

    rerender(<ReaderBody {...(baseProps({ translationResult: trB }) as any)} />);

    expect(mountSpy).toHaveBeenCalledTimes(2);
  });
});

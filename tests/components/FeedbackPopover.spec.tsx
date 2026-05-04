/**
 * Regression test for issue #4 — portal/self-insert button must show
 * a pending visual state immediately on click.
 *
 * Pre-fix: clicking the button fires onSelfInsert with no visual change;
 *          users re-click thinking nothing happened (issue #4 verbatim).
 * Post-fix: button is disabled + shows spinner during in-flight handler.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { fireEvent } from '@testing-library/react';
import React from 'react';
import FeedbackPopover from '../../components/FeedbackPopover';

const makeRect = (): DOMRect => new DOMRect(100, 200, 80, 20);

const renderPopover = (overrides: Partial<React.ComponentProps<typeof FeedbackPopover>> = {}) => {
  const parent = document.createElement('div');
  document.body.appendChild(parent);
  const positioningParentRef = { current: parent };
  return render(
    <FeedbackPopover
      selectionText="some text"
      position={makeRect()}
      positioningParentRef={positioningParentRef}
      onFeedback={vi.fn()}
      onEdit={vi.fn()}
      onCompare={vi.fn()}
      canCompare={false}
      enableSillyTavern={true}
      onSelfInsert={vi.fn()}
      {...overrides}
    />
  );
};

describe('FeedbackPopover — portal button pending state (issue #4)', () => {
  it('renders the portal button when SillyTavern is enabled', () => {
    renderPopover();
    expect(screen.getByTestId('portal-self-insert-button')).toBeInTheDocument();
    expect(screen.getByTestId('portal-self-insert-button')).not.toBeDisabled();
  });

  it('does not render the portal button when SillyTavern is disabled', () => {
    renderPopover({ enableSillyTavern: false });
    expect(screen.queryByTestId('portal-self-insert-button')).not.toBeInTheDocument();
  });

  it('disables the button and shows a spinner immediately on click', async () => {
    let resolveSelfInsert: () => void = () => {};
    const onSelfInsert = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveSelfInsert = resolve;
        })
    );

    renderPopover({ onSelfInsert });
    const btn = screen.getByTestId('portal-self-insert-button');

    // Pre-click: not disabled, no spinner SVG with aria-label="Loading"
    expect(btn).not.toBeDisabled();
    expect(btn.querySelector('[aria-label="Loading"]')).toBeNull();

    // Click — triggers the async wrapper
    await act(async () => {
      fireEvent.click(btn);
    });

    // Within the same React tick: button is disabled, spinner is in DOM
    expect(btn).toBeDisabled();
    expect(btn.getAttribute('aria-busy')).toBe('true');
    expect(btn.querySelector('[aria-label="Loading"]')).not.toBeNull();
    expect(onSelfInsert).toHaveBeenCalledTimes(1);

    // Resolve the underlying handler — button returns to enabled
    await act(async () => {
      resolveSelfInsert();
    });
    expect(btn).not.toBeDisabled();
    expect(btn.getAttribute('aria-busy')).toBe('false');
    expect(btn.querySelector('[aria-label="Loading"]')).toBeNull();
  });

  it('blocks re-clicks while the handler is in flight', async () => {
    let resolveSelfInsert: () => void = () => {};
    const onSelfInsert = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveSelfInsert = resolve;
        })
    );

    renderPopover({ onSelfInsert });
    const btn = screen.getByTestId('portal-self-insert-button');

    await act(async () => {
      fireEvent.click(btn);
    });
    expect(onSelfInsert).toHaveBeenCalledTimes(1);

    // Re-clicks while pending: should NOT fire onSelfInsert again
    await act(async () => {
      fireEvent.click(btn);
      fireEvent.click(btn);
    });
    expect(onSelfInsert).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveSelfInsert();
    });

    // After resolution, can be clicked again
    await act(async () => {
      fireEvent.click(btn);
    });
    expect(onSelfInsert).toHaveBeenCalledTimes(2);
  });
});

describe('FeedbackPopover — illustration button pending state (issue #5)', () => {
  // Use fake timers so we can advance the 1.2s timeout deterministically.
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const baseProps = (onFeedback: any) => {
    const parent = document.createElement('div');
    document.body.appendChild(parent);
    return {
      selectionText: 'some text',
      position: makeRect(),
      positioningParentRef: { current: parent },
      onFeedback,
      onEdit: vi.fn(),
      onCompare: vi.fn(),
      canCompare: false,
    };
  };

  it('shows pending state on click and clears after timeout', () => {
    const onFeedback = vi.fn();
    render(<FeedbackPopover {...baseProps(onFeedback)} />);

    const btn = screen.getByTestId('illustration-button');
    expect(btn).not.toBeDisabled();

    fireEvent.click(btn);

    // Synchronously after click: pending state is on
    expect(btn).toBeDisabled();
    expect(btn.getAttribute('aria-busy')).toBe('true');
    expect(btn.querySelector('[aria-label="Loading"]')).not.toBeNull();
    expect(onFeedback).toHaveBeenCalledTimes(1);
    expect(onFeedback.mock.calls[0][0]).toMatchObject({ type: '🎨' });

    // After 1.2s the pending state clears
    act(() => {
      vi.advanceTimersByTime(1200);
    });
    expect(btn).not.toBeDisabled();
    expect(btn.getAttribute('aria-busy')).toBe('false');
  });

  it('blocks re-clicks during the pending window', () => {
    const onFeedback = vi.fn();
    render(<FeedbackPopover {...baseProps(onFeedback)} />);

    const btn = screen.getByTestId('illustration-button');
    fireEvent.click(btn);
    expect(onFeedback).toHaveBeenCalledTimes(1);

    // Within the pending window, additional clicks don't fire onFeedback
    fireEvent.click(btn);
    fireEvent.click(btn);
    expect(onFeedback).toHaveBeenCalledTimes(1);

    // After the timeout, it can be clicked again
    act(() => {
      vi.advanceTimersByTime(1200);
    });
    fireEvent.click(btn);
    expect(onFeedback).toHaveBeenCalledTimes(2);
  });
});

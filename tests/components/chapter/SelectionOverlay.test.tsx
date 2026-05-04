import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import { SelectionOverlay } from '../../../components/chapter/SelectionOverlay';

const baseSelection = {
  text: 'Test passage',
  rect: new DOMRect(0, 0, 10, 10),
};

const createProps = () => ({
  selection: baseSelection,
  viewMode: 'english' as const,
  isTouch: false,
  inlineEditActive: false,
  canCompare: true,
  comparisonLoading: false,
  beginInlineEdit: vi.fn(),
  handleCompareRequest: vi.fn(),
  handleFeedbackSubmit: vi.fn(),
  clearSelection: vi.fn(),
  viewRef: { current: document.createElement('div') },
});

describe('SelectionOverlay', () => {
  it('renders nothing when selection is absent', () => {
    const props = createProps();
    const { container } = render(<SelectionOverlay {...props} selection={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders FeedbackPopover when on desktop', () => {
    const props = createProps();
    document.body.appendChild(props.viewRef.current!);
    render(<SelectionOverlay {...props} />);
    expect(screen.getByTitle('Edit selection')).toBeInTheDocument();
  });

  it('renders SelectionSheet on touch devices', () => {
    const props = createProps();
    render(
      <SelectionOverlay
        {...props}
        isTouch
      />
    );
    expect(screen.getByText('Copy')).toBeInTheDocument();
  });

  // Issue #4 (twin) — mobile portal button must show pending state on click.
  describe('portal button pending state (issue #4 mobile twin)', () => {
    it('disables the button and shows a spinner on click', async () => {
      let resolveSelfInsert: () => void = () => {};
      const onSelfInsert = vi.fn(
        () =>
          new Promise<void>((resolve) => {
            resolveSelfInsert = resolve;
          })
      );
      const props = createProps();
      render(
        <SelectionOverlay
          {...props}
          isTouch
          enableSillyTavern={true}
          onSelfInsert={onSelfInsert}
        />
      );
      const btn = screen.getByTestId('portal-self-insert-button');
      expect(btn).not.toBeDisabled();

      await act(async () => {
        fireEvent.click(btn);
      });

      expect(btn).toBeDisabled();
      expect(btn.getAttribute('aria-busy')).toBe('true');
      // Mobile twin uses ⟳ as the spinner glyph; the icon swap is the signal.
      expect(btn.textContent).not.toBe('🌀');
      expect(onSelfInsert).toHaveBeenCalledTimes(1);

      await act(async () => {
        resolveSelfInsert();
      });
      expect(btn).not.toBeDisabled();
      expect(btn.getAttribute('aria-busy')).toBe('false');
    });

    it('blocks re-clicks while pending', async () => {
      let resolveSelfInsert: () => void = () => {};
      const onSelfInsert = vi.fn(
        () =>
          new Promise<void>((resolve) => {
            resolveSelfInsert = resolve;
          })
      );
      const props = createProps();
      render(
        <SelectionOverlay
          {...props}
          isTouch
          enableSillyTavern={true}
          onSelfInsert={onSelfInsert}
        />
      );
      const btn = screen.getByTestId('portal-self-insert-button');

      await act(async () => {
        fireEvent.click(btn);
        fireEvent.click(btn);
        fireEvent.click(btn);
      });
      expect(onSelfInsert).toHaveBeenCalledTimes(1);

      await act(async () => {
        resolveSelfInsert();
      });
      await act(async () => {
        fireEvent.click(btn);
      });
      expect(onSelfInsert).toHaveBeenCalledTimes(2);
    });
  });
});

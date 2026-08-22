import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import MobileSelectionHint from '../../../components/chapter/MobileSelectionHint';

describe('MobileSelectionHint', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('introduces the long-press illustration gesture on a touch reader', async () => {
    render(<MobileSelectionHint isTouch viewMode="english" selectionActive={false} />);

    expect(await screen.findByTestId('mobile-selection-hint')).toHaveTextContent(
      'Long-press text, then choose Illustrate.',
    );
  });

  it('does not advertise actions where the selection overlay is unavailable', () => {
    const { rerender } = render(
      <MobileSelectionHint isTouch={false} viewMode="english" selectionActive={false} />,
    );
    expect(screen.queryByTestId('mobile-selection-hint')).not.toBeInTheDocument();

    rerender(<MobileSelectionHint isTouch viewMode="original" selectionActive={false} />);
    expect(screen.queryByTestId('mobile-selection-hint')).not.toBeInTheDocument();
  });

  it('persists dismissal when the user closes the hint', async () => {
    const first = render(<MobileSelectionHint isTouch viewMode="english" selectionActive={false} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Dismiss text selection hint' }));
    expect(screen.queryByTestId('mobile-selection-hint')).not.toBeInTheDocument();

    first.unmount();
    render(<MobileSelectionHint isTouch viewMode="english" selectionActive={false} />);
    expect(screen.queryByTestId('mobile-selection-hint')).not.toBeInTheDocument();
  });

  it('retires the hint after the first successful selection', async () => {
    const { rerender } = render(
      <MobileSelectionHint isTouch viewMode="english" selectionActive={false} />,
    );
    expect(await screen.findByTestId('mobile-selection-hint')).toBeInTheDocument();

    rerender(<MobileSelectionHint isTouch viewMode="english" selectionActive />);
    expect(screen.queryByTestId('mobile-selection-hint')).not.toBeInTheDocument();

    rerender(<MobileSelectionHint isTouch viewMode="english" selectionActive={false} />);
    expect(screen.queryByTestId('mobile-selection-hint')).not.toBeInTheDocument();
  });

  it('does not retire the hint for a selection in Original view', async () => {
    const { rerender } = render(
      <MobileSelectionHint isTouch viewMode="original" selectionActive />,
    );

    rerender(<MobileSelectionHint isTouch viewMode="english" selectionActive={false} />);

    expect(await screen.findByTestId('mobile-selection-hint')).toBeInTheDocument();
  });

  it('keeps the hint dismissed for the page when storage rejects persistence', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage access denied', 'SecurityError');
    });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { rerender } = render(
      <MobileSelectionHint isTouch viewMode="english" selectionActive={false} />,
    );

    rerender(<MobileSelectionHint isTouch viewMode="english" selectionActive />);
    rerender(<MobileSelectionHint isTouch viewMode="english" selectionActive={false} />);

    expect(screen.queryByTestId('mobile-selection-hint')).not.toBeInTheDocument();
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('Could not persist dismissal'),
      expect.any(DOMException),
    );
  });

  it('logs descriptively when persisted dismissal cannot be read', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('Storage access denied', 'SecurityError');
    });
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    render(<MobileSelectionHint isTouch viewMode="english" selectionActive={false} />);

    expect(await screen.findByTestId('mobile-selection-hint')).toBeInTheDocument();
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('treating it as not dismissed'),
      expect.any(DOMException),
    );
  });
});

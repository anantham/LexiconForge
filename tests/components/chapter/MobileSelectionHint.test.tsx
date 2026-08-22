import React from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import MobileSelectionHint from '../../../components/chapter/MobileSelectionHint';

describe('MobileSelectionHint', () => {
  beforeEach(() => {
    localStorage.clear();
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
});

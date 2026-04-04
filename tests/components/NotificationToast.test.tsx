import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import NotificationToast from '../../components/NotificationToast';

const clearNotification = vi.fn();

const storeState = {
  notification: null as null | {
    message: string;
    type: 'success' | 'error' | 'info' | 'warning';
    timestamp: number;
  },
  clearNotification,
};

vi.mock('../../store', () => ({
  useAppStore: vi.fn((selector) => (selector ? selector(storeState) : storeState)),
}));

describe('NotificationToast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    clearNotification.mockReset();
    storeState.notification = {
      message: 'Settings saved successfully',
      type: 'success',
      timestamp: Date.now(),
    };
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('renders the notification and auto-dismisses it after five seconds', () => {
    render(<NotificationToast />);

    expect(screen.getByText('Settings saved successfully')).toBeInTheDocument();

    vi.advanceTimersByTime(5000);

    expect(clearNotification).toHaveBeenCalledTimes(1);
  });

  it('allows the user to dismiss the notification manually', () => {
    render(<NotificationToast />);

    fireEvent.click(screen.getByRole('button', { name: /dismiss notification/i }));

    expect(clearNotification).toHaveBeenCalledTimes(1);
  });
});

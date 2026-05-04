/**
 * Tests for the SillyTavern settings panel — Test Connection + Copy Command
 * (issue #4 follow-on).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import React from 'react';
import SillyTavernPanel from '../../../components/settings/SillyTavernPanel';
import { SettingsModalProvider } from '../../../components/settings/SettingsModalContext';
import type { AppSettings } from '../../../types';

const baseSettings = {
  enableSillyTavern: true,
  sillyTavernBridgeUrl: 'http://localhost:5001',
} as unknown as AppSettings;

const renderPanel = (overrides: Partial<AppSettings> = {}) => {
  const handleSettingChange = vi.fn();
  return {
    handleSettingChange,
    ...render(
      <SettingsModalProvider
        value={{
          currentSettings: { ...baseSettings, ...overrides } as AppSettings,
          handleSettingChange,
          parameterSupport: {},
          setParameterSupport: vi.fn(),
          novelMetadata: null,
          handleNovelMetadataChange: vi.fn(),
        }}
      >
        <SillyTavernPanel />
      </SettingsModalProvider>
    ),
  };
};

describe('SillyTavernPanel — Test Connection + Copy Command', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('renders Test Connection button when bridge URL is set', () => {
    renderPanel();
    expect(screen.getByTestId('bridge-test-connection')).toBeInTheDocument();
  });

  it('disables Test Connection when bridge URL is empty', () => {
    renderPanel({ sillyTavernBridgeUrl: '' } as any);
    expect(screen.getByTestId('bridge-test-connection')).toBeDisabled();
  });

  it('shows reachable pill on successful ping', async () => {
    (global.fetch as any).mockResolvedValueOnce({ type: 'opaque' });
    renderPanel();

    await act(async () => {
      fireEvent.click(screen.getByTestId('bridge-test-connection'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('bridge-status-pill')).toHaveTextContent('reachable');
    });
  });

  it('shows unreachable pill on failed ping', async () => {
    (global.fetch as any).mockRejectedValueOnce(new TypeError('Failed to fetch'));
    renderPanel();

    await act(async () => {
      fireEvent.click(screen.getByTestId('bridge-test-connection'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('bridge-status-pill')).toHaveTextContent(/Unreachable/);
    });
  });

  it('Copy command writes the uvicorn command to clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    renderPanel();

    await act(async () => {
      fireEvent.click(screen.getByTestId('bridge-copy-command'));
    });

    expect(writeText).toHaveBeenCalledWith('uvicorn bridge:app --port 5001');
    await waitFor(() => {
      expect(screen.getByTestId('bridge-copy-command')).toHaveTextContent('Copied');
    });
  });

  it('hides bridge URL section when SillyTavern is disabled', () => {
    renderPanel({ enableSillyTavern: false } as any);
    expect(screen.queryByTestId('bridge-test-connection')).not.toBeInTheDocument();
  });
});

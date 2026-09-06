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

const { mockFetchIndrasNetWorkflows } = vi.hoisted(() => ({
  mockFetchIndrasNetWorkflows: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../../services/providers/indrasNetImageProvider', () => ({
  fetchIndrasNetWorkflows: mockFetchIndrasNetWorkflows,
}));

const baseSettings = {
  enableSillyTavern: true,
  sillyTavernBridgeUrl: 'http://localhost:5001',
  indrasNetBaseUrl: 'https://broker.example.com:9443',
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
    mockFetchIndrasNetWorkflows.mockReset();
    mockFetchIndrasNetWorkflows.mockResolvedValue([]);
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
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue({ ready: true }),
    });
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

    expect(writeText).toHaveBeenCalledWith(
      'uv run uvicorn portal_bridge.app:app --host 127.0.0.1 --port 5001',
    );
    await waitFor(() => {
      expect(screen.getByTestId('bridge-copy-command')).toHaveTextContent('Copied');
    });
  });

  it('hides bridge URL section when SillyTavern is disabled', () => {
    renderPanel({ enableSillyTavern: false } as any);
    expect(screen.queryByTestId('bridge-test-connection')).not.toBeInTheDocument();
  });

  it('keeps the image broker controls visible when self-insert is disabled', () => {
    renderPanel({ enableSillyTavern: false } as any);
    expect(screen.getByLabelText('Tailnet broker endpoint')).toHaveValue(
      'https://broker.example.com:9443',
    );
  });

  it('does not discover workflows until a broker endpoint is configured', async () => {
    vi.useFakeTimers();
    try {
      renderPanel({ indrasNetBaseUrl: '  ' });
      await act(async () => { await vi.advanceTimersByTimeAsync(500); });
      expect(screen.getByRole('button', { name: 'Refresh' })).toBeDisabled();
      expect(screen.getByRole('status')).toHaveTextContent('Enter a broker URL');
      expect(mockFetchIndrasNetWorkflows).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('discovers workflows through the configured IndrasNet endpoint', async () => {
    mockFetchIndrasNetWorkflows.mockResolvedValueOnce([{
      name: 'gen_anime',
      client_ready: true,
      manifest: {
        name: 'gen_anime',
        display_name: 'Anime',
        client_ready: true,
        requires_image: false,
        inputs: { prompt: {} },
      },
    }]);
    renderPanel();

    await waitFor(() => {
      expect(mockFetchIndrasNetWorkflows).toHaveBeenCalledWith(
        'https://broker.example.com:9443',
        { force: true },
      );
    });
    expect(await screen.findByRole('status')).toHaveTextContent('1 client-ready workflow available');
  });

  it('keeps broker endpoint edits modal-local until Settings is saved', () => {
    const { handleSettingChange } = renderPanel();
    fireEvent.change(screen.getByLabelText('Tailnet broker endpoint'), {
      target: { value: 'https://custom-broker.example.com:9443' },
    });
    expect(handleSettingChange).toHaveBeenCalledWith(
      'indrasNetBaseUrl',
      'https://custom-broker.example.com:9443',
    );
  });
});

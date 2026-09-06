import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import OscilloscopePanel from '../../../components/oscilloscope/OscilloscopePanel';
import { useAppStore } from '../../../store';

vi.mock('../../../services/semanticOscilloscopeCache', () => ({
  restoreCachedOscilloscope: vi.fn().mockResolvedValue(false),
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it.each([null, 'another-translation'])('does not fetch unverified FMoC tracks after a cache miss for %s', async (version) => {
  useAppStore.getState().resetOscilloscope();
  useAppStore.setState({ activeNovelId: 'forty-millenniums-of-cultivation', activeVersionId: version });
  const fetch = vi.fn().mockRejectedValue(new Error('Unverified legacy asset requested'));
  vi.stubGlobal('fetch', fetch);
  await act(async () => { render(<OscilloscopePanel />); });
  expect(fetch).not.toHaveBeenCalled();
  expect(useAppStore.getState().isLoaded).toBe(false);
});

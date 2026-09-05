import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockAppSettings } from '../../tests/utils/test-data';
import { IllustrationRouteDialog } from './IllustrationRouteDialog';

const { imageModelsMock, workflowsMock, endpointDiscoveryMock } = vi.hoisted(() => ({
  imageModelsMock: vi.fn(),
  workflowsMock: vi.fn(),
  endpointDiscoveryMock: vi.fn(),
}));

vi.mock('../../services/openrouterImageModelAdapter', () => ({
  getImageCapableModels: (...args: unknown[]) => imageModelsMock(...args),
}));

vi.mock('../../services/providers/indrasNetImageProvider', () => ({
  fetchIndrasNetWorkflows: (...args: unknown[]) => workflowsMock(...args),
  imageModelFromWorkflowName: (name: string) => `indrasnet/${encodeURIComponent(name)}`,
}));

vi.mock('../../services/openrouterRouting', () => ({
  fetchOpenRouterEndpoints: (...args: unknown[]) => endpointDiscoveryMock(...args),
}));

describe('IllustrationRouteDialog', () => {
  beforeEach(() => {
    imageModelsMock.mockReset().mockResolvedValue({ data: [], fetchedAt: new Date().toISOString() });
    workflowsMock.mockReset().mockResolvedValue([]);
    endpointDiscoveryMock.mockReset().mockResolvedValue([
      { id: 'venice', label: 'Venice', tags: ['venice/fp8'] },
    ]);
  });

  it('submits model and endpoint as one-job overrides', async () => {
    imageModelsMock.mockResolvedValue({
      data: [{ id: 'black-forest-labs/flux.1-schnell', name: 'Flux Schnell', pricingLabel: '$0.01/image' }],
      fetchedAt: new Date().toISOString(),
    });
    const onSubmit = vi.fn();
    const settings = createMockAppSettings({
      imageModel: 'imagen-3.0-generate-002',
      openRouterImageEndpoint: 'auto',
    });

    render(
      <IllustrationRouteDialog
        selection="The tower split beneath the lightning."
        settings={settings}
        onCancel={vi.fn()}
        onSubmit={onSubmit}
      />
    );

    await screen.findByRole('option', { name: /Flux Schnell/ });
    fireEvent.change(screen.getByLabelText('Image model for this job'), {
      target: { value: 'openrouter/black-forest-labs/flux.1-schnell' },
    });
    await screen.findByRole('option', { name: 'Venice — venice' });
    fireEvent.change(screen.getByLabelText('OpenRouter endpoint for this job'), {
      target: { value: 'venice' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Generate' }));

    expect(onSubmit).toHaveBeenCalledWith({
      imageModel: 'openrouter/black-forest-labs/flux.1-schnell',
      openRouterImageEndpoint: 'venice',
    });
    expect(settings.imageModel).toBe('imagen-3.0-generate-002');
    expect(settings.openRouterImageEndpoint).toBe('auto');
    expect(workflowsMock).not.toHaveBeenCalled();
  });

  it('keeps saved models usable when both catalogues are down', async () => {
    imageModelsMock.mockRejectedValue(new Error('offline'));
    workflowsMock.mockRejectedValue(new Error('offline'));
    const settings = createMockAppSettings({ imageModel: 'indrasnet/gen_anime', indrasNetBaseUrl: 'https://broker.example.com' });

    render(
      <IllustrationRouteDialog
        selection="A duel."
        settings={settings}
        onCancel={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    await waitFor(() => expect(screen.getByText(/Saved options remain usable/)).toBeInTheDocument());
    expect(screen.getByLabelText('Image model for this job')).toHaveValue('indrasnet/gen_anime');
    expect(screen.getByRole('button', { name: 'Generate' })).toBeEnabled();
  });
});

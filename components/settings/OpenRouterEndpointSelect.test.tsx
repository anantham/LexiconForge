import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OpenRouterEndpointSelect } from './OpenRouterEndpointSelect';

const fetchEndpointsMock = vi.fn();

vi.mock('../../services/openrouterRouting', () => ({
  fetchOpenRouterEndpoints: (...args: unknown[]) => fetchEndpointsMock(...args),
}));

describe('OpenRouterEndpointSelect', () => {
  beforeEach(() => {
    fetchEndpointsMock.mockReset();
  });

  it('discovers endpoints for the selected model and reports an exact choice', async () => {
    fetchEndpointsMock.mockResolvedValue([
      { id: 'deepinfra', label: 'DeepInfra', tags: ['deepinfra/fp8'] },
      { id: 'venice', label: 'Venice', tags: ['venice/fp8'] },
    ]);
    const onChange = vi.fn();

    render(
      <OpenRouterEndpointSelect
        id="image-endpoint"
        label="Image endpoint"
        modelId="openrouter/black-forest-labs/flux.1-schnell"
        value="auto"
        onChange={onChange}
      />
    );

    expect(fetchEndpointsMock).toHaveBeenCalledWith(
      'openrouter/black-forest-labs/flux.1-schnell',
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
    await screen.findByRole('option', { name: 'Venice — venice' });
    fireEvent.change(screen.getByLabelText('Image endpoint'), { target: { value: 'venice' } });
    expect(onChange).toHaveBeenCalledWith('venice');
  });

  it('keeps a saved endpoint visible when discovery no longer returns it', async () => {
    fetchEndpointsMock.mockResolvedValue([{ id: 'deepinfra', label: 'DeepInfra', tags: [] }]);

    render(
      <OpenRouterEndpointSelect
        id="text-endpoint"
        label="Text endpoint"
        modelId="z-ai/glm-5.2"
        value="chutes"
        onChange={vi.fn()}
      />
    );

    expect(await screen.findByRole('option', { name: /chutes \(saved; unavailable for this model\)/ })).toBeInTheDocument();
  });

  it('shows discovery errors without changing the saved selection', async () => {
    fetchEndpointsMock.mockRejectedValue(new Error('HTTP 503'));

    render(
      <OpenRouterEndpointSelect
        id="text-endpoint"
        label="Text endpoint"
        modelId="z-ai/glm-5.2"
        value="auto"
        onChange={vi.fn()}
      />
    );

    await waitFor(() => expect(screen.getByText(/Endpoint list unavailable: HTTP 503/)).toBeInTheDocument());
    expect(screen.getByLabelText('Text endpoint')).toHaveValue('auto');
  });
});

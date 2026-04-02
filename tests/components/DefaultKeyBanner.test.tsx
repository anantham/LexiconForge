import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DefaultKeyBanner } from '../../components/DefaultKeyBanner';

const { emitTelemetry } = vi.hoisted(() => ({
  emitTelemetry: vi.fn(),
}));

const storeState = {
  settings: {
    provider: 'OpenRouter',
    apiKeyOpenRouter: '',
  },
};

const getDefaultKeyStatus = vi.fn();

vi.mock('../../store', () => ({
  useAppStore: vi.fn((selector) => (selector ? selector(storeState) : storeState)),
}));

vi.mock('../../services/defaultApiKeyService', () => ({
  getDefaultKeyStatus: () => getDefaultKeyStatus(),
}));

vi.mock('../../services/clientTelemetry', () => ({
  clientTelemetry: {
    emit: emitTelemetry,
  },
}));

describe('DefaultKeyBanner', () => {
  beforeEach(() => {
    storeState.settings.provider = 'OpenRouter';
    storeState.settings.apiKeyOpenRouter = '';
    getDefaultKeyStatus.mockReturnValue({
      isUsingDefault: false,
      usageCount: 2,
      remainingUses: 8,
      hasExceeded: false,
    });
    emitTelemetry.mockReset();
    vi.stubEnv('VITE_DEFAULT_OPENROUTER_KEY', 'trial-key');
    vi.stubEnv('VITE_OPENROUTER_API_KEY', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it('shows the trial banner when the shared trial key is active', () => {
    render(<DefaultKeyBanner />);

    expect(screen.getByText('Using Trial API Key')).toBeInTheDocument();
    expect(screen.getByText(/8 requests remaining/i)).toBeInTheDocument();
    expect(emitTelemetry).not.toHaveBeenCalled();
  });

  it('hides the trial banner when the user already has an env key', () => {
    vi.stubEnv('VITE_OPENROUTER_API_KEY', 'user-key');

    render(<DefaultKeyBanner />);

    expect(screen.queryByText('Using Trial API Key')).not.toBeInTheDocument();
  });

  it('emits a visible trial-limit event when the exceeded banner renders', () => {
    getDefaultKeyStatus.mockReturnValue({
      isUsingDefault: true,
      usageCount: 10,
      remainingUses: 0,
      hasExceeded: true,
    });

    render(<DefaultKeyBanner />);

    expect(screen.getByText(/trial limit exceeded/i)).toBeInTheDocument();
    expect(emitTelemetry).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'ui_error_rendered',
        failureType: 'trial_limit',
        surface: 'ui_render',
        userVisible: true,
      })
    );
  });
});

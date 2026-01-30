import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProvidersPanel from './ProvidersPanel';
import { useSettingsModalContext } from './SettingsModalContext';
import { useProvidersPanelStore } from '../../hooks/useProvidersPanelStore';

// Mock the context
const mockHandleSettingChange = vi.fn();
const mockSetParameterSupport = vi.fn();

type TestProviderName = 'Gemini' | 'DeepSeek' | 'OpenRouter' | 'Claude' | 'OpenAI';

const defaultSettings = {
  provider: 'Gemini' as TestProviderName,
  model: 'gemini-2.0-flash',
  imageModel: 'none',
  contextDepth: 2,
  preloadCount: 10,
  sourceLanguage: 'Korean',
  targetLanguage: 'English',
  apiKeyGemini: '',
  apiKeyDeepSeek: '',
  apiKeyOpenRouter: '',
  apiKeyClaude: '',
  apiKeyPiAPI: '',
};

vi.mock('./SettingsModalContext', () => ({
  useSettingsModalContext: vi.fn(),
  ParameterSupportState: {},
}));

// Mock the providers panel store
const mockLoadOpenRouterCatalogue = vi.fn();
const mockRefreshOpenRouterCredits = vi.fn();
const mockGetOpenRouterOptions = vi.fn(() => []);
const mockRefreshProviderCredits = vi.fn();
const mockLoadProviderCreditsFromCache = vi.fn();

vi.mock('../../hooks/useProvidersPanelStore', () => ({
  useProvidersPanelStore: vi.fn(),
}));

// Mock capability service
vi.mock('../../services/capabilityService', () => ({
  supportsStructuredOutputs: vi.fn().mockResolvedValue(false),
  supportsParameters: vi.fn().mockResolvedValue(false),
}));

// Mock OpenRouter service
vi.mock('../../services/openrouterService', () => ({
  getOpenRouterImageModels: vi.fn().mockResolvedValue([]),
  openrouterService: {
    getLastUsedMap: vi.fn().mockResolvedValue({}),
  },
}));

// Mock constants
vi.mock('../../config/constants', () => ({
  AVAILABLE_MODELS: {
    Gemini: [
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
      { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
    ],
    DeepSeek: [
      { id: 'deepseek-chat', name: 'DeepSeek Chat' },
      { id: 'deepseek-reasoner', name: 'DeepSeek Reasoner' },
    ],
    Claude: [
      { id: 'claude-3-opus', name: 'Claude 3 Opus' },
      { id: 'claude-3-sonnet', name: 'Claude 3 Sonnet' },
    ],
    OpenRouter: [],
  },
  AVAILABLE_IMAGE_MODELS: {
    Gemini: [
      { id: 'imagen-3.0-generate-001', name: 'Imagen 3' },
      { id: 'gemini-2.0-flash-preview-image-generation', name: 'Gemini 2.0 Flash Image' },
    ],
  },
}));

vi.mock('../../config/costs', () => ({
  MODELS: [
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', provider: 'Gemini' },
    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', provider: 'Gemini' },
    { id: 'deepseek-chat', name: 'DeepSeek Chat', provider: 'DeepSeek' },
    { id: 'deepseek-reasoner', name: 'DeepSeek Reasoner', provider: 'DeepSeek' },
    { id: 'claude-3-opus', name: 'Claude 3 Opus', provider: 'Claude' },
    { id: 'claude-3-sonnet', name: 'Claude 3 Sonnet', provider: 'Claude' },
  ],
  COSTS_PER_MILLION_TOKENS: {
    'gemini-2.0-flash': { input: 0.10, output: 0.40 },
    'gemini-1.5-pro': { input: 1.25, output: 5.00 },
    'deepseek-chat': { input: 0.14, output: 0.28 },
    'deepseek-reasoner': { input: 0.55, output: 2.19 },
    'claude-3-opus': { input: 15.00, output: 75.00 },
    'claude-3-sonnet': { input: 3.00, output: 15.00 },
  },
  IMAGE_COSTS: {
    'imagen-3.0-generate-001': 0.04,
    'gemini-2.0-flash-preview-image-generation': 0.02,
  },
}));

// Mock debug utility
vi.mock('../../utils/debug', () => ({
  debugLog: vi.fn(),
}));

describe('ProvidersPanel', () => {
  // Helper to set up default mocks
  const setupDefaultMocks = (
    settingsOverrides: Partial<typeof defaultSettings> = {},
    storeOverrides: Partial<ReturnType<typeof useProvidersPanelStore>> = {}
  ) => {
    vi.mocked(useSettingsModalContext).mockReturnValue({
      currentSettings: { ...defaultSettings, ...settingsOverrides },
      handleSettingChange: mockHandleSettingChange,
      parameterSupport: {},
      setParameterSupport: mockSetParameterSupport,
    } as any);

    vi.mocked(useProvidersPanelStore).mockReturnValue({
      loadOpenRouterCatalogue: mockLoadOpenRouterCatalogue,
      refreshOpenRouterCredits: mockRefreshOpenRouterCredits,
      getOpenRouterOptions: mockGetOpenRouterOptions,
      openRouterModels: null,
      openRouterKeyUsage: null,
      providerCredits: null,
      refreshProviderCredits: mockRefreshProviderCredits,
      loadProviderCreditsFromCache: mockLoadProviderCreditsFromCache,
      ...storeOverrides,
    } as any);
  };

  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Helper to update mock settings
  const updateMockSettings = (overrides: Partial<typeof defaultSettings>) => {
    setupDefaultMocks(overrides);
  };

  describe('Rendering', () => {
    it('renders Translation Engine fieldset', () => {
      render(<ProvidersPanel isOpen={true} />);
      expect(screen.getByText('Translation engine')).toBeInTheDocument();
    });

    it('renders API Keys fieldset with security notice', () => {
      render(<ProvidersPanel isOpen={true} />);
      expect(screen.getByText('API Keys')).toBeInTheDocument();
      expect(screen.getByText('Security notice')).toBeInTheDocument();
      expect(screen.getByText(/Your API keys are stored locally/)).toBeInTheDocument();
    });

    it('renders source and target language inputs', () => {
      render(<ProvidersPanel isOpen={true} />);
      expect(screen.getByLabelText('Source Language')).toBeInTheDocument();
      expect(screen.getByLabelText('Target Language')).toBeInTheDocument();
    });

    it('renders provider dropdown with all options', () => {
      render(<ProvidersPanel isOpen={true} />);
      const providerSelect = screen.getByLabelText('Text Provider');
      expect(providerSelect).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Google Gemini' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'DeepSeek' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'OpenRouter' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Claude (Anthropic)' })).toBeInTheDocument();
    });

    it('renders all API key inputs as password fields', () => {
      render(<ProvidersPanel isOpen={true} />);

      const geminiInput = screen.getByLabelText('Google Gemini API Key');
      const deepseekInput = screen.getByLabelText('DeepSeek API Key');
      const openrouterInput = screen.getByLabelText('OpenRouter API Key');
      const claudeInput = screen.getByLabelText('Claude API Key');
      const piapiInput = screen.getByLabelText('Pi API Key');

      expect(geminiInput).toHaveAttribute('type', 'password');
      expect(deepseekInput).toHaveAttribute('type', 'password');
      expect(openrouterInput).toHaveAttribute('type', 'password');
      expect(claudeInput).toHaveAttribute('type', 'password');
      expect(piapiInput).toHaveAttribute('type', 'password');
    });

    it('renders context depth and preload sliders', () => {
      render(<ProvidersPanel isOpen={true} />);
      expect(screen.getByLabelText(/Context Depth/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Pre-load Ahead/)).toBeInTheDocument();
    });

    it('renders image model dropdown with None option', () => {
      render(<ProvidersPanel isOpen={true} />);
      const imageModelSelect = screen.getByLabelText(/Image Generation Model/);
      expect(imageModelSelect).toBeInTheDocument();
      expect(screen.getByRole('option', { name: /None \(Disable Illustrations\)/ })).toBeInTheDocument();
    });
  });

  describe('Provider Selection', () => {
    it('calls handleSettingChange when provider changes', async () => {
      render(<ProvidersPanel isOpen={true} />);

      const providerSelect = screen.getByLabelText('Text Provider');
      await userEvent.selectOptions(providerSelect, 'DeepSeek');

      expect(mockHandleSettingChange).toHaveBeenCalledWith('provider', 'DeepSeek');
    });

    it('shows Gemini models when Gemini is selected', () => {
      render(<ProvidersPanel isOpen={true} />);

      const modelSelect = screen.getByLabelText(/Text Model/);
      expect(modelSelect).toBeInTheDocument();

      // Check for Gemini model options (with pricing)
      const options = modelSelect.querySelectorAll('option');
      const optionTexts = Array.from(options).map(o => o.textContent);
      expect(optionTexts.some(t => t?.includes('Gemini 2.0 Flash'))).toBe(true);
      expect(optionTexts.some(t => t?.includes('Gemini 1.5 Pro'))).toBe(true);
    });

    it('shows DeepSeek models when DeepSeek is selected', () => {
      updateMockSettings({ provider: 'DeepSeek', model: 'deepseek-chat' });
      render(<ProvidersPanel isOpen={true} />);

      const modelSelect = screen.getByLabelText(/Text Model/);
      const options = modelSelect.querySelectorAll('option');
      const optionTexts = Array.from(options).map(o => o.textContent);
      expect(optionTexts.some(t => t?.includes('DeepSeek Chat'))).toBe(true);
      expect(optionTexts.some(t => t?.includes('DeepSeek Reasoner'))).toBe(true);
    });

    it('shows search input only for OpenRouter', () => {
      // Default is Gemini - no search
      const { rerender } = render(<ProvidersPanel isOpen={true} />);
      expect(screen.queryByPlaceholderText(/Search models/)).not.toBeInTheDocument();

      // Switch to OpenRouter
      updateMockSettings({ provider: 'OpenRouter', model: 'openai/gpt-4' });
      rerender(<ProvidersPanel isOpen={true} />);
      expect(screen.getByPlaceholderText(/Search models/)).toBeInTheDocument();
    });
  });

  describe('Model Selection', () => {
    it('calls handleSettingChange when model changes', async () => {
      render(<ProvidersPanel isOpen={true} />);

      const modelSelect = screen.getByLabelText(/Text Model/);
      fireEvent.change(modelSelect, { target: { value: 'gemini-1.5-pro' } });

      expect(mockHandleSettingChange).toHaveBeenCalledWith('model', 'gemini-1.5-pro');
    });

    it('displays pricing in model labels', () => {
      render(<ProvidersPanel isOpen={true} />);

      const modelSelect = screen.getByLabelText(/Text Model/);
      const options = modelSelect.querySelectorAll('option');
      const optionTexts = Array.from(options).map(o => o.textContent);

      // Check for pricing format: "Model Name — USD X.XX/Y.YY per 1M"
      expect(optionTexts.some(t => t?.includes('USD') && t?.includes('per 1M'))).toBe(true);
    });

    it('calls handleSettingChange when image model changes', async () => {
      render(<ProvidersPanel isOpen={true} />);

      const imageModelSelect = screen.getByLabelText(/Image Generation Model/);
      fireEvent.change(imageModelSelect, { target: { value: 'imagen-3.0-generate-001' } });

      expect(mockHandleSettingChange).toHaveBeenCalledWith('imageModel', 'imagen-3.0-generate-001');
    });
  });

  describe('API Key Inputs', () => {
    it('calls handleSettingChange when Gemini key changes', async () => {
      render(<ProvidersPanel isOpen={true} />);

      const input = screen.getByLabelText('Google Gemini API Key');
      await userEvent.type(input, 'test-key');

      // Each character triggers onChange
      expect(mockHandleSettingChange).toHaveBeenCalledWith('apiKeyGemini', expect.any(String));
    });

    it('calls handleSettingChange when DeepSeek key changes', async () => {
      render(<ProvidersPanel isOpen={true} />);

      const input = screen.getByLabelText('DeepSeek API Key');
      await userEvent.type(input, 'sk-test');

      expect(mockHandleSettingChange).toHaveBeenCalledWith('apiKeyDeepSeek', expect.any(String));
    });

    it('calls handleSettingChange when OpenRouter key changes', async () => {
      render(<ProvidersPanel isOpen={true} />);

      const input = screen.getByLabelText('OpenRouter API Key');
      await userEvent.type(input, 'sk-or-test');

      expect(mockHandleSettingChange).toHaveBeenCalledWith('apiKeyOpenRouter', expect.any(String));
    });

    it('calls handleSettingChange when Claude key changes', async () => {
      render(<ProvidersPanel isOpen={true} />);

      const input = screen.getByLabelText('Claude API Key');
      await userEvent.type(input, 'sk-ant-test');

      expect(mockHandleSettingChange).toHaveBeenCalledWith('apiKeyClaude', expect.any(String));
    });

    it('calls handleSettingChange when PiAPI key changes', async () => {
      render(<ProvidersPanel isOpen={true} />);

      const input = screen.getByLabelText('Pi API Key');
      await userEvent.type(input, 'pi-test');

      expect(mockHandleSettingChange).toHaveBeenCalledWith('apiKeyPiAPI', expect.any(String));
    });

    it('shows refresh balance button for DeepSeek', async () => {
      render(<ProvidersPanel isOpen={true} />);

      const buttons = screen.getAllByRole('button', { name: /Refresh balance/i });
      expect(buttons.length).toBeGreaterThanOrEqual(1);

      await userEvent.click(buttons[0]); // First one is DeepSeek
      expect(mockRefreshProviderCredits).toHaveBeenCalledWith('DeepSeek');
    });

    it('shows refresh credits button for OpenRouter', async () => {
      render(<ProvidersPanel isOpen={true} />);

      const button = screen.getByRole('button', { name: /Refresh credits/i });
      await userEvent.click(button);

      expect(mockRefreshOpenRouterCredits).toHaveBeenCalled();
    });

    it('shows refresh balance button for PiAPI', async () => {
      render(<ProvidersPanel isOpen={true} />);

      const buttons = screen.getAllByRole('button', { name: /Refresh balance/i });
      // Last one should be PiAPI
      await userEvent.click(buttons[buttons.length - 1]);

      expect(mockRefreshProviderCredits).toHaveBeenCalledWith('PiAPI');
    });
  });

  describe('Sliders', () => {
    it('calls handleSettingChange when context depth changes', () => {
      render(<ProvidersPanel isOpen={true} />);

      const slider = screen.getByLabelText(/Context Depth/);
      fireEvent.change(slider, { target: { value: '4' } });

      expect(mockHandleSettingChange).toHaveBeenCalledWith('contextDepth', 4);
    });

    it('calls handleSettingChange when preload count changes', () => {
      render(<ProvidersPanel isOpen={true} />);

      const slider = screen.getByLabelText(/Pre-load Ahead/);
      fireEvent.change(slider, { target: { value: '25' } });

      expect(mockHandleSettingChange).toHaveBeenCalledWith('preloadCount', 25);
    });

    it('shows DISABLED warning when preload is 0', () => {
      updateMockSettings({ preloadCount: 0 });
      render(<ProvidersPanel isOpen={true} />);

      expect(screen.getByText('DISABLED')).toBeInTheDocument();
      expect(screen.getByText(/Background preload is DISABLED/)).toBeInTheDocument();
    });

    it('displays current context depth value', () => {
      updateMockSettings({ contextDepth: 3 });
      render(<ProvidersPanel isOpen={true} />);

      expect(screen.getByText('3')).toBeInTheDocument();
    });
  });

  describe('Language Settings', () => {
    it('calls handleSettingChange when source language changes', async () => {
      render(<ProvidersPanel isOpen={true} />);

      const input = screen.getByLabelText('Source Language');
      await userEvent.clear(input);
      await userEvent.type(input, 'Japanese');

      expect(mockHandleSettingChange).toHaveBeenCalledWith('sourceLanguage', expect.any(String));
    });

    it('calls handleSettingChange when target language changes', async () => {
      render(<ProvidersPanel isOpen={true} />);

      const input = screen.getByLabelText('Target Language');
      await userEvent.clear(input);
      await userEvent.type(input, 'Spanish');

      expect(mockHandleSettingChange).toHaveBeenCalledWith('targetLanguage', expect.any(String));
    });

    it('displays current language values', () => {
      updateMockSettings({ sourceLanguage: 'Japanese', targetLanguage: 'French' });
      render(<ProvidersPanel isOpen={true} />);

      expect(screen.getByLabelText('Source Language')).toHaveValue('Japanese');
      expect(screen.getByLabelText('Target Language')).toHaveValue('French');
    });
  });

  describe('OpenRouter Features', () => {
    beforeEach(() => {
      updateMockSettings({ provider: 'OpenRouter', model: 'openai/gpt-4' });
      mockGetOpenRouterOptions.mockReturnValue([
        { id: 'openai/gpt-4', label: 'GPT-4', priceKey: 30 },
        { id: 'openai/gpt-4-turbo', label: 'GPT-4 Turbo', priceKey: 10 },
        { id: 'anthropic/claude-3-opus', label: 'Claude 3 Opus', priceKey: 90 },
      ]);
    });

    it('loads OpenRouter catalogue when panel opens', () => {
      render(<ProvidersPanel isOpen={true} />);

      expect(mockLoadOpenRouterCatalogue).toHaveBeenCalledWith(false);
      expect(mockRefreshOpenRouterCredits).toHaveBeenCalled();
    });

    it('shows model search input', () => {
      render(<ProvidersPanel isOpen={true} />);

      const searchInput = screen.getByPlaceholderText(/Search models/);
      expect(searchInput).toBeInTheDocument();
    });

    it('filters models based on search input', async () => {
      render(<ProvidersPanel isOpen={true} />);

      const searchInput = screen.getByPlaceholderText(/Search models/);
      await userEvent.type(searchInput, 'gpt');

      // getOpenRouterOptions should be called with search term
      expect(mockGetOpenRouterOptions).toHaveBeenCalledWith('gpt');
    });

    it('displays models from OpenRouter options', () => {
      render(<ProvidersPanel isOpen={true} />);

      const modelSelect = screen.getByLabelText(/Text Model/);
      const options = modelSelect.querySelectorAll('option');
      const optionTexts = Array.from(options).map(o => o.textContent);

      expect(optionTexts.some(t => t?.includes('GPT-4'))).toBe(true);
    });

    it('clears search after model selection', async () => {
      render(<ProvidersPanel isOpen={true} />);

      const searchInput = screen.getByPlaceholderText(/Search models/);
      await userEvent.type(searchInput, 'gpt');

      const modelSelect = screen.getByLabelText(/Text Model/);
      fireEvent.change(modelSelect, { target: { value: 'openai/gpt-4-turbo' } });

      // Search should be cleared (we can verify by checking the input value)
      await waitFor(() => {
        expect(searchInput).toHaveValue('');
      });
    });
  });

  describe('Credit Displays', () => {
    it('shows default credit line when no data', () => {
      render(<ProvidersPanel isOpen={true} />);

      // Should show placeholder text for credits
      expect(screen.getByText(/Credits remaining: —/)).toBeInTheDocument();
      expect(screen.getAllByText(/Balance: —/).length).toBeGreaterThanOrEqual(1);
    });

    it('displays OpenRouter credits when available', () => {
      setupDefaultMocks({}, {
        openRouterKeyUsage: {
          remainingCredits: 50.25,
          totalCredits: 100,
          totalUsage: 49.75,
          fetchedAt: new Date().toISOString(),
        },
      });

      render(<ProvidersPanel isOpen={true} />);

      expect(screen.getByText(/Credits remaining: \$50\.25/)).toBeInTheDocument();
    });

    it('displays DeepSeek balance when available', () => {
      setupDefaultMocks({}, {
        providerCredits: {
          DeepSeek: {
            provider: 'DeepSeek',
            type: 'balance',
            remaining: 25.50,
            currency: 'USD',
            fetchedAt: new Date().toISOString(),
          },
        },
      });

      render(<ProvidersPanel isOpen={true} />);

      expect(screen.getByText(/Balance: \$25\.50/)).toBeInTheDocument();
    });
  });

  describe('Effects and Lifecycle', () => {
    it('loads provider credits from cache when panel opens', () => {
      render(<ProvidersPanel isOpen={true} />);

      expect(mockLoadProviderCreditsFromCache).toHaveBeenCalled();
    });

    it('does not load credits when panel is closed', () => {
      render(<ProvidersPanel isOpen={false} />);

      expect(mockLoadProviderCreditsFromCache).not.toHaveBeenCalled();
    });

    it('does not load OpenRouter catalogue for non-OpenRouter providers', () => {
      updateMockSettings({ provider: 'Gemini', model: 'gemini-2.0-flash' });
      render(<ProvidersPanel isOpen={true} />);

      expect(mockLoadOpenRouterCatalogue).not.toHaveBeenCalled();
    });
  });

  describe('Image Models', () => {
    it('lists static image models with pricing', () => {
      render(<ProvidersPanel isOpen={true} />);

      const imageModelSelect = screen.getByLabelText(/Image Generation Model/);
      const options = imageModelSelect.querySelectorAll('option');
      const optionTexts = Array.from(options).map(o => o.textContent);

      // Check for Imagen with pricing
      expect(optionTexts.some(t => t?.includes('Imagen 3') && t?.includes('$'))).toBe(true);
    });

    it('has None option as first choice', () => {
      render(<ProvidersPanel isOpen={true} />);

      const imageModelSelect = screen.getByLabelText(/Image Generation Model/);
      const firstOption = imageModelSelect.querySelector('option');

      expect(firstOption?.textContent).toContain('None');
      expect(firstOption?.value).toBe('none');
    });
  });
});

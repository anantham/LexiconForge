
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import SettingsModal from './SettingsModal';
import { AppSettings } from '../types';
import { INITIAL_SYSTEM_PROMPT } from '../constants';
import type { ProviderCreditSummary } from '../services/providerCreditCacheService';

const createStoreState = () => ({
  settings: mockSettings,
  updateSettings: vi.fn(),
  setError: vi.fn(),
  clearSession: vi.fn(),
  importSessionData: vi.fn(),
  promptTemplates: [],
  activePromptTemplate: null,
  createPromptTemplate: vi.fn(),
  updatePromptTemplate: vi.fn(),
  deletePromptTemplate: vi.fn(),
  setActivePromptTemplate: vi.fn(),
  loadOpenRouterCatalogue: vi.fn(),
  refreshOpenRouterModels: vi.fn(),
  refreshOpenRouterCredits: vi.fn(),
  getOpenRouterOptions: vi.fn(),
  openRouterModels: null,
  openRouterKeyUsage: null,
  providerCredits: { DeepSeek: null, PiAPI: null } as Partial<Record<'DeepSeek' | 'PiAPI', ProviderCreditSummary | null>>,
  refreshProviderCredits: vi.fn(),
  loadProviderCreditsFromCache: vi.fn(),
  getMemoryDiagnostics: vi.fn(() => ({
    summary: [],
    totals: {},
    warnings: [],
    estimatedRAM: {
      totalBytes: 0,
      totalMB: 0,
      chapterContentBytes: 0,
      base64ImageBytes: 0,
    },
  })),
});

const mockSettings: AppSettings = {
  provider: 'Gemini',
  model: 'gemini-2.5-flash',
  temperature: 0.5,
  contextDepth: 3,
  maxSessionSize: 10,
  systemPrompt: INITIAL_SYSTEM_PROMPT,
  apiKeyGemini: 'existing-gemini-key',
  apiKeyOpenAI: '',
  apiKeyDeepSeek: '',
};

type StoreState = ReturnType<typeof createStoreState>;

let storeState: StoreState = createStoreState();

vi.mock('../store', () => {
  const useAppStore = vi.fn((selector?: (state: StoreState) => unknown) => (
    typeof selector === 'function'
      ? selector(storeState)
      : storeState
  ));
  return {
    __esModule: true,
    useAppStore,
  };
});

import { useAppStore } from '../store';

const useAppStoreMock = useAppStore as unknown as Mock;

beforeEach(() => {
  storeState = createStoreState();
  useAppStoreMock.mockClear();
});

describe('SettingsModal', () => {
  it('should render without crashing when open', () => {
    const { unmount } = render(
      <SettingsModal
        isOpen={true}
        onClose={() => {}}
      />
    );

    // Check for a key element in the modal, like the title
    expect(screen.getByRole('heading', { name: /settings/i })).toBeInTheDocument();
    unmount();
  });

  it('should display the existing API key value from props', () => {
    const { unmount } = render(
      <SettingsModal
        isOpen={true}
        onClose={() => {}}
      />
    );

    // Find the input field by its label
    const geminiKeyInput = screen.getByLabelText(/google gemini api key/i);
    
    // Assert that the input's value matches the one from props
    expect(geminiKeyInput).toHaveValue('existing-gemini-key');
    unmount();
  });

  it('should call the onUpdateSettings function when the user types in the API key input', async () => {
    const user = userEvent.setup();
    const handleUpdateSettings = vi.fn();
    storeState.updateSettings = handleUpdateSettings;

    const { unmount } = render(
      <SettingsModal
        isOpen={true}
        onClose={() => {}}
      />
    );

    const geminiKeyInput = screen.getByLabelText(/google gemini api key/i);

    // Simulate a user clearing the field and typing a new key
    await user.clear(geminiKeyInput);
    await user.type(geminiKeyInput, 'new-api-key');

    // Save changes to persist the new key through updateSettings
    await user.click(screen.getAllByRole('button', { name: /save changes/i })[0]);

    expect(handleUpdateSettings).toHaveBeenCalledTimes(1);
    const [payload] = handleUpdateSettings.mock.calls[0];
    expect(payload.apiKeyGemini).toBe('new-api-key');
    unmount();
  });

  it('should not render when isOpen is false', () => {
    const { unmount } = render(
      <SettingsModal
        isOpen={false}
        onClose={() => {}}
      />
    );

    // The heading should not be in the document when the modal is closed
    expect(screen.queryByRole('heading', { name: /settings/i })).not.toBeInTheDocument();
    unmount();
  });

  it('shows DeepSeek balance summary when cached credits exist', () => {
    const fetchedAt = new Date('2025-10-13T11:58:00Z').toISOString();
    storeState.providerCredits = {
      ...storeState.providerCredits,
      DeepSeek: {
        provider: 'DeepSeek',
        currency: 'USD',
        type: 'balance',
        fetchedAt,
        remaining: 120,
        granted: 80,
        toppedUp: 40,
      },
    };

    const { unmount } = render(
      <SettingsModal
        isOpen={true}
        onClose={() => {}}
      />
    );

    const balanceLine = screen.getByText(/Balance: \$120\.00/i);
    expect(balanceLine).toHaveTextContent('Balance: $120.00 (granted $80.00, topped-up $40.00)');
    expect(balanceLine).toHaveTextContent('(updated');
    unmount();
  });

  it('shows PiAPI balance summary when cached credits exist', () => {
    const fetchedAt = new Date('2025-10-13T12:00:00Z').toISOString();
    storeState.providerCredits = {
      ...storeState.providerCredits,
      PiAPI: {
        provider: 'PiAPI',
        currency: 'USD',
        type: 'balance',
        fetchedAt,
        remaining: 56.78,
        note: 'Remaining credits: 1234',
        metadata: {
          account_name: 'Test Account',
          account_id: 'acct_123',
        },
      },
    };

    const { unmount } = render(
      <SettingsModal
        isOpen={true}
        onClose={() => {}}
      />
    );

    const piLine = screen.getByText(/Balance \(USD\): \$56\.78/i);
    expect(piLine).toHaveTextContent('Balance (USD): $56.78');
    expect(piLine).toHaveTextContent('Remaining credits: 1234');
    expect(piLine).toHaveTextContent('Test Account');
    expect(piLine).toHaveTextContent('(updated');
    unmount();
  });
});

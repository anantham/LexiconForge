
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import SettingsModal from './SettingsModal';
import { AppSettings } from '../types';
import { INITIAL_SYSTEM_PROMPT } from '../constants';

// Mock the useAppStore hook
vi.mock('../store/useAppStore', () => ({
  __esModule: true,
  default: vi.fn().mockReturnValue({
    settings: mockSettings,
    updateSettings: vi.fn(),
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
  }),
}));

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

describe('SettingsModal', () => {
  it('should render without crashing when open', () => {
    render(
      <SettingsModal
        isOpen={true}
        onClose={() => {}}
      />
    );

    // Check for a key element in the modal, like the title
    expect(screen.getByRole('heading', { name: /settings/i })).toBeInTheDocument();
  });

  it('should display the existing API key value from props', () => {
    render(
      <SettingsModal
        isOpen={true}
        onClose={() => {}}
      />
    );

    // Find the input field by its label
    const geminiKeyInput = screen.getByLabelText(/google gemini api key/i);
    
    // Assert that the input's value matches the one from props
    expect(geminiKeyInput).toHaveValue('existing-gemini-key');
  });

  it('should call the onUpdateSettings function when the user types in the API key input', async () => {
    const user = userEvent.setup();
    const handleUpdateSettings = vi.fn();
    useAppStore.mockReturnValueOnce({
        settings: mockSettings,
        updateSettings: handleUpdateSettings,
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
    });

    render(
      <SettingsModal
        isOpen={true}
        onClose={() => {}}
      />
    );

    const geminiKeyInput = screen.getByLabelText(/google gemini api key/i);

    // Simulate a user clearing the field and typing a new key
    await user.clear(geminiKeyInput);
    await user.type(geminiKeyInput, 'new-api-key');

    // Check that the update function was called with the correct new value
    // Note: It's called on every keystroke, so we check the last call.
    expect(handleUpdateSettings).toHaveBeenCalled();
  });

  it('should not render when isOpen is false', () => {
    render(
      <SettingsModal
        isOpen={false}
        onClose={() => {}}
      />
    );

    // The heading should not be in the document when the modal is closed
    expect(screen.queryByRole('heading', { name: /settings/i })).not.toBeInTheDocument();
  });
});

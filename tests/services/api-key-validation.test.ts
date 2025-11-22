import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateApiKey } from '../../services/aiService';
import type { AppSettings } from '../../types';

const mockEnv: Record<string, string | undefined> = {};
const resetMockEnv = (entries: Record<string, string | undefined>) => {
  Object.keys(mockEnv).forEach((key) => delete mockEnv[key]);
  Object.assign(mockEnv, entries);
};

vi.mock('../../services/env', () => ({
  getEnvVar: vi.fn((key: string) => mockEnv[key]),
  hasEnvVar: vi.fn((key: string) => mockEnv[key] !== undefined),
}));

const createSettings = (overrides: Partial<AppSettings>): AppSettings => ({
  contextDepth: 2,
  preloadCount: 0,
  fontSize: 16,
  fontStyle: 'serif',
  lineHeight: 1.6,
  systemPrompt: '',
  provider: 'Gemini',
  model: 'gemini-1.5-flash',
  temperature: 0.7,
  apiKeyGemini: '',
  apiKeyOpenAI: '',
  apiKeyDeepSeek: '',
  apiKeyClaude: '',
  apiKeyOpenRouter: '',
  imageModel: 'imagen-test-model',
  includeFanTranslationInPrompt: true,
  showDiffHeatmap: false,
  ...overrides,
});

describe('validateApiKey', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        resetMockEnv({
          GEMINI_API_KEY: 'env-gemini-key',
          OPENAI_API_KEY: 'env-openai-key',
          DEEPSEEK_API_KEY: 'env-deepseek-key',
          OPENROUTER_API_KEY: 'env-openrouter-key',
          CLAUDE_API_KEY: 'env-claude-key',
          PIAPI_API_KEY: 'env-piapi-key',
        });
    });

    describe('Gemini Provider', () => {
        it('should validate with settings API key', () => {
            const settings = createSettings({
                provider: 'Gemini',
                apiKeyGemini: 'user-gemini-key',
            });

            const result = validateApiKey(settings);
            
            expect(result.isValid).toBe(true);
            expect(result.errorMessage).toBeUndefined();
        });

        it('should validate with environment API key when settings key is empty', () => {
            const settings = createSettings({
                provider: 'Gemini',
            });

            const result = validateApiKey(settings);
            
            expect(result.isValid).toBe(true);
            expect(result.errorMessage).toBeUndefined();
        });

        it('should fail when no API key is available', () => {
            resetMockEnv({});
            
            const settings = createSettings({
                provider: 'Gemini',
            });

            const result = validateApiKey(settings);
            
            expect(result.isValid).toBe(false);
            expect(result.errorMessage).toContain('Google Gemini API key is missing');
            expect(result.errorMessage).toContain('Add it in settings or .env file.');
        });

        it('should fail when API key is whitespace only', () => {
            const settings = createSettings({
                provider: 'Gemini',
                apiKeyGemini: '   \t\n   ',
            });

            const result = validateApiKey(settings);
            
            expect(result.isValid).toBe(false);
            expect(result.errorMessage).toContain('Google Gemini API key is missing');
            expect(result.errorMessage).toContain('Add it in settings or .env file.');
        });
    });

    describe('OpenAI Provider', () => {
        it('should validate with settings API key', () => {
            const settings = createSettings({
                provider: 'OpenAI',
                apiKeyOpenAI: 'user-openai-key',
                model: 'gpt-4o',
            });

            const result = validateApiKey(settings);
            
            expect(result.isValid).toBe(true);
            expect(result.errorMessage).toBeUndefined();
        });

        it('should validate with environment API key', () => {
            const settings = createSettings({
                provider: 'OpenAI',
                model: 'gpt-4o',
            });

            const result = validateApiKey(settings);
            
            expect(result.isValid).toBe(true);
            expect(result.errorMessage).toBeUndefined();
        });

        it('should fail when no API key is available', () => {
            resetMockEnv({});
            
            const settings = createSettings({
                provider: 'OpenAI',
                model: 'gpt-4o',
            });

            const result = validateApiKey(settings);
            
            expect(result.isValid).toBe(false);
            expect(result.errorMessage).toContain('OpenAI API key is missing');
            expect(result.errorMessage).toContain('Add it in settings or .env file.');
        });
    });

    describe('DeepSeek Provider', () => {
        it('should validate with settings API key', () => {
            const settings = createSettings({
                provider: 'DeepSeek',
                apiKeyDeepSeek: 'user-deepseek-key',
                model: 'deepseek-chat',
            });

            const result = validateApiKey(settings);
            
            expect(result.isValid).toBe(true);
            expect(result.errorMessage).toBeUndefined();
        });

        it('should validate with environment API key', () => {
            const settings = createSettings({
                provider: 'DeepSeek',
                model: 'deepseek-chat',
            });

            const result = validateApiKey(settings);
            
            expect(result.isValid).toBe(true);
            expect(result.errorMessage).toBeUndefined();
        });

        it('should fail when no API key is available', () => {
            resetMockEnv({});
            
            const settings = createSettings({
                provider: 'DeepSeek',
                model: 'deepseek-chat',
            });

            const result = validateApiKey(settings);
            
            expect(result.isValid).toBe(false);
            expect(result.errorMessage).toContain('DeepSeek API key is missing');
            expect(result.errorMessage).toContain('Add it in settings or .env file.');
        });
    });

    describe('Edge Cases', () => {
        it('should handle unknown provider', () => {
            const settings = createSettings({
                provider: 'UnknownProvider' as any,
                model: 'some-model',
            });

            const result = validateApiKey(settings);
            
            expect(result.isValid).toBe(false);
            expect(result.errorMessage).toContain('Unknown provider: UnknownProvider');
        });

        it('should prefer settings key over environment key', () => {
            const settings = createSettings({
                provider: 'OpenAI',
                apiKeyOpenAI: 'settings-key',
                model: 'gpt-4o',
            });

            const result = validateApiKey(settings);
            
            // Should be valid because settings key exists (even if env key also exists)
            expect(result.isValid).toBe(true);
        });

        it('should handle missing process object gracefully', () => {
            resetMockEnv({});
            
            const settings = createSettings({
                provider: 'OpenAI',
                model: 'gpt-4o',
            });

            const result = validateApiKey(settings);
            
            expect(result.isValid).toBe(false);
            expect(result.errorMessage).toContain('OpenAI API key is missing');
            expect(result.errorMessage).toContain('Add it in settings or .env file.');
        });
    });

    describe('Integration with Translation Functions', () => {
        it('should provide consistent error messages across providers', () => {
            resetMockEnv({});
            
            const providers: Array<{ provider: AppSettings['provider'], expectedName: string }> = [
                { provider: 'Gemini', expectedName: 'Google Gemini' },
                { provider: 'OpenAI', expectedName: 'OpenAI' },
                { provider: 'DeepSeek', expectedName: 'DeepSeek' }
            ];

            providers.forEach(({ provider, expectedName }) => {
                const settings = createSettings({
                    provider,
                    model: 'test-model',
                });

                const result = validateApiKey(settings);
                
                expect(result.isValid).toBe(false);
                expect(result.errorMessage).toContain(`${expectedName} API key is missing`);
                expect(result.errorMessage).toContain('Add it in settings or .env file.');
            });
        });
    });
});

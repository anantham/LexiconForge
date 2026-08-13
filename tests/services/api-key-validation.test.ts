import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateApiKey } from '../../services/ai/apiKeyValidation';
import type { AppSettings } from '../../types';

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

        it('should fail when no API key is available', () => {
            const settings = createSettings({
                provider: 'Gemini',
            });

            const result = validateApiKey(settings);
            
            expect(result.isValid).toBe(false);
            expect(result.failureType).toBe('missing_api_key');
            expect(result.errorMessage).toContain('Google Gemini API key is missing');
            expect(result.errorMessage).toContain('Add your own key in Settings.');
        });

        it('should fail when API key is whitespace only', () => {
            const settings = createSettings({
                provider: 'Gemini',
                apiKeyGemini: '   \t\n   ',
            });

            const result = validateApiKey(settings);
            
            expect(result.isValid).toBe(false);
            expect(result.errorMessage).toContain('Google Gemini API key is missing');
            expect(result.errorMessage).toContain('Add your own key in Settings.');
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

        it('should fail when no API key is available', () => {
            const settings = createSettings({
                provider: 'OpenAI',
                model: 'gpt-4o',
            });

            const result = validateApiKey(settings);
            
            expect(result.isValid).toBe(false);
            expect(result.errorMessage).toContain('OpenAI API key is missing');
            expect(result.errorMessage).toContain('Add your own key in Settings.');
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

        it('should fail when no API key is available', () => {
            const settings = createSettings({
                provider: 'DeepSeek',
                model: 'deepseek-chat',
            });

            const result = validateApiKey(settings);
            
            expect(result.isValid).toBe(false);
            expect(result.errorMessage).toContain('DeepSeek API key is missing');
            expect(result.errorMessage).toContain('Add your own key in Settings.');
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
            expect(result.failureType).toBe('unknown');
            expect(result.errorMessage).toContain('Unknown provider: UnknownProvider');
        });

        it('should validate the settings-owned key', () => {
            const settings = createSettings({
                provider: 'OpenAI',
                apiKeyOpenAI: 'settings-key',
                model: 'gpt-4o',
            });

            const result = validateApiKey(settings);
            
            expect(result.isValid).toBe(true);
        });

        it('does not depend on a process environment fallback', () => {
            const settings = createSettings({
                provider: 'OpenAI',
                model: 'gpt-4o',
            });

            const result = validateApiKey(settings);
            
            expect(result.isValid).toBe(false);
            expect(result.errorMessage).toContain('OpenAI API key is missing');
            expect(result.errorMessage).toContain('Add your own key in Settings.');
        });
    });

    describe('Integration with Translation Functions', () => {
        it('should provide consistent error messages across providers', () => {
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
                expect(result.errorMessage).toContain('Add your own key in Settings.');
            });
        });
    });
});

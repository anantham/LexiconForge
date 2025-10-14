import { describe, it, expect, vi } from 'vitest';
import { validateApiKey } from '../../services/aiService';
import type { AppSettings } from '../../types';

describe('validateApiKey', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Mock process.env
        vi.stubGlobal('process', {
            env: {
                GEMINI_API_KEY: 'env-gemini-key',
                OPENAI_API_KEY: 'env-openai-key',
                DEEPSEEK_API_KEY: 'env-deepseek-key'
            }
        });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    describe('Gemini Provider', () => {
        it('should validate with settings API key', () => {
            const settings: AppSettings = {
                provider: 'Gemini',
                apiKeyGemini: 'user-gemini-key',
                apiKeyOpenAI: '',
                apiKeyDeepSeek: '',
                model: 'gemini-1.5-flash',
                systemPrompt: '',
                temperature: 0.7
            };

            const result = validateApiKey(settings);
            
            expect(result.isValid).toBe(true);
            expect(result.errorMessage).toBeUndefined();
        });

        it('should validate with environment API key when settings key is empty', () => {
            const settings: AppSettings = {
                provider: 'Gemini',
                apiKeyGemini: '',
                apiKeyOpenAI: '',
                apiKeyDeepSeek: '',
                model: 'gemini-1.5-flash',
                systemPrompt: '',
                temperature: 0.7
            };

            const result = validateApiKey(settings);
            
            expect(result.isValid).toBe(true);
            expect(result.errorMessage).toBeUndefined();
        });

        it('should fail when no API key is available', () => {
            vi.stubGlobal('process', { env: {} });
            
            const settings: AppSettings = {
                provider: 'Gemini',
                apiKeyGemini: '',
                apiKeyOpenAI: '',
                apiKeyDeepSeek: '',
                model: 'gemini-1.5-flash',
                systemPrompt: '',
                temperature: 0.7
            };

            const result = validateApiKey(settings);
            
            expect(result.isValid).toBe(false);
            expect(result.errorMessage).toContain('Google Gemini API key is missing');
            expect(result.errorMessage).toContain('Add it in settings or .env file.');
        });

        it('should fail when API key is whitespace only', () => {
            const settings: AppSettings = {
                provider: 'Gemini',
                apiKeyGemini: '   \t\n   ',
                apiKeyOpenAI: '',
                apiKeyDeepSeek: '',
                model: 'gemini-1.5-flash',
                systemPrompt: '',
                temperature: 0.7
            };

            const result = validateApiKey(settings);
            
            expect(result.isValid).toBe(false);
            expect(result.errorMessage).toContain('Google Gemini API key is missing');
            expect(result.errorMessage).toContain('Add it in settings or .env file.');
        });
    });

    describe('OpenAI Provider', () => {
        it('should validate with settings API key', () => {
            const settings: AppSettings = {
                provider: 'OpenAI',
                apiKeyGemini: '',
                apiKeyOpenAI: 'user-openai-key',
                apiKeyDeepSeek: '',
                model: 'gpt-4o',
                systemPrompt: '',
                temperature: 0.7
            };

            const result = validateApiKey(settings);
            
            expect(result.isValid).toBe(true);
            expect(result.errorMessage).toBeUndefined();
        });

        it('should validate with environment API key', () => {
            const settings: AppSettings = {
                provider: 'OpenAI',
                apiKeyGemini: '',
                apiKeyOpenAI: '',
                apiKeyDeepSeek: '',
                model: 'gpt-4o',
                systemPrompt: '',
                temperature: 0.7
            };

            const result = validateApiKey(settings);
            
            expect(result.isValid).toBe(true);
            expect(result.errorMessage).toBeUndefined();
        });

        it('should fail when no API key is available', () => {
            vi.stubGlobal('process', { env: {} });
            
            const settings: AppSettings = {
                provider: 'OpenAI',
                apiKeyGemini: '',
                apiKeyOpenAI: '',
                apiKeyDeepSeek: '',
                model: 'gpt-4o',
                systemPrompt: '',
                temperature: 0.7
            };

            const result = validateApiKey(settings);
            
            expect(result.isValid).toBe(false);
            expect(result.errorMessage).toContain('OpenAI API key is missing');
            expect(result.errorMessage).toContain('Add it in settings or .env file.');
        });
    });

    describe('DeepSeek Provider', () => {
        it('should validate with settings API key', () => {
            const settings: AppSettings = {
                provider: 'DeepSeek',
                apiKeyGemini: '',
                apiKeyOpenAI: '',
                apiKeyDeepSeek: 'user-deepseek-key',
                model: 'deepseek-chat',
                systemPrompt: '',
                temperature: 0.7
            };

            const result = validateApiKey(settings);
            
            expect(result.isValid).toBe(true);
            expect(result.errorMessage).toBeUndefined();
        });

        it('should validate with environment API key', () => {
            const settings: AppSettings = {
                provider: 'DeepSeek',
                apiKeyGemini: '',
                apiKeyOpenAI: '',
                apiKeyDeepSeek: '',
                model: 'deepseek-chat',
                systemPrompt: '',
                temperature: 0.7
            };

            const result = validateApiKey(settings);
            
            expect(result.isValid).toBe(true);
            expect(result.errorMessage).toBeUndefined();
        });

        it('should fail when no API key is available', () => {
            vi.stubGlobal('process', { env: {} });
            
            const settings: AppSettings = {
                provider: 'DeepSeek',
                apiKeyGemini: '',
                apiKeyOpenAI: '',
                apiKeyDeepSeek: '',
                model: 'deepseek-chat',
                systemPrompt: '',
                temperature: 0.7
            };

            const result = validateApiKey(settings);
            
            expect(result.isValid).toBe(false);
            expect(result.errorMessage).toContain('DeepSeek API key is missing');
            expect(result.errorMessage).toContain('Add it in settings or .env file.');
        });
    });

    describe('Edge Cases', () => {
        it('should handle unknown provider', () => {
            const settings: AppSettings = {
                provider: 'UnknownProvider' as any,
                apiKeyGemini: '',
                apiKeyOpenAI: '',
                apiKeyDeepSeek: '',
                model: 'some-model',
                systemPrompt: '',
                temperature: 0.7
            };

            const result = validateApiKey(settings);
            
            expect(result.isValid).toBe(false);
            expect(result.errorMessage).toContain('Unknown provider: UnknownProvider');
        });

        it('should prefer settings key over environment key', () => {
            const settings: AppSettings = {
                provider: 'OpenAI',
                apiKeyGemini: '',
                apiKeyOpenAI: 'settings-key',
                apiKeyDeepSeek: '',
                model: 'gpt-4o',
                systemPrompt: '',
                temperature: 0.7
            };

            const result = validateApiKey(settings);
            
            // Should be valid because settings key exists (even if env key also exists)
            expect(result.isValid).toBe(true);
        });

        it('should handle missing process object gracefully', () => {
            vi.stubGlobal('process', undefined);
            
            const settings: AppSettings = {
                provider: 'OpenAI',
                apiKeyGemini: '',
                apiKeyOpenAI: '',
                apiKeyDeepSeek: '',
                model: 'gpt-4o',
                systemPrompt: '',
                temperature: 0.7
            };

            const result = validateApiKey(settings);
            
            expect(result.isValid).toBe(false);
            expect(result.errorMessage).toContain('OpenAI API key is missing');
            expect(result.errorMessage).toContain('Add it in settings or .env file.');
        });
    });

    describe('Integration with Translation Functions', () => {
        it('should provide consistent error messages across providers', () => {
            vi.stubGlobal('process', { env: {} });
            
            const providers: Array<{ provider: AppSettings['provider'], expectedName: string }> = [
                { provider: 'Gemini', expectedName: 'Google Gemini' },
                { provider: 'OpenAI', expectedName: 'OpenAI' },
                { provider: 'DeepSeek', expectedName: 'DeepSeek' }
            ];

            providers.forEach(({ provider, expectedName }) => {
                const settings: AppSettings = {
                    provider,
                    apiKeyGemini: '',
                    apiKeyOpenAI: '',
                    apiKeyDeepSeek: '',
                    model: 'test-model',
                    systemPrompt: '',
                    temperature: 0.7
                };

                const result = validateApiKey(settings);
                
                expect(result.isValid).toBe(false);
                expect(result.errorMessage).toContain(`${expectedName} API key is missing`);
                expect(result.errorMessage).toContain('Add it in settings or .env file.');
            });
        });
    });
});

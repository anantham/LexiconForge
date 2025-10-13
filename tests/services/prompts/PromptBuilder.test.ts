import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PromptBuilder, type PromptContext } from '../../../services/prompts/PromptBuilder';
import { promptRegistry } from '../../../services/prompts/PromptRegistry';
import type { AppSettings, HistoricalChapter } from '../../../types';

// Mock the prompts.json
vi.mock('../../../config/prompts.json', () => ({
  default: {
    translatePrefix: 'Translate the following text:',
    translateFanSuffix: ' (Note: A fan translation is provided for reference)',
    translateInstruction: ' Maintain style and tone.',
    translateTitleGuidance: ' Craft an evocative title.',
    translateTitleLabel: 'TITLE:',
    translateContentLabel: 'CONTENT:'
  }
}));

describe('PromptBuilder', () => {
  let mockSettings: AppSettings;
  let mockContext: PromptContext;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockSettings = {
      provider: 'OpenAI',
      model: 'gpt-4',
      temperature: 0.7,
      systemPrompt: 'Test system prompt with {placeholder}',
      promptId: 'test-prompt',
      placeholder: 'replaced-value'
    } as AppSettings;

    mockContext = {
      title: 'Test Chapter Title',
      content: 'This is test content to translate.',
      history: [],
      fanTranslation: null,
      settings: mockSettings
    };

    // Mock the prompt registry
    vi.spyOn(promptRegistry, 'getPrompt').mockReturnValue({
      id: 'test-prompt',
      name: 'Test Prompt',
      version: 1,
      systemPrompt: 'You are a translator. Translate {sourceLanguage} to {targetLanguage}. Output JSON.',
      isDefault: false,
      isBuiltin: false,
      createdAt: Date.now(),
      updatedAt: Date.now()
    });

    vi.spyOn(promptRegistry, 'getDefaultPrompt').mockReturnValue({
      id: 'default',
      name: 'Default',
      version: 1,
      systemPrompt: 'Default translation prompt. Output JSON.',
      isDefault: true,
      isBuiltin: true,
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
  });

  describe('buildTranslationPrompt', () => {
    it('builds complete translation prompt with template', async () => {
      const result = await PromptBuilder.buildTranslationPrompt(mockContext);

      expect(result.systemPrompt).toContain('You are a translator');
      expect(result.systemPrompt).toContain('Output JSON');
      expect(result.userPrompt).toContain('Test Chapter Title');
      expect(result.userPrompt).toContain('This is test content to translate');
      expect(result.messages).toBeDefined();
      expect(result.messages!.length).toBeGreaterThan(0);
    });

    it('uses default prompt when no promptId specified', async () => {
      const contextWithoutPromptId = {
        ...mockContext,
        settings: { ...mockSettings, promptId: undefined }
      };

      const result = await PromptBuilder.buildTranslationPrompt(contextWithoutPromptId);

      expect(promptRegistry.getDefaultPrompt).toHaveBeenCalled();
      expect(result.systemPrompt).toContain('Default translation prompt');
    });

    it('throws error when no prompt template available', async () => {
      vi.spyOn(promptRegistry, 'getPrompt').mockReturnValue(null);
      vi.spyOn(promptRegistry, 'getDefaultPrompt').mockReturnValue(null);

      await expect(PromptBuilder.buildTranslationPrompt(mockContext))
        .rejects.toThrow('No prompt template available');
    });

    it('processes placeholder replacement in system prompt', async () => {
      const contextWithPlaceholders = {
        ...mockContext,
        settings: { 
          ...mockSettings, 
          sourceLanguage: 'Japanese',
          targetLanguage: 'English'
        }
      };

      const result = await PromptBuilder.buildTranslationPrompt(contextWithPlaceholders);

      expect(result.systemPrompt).toContain('Japanese to English');
      expect(result.systemPrompt).not.toContain('{sourceLanguage}');
      expect(result.systemPrompt).not.toContain('{targetLanguage}');
    });

    it('includes fan translation context when provided', async () => {
      const contextWithFanTL = {
        ...mockContext,
        fanTranslation: 'This is a fan translation for reference'
      };

      const result = await PromptBuilder.buildTranslationPrompt(contextWithFanTL);

      expect(result.userPrompt).toContain('EXISTING FAN TRANSLATION');
      expect(result.userPrompt).toContain('This is a fan translation for reference');
      expect(result.userPrompt).toContain('(Note: A fan translation is provided for reference)');
    });

    it('builds correct messages array with history', async () => {
      const history: HistoricalChapter[] = [
        {
          originalTitle: 'Previous Title',
          originalContent: 'Previous content',
          translatedContent: '{"translatedTitle": "Translated Title", "translation": "Translated content"}'
        }
      ];

      const contextWithHistory = {
        ...mockContext,
        history
      };

      const result = await PromptBuilder.buildTranslationPrompt(contextWithHistory);

      expect(result.messages).toHaveLength(4); // system + user/assistant pair + current user
      expect(result.messages![1].role).toBe('user');
      expect(result.messages![1].content).toContain('Previous Title');
      expect(result.messages![2].role).toBe('assistant');
      expect(result.messages![2].content).toContain('Translated content');
    });

    it('ensures JSON requirement in system prompt', async () => {
      vi.spyOn(promptRegistry, 'getPrompt').mockReturnValue({
        id: 'no-json-prompt',
        name: 'No JSON',
        version: 1,
        systemPrompt: 'Simple translation prompt without JSON mention',
        isDefault: false,
        isBuiltin: false,
        createdAt: Date.now(),
        updatedAt: Date.now()
      });

      const result = await PromptBuilder.buildTranslationPrompt(mockContext);

      expect(result.systemPrompt).toContain('valid JSON object');
    });
  });

  describe('formatHistoryForSingleTurn', () => {
    it('returns empty string for empty history', () => {
      const result = PromptBuilder.formatHistoryForSingleTurn([]);
      expect(result).toBe('');
    });

    it('formats history correctly for single-turn models', () => {
      const history: HistoricalChapter[] = [
        {
          originalTitle: 'Chapter 1',
          originalContent: 'First content',
          translatedContent: 'First translation'
        },
        {
          originalTitle: 'Chapter 2',
          originalContent: 'Second content',
          translatedContent: 'Second translation'
        }
      ];

      const result = PromptBuilder.formatHistoryForSingleTurn(history);

      expect(result).toContain('PREVIOUS TRANSLATION EXAMPLES');
      expect(result).toContain('EXAMPLE 1:');
      expect(result).toContain('EXAMPLE 2:');
      expect(result).toContain('Chapter 1');
      expect(result).toContain('First translation');
      expect(result).toContain('Chapter 2');
      expect(result).toContain('Second translation');
    });

    it('skips incomplete history entries', () => {
      const history: HistoricalChapter[] = [
        {
          originalTitle: 'Complete Chapter',
          originalContent: 'Complete content',
          translatedContent: 'Complete translation'
        },
        {
          originalTitle: null,
          originalContent: 'Incomplete content',
          translatedContent: null
        }
      ];

      const result = PromptBuilder.formatHistoryForSingleTurn(history);

      expect(result).toContain('EXAMPLE 1:');
      expect(result).not.toContain('EXAMPLE 2:');
      expect(result).toContain('Complete Chapter');
      expect(result).not.toContain('Incomplete content');
    });
  });

  describe('buildImagePrompt', () => {
    it('builds basic image prompt', () => {
      const result = PromptBuilder.buildImagePrompt('A beautiful landscape');

      expect(result).toContain('A beautiful landscape');
      expect(result).toContain('High quality');
      expect(result).toContain('safe for work');
    });

    it('includes style when provided', () => {
      const result = PromptBuilder.buildImagePrompt('A character portrait', 'anime style');

      expect(result).toContain('A character portrait');
      expect(result).toContain('anime style');
    });

    it('includes additional context when provided', () => {
      const result = PromptBuilder.buildImagePrompt(
        'A scene', 
        'digital art', 
        'from a fantasy novel'
      );

      expect(result).toContain('A scene');
      expect(result).toContain('digital art');
      expect(result).toContain('Additional context: from a fantasy novel');
    });
  });

  describe('buildAmendmentPrompt', () => {
    it('builds amendment prompt correctly', () => {
      const result = PromptBuilder.buildAmendmentPrompt(
        'Original text',
        'Current translation',
        'Additional context'
      );

      expect(result).toContain('Please review this translation');
      expect(result).toContain('ORIGINAL: Original text');
      expect(result).toContain('CURRENT TRANSLATION: Current translation');
      expect(result).toContain('CONTEXT: Additional context');
      expect(result).toContain('Format as JSON');
    });

    it('builds amendment prompt without context', () => {
      const result = PromptBuilder.buildAmendmentPrompt(
        'Original text',
        'Current translation'
      );

      expect(result).toContain('ORIGINAL: Original text');
      expect(result).toContain('CURRENT TRANSLATION: Current translation');
      expect(result).not.toContain('CONTEXT:');
    });
  });

  describe('validatePromptTemplate', () => {
    it('validates good templates', () => {
      const template = 'You are a translator. Please translate the text and output JSON format with the required fields.';
      const result = PromptBuilder.validatePromptTemplate(template);

      expect(result.isValid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('catches empty templates', () => {
      const result = PromptBuilder.validatePromptTemplate('');

      expect(result.isValid).toBe(false);
      expect(result.issues).toContain('Template cannot be empty');
    });

    it('catches too short templates', () => {
      const result = PromptBuilder.validatePromptTemplate('Short');

      expect(result.isValid).toBe(false);
      expect(result.issues).toContain('Template seems too short for effective translation guidance');
    });

    it('catches missing JSON instruction', () => {
      const template = 'You are a translator. Please translate the text carefully.';
      const result = PromptBuilder.validatePromptTemplate(template);

      expect(result.isValid).toBe(false);
      expect(result.issues).toContain('Template should mention JSON format requirement for structured outputs');
    });

    it('catches unbalanced braces', () => {
      const template = 'Translate {sourceLanguage to {targetLanguage}. Output JSON.';
      const result = PromptBuilder.validatePromptTemplate(template);

      expect(result.isValid).toBe(false);
      expect(result.issues).toContain('Template contains unbalanced placeholder braces');
    });

    it('warns about double braces', () => {
      const template = 'Translate {{language}}. Output JSON format.';
      const result = PromptBuilder.validatePromptTemplate(template);

      expect(result.isValid).toBe(false);
      expect(result.issues).toContain('Template contains double braces which may cause parsing issues');
    });
  });

  describe('extractPlaceholders', () => {
    it('extracts placeholders from template', () => {
      const template = 'Translate from {sourceLanguage} to {targetLanguage} using {style} approach.';
      const placeholders = PromptBuilder.extractPlaceholders(template);

      expect(placeholders).toEqual(['sourceLanguage', 'targetLanguage', 'style']);
    });

    it('deduplicates repeated placeholders', () => {
      const template = 'Use {model} for {task}. The {model} should handle {task} well.';
      const placeholders = PromptBuilder.extractPlaceholders(template);

      expect(placeholders).toEqual(['model', 'task']);
    });

    it('returns empty array for template without placeholders', () => {
      const template = 'Simple template without any placeholders.';
      const placeholders = PromptBuilder.extractPlaceholders(template);

      expect(placeholders).toEqual([]);
    });
  });

  describe('previewPrompt', () => {
    it('previews prompt with sample settings', () => {
      const template = 'Translate {sourceLanguage} to {targetLanguage}. Model: {model}';
      const sampleSettings = {
        sourceLanguage: 'Japanese',
        targetLanguage: 'English',
        model: 'gpt-4'
      };

      const result = PromptBuilder.previewPrompt(template, sampleSettings);

      expect(result).toContain('Japanese to English');
      expect(result).toContain('Model: gpt-4');
      expect(result).not.toContain('{sourceLanguage}');
    });

    it('adds JSON instruction if missing', () => {
      const template = 'Simple translation template';
      const result = PromptBuilder.previewPrompt(template, {});

      expect(result).toContain('valid JSON object');
    });
  });
});

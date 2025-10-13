// PromptBuilder - Single entry point for prompt construction and context formatting

import type { AppSettings, HistoricalChapter } from '../../types';
import { promptRegistry } from './PromptRegistry';
import prompts from '../../config/prompts.json';

export interface PromptContext {
  title: string;
  content: string;
  history: HistoricalChapter[];
  fanTranslation?: string | null;
  settings: AppSettings;
}

export interface BuildPromptResult {
  systemPrompt: string;
  userPrompt: string;
  messages?: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
}

export class PromptBuilder {
  
  /**
   * Build a complete prompt for translation
   */
  static async buildTranslationPrompt(context: PromptContext): Promise<BuildPromptResult> {
    // Get the appropriate template
    const template = context.settings.promptId 
      ? promptRegistry.getPrompt(context.settings.promptId)
      : promptRegistry.getDefaultPrompt();

    if (!template) {
      throw new Error('No prompt template available');
    }

    // Process the system prompt with placeholders
    const systemPrompt = this.processSystemPrompt(template.systemPrompt, context.settings);

    // Build user prompt with context
    const userPrompt = this.buildUserPrompt(context);

    // For chat-based models, build messages array
    const messages = this.buildMessagesArray(systemPrompt, context);

    return {
      systemPrompt,
      userPrompt,
      messages
    };
  }

  /**
   * Process system prompt with placeholder replacement and context injection
   */
  private static processSystemPrompt(template: string, settings: AppSettings): string {
    let processed = template;

    // Replace settings placeholders
    processed = processed.replace(/\{([^}]+)\}/g, (match, key) => {
      const value = (settings as any)[key];
      return value !== undefined ? String(value) : match;
    });

    // Ensure JSON formatting instruction is present for structured outputs
    if (!processed.toLowerCase().includes('json')) {
      processed += '\n\nYour response must be a single, valid JSON object following the specified format.';
    }

    return processed;
  }

  /**
   * Build user prompt with translation request and context
   */
  private static buildUserPrompt(context: PromptContext): string {
    const { title, content, fanTranslation } = context;
    
    let userPrompt = '';

    // Add fan translation context if provided
    if (fanTranslation) {
      userPrompt += this.buildFanTranslationContext(fanTranslation);
      userPrompt += '\n\n';
    }

    // Add standard prefixes and instructions
    userPrompt += prompts.translatePrefix;
    if (fanTranslation) {
      userPrompt += prompts.translateFanSuffix;
    }
    userPrompt += prompts.translateInstruction;
    userPrompt += prompts.translateTitleGuidance;
    userPrompt += '\n\n';

    // Add the content to translate
    userPrompt += `${prompts.translateTitleLabel}\n${title}\n\n`;
    userPrompt += `${prompts.translateContentLabel}\n${content}`;

    return userPrompt;
  }

  /**
   * Build messages array for chat-based models
   */
  private static buildMessagesArray(systemPrompt: string, context: PromptContext): Array<{ role: 'system' | 'user' | 'assistant'; content: string }> {
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];

    // Add system message
    messages.push({ role: 'system', content: systemPrompt });

    // Add conversation history for context
    context.history.forEach((entry) => {
      if (entry.originalTitle && entry.originalContent && entry.translatedContent) {
        // Add user message with original content
        messages.push({
          role: 'user',
          content: `TITLE: ${entry.originalTitle}\n\nCONTENT:\n${entry.originalContent}`
        });

        // Add assistant message with translation
        messages.push({
          role: 'assistant',
          content: entry.translatedContent
        });
      }
    });

    // Add current translation request
    const userPrompt = this.buildUserPrompt(context);
    messages.push({ role: 'user', content: userPrompt });

    return messages;
  }

  /**
   * Build fan translation context section
   */
  private static buildFanTranslationContext(fanTranslation: string): string {
    return `EXISTING FAN TRANSLATION (for reference):\n${fanTranslation}`;
  }

  /**
   * Format history for single-turn models (like some Gemini configurations)
   */
  static formatHistoryForSingleTurn(history: HistoricalChapter[]): string {
    if (history.length === 0) {
      return '';
    }

    let formatted = 'PREVIOUS TRANSLATION EXAMPLES:\n\n';

    history.forEach((entry, index) => {
      if (entry.originalTitle && entry.originalContent && entry.translatedContent) {
        formatted += `EXAMPLE ${index + 1}:\n`;
        formatted += `INPUT TITLE: ${entry.originalTitle}\n`;
        formatted += `INPUT CONTENT: ${entry.originalContent}\n`;
        formatted += `OUTPUT: ${entry.translatedContent}\n\n`;
      }
    });

    return formatted;
  }

  /**
   * Create a prompt for image generation
   */
  static buildImagePrompt(description: string, style?: string, additionalContext?: string): string {
    let prompt = description;

    if (style) {
      prompt += `, ${style}`;
    }

    if (additionalContext) {
      prompt += `. Additional context: ${additionalContext}`;
    }

    // Add quality and safety guidelines
    prompt += '. High quality, detailed, safe for work, professional artistic style.';

    return prompt;
  }

  /**
   * Create a prompt for amendment/improvement suggestions
   */
  static buildAmendmentPrompt(originalText: string, currentTranslation: string, context?: string): string {
    let prompt = `Please review this translation and suggest improvements:\n\n`;
    prompt += `ORIGINAL: ${originalText}\n`;
    prompt += `CURRENT TRANSLATION: ${currentTranslation}\n`;
    
    if (context) {
      prompt += `CONTEXT: ${context}\n`;
    }
    
    prompt += `\nProvide specific suggestions for improvement, focusing on accuracy, fluency, and cultural appropriateness. Format as JSON with: {issue, currentTranslation, suggestedImprovement, reasoning}`;

    return prompt;
  }

  /**
   * Validate a prompt template for common issues
   */
  static validatePromptTemplate(template: string): { isValid: boolean; issues: string[] } {
    const issues: string[] = [];

    // Check for basic requirements
    if (!template.trim()) {
      issues.push('Template cannot be empty');
    }

    if (template.length < 50) {
      issues.push('Template seems too short for effective translation guidance');
    }

    if (template.length > 10000) {
      issues.push('Template is very long and may cause token limit issues');
    }

    // Check for JSON format requirement
    const hasJsonInstruction = /json|JSON/.test(template);
    if (!hasJsonInstruction) {
      issues.push('Template should mention JSON format requirement for structured outputs');
    }

    // Check for common problematic patterns
    if (template.includes('{{') || template.includes('}}')) {
      issues.push('Template contains double braces which may cause parsing issues');
    }

    // Check for balanced braces in placeholders
    const braceMatches = template.match(/\{[^}]*\}/g) || [];
    const unbalanced = braceMatches.filter(match => !match.endsWith('}'));
    if (unbalanced.length > 0) {
      issues.push('Template contains unbalanced placeholder braces');
    }

    return {
      isValid: issues.length === 0,
      issues
    };
  }

  /**
   * Extract placeholders from a template
   */
  static extractPlaceholders(template: string): string[] {
    const matches = template.match(/\{([^}]+)\}/g) || [];
    return matches.map(match => match.slice(1, -1)).filter((value, index, array) => array.indexOf(value) === index);
  }

  /**
   * Preview a prompt with sample data
   */
  static previewPrompt(template: string, sampleSettings: Partial<AppSettings>): string {
    return this.processSystemPrompt(template, {
      provider: 'Sample',
      model: 'sample-model',
      temperature: 0.7,
      systemPrompt: template,
      ...sampleSettings
    } as AppSettings);
  }
}

// Re-export for convenience
export { promptRegistry } from './PromptRegistry';
export type { PromptTemplate } from './PromptRegistry';

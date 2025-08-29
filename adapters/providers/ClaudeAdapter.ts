import type { TranslationProvider, TranslationRequest } from '../../services/translate/Translator';
import type { TranslationResult } from '../../types';
import { translateWithClaude } from '../../services/claudeService';

/**
 * Claude provider adapter that bridges the new adapter pattern with the existing Claude service
 */
export class ClaudeAdapter implements TranslationProvider {
  async translate(request: TranslationRequest): Promise<TranslationResult> {
    return translateWithClaude(
      request.title,
      request.content,
      request.settings,
      request.history,
      request.fanTranslation
    );
  }
}
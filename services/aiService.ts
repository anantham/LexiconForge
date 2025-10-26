import { validateApiKey } from './ai/apiKeyValidation';
import { calculateCost } from './ai/cost';
import { translateChapter } from './ai/translatorRouter';
import { translateWithGemini } from './ai/providers/gemini';
import { translateWithOpenAI } from './ai/providers/openai';
import { extractBalancedJson, replacePlaceholders } from './ai/textUtils';
import { validateAndFixIllustrations, validateAndFixFootnotes } from './ai/responseValidators';
import { validateAndClampParameter } from './ai/parameters';

export { validateApiKey, calculateCost, translateChapter };

export const __testUtils = {
  extractBalancedJson,
  replacePlaceholders,
  validateAndFixIllustrations,
  validateAndFixFootnotes,
  validateAndClampParameter,
  translateWithGemini,
  translateWithOpenAI,
};

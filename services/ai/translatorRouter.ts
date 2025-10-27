import { incrementDefaultKeyUsage } from '@/services/defaultApiKeyService';
import { getEnvVar } from '@/services/env';
import type { AppSettings, HistoricalChapter, TranslationResult } from '@/types';

export const translateChapter = async (
  title: string,
  content: string,
  settings: AppSettings,
  history: HistoricalChapter[],
  fanTranslation?: string | null,
  maxRetries = 3,
  initialDelay = 2000,
  abortSignal?: AbortSignal,
  chapterId?: string
): Promise<TranslationResult> => {
  const isUsingDefaultKey =
    settings.provider === 'OpenRouter' &&
    !(settings as any).apiKeyOpenRouter &&
    !getEnvVar('OPENROUTER_API_KEY');

  const { initializeProviders } = await import('@/adapters/providers');
  await initializeProviders();

  const { translator } = await import('@/services/translate/Translator');

  try {
    const result = await translator.translate(
      {
        title,
        content,
        settings,
        history,
        fanTranslation,
        abortSignal,
        chapterId,
      },
      {
        maxRetries,
        initialDelay,
      }
    );

    if (isUsingDefaultKey) {
      const newUsage = incrementDefaultKeyUsage();
      console.log(`[Translation] Using default trial key (${newUsage}/10 requests used)`);
    }

    return result;
  } catch (error) {
    if (isUsingDefaultKey) {
      console.log('[Translation] Request failed, trial counter not incremented');
    }
    throw error;
  }
};

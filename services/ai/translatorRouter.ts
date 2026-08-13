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
  const { initializeProviders } = await import('@/adapters/providers');
  await initializeProviders();

  const { translator } = await import('@/services/translate/Translator');

  return translator.translate(
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
};

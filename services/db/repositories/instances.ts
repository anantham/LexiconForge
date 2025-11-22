import { getConnection } from '../core/connection';
import { STORE_NAMES } from '../core/schema';
import { normalizeUrlAggressively } from '../../stableIdService';
import { ChapterRepository } from './ChapterRepository';
import { TranslationRepository } from './TranslationRepository';
import { SettingsRepository } from './SettingsRepository';
import { FeedbackRepository } from './FeedbackRepository';
import { PromptTemplatesRepository } from './PromptTemplatesRepository';

const chapterRepository = new ChapterRepository({
  getDb: () => getConnection(),
  normalizeUrl: normalizeUrlAggressively,
  stores: {
    CHAPTERS: STORE_NAMES.CHAPTERS,
  },
});

const translationRepository = new TranslationRepository({
  getDb: () => getConnection(),
  getChapter: (url: string) => chapterRepository.getChapter(url),
  stores: {
    TRANSLATIONS: STORE_NAMES.TRANSLATIONS,
    CHAPTERS: STORE_NAMES.CHAPTERS,
    URL_MAPPINGS: STORE_NAMES.URL_MAPPINGS,
  },
});

const settingsRepository = new SettingsRepository({
  getDb: () => getConnection(),
  stores: { SETTINGS: STORE_NAMES.SETTINGS },
});

const feedbackRepository = new FeedbackRepository({
  getDb: () => getConnection(),
  stores: { FEEDBACK: STORE_NAMES.FEEDBACK },
});

const promptTemplatesRepository = new PromptTemplatesRepository({
  getDb: () => getConnection(),
  stores: { PROMPT_TEMPLATES: STORE_NAMES.PROMPT_TEMPLATES },
});

export {
  chapterRepository,
  translationRepository,
  settingsRepository,
  feedbackRepository,
  promptTemplatesRepository,
};

// Main Repo interface (unified)
export type { Repo } from './Repo';
export { IndexedDbRepo as repo } from './IndexedDbRepo';

// Individual domain repos
export { chaptersRepo, type ChaptersRepo } from './ChaptersRepo';
export { translationsRepo, type TranslationsRepo } from './TranslationsRepo';
export { settingsRepo, type SettingsRepo } from './SettingsRepo';
export { feedbackRepo, type FeedbackRepo } from './FeedbackRepo';
export { urlMappingsRepo, type UrlMappingsRepo } from './UrlMappingsRepo';
export { promptTemplatesRepo, type PromptTemplatesRepo } from './PromptTemplatesRepo';
export { novelsRepo, type NovelsRepo } from './NovelsRepo';


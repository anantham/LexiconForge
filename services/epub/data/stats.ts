import { ChapterForEpub, TranslationStats } from '../types';

/**
 * Calculates comprehensive statistics from collected chapters
 */
export const calculateTranslationStats = (chapters: ChapterForEpub[]): TranslationStats => {
  const stats: TranslationStats = {
    totalCost: 0,
    totalTime: 0,
    totalTokens: 0,
    chapterCount: chapters.length,
    imageCount: 0,
    providerBreakdown: {},
    modelBreakdown: {}
  };

  chapters.forEach(chapter => {
    const metrics = chapter.usageMetrics;
    
    // Aggregate totals
    stats.totalCost += metrics.estimatedCost;
    stats.totalTime += metrics.requestTime;
    stats.totalTokens += metrics.totalTokens;
    stats.imageCount += chapter.images.length;

    // Provider breakdown
    if (!stats.providerBreakdown[metrics.provider]) {
      stats.providerBreakdown[metrics.provider] = {
        chapters: 0,
        cost: 0,
        time: 0,
        tokens: 0
      };
    }
    const providerStats = stats.providerBreakdown[metrics.provider];
    providerStats.chapters += 1;
    providerStats.cost += metrics.estimatedCost;
    providerStats.time += metrics.requestTime;
    providerStats.tokens += metrics.totalTokens;

    // Model breakdown
    if (!stats.modelBreakdown[metrics.model]) {
      stats.modelBreakdown[metrics.model] = {
        chapters: 0,
        cost: 0,
        time: 0,
        tokens: 0
      };
    }
    const modelStats = stats.modelBreakdown[metrics.model];
    modelStats.chapters += 1;
    modelStats.cost += metrics.estimatedCost;
    modelStats.time += metrics.requestTime;
    modelStats.tokens += metrics.totalTokens;
  });

  return stats;
};

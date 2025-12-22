import { SessionChapterData } from '../../../types';
import { ChapterForEpub } from '../types';

/**
 * Creates a ChapterForEpub object from session data
 */
export const createChapterForEpub = (data: any, url: string): ChapterForEpub => {
  // Create default metrics for chapters missing usage data
  let metrics = data.translationResult.usageMetrics;
  
  if (!metrics) {
    console.warn(`[EPUBService] Chapter ${url} missing usageMetrics - using defaults for statistics`);
    metrics = {
        totalTokens: 0,
        promptTokens: 0,
        completionTokens: 0,
        estimatedCost: 0,
        requestTime: 0,
        provider: 'Unknown',
        model: 'Unknown'
      };
    } else {
      // Validate and fix invalid metrics values
      const fixedMetrics = {
        totalTokens: typeof metrics.totalTokens === 'number' && isFinite(metrics.totalTokens) ? metrics.totalTokens : 0,
        promptTokens: typeof metrics.promptTokens === 'number' && isFinite(metrics.promptTokens) ? metrics.promptTokens : 0,
        completionTokens: typeof metrics.completionTokens === 'number' && isFinite(metrics.completionTokens) ? metrics.completionTokens : 0,
        estimatedCost: typeof metrics.estimatedCost === 'number' && isFinite(metrics.estimatedCost) ? metrics.estimatedCost : 0,
        requestTime: typeof metrics.requestTime === 'number' && isFinite(metrics.requestTime) ? metrics.requestTime : 0,
        provider: typeof metrics.provider === 'string' ? metrics.provider : 'Unknown',
        model: typeof metrics.model === 'string' ? metrics.model : 'Unknown'
      };
      
      // Check if we had to fix any values
      const hadInvalidData = Object.keys(metrics).some(key => 
        metrics[key] !== fixedMetrics[key]
      );
      
      if (hadInvalidData) {
        console.warn(`[EPUBService] Chapter ${url} had invalid usageMetrics - fixed for statistics:`, {
          original: metrics,
          fixed: fixedMetrics
        });
      }
      
    metrics = fixedMetrics;
  }
  
  // Get images from translation result
  const images = data.translationResult.suggestedIllustrations?.map((illust: any) => ({
    marker: illust.placementMarker,
    imageData: illust.url || '', // This should be base64 data from generation
    prompt: illust.imagePrompt
  })) || [];
  
  // Get footnotes from translation result
  const footnotes = data.translationResult.footnotes?.map((footnote: any) => ({
    marker: footnote.marker,
    text: footnote.text
  })) || [];
  
  const translatedContent = data.translationResult.translation || '';

  return {
    title: data.chapter.title,
    originalTitle: data.chapter.originalTitle || data.chapter.title,
    content: data.chapter.content,
    originalUrl: url,
    url,
    translatedTitle: data.translationResult.translatedTitle,
    translatedContent,
    prevUrl: data.chapter.prevUrl ?? null,
    nextUrl: data.chapter.nextUrl ?? null,
    usageMetrics: {
      totalTokens: metrics.totalTokens,
      promptTokens: metrics.promptTokens,
      completionTokens: metrics.completionTokens,
      estimatedCost: metrics.estimatedCost,
      requestTime: metrics.requestTime,
      provider: metrics.provider,
      model: metrics.model,
    },
    images: images.filter((img: any) => img.imageData), // Only include images with data
    footnotes: footnotes
  };
};

/**
 * Collects active version chapters from session data for EPUB export
 * Uses activeVersion tracking to determine which translation to include
 */
export const collectActiveVersions = (
  sessionData: Record<string, SessionChapterData>,
  urlHistory: string[]
): ChapterForEpub[] => {
  const chapters: ChapterForEpub[] = [];
  
  // Use urlHistory for ordering, but also include any chapters not in history
  // First, process chapters in urlHistory order to maintain chronological sequence
  const processedUrls = new Set<string>();
  
  // Add chapters from urlHistory first (in order)
  for (const url of urlHistory) {
    if (sessionData[url]?.chapter && sessionData[url]?.translationResult) {
      processedUrls.add(url);
      const data = sessionData[url];
      chapters.push(createChapterForEpub(data, url));
    }
  }
  
  // Then add any remaining chapters not in urlHistory (sorted by URL for consistency)
  const remainingUrls = Object.keys(sessionData)
    .filter(url => !processedUrls.has(url))
    .sort();
  
  for (const url of remainingUrls) {
    const data = sessionData[url];
    if (!data?.chapter || !data?.translationResult) {
      console.log(`[EPUBService] Skipping ${url} - missing chapter or translation result`);
      continue;
    }
    
    chapters.push(createChapterForEpub(data, url));
  }
  
  console.log(`[EPUBService] Prepared ${chapters.length} chapters for EPUB in chronological order`);
  return chapters;
};

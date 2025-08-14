import { SessionChapterData, AppSettings } from '../types';
import JSZip from 'jszip';

export interface ChapterForEpub {
  title: string;
  content: string;
  originalUrl: string;
  translatedTitle: string;
  usageMetrics: {
    totalTokens: number;
    promptTokens: number;
    completionTokens: number;
    estimatedCost: number;
    requestTime: number;
    provider: string;
    model: string;
  };
  images: Array<{
    marker: string;
    imageData: string; // base64 data URL
    prompt: string;
  }>;
  footnotes?: Array<{
    marker: string;
    text: string;
  }>;
}

export interface TranslationStats {
  totalCost: number;
  totalTime: number;
  totalTokens: number;
  chapterCount: number;
  imageCount: number;
  providerBreakdown: Record<string, {
    chapters: number;
    cost: number;
    time: number;
    tokens: number;
  }>;
  modelBreakdown: Record<string, {
    chapters: number;
    cost: number;
    time: number;
    tokens: number;
  }>;
}

export interface NovelConfig {
  title: string;
  author: string;
  originalTitle?: string;
  description?: string;
  genre?: string;
  language: string;
  originalLanguage?: string;
  coverImage?: string; // base64 or URL
  seriesName?: string;
  volumeNumber?: number;
  isbn?: string;
  publisher?: string;
  translationNotes?: string;
}

export interface EpubTemplate {
  gratitudeMessage?: string;
  projectDescription?: string;
  githubUrl?: string;
  additionalAcknowledgments?: string;
  customFooter?: string;
}

export interface EpubExportOptions {
  title?: string;
  author?: string;
  description?: string;
  chapters: ChapterForEpub[];
  settings: AppSettings;
  template?: EpubTemplate;
  novelConfig?: NovelConfig;
}

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
  const allUrls = new Set([...urlHistory, ...Object.keys(sessionData)]);
  
  for (const url of allUrls) {
    const data = sessionData[url];
    if (!data?.chapter || !data?.translationResult) {
      console.log(`[EPUBService] Skipping ${url} - missing chapter or translation result`);
      continue;
    }
    
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
    const images = data.translationResult.suggestedIllustrations?.map(illust => ({
      marker: illust.placementMarker,
      imageData: illust.url || '', // This should be base64 data from generation
      prompt: illust.imagePrompt
    })) || [];
    
    // Get footnotes from translation result
    const footnotes = data.translationResult.footnotes?.map(footnote => ({
      marker: footnote.marker,
      text: footnote.text
    })) || [];
    
    chapters.push({
      title: data.chapter.title,
      content: data.translationResult.translation || data.chapter.content, // Use translation, fallback to original
      originalUrl: url,
      translatedTitle: data.translationResult.translatedTitle,
      usageMetrics: {
        totalTokens: metrics.totalTokens,
        promptTokens: metrics.promptTokens,
        completionTokens: metrics.completionTokens,
        estimatedCost: metrics.estimatedCost,
        requestTime: metrics.requestTime,
        provider: metrics.provider,
        model: metrics.model,
      },
      images: images.filter(img => img.imageData), // Only include images with data
      footnotes: footnotes
    });
  }
  
  return chapters;
};

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

/**
 * Default template for EPUB metadata
 * This template can be customized by users to personalize their EPUB exports
 */
export const getDefaultTemplate = (): EpubTemplate => ({
  gratitudeMessage: `This translation was made possible through the remarkable capabilities of modern AI language models. We express our deep gratitude to the teams behind these technologies who have made creative translation accessible to everyone.`,
  
  projectDescription: `This e-book was generated using LexiconForge, an open-source AI translation platform that enables high-quality, creative translations of literature. The platform supports multiple AI providers and allows for collaborative refinement of translations.`,
  
  githubUrl: 'https://github.com/user/LexiconForge',
  
  additionalAcknowledgments: `Special thanks to the original authors whose creative works inspire these translations, and to the open-source community that makes tools like this possible. Translation is an art that bridges cultures and languages, bringing stories to new audiences worldwide.`,
  
  customFooter: `Generated with love using AI translation technology`
});

/**
 * Creates a customizable template - users can override any field
 * Example usage:
 * const myTemplate = createCustomTemplate({
 *   gratitudeMessage: 'My custom gratitude message...',
 *   githubUrl: 'https://github.com/myuser/myproject'
 * });
 */
export const createCustomTemplate = (overrides: Partial<EpubTemplate>): EpubTemplate => {
  return { ...getDefaultTemplate(), ...overrides };
};

/**
 * Gets novel configuration based on URL or manual configuration
 * This allows for novel-specific metadata like title, author, etc.
 */
export const getNovelConfig = (firstChapterUrl?: string, manualConfig?: Partial<NovelConfig>): NovelConfig => {
  // Default configuration
  const defaultConfig: NovelConfig = {
    title: 'Translated Novel',
    author: 'Unknown Author',
    language: 'en',
    originalLanguage: 'ja',
    publisher: 'LexiconForge Community'
  };

  // Novel-specific configurations based on URL patterns
  let novelSpecificConfig: Partial<NovelConfig> = {};

  if (firstChapterUrl) {
    if (firstChapterUrl.includes('kakuyomu.jp')) {
      // Enhanced configuration based on Novel Updates data
      novelSpecificConfig = {
        title: 'The Reincarnation of the Strongest Exorcist in Another World',
        author: 'Kosuzu Kiichi',
        originalTitle: '最強陰陽師の異世界転生記 〜下僕の妖怪どもに比べてモンスターが弱すぎるんだが〜',
        description: 'Haruyoshi, the strongest exorcist was on the verge of death after the betrayal of his companions. Hoping to be happy in the next life, he tried the secret technique of reincarnation and was sent to a different world! Born into a family of magicians, the magic he failed to inherit was nothing compared to his previous skills as an exorcist. "Who needs magic? I\'ll survive in this world with my old techniques!"',
        genre: 'Action, Adventure, Fantasy, Harem, Romance',
        originalLanguage: 'ja',
        seriesName: 'The Reincarnation of the Strongest Exorcist',
        volumeNumber: 1,
        isbn: 'urn:uuid:strongest-exorcist-v1',
        publisher: 'Futabasha (Original) / J-Novel Club (English)',
        translationNotes: 'Translated from Japanese web novel published on Kakuyomu and Syosetu. Originally published in 2018 by Kosuzu Kiichi. Licensed by J-Novel Club for English publication. This is an AI-powered fan translation for educational and entertainment purposes.'
      };
    } else if (firstChapterUrl.includes('booktoki468.com')) {
      novelSpecificConfig = {
        title: 'Dungeon Defense',
        author: 'Yoo Heonhwa',
        originalTitle: '던전 디펜스',
        description: 'A dark fantasy novel about survival and strategy in a dungeon world where the protagonist must use cunning and manipulation to survive against overwhelming odds.',
        genre: 'Dark Fantasy, Strategy, Psychological',
        originalLanguage: 'ko',
        seriesName: 'Dungeon Defense',
        volumeNumber: 1,
        isbn: 'urn:uuid:dungeon-defense-v1',
        publisher: 'BookToki (Original)',
        translationNotes: 'Translated from Korean web novel published on BookToki. Known for its complex psychological elements and strategic gameplay mechanics.'
      };
    } else if (firstChapterUrl.includes('syosetu.com') || firstChapterUrl.includes('ncode.syosetu.com')) {
      // Syosetu - Japanese web novel platform
      novelSpecificConfig = {
        title: 'Web Novel from Syosetu',
        author: 'Unknown Syosetu Author',
        originalTitle: '小説家になろう作品',
        description: 'Japanese web novel from the popular Syosetu platform.',
        genre: 'Web Novel, Japanese Literature',
        originalLanguage: 'ja',
        publisher: 'Syosetu (Original)',
        translationNotes: 'Translated from Japanese web novel published on Syosetu (Shōsetsuka ni Narō).'
      };
    } else if (firstChapterUrl.includes('novelupdates.com')) {
      // Novel Updates - aggregator site
      novelSpecificConfig = {
        title: 'Novel from Novel Updates',
        author: 'Unknown Author',
        description: 'Novel sourced from Novel Updates database.',
        genre: 'Various',
        publisher: 'Novel Updates Community',
        translationNotes: 'Novel information sourced from Novel Updates community database.'
      };
    }
    // Add more novel configurations as needed
  }

  return { 
    ...defaultConfig, 
    ...novelSpecificConfig, 
    ...manualConfig 
  };
};

/**
 * Generates a professional title page using novel metadata
 */
const generateTitlePage = (novelConfig: NovelConfig, stats: TranslationStats): string => {
  let titlePageHtml = `<div class="title-page">\n`;
  
  // Main title
  titlePageHtml += `<h1>${escapeXml(novelConfig.title)}</h1>\n`;
  
  // Original title (if different)
  if (novelConfig.originalTitle && novelConfig.originalTitle !== novelConfig.title) {
    titlePageHtml += `<div class="subtitle">${escapeXml(novelConfig.originalTitle)}</div>\n`;
  }
  
  // Author
  titlePageHtml += `<div class="author">by ${escapeXml(novelConfig.author)}</div>\n`;
  
  // Metadata section
  titlePageHtml += `<div class="metadata">\n`;
  
  if (novelConfig.description) {
    titlePageHtml += `<p><strong>Description:</strong><br/>${escapeXml(novelConfig.description)}</p>\n`;
  }
  
  if (novelConfig.genre) {
    titlePageHtml += `<p><strong>Genre:</strong> ${escapeXml(novelConfig.genre)}</p>\n`;
  }
  
  if (novelConfig.originalLanguage && novelConfig.language) {
    const langMap: Record<string, string> = {
      'ja': 'Japanese', 'ko': 'Korean', 'zh': 'Chinese', 
      'en': 'English', 'fr': 'French', 'de': 'German'
    };
    const fromLang = langMap[novelConfig.originalLanguage] || novelConfig.originalLanguage;
    const toLang = langMap[novelConfig.language] || novelConfig.language;
    titlePageHtml += `<p><strong>Translation:</strong> ${fromLang} → ${toLang}</p>\n`;
  }
  
  if (novelConfig.seriesName && novelConfig.volumeNumber) {
    titlePageHtml += `<p><strong>Series:</strong> ${escapeXml(novelConfig.seriesName)}, Volume ${novelConfig.volumeNumber}</p>\n`;
  }
  
  if (novelConfig.publisher) {
    titlePageHtml += `<p><strong>Publisher:</strong> ${escapeXml(novelConfig.publisher)}</p>\n`;
  }
  
  // Translation statistics
  titlePageHtml += `<p><strong>Translation Stats:</strong> ${stats.chapterCount} chapters, `;
  titlePageHtml += `${stats.totalTokens.toLocaleString()} tokens processed, `;
  titlePageHtml += `$${stats.totalCost.toFixed(4)} cost</p>\n`;
  
  if (novelConfig.translationNotes) {
    titlePageHtml += `<p><em>${escapeXml(novelConfig.translationNotes)}</em></p>\n`;
  }
  
  titlePageHtml += `<p><strong>Generated:</strong> ${new Date().toLocaleDateString()}</p>\n`;
  titlePageHtml += `</div>\n`; // metadata
  titlePageHtml += `</div>\n`; // title-page
  
  return titlePageHtml;
};

/**
 * Generates a comprehensive table of contents page with navigation links
 */
const generateTableOfContents = (chapters: ChapterForEpub[]): string => {
  let tocHtml = `<h1 style="text-align: center; border-bottom: 2px solid #333; padding-bottom: 1em;">Table of Contents</h1>\n\n`;
  
  tocHtml += `<div style="margin: 2em 0;">\n`;
  tocHtml += `<p style="text-align: center; font-style: italic; color: #666;">This translation contains ${chapters.length} chapters</p>\n`;
  tocHtml += `</div>\n\n`;

  tocHtml += `<ol style="list-style-type: decimal; padding-left: 2em; line-height: 1.8;">\n`;
  
  chapters.forEach((chapter, index) => {
    const chapterTitle = chapter.translatedTitle || chapter.title || `Chapter ${index + 1}`;
    const chapterHref = `chapter-${String(index + 1).padStart(4, '0')}.xhtml`;
    
    tocHtml += `  <li style="margin-bottom: 0.5em;">\n`;
    tocHtml += `    <a href="${chapterHref}" style="text-decoration: none; color: #007bff;"><strong>${escapeXml(chapterTitle)}</strong></a>\n`;
    tocHtml += `    <div style="font-size: 0.85em; color: #666; margin-top: 0.2em;">\n`;
    tocHtml += `      Translated with ${escapeXml(chapter.usageMetrics.provider)} ${escapeXml(chapter.usageMetrics.model)}\n`;
    if (chapter.images && chapter.images.length > 0) {
      tocHtml += ` • ${chapter.images.length} illustration${chapter.images.length > 1 ? 's' : ''}`;
    }
    if (chapter.footnotes && chapter.footnotes.length > 0) {
      tocHtml += ` • ${chapter.footnotes.length} footnote${chapter.footnotes.length > 1 ? 's' : ''}`;
    }
    tocHtml += `    </div>\n`;
    tocHtml += `  </li>\n`;
  });
  
  tocHtml += `</ol>\n`;
  
  return tocHtml;
};

/**
 * Generates a detailed statistics and acknowledgments page
 */
const generateStatsAndAcknowledgments = (stats: TranslationStats, template: EpubTemplate): string => {
  let html = `<h1 style="text-align: center; border-bottom: 2px solid #333; padding-bottom: 1em;">Translation Details & Acknowledgments</h1>\n\n`;

  // Project description
  html += `<div style="margin: 2em 0; padding: 1.5em; background: #f8f9fa; border-left: 4px solid #007bff; border-radius: 4px;">\n`;
  html += `<h2 style="margin-top: 0; color: #007bff;">About This Translation</h2>\n`;
  html += `<p>${escapeHtml(template.projectDescription || '')}</p>\n`;
  if (template.githubUrl) {
    html += `<p><strong>Source Code:</strong> <a href="${escapeHtml(template.githubUrl)}" style="color: #007bff;">${escapeHtml(template.githubUrl)}</a></p>\n`;
  }
  html += `</div>\n\n`;

  // Translation statistics
  html += `<div style="margin: 2em 0;">\n`;
  html += `<h2 style="color: #28a745; border-bottom: 1px solid #28a745; padding-bottom: 0.5em;">Translation Statistics</h2>\n`;
  
  html += `<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1em; margin: 1em 0;">\n`;
  html += `  <div style="text-align: center; padding: 1em; background: #e7f3ff; border-radius: 8px;">\n`;
  html += `    <div style="font-size: 2em; font-weight: bold; color: #007bff;">${stats.chapterCount}</div>\n`;
  html += `    <div style="color: #666;">Chapters</div>\n`;
  html += `  </div>\n`;
  html += `  <div style="text-align: center; padding: 1em; background: #e7f8e7; border-radius: 8px;">\n`;
  html += `    <div style="font-size: 2em; font-weight: bold; color: #28a745;">$${stats.totalCost.toFixed(4)}</div>\n`;
  html += `    <div style="color: #666;">Total Cost</div>\n`;
  html += `  </div>\n`;
  html += `  <div style="text-align: center; padding: 1em; background: #fff3e0; border-radius: 8px;">\n`;
  html += `    <div style="font-size: 2em; font-weight: bold; color: #f57c00;">${Math.round(stats.totalTime)}s</div>\n`;
  html += `    <div style="color: #666;">Total Time</div>\n`;
  html += `  </div>\n`;
  html += `  <div style="text-align: center; padding: 1em; background: #fce4ec; border-radius: 8px;">\n`;
  html += `    <div style="font-size: 2em; font-weight: bold; color: #c2185b;">${stats.totalTokens.toLocaleString()}</div>\n`;
  html += `    <div style="color: #666;">Total Tokens</div>\n`;
  html += `  </div>\n`;
  if (stats.imageCount > 0) {
    html += `  <div style="text-align: center; padding: 1em; background: #f3e5f5; border-radius: 8px;">\n`;
    html += `    <div style="font-size: 2em; font-weight: bold; color: #7b1fa2;">${stats.imageCount}</div>\n`;
    html += `    <div style="color: #666;">Images Generated</div>\n`;
    html += `  </div>\n`;
  }
  html += `</div>\n`;
  html += `</div>\n\n`;

  // Provider breakdown
  const providers = Object.keys(stats.providerBreakdown);
  if (providers.length > 0) {
    html += `<div style="margin: 2em 0;">\n`;
    html += `<h3 style="color: #6f42c1;">Translation Providers Used</h3>\n`;
    html += `<table style="width: 100%; border-collapse: collapse; margin: 1em 0;">\n`;
    html += `  <thead>\n`;
    html += `    <tr style="background: #f8f9fa;">\n`;
    html += `      <th style="border: 1px solid #dee2e6; padding: 0.75em; text-align: left;">Provider</th>\n`;
    html += `      <th style="border: 1px solid #dee2e6; padding: 0.75em; text-align: center;">Chapters</th>\n`;
    html += `      <th style="border: 1px solid #dee2e6; padding: 0.75em; text-align: center;">Cost</th>\n`;
    html += `      <th style="border: 1px solid #dee2e6; padding: 0.75em; text-align: center;">Time</th>\n`;
    html += `    </tr>\n`;
    html += `  </thead>\n`;
    html += `  <tbody>\n`;
    
    providers.forEach(provider => {
      const providerStats = stats.providerBreakdown[provider];
      html += `    <tr>\n`;
      html += `      <td style="border: 1px solid #dee2e6; padding: 0.75em; font-weight: bold;">${escapeHtml(provider)}</td>\n`;
      html += `      <td style="border: 1px solid #dee2e6; padding: 0.75em; text-align: center;">${providerStats.chapters}</td>\n`;
      html += `      <td style="border: 1px solid #dee2e6; padding: 0.75em; text-align: center;">$${providerStats.cost.toFixed(4)}</td>\n`;
      html += `      <td style="border: 1px solid #dee2e6; padding: 0.75em; text-align: center;">${Math.round(providerStats.time)}s</td>\n`;
      html += `    </tr>\n`;
    });
    
    html += `  </tbody>\n`;
    html += `</table>\n`;
    html += `</div>\n\n`;
  }

  // Model breakdown (top 10 most used)
  const models = Object.entries(stats.modelBreakdown)
    .sort(([,a], [,b]) => b.chapters - a.chapters)
    .slice(0, 10);
    
  if (models.length > 0) {
    html += `<div style="margin: 2em 0;">\n`;
    html += `<h3 style="color: #dc3545;">AI Models Used</h3>\n`;
    html += `<table style="width: 100%; border-collapse: collapse; margin: 1em 0;">\n`;
    html += `  <thead>\n`;
    html += `    <tr style="background: #f8f9fa;">\n`;
    html += `      <th style="border: 1px solid #dee2e6; padding: 0.75em; text-align: left;">Model</th>\n`;
    html += `      <th style="border: 1px solid #dee2e6; padding: 0.75em; text-align: center;">Chapters</th>\n`;
    html += `      <th style="border: 1px solid #dee2e6; padding: 0.75em; text-align: center;">Tokens</th>\n`;
    html += `    </tr>\n`;
    html += `  </thead>\n`;
    html += `  <tbody>\n`;
    
    models.forEach(([model, modelStats]) => {
      html += `    <tr>\n`;
      html += `      <td style="border: 1px solid #dee2e6; padding: 0.75em; font-family: monospace; font-size: 0.9em;">${escapeHtml(model)}</td>\n`;
      html += `      <td style="border: 1px solid #dee2e6; padding: 0.75em; text-align: center;">${modelStats.chapters}</td>\n`;
      html += `      <td style="border: 1px solid #dee2e6; padding: 0.75em; text-align: center;">${modelStats.tokens.toLocaleString()}</td>\n`;
      html += `    </tr>\n`;
    });
    
    html += `  </tbody>\n`;
    html += `</table>\n`;
    html += `</div>\n\n`;
  }

  // Gratitude message
  html += `<div style="margin: 3em 0; padding: 2em; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 12px;">\n`;
  html += `<h2 style="margin-top: 0; color: white; text-align: center;">Gratitude & Acknowledgments</h2>\n`;
  html += `<p style="font-size: 1.1em; line-height: 1.6; text-align: justify;">${escapeHtml(template.gratitudeMessage || '')}</p>\n`;
  if (template.additionalAcknowledgments) {
    html += `<p style="font-size: 1.1em; line-height: 1.6; text-align: justify;">${escapeHtml(template.additionalAcknowledgments)}</p>\n`;
  }
  html += `</div>\n\n`;

  // Footer
  if (template.customFooter) {
    html += `<div style="margin: 2em 0; text-align: center; padding: 1em; border-top: 1px solid #dee2e6; font-style: italic; color: #666;">\n`;
    html += `${escapeHtml(template.customFooter)}\n`;
    html += `</div>\n`;
  }

  html += `<div style="margin: 2em 0; text-align: center; padding: 1em; border-top: 1px solid #dee2e6; font-size: 0.9em; color: #666;">\n`;
  html += `<p><em>Translation completed on ${new Date().toLocaleDateString()}</em></p>\n`;
  html += `</div>\n`;

  return html;
};

/**
 * Converts chapter content with illustrations and footnotes to XHTML suitable for EPUB
 */
const convertChapterToHtml = (chapter: ChapterForEpub): string => {
  let htmlContent = chapter.translatedTitle ? 
    `<h1>${escapeXml(chapter.translatedTitle)}</h1>\n\n` : 
    `<h1>${escapeXml(chapter.title)}</h1>\n\n`;
  
  // Get the translated content, fallback to original if needed
  let content = chapter.content;
  
  // Process content and embed images
  if (chapter.images.length > 0) {
    // Replace illustration markers with actual images
    for (const image of chapter.images) {
      const imgHtml = `<div class="illustration">
        <img src="${escapeXml(image.imageData)}" alt="${escapeXml(image.prompt)}" style="max-width: 100%; height: auto; display: block; margin: 1em auto;" />
        <p class="illustration-caption" style="text-align: center; font-style: italic; color: #666; font-size: 0.9em; margin-top: 0.5em;">${escapeXml(image.prompt)}</p>
      </div>`;
      
      content = content.replace(image.marker, imgHtml);
    }
  }
  
  // Process and embed footnotes
  if (chapter.footnotes && chapter.footnotes.length > 0) {
    // Replace footnote markers with links
    for (const footnote of chapter.footnotes) {
      const footnoteLink = `<a href="#fn${footnote.marker}" class="footnote-ref" id="fnref${footnote.marker}" epub:type="noteref">[${footnote.marker}]</a>`;
      content = content.replace(`[${footnote.marker}]`, footnoteLink);
    }
    
    // Add footnotes section at the end
    let footnotesHtml = '<div class="footnotes">\n<h3>Footnotes</h3>\n<ol>\n';
    for (const footnote of chapter.footnotes) {
      footnotesHtml += `<li id="fn${footnote.marker}" epub:type="footnote">
        ${escapeXml(footnote.text)}
        <a href="#fnref${footnote.marker}" class="footnote-backref" epub:type="backlink">↩</a>
      </li>\n`;
    }
    footnotesHtml += '</ol>\n</div>\n';
    content += '\n' + footnotesHtml;
  }
  
  // Convert content to proper XHTML paragraphs
  content = convertToXhtmlParagraphs(content);
  
  htmlContent += content;
  
  return htmlContent;
};

/**
 * Converts text content to proper XHTML paragraphs without invalid nesting
 */
const convertToXhtmlParagraphs = (content: string): string => {
  // First, escape any remaining unescaped XML entities
  content = content.replace(/&(?!(amp|lt|gt|quot|apos);)/g, '&amp;');
  
  // Split content by double newlines to create paragraphs
  const paragraphs = content.split(/\n\s*\n/);
  
  let xhtmlContent = '';
  
  for (let para of paragraphs) {
    para = para.trim();
    if (!para) continue;
    
    // Check if this paragraph already contains block-level HTML elements
    const hasBlockElements = /<(div|p|h[1-6]|ul|ol|li|blockquote|pre|hr|table|form|fieldset|address|center)[^>]*>/i.test(para);
    
    if (hasBlockElements) {
      // Already has block elements, just add it as-is but fix line breaks
      para = para.replace(/\n/g, ' '); // Convert single line breaks to spaces within block elements
      xhtmlContent += para + '\n\n';
    } else {
      // Regular text paragraph - wrap in <p> and convert line breaks to <br/>
      para = para.replace(/\n/g, '<br/>'); // Use self-closing br tags for XHTML
      xhtmlContent += `<p>${para}</p>\n\n`;
    }
  }
  
  return xhtmlContent.trim();
};

/**
 * Escape HTML characters to prevent XSS and formatting issues (kept for backward compatibility)
 */
const escapeHtml = (text: string): string => {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
};

/**
 * Generates and downloads an EPUB file from the collected chapters using JSZip (browser-compatible)
 */
export const generateEpub = async (options: EpubExportOptions): Promise<void> => {
  if (options.chapters.length === 0) {
    throw new Error('No chapters available for EPUB export. Please ensure you have translated chapters with complete usage metrics before exporting.');
  }
  
  console.log(`[EPUBService] Generating EPUB with ${options.chapters.length} valid chapters`);
  
  // Use provided template or default
  const template = { ...getDefaultTemplate(), ...options.template };
  
  // Calculate comprehensive statistics
  const stats = calculateTranslationStats(options.chapters);
  
  // Get novel configuration (auto-detect from first chapter URL or use manual config)
  const firstChapter = options.chapters[0];
  const firstChapterUrl = firstChapter.originalUrl;
  const novelConfig = getNovelConfig(firstChapterUrl, options.novelConfig);
  
  // Use novel configuration for metadata (with fallbacks)
  const title = options.title || novelConfig.title;
  const author = options.author || novelConfig.author;
  const description = options.description || novelConfig.description || 
    `${novelConfig.translationNotes || 'AI-translated novel'} containing ${options.chapters.length} chapters. ` +
    `Total cost: $${stats.totalCost.toFixed(4)}, ` +
    `translated using ${Object.keys(stats.providerBreakdown).join(', ')}.`;
  const language = novelConfig.language || 'en';
  const bookId = novelConfig.isbn || `urn:uuid:${crypto.randomUUID()}`;
  
  // Generate special pages  
  const titlePage = generateTitlePage(novelConfig, stats);
  const tableOfContents = generateTableOfContents(options.chapters);
  const statsAndAcknowledgments = generateStatsAndAcknowledgments(stats, template);
  
  // Convert chapters to EPUB3-compatible format
  const chapters = [
    // Title page (first)
    {
      id: 'title-page',
      title: 'Title Page',
      xhtml: titlePage,
      href: 'title.xhtml'
    },
    // Table of Contents (second)
    {
      id: 'toc-page',
      title: 'Table of Contents', 
      xhtml: tableOfContents,
      href: 'toc.xhtml'
    },
    // Main chapters
    ...options.chapters.map((chapter, index) => ({
      id: `ch-${String(index + 1).padStart(3, '0')}`,
      title: chapter.translatedTitle || chapter.title,
      xhtml: convertChapterToHtml(chapter),
      href: `chapter-${String(index + 1).padStart(4, '0')}.xhtml`
    })),
    // Stats and acknowledgments (last page)
    {
      id: 'stats-page',
      title: 'Translation Details & Acknowledgments',
      xhtml: statsAndAcknowledgments,
      href: 'stats.xhtml'
    }
  ];
  
  try {
    console.log('[EPUBService] Generating EPUB with comprehensive statistics:', {
      title,
      author,
      description,
      chapterCount: stats.chapterCount,
      totalImages: stats.imageCount,
      totalCost: `$${stats.totalCost.toFixed(4)}`,
      totalTime: `${Math.round(stats.totalTime)}s`,
      totalTokens: stats.totalTokens.toLocaleString(),
      providersUsed: Object.keys(stats.providerBreakdown),
      topModels: Object.entries(stats.modelBreakdown)
        .sort(([,a], [,b]) => b.chapters - a.chapters)
        .slice(0, 3)
        .map(([model, data]) => `${model} (${data.chapters} ch)`)
    });
    
    // Generate EPUB3 with JSZip
    const epubBuffer = await generateEpub3WithJSZip({
      title,
      author,
      description,
      language,
      identifier: bookId,
      publisher: novelConfig.publisher
    }, chapters);
    
    // Create download link
    const blob = new Blob([epubBuffer], { type: 'application/epub+zip' });
    const url = URL.createObjectURL(blob);
    
    // Generate filename with timestamp
    const timestamp = new Date().toISOString().slice(0, 16).replace(/[:-]/g, '');
    const filename = `translated-novel-${timestamp}.epub`;
    
    // Trigger download
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Cleanup
    URL.revokeObjectURL(url);
    
    console.log(`[EPUBService] Successfully generated and downloaded: ${filename}`);
    
  } catch (error) {
    console.error('[EPUBService] Failed to generate EPUB:', error);
    throw new Error(`EPUB generation failed: ${error}`);
  }
};

// JSZip-based EPUB3 generation types and functions
export interface EpubChapter {
  id: string;
  title: string;
  xhtml: string;
  href: string;
}

export interface EpubMeta {
  title: string;
  author: string;
  description?: string;
  language?: string;
  identifier?: string;
  publisher?: string;
}

/**
 * Generates EPUB3-compliant ZIP file using JSZip (browser-compatible)
 */
const generateEpub3WithJSZip = async (meta: EpubMeta, chapters: EpubChapter[]): Promise<ArrayBuffer> => {
  const lang = meta.language || 'en';
  const bookId = meta.identifier || `urn:uuid:${crypto.randomUUID()}`;
  
  // EPUB3 directory structure
  const oebps = 'OEBPS';
  const textDir = `${oebps}/text`;
  const stylesDir = `${oebps}/styles`;
  const imagesDir = `${oebps}/images`;
  
  // Helper to wrap content in XHTML
  const xhtmlWrap = (title: string, body: string) => `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="${lang}">
  <head>
    <meta charset="utf-8"/>
    <title>${escapeXml(title)}</title>
    <link rel="stylesheet" type="text/css" href="../styles/stylesheet.css"/>
  </head>
  <body>
    ${body}
  </body>
</html>`;

  // Generate navigation document (EPUB3 requirement)
  const navXhtml = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${lang}">
  <head>
    <meta charset="utf-8"/>
    <title>Table of Contents</title>
    <link rel="stylesheet" type="text/css" href="../styles/stylesheet.css"/>
  </head>
  <body>
    <nav epub:type="toc" id="toc">
      <h1>Table of Contents</h1>
      <ol>
        ${chapters.map(ch => `<li><a href="../text/${ch.href}">${escapeXml(ch.title)}</a></li>`).join('\n        ')}
      </ol>
    </nav>
  </body>
</html>`;

  // Generate manifest items for content.opf
  const manifestItems = chapters.map(ch =>
    `<item id="${ch.id}" href="text/${ch.href}" media-type="application/xhtml+xml"/>`
  ).join('\n        ');

  // Generate spine items for content.opf
  const spineItems = chapters.map(ch =>
    `<itemref idref="${ch.id}"/>`
  ).join('\n        ');

  // Content.opf (package document)
  const contentOpf = `<?xml version="1.0" encoding="utf-8"?>
<package version="3.0" xmlns="http://www.idpf.org/2007/opf" unique-identifier="bookid" xml:lang="${lang}">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="bookid">${escapeXml(bookId)}</dc:identifier>
    <dc:title>${escapeXml(meta.title)}</dc:title>
    <dc:language>${lang}</dc:language>
    ${meta.author ? `<dc:creator>${escapeXml(meta.author)}</dc:creator>` : ''}
    ${meta.publisher ? `<dc:publisher>${escapeXml(meta.publisher)}</dc:publisher>` : ''}
    ${meta.description ? `<dc:description>${escapeXml(meta.description)}</dc:description>` : ''}
    <meta property="dcterms:modified">${new Date().toISOString()}</meta>
  </metadata>
  <manifest>
    <item id="nav" href="text/nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="css" href="styles/stylesheet.css" media-type="text/css"/>
        ${manifestItems}
  </manifest>
  <spine>
        ${spineItems}
  </spine>
</package>`;

  // Container.xml (required EPUB metadata)
  const containerXml = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;

  // Professional CSS styling (preserved from original)
  const stylesheet = `
body { 
  font-family: Georgia, serif; 
  line-height: 1.6; 
  max-width: 42em; 
  margin: 0 auto; 
  padding: 1.5em; 
  color: #333;
}
h1 { 
  color: #2c3e50; 
  border-bottom: 2px solid #3498db; 
  padding-bottom: 0.5em;
  margin-bottom: 1em;
  font-weight: bold;
}
h2 {
  color: #27ae60;
  border-bottom: 1px solid #27ae60;
  padding-bottom: 0.3em;
  margin-top: 2em;
  margin-bottom: 1em;
}
h3 {
  color: #8e44ad;
  margin-top: 1.5em;
  margin-bottom: 0.75em;
}
p { 
  margin: 1em 0; 
  text-align: justify; 
  text-indent: 1.5em;
}
.illustration { 
  page-break-inside: avoid; 
  margin: 2em 0;
  text-align: center;
}
.illustration img {
  max-width: 100%;
  height: auto;
  border: 1px solid #ddd;
  border-radius: 4px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}
.illustration-caption { 
  font-style: italic; 
  color: #666; 
  text-align: center; 
  font-size: 0.9em;
  margin-top: 0.5em;
  text-indent: 0;
}
table {
  width: 100%;
  border-collapse: collapse;
  margin: 1em 0;
  font-size: 0.9em;
}
th, td {
  border: 1px solid #ddd;
  padding: 0.75em;
  text-align: left;
}
th {
  background-color: #f8f9fa;
  font-weight: bold;
}
ol, ul {
  margin: 1em 0;
  padding-left: 2em;
}
li {
  margin-bottom: 0.5em;
  line-height: 1.5;
}
.gratitude-section {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 2em;
  border-radius: 12px;
  margin: 3em 0;
}
.gratitude-section h2 {
  color: white;
  border-bottom: 1px solid rgba(255,255,255,0.3);
  text-align: center;
}
.gratitude-section p {
  text-indent: 0;
}
/* Footnotes styling */
.footnotes {
  margin-top: 3em;
  padding-top: 2em;
  border-top: 1px solid #ddd;
}
.footnotes h3 {
  color: #666;
  font-size: 1.1em;
  margin-bottom: 1em;
}
.footnotes ol {
  font-size: 0.9em;
  line-height: 1.4;
}
.footnotes li {
  margin-bottom: 0.75em;
}
.footnote-ref {
  font-size: 0.8em;
  vertical-align: super;
  text-decoration: none;
  color: #007bff;
  font-weight: bold;
}
.footnote-backref {
  margin-left: 0.5em;
  font-size: 0.8em;
  text-decoration: none;
  color: #007bff;
}
.footnote-ref:hover, .footnote-backref:hover {
  text-decoration: underline;
}
/* Title page specific styling */
.title-page {
  text-align: center;
  padding: 4em 2em;
  page-break-after: always;
}
.title-page h1 {
  font-size: 3em;
  margin-bottom: 0.5em;
  color: #2c3e50;
  border: none;
  padding: 0;
}
.title-page .subtitle {
  font-size: 1.5em;
  color: #7f8c8d;
  font-style: italic;
  margin-bottom: 2em;
}
.title-page .author {
  font-size: 1.25em;
  color: #34495e;
  margin-bottom: 1em;
}
.title-page .metadata {
  margin-top: 3em;
  font-size: 0.9em;
  color: #666;
  line-height: 1.6;
}
.title-page .metadata p {
  text-indent: 0;
  margin: 0.5em 0;
}`;

  // Create ZIP with JSZip
  const zip = new JSZip();
  
  // Add mimetype (must be first and uncompressed)
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
  
  // Add META-INF
  zip.file('META-INF/container.xml', containerXml);
  
  // Add OEBPS content
  zip.file(`${oebps}/content.opf`, contentOpf);
  zip.file(`${textDir}/nav.xhtml`, navXhtml);
  zip.file(`${stylesDir}/stylesheet.css`, stylesheet);
  
  // Add chapter files
  for (const chapter of chapters) {
    const safeBody = sanitizeHtml(chapter.xhtml);
    zip.file(`${textDir}/${chapter.href}`, xhtmlWrap(chapter.title, safeBody));
  }
  
  // Generate and return ArrayBuffer
  return await zip.generateAsync({ 
    type: 'arraybuffer', 
    mimeType: 'application/epub+zip' 
  });
};

/**
 * Escapes XML characters to prevent formatting issues
 */
const escapeXml = (text: string): string => {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
};

/**
 * Sanitizes HTML content for EPUB (removes scripts, ensures valid XHTML)
 */
const sanitizeHtml = (html: string): string => {
  // Remove scripts for security
  return html.replace(/<script[\s\S]*?<\/script>/gi, '');
};
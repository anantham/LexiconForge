import { AppSettings, SessionChapterData } from '../types';
import {
  ChapterForEpub,
  EpubExportOptions,
  TranslationStats,
  TelemetryInsights,
  NovelConfig,
  EpubTemplate,
  EpubChapter,
  EpubMeta
} from './epub/types';
import {
  getDefaultTemplate,
  createCustomTemplate
} from './epub/templates/defaults';
import { getNovelConfig } from './epub/templates/novelConfig';
import { calculateTranslationStats } from './epub/data/stats';
import { collectActiveVersions } from './epub/data/collector';
import { generateTitlePage } from './epub/generators/titlePage';
import { generateTableOfContents } from './epub/generators/toc';
import {
  renderTelemetryInsights,
  generateStatsAndAcknowledgments
} from './epub/generators/statsPage';
import {
  buildChapterXhtml,
  htmlFragmentToXhtml
} from './epub/generators/chapter';
import { generateEpub3WithJSZip } from './epub/packagers/epubPackager';

// Re-export types for consumers
export type {
  ChapterForEpub,
  TranslationStats,
  TelemetryInsights,
  NovelConfig,
  EpubTemplate,
  EpubExportOptions,
  EpubChapter,
  EpubMeta
};

export {
  getDefaultTemplate,
  createCustomTemplate,
  getNovelConfig,
  calculateTranslationStats,
  collectActiveVersions
};

// Re-export specific generators if needed by tests
export { renderTelemetryInsights };

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
  const includeTitle = (options as any).includeTitlePage !== false;
  const includeStats = (options as any).includeStatsPage !== false;
  const tableOfContents = generateTableOfContents(options.chapters, includeStats);
  const statsAndAcknowledgments = generateStatsAndAcknowledgments(stats, template, options.telemetryInsights);
  
  // Ensure special pages are XHTML-safe
  const titlePageXhtml = htmlFragmentToXhtml(titlePage);
  const tocXhtml = htmlFragmentToXhtml(tableOfContents);
  const statsXhtml = htmlFragmentToXhtml(statsAndAcknowledgments);
  
  // Convert chapters to EPUB3-compatible format (with optional pages) 
  const chapters: EpubChapter[] = [];
  if (includeTitle) {
    chapters.push({ id: 'title-page', title: 'Title Page', xhtml: titlePageXhtml, href: 'title.xhtml' });
  }
  chapters.push({ id: 'toc-page', title: 'Table of Contents', xhtml: tocXhtml, href: 'toc.xhtml' });
  
  options.chapters.forEach((chapter, index) => {
    chapters.push({
      id: `ch-${String(index + 1).padStart(3, '0')}`,
      title: chapter.translatedTitle || chapter.title,
      xhtml: buildChapterXhtml(chapter),
      href: `chapter-${String(index + 1).padStart(4, '0')}.xhtml`
    });
  });
  
  if (includeStats) {
    chapters.push({ id: 'stats-page', title: 'Acknowledgments', xhtml: statsXhtml, href: 'stats.xhtml' });
  }
  
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
    
    // Generate filename with timestamp (UTC, to seconds)
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
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
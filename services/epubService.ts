import { SessionChapterData, AppSettings } from '../types';

// Import epub-gen for EPUB creation using dynamic import to handle CommonJS
const getEpubGen = async () => {
  // @ts-ignore
  const ePub = await import('epub-gen');
  return ePub.default || ePub;
};

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
    
    chapters.push({
      title: data.chapter.title,
      content: data.chapter.content,
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
      images: images.filter(img => img.imageData) // Only include images with data
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
  
  customFooter: `Generated with ❤️ using AI translation technology`
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
 * Generates a comprehensive table of contents page
 */
const generateTableOfContents = (chapters: ChapterForEpub[]): string => {
  let tocHtml = `<h1 style="text-align: center; border-bottom: 2px solid #333; padding-bottom: 1em;">Table of Contents</h1>\n\n`;
  
  tocHtml += `<div style="margin: 2em 0;">\n`;
  tocHtml += `<p style="text-align: center; font-style: italic; color: #666;">This translation contains ${chapters.length} chapters</p>\n`;
  tocHtml += `</div>\n\n`;

  tocHtml += `<ol style="list-style-type: decimal; padding-left: 2em; line-height: 1.8;">\n`;
  
  chapters.forEach((chapter, index) => {
    const chapterTitle = chapter.translatedTitle || chapter.title || `Chapter ${index + 1}`;
    tocHtml += `  <li style="margin-bottom: 0.5em;">\n`;
    tocHtml += `    <strong>${escapeHtml(chapterTitle)}</strong>\n`;
    tocHtml += `    <div style="font-size: 0.85em; color: #666; margin-top: 0.2em;">\n`;
    tocHtml += `      Translated with ${escapeHtml(chapter.usageMetrics.provider)} ${escapeHtml(chapter.usageMetrics.model)}\n`;
    if (chapter.images.length > 0) {
      tocHtml += ` • ${chapter.images.length} illustration${chapter.images.length > 1 ? 's' : ''}`;
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
 * Converts chapter content with illustrations to HTML suitable for EPUB
 */
const convertChapterToHtml = (chapter: ChapterForEpub): string => {
  let htmlContent = chapter.translatedTitle ? 
    `<h1>${escapeHtml(chapter.translatedTitle)}</h1>\n\n` : 
    `<h1>${escapeHtml(chapter.title)}</h1>\n\n`;
  
  // Get the translated content, fallback to original if needed
  let content = chapter.content;
  
  // Process content and embed images
  if (chapter.images.length > 0) {
    // Replace illustration markers with actual images
    for (const image of chapter.images) {
      const imgHtml = `<div class="illustration">
        <img src="${image.imageData}" alt="${escapeHtml(image.prompt)}" style="max-width: 100%; height: auto; display: block; margin: 1em auto;" />
        <p class="illustration-caption" style="text-align: center; font-style: italic; color: #666; font-size: 0.9em; margin-top: 0.5em;">${escapeHtml(image.prompt)}</p>
      </div>`;
      
      content = content.replace(image.marker, imgHtml);
    }
  }
  
  // Convert basic HTML formatting and preserve line breaks
  content = content
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>')
    .replace(/^(.*)$/gm, '$1'); // Ensure content is wrapped
  
  // Wrap in paragraphs if not already
  if (!content.startsWith('<p>')) {
    content = `<p>${content}</p>`;
  }
  
  htmlContent += content;
  
  return htmlContent;
};

/**
 * Escape HTML characters to prevent XSS and formatting issues
 */
const escapeHtml = (text: string): string => {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
};

/**
 * Generates and downloads an EPUB file from the collected chapters
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
  
  // Determine book metadata
  const firstChapter = options.chapters[0];
  const title = options.title || `Translated Novel - ${firstChapter.translatedTitle || firstChapter.title}`;
  const author = options.author || 'AI Translation Team';
  const description = options.description || 
    `AI-translated novel containing ${options.chapters.length} chapters. ` +
    `Total cost: $${stats.totalCost.toFixed(4)}, ` +
    `translated using ${Object.keys(stats.providerBreakdown).join(', ')}.`;
  
  // Generate special pages
  const tableOfContents = generateTableOfContents(options.chapters);
  const statsAndAcknowledgments = generateStatsAndAcknowledgments(stats, template);
  
  // Convert chapters to EPUB format
  const epubChapters = [
    // Table of Contents (first page)
    {
      title: 'Table of Contents',
      content: tableOfContents,
    },
    // Main chapters
    ...options.chapters.map((chapter, index) => ({
      title: chapter.translatedTitle || chapter.title,
      content: convertChapterToHtml(chapter),
    })),
    // Stats and acknowledgments (last page)
    {
      title: 'Translation Details & Acknowledgments',
      content: statsAndAcknowledgments,
    }
  ];
  
  const epubOptions = {
    title,
    author,
    description,
    content: epubChapters,
    // Enhanced CSS styling for professional appearance
    css: `
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
      .stats-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 1em;
        margin: 1em 0;
      }
      .stat-card {
        text-align: center;
        padding: 1em;
        border-radius: 8px;
        margin-bottom: 1em;
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
    `,
    // Metadata
    date: new Date().toISOString().split('T')[0],
    language: 'en',
    generator: `LexiconForge v1.0 - AI Translation Platform`,
    publisher: 'LexiconForge Community',
    // Cover page
    appendChapterTitles: true,
    tocTitle: 'Table of Contents',
    version: 3 // EPUB version
  };
  
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
    
    // Get epub-gen dynamically and generate EPUB buffer
    const ePub = await getEpubGen();
    const epubBuffer = await ePub(epubOptions);
    
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
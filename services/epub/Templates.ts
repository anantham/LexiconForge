export interface EpubTemplate {
  gratitudeMessage: string;
  projectDescription: string;
  githubUrl: string;
  additionalAcknowledgments: string;
  customFooter: string;
}

export interface NovelConfig {
  title: string;
  author: string;
  originalTitle?: string;
  description?: string;
  genre?: string;
  language: string;
  originalLanguage: string;
  seriesName?: string;
  volumeNumber?: number;
  isbn?: string;
  publisher: string;
  translationNotes?: string;
}

export interface TranslationStats {
  totalChapters: number;
  totalWords: number;
  totalCharacters: number;
  uniqueModels: string[];
  uniqueProviders: string[];
  translationSettings: Array<{
    model: string;
    provider: string;
    chapterCount: number;
  }>;
  averageWordsPerChapter: number;
  earliestTranslation?: Date;
  latestTranslation?: Date;
}

/**
 * Gets the default EPUB template with standard acknowledgments and metadata
 * This template can be customized by users to personalize their EPUB exports
 */
export const getDefaultTemplate = (): EpubTemplate => ({
  gratitudeMessage: `This translation was made possible through the remarkable capabilities of modern AI language models. We express our deep gratitude to the teams behind these technologies who have made creative translation accessible to everyone.`, 
  
  projectDescription: `This e-book was generated using LexiconForge, an open-source AI translation platform that enables high-quality, creative translations of literature. The platform supports multiple AI providers and allows for collaborative refinement of translations.`,
  
  githubUrl: 'https://github.com/anantham/LexiconForge',
  
  additionalAcknowledgments: `Special thanks to the original authors whose creative works inspire these translations, and to the open-source community that makes tools like this possible. Translation is an art that bridges cultures and languages, bringing stories to new audiences worldwide.`, 
  
  customFooter: ''
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
  const def = getDefaultTemplate();
  const merge = (a: any, b: any): any =>
    Object.fromEntries(Object.keys({ ...a, ...b }).map(k => {
      const av = (a as any)[k], bv = (b as any)[k];
      return [k, (av && typeof av === 'object' && bv && typeof bv === 'object') ? merge(av, bv) : (bv ?? av)];
    }));
  return merge(def, overrides ?? {});
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
  }

  // Apply manual overrides last to ensure they take precedence
  return {
    ...defaultConfig,
    ...novelSpecificConfig,
    ...manualConfig
  };
};

export const generateTitlePage = (novelConfig: NovelConfig, stats: TranslationStats): string => {
  const escapeHtml = (text: string): string => 
    text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>${escapeHtml(novelConfig.title)}</title>
  <meta charset="utf-8"/>
  <style type="text/css">
    body {
      font-family: Georgia, 'Times New Roman', serif;
      text-align: center;
      margin: 2em;
      line-height: 1.6;
    }
    .title {
      font-size: 2.5em;
      font-weight: bold;
      margin: 1.5em 0;
      color: #333;
    }
    .author {
      font-size: 1.4em;
      font-style: italic;
      margin: 1em 0;
      color: #666;
    }
    .original-title {
      font-size: 1.1em;
      margin: 0.5em 0 2em 0;
      color: #888;
      font-style: italic;
    }
    .metadata {
      text-align: left;
      max-width: 500px;
      margin: 3em auto;
      padding: 1.5em;
      border: 1px solid #ddd;
      border-radius: 8px;
      background-color: #f9f9f9;
    }
    .metadata h3 {
      margin-top: 0;
      color: #333;
      border-bottom: 2px solid #ddd;
      padding-bottom: 0.5em;
    }
    .metadata p {
      margin: 0.8em 0;
      color: #555;
    }
    .metadata .label {
      font-weight: bold;
      display: inline-block;
      width: 120px;
      color: #333;
    }
    .stats-summary {
      font-size: 0.9em;
      color: #666;
      margin: 2em 0;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="title">${escapeHtml(novelConfig.title)}</div>
  <div class="author">by ${escapeHtml(novelConfig.author)}</div>
  ${novelConfig.originalTitle ? `<div class="original-title">${escapeHtml(novelConfig.originalTitle)}</div>` : ''}
  
  <div class="metadata">
    <h3>Translation Information</h3>
    <p><span class="label">Chapters:</span> ${stats.totalChapters}</p>
    <p><span class="label">Words:</span> ${stats.totalWords.toLocaleString()}</p>
    <p><span class="label">Language:</span> ${escapeHtml(novelConfig.originalLanguage)} → ${escapeHtml(novelConfig.language)}</p>
    <p><span class="label">Genre:</span> ${novelConfig.genre ? escapeHtml(novelConfig.genre) : 'Not specified'}</p>
    <p><span class="label">Publisher:</span> ${escapeHtml(novelConfig.publisher)}</p>
    ${novelConfig.seriesName ? `<p><span class="label">Series:</span> ${escapeHtml(novelConfig.seriesName)} ${novelConfig.volumeNumber ? `Vol. ${novelConfig.volumeNumber}` : ''}</p>` : ''}
  </div>

  ${novelConfig.description ? `
  <div class="metadata">
    <h3>Description</h3>
    <p>${escapeHtml(novelConfig.description)}</p>
  </div>
  ` : ''}

  <div class="stats-summary">
    <p>This translation was powered by AI technology<br/>
    Generated on ${new Date().toLocaleDateString()}</p>
  </div>
</body>
</html>`;
};

export const generateTableOfContents = (chapters: Array<{title: string; filename: string}>, includeStatsPage: boolean): string => {
  const escapeHtml = (text: string): string => 
    text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  const chapterItems = chapters.map((chapter, index) => 
    `      <li><a href="${chapter.filename}">${escapeHtml(chapter.title)}</a></li>`
  ).join('\n');

  const statsPageItem = includeStatsPage 
    ? '      <li><a href="stats-acknowledgments.xhtml">Translation Stats &amp; Acknowledgments</a></li>'
    : '';

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>Table of Contents</title>
  <meta charset="utf-8"/>
  <style type="text/css">
    body {
      font-family: Georgia, 'Times New Roman', serif;
      margin: 2em;
      line-height: 1.6;
    }
    h1 {
      text-align: center;
      color: #333;
      border-bottom: 3px solid #ddd;
      padding-bottom: 0.5em;
      margin-bottom: 2em;
    }
    ul {
      list-style-type: none;
      padding: 0;
    }
    li {
      margin: 0.8em 0;
      padding: 0.5em 0;
      border-bottom: 1px solid #eee;
    }
    a {
      color: #0066cc;
      text-decoration: none;
      font-size: 1.1em;
    }
    a:hover {
      text-decoration: underline;
      color: #0044aa;
    }
    .stats-link {
      margin-top: 2em;
      padding-top: 1em;
      border-top: 2px solid #ddd;
    }
    .stats-link a {
      font-style: italic;
      color: #666;
    }
  </style>
</head>
<body>
  <h1>Table of Contents</h1>
  <ul>
${chapterItems}
${statsPageItem ? `\n    <li class="stats-link">\n${statsPageItem}\n    </li>` : ''}
  </ul>
</body>
</html>`;
};

export const generateStatsAndAcknowledgments = (stats: TranslationStats, template: EpubTemplate): string => {
  const escapeHtml = (text: string): string => 
    text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  const modelBreakdown = stats.translationSettings
    .map(setting => 
      `        <tr>
          <td>${escapeHtml(setting.provider)} - ${escapeHtml(setting.model)}</td>
          <td>${setting.chapterCount}</td>
        </tr>`
    ).join('\n');

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>Translation Stats &amp; Acknowledgments</title>
  <meta charset="utf-8"/>
  <style type="text/css">
    body {
      font-family: Georgia, 'Times New Roman', serif;
      margin: 2em;
      line-height: 1.6;
      color: #333;
    }
    h1, h2 {
      color: #333;
      border-bottom: 2px solid #ddd;
      padding-bottom: 0.5em;
    }
    h1 {
      text-align: center;
      margin-bottom: 2em;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 2em;
      margin: 2em 0;
    }
    .stat-card {
      padding: 1.5em;
      border: 1px solid #ddd;
      border-radius: 8px;
      background-color: #f9f9f9;
    }
    .stat-card h3 {
      margin-top: 0;
      color: #0066cc;
      font-size: 1.1em;
    }
    .big-number {
      font-size: 2em;
      font-weight: bold;
      color: #333;
      text-align: center;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 1.5em 0;
    }
    th, td {
      border: 1px solid #ddd;
      padding: 0.8em;
      text-align: left;
    }
    th {
      background-color: #f5f5f5;
      font-weight: bold;
      color: #333;
    }
    .acknowledgment-section {
      margin: 3em 0;
      padding: 2em;
      background-color: #f9f9f9;
      border-left: 4px solid #0066cc;
    }
    .footer-section {
      margin: 2em 0;
      padding: 1.5em;
      background-color: #f5f5f5;
      border-radius: 8px;
      font-size: 0.9em;
      color: #666;
    }
    a {
      color: #0066cc;
      text-decoration: none;
    }
    a:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <h1>Translation Statistics &amp; Acknowledgments</h1>

  <h2>Translation Statistics</h2>
  <div class="stats-grid">
    <div class="stat-card">
      <h3>Total Chapters</h3>
      <div class="big-number">${stats.totalChapters}</div>
    </div>
    
    <div class="stat-card">
      <h3>Total Words</h3>
      <div class="big-number">${stats.totalWords.toLocaleString()}</div>
    </div>
    
    <div class="stat-card">
      <h3>Total Characters</h3>
      <div class="big-number">${stats.totalCharacters.toLocaleString()}</div>
    </div>
    
    <div class="stat-card">
      <h3>Avg Words/Chapter</h3>
      <div class="big-number">${Math.round(stats.averageWordsPerChapter)}</div>
    </div>
  </div>

  <h2>Translation Models Used</h2>
  <table>
    <thead>
      <tr>
        <th>AI Provider &amp; Model</th>
        <th>Chapters Translated</th>
      </tr>
    </thead>
    <tbody>
${modelBreakdown}
    </tbody>
  </table>

  <div class="acknowledgment-section">
    <h2>Acknowledgments</h2>
    <p>${escapeHtml(template.gratitudeMessage)}</p>
  </div>

  <div class="acknowledgment-section">
    <h2>About This Project</h2>
    <p>${escapeHtml(template.projectDescription)}</p>
    <p><strong>Project Repository:</strong> <a href="${template.githubUrl}">${template.githubUrl}</a></p>
  </div>

  <div class="acknowledgment-section">
    <h2>Additional Acknowledgments</h2>
    <p>${escapeHtml(template.additionalAcknowledgments)}</p>
  </div>

  ${template.customFooter ? `
  <div class="footer-section">
    <h2>Custom Message</h2>
    <p>${escapeHtml(template.customFooter)}</p>
  </div>` : ''}

  <div class="footer-section">
    <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
    <p><strong>Total Translation Time:</strong> ${stats.earliestTranslation && stats.latestTranslation 
      ? `${Math.ceil((stats.latestTranslation.getTime() - stats.earliestTranslation.getTime()) / (1000 * 60 * 60 * 24))} days`
      : 'Unknown'}</p>
  </div>
</body>
</html>`;
};
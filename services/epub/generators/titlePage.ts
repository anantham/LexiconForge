import { NovelConfig, TranslationStats } from '../types';
import { escapeXml } from '../sanitizers/xhtmlSanitizer';

/**
 * Generates a professional title page using novel metadata
 */
export const generateTitlePage = (novelConfig: NovelConfig, stats: TranslationStats): string => {
  let titlePageHtml = `<div class="title-page">
`;
  
  // Main title
  titlePageHtml += `<h1>${escapeXml(novelConfig.title)}</h1>
`;
  
  // Original title (if different)
  if (novelConfig.originalTitle && novelConfig.originalTitle !== novelConfig.title) {
    titlePageHtml += `<div class="subtitle">${escapeXml(novelConfig.originalTitle)}</div>
`;
  }
  
  // Author
  titlePageHtml += `<div class="author">by ${escapeXml(novelConfig.author)}</div>
`;
  
  // Metadata section
  titlePageHtml += `<div class="metadata">
`;
  
  if (novelConfig.description) {
    titlePageHtml += `<p><strong>Description:</strong><br/>${escapeXml(novelConfig.description)}</p>
`;
  }
  
  if (novelConfig.genre) {
    titlePageHtml += `<p><strong>Genre:</strong> ${escapeXml(novelConfig.genre)}</p>
`;
  }
  
  if (novelConfig.originalLanguage && novelConfig.language) {
    const langMap: Record<string, string> = {
      'ja': 'Japanese', 'ko': 'Korean', 'zh': 'Chinese', 
      'en': 'English', 'fr': 'French', 'de': 'German'
    };
    const fromLang = langMap[novelConfig.originalLanguage] || novelConfig.originalLanguage;
    const toLang = langMap[novelConfig.language] || novelConfig.language;
    titlePageHtml += `<p><strong>Translation:</strong> ${fromLang} → ${toLang}</p>
`;
  }
  
  if (novelConfig.seriesName && novelConfig.volumeNumber) {
    titlePageHtml += `<p><strong>Series:</strong> ${escapeXml(novelConfig.seriesName)}, Volume ${novelConfig.volumeNumber}</p>
`;
  }
  
  if (novelConfig.publisher) {
    titlePageHtml += `<p><strong>Publisher:</strong> ${escapeXml(novelConfig.publisher)}</p>
`;
  }
  
  // Translation statistics
  titlePageHtml += `<p><strong>Translation Stats:</strong> ${stats.chapterCount} chapters, `;
  titlePageHtml += `${stats.totalTokens.toLocaleString()} tokens processed, `;
  titlePageHtml += `$${stats.totalCost.toFixed(4)} cost</p>
`;
  
  if (novelConfig.translationNotes) {
    titlePageHtml += `<p><em>${escapeXml(novelConfig.translationNotes)}</em></p>
`;
  }
  
  titlePageHtml += `<p><strong>Generated:</strong> ${new Date().toLocaleDateString()}</p>
`;
  titlePageHtml += `</div>
`; // metadata
  titlePageHtml += `</div>
`; // title-page
  
  return titlePageHtml;
};

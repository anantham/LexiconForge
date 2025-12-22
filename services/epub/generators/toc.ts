import { ChapterForEpub } from '../types';
import { escapeXml } from '../sanitizers/xhtmlSanitizer';

/**
 * Generates a comprehensive table of contents page with navigation links
 */
export const generateTableOfContents = (chapters: ChapterForEpub[], includeStatsPage: boolean): string => {
  let tocHtml = `<h1 style="text-align: center; border-bottom: 2px solid #333; padding-bottom: 1em;">Table of Contents</h1>\n\n`;
  
  tocHtml += `<div style="margin: 2em 0;">
`;
  tocHtml += `<p style="text-align: center; font-style: italic; color: #666;">This translation contains ${chapters.length} chapters</p>
`;
  tocHtml += `</div>\n\n`;

  tocHtml += `<ol style="list-style-type: decimal; padding-left: 2em; line-height: 1.8;">
`;
  
  chapters.forEach((chapter, index) => {
    const chapterTitle = chapter.translatedTitle || chapter.title || `Chapter ${index + 1}`;
    const chapterHref = `chapter-${String(index + 1).padStart(4, '0')}.xhtml`;
    
    tocHtml += `  <li style="margin-bottom: 0.5em;">
`;
    tocHtml += `    <a href="${chapterHref}" style="text-decoration: none; color: #007bff;"><strong>${escapeXml(chapterTitle)}</strong></a>
`;
    tocHtml += `    <div style="font-size: 0.85em; color: #666; margin-top: 0.2em;">
`;
    tocHtml += `      Translated with ${escapeXml(chapter.usageMetrics.provider)} ${escapeXml(chapter.usageMetrics.model)}
`;
    if (chapter.images && chapter.images.length > 0) {
      tocHtml += ` • ${chapter.images.length} illustration${chapter.images.length > 1 ? 's' : ''}`;
    }
    if (chapter.footnotes && chapter.footnotes.length > 0) {
      tocHtml += ` • ${chapter.footnotes.length} footnote${chapter.footnotes.length > 1 ? 's' : ''}`;
    }
    tocHtml += `    </div>
`;
    tocHtml += `  </li>
`;
  });
  
  // Optionally include special sections at the end
  if (includeStatsPage) {
    tocHtml += `  <li style="margin-bottom: 0.5em;">
`;
    tocHtml += `    <a href="stats.xhtml" style="text-decoration: none; color: #007bff;"><strong>Acknowledgments</strong></a>
`;
    tocHtml += `  </li>
`;
  }
  tocHtml += `</ol>
`;
  
  return tocHtml;
};

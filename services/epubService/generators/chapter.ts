import { ChapterForEpub } from '../types';
import { 
  sanitizeHtmlAllowlist, 
  toStrictXhtml, 
  convertNewlinesToBrInElement, 
  htmlFragmentToXhtml, 
  escapeXml 
} from '../sanitizers/xhtmlSanitizer';

/**
 * Converts chapter content with illustrations and footnotes to XHTML suitable for EPUB
 */
export const convertChapterToHtml = (chapter: ChapterForEpub): string => {
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
    let footnotesHtml = `<div class="footnotes">
<h3>Footnotes</h3>
<ol>
`;
    for (const footnote of chapter.footnotes) {
      footnotesHtml += `<li id="fn${footnote.marker}" epub:type="footnote">
`;
      footnotesHtml += `        ${escapeXml(footnote.text)}
`;
      footnotesHtml += `        <a href="#fnref${footnote.marker}" class="footnote-backref" epub:type="backlink">↩</a>
`;
      footnotesHtml += `      </li>\n`;
    }
    footnotesHtml += `</ol>
</div>
`;
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
export const convertToXhtmlParagraphs = (content: string): string => {
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
 * Build chapter XHTML using DOM nodes (footnotes visible inline and at end)
 */
export const buildChapterXhtml = (chapter: ChapterForEpub): string => {
  const root = document.createElement('div');
  // Title
  const h1 = document.createElement('h1');
  h1.textContent = chapter.translatedTitle || chapter.title;
  root.appendChild(h1);

  // 1) Inject placeholders for markers
  const withIllu = chapter.content.replace(/\b(ILLUSTRATION-\d+[A-Za-z]*)\b/g, (_m, marker) => {
    return `<span data-illu="${marker}"></span>`;
  });
  const withPlaceholders = withIllu.replace(/\((\d+)\)/g, (_m, n) => `<span data-fn="${n}"></span>`);

  // 2) Sanitize with tight allowlist to preserve inline tags safely
  const sanitized = sanitizeHtmlAllowlist(withPlaceholders);

  // 3) Materialize into a working container and normalize newlines to <br>
  const container = document.createElement('div');
  container.innerHTML = sanitized;
  convertNewlinesToBrInElement(container);

  // 4) Replace placeholders with generated illustration blocks and footnote refs
  const imagesByMarker = new Map<string, typeof chapter.images[number]>(
    chapter.images.map(i => [i.marker, i])
  );
  for (const span of Array.from(container.querySelectorAll('span[data-illu]'))) {
    const marker = (span as HTMLElement).getAttribute('data-illu') || '';
    const img = imagesByMarker.get(`[${marker}]`) || imagesByMarker.get(marker);
    if (img) {
      const wrap = document.createElement('div');
      wrap.setAttribute('class', 'illustration');
      const im = document.createElement('img');
      im.setAttribute('src', img.imageData);
      im.setAttribute('alt', img.prompt);
      im.setAttribute('style', 'max-width: 100%; height: auto; display: block; margin: 1em auto;');
      const cap = document.createElement('p');
      cap.setAttribute('class', 'illustration-caption');
      cap.setAttribute('style', 'text-align: center; font-style: italic; color: #666; font-size: 0.9em; margin-top: 0.5em;');
      cap.textContent = img.prompt;
      wrap.appendChild(im);
      wrap.appendChild(cap);
      span.replaceWith(wrap);
    } else {
      // If missing, remove placeholder
      span.remove();
    }
  }
  for (const span of Array.from(container.querySelectorAll('span[data-fn]'))) {
    const num = (span as HTMLElement).getAttribute('data-fn') || '';
    const sup = document.createElement('sup');
    const a = document.createElement('a');
    a.setAttribute('href', `#fn${num}`);
    a.setAttribute('class', 'footnote-ref');
    a.setAttribute('id', `fnref${num}`);
    a.setAttribute('epub:type', 'noteref');
    a.textContent = `[${num}]`;
    sup.appendChild(a);
    span.replaceWith(sup);
  }

  // 5) Append sanitized content under title
  while (container.firstChild) root.appendChild(container.firstChild);

  // 6) Footnotes section at end
  if (chapter.footnotes && chapter.footnotes.length > 0) {
    const div = document.createElement('div');
    div.setAttribute('class', 'footnotes');
    const h3 = document.createElement('h3');
    h3.textContent = 'Footnotes';
    const ol = document.createElement('ol');
    div.appendChild(h3);
    div.appendChild(ol);
    for (const fn of chapter.footnotes) {
      const num = String(fn.marker).replace(/^\ \[|\ \]$/g, '');
      const li = document.createElement('li');
      li.setAttribute('id', `fn${num}`);
      li.setAttribute('epub:type', 'footnote');

      // Allow limited inline HTML inside footnotes (e.g., <i>, <b>, <br>)
      try {
        const safeHtml = sanitizeHtmlAllowlist(fn.text || '');
        if (safeHtml) {
          const temp = document.createElement('div');
          temp.innerHTML = safeHtml;
          while (temp.firstChild) li.appendChild(temp.firstChild);
          li.appendChild(document.createTextNode(' '));
        } else {
          li.appendChild(document.createTextNode((fn.text || '') + ' '));
        }
      } catch {
        li.appendChild(document.createTextNode((fn.text || '') + ' '));
      }

      const back = document.createElement('a');
      back.setAttribute('href', `#fnref${num}`);
      back.setAttribute('class', 'footnote-backref');
      back.setAttribute('epub:type', 'backlink');
      back.textContent = '↩';
      li.appendChild(back);
      ol.appendChild(li);
    }
    root.appendChild(div);
  }

  // 7) XHTML serialization
  return htmlFragmentToXhtml(toStrictXhtml(root.innerHTML));
};

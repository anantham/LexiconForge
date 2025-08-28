import { SessionChapterData, AppSettings } from '../types';
import JSZip from 'jszip';

// XHTML/XML namespaces used for strict XML serialization
const XHTML_NS = 'http://www.w3.org/1999/xhtml';
const XML_NS   = 'http://www.w3.org/XML/1998/namespace';
const EPUB_NS  = 'http://www.idpf.org/2007/ops';
const XLINK_NS = 'http://www.w3.org/1999/xlink';

// Simplified XML Name validation (sufficient for XHTML attribute names)
const XML_NAME = /^[A-Za-z_][A-Za-z0-9._:-]*$/;

// Basic bans for unsafe attributes
function isBannedAttr(name: string) {
  return name.startsWith('on') || name === 'srcdoc';
}

// Very lightweight CSS sanitizer; keep as a single attribute
function sanitizeStyle(value: string) {
  const v = (value ?? '').replace(/[\u0000-\u001F\u007F]/g, '');
  if (/url\s*\(\s*javascript:/i.test(v)) return '';
  if (/expression\s*\(/i.test(v)) return '';
  return v.trim();
}

function setAttrNS(el: Element, name: string, value: string) {
  if (name === 'xml:lang') { el.setAttributeNS(XML_NS, name, value); return; }
  if (name.startsWith('epub:')) { el.setAttributeNS(EPUB_NS, name, value); return; }
  if (name.startsWith('xlink:')) { el.setAttributeNS(XLINK_NS, name, value); return; }
  el.setAttribute(name, value);
}

function copyAttributesSafely(srcEl: Element, dstEl: Element) {
  for (const attr of Array.from(srcEl.attributes)) {
    let name = attr.name;
    let value = attr.value ?? '';

    // Keep style as a single attribute; do not expand/split
    if (name.toLowerCase() === 'style') {
      const s = sanitizeStyle(value);
      if (s) dstEl.setAttribute('style', s);
      continue;
    }

    // Drop unsafe attributes
    if (isBannedAttr(name)) continue;

    // Validate XML name to avoid InvalidCharacterError (e.g., 'down;')
    if (!XML_NAME.test(name)) {
      try { console.warn('[EPUB XClone] Dropping invalid attribute', name, 'on <' + srcEl.tagName + '>'); } catch {}
      continue;
    }

    // reject unknown namespace prefixes (avoid unbound prefixes)
    if (name.includes(':')) {
      const [prefix] = name.split(':', 1);
      const ok = prefix === 'xml' || prefix === 'epub' || prefix === 'xlink';
      if (!ok) continue;
    }

    // Normalize non-namespaced names to lowercase
    if (!name.includes(':')) name = name.toLowerCase();

    try {
      setAttrNS(dstEl, name, value);
    } catch (e) {
      try {
        const snippet = (srcEl as any).outerHTML ? (srcEl as any).outerHTML.slice(0, 160).replace(/\s+/g, ' ') : `<${srcEl.tagName}>`;
        console.warn('[EPUB XClone] Could not set attribute', name, 'value=', value, 'on', snippet, e);
      } catch {}
      // Continue without throwing
    }
  }
}

// Clone an HTML node tree into an XHTML XMLDocument parent
function cloneIntoXhtml(srcNode: Node, xdoc: XMLDocument, dstParent: Element) {
  switch (srcNode.nodeType) {
    case Node.ELEMENT_NODE: {
      const srcEl = srcNode as Element;
      // Lowercase localName for XHTML consistency; guard invalid names
      const name = srcEl.localName.toLowerCase();
      const isValidXmlLocalName = /^[A-Za-z_][A-Za-z0-9._-]*$/.test(name);
      if (!isValidXmlLocalName) {
        // Skip invalid element; clone its children directly into parent
        for (const child of Array.from(srcEl.childNodes)) {
          cloneIntoXhtml(child, xdoc, dstParent);
        }
        break;
      }
      const el = xdoc.createElementNS(XHTML_NS, name);
      // Copy attributes safely (validated + namespaced)
      copyAttributesSafely(srcEl, el);
      // Ensure <img> has alt for accessibility nicety
      if (el.localName === 'img' && !el.hasAttribute('alt')) {
        el.setAttribute('alt', '');
      }
      // Avoid scripts in EPUB content
      if (el.localName !== 'script') {
        for (const child of Array.from(srcEl.childNodes)) {
          cloneIntoXhtml(child, xdoc, el);
        }
      }
      dstParent.appendChild(el);
      break;
    }
    case Node.TEXT_NODE: {
      dstParent.appendChild(xdoc.createTextNode((srcNode as Text).data));
      break;
    }
    // Omit comments/CDATA by default for chapters
    default:
      break;
  }
}

// Convert an HTML fragment string into serialized XHTML fragment
function htmlFragmentToXhtml(fragmentHtml: string): string {
  // Repair common broken void tags like <br“... or <hr“... into <br/> then the quote remains as text
  fragmentHtml = fragmentHtml
    .replace(/<br(?=(?:[“”"]) )/g, '<br/>')
    .replace(/<br(?=(?:[“”"]))/g, '<br/>')
    .replace(/<hr(?=(?:[“”"]))/g, '<hr/>');
  // 1) Tolerant parse as HTML
  const htmlDoc = new DOMParser().parseFromString(fragmentHtml, 'text/html');
  // 2) Create fresh XHTML document and a <body> container
  const xdoc = document.implementation.createDocument(XHTML_NS, 'html', null);
  const htmlEl = xdoc.documentElement;
  // Bind common namespaces used by EPUB content
  htmlEl.setAttribute('xmlns:epub', EPUB_NS);
  // Default language; may be overridden per element via xml:lang during cloning
  if (!htmlEl.hasAttribute('xml:lang')) htmlEl.setAttributeNS(XML_NS, 'xml:lang', 'en');
  const body = xdoc.createElementNS(XHTML_NS, 'body');
  htmlEl.appendChild(body);
  // 3) Clone children into XHTML body
  for (const node of Array.from(htmlDoc.body.childNodes)) {
    cloneIntoXhtml(node, xdoc, body);
  }
  // 4) Serialize children individually to avoid wrapping <body> markup
  const serializer = new XMLSerializer();
  const parts: string[] = [];
  for (const child of Array.from(body.childNodes)) {
    parts.push(serializer.serializeToString(child as any));
  }
  let xhtml = parts.join('');
  // 5) Prefer numeric nbsp entity for max compatibility
  xhtml = xhtml.replace(/\u00A0/g, '&#160;');
  return xhtml;
}

// Very small allowlist sanitizer for inline/basic block tags used in chapters
function sanitizeHtmlAllowlist(html: string): string {
  const allowedTags = new Set([
    'i','em','b','strong','u','s','br','sup','sub','a','p','ul','ol','li','span'
  ]);
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const body = doc.body;

  const unwrapNode = (node: Element) => {
    const parent = node.parentNode;
    if (!parent) return;
    while (node.firstChild) parent.insertBefore(node.firstChild, node);
    parent.removeChild(node);
  };

  const isSafeHref = (href: string): boolean => {
    try {
      const url = new URL(href, 'https://example.com');
      const proto = (url.protocol || '').toLowerCase();
      return proto === 'http:' || proto === 'https:' || proto === 'mailto:';
    } catch { return false; }
  };

  const sanitizeEl = (el: Element) => {
    // Copy array since we'll mutate children
    for (const child of Array.from(el.childNodes)) {
      if (child.nodeType === Node.COMMENT_NODE) {
        el.removeChild(child);
        continue;
      }
      if (child.nodeType === Node.ELEMENT_NODE) {
        const c = child as Element;
        const tag = c.tagName.toLowerCase();
        if (!allowedTags.has(tag)) {
          // unwrap unknown element, keep its children
          unwrapNode(c);
          continue;
        }
        // Strip disallowed attributes
        for (const attr of Array.from(c.attributes)) {
          const name = attr.name.toLowerCase();
          const value = attr.value;
          const isEvent = name.startsWith('on');
          if (isEvent || name === 'style') { c.removeAttribute(attr.name); continue; }
          if (tag === 'a') {
            if (name === 'href') {
              if (!isSafeHref(value)) c.removeAttribute('href');
              continue;
            }
            if (name === 'title') continue;
            // drop everything else on <a>
            c.removeAttribute(attr.name);
            continue;
          }
          if (tag === 'span') {
            // Keep our placeholders only
            if (name === 'data-illu' || name === 'data-fn') continue;
            c.removeAttribute(attr.name);
            continue;
          }
          // For other allowed tags: drop all attributes
          c.removeAttribute(attr.name);
        }
        sanitizeEl(c);
      }
    }
  };
  sanitizeEl(body);
  return body.innerHTML;
}

// Replace newline characters in text nodes with <br> elements for display parity
function convertNewlinesToBrInElement(root: Element) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
  const textNodes: Text[] = [];
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const t = node as Text;
    if (t.data.includes('\n')) textNodes.push(t);
  }
  for (const t of textNodes) {
    const parts = t.data.split(/\n/);
    const frag = document.createDocumentFragment();
    parts.forEach((part, idx) => {
      if (part) frag.appendChild(document.createTextNode(part));
      if (idx < parts.length - 1) frag.appendChild(document.createElement('br'));
    });
    t.parentNode?.replaceChild(frag, t);
  }
}

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

/**
 * Creates a ChapterForEpub object from session data
 */
const createChapterForEpub = (data: any, url: string): ChapterForEpub => {
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
  
  return {
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
  };
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
export const getDefaultTemplate = ():EpubTemplate => ({
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

/**
 * Generates a comprehensive table of contents page with navigation links
 */
const generateTableOfContents = (chapters: ChapterForEpub[], includeStatsPage: boolean): string => {
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

/**
 * Generates a detailed statistics and acknowledgments page
 */
const generateStatsAndAcknowledgments = (stats: TranslationStats, template: EpubTemplate): string => {
  let html = `<h1 style=\"text-align: center; border-bottom: 2px solid #333; padding-bottom: 1em;\">Acknowledgments</h1>\\n\\n`;

  // Project description
  html += `<div style=\"margin: 2em 0; padding: 1.5em; background: #f8f9fa; border-left: 4px solid #007bff; border-radius: 4px;\">
`;
  html += `<h2 style=\"margin-top: 0; color: #007bff;\">About This Translation</h2>
`;
  html += `<p>${escapeXml(template.projectDescription || '')}</p>
`;
  if (template.githubUrl) {
    html += `<p><strong>Source Code:</strong> <a href=\"${escapeXml(template.githubUrl)}\" style=\"color: #007bff;\">${escapeXml(template.githubUrl)}</a></p>
`;
  }
  html += `</div>\n\n`;

  // Translation statistics
  html += `<div style=\"margin: 2em 0;\">
`;
  html += `<h2 style=\"color: #28a745; border-bottom: 1px solid #28a745; padding-bottom: 0.5em;\">Translation Statistics</h2>
`;
  
  html += `<div style=\"display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1em; margin: 1em 0;\">
`;
  html += `  <div style=\"text-align: center; padding: 1em; background: #e7f3ff; border-radius: 8px;\">
`;
  html += `    <div style=\"font-size: 2em; font-weight: bold; color: #007bff;\">${stats.chapterCount}</div>
`;
  html += `    <div style=\"color: #666;\">Chapters</div>
`;
  html += `  </div>
`;
  html += `  <div style=\"text-align: center; padding: 1em; background: #e7f8e7; border-radius: 8px;\">
`;
  html += `    <div style=\"font-size: 2em; font-weight: bold; color: #28a745;\">$${stats.totalCost.toFixed(4)}</div>
`;
  html += `    <div style=\"color: #666;\">Total Cost</div>
`;
  html += `  </div>
`;
  html += `  <div style=\"text-align: center; padding: 1em; background: #fff3e0; border-radius: 8px;\">
`;
  html += `    <div style=\"font-size: 2em; font-weight: bold; color: #f57c00;\">${Math.round(stats.totalTime)}s</div>
`;
  html += `    <div style=\"color: #666;\">Total Time</div>
`;
  html += `  </div>
`;
  html += `  <div style=\"text-align: center; padding: 1em; background: #fce4ec; border-radius: 8px;\">
`;
  html += `    <div style=\"font-size: 2em; font-weight: bold; color: #c2185b;\">${stats.totalTokens.toLocaleString()}</div>
`;
  html += `    <div style=\"color: #666;\">Total Tokens</div>
`;
  html += `  </div>
`;
  if (stats.imageCount > 0) {
    html += `  <div style=\"text-align: center; padding: 1em; background: #f3e5f5; border-radius: 8px;\">
`;
    html += `    <div style=\"font-size: 2em; font-weight: bold; color: #7b1fa2;\">${stats.imageCount}</div>
`;
    html += `    <div style=\"color: #666;\">Images Generated</div>
`;
    html += `  </div>
`;
  }
  html += `</div>
`;
  html += `</div>\n\n`;

  // Provider breakdown
  const providers = Object.keys(stats.providerBreakdown);
  if (providers.length > 0) {
    html += `<div style=\"margin: 2em 0;\">
`;
    html += `<h3 style=\"color: #6f42c1;\">Translation Providers Used</h3>
`;
    html += `<table style=\"width: 100%; border-collapse: collapse; margin: 1em 0;\">
`;
    html += `  <thead>
`;
    html += `    <tr style=\"background: #f8f9fa;\">
`;
    html += `      <th style=\"border: 1px solid #dee2e6; padding: 0.75em; text-align: left;\">Provider</th>
`;
    html += `      <th style=\"border: 1px solid #dee2e6; padding: 0.75em; text-align: center;\">Chapters</th>
`;
    html += `      <th style=\"border: 1px solid #dee2e6; padding: 0.75em; text-align: center;\">Cost</th>
`;
    html += `      <th style=\"border: 1px solid #dee2e6; padding: 0.75em; text-align: center;\">Time</th>
`;
    html += `    </tr>
`;
    html += `  </thead>
`;
    html += `  <tbody>
`;
    
    providers.forEach(provider => {
      const providerStats = stats.providerBreakdown[provider];
      html += `    <tr>
`;
      html += `      <td style=\"border: 1px solid #dee2e6; padding: 0.75em; font-weight: bold;\">${escapeXml(provider)}</td>
`;
      html += `      <td style=\"border: 1px solid #dee2e6; padding: 0.75em; text-align: center;\">${providerStats.chapters}</td>
`;
      html += `      <td style=\"border: 1px solid #dee2e6; padding: 0.75em; text-align: center;\">$${providerStats.cost.toFixed(4)}</td>
`;
      html += `      <td style=\"border: 1px solid #dee2e6; padding: 0.75em; text-align: center;\">${Math.round(providerStats.time)}s</td>
`;
      html += `    </tr>
`;
    });
    
    html += `  </tbody>
`;
    html += `</table>
`;
    html += `</div>\n\n`;
  }

  // Model breakdown (top 10 most used)
  const models = Object.entries(stats.modelBreakdown)
    .sort(([,a], [,b]) => b.chapters - a.chapters)
    .slice(0, 10);
    
  if (models.length > 0) {
    html += `<div style=\"margin: 2em 0;\">
`;
    html += `<h3 style=\"color: #dc3545;\">AI Models Used</h3>
`;
    html += `<table style=\"width: 100%; border-collapse: collapse; margin: 1em 0;\">
`;
    html += `  <thead>
`;
    html += `    <tr style=\"background: #f8f9fa;\">
`;
    html += `      <th style=\"border: 1px solid #dee2e6; padding: 0.75em; text-align: left;\">Model</th>
`;
    html += `      <th style=\"border: 1px solid #dee2e6; padding: 0.75em; text-align: center;\">Chapters</th>
`;
    html += `      <th style=\"border: 1px solid #dee2e6; padding: 0.75em; text-align: center;\">Tokens</th>
`;
    html += `    </tr>
`;
    html += `  </thead>
`;
    html += `  <tbody>
`;
    
    models.forEach(([model, modelStats]) => {
      html += `    <tr>
`;
      html += `      <td style=\"border: 1px solid #dee2e6; padding: 0.75em; font-family: monospace; font-size: 0.9em;\">${escapeXml(model)}</td>
`;
      html += `      <td style=\"border: 1px solid #dee2e6; padding: 0.75em; text-align: center;\">${modelStats.chapters}</td>
`;
      html += `      <td style=\"border: 1px solid #dee2e6; padding: 0.75em; text-align: center;\">${modelStats.tokens.toLocaleString()}</td>
`;
      html += `    </tr>
`;
    });
    
    html += `  </tbody>
`;
    html += `</table>
`;
    html += `</div>\n\n`;
  }

  // Gratitude message
  html += `<div style=\"margin: 3em 0; padding: 2em; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 12px;\">
`;
  html += `<h2 style=\"margin-top: 0; color: white; text-align: center;\">Acknowledgments</h2>
`;
  html += `<p style=\"font-size: 1.1em; line-height: 1.6; text-align: justify;\">${escapeXml(template.gratitudeMessage || '')}</p>
`;
  if (template.additionalAcknowledgments) {
    html += `<p style=\"font-size: 1.1em; line-height: 1.6; text-align: justify;\">${escapeXml(template.additionalAcknowledgments)}</p>
`;
  }
  html += `</div>\n\n`;

  // Footer
  if (template.customFooter) {
    html += `<div style=\"margin: 2em 0; text-align: center; padding: 1em; border-top: 1px solid #dee2e6; font-style: italic; color: #666;\">
`;
    html += `${escapeXml(template.customFooter)}
`;
    html += `</div>
`;
  }

  html += `<div style=\"margin: 2em 0; text-align: center; padding: 1em; border-top: 1px solid #dee2e6; font-size: 0.9em; color: #666;\">
`;
  html += `<p><em>Translation completed on ${new Date().toLocaleDateString()}</em></p>
`;
  html += `</div>
`;

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
      const imgHtml = `<div class=\"illustration\">
        <img src=\"${escapeXml(image.imageData)}\" alt=\"${escapeXml(image.prompt)}\" style=\"max-width: 100%; height: auto; display: block; margin: 1em auto;\" />
        <p class=\"illustration-caption\" style=\"text-align: center; font-style: italic; color: #666; font-size: 0.9em; margin-top: 0.5em;\">${escapeXml(image.prompt)}</p>
      </div>`;
      
      content = content.replace(image.marker, imgHtml);
    }
  }
  
  // Process and embed footnotes
  if (chapter.footnotes && chapter.footnotes.length > 0) {
    // Replace footnote markers with links
    for (const footnote of chapter.footnotes) {
      const footnoteLink = `<a href=\"#fn${footnote.marker}\" class=\"footnote-ref\" id=\"fnref${footnote.marker}\" epub:type=\"noteref\">[${footnote.marker}]</a>`;
      content = content.replace(`[${footnote.marker}]`, footnoteLink);
    }
    
    // Add footnotes section at the end
    let footnotesHtml = '<div class=\"footnotes\">\n<h3>Footnotes</h3>\n<ol>\n';
    for (const footnote of chapter.footnotes) {
      footnotesHtml += `<li id=\"fn${footnote.marker}\" epub:type=\"footnote\">
`;
      footnotesHtml += `        ${escapeXml(footnote.text)}
`;
      footnotesHtml += `        <a href=\"#fnref${footnote.marker}\" class=\"footnote-backref\" epub:type=\"backlink\">↩</a>
`;
      footnotesHtml += `      </li>\n`;
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
 * Build chapter XHTML using DOM nodes (footnotes visible inline and at end)
 */
const buildChapterXhtml = (chapter: ChapterForEpub): string => {
  const root = document.createElement('div');
  // Title
  const h1 = document.createElement('h1');
  h1.textContent = chapter.translatedTitle || chapter.title;
  root.appendChild(h1);

  // 1) Inject placeholders for markers
  const withIllu = chapter.content.replace(/\[(ILLUSTRATION-\d+[A-Za-z]*) \]/g, (_m, marker) => {
    return `<span data-illu="${marker}"></span>`;
  });
  const withPlaceholders = withIllu.replace(/\[(\d+)\]/g, (_m, n) => `<span data-fn="${n}"></span>`);

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
      const num = String(fn.marker).replace(/^\ \[|\]$/g, '');
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
  const includeTitle = (options as any).includeTitlePage !== false;
  const includeStats = (options as any).includeStatsPage !== false;
  const tableOfContents = generateTableOfContents(options.chapters, includeStats);
  const statsAndAcknowledgments = generateStatsAndAcknowledgments(stats, template);
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
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${lang}">
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
        ${chapters.map(ch => `<li><a href="${ch.href}">${escapeXml(ch.title)}</a></li>`).join('\n        ')}
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

  // Extract data:image payloads from chapter XHTML and rewrite to packaged image files
  type ImgEntry = { href: string; mediaType: string; base64: string; id: string };
  const processedChapters: { ch: EpubChapter; xhtml: string }[] = [];
  const imageEntries: ImgEntry[] = [];
  let imgIndex = 1;
  const dataImgRegex = /(<img\b[^>]*?src=")(data:(image\/[A-Za-z0-9.+-]+);base64,([A-Za-z0-9+/=]+))(\"[^>]*>)/g;

  for (const ch of chapters) {
    let xhtml = ch.xhtml;
    xhtml = xhtml.replace(dataImgRegex, (_m, p1, _src, mime, b64, p5) => {
      const ext = mime.endsWith('jpeg') ? 'jpg' : (mime.split('/')[1] || 'png');
      const filename = `img-${String(imgIndex).padStart(4, '0')}.${ext}`;
      const href = `images/${filename}`;
      const id = `img${imgIndex}`;
      imageEntries.push({ href, mediaType: mime, base64: b64, id });
      imgIndex++;
      return `${p1}../${href}${p5}`;
    });
    processedChapters.push({ ch, xhtml });
  }

  // Build manifest and spine including images
  const manifestItemsText = processedChapters.map(({ ch }) =>
    `<item id="${ch.id}" href="text/${ch.href}" media-type="application/xhtml+xml"/>`
  ).join('\n        ');
  const manifestItemsImages = imageEntries.map(img =>
    `<item id="${img.id}" href="${escapeXml(img.href)}" media-type="${escapeXml(img.mediaType)}"/>`
  ).join('\n        ');
  const spineItems2 = processedChapters.map(({ ch }) => `<itemref idref="${ch.id}"/>`).join('\n        ');

  const contentOpf2 = `<?xml version="1.0" encoding="utf-8"?>
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
        ${manifestItemsText}
        ${manifestItemsImages ? `\n        ${manifestItemsImages}` : ''}
  </manifest>
  <spine>
        ${spineItems2}
  </spine>
</package>`;

  // Create ZIP with JSZip
  const zip = new JSZip();
  
  // Add mimetype (must be first and uncompressed)
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
  
  // Add META-INF
  zip.file('META-INF/container.xml', containerXml);
  
  // Add OEBPS content
  zip.file(`${oebps}/content.opf`, contentOpf2);
  zip.file(`${textDir}/nav.xhtml`, navXhtml);
  zip.file(`${stylesDir}/stylesheet.css`, stylesheet);
  
  // Add processed chapter files and extracted images (with optional strict XML parse diagnostics)
  const parseErrors: string[] = [];
  for (const { ch, xhtml } of processedChapters) {
    const wrapped = xhtmlWrap(ch.title, xhtml);
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(wrapped, 'application/xhtml+xml');
      const hasError =
        doc.getElementsByTagName('parsererror').length > 0 ||
        doc.getElementsByTagNameNS('*', 'parsererror').length > 0;
      if (hasError) {
        const txt = doc.documentElement.textContent || '';
        const msg = `[ParseError] ${ch.href}: ${txt.slice(0, 300)}`;
        console.warn(msg);
        parseErrors.push(msg);
      }
    } catch {}
    zip.file(`${textDir}/${ch.href}`, wrapped);
  }
  for (const img of imageEntries) {
    zip.file(`${oebps}/${img.href}`, img.base64, { base64: true });
  }
  
  // Attach diagnostics when parse errors are detected
  if (parseErrors.length > 0) {
    zip.file(`${oebps}/debug/parse-errors.txt`, parseErrors.join('\n'));
    processedChapters.forEach(({ ch, xhtml }) => {
      zip.file(`${oebps}/debug/text/${ch.href}.raw.xhtml`, xhtml);
    });
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

function toStrictXhtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const allowed = new Set(['BR','HR','I','EM','B','STRONG','U','S','SUB','SUP']);

  const xdoc = document.implementation.createDocument('http://www.w3.org/1999/xhtml', 'div', null);
  const root = xdoc.documentElement;

  const transplant = (node: Node, into: Element) => {
    if (node.nodeType === Node.TEXT_NODE) {
      into.appendChild(xdoc.createTextNode(node.nodeValue || ''));
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      if (!allowed.has(el.tagName)) { // flatten unknown tags
        el.childNodes.forEach(n => transplant(n, into));
        return;
      }
      const xEl = xdoc.createElementNS('http://www.w3.org/1999/xhtml', el.tagName.toLowerCase());
      // drop attributes for safety
      el.childNodes.forEach(n => transplant(n, xEl));
      into.appendChild(xEl);
    }
  };

  doc.body.childNodes.forEach(n => transplant(n, root));
  return new XMLSerializer().serializeToString(root); // XHTML-safe string
}

/**
 * Sanitizes HTML content for EPUB (removes scripts, ensures valid XHTML)
 */
const sanitizeHtml = (html: string): string => {
  // Remove scripts for security
  let out = html.replace(/<script[\s\S]*?<\/script>/gi, '');
  // Normalize common void elements to XHTML self-closing
  out = out.replace(/<br(\s*[^\/>]*)>/gi, '<br$1/>');
  out = out.replace(/<hr(\s*[^\/>]*)>/gi, '<hr$1/>');
  // Repair broken `<brX` / `<hrX` (letter or dash appended to tag name)
  out = out.replace(/<br([A-Za-z])/g, '<br/>$1');
  out = out.replace(/<hr([A-Za-z])/g, '<hr/>$1');
  out = out.replace(/<br([—–-])/g, '<br/>$1');
  out = out.replace(/<hr([—–-])/g, '<hr/>$1');
  // Repair `<br<` or `<hr<` sequences left by marker replacement
  out = out.replace(/<br</g, '<br/></');
  out = out.replace(/<hr</g, '<hr/></');
  // Repair stray `<br“` or `<br"` (missing closing) into `<br/>`
  out = out.replace(/<br(?=(?:\"|“))/g, '<br/>' );
  out = out.replace(/<hr(?=(?:\"|“))/g, '<hr/>' );
  // Escape raw ampersands in attribute values (both single- and double-quoted)
  out = out.replace(/(=")(.*?)(")/g, (_m, p1, val, p3) => {
    const fixed = val.replace(/&(?!(amp|lt|gt|quot|apos);)/g, '&amp;');
    return p1 + fixed + p3;
  });
  out = out.replace(/(=')(.*?)(')/g, (_m, p1, val, p3) => {
    const fixed = val.replace(/&(?!(amp|lt|gt|quot|apos);)/g, '&amp;');
    return p1 + fixed + p3;
  });
  return out;
};
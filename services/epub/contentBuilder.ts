/**
 * EPUB Content Builder
 *
 * Phase 3 of EPUB export pipeline: turns collected data into XHTML/HTML strings.
 * Pure function - no I/O, just string manipulation.
 */

import type {
  ResolvedAssets,
  BuiltContent,
  EpubExportOptions,
  EpubManifestItem,
  EpubSpineItem,
  EpubNavItem
} from './types';

/**
 * Build EPUB content from resolved assets
 *
 * Generates:
 * - XHTML files for each chapter (with images and footnotes)
 * - Optional title page
 * - Optional statistics page
 * - OPF manifest (file listing)
 * - OPF spine (reading order)
 * - Navigation document (TOC)
 *
 * @param resolvedAssets Chapters with resolved image references
 * @param options Export configuration
 * @returns Complete EPUB content ready for packaging
 */
export function buildEpubContent(
  resolvedAssets: ResolvedAssets,
  options: EpubExportOptions
): BuiltContent {
  const manifestItems: EpubManifestItem[] = [];
  const spineItems: EpubSpineItem[] = [];
  const navigation: EpubNavItem[] = [];
  const chapterFiles: BuiltContent['chapterFiles'] = [];

  // Generate chapter XHTML files
  for (const chapter of resolvedAssets.chapters) {
    const chapterNum = chapter.chapterNumber || 0;
    const filename = `chapter-${String(chapterNum).padStart(3, '0')}.xhtml`;
    const chapterId = `chapter-${String(chapterNum).padStart(3, '0')}`;

    // Build chapter XHTML
    const xhtml = buildChapterXhtml(chapter, resolvedAssets.assets);

    chapterFiles.push({
      filename,
      content: xhtml,
      chapterId: chapter.id
    });

    // Add to manifest
    manifestItems.push({
      id: chapterId,
      href: `text/${filename}`,
      mediaType: 'application/xhtml+xml'
    });

    // Add to spine
    spineItems.push({
      idref: chapterId,
      linear: 'yes'
    });

    // Add to navigation
    const title = chapter.translatedTitle || chapter.title;
    navigation.push({
      title: `Chapter ${chapterNum}: ${title}`,
      href: `text/${filename}`
    });
  }

  // Add assets to manifest
  for (const asset of resolvedAssets.assets) {
    manifestItems.push({
      id: asset.id,
      href: `images/${asset.id}.${asset.extension}`,
      mediaType: asset.mimeType
    });
  }

  // Generate title page (optional)
  let titlePage: BuiltContent['titlePage'];
  if (options.includeTitlePage) {
    titlePage = {
      filename: 'title.xhtml',
      content: buildTitlePageXhtml(options)
    };

    manifestItems.unshift({
      id: 'title-page',
      href: 'text/title.xhtml',
      mediaType: 'application/xhtml+xml'
    });

    spineItems.unshift({
      idref: 'title-page',
      linear: 'yes'
    });
  }

  // Generate statistics page (optional)
  let statsPage: BuiltContent['statsPage'];
  if (options.includeStatsPage) {
    statsPage = {
      filename: 'statistics.xhtml',
      content: buildStatisticsPageXhtml(resolvedAssets)
    };

    manifestItems.push({
      id: 'statistics',
      href: 'text/statistics.xhtml',
      mediaType: 'application/xhtml+xml'
    });

    spineItems.push({
      idref: 'statistics',
      linear: 'yes'
    });
  }

  // Add navigation document to manifest
  manifestItems.push({
    id: 'nav',
    href: 'nav.xhtml',
    mediaType: 'application/xhtml+xml',
    properties: 'nav'
  });

  // Build package metadata
  const packageMeta = {
    title: options.settings.novelTitle || 'Untitled Novel',
    language: 'en',
    identifier: `urn:uuid:${generateUUID()}`,
    date: new Date().toISOString()
  };

  return {
    chapterFiles,
    titlePage,
    statsPage,
    manifestItems,
    spineItems,
    navigation,
    packageMeta
  };
}

/**
 * Build XHTML for a single chapter
 */
function buildChapterXhtml(
  chapter: any,
  assets: any[]
): string {
  const title = chapter.translatedTitle || chapter.title;
  let content = chapter.translatedContent || chapter.content || '';

  // Inject images at placement markers
  for (const imgRef of chapter.imageReferences) {
    if (imgRef.assetId && !imgRef.missing) {
      const asset = assets.find(a => a.id === imgRef.assetId);
      if (asset) {
        const imgTag = `<img src="../images/${imgRef.assetId}.${asset.extension}" alt="${escapeHtml(imgRef.prompt)}" />`;
        content = content.replace(`[${imgRef.placementMarker}]`, imgTag);
      }
    } else {
      // Remove marker if image missing
      content = content.replace(`[${imgRef.placementMarker}]`, '');
    }
  }

  const footnotes = chapter.footnotes || [];

  // Link footnote markers in content to footnote list
  for (const fn of footnotes) {
    if (!fn?.marker) continue;
    const normalizedMarker = String(fn.marker).replace(/^[\[]|[\]]$/g, '');
    if (!normalizedMarker) continue;

    const markerPattern = new RegExp(escapeRegExp(`[${normalizedMarker}]`), 'g');
    const refId = `fnref-${normalizedMarker}`;
    const footnoteId = `fn-${normalizedMarker}`;
    const replacement = `<sup id="${refId}"><a href="#${footnoteId}" epub:type="noteref">[${normalizedMarker}]</a></sup>`;
    content = content.replace(markerPattern, replacement);
  }

  // Build footnotes section
  let footnotesHtml = '';
  if (footnotes.length > 0) {
    footnotesHtml = '<section class="footnotes"><h2>Footnotes</h2><ol>';
    for (const fn of footnotes) {
      const normalizedMarker = String(fn.marker || '').replace(/^[\[]|[\]]$/g, '');
      const refId = normalizedMarker ? `fnref-${normalizedMarker}` : '';
      const footnoteId = normalizedMarker ? `fn-${normalizedMarker}` : '';
      const backlink = normalizedMarker ? ` <a href="#${refId}" class="footnote-back">↩</a>` : '';
      footnotesHtml += `<li id="${footnoteId}">${escapeHtml(fn.text || '')}${backlink}</li>`;
    }
    footnotesHtml += '</ol></section>';
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(title)}</title>
</head>
<body>
  <section epub:type="chapter">
    <h1>${escapeHtml(title)}</h1>
    <div class="chapter-body">
      ${content}
    </div>
    ${footnotesHtml}
  </section>
</body>
</html>`;
}

/**
 * Build title page XHTML
 */
function buildTitlePageXhtml(options: EpubExportOptions): string {
  const gratitude = options.metadata?.gratitudeMessage || '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <title>Title Page</title>
</head>
<body>
  <section epub:type="titlepage">
    <h1>${escapeHtml(options.settings.novelTitle || 'Untitled Novel')}</h1>
    ${gratitude ? `<p>${escapeHtml(gratitude)}</p>` : ''}
  </section>
</body>
</html>`;
}

/**
 * Build statistics page XHTML
 */
function buildStatisticsPageXhtml(resolvedAssets: ResolvedAssets): string {
  const totalChapters = resolvedAssets.chapters.length;
  let totalCost = 0;
  let totalTokens = 0;
  let totalTime = 0;
  const modelCounts: Record<string, number> = {};

  for (const chapter of resolvedAssets.chapters) {
    if (chapter.translationMeta) {
      totalCost += chapter.translationMeta.cost;
      totalTokens += chapter.translationMeta.tokens;
      totalTime += chapter.translationMeta.requestTime;

      const model = chapter.translationMeta.model;
      modelCounts[model] = (modelCounts[model] || 0) + 1;
    }
  }

  let modelsHtml = '';
  for (const [model, count] of Object.entries(modelCounts)) {
    modelsHtml += `<li>${escapeHtml(model)}: ${count} chapter${count > 1 ? 's' : ''}</li>`;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <title>Translation Statistics</title>
</head>
<body>
  <section>
    <h1>Translation Statistics</h1>
    <ul>
      <li>Total Chapters: ${totalChapters}</li>
      <li>Total Cost: $${totalCost.toFixed(4)}</li>
      <li>Total Tokens: ${totalTokens.toLocaleString()}</li>
      <li>Total Time: ${totalTime.toFixed(1)}s</li>
    </ul>
    <h2>Models Used</h2>
    <ul>${modelsHtml}</ul>
  </section>
</body>
</html>`;
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Generate a simple UUID v4
 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * EPUB Package Builder
 *
 * Phase 4 of EPUB export pipeline: assembles the final EPUB ZIP structure.
 * Creates proper EPUB 3.0 format with correct file ordering.
 */

import JSZip from 'jszip';
import type { BuiltContent, ResolvedAsset, EpubPackage } from './types';

/**
 * Package EPUB content into final ZIP blob
 *
 * Creates ZIP with proper structure:
 * 1. mimetype (uncompressed, first entry)
 * 2. META-INF/container.xml
 * 3. OEBPS/content.opf (manifest + spine)
 * 4. OEBPS/nav.xhtml (EPUB 3 navigation)
 * 5. OEBPS/text/*.xhtml (chapters)
 * 6. OEBPS/images/* (assets)
 *
 * @param content Built XHTML content and metadata
 * @param assets Resolved binary assets
 * @returns Final EPUB package as Blob
 */
export async function packageEpub(
  content: BuiltContent,
  assets: ResolvedAsset[]
): Promise<EpubPackage> {
  const zip = new JSZip();
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Add mimetype (MUST be first, MUST be uncompressed)
  zip.file('mimetype', 'application/epub+zip', {
    compression: 'STORE' // No compression
  });

  // 2. Add META-INF/container.xml
  const containerXml = buildContainerXml();
  zip.folder('META-INF')!.file('container.xml', containerXml);

  // 3. Add OEBPS/content.opf (manifest + spine)
  const contentOpf = buildContentOpf(content);
  const oebps = zip.folder('OEBPS')!;
  oebps.file('content.opf', contentOpf);

  // 4. Add OEBPS/nav.xhtml (EPUB 3 TOC)
  const navXhtml = buildNavigationXhtml(content);
  oebps.file('nav.xhtml', navXhtml);

  // 5. Add chapter XHTML files
  const textFolder = oebps.folder('text')!;
  if (content.titlePage) {
    textFolder.file(content.titlePage.filename, content.titlePage.content);
  }
  for (const chapterFile of content.chapterFiles) {
    textFolder.file(chapterFile.filename, chapterFile.content);
  }
  if (content.statsPage) {
    textFolder.file(content.statsPage.filename, content.statsPage.content);
  }

  // 6. Add image assets
  const imagesFolder = oebps.folder('images')!;
  for (const asset of assets) {
    imagesFolder.file(
      `${asset.id}.${asset.extension}`,
      asset.data
    );
  }

  // Validate structure
  if (content.chapterFiles.length === 0) {
    errors.push('No chapters in EPUB');
  }
  if (content.manifestItems.length === 0) {
    errors.push('Empty manifest - EPUB requires at least one content file');
  }

  // Generate ZIP blob
  const blob = await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/epub+zip',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 }
  });

  return {
    blob,
    sizeBytes: blob.size,
    validation: {
      valid: errors.length === 0,
      errors,
      warnings
    }
  };
}

/**
 * Build META-INF/container.xml
 */
function buildContainerXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;
}

/**
 * Build OEBPS/content.opf (package document)
 */
function buildContentOpf(content: BuiltContent): string {
  const { packageMeta, manifestItems, spineItems } = content;

  // Build manifest
  let manifestXml = manifestItems
    .map(item => {
      const props = item.properties ? ` properties="${item.properties}"` : '';
      return `    <item id="${escapeXml(item.id)}" href="${escapeXml(item.href)}" media-type="${escapeXml(item.mediaType)}"${props}/>`;
    })
    .join('\n');

  // Build spine
  let spineXml = spineItems
    .map(item => {
      const linear = item.linear ? ` linear="${item.linear}"` : '';
      return `    <itemref idref="${escapeXml(item.idref)}"${linear}/>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uuid_id">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>${escapeXml(packageMeta.title)}</dc:title>
    <dc:language>${escapeXml(packageMeta.language)}</dc:language>
    <dc:identifier id="uuid_id">${escapeXml(packageMeta.identifier)}</dc:identifier>
    <meta property="dcterms:modified">${packageMeta.date}</meta>
  </metadata>
  <manifest>
${manifestXml}
  </manifest>
  <spine>
${spineXml}
  </spine>
</package>`;
}

/**
 * Build OEBPS/nav.xhtml (EPUB 3 navigation document)
 */
function buildNavigationXhtml(content: BuiltContent): string {
  const { navigation, packageMeta } = content;

  let navItems = navigation
    .map(item => `      <li><a href="${escapeXml(item.href)}">${escapeXml(item.title)}</a></li>`)
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
  <meta charset="UTF-8"/>
  <title>Table of Contents</title>
</head>
<body>
  <nav epub:type="toc" id="toc">
    <h1>Table of Contents</h1>
    <ol>
${navItems}
    </ol>
  </nav>
</body>
</html>`;
}

/**
 * Escape XML special characters
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

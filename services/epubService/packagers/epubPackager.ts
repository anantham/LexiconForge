import JSZip from 'jszip';
import { EpubMeta, EpubChapter } from '../types';
import { escapeXml } from '../sanitizers/xhtmlSanitizer';
import { EPUB_STYLESHEET_CSS } from './stylesheet';

/**
 * Generates EPUB3-compliant ZIP file using JSZip (browser-compatible)
 */
export const generateEpub3WithJSZip = async (meta: EpubMeta, chapters: EpubChapter[]): Promise<ArrayBuffer> => {
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
  const stylesheet = EPUB_STYLESHEET_CSS;

  // Extract data:image payloads from chapter XHTML and rewrite to packaged image files
  type ImgEntry = { href: string; mediaType: string; base64: string; id: string };
  const processedChapters: { ch: EpubChapter; xhtml: string }[] = [];
  const imageEntries: ImgEntry[] = [];
  let imgIndex = 1;
  const dataImgRegex = /(<img\b[^>]*?src=")(data:(image\/[A-Za-z0-9.+-]+);base64,([A-Za-z0-9+/=]+))("[^>]*>)/g;

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

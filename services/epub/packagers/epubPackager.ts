import JSZip from 'jszip';
import { EpubMeta, EpubChapter } from '../types';
import { escapeXml } from '../sanitizers/xhtmlSanitizer';

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

// EPUB Worker - Handles EPUB generation off the main thread

import type { EpubExportOptions } from '../services/epubService';

// Message types for communication with main thread
export interface EpubJob {
  id: string;
  options: EpubExportOptions;
}

export interface EpubProgress {
  jobId: string;
  stage: 'collecting' | 'processing' | 'packaging' | 'completed' | 'error';
  progress: number; // 0-100
  message?: string;
  error?: string;
  result?: ArrayBuffer;
}

// Job state management
const activeJobs = new Map<string, AbortController>();

// Listen for messages from main thread
self.addEventListener('message', async (event) => {
  const { type, payload } = event.data;

  switch (type) {
    case 'START_EPUB_JOB':
      await handleEpubJob(payload);
      break;
    case 'CANCEL_EPUB_JOB':
      handleJobCancellation(payload.jobId);
      break;
    default:
      console.warn(`[EpubWorker] Unknown message type: ${type}`);
  }
});

async function handleEpubJob(job: EpubJob) {
  const { id, options } = job;
  const abortController = new AbortController();
  activeJobs.set(id, abortController);

  try {
    // Stage 1: Collecting data
    postProgress(id, 'collecting', 10, 'Collecting chapter data...');
    
    if (abortController.signal.aborted) {
      postProgress(id, 'error', 0, undefined, 'Job cancelled');
      return;
    }

    // Import services needed for EPUB generation
    const { collectActiveVersions, calculateTranslationStats } = await import('../services/epubService');
    const { getNovelConfig, generateTitlePage, generateTableOfContents, generateStatsAndAcknowledgments } = await import('../services/epub/Templates');
    
    // Collect active translations
    const chapters = await collectActiveVersions(options.chapterUrls || []);
    postProgress(id, 'collecting', 30, `Collected ${chapters.length} chapters`);

    if (abortController.signal.aborted) {
      postProgress(id, 'error', 0, undefined, 'Job cancelled');
      return;
    }

    // Stage 2: Processing content
    postProgress(id, 'processing', 40, 'Processing content and generating pages...');
    
    // Calculate statistics
    const stats = calculateTranslationStats(chapters);
    
    // Get novel configuration
    const novelConfig = getNovelConfig(
      chapters[0]?.url,
      options.manualConfig
    );

    // Generate template pages
    const titlePage = generateTitlePage(novelConfig, stats);
    const tableOfContents = generateTableOfContents(
      chapters.map((ch, idx) => ({
        title: ch.translatedTitle || ch.originalTitle,
        filename: `chapter_${idx + 1}.xhtml`
      })),
      options.includeStatsPage ?? true
    );
    
    let statsPage = '';
    if (options.includeStatsPage !== false) {
      const template = options.customTemplate || (await import('../services/epub/Templates')).getDefaultTemplate();
      statsPage = generateStatsAndAcknowledgments(stats, template);
    }

    postProgress(id, 'processing', 60, 'Converting chapters to XHTML...');

    // Process chapters with XHTML conversion
    const processedChapters = await Promise.all(
      chapters.map(async (chapter, index) => {
        if (abortController.signal.aborted) {
          throw new DOMException('Aborted', 'AbortError');
        }

        const { convertToXhtmlParagraphs } = await import('../services/epub/XhtmlSerializer');
        
        return {
          filename: `chapter_${index + 1}.xhtml`,
          title: chapter.translatedTitle || chapter.originalTitle,
          content: convertToXhtmlParagraphs(chapter.translatedContent || ''),
        };
      })
    );

    postProgress(id, 'processing', 80, 'Generated all content pages');

    // Stage 3: Packaging
    postProgress(id, 'packaging', 85, 'Creating EPUB archive...');

    if (abortController.signal.aborted) {
      postProgress(id, 'error', 0, undefined, 'Job cancelled');
      return;
    }

    // Create EPUB package
    const epubBuffer = await createEpubPackage({
      novelConfig,
      stats,
      titlePage,
      tableOfContents,
      statsPage: options.includeStatsPage !== false ? statsPage : '',
      chapters: processedChapters,
    });

    postProgress(id, 'packaging', 95, 'Finalizing EPUB...');

    // Job completed successfully
    postProgress(id, 'completed', 100, 'EPUB generation completed', undefined, epubBuffer);
    activeJobs.delete(id);

  } catch (error: any) {
    console.error(`[EpubWorker] Job ${id} failed:`, error);
    
    if (error.name === 'AbortError' || abortController.signal.aborted) {
      postProgress(id, 'error', 0, undefined, 'Job cancelled');
    } else {
      postProgress(id, 'error', 0, undefined, error.message);
    }
    
    activeJobs.delete(id);
  }
}

function handleJobCancellation(jobId: string) {
  const controller = activeJobs.get(jobId);
  if (controller) {
    controller.abort();
    activeJobs.delete(jobId);
    console.log(`[EpubWorker] Job ${jobId} cancelled`);
  }
}

function postProgress(
  jobId: string,
  stage: EpubProgress['stage'],
  progress: number,
  message?: string,
  error?: string,
  result?: ArrayBuffer
) {
  const progressUpdate: EpubProgress = {
    jobId,
    stage,
    progress,
    message,
    error,
    result
  };

  self.postMessage({
    type: 'EPUB_PROGRESS',
    payload: progressUpdate
  });
}

// Create EPUB package using JSZip
async function createEpubPackage(content: {
  novelConfig: any;
  stats: any;
  titlePage: string;
  tableOfContents: string;
  statsPage: string;
  chapters: Array<{ filename: string; title: string; content: string }>;
}): Promise<ArrayBuffer> {
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();

  // EPUB structure
  zip.file('mimetype', 'application/epub+zip');
  
  // META-INF
  const metaInf = zip.folder('META-INF')!;
  metaInf.file('container.xml', `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`);

  // OEBPS folder
  const oebps = zip.folder('OEBPS')!;
  
  // Add content files
  oebps.file('title.xhtml', content.titlePage);
  oebps.file('toc.xhtml', content.tableOfContents);
  
  if (content.statsPage) {
    oebps.file('stats-acknowledgments.xhtml', content.statsPage);
  }

  // Add chapters
  content.chapters.forEach(chapter => {
    oebps.file(chapter.filename, wrapInXhtmlDocument(chapter.title, chapter.content));
  });

  // Generate content.opf (package document)
  const contentOpf = generateContentOpf(content.novelConfig, content.chapters, !!content.statsPage);
  oebps.file('content.opf', contentOpf);

  // Generate toc.ncx (navigation document)  
  const tocNcx = generateTocNcx(content.novelConfig, content.chapters, !!content.statsPage);
  oebps.file('toc.ncx', tocNcx);

  // Generate the zip
  return zip.generateAsync({ 
    type: 'arraybuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 }
  });
}

function wrapInXhtmlDocument(title: string, content: string): string {
  const escapeHtml = (text: string) => 
    text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>${escapeHtml(title)}</title>
  <meta charset="utf-8"/>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  ${content}
</body>
</html>`;
}

function generateContentOpf(novelConfig: any, chapters: any[], includeStats: boolean): string {
  const uuid = 'urn:uuid:' + crypto.randomUUID();
  const escapeXml = (text: string) => 
    text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const chapterItems = chapters.map((_, index) => 
    `    <item id="chapter${index + 1}" href="chapter_${index + 1}.xhtml" media-type="application/xhtml+xml"/>`
  ).join('\n');

  const spineItems = chapters.map((_, index) => 
    `    <itemref idref="chapter${index + 1}"/>`
  ).join('\n');

  const statsItems = includeStats ? 
    '    <item id="stats" href="stats-acknowledgments.xhtml" media-type="application/xhtml+xml"/>' : '';
  
  const statsSpine = includeStats ? 
    '    <itemref idref="stats"/>' : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="book-id" version="3.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="book-id">${uuid}</dc:identifier>
    <dc:title>${escapeXml(novelConfig.title)}</dc:title>
    <dc:creator>${escapeXml(novelConfig.author)}</dc:creator>
    <dc:language>${novelConfig.language}</dc:language>
    <meta property="dcterms:modified">${new Date().toISOString().split('.')[0]}Z</meta>
  </metadata>
  
  <manifest>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
    <item id="title" href="title.xhtml" media-type="application/xhtml+xml"/>
    <item id="toc" href="toc.xhtml" media-type="application/xhtml+xml"/>
${chapterItems}
${statsItems}
  </manifest>
  
  <spine toc="ncx">
    <itemref idref="title"/>
    <itemref idref="toc"/>
${spineItems}
${statsSpine}
  </spine>
</package>`;
}

function generateTocNcx(novelConfig: any, chapters: any[], includeStats: boolean): string {
  const escapeXml = (text: string) => 
    text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const navPoints = chapters.map((chapter, index) => 
    `    <navPoint id="chapter${index + 1}" playOrder="${index + 3}">
      <navLabel><text>${escapeXml(chapter.title)}</text></navLabel>
      <content src="chapter_${index + 1}.xhtml"/>
    </navPoint>`
  ).join('\n');

  const statsNavPoint = includeStats ? 
    `    <navPoint id="stats" playOrder="${chapters.length + 3}">
      <navLabel><text>Translation Stats &amp; Acknowledgments</text></navLabel>
      <content src="stats-acknowledgments.xhtml"/>
    </navPoint>` : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE ncx PUBLIC "-//NISO//DTD ncx 2005-1//EN" "http://www.daisy.org/z3986/2005/ncx-2005-1.dtd">
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="urn:uuid:${crypto.randomUUID()}"/>
    <meta name="dtb:depth" content="1"/>
    <meta name="dtb:totalPageCount" content="0"/>
    <meta name="dtb:maxPageNumber" content="0"/>
  </head>
  
  <docTitle>
    <text>${escapeXml(novelConfig.title)}</text>
  </docTitle>
  
  <navMap>
    <navPoint id="title" playOrder="1">
      <navLabel><text>Title Page</text></navLabel>
      <content src="title.xhtml"/>
    </navPoint>
    <navPoint id="toc" playOrder="2">
      <navLabel><text>Table of Contents</text></navLabel>
      <content src="toc.xhtml"/>
    </navPoint>
${navPoints}
${statsNavPoint}
  </navMap>
</ncx>`;
}

console.log('[EpubWorker] Worker initialized and ready');
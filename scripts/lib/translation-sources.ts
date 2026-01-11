/**
 * Translation Source Adapters
 *
 * A principled system for importing text from various sources:
 * - EPUB files (84000, academic translations)
 * - TXT file directories (fan translations)
 * - Polyglotta JSON (scraped parallel texts)
 * - Future: PDF, DOCX, online sources
 *
 * Each source can provide multiple translation "voices" with proper attribution.
 */

import * as fs from 'fs';
import * as path from 'path';
import JSZip from 'jszip';

// ========== CORE TYPES ==========

/**
 * Metadata about a translator/source - captures cultural, temporal, and scholarly context
 */
export interface TranslatorMetadata {
  name: string;                    // "Étienne Lamotte", "Kumārajīva", "84000 Translation Team"
  era?: string;                    // "406 CE", "1976", "2020"
  tradition?: string;              // "Mādhyamaka", "Yogācāra", "Academic", "Sinological"
  language: string;                // "English", "Chinese", "Tibetan"
  notes?: string;                  // Context about biases, political setting, intended audience
  sourceReference?: string;        // "Taishō 474", "Derge 176", "ISBN..."
}

/**
 * A single aligned paragraph/unit across translations
 */
export interface AlignedUnit {
  id: string;                      // Stable identifier for alignment (e.g., "§1", "1.1")
  sourceText?: string;             // Primary source text (Sanskrit, etc.)
  versions: Record<string, {       // Keyed by translator/version ID
    text: string;
    reference?: string;            // Page/line reference in that edition
    notes?: string[];              // Translator's notes for this passage
  }>;
}

/**
 * A chapter/section containing multiple aligned units
 */
export interface PolyglotChapter {
  chapterNumber: number;
  stableId: string;
  title: string;
  sourceTitle?: string;            // Original language title
  units: AlignedUnit[];
}

/**
 * Complete polyglot document with all translation versions
 */
export interface PolyglotDocument {
  metadata: {
    title: string;
    sourceLanguage?: string;       // "Sanskrit", "Pāli"
    genre?: string;                // "Buddhist Sūtra", "Novel", "Poetry"
    period?: string;               // "1st century CE", "Tang Dynasty"
  };
  translators: Record<string, TranslatorMetadata>;  // All translators keyed by ID
  chapters: PolyglotChapter[];
}

/**
 * Output from a translation source adapter
 */
export interface TranslationSourceOutput {
  translatorId: string;
  translator: TranslatorMetadata;
  chapters: Array<{
    chapterNumber: number;
    title: string;
    paragraphs: Array<{
      id?: string;                 // Alignment ID if available (e.g., "1.1")
      text: string;
      notes?: string[];
    }>;
  }>;
}

// ========== ADAPTER INTERFACE ==========

export interface TranslationSourceAdapter {
  name: string;
  fileExtensions?: string[];       // For file-based sources

  /**
   * Check if this adapter can handle the given input
   */
  canHandle(input: string): boolean;

  /**
   * Extract translation data from the source
   */
  extract(input: string): Promise<TranslationSourceOutput>;
}

// ========== EPUB ADAPTER ==========

export class EpubAdapter implements TranslationSourceAdapter {
  name = 'epub';
  fileExtensions = ['.epub'];

  canHandle(input: string): boolean {
    return input.toLowerCase().endsWith('.epub') && fs.existsSync(input);
  }

  async extract(epubPath: string): Promise<TranslationSourceOutput> {
    console.log(`📚 Parsing EPUB: ${path.basename(epubPath)}`);

    const epubBuffer = fs.readFileSync(epubPath);
    const zip = await JSZip.loadAsync(epubBuffer);

    // Find and parse container.xml to get content.opf location
    const containerXml = await zip.file('META-INF/container.xml')?.async('string');
    if (!containerXml) {
      throw new Error('Invalid EPUB: missing container.xml');
    }

    // Extract rootfile path
    const rootfileMatch = containerXml.match(/full-path="([^"]+)"/);
    if (!rootfileMatch) {
      throw new Error('Invalid EPUB: cannot find rootfile');
    }

    const opfPath = rootfileMatch[1];
    const opfDir = path.dirname(opfPath);

    // Parse content.opf
    const opfContent = await zip.file(opfPath)?.async('string');
    if (!opfContent) {
      throw new Error('Invalid EPUB: missing content.opf');
    }

    // Extract metadata
    const titleMatch = opfContent.match(/<dc:title[^>]*>([^<]+)<\/dc:title>/);
    const creatorMatch = opfContent.match(/<dc:creator[^>]*>([^<]+)<\/dc:creator>/);
    const publisherMatch = opfContent.match(/<dc:publisher[^>]*>([^<]+)<\/dc:publisher>/);
    const dateMatch = opfContent.match(/<dc:date[^>]*>([^<]+)<\/dc:date>/);

    const title = titleMatch?.[1] || 'Unknown Title';
    const creator = creatorMatch?.[1] || 'Unknown Translator';
    const publisher = publisherMatch?.[1];
    const date = dateMatch?.[1];

    // Determine translator ID from source
    const translatorId = this.generateTranslatorId(creator, publisher);

    console.log(`   Title: ${title}`);
    console.log(`   Creator: ${creator}`);
    console.log(`   Publisher: ${publisher || 'N/A'}`);

    // Extract spine items (ordered content files)
    const spineMatches = [...opfContent.matchAll(/<itemref[^>]*idref="([^"]+)"[^>]*\/?>/g)];
    const manifestMatches = [...opfContent.matchAll(/<item[^>]*id="([^"]+)"[^>]*href="([^"]+)"[^>]*\/?>/g)];

    const manifest: Record<string, string> = {};
    for (const match of manifestMatches) {
      manifest[match[1]] = match[2];
    }

    const chapters: TranslationSourceOutput['chapters'] = [];
    let chapterNum = 0;

    for (const spineMatch of spineMatches) {
      const itemId = spineMatch[1];
      const href = manifest[itemId];

      if (!href || !href.endsWith('.xhtml') && !href.endsWith('.html')) {
        continue;
      }

      const contentPath = opfDir ? `${opfDir}/${href}` : href;
      const content = await zip.file(contentPath)?.async('string');

      if (!content) continue;

      // Skip non-chapter content (front matter, etc.)
      if (this.isFrontMatter(content, href)) {
        continue;
      }

      chapterNum++;
      const chapterTitle = this.extractChapterTitle(content) || `Chapter ${chapterNum}`;
      const paragraphs = this.extractParagraphs(content);

      if (paragraphs.length > 0) {
        chapters.push({
          chapterNumber: chapterNum,
          title: chapterTitle,
          paragraphs
        });
        console.log(`   ✅ Chapter ${chapterNum}: "${chapterTitle}" (${paragraphs.length} paragraphs)`);
      }
    }

    // Build translator metadata
    const translator: TranslatorMetadata = {
      name: creator,
      language: 'English',
      era: date ? new Date(date).getFullYear().toString() : undefined,
      tradition: publisher === '84000' ? 'Academic/Tibetan Buddhism' : 'Academic',
      sourceReference: publisher ? `Published by ${publisher}` : undefined,
    };

    console.log(`\n📊 Extracted ${chapters.length} chapters`);

    return {
      translatorId,
      translator,
      chapters
    };
  }

  private generateTranslatorId(creator: string, publisher?: string): string {
    // Generate a stable ID from creator/publisher
    const base = publisher?.toLowerCase() === '84000'
      ? 'english-84000'
      : `english-${creator.split(' ').pop()?.toLowerCase() || 'unknown'}`;
    return base.replace(/[^a-z0-9-]/g, '');
  }

  private isFrontMatter(content: string, href: string): boolean {
    const frontMatterPatterns = [
      /title\.xhtml/i,
      /imprint/i,
      /toc\.xhtml/i,
      /copyright/i,
      /halftitle/i,
      /frontmatter/i,
    ];

    if (frontMatterPatterns.some(p => p.test(href))) {
      return true;
    }

    // Check content for front matter indicators
    const lowerContent = content.toLowerCase();
    if (lowerContent.includes('table of contents') ||
        lowerContent.includes('copyright ©')) {
      return true;
    }

    return false;
  }

  private extractChapterTitle(content: string): string | null {
    // Try h1 first
    const h1Match = content.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    if (h1Match) return this.cleanHtml(h1Match[1]);

    // Try title tag
    const titleMatch = content.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch) return this.cleanHtml(titleMatch[1]);

    // Try data-heading attribute
    const headingMatch = content.match(/data-heading="([^"]+)"/i);
    if (headingMatch) return this.cleanHtml(headingMatch[1]);

    return null;
  }

  private extractParagraphs(content: string): Array<{id?: string; text: string; notes?: string[]}> {
    const paragraphs: Array<{id?: string; text: string; notes?: string[]}> = [];

    // Extract paragraphs with their data-location-id (used by 84000 for alignment)
    const pMatches = [...content.matchAll(/<p[^>]*(?:data-location-id="([^"]*)")?[^>]*>([^]*?)<\/p>/gi)];

    for (const match of pMatches) {
      const locationId = match[1];
      let text = this.cleanHtml(match[2]);

      // Skip empty or very short paragraphs
      if (!text || text.length < 3) continue;

      // Extract inline notes if present
      const notes: string[] = [];
      const noteMatches = [...match[2].matchAll(/<a[^>]*class="[^"]*note[^"]*"[^>]*data-glossary-id="([^"]*)"[^>]*>/gi)];
      for (const noteMatch of noteMatches) {
        if (noteMatch[1]) {
          notes.push(noteMatch[1]);
        }
      }

      paragraphs.push({
        id: locationId || undefined,
        text,
        notes: notes.length > 0 ? notes : undefined
      });
    }

    return paragraphs;
  }

  private cleanHtml(html: string): string {
    return html
      .replace(/<[^>]+>/g, '')           // Remove HTML tags
      .replace(/&nbsp;/g, ' ')           // Replace nbsp
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code)))
      .replace(/\s+/g, ' ')              // Normalize whitespace
      .trim();
  }
}

// ========== TXT DIRECTORY ADAPTER ==========

export class TxtDirectoryAdapter implements TranslationSourceAdapter {
  name = 'txt-directory';

  canHandle(input: string): boolean {
    return fs.existsSync(input) && fs.statSync(input).isDirectory();
  }

  async extract(dirPath: string): Promise<TranslationSourceOutput> {
    console.log(`📁 Reading TXT files from: ${path.basename(dirPath)}`);

    const files = fs.readdirSync(dirPath)
      .filter(f => f.endsWith('.txt'))
      .sort();

    const chapters: TranslationSourceOutput['chapters'] = [];

    for (const file of files) {
      const chapterNum = this.extractChapterNumber(file);
      if (chapterNum === null) {
        console.log(`   ⚠️ Skipping: ${file} (no chapter number)`);
        continue;
      }

      const content = fs.readFileSync(path.join(dirPath, file), 'utf-8').trim();
      if (!content) continue;

      // Split content into paragraphs
      const paragraphs = content.split(/\n\n+/).map(p => ({
        text: p.trim()
      })).filter(p => p.text.length > 0);

      const title = this.extractTitle(file) || `Chapter ${chapterNum}`;

      chapters.push({
        chapterNumber: chapterNum,
        title,
        paragraphs
      });

      console.log(`   ✅ Chapter ${chapterNum}: "${title}" (${paragraphs.length} paragraphs)`);
    }

    console.log(`\n📊 Loaded ${chapters.length} chapters from TXT files`);

    return {
      translatorId: 'english-fan',
      translator: {
        name: 'Fan Translation',
        language: 'English',
        tradition: 'Fan/Community',
      },
      chapters
    };
  }

  private extractChapterNumber(filename: string): number | null {
    // Pattern: Chapter-NNNN-Title.txt
    const match = filename.match(/^Chapter-(\d+)-/i);
    if (match) return parseInt(match[1], 10);

    // Pattern: 001-Title.txt or 01_Title.txt
    const numMatch = filename.match(/^(\d+)[-_]/);
    if (numMatch) return parseInt(numMatch[1], 10);

    return null;
  }

  private extractTitle(filename: string): string | null {
    // Pattern: Chapter-NNNN-Title.txt
    const match = filename.match(/^Chapter-\d+-(.+)\.txt$/i);
    if (match) return match[1].trim();

    // Pattern: 001-Title.txt
    const numMatch = filename.match(/^\d+[-_](.+)\.txt$/i);
    if (numMatch) return numMatch[1].trim();

    return null;
  }
}

// ========== POLYGLOTTA JSON ADAPTER ==========

export class PolyglottaJsonAdapter implements TranslationSourceAdapter {
  name = 'polyglotta-json';
  fileExtensions = ['.json'];

  canHandle(input: string): boolean {
    if (!input.endsWith('.json') || !fs.existsSync(input)) {
      return false;
    }

    try {
      const content = JSON.parse(fs.readFileSync(input, 'utf-8'));
      return content.metadata?.source === 'polyglotta';
    } catch {
      return false;
    }
  }

  async extract(jsonPath: string): Promise<TranslationSourceOutput> {
    console.log(`📜 Parsing Polyglotta JSON: ${path.basename(jsonPath)}`);

    const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

    // Polyglotta JSON contains multiple translation versions
    // We return a special format that the merge tool can expand
    console.log(`   Title: ${data.metadata?.text?.title || 'Unknown'}`);
    console.log(`   Sections: ${data.chapters?.length || 0}`);
    console.log(`   Paragraphs: ${data.metadata?.totalParagraphs || 0}`);

    // For now, return the primary (Sanskrit) version
    // The merge tool will handle expanding to all versions
    const chapters = (data.chapters || []).map((ch: any) => ({
      chapterNumber: ch.chapterNumber,
      title: ch.title,
      paragraphs: (ch.polyglotContent || []).map((p: any) => ({
        id: p.id,
        text: p.versions?.sanskrit?.text ||
              Object.values(p.versions || {})[0]?.text || '',
      }))
    }));

    return {
      translatorId: 'polyglotta-source',
      translator: {
        name: 'Polyglotta Archive',
        language: 'Multiple',
        tradition: 'Academic/Scholarly',
        sourceReference: 'University of Oslo Polyglotta',
      },
      chapters
    };
  }

  /**
   * Extract all translation versions from Polyglotta JSON
   * Returns a PolyglotDocument with all aligned versions
   */
  async extractAllVersions(jsonPath: string): Promise<PolyglotDocument> {
    const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

    // Build translator metadata from the data
    const translators: Record<string, TranslatorMetadata> = {
      'sanskrit': {
        name: 'Sanskrit Original',
        language: 'Sanskrit',
        tradition: 'Source Text',
      },
      'chinese-kumarajiva': {
        name: 'Kumārajīva',
        era: '406 CE',
        language: 'Chinese',
        tradition: 'Mādhyamaka',
        notes: 'Most influential Chinese translation, emphasizes emptiness',
      },
      'chinese-xuanzang': {
        name: 'Xuánzàng',
        era: '650 CE',
        language: 'Chinese',
        tradition: 'Yogācāra',
        notes: 'More literal translation, Yogācāra terminology',
      },
      'chinese-zhiqian': {
        name: 'Zhīqiān',
        era: '224 CE',
        language: 'Chinese',
        tradition: 'Early Chinese Buddhism',
        notes: 'Earliest Chinese translation, Daoist influence',
      },
      'tibetan': {
        name: 'Tibetan Translation',
        language: 'Tibetan',
        tradition: 'Tibetan Buddhism',
      },
      'english-lamotte': {
        name: 'Étienne Lamotte',
        era: '1962',
        language: 'English (via French)',
        tradition: 'Academic/Sinological',
        notes: 'Scholarly translation with extensive commentary',
      },
      'english-thurman': {
        name: 'Robert Thurman',
        era: '1976',
        language: 'English',
        tradition: 'Tibetan Buddhist/Academic',
        notes: 'Translation from Tibetan, accessible style',
      },
    };

    // Build chapters with all aligned versions
    const chapters: PolyglotChapter[] = (data.chapters || []).map((ch: any) => ({
      chapterNumber: ch.chapterNumber,
      stableId: ch.stableId,
      title: ch.title,
      units: (ch.polyglotContent || []).map((p: any) => ({
        id: p.id,
        versions: p.versions || {}
      }))
    }));

    return {
      metadata: {
        title: data.metadata?.text?.title || 'Unknown Text',
        sourceLanguage: 'Sanskrit',
        genre: 'Buddhist Sūtra',
      },
      translators,
      chapters
    };
  }
}

// ========== ADAPTER REGISTRY ==========

export const adapters: TranslationSourceAdapter[] = [
  new EpubAdapter(),
  new TxtDirectoryAdapter(),
  new PolyglottaJsonAdapter(),
];

export function findAdapter(input: string): TranslationSourceAdapter | null {
  for (const adapter of adapters) {
    if (adapter.canHandle(input)) {
      return adapter;
    }
  }
  return null;
}

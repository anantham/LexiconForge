import * as fs from 'fs';
import * as path from 'path';
import JSZip from 'jszip';

import {
  parseChapterNumberToken,
} from '../chapter-parsing';
import {
  normalizePlainText,
} from '../text-processing';
import type {
  TranslationSourceAdapter,
  TranslationSourceOutput,
  TranslatorMetadata,
  TranslationParagraph,
} from '../translation-source-types';

interface ExtractedHeading {
  title: string | null;
  chapterToken?: string;
}

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

    const containerXml = await zip.file('META-INF/container.xml')?.async('string');
    if (!containerXml) {
      throw new Error('Invalid EPUB: missing container.xml');
    }

    const rootfileMatch = containerXml.match(/full-path="([^"]+)"/);
    if (!rootfileMatch) {
      throw new Error('Invalid EPUB: cannot find rootfile');
    }

    const opfPath = rootfileMatch[1];
    const opfDir = path.dirname(opfPath);
    const opfContent = await zip.file(opfPath)?.async('string');
    if (!opfContent) {
      throw new Error('Invalid EPUB: missing content.opf');
    }

    const titleMatch = opfContent.match(/<dc:title[^>]*>([^<]+)<\/dc:title>/);
    const creatorMatch = opfContent.match(/<dc:creator[^>]*>([^<]+)<\/dc:creator>/);
    const publisherMatch = opfContent.match(/<dc:publisher[^>]*>([^<]+)<\/dc:publisher>/);
    const dateMatch = opfContent.match(/<dc:date[^>]*>([^<]+)<\/dc:date>/);

    const title = titleMatch?.[1] || 'Unknown Title';
    const creator = creatorMatch?.[1] || 'Unknown Translator';
    const publisher = publisherMatch?.[1];
    const date = dateMatch?.[1];
    const translatorId = this.generateTranslatorId(creator, publisher);

    console.log(`   Title: ${title}`);
    console.log(`   Creator: ${creator}`);
    console.log(`   Publisher: ${publisher || 'N/A'}`);

    const spineMatches = [...opfContent.matchAll(/<itemref[^>]*idref="([^"]+)"[^>]*\/?>/g)];
    // Parse each <item> tag and read id/href independently so attribute ORDER
    // does not matter (many EPUBs emit `href` before `id`, which an ordered
    // id-then-href regex silently misses → empty manifest → 0 chapters).
    const manifestMatches = [...opfContent.matchAll(/<item\b[^>]*>/g)];

    const manifest: Record<string, string> = {};
    for (const match of manifestMatches) {
      const tag = match[0];
      const id = tag.match(/\bid="([^"]+)"/)?.[1];
      const href = tag.match(/\bhref="([^"]+)"/)?.[1];
      if (id && href) {
        manifest[id] = href;
      }
    }

    const chapters: TranslationSourceOutput['chapters'] = [];
    let fallbackChapterNumber = 0;

    for (const spineMatch of spineMatches) {
      const itemId = spineMatch[1];
      const href = manifest[itemId];
      if (!href || (!href.endsWith('.xhtml') && !href.endsWith('.html') && !href.endsWith('.htm'))) {
        continue;
      }

      const contentPath = !opfDir || opfDir === '.'
        ? href
        : `${opfDir}/${href}`;
      const raw = await zip.file(contentPath)?.async('string');
      if (!raw || this.isFrontMatter(raw, href)) {
        continue;
      }
      const content = this.stripGutenbergBoilerplate(raw);

      // Many EPUBs (notably Project Gutenberg) pack SEVERAL chapters into one spine
      // file. Split at chapter headings so each becomes its own chapter; otherwise a
      // 36-chapter book extracts as 6 giant blobs and can never be aligned per chapter.
      for (const section of this.splitAtChapterHeadings(content)) {
        const extractedHeading = this.extractChapterHeading(section);
        const chapterRange = extractedHeading.chapterToken
          ? parseChapterNumberToken(extractedHeading.chapterToken)
          : undefined;
        const chapterNumber = chapterRange?.from ?? ++fallbackChapterNumber;
        fallbackChapterNumber = Math.max(fallbackChapterNumber, chapterNumber);

        const paragraphs = this.extractParagraphs(section);
        if (paragraphs.length === 0) {
          continue;
        }

        const chapterTitle = extractedHeading.title || `Chapter ${chapterRange?.from ?? chapterNumber}`;

        chapters.push({
          chapterNumber,
          title: chapterTitle,
          ...(chapterRange ? { chapterRange } : {}),
          paragraphs,
        });
        console.log(`   ✅ Chapter ${chapterNumber}: "${chapterTitle}" (${paragraphs.length} paragraphs)`);
      }
    }

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
      chapters,
    };
  }

  private generateTranslatorId(creator: string, publisher?: string): string {
    const base = publisher?.toLowerCase() === '84000'
      ? 'english-84000'
      : `english-${creator.split(' ').pop()?.toLowerCase() || 'unknown'}`;
    return base.replace(/[^a-z0-9-]/g, '');
  }

  /**
   * Strip the Project Gutenberg envelope (header preamble and trailing licence).
   *
   * PG appends the licence to the LAST content file, i.e. in the same file as the final
   * chapter. Dropping any file that mentions "Project Gutenberg" therefore silently
   * deletes the book's last chapter — so the boilerplate must be cut out of the file,
   * not used to discard it.
   */
  private stripGutenbergBoilerplate(content: string): string {
    let out = content;
    const start = out.match(/\*\*\*\s*START OF (?:THE|THIS) PROJECT GUTENBERG EBOOK[\s\S]{0,200}?\*\*\*/i);
    if (start?.index !== undefined) out = out.slice(start.index + start[0].length);
    const end = out.match(/\*\*\*\s*END OF (?:THE|THIS) PROJECT GUTENBERG EBOOK/i);
    if (end?.index !== undefined) out = out.slice(0, end.index);
    // Some editions head the licence with a heading rather than the *** marker.
    const lic = out.match(/<h[1-6][^>]*>\s*(?:THE FULL\s+)?PROJECT GUTENBERG[^<]*LICEN[SC]E/i);
    if (lic?.index !== undefined) out = out.slice(0, lic.index);
    return out;
  }

  /**
   * Split one spine file into per-chapter sections at chapter headings.
   *
   * Project Gutenberg (and others) often pack many chapters into a single file. Without
   * this, a 36-chapter book extracts as a handful of giant blobs.
   *
   * Guards, because a naive split shreds the table of contents (which also lists every
   * "CHAPTER N"): a heading only starts a section if the text that follows it, before
   * the next heading, has real prose (>= MIN_PARAS paragraphs). If fewer than 2 headings
   * survive that test, the file is left whole.
   */
  private splitAtChapterHeadings(content: string): string[] {
    const HEADING = /<h[1-6]\b[^>]*>[\s\S]*?<\/h[1-6]>/gi;
    // "CHAPTER XV", "CAPITOLO 3", "CAP. IV" — number may be roman or arabic.
    const CHAPTERISH = /^\s*(?:chapter|capitolo|cap\.?|chapitre|kapitel)\s*[ivxlcdm\d]/i;
    const MIN_PARAS = 3;

    const starts: number[] = [];
    let m: RegExpExecArray | null;
    while ((m = HEADING.exec(content)) !== null) {
      const text = m[0].replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').trim();
      if (CHAPTERISH.test(text)) starts.push(m.index);
    }
    if (starts.length < 2) return [content];

    const sections: string[] = [];
    for (let i = 0; i < starts.length; i++) {
      const section = content.slice(starts[i], i + 1 < starts.length ? starts[i + 1] : undefined);
      // TOC guard: a real chapter has prose after its heading, a TOC entry does not.
      if (this.extractParagraphs(section).length >= MIN_PARAS) sections.push(section);
    }
    return sections.length >= 2 ? sections : [content];
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

    if (frontMatterPatterns.some((pattern) => pattern.test(href))) {
      return true;
    }

    const lowerContent = content.toLowerCase();
    return lowerContent.includes('table of contents') || lowerContent.includes('copyright ©');
  }

  private extractChapterHeading(content: string): ExtractedHeading {
    const candidates = [
      content.match(/<h1[^>]*>([^<]+)<\/h1>/i)?.[1],
      content.match(/<h2[^>]*>([^<]+)<\/h2>/i)?.[1],
      content.match(/<h3[^>]*>([^<]+)<\/h3>/i)?.[1],
      content.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1],
      content.match(/data-heading="([^"]+)"/i)?.[1],
    ]
      .filter((candidate): candidate is string => Boolean(candidate))
      .map((candidate) => normalizePlainText(candidate))
      .filter((candidate, index, allCandidates) => (
        candidate.length > 0 && allCandidates.indexOf(candidate) === index
      ));

    for (const candidate of candidates) {
      const chapterMatch = candidate.match(/Chapter\s+(\d+(?:-\d+)?)(?:\s*[:\-–]\s*(.*))?/i);
      if (chapterMatch) {
        const titleRemainder = (chapterMatch[2] || '').trim();
        return {
          title: titleRemainder.length > 0 ? `Chapter ${chapterMatch[1]}: ${titleRemainder}` : `Chapter ${chapterMatch[1]}`,
          chapterToken: chapterMatch[1],
        };
      }
    }

    return {
      title: candidates[0] || null,
    };
  }

  private extractParagraphs(content: string): TranslationParagraph[] {
    const paragraphs: TranslationParagraph[] = [];
    const pMatches = [...content.matchAll(/<p[^>]*(?:data-location-id="([^"]*)")?[^>]*>([^]*?)<\/p>/gi)];

    for (const match of pMatches) {
      const locationId = match[1];
      const text = this.cleanHtml(match[2]);
      if (!text || text.length < 3) {
        continue;
      }

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
        ...(notes.length > 0 ? { notes } : {}),
      });
    }

    return paragraphs;
  }

  private cleanHtml(html: string): string {
    return normalizePlainText(
      html
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
        .replace(/\s+/g, ' ')
        .trim()
    );
  }
}

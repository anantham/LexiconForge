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
    const manifestMatches = [...opfContent.matchAll(/<item[^>]*id="([^"]+)"[^>]*href="([^"]+)"[^>]*\/?>/g)];

    const manifest: Record<string, string> = {};
    for (const match of manifestMatches) {
      manifest[match[1]] = match[2];
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
      const content = await zip.file(contentPath)?.async('string');
      if (!content || this.isFrontMatter(content, href)) {
        continue;
      }

      const extractedHeading = this.extractChapterHeading(content);
      const chapterRange = extractedHeading.chapterToken
        ? parseChapterNumberToken(extractedHeading.chapterToken)
        : undefined;
      const chapterNumber = chapterRange?.from ?? ++fallbackChapterNumber;
      fallbackChapterNumber = Math.max(fallbackChapterNumber, chapterNumber);

      const paragraphs = this.extractParagraphs(content);
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

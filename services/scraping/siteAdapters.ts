/**
 * Site-specific scraping adapters for extracting chapter content from web novel sites.
 * Each adapter handles one site's HTML structure independently.
 *
 * Supported sites: Kakuyomu, Dxmwx, Kanunu, Novelcool, BookToki, Syosetu, SuttaCentral, Hetushu
 */

import { Chapter } from '../../types';

// --- BASE ---

abstract class BaseAdapter {
  protected url: string;
  protected doc: Document;

  constructor(url: string, doc: Document) {
    this.url = url;
    this.doc = doc;
  }

  abstract extractTitle(): string | null;
  abstract extractContent(): string | null;
  abstract getNextLink(): string | null;
  abstract getPrevLink(): string | null;
}

// --- SITE ADAPTERS ---

class KakuyomuAdapter extends BaseAdapter {
  extractTitle = () => {
    const fullTitle = this.doc.querySelector('title')?.textContent ?? '';
    // Format: "第二十話　最強の陰陽師、墓穴を掘る - [series title] - カクヨム"
    return fullTitle.split(' - ')[0].trim() || null;
  };

  extractContent = () => {
    const contentEl = this.doc.querySelector('div.widget-episodeBody');
    if (!contentEl) return null;
    contentEl.querySelectorAll('rt').forEach((el) => el.remove());
    return contentEl.textContent?.trim() ?? null;
  };

  private getLinkByRel = (rel: 'prev' | 'next') => {
    const linkTag = this.doc.querySelector(`link[rel="${rel}"]`);
    const href = linkTag?.getAttribute('href');
    return href ? new URL(href, this.url).href : null;
  };

  getPrevLink = () => this.getLinkByRel('prev');
  getNextLink = () => this.getLinkByRel('next');
}

class DxmwxAdapter extends BaseAdapter {
  extractTitle = () => this.doc.querySelector('#ChapterTitle')?.textContent?.trim() ?? null;

  extractContent = () => {
    const contentEl = this.doc.querySelector('#Lab_Contents');
    if (!contentEl) return null;
    contentEl.querySelectorAll('script, a').forEach((el) => el.remove());
    return contentEl.textContent?.trim() ?? null;
  };

  private getLinkByText = (text: RegExp) => {
    const link = Array.from(this.doc.querySelectorAll('a')).find((a) =>
      text.test(a.textContent ?? '')
    );
    return link?.getAttribute('href')
      ? new URL(link.getAttribute('href')!, this.url).href
      : null;
  };

  getPrevLink = () => this.getLinkByText(/上一章/);
  getNextLink = () => this.getLinkByText(/下一章/);
}

class KanunuAdapter extends BaseAdapter {
  extractTitle = () => this.doc.querySelector('h1')?.textContent?.trim() ?? null;

  extractContent = () => {
    const contentEl = this.doc.querySelector('div#neirong');
    if (!contentEl) return null;
    const paragraphs = contentEl.querySelectorAll('p');
    if (paragraphs.length > 1) paragraphs[paragraphs.length - 1].remove();
    return contentEl.textContent?.trim() ?? null;
  };

  private getLinkByText = (text: RegExp) => {
    const link = Array.from(this.doc.querySelectorAll('a')).find((a) =>
      text.test(a.textContent ?? '')
    );
    return link?.getAttribute('href')
      ? new URL(link.getAttribute('href')!, this.url).href
      : null;
  };

  getPrevLink = () => this.getLinkByText(/上一章/);
  getNextLink = () => this.getLinkByText(/下一章/);
}

class NovelcoolAdapter extends BaseAdapter {
  extractTitle = () =>
    this.doc.querySelector('h2.chapter-title')?.textContent?.trim() ?? null;

  extractContent = () => {
    const contentEl = this.doc.querySelector('div.chapter-reading-section-list');
    if (!contentEl) return null;
    contentEl
      .querySelectorAll('div.mangaread-ad-box, script')
      .forEach((el) => el.remove());
    return contentEl.textContent?.trim() ?? null;
  };

  private getLinkByText = (text: RegExp) => {
    const links = Array.from(
      this.doc.querySelectorAll(
        '.chapter-reading-pagination a, .chapter-reading-pageitem a'
      )
    );
    const link = links.find((a) => text.test(a.textContent?.toLowerCase() ?? ''));
    return link?.getAttribute('href')
      ? new URL(link.getAttribute('href')!, this.url).href
      : null;
  };

  getPrevLink = () => this.getLinkByText(/prev|previous/);
  getNextLink = () => this.getLinkByText(/next/);
}

class BookTokiAdapter extends BaseAdapter {
  extractTitle = () => {
    const fullTitle = this.doc.querySelector('title')?.textContent?.trim() ?? '';
    // Format example: "던전 디펜스-2화 | 북토끼 - 웹소설 자료실"
    const match = fullTitle.match(/([^|]+?-\s*\d+\s*화)/);
    if (match) return match[1].trim();
    return (
      this.doc.querySelector('h1')?.textContent?.trim() ||
      this.doc.querySelector('h2')?.textContent?.trim() ||
      fullTitle.split('|')[0]?.trim() ||
      null
    );
  };

  extractContent = () => {
    const contentContainer = this.doc.querySelector('#novel_content');
    if (!contentContainer) return null;

    const contentRoot =
      contentContainer.querySelector('div.f9e99a33513') ?? contentContainer;

    const paragraphs = Array.from(contentRoot.querySelectorAll('p'))
      .map((p) => (p.textContent ?? '').trim())
      .filter((text) => text.length > 0 && !this.isSkippableLine(text));

    const content =
      paragraphs.length > 0
        ? paragraphs.join('\n\n')
        : (contentRoot.textContent ?? '').trim();
    return content.length > 0 ? content : null;
  };

  private isSkippableLine(text: string): boolean {
    const trimmed = text.trim();
    if (trimmed.length < 2) return true;
    const invalidPatterns = [
      /^={5,}/,
      /^\d{5,}\s/,
      /^https?:\/\//i,
      /^www\./i,
    ];
    return invalidPatterns.some((pattern) => pattern.test(trimmed));
  }

  private extractChapterIdFromUrl(url: string): number | null {
    const match = url.match(/\/novel\/(\d+)/);
    if (!match) return null;
    const parsed = parseInt(match[1], 10);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private getLinkByDirection(isNext: boolean): string | null {
    const currentChapterId = this.extractChapterIdFromUrl(this.url);
    if (currentChapterId == null) return null;

    const navLinks = Array.from(
      this.doc.querySelectorAll('a[href*="/novel/"]')
    ) as HTMLAnchorElement[];

    const candidates = navLinks
      .map((link) => {
        const href = link.getAttribute('href');
        if (!href) return null;
        const abs = new URL(href, this.url).href;
        const id = this.extractChapterIdFromUrl(abs);
        if (id == null || id === currentChapterId) return null;
        return { url: abs, chapterId: id };
      })
      .filter((c): c is { url: string; chapterId: number } => Boolean(c))
      .sort((a, b) => a.chapterId - b.chapterId);

    if (candidates.length === 0) return null;

    if (isNext) {
      return candidates.find((c) => c.chapterId > currentChapterId)?.url ?? null;
    }

    for (let i = candidates.length - 1; i >= 0; i -= 1) {
      if (candidates[i].chapterId < currentChapterId) return candidates[i].url;
    }
    return null;
  }

  getPrevLink = () => this.getLinkByDirection(false);
  getNextLink = () => this.getLinkByDirection(true);
}

class SyosetuAdapter extends BaseAdapter {
  extractTitle = () =>
    this.doc.querySelector('h1.p-novel__title')?.textContent?.trim() ?? null;

  extractContent = () => {
    const contentEl = this.doc.querySelector('.js-novel-text.p-novel__text');
    if (!contentEl) return null;
    contentEl.querySelectorAll('script, .c-ad').forEach((el) => el.remove());
    return contentEl.textContent?.trim() ?? null;
  };

  getPrevLink = () => {
    const href = this.doc
      .querySelector('.c-pager__item--before')
      ?.getAttribute('href');
    return href ? new URL(href, this.url).href : null;
  };

  getNextLink = () => {
    const href = this.doc
      .querySelector('.c-pager__item--next')
      ?.getAttribute('href');
    return href ? new URL(href, this.url).href : null;
  };
}

/**
 * Hetushu Adapter — hetushu.com Chinese novel chapters.
 * Strips fullwidth-obfuscated watermarks via NFKC normalization before filtering.
 */
class HetushuAdapter extends BaseAdapter {
  /** Watermark host fragments to remove (matched after NFKC normalization). */
  private static readonly WATERMARK_PATTERNS = [
    'hetushu.com',
    'hetubook.com',
    '和图书',
  ];

  /** Tags used to embed watermark strings inside #content. */
  private static readonly WATERMARK_TAGS = ['big', 'kbd', 'code', 'cite'];

  private isWatermark(el: Element): boolean {
    const normalized = el.textContent?.normalize('NFKC') ?? '';
    return HetushuAdapter.WATERMARK_PATTERNS.some((pattern) =>
      normalized.includes(pattern)
    );
  }

  extractTitle = () =>
    this.doc.querySelector('#ctitle .title')?.textContent?.trim() ?? null;

  extractContent = (): string | null => {
    const contentEl = this.doc.querySelector('#content');
    if (!contentEl) return null;

    // Remove overlay masks
    contentEl.querySelectorAll('.mask').forEach((el) => el.remove());

    // Remove duplicate heading
    contentEl.querySelectorAll('h2.h2').forEach((el) => el.remove());

    // Remove watermark elements (big, kbd, code, cite) that contain watermark text
    const tagSelector = HetushuAdapter.WATERMARK_TAGS.join(', ');
    contentEl.querySelectorAll(tagSelector).forEach((el) => {
      if (this.isWatermark(el)) el.remove();
    });

    // Collect text from child <div> paragraphs
    const paragraphs = Array.from(contentEl.querySelectorAll(':scope > div'))
      .map((div) => div.textContent?.trim() ?? '')
      .filter((text) => text.length > 0);

    if (paragraphs.length > 0) return paragraphs.join('\n\n');

    // Fallback: return all remaining text content
    const fallback = contentEl.textContent?.trim() ?? '';
    return fallback.length > 0 ? fallback : null;
  };

  getPrevLink = (): string | null => {
    const href = this.doc
      .querySelector('#right .pre a[href]')
      ?.getAttribute('href');
    return href ? new URL(href, this.url).href : null;
  };

  getNextLink = (): string | null => {
    const href =
      this.doc.querySelector('#right a#next[href]')?.getAttribute('href') ??
      this.doc.querySelector('#right a.next[href]')?.getAttribute('href');
    return href ? new URL(href, this.url).href : null;
  };
}

/**
 * SuttaCentral Adapter — uses JSON APIs (SuttaPlex + Bilara) rather than HTML parsing.
 */
export class SuttaCentralAdapter extends BaseAdapter {
  private suttaUid: string | null = null;
  private authorUid: string | null = null;
  private languageUid: string | null = null;

  constructor(url: string, doc: Document) {
    super(url, doc);
    this.parseUrlMetadata(url);
  }

  private parseUrlMetadata(url: string) {
    try {
      const urlObj = new URL(url);
      const queryLangRaw = urlObj.searchParams.get('lang');
      const queryLang = queryLangRaw ? queryLangRaw.toLowerCase() : null;
      // Expected format: https://suttacentral.net/{sutta_uid}/{lang}/{author_uid}
      const parts = urlObj.pathname.split('/').filter(Boolean);
      if (parts.length >= 1) this.suttaUid = parts[0];
      if (parts.length >= 3) {
        this.languageUid = queryLang ?? parts[1];
        this.authorUid = parts[2];
      } else if (parts.length === 2) {
        if (queryLang) {
          this.languageUid = queryLang;
          this.authorUid = parts[1];
        } else if (this.isLikelyLanguage(parts[1])) {
          this.languageUid = parts[1];
        } else {
          this.authorUid = parts[1];
        }
      } else if (queryLang) {
        this.languageUid = queryLang;
      }
      if (!this.languageUid) this.languageUid = 'en';
    } catch (e) {
      console.error('[SuttaCentral] Failed to parse URL metadata:', e);
    }
  }

  private isLikelyLanguage(segment: string): boolean {
    const normalized = segment.toLowerCase();
    if (!/^[a-z]+$/.test(normalized)) return false;
    const known = new Set([
      'en', 'de', 'fr', 'es', 'it', 'pt', 'ru', 'zh', 'ja', 'ko',
      'pli', 'pi', 'sa', 'hi', 'id', 'th', 'vi',
    ]);
    return known.has(normalized) || normalized.length <= 3;
  }

  private getLanguageUid(): string {
    return this.languageUid || 'en';
  }

  private getAuthorUid(): string {
    return this.authorUid || 'sujato';
  }

  private parseSuttaUid(uid: string): { prefix: string; parts: number[] } | null {
    const match = uid.match(/^([a-z]+)(\d+(?:\.\d+)*)$/i);
    if (!match) return null;
    const parts = match[2].split('.').map((part) => parseInt(part, 10));
    if (parts.some((part) => Number.isNaN(part))) return null;
    return { prefix: match[1], parts };
  }

  private buildSiblingLink(delta: number): string | null {
    if (!this.suttaUid) return null;
    const parsed = this.parseSuttaUid(this.suttaUid);
    if (!parsed) return null;
    const nextParts = [...parsed.parts];
    const lastIndex = nextParts.length - 1;
    nextParts[lastIndex] = nextParts[lastIndex] + delta;
    if (nextParts[lastIndex] <= 0) return null;
    const nextUid = `${parsed.prefix}${nextParts.join('.')}`;
    return `https://suttacentral.net/${nextUid}/${this.getLanguageUid()}/${this.getAuthorUid()}`;
  }

  extractTitle = () =>
    this.suttaUid ? `Sutta ${this.suttaUid.toUpperCase()}` : 'Sutta';

  extractContent = () => 'Loading Sutta content...';

  getPrevLink = () => this.buildSiblingLink(-1);
  getNextLink = () => this.buildSiblingLink(1);

  /**
   * Specialized fetcher using SuttaPlex and Bilara APIs.
   */
  async fetchSutta(fetchFn: (url: string) => Promise<string>): Promise<Chapter> {
    if (!this.suttaUid) throw new Error('Could not identify Sutta UID from URL.');
    const author = this.getAuthorUid();
    const lang = this.getLanguageUid();

    console.log(`[SuttaCentral] Fetching Sutta: ${this.suttaUid} (Lang: ${lang}, Author: ${author})`);

    // 1. Fetch Metadata (SuttaPlex)
    let suttaplexData: any = null;
    try {
      const plexUrl = `https://suttacentral.net/api/suttaplex/${this.suttaUid}`;
      const plexResponse = await fetchFn(plexUrl);
      const plexJson = JSON.parse(plexResponse);
      suttaplexData = Array.isArray(plexJson) ? plexJson[0] : plexJson;
    } catch (e) {
      console.warn('[SuttaCentral] Failed to fetch SuttaPlex metadata:', e);
    }

    // 2. Fetch Content (Bilara)
    const bilaraUrl = `https://suttacentral.net/api/bilarasuttas/${this.suttaUid}/${author}`;
    const bilaraResponse = await fetchFn(bilaraUrl);
    const bilaraJson = JSON.parse(bilaraResponse);

    if (!bilaraJson || !bilaraJson.root_text) {
      throw new Error(
        `The Sutta ${this.suttaUid} by ${author} was not found or has no text.`
      );
    }

    // 3. Process Content
    const rootText = bilaraJson.root_text;
    const translationText = bilaraJson.translation_text || {};

    const keys = Object.keys(rootText).sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
    );

    const titleSegments: string[] = [];
    const bodySegments: string[] = [];
    const fanSegments: string[] = [];

    keys.forEach((key) => {
      const isTitle = key.includes(':0.');
      const pali = rootText[key] || '';
      const eng = translationText[key] || '';

      if (isTitle) {
        if (eng) titleSegments.push(eng);
        else if (pali) titleSegments.push(pali);
      } else {
        bodySegments.push(pali);
        fanSegments.push(eng);
      }
    });

    const finalTitle =
      suttaplexData?.translated_title ||
      suttaplexData?.original_title ||
      titleSegments.join(' - ') ||
      this.extractTitle();
    const blurb =
      typeof suttaplexData?.blurb === 'string' ? suttaplexData.blurb.trim() : null;
    const content = bodySegments.join('\n\n');
    const fanTranslation = fanSegments.join('\n\n');

    return {
      title: finalTitle,
      content,
      fanTranslation: fanTranslation.length > 0 ? fanTranslation : null,
      blurb: blurb && blurb.length > 0 ? blurb : null,
      sourceLanguage: 'Pali',
      targetLanguage: lang,
      originalUrl: this.url,
      nextUrl: this.getNextLink(),
      prevUrl: this.getPrevLink(),
      chapterNumber: parseInt(this.suttaUid.match(/\d+/)?.[0] || '0', 10),
    };
  }
}

// --- FACTORY ---

export function getAdapter(url: string, doc: Document): BaseAdapter | null {
  if (url.includes('kakuyomu.jp')) return new KakuyomuAdapter(url, doc);
  if (url.includes('dxmwx.org')) return new DxmwxAdapter(url, doc);
  if (url.includes('kanunu8.com') || url.includes('kanunu.net'))
    return new KanunuAdapter(url, doc);
  if (url.includes('novelcool.com')) return new NovelcoolAdapter(url, doc);
  if (url.includes('ncode.syosetu.com')) return new SyosetuAdapter(url, doc);
  if (url.includes('booktoki468.com')) return new BookTokiAdapter(url, doc);
  if (url.includes('suttacentral.net')) return new SuttaCentralAdapter(url, doc);
  if (url.includes('hetushu.com')) return new HetushuAdapter(url, doc);
  return null;
}

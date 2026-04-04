import { describe, it, expect } from 'vitest';
import { getAdapter } from '../../services/scraping/siteAdapters';
import { getSupportedSiteInfo, isUrlSupported } from '../../services/scraping/urlUtils';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDoc(html: string): Document {
  return new DOMParser().parseFromString(html, 'text/html');
}

const CHAPTER_URL = 'https://hetushu.com/book/2991/2051039.html';
const NEXT_URL = 'https://hetushu.com/book/2991/2051040.html';
const PREV_URL = 'https://hetushu.com/book/2991/2051038.html';

/** Minimal hetushu.com chapter page */
function makeHetushuHtml({
  title = '第1章 新的冲突',
  paragraphs = ['段落一内容。', '段落二内容。'],
  prevHref = '',
  nextHref = '/book/2991/2051040.html',
  watermarks = [] as string[],
}: {
  title?: string;
  paragraphs?: string[];
  prevHref?: string;
  nextHref?: string;
  watermarks?: string[];
} = {}): string {
  const prevSpan = prevHref
    ? `<span class="pre"><a href="${prevHref}"></a></span>`
    : `<span class="pre"></span>`;

  const watermarkEls = watermarks
    .map((wm) => `<big>${wm}</big>`)
    .join('\n');

  const paraEls = paragraphs.map((p) => `<div>${p}</div>`).join('\n');

  return `
    <html lang="zh-Hans">
    <head><title>国家意志_第1章 新的冲突_野狼獾_和图书</title></head>
    <body>
      <div id="left">
        <h3><a href="/book/2991/index.html" title="国家意志">国家意志</a></h3>
        <div class="author">作者：<a href="#" title="野狼獾作品集">野狼獾</a></div>
      </div>
      <div id="right">
        ${prevSpan}
        <a href="${nextHref}" id="next" class="next" title="下一章"></a>
      </div>
      <div id="center">
        <div id="cbox">
          <div id="ctitle">
            <div class="title">${title}</div>
          </div>
          <div id="content" style="font-size:20px;line-height:2.4;">
            <div class="mask mask2"></div>
            <h2 class="h2">${title}</h2>
            ${watermarkEls}
            ${paraEls}
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('HetushuAdapter — URL support', () => {
  it('treats hetushu.com URLs as supported', () => {
    expect(isUrlSupported(CHAPTER_URL)).toBe(true);
  });

  it('includes hetushu.com in the supported sites list', () => {
    const sites = getSupportedSiteInfo();
    const hetushu = sites.find((s) => s.domain === 'hetushu.com');
    expect(hetushu).toBeDefined();
    expect(hetushu?.example).toContain('hetushu.com');
  });

  it('returns an adapter for hetushu.com URLs', () => {
    const doc = makeDoc(makeHetushuHtml());
    const adapter = getAdapter(CHAPTER_URL, doc);
    expect(adapter).not.toBeNull();
  });

  it('returns null adapter for unrelated URLs', () => {
    const doc = makeDoc('<html></html>');
    expect(getAdapter('https://example.com/chapter/1', doc)).toBeNull();
  });
});

describe('HetushuAdapter — title extraction', () => {
  it('extracts the chapter title from #ctitle .title', () => {
    const doc = makeDoc(makeHetushuHtml({ title: '第1章 新的冲突' }));
    const adapter = getAdapter(CHAPTER_URL, doc)!;
    expect(adapter.extractTitle()).toBe('第1章 新的冲突');
  });

  it('returns null when #ctitle .title is absent', () => {
    const doc = makeDoc('<html><body><div id="center"></div></body></html>');
    const adapter = getAdapter(CHAPTER_URL, doc)!;
    expect(adapter.extractTitle()).toBeNull();
  });
});

describe('HetushuAdapter — content extraction', () => {
  it('joins paragraph <div> elements with double newlines', () => {
    const doc = makeDoc(
      makeHetushuHtml({ paragraphs: ['第一段。', '第二段。', '第三段。'] })
    );
    const adapter = getAdapter(CHAPTER_URL, doc)!;
    const content = adapter.extractContent();
    expect(content).toBe('第一段。\n\n第二段。\n\n第三段。');
  });

  it('strips <big> watermark elements', () => {
    const doc = makeDoc(
      makeHetushuHtml({
        paragraphs: ['正文内容。'],
        watermarks: ['https://www.hetushu.com'],
      })
    );
    const adapter = getAdapter(CHAPTER_URL, doc)!;
    const content = adapter.extractContent() ?? '';
    expect(content).not.toContain('hetushu.com');
    expect(content).toContain('正文内容。');
  });

  it('strips fullwidth-obfuscated watermarks via NFKC normalization', () => {
    // fullwidth chars that normalize to ascii hetushu.com
    const fullwidthWatermark = 'ｈｅｔｕｓｈｕ.ｃｏｍ';
    const doc = makeDoc(
      makeHetushuHtml({
        paragraphs: ['段落内容。'],
        watermarks: [fullwidthWatermark],
      })
    );
    const adapter = getAdapter(CHAPTER_URL, doc)!;
    const content = adapter.extractContent() ?? '';
    expect(content).not.toContain('ｈｅｔｕｓｈｕ');
    expect(content).toContain('段落内容。');
  });

  it('strips the duplicate <h2 class="h2"> heading', () => {
    const doc = makeDoc(makeHetushuHtml({ title: '第1章 新的冲突' }));
    const adapter = getAdapter(CHAPTER_URL, doc)!;
    const content = adapter.extractContent() ?? '';
    // The h2 text should not appear separately in content
    // (paragraphs are extracted from <div> children only)
    expect(content).not.toContain('第1章 新的冲突');
  });

  it('strips .mask overlay elements', () => {
    const html = `
      <html><body>
        <div id="content">
          <div class="mask mask2">MASK</div>
          <div>正文。</div>
        </div>
      </body></html>
    `;
    const doc = makeDoc(html);
    const adapter = getAdapter(CHAPTER_URL, doc)!;
    const content = adapter.extractContent() ?? '';
    expect(content).not.toContain('MASK');
    expect(content).toBe('正文。');
  });

  it('strips <kbd>, <code>, <cite> watermark variants', () => {
    const html = `
      <html><body>
        <div id="content">
          <kbd>httｐs://ｗwｗ.ｈｅtｕsｈｕ.ｃｏｍ</kbd>
          <code>https://hetubook.com</code>
          <cite>和图书</cite>
          <div>段落文字。</div>
        </div>
      </body></html>
    `;
    const doc = makeDoc(html);
    const adapter = getAdapter(CHAPTER_URL, doc)!;
    const content = adapter.extractContent() ?? '';
    expect(content).not.toContain('hetubook');
    expect(content).not.toContain('和图书');
    expect(content).toContain('段落文字。');
  });

  it('returns null when #content is absent', () => {
    const doc = makeDoc('<html><body></body></html>');
    const adapter = getAdapter(CHAPTER_URL, doc)!;
    expect(adapter.extractContent()).toBeNull();
  });
});

describe('HetushuAdapter — navigation links', () => {
  it('builds absolute next URL from relative href', () => {
    const doc = makeDoc(makeHetushuHtml({ nextHref: '/book/2991/2051040.html' }));
    const adapter = getAdapter(CHAPTER_URL, doc)!;
    expect(adapter.getNextLink()).toBe(NEXT_URL);
  });

  it('builds absolute prev URL from relative href', () => {
    const doc = makeDoc(
      makeHetushuHtml({ prevHref: '/book/2991/2051038.html', nextHref: '/book/2991/2051040.html' })
    );
    const adapter = getAdapter(CHAPTER_URL, doc)!;
    expect(adapter.getPrevLink()).toBe(PREV_URL);
  });

  it('returns null for prev when first chapter (empty <span class="pre">)', () => {
    // prevHref = '' → empty span, no <a>
    const doc = makeDoc(makeHetushuHtml({ prevHref: '' }));
    const adapter = getAdapter(CHAPTER_URL, doc)!;
    expect(adapter.getPrevLink()).toBeNull();
  });

  it('returns null for next when next link is absent', () => {
    const html = `
      <html><body>
        <div id="right">
          <span class="pre"></span>
        </div>
        <div id="center">
          <div id="cbox">
            <div id="ctitle"><div class="title">第1章</div></div>
            <div id="content"><div>内容。</div></div>
          </div>
        </div>
      </body></html>
    `;
    const doc = makeDoc(html);
    const adapter = getAdapter(CHAPTER_URL, doc)!;
    expect(adapter.getNextLink()).toBeNull();
  });
});

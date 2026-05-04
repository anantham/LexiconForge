import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchAndParseUrl } from '../../services/scraping/fetcher';
import { getSupportedSiteInfo, isUrlSupported } from '../../services/scraping/urlUtils';

const makeResponse = (body: string) => ({
  ok: true,
  status: 200,
  text: async () => body,
  json: async () => JSON.parse(body),
  arrayBuffer: async () => new TextEncoder().encode(body).buffer,
});

const HEART_SUTRA_BODY = `Homage to the Perfection of Wisdom, the Blessed Mother!

Thus did I hear at one time. The Blessed One was residing on the Vulture Peak in Rajagriha together with a great assembly of monks and bodhisattvas.

At that time the Blessed One rested in an absorption on the categories of phenomena called illumination of the profound.`;

// Build a minimal HTML structure that matches 84000.co's actual page shape
// (h1.main-title, section.part-type-section with <p id="node-N"> paragraphs,
// optional footnote/glossary anchor wrappers we need to strip).
function build84000Html(title: string, paragraphs: string[]): string {
  const paraHtml = paragraphs.map((p, i) =>
    `<p id="node-${i + 35}">${p.replace(/Vulture Peak/, 'Vulture Peak<a class="glossary-link pop-up" data-glossary-id="x">23</a>')}</p>`
  ).join('\n');
  return `<!DOCTYPE html>
<html><head><title>${title}</title></head>
<body class="reading-room translation complete default-mode">
  <section id="titles">
    <h1 class="panel-row title main-title"><span>${title}</span></h1>
  </section>
  <section id="UT22084-034-009-summary" class="part-type-summary">
    <p>This is a summary that should NOT appear in the extracted content.</p>
  </section>
  <section id="UT22084-034-009-section-1" class="part-type-section text page tei-parser preview relative">
    ${paraHtml}
  </section>
  <section id="UT22084-034-009-end-notes" class="part-type-end-notes">
    <p>Note 23 — bibliographic apparatus that should NOT appear.</p>
  </section>
</body></html>`;
}

describe('84000 adapter wiring', () => {
  beforeEach(() => {
    if (typeof AbortSignal.timeout !== 'function') {
      (AbortSignal as any).timeout = () => new AbortController().signal;
    }
  });

  it('treats 84000.co URLs as supported', () => {
    expect(isUrlSupported('https://84000.co/translation/toh21')).toBe(true);
    const sites = getSupportedSiteInfo();
    const eighty4k = sites.find((site) => site.domain === '84000.co');
    expect(eighty4k).toBeDefined();
    expect(eighty4k?.example).toContain('84000.co');
  });

  it('extracts the translation body, skips summary/end-notes/glossary, strips footnote anchors', async () => {
    const html = build84000Html(
      'The Heart of the Perfection of Wisdom, the Blessed Mother',
      HEART_SUTRA_BODY.split('\n\n'),
    );

    const fetchMock = vi.fn(async () => makeResponse(html));
    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchMock as any;

    try {
      const result = await fetchAndParseUrl('https://84000.co/translation/toh21');

      expect(result.title).toBe('The Heart of the Perfection of Wisdom, the Blessed Mother');
      expect(result.content).toContain('Homage to the Perfection of Wisdom');
      expect(result.content).toContain('Vulture Peak');
      // Summary section content must not leak through.
      expect(result.content).not.toContain('This is a summary');
      // End-notes / bibliography must not leak through.
      expect(result.content).not.toContain('bibliographic apparatus');
      // Glossary anchor wrapper text "23" should be present (the inner text)
      // but no <a> tag should be visible.
      expect(result.content).not.toContain('<a');
      expect(result.content).not.toContain('glossary-link');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('returns null prev/next links — single-document texts with no chapter pagination', async () => {
    const html = build84000Html('A short text', ['One paragraph.']);
    const fetchMock = vi.fn(async () => makeResponse(html));
    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchMock as any;

    try {
      const result = await fetchAndParseUrl('https://84000.co/translation/toh21');
      expect(result.prevUrl).toBeNull();
      expect(result.nextUrl).toBeNull();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('throws when the page has no part-type-section (e.g. wrong URL or page layout changed)', async () => {
    const html = `<html><head><title>Empty</title></head><body><h1 class="main-title"><span>Empty</span></h1><section id="x"><p>nothing</p></section></body></html>`;
    const fetchMock = vi.fn(async () => makeResponse(html));
    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchMock as any;

    try {
      await expect(
        fetchAndParseUrl('https://84000.co/translation/toh99999')
      ).rejects.toThrow();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

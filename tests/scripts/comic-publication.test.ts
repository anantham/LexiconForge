import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';
import { describe, it, expect } from 'vitest';

const root = resolve('public/comics/the-occasion');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');
const book = JSON.parse(read('book.json'));
const metadata = JSON.parse(read('metadata.json'));
const context = vm.createContext({ window: {}, console });
vm.runInContext(read('picture-lettering.js'), context);
vm.runInContext(read('reader.js').replace(/initReader\(\);\s*$/, ''), context);
const select = vm.runInContext('selectReadingPages', context);
const renderPage = vm.runInContext('renderReadingPage', context);

describe('published comic contract', () => {
  it('contains the exact complete current edition and every local asset', () => {
    const inventory = { assets: book.assets };
    const pages = select(book, book, inventory);
    expect(pages).toHaveLength(45);
    expect(pages.flatMap((p: any) => p.panels)).toHaveLength(95);
    expect(metadata.pageCount).toBe(pages.length);
    expect(metadata.pictureCount).toBe(Object.keys(book.panels).length);
    expect(readdirSync(resolve(root, 'images')).sort()).toEqual(Object.keys(book.assets).sort());
    for (const page of pages) {
      const html = renderPage(page, book, inventory);
      expect(html).not.toContain('PRODUCTION GAP');
      for (const panel of page.panels) {
        expect(statSync(resolve(root, 'images', panel.imagePath)).size).toBeGreaterThan(1000);
        expect(html).toContain(`/comics/the-occasion/images/${panel.imagePath}`);
        expect(book.panels[panel.id].status).toBe('ready');
      }
    }
  });

  it('refuses incomplete books and broken inventory rather than silently truncating', () => {
    expect(() => select({ ...book, pages: book.pages.slice(1) }, book, { assets: book.assets })).toThrow(/every page/);
    expect(() => select(book, { ...book, panels: {} }, { assets: book.assets })).toThrow(/production record/);
    expect(() => select(book, book, { assets: {} })).toThrow(/image inventory/);
  });

  it('identifies a failed picture without putting technical paths into the reader message', () => {
    const errors: unknown[][] = [];
    const status = { textContent: '', hidden: true };
    const failureContext = vm.createContext({
      window: {}, console: { error: (...args: unknown[]) => errors.push(args) },
      document: { getElementById: () => status },
    });
    vm.runInContext(read('reader.js').replace(/initReader\(\);\s*$/, ''), failureContext);
    const report = vm.runInContext('reportPictureFailure', failureContext);
    report({ closest: () => ({ dataset: { panelId: 'v5-10-01' } }), getAttribute: () => '/comics/the-occasion/images/v5-10-01.webp' });
    expect(errors).toEqual([['Comic picture failed to load:', {
      panelId: 'v5-10-01', path: '/comics/the-occasion/images/v5-10-01.webp',
    }]]);
    expect(status.textContent).toBe('A picture could not load. Reload this page to try again.');
    expect(status.hidden).toBe(false);
    expect(read('reader.js')).toContain('img.onerror=()=>reportPictureFailure(img)');
    expect(read('reader.js')).toContain('if(img.complete&&img.naturalWidth===0)reportPictureFailure(img)');
  });

  it('ships reader data only and preserves separate lettering and the library return', () => {
    expect(readdirSync(root).sort()).toEqual(['book.json', 'cover.webp', 'images', 'index.html', 'metadata.json', 'picture-lettering.js', 'reader.css', 'reader.js']);
    expect(read('book.json')).not.toMatch(/"(?:artAssessment|expectedReading|eyePath|eyeRoute|reason|provenance|reviewBoundary|sourceIds|revisedPrompt)":/);
    expect(read('index.html')).toContain('<a href="/">Library</a>');
    expect(read('index.html')).not.toContain('Editorial desk');
    expect(read('reader.js')).not.toMatch(/getJSON\('\/(?:story|reading-production|inventory)\.json/);
    const first = renderPage(book.pages[0], book, { assets: book.assets });
    expect(first).toContain('A new god was waking.');
    expect(first).toContain('lettering-layer');
    expect(read('reader.js')).toContain('The comic could not load.');
    expect(read('reader.js')).toContain('A picture could not load.');
  });
});

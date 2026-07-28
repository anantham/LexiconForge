import { describe, it, expect, vi } from 'vitest';
import { generateEpub3WithJSZip } from '../../services/epubService/packagers/epubPackager';

describe('epubPackager diagnostics', () => {
  it('emits structured warnings for missing title and invalid cover image', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      const meta = {
        title: ' ',
        author: 'Test Author',
        language: 'en',
        identifier: 'urn:uuid:test',
        coverImage: 'not-a-data-url'
      };
      const chapters = [
        {
          id: 'ch-001',
          title: 'Chapter 1',
          xhtml: '<p>Broken',
          href: 'chapter-0001.xhtml'
        }
      ];

      await generateEpub3WithJSZip(meta, chapters);

      const structuredWarnings = warnSpy.mock.calls
        .filter(call => call[0] === '[EPUBPackager]')
        .map(call => call[1] as { type?: string });
      const types = structuredWarnings.map(warning => warning.type);

      expect(types).toContain('missing-title');
      expect(types).toContain('invalid-cover-image');
    } finally {
      warnSpy.mockRestore();
    }
  });

  /**
   * REGRESSION: packager warnings used to be collected into a local array that
   * was never returned — console.warn was their only consumer, so no caller
   * (e.g. the export slice's warning counter) could surface them to users.
   */
  it('forwards structured warnings to the onWarning callback', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      const meta = {
        title: ' ',
        author: 'Test Author',
        language: 'en',
        identifier: 'urn:uuid:test',
        coverImage: 'not-a-data-url'
      };
      const chapters = [
        {
          id: 'ch-001',
          title: 'Chapter 1',
          xhtml: '<p>Fine.</p>',
          href: 'chapter-0001.xhtml'
        }
      ];

      const received: Array<{ type: string; message: string }> = [];
      await generateEpub3WithJSZip(meta, chapters, (warning) => received.push(warning));

      const types = received.map(warning => warning.type);
      expect(types).toContain('missing-title');
      expect(types).toContain('invalid-cover-image');
      for (const warning of received) {
        expect(typeof warning.message).toBe('string');
        expect(warning.message.length).toBeGreaterThan(0);
      }
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('does not fail packaging when the onWarning callback throws', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      const meta = {
        title: ' ',
        author: 'Test Author',
        language: 'en',
        identifier: 'urn:uuid:test'
      };
      const chapters = [
        { id: 'ch-001', title: 'Chapter 1', xhtml: '<p>Fine.</p>', href: 'chapter-0001.xhtml' }
      ];

      const buffer = await generateEpub3WithJSZip(meta, chapters, () => {
        throw new Error('listener exploded');
      });
      expect(buffer.byteLength).toBeGreaterThan(0);
    } finally {
      warnSpy.mockRestore();
    }
  });
});

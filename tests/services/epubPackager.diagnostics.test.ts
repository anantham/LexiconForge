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
});

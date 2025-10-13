/**
 * Tests for EPUB Package Builder
 *
 * The package builder assembles the final EPUB ZIP structure with proper ordering:
 * 1. mimetype (uncompressed, must be first)
 * 2. META-INF/container.xml
 * 3. OEBPS/content.opf (manifest/spine)
 * 4. OEBPS/nav.xhtml
 * 5. OEBPS/*.xhtml (chapters)
 * 6. OEBPS/images/* (assets)
 */

import { describe, it, expect } from 'vitest';
import { packageEpub } from '../../services/epub/packageBuilder';
import JSZip from 'jszip';
import type { BuiltContent, ResolvedAsset } from '../../services/epub/types';

describe('packageEpub', () => {
  it('creates valid EPUB ZIP structure', async () => {
    // Arrange: Create built content fixture
    const content: BuiltContent = {
      chapterFiles: [
        {
          filename: 'chapter-001.xhtml',
          content: '<?xml version="1.0"?><html><body>Chapter 1</body></html>',
          chapterId: 'ch-1'
        }
      ],
      manifestItems: [
        {
          id: 'chapter-001',
          href: 'text/chapter-001.xhtml',
          mediaType: 'application/xhtml+xml'
        },
        {
          id: 'img-1',
          href: 'images/img-1.png',
          mediaType: 'image/png'
        }
      ],
      spineItems: [
        { idref: 'chapter-001', linear: 'yes' }
      ],
      navigation: [
        { title: 'Chapter 1', href: 'text/chapter-001.xhtml' }
      ],
      packageMeta: {
        title: 'Test Novel',
        language: 'en',
        identifier: 'urn:uuid:12345',
        date: '2025-01-01T00:00:00Z'
      }
    };

    const pngData = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]); // PNG header
    const assets: ResolvedAsset[] = [
      {
        id: 'img-1',
        mimeType: 'image/png',
        data: pngData.buffer,
        extension: 'png',
        sourceRef: {
          chapterId: 'ch-1',
          marker: 'ILL-1',
          type: 'image'
        }
      }
    ];

    // Act: Package EPUB
    const result = await packageEpub(content, assets);

    // Assert: Blob created
    expect(result.blob).toBeInstanceOf(Blob);
    expect(result.sizeBytes).toBeGreaterThan(0);

    // Assert: Validation passed
    expect(result.validation.valid).toBe(true);
    expect(result.validation.errors).toHaveLength(0);

    // Unzip and verify structure
    const zip = await JSZip.loadAsync(result.blob);
    const files = Object.keys(zip.files);

    // Assert: Required files exist
    expect(files).toContain('mimetype');
    expect(files).toContain('META-INF/container.xml');
    expect(files).toContain('OEBPS/content.opf');
    expect(files).toContain('OEBPS/nav.xhtml');
    expect(files).toContain('OEBPS/text/chapter-001.xhtml');
    expect(files).toContain('OEBPS/images/img-1.png');

    // Assert: mimetype is correct
    const mimetype = await zip.file('mimetype')!.async('string');
    expect(mimetype).toBe('application/epub+zip');

    // Assert: container.xml is valid
    const container = await zip.file('META-INF/container.xml')!.async('string');
    expect(container).toContain('<?xml version="1.0"');
    expect(container).toContain('urn:oasis:names:tc:opendocument:xmlns:container');
    expect(container).toContain('OEBPS/content.opf');

    // Assert: content.opf contains manifest and spine
    const opf = await zip.file('OEBPS/content.opf')!.async('string');
    expect(opf).toContain('<package');
    expect(opf).toContain('<metadata');
    expect(opf).toContain('<dc:title>Test Novel</dc:title>');
    expect(opf).toContain('<dc:language>en</dc:language>');
    expect(opf).toContain('<manifest>');
    expect(opf).toContain('<item id="chapter-001"');
    expect(opf).toContain('<item id="img-1"');
    expect(opf).toContain('<spine>');
    expect(opf).toContain('<itemref idref="chapter-001"');

    // Assert: nav.xhtml exists
    const nav = await zip.file('OEBPS/nav.xhtml')!.async('string');
    expect(nav).toContain('<nav epub:type="toc"');
    expect(nav).toContain('Chapter 1');

    // Assert: Chapter file preserved
    const chapterXhtml = await zip.file('OEBPS/text/chapter-001.xhtml')!.async('string');
    expect(chapterXhtml).toContain('Chapter 1');

    // Assert: Image preserved
    const imageBytes = await zip.file('OEBPS/images/img-1.png')!.async('uint8array');
    expect(imageBytes).toHaveLength(8);
    expect(Array.from(imageBytes.slice(0, 4))).toEqual([137, 80, 78, 71]); // PNG signature
  });

  it('validates missing required files', async () => {
    // Arrange: Content with empty manifest (invalid)
    const content: BuiltContent = {
      chapterFiles: [],
      manifestItems: [],
      spineItems: [],
      navigation: [],
      packageMeta: {
        title: 'Test',
        language: 'en',
        identifier: 'urn:uuid:123',
        date: '2025-01-01'
      }
    };

    // Act
    const result = await packageEpub(content, []);

    // Assert: Still creates blob but flags validation issues
    expect(result.blob).toBeInstanceOf(Blob);
    expect(result.validation.valid).toBe(false);
    expect(result.validation.errors.length).toBeGreaterThan(0);
  });
});

/**
 * Tests for EPUB Content Builder
 *
 * The content builder turns collected data into XHTML/HTML strings:
 * per-chapter files, metadata pages, inline tables/lists. Pure function - no I/O.
 */

import { describe, it, expect } from 'vitest';
import { buildEpubContent } from '../../services/epub/contentBuilder';
import type { ResolvedAssets, EpubExportOptions } from '../../services/epub/types';

describe('buildEpubContent', () => {
  it('generates XHTML for chapters with images and footnotes', () => {
    // Arrange: Create resolved assets fixture
    const resolvedAssets: ResolvedAssets = {
      chapters: [
        {
          id: 'ch-1',
          chapterNumber: 1,
          title: 'The Beginning',
          content: '<p>Original content</p>',
          translatedTitle: 'El Comienzo',
          translatedContent: '<p>Translated content before [ILL-1] and after.</p>',
          footnotes: [
            { marker: 'FN-1', text: 'This is a footnote' }
          ],
          imageReferences: [
            {
              placementMarker: 'ILL-1',
              prompt: 'A hero standing',
              assetId: 'img-ch-1-ILL-1',
              missing: false
            }
          ],
          prevUrl: null,
          nextUrl: 'https://example.com/ch2'
        }
      ],
      assets: [
        {
          id: 'img-ch-1-ILL-1',
          mimeType: 'image/png',
          data: new ArrayBuffer(8),
          extension: 'png',
          sourceRef: {
            chapterId: 'ch-1',
            marker: 'ILL-1',
            type: 'image'
          }
        }
      ],
      warnings: []
    };

    const options: EpubExportOptions = {
      order: 'number',
      includeTitlePage: false,
      includeStatsPage: false,
      settings: {} as any
    };

    // Act: Build content
    const result = buildEpubContent(resolvedAssets, options);

    // Assert: Chapter XHTML generated
    expect(result.chapterFiles).toHaveLength(1);
    expect(result.chapterFiles[0].filename).toBe('chapter-001.xhtml');
    expect(result.chapterFiles[0].chapterId).toBe('ch-1');

    // Assert: XHTML contains translated content
    const xhtml = result.chapterFiles[0].content;
    expect(xhtml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xhtml).toContain('<!DOCTYPE html');
    expect(xhtml).toContain('<html xmlns="http://www.w3.org/1999/xhtml"');
    expect(xhtml).toContain('<title>El Comienzo</title>');
    expect(xhtml).toContain('Translated content before');

    // Assert: Image injected at placeholder
    expect(xhtml).toContain('<img src="../images/img-ch-1-ILL-1.png"');
    expect(xhtml).toContain('alt="A hero standing"');

    // Assert: Footnotes section
    expect(xhtml).toContain('Footnotes');
    expect(xhtml).toContain('FN-1');
    expect(xhtml).toContain('This is a footnote');

    // Assert: Manifest includes chapter + image
    expect(result.manifestItems).toContainEqual(
      expect.objectContaining({
        id: 'chapter-001',
        href: 'text/chapter-001.xhtml',
        mediaType: 'application/xhtml+xml'
      })
    );
    expect(result.manifestItems).toContainEqual(
      expect.objectContaining({
        id: 'img-ch-1-ILL-1',
        href: 'images/img-ch-1-ILL-1.png',
        mediaType: 'image/png'
      })
    );

    // Assert: Spine lists chapter
    expect(result.spineItems).toHaveLength(1);
    expect(result.spineItems[0].idref).toBe('chapter-001');

    // Assert: Navigation includes chapter
    expect(result.navigation).toHaveLength(1);
    expect(result.navigation[0]).toMatchObject({
      title: 'Chapter 1: El Comienzo',
      href: 'text/chapter-001.xhtml'
    });

    // Assert: Package metadata
    expect(result.packageMeta.language).toBe('en');
    expect(result.packageMeta.identifier).toBeDefined();
  });

  it('generates title page when enabled', () => {
    const resolvedAssets: ResolvedAssets = {
      chapters: [],
      assets: [],
      warnings: []
    };

    const options: EpubExportOptions = {
      order: 'number',
      includeTitlePage: true,
      includeStatsPage: false,
      metadata: {
        gratitudeMessage: 'Thank you for reading!'
      },
      settings: {} as any
    };

    const result = buildEpubContent(resolvedAssets, options);

    expect(result.titlePage).toBeDefined();
    expect(result.titlePage!.filename).toBe('title.xhtml');
    expect(result.titlePage!.content).toContain('Thank you for reading!');
  });

  it('generates statistics page when enabled', () => {
    const resolvedAssets: ResolvedAssets = {
      chapters: [
        {
          id: 'ch-1',
          chapterNumber: 1,
          title: 'Chapter 1',
          content: '<p>Content</p>',
          footnotes: [],
          imageReferences: [],
          translationMeta: {
            provider: 'google',
            model: 'gemini-2.0-flash-exp',
            cost: 0.001,
            tokens: 1000,
            requestTime: 2.5
          }
        }
      ],
      assets: [],
      warnings: []
    };

    const options: EpubExportOptions = {
      order: 'number',
      includeTitlePage: false,
      includeStatsPage: true,
      settings: {} as any
    };

    const result = buildEpubContent(resolvedAssets, options);

    expect(result.statsPage).toBeDefined();
    expect(result.statsPage!.filename).toBe('statistics.xhtml');
    expect(result.statsPage!.content).toContain('Translation Statistics');
    expect(result.statsPage!.content).toContain('gemini-2.0-flash-exp');
    expect(result.statsPage!.content).toContain('1 chapter'); // Singular
  });
});

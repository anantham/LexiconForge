import React from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { NovelDetailSheet } from '../../../components/NovelDetailSheet';
import { clearChapterIndexCache } from '../../../services/library/chapterIndexService';
import type { NovelEntry, NovelVersion, NovelGrouping } from '../../../types/novel';

/**
 * Detection is by the EXPLICIT `metadata.grouping` marker, never inferred from
 * chapter numbers. These render tests red-proof that: a marker-less novel whose
 * chapters merely happen to be numbered 1001+ must render FLAT (version picker),
 * and only the marked novel gets the nested tree.
 */

function makeVersion(overrides: Partial<NovelVersion> = {}): NovelVersion {
  return {
    versionId: 'v1',
    displayName: 'Default Version',
    translator: { name: 'T' },
    sessionJsonUrl: 'https://example.com/session.json',
    targetLanguage: 'English',
    style: 'faithful',
    features: [],
    chapterRange: { from: 1001, to: 18078 }, // spans many "groups" numerically
    completionStatus: 'Complete',
    lastUpdated: '2026-01-01',
    stats: {
      downloads: 0,
      fileSize: '1 MB',
      content: {
        totalImages: 0,
        totalFootnotes: 0,
        totalRawChapters: 700,
        totalTranslatedChapters: 700,
        avgImagesPerChapter: 0,
        avgFootnotesPerChapter: 0,
      },
      translation: { translationType: 'ai', feedbackCount: 0 },
    },
    ...overrides,
  };
}

function makeNovel(grouping: NovelGrouping | undefined, version: NovelVersion): NovelEntry {
  return {
    id: 'test-novel',
    title: 'Test Novel',
    metadata: {
      originalLanguage: 'Sanskrit',
      chapterCount: 700,
      genres: ['Scripture'],
      description: 'A test.',
      lastUpdated: '2026-01-01',
      ...(grouping ? { grouping } : {}),
    },
    versions: [version],
  };
}

beforeEach(() => {
  clearChapterIndexCache();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('NovelDetailSheet grouping detection', () => {
  it('renders the nested tree ONLY when the explicit chapter-verse marker is present', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        text: async () =>
          JSON.stringify({
            chapters: [
              { chapterNumber: 1001, title: '1.1' },
              { chapterNumber: 2047, title: '2.47' },
            ],
          }),
      })),
    );

    const novel = makeNovel({ scheme: 'chapter-verse' }, makeVersion());
    render(
      <NovelDetailSheet novel={novel} isOpen onClose={vi.fn()} onStartReading={vi.fn()} />,
    );

    // The grouped branch renders the "start at the beginning" button …
    expect(screen.getByText('Start Reading from the beginning')).toBeInTheDocument();
    // … and, once the lazy index fetch resolves, the tree itself.
    await waitFor(() => expect(screen.getByText('Chapters & Verses')).toBeInTheDocument());
    expect(screen.getByText('Chapter 2')).toBeInTheDocument();
  });

  // RED-PROOF: same 1001..18078 numbering, but NO marker → must stay flat.
  it('renders FLAT (version picker) for a marker-less novel numbered 1001+', () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const novel = makeNovel(undefined, makeVersion());
    render(
      <NovelDetailSheet novel={novel} isOpen onClose={vi.fn()} onStartReading={vi.fn()} />,
    );

    // No grouped affordances.
    expect(screen.queryByText('Start Reading from the beginning')).not.toBeInTheDocument();
    expect(screen.queryByText('Chapters & Verses')).not.toBeInTheDocument();
    // The ordinary version picker instead.
    expect(screen.getByText('Available Versions')).toBeInTheDocument();
    // And we never even fetched a chapter index for a non-grouped novel.
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { useNovelMetadata } from '../../hooks/useNovelMetadata';

const settingsOpsMock = vi.hoisted(() => ({
  getKey: vi.fn(),
  set: vi.fn(),
}));

const registryServiceMock = vi.hoisted(() => ({
  fetchNovelById: vi.fn(),
  resolveCompatibleVersion: vi.fn((novel: any, requestedVersionId: string | null) => {
    if (!requestedVersionId) {
      return { version: null, requestedVersionId, resolvedVersionId: null, warning: null };
    }
    const match = novel.versions?.find((candidate: any) => candidate.versionId === requestedVersionId) ?? null;
    return {
      version: match,
      requestedVersionId,
      resolvedVersionId: match?.versionId ?? null,
      warning: null,
    };
  }),
}));

vi.mock('../../services/db/operations', async () => {
  const actual = await vi.importActual<typeof import('../../services/db/operations')>(
    '../../services/db/operations'
  );
  return {
    ...actual,
    SettingsOps: settingsOpsMock,
  };
});

vi.mock('../../services/registryService', () => ({
  RegistryService: registryServiceMock,
}));

vi.mock('../../utils/debug', () => ({
  debugLog: vi.fn(),
}));

const HookProbe: React.FC<{ activeNovelId?: string | null; activeVersionId?: string | null }> = ({
  activeNovelId = null,
  activeVersionId = null,
}) => {
  const { novelMetadata } = useNovelMetadata(
    new Map([
      [
        'ch-1',
        {
          id: 'ch-1',
          title: 'Chapter 1: Artifact Graveyard',
        },
      ],
    ]),
    { activeNovelId, activeVersionId }
  );

  return <div data-testid="title">{novelMetadata?.title ?? 'missing'}</div>;
};

describe('useNovelMetadata', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    settingsOpsMock.getKey.mockResolvedValue(null);
    settingsOpsMock.set.mockResolvedValue(undefined);
  });

  it('prefers active library novel metadata over stale local metadata', async () => {
    localStorage.setItem(
      'novelMetadata',
      JSON.stringify({
        title: 'Chapter 1: Artifact Graveyard',
        description: 'Please provide a description for this novel.',
        originalLanguage: 'Unknown',
        chapterCount: 1,
        genres: [],
        lastUpdated: '2026-04-09',
      })
    );

    registryServiceMock.fetchNovelById.mockResolvedValue({
      id: 'forty-millenniums-of-cultivation',
      title: 'Forty Millenniums of Cultivation',
      alternateTitles: ['Xiuzhen Si Wan Nian'],
      metadata: {
        originalLanguage: 'Chinese',
        chapterCount: 3521,
        genres: ['Sci-fi'],
        description: 'Real library description',
        author: 'The Enlightened Master Crouching Cow',
        lastUpdated: '2026-04-08',
      },
      versions: [
        {
          versionId: 'v1-st-enhanced',
          displayName: 'ST-Enhanced AI Translation',
          translator: { name: 'LexiconForge (ST Bridge)' },
          sessionJsonUrl: 'https://example.com/session.json',
          targetLanguage: 'English',
          style: 'faithful',
          features: [],
          chapterRange: { from: 1, to: 3521 },
          completionStatus: 'In Progress',
          lastUpdated: '2026-04-08',
          stats: {
            downloads: 0,
            fileSize: '0MB',
            content: {
              totalImages: 0,
              totalFootnotes: 0,
              totalRawChapters: 3521,
              totalTranslatedChapters: 3273,
              avgImagesPerChapter: 0,
              avgFootnotesPerChapter: 0,
            },
            translation: {
              translationType: 'ai',
              feedbackCount: 0,
            },
          },
        },
      ],
    });

    render(
      <HookProbe
        activeNovelId="forty-millenniums-of-cultivation"
        activeVersionId="v1-st-enhanced"
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('title')).toHaveTextContent('Forty Millenniums of Cultivation');
    });
  });
});

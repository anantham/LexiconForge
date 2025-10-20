import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VersionPicker } from '../../components/VersionPicker';
import type { NovelVersion } from '../../types/novel';

describe('VersionPicker', () => {
  const mockVersions: NovelVersion[] = [
    {
      versionId: 'alice-v1',
      displayName: 'Alice Community Translation',
      translator: { name: 'Alice', link: 'https://github.com/alice' },
      sessionJsonUrl: 'https://example.com/alice.json',
      targetLanguage: 'English',
      style: 'faithful',
      features: ['footnotes'],
      chapterRange: { from: 1, to: 50 },
      completionStatus: 'Complete',
      lastUpdated: '2025-01-15',
      stats: {
        downloads: 1234,
        fileSize: '5 MB',
        content: {
          totalImages: 150,
          totalFootnotes: 300,
          totalRawChapters: 50,
          totalTranslatedChapters: 50,
          avgImagesPerChapter: 3.0,
          avgFootnotesPerChapter: 6.0
        },
        translation: {
          translationType: 'human',
          feedbackCount: 42,
          qualityRating: 4.5
        }
      }
    },
    {
      versionId: 'bob-v1',
      displayName: 'Bob Illustrated Edition',
      translator: { name: 'Bob', link: 'https://github.com/bob' },
      sessionJsonUrl: 'https://example.com/bob.json',
      targetLanguage: 'English',
      style: 'image-heavy',
      features: ['ai-images'],
      basedOn: 'alice-v1',
      chapterRange: { from: 1, to: 10 },
      completionStatus: 'In Progress',
      lastUpdated: '2025-01-19',
      stats: {
        downloads: 234,
        fileSize: '12 MB',
        content: {
          totalImages: 250,
          totalFootnotes: 50,
          totalRawChapters: 50,
          totalTranslatedChapters: 10,
          avgImagesPerChapter: 25.0,
          avgFootnotesPerChapter: 5.0
        },
        translation: {
          translationType: 'hybrid',
          aiPercentage: 60,
          feedbackCount: 12,
          qualityRating: 3.8
        }
      }
    }
  ];

  it('should render all versions', () => {
    render(<VersionPicker versions={mockVersions} onSelect={vi.fn()} />);

    expect(screen.getByText('Alice Community Translation')).toBeInTheDocument();
    expect(screen.getByText('Bob Illustrated Edition')).toBeInTheDocument();
  });

  it('should show fork lineage', () => {
    render(<VersionPicker versions={mockVersions} onSelect={vi.fn()} />);

    expect(screen.getByText(/Based on:/i)).toBeInTheDocument();
    expect(screen.getByText('alice-v1')).toBeInTheDocument();
  });

  it('should call onSelect when Start Reading clicked', () => {
    const onSelect = vi.fn();
    render(<VersionPicker versions={mockVersions} onSelect={onSelect} />);

    const buttons = screen.getAllByText('Start Reading');
    fireEvent.click(buttons[0]);

    expect(onSelect).toHaveBeenCalledWith(mockVersions[0]);
  });
});

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CoverageDistribution } from '../../components/CoverageDistribution';
import type { ChapterCoverageStats } from '../../types/novel';

describe('CoverageDistribution', () => {
  it('should show aggregate stats', () => {
    const stats: ChapterCoverageStats = {
      chaptersWithMultipleVersions: 25,
      avgVersionsPerChapter: 2.5,
      medianVersionsPerChapter: 2,
      maxVersionsForAnyChapter: 5,
      coverageDistribution: {
        1: 3, 2: 2, 3: 2, 5: 3, 10: 5  // chapter -> version count
      }
    };

    render(<CoverageDistribution stats={stats} totalChapters={50} />);

    expect(screen.getByText('25')).toBeInTheDocument();
    expect(screen.getByText(/chapters with multiple versions/i)).toBeInTheDocument();
    expect(screen.getByText('2.5')).toBeInTheDocument();
    expect(screen.getByText(/avg versions per chapter/i)).toBeInTheDocument();
  });
});

import React from 'react';
import type { ChapterCoverageStats } from '../types/novel';

interface CoverageDistributionProps {
  stats: ChapterCoverageStats;
  totalChapters: number;
}

export function CoverageDistribution({ stats, totalChapters }: CoverageDistributionProps) {
  // Calculate distribution histogram
  const versionCounts = Object.values(stats.coverageDistribution);
  const maxCount = Math.max(...versionCounts, 1);

  return (
    <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 space-y-4">
      <h4 className="font-semibold text-gray-900 dark:text-white">
        Version Coverage Across Chapters
      </h4>

      {/* Aggregate Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="text-center">
          <div className="text-xl font-bold text-blue-600 dark:text-blue-400">
            {stats.chaptersWithMultipleVersions}
          </div>
          <div className="text-xs text-gray-600 dark:text-gray-400">
            Chapters with multiple versions
          </div>
        </div>

        <div className="text-center">
          <div className="text-xl font-bold text-purple-600 dark:text-purple-400">
            {stats.avgVersionsPerChapter.toFixed(1)}
          </div>
          <div className="text-xs text-gray-600 dark:text-gray-400">
            Avg versions per chapter
          </div>
        </div>

        <div className="text-center">
          <div className="text-xl font-bold text-green-600 dark:text-green-400">
            {stats.medianVersionsPerChapter}
          </div>
          <div className="text-xs text-gray-600 dark:text-gray-400">
            Median versions
          </div>
        </div>

        <div className="text-center">
          <div className="text-xl font-bold text-orange-600 dark:text-orange-400">
            {stats.maxVersionsForAnyChapter}
          </div>
          <div className="text-xs text-gray-600 dark:text-gray-400">
            Max versions (any chapter)
          </div>
        </div>
      </div>

      {/* Simple Bar Chart Visualization */}
      <div className="space-y-2">
        <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Chapters by Version Count
        </div>

        {/* Group chapters by version count */}
        {Array.from({ length: stats.maxVersionsForAnyChapter }, (_, i) => i + 1).map(versionCount => {
          const chaptersWithThisCount = Object.entries(stats.coverageDistribution)
            .filter(([_, count]) => count === versionCount)
            .length;

          if (chaptersWithThisCount === 0) return null;

          const percentage = (chaptersWithThisCount / totalChapters) * 100;

          return (
            <div key={versionCount} className="flex items-center gap-2">
              <div className="w-16 text-xs text-gray-600 dark:text-gray-400">
                {versionCount} {versionCount === 1 ? 'version' : 'versions'}
              </div>

              <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-6 relative">
                <div
                  className="bg-blue-600 dark:bg-blue-500 h-6 rounded-full transition-all flex items-center justify-end pr-2"
                  style={{ width: `${percentage}%` }}
                >
                  <span className="text-xs text-white font-medium">
                    {chaptersWithThisCount} ch
                  </span>
                </div>
              </div>

              <div className="w-12 text-xs text-gray-600 dark:text-gray-400 text-right">
                {percentage.toFixed(0)}%
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

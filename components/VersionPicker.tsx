import React from 'react';
import { BookOpen, User, Download } from 'lucide-react';
import type { NovelVersion } from '../types/novel';

interface VersionPickerProps {
  versions: NovelVersion[];
  onSelect: (version: NovelVersion) => void;
}

export function VersionPicker({ versions, onSelect }: VersionPickerProps) {
  if (!versions || versions.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No versions available yet. Be the first to contribute!
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Available Versions</h3>

      {versions.map(version => (
        <div
          key={version.versionId}
          className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:border-blue-500 transition-colors"
        >
          {/* Header */}
          <div className="flex items-start justify-between mb-2">
            <div>
              <h4 className="font-semibold text-lg">{version.displayName}</h4>
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mt-1">
                <User className="h-4 w-4" />
                {version.translator.link ? (
                  <a
                    href={version.translator.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-blue-600 hover:underline"
                  >
                    {version.translator.name}
                  </a>
                ) : (
                  <span>{version.translator.name}</span>
                )}
              </div>
            </div>

            <span
              className={`px-2 py-1 text-xs rounded ${
                version.completionStatus === 'Complete'
                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                  : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
              }`}
            >
              {version.completionStatus}
            </span>
          </div>

          {/* Translation Type Badge */}
          <div className="mb-3">
            <span className={`px-2 py-1 text-xs rounded ${
              version.stats.translation.translationType === 'human'
                ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                : version.stats.translation.translationType === 'ai'
                ? 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200'
                : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200'
            }`}>
              {version.stats.translation.translationType === 'human' && '👤 Human Translation'}
              {version.stats.translation.translationType === 'ai' && '🤖 AI Translation'}
              {version.stats.translation.translationType === 'hybrid' && `🤝 Hybrid (${version.stats.translation.aiPercentage}% AI)`}
            </span>
          </div>

          {/* Quality Rating & Feedback */}
          {version.stats.translation.qualityRating && (
            <div className="flex items-center gap-2 mb-3 text-sm">
              <div className="flex items-center">
                {'⭐'.repeat(Math.floor(version.stats.translation.qualityRating))}
                <span className="ml-1 text-gray-600 dark:text-gray-400">
                  {version.stats.translation.qualityRating.toFixed(1)}
                </span>
              </div>
              <span className="text-gray-400">•</span>
              <span className="text-gray-600 dark:text-gray-400">
                {version.stats.translation.feedbackCount} reviews
              </span>
            </div>
          )}

          {/* Basic Stats */}
          <div className="flex flex-wrap gap-4 text-sm text-gray-600 dark:text-gray-400 mb-3">
            <div className="flex items-center gap-1">
              <BookOpen className="h-4 w-4" />
              <span>Chapters {version.chapterRange.from}-{version.chapterRange.to}</span>
            </div>

            <div className="flex items-center gap-1">
              <Download className="h-4 w-4" />
              <span>{version.stats.downloads} downloads</span>
            </div>

            <div>
              <span className="font-medium">{version.style}</span>
            </div>

            <div>
              <span>{version.stats.fileSize}</span>
            </div>
          </div>

          {/* Content Statistics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3 bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
            <div className="text-center">
              <div className="text-lg font-semibold text-blue-600 dark:text-blue-400">
                {version.stats.content.totalImages}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Images</div>
              <div className="text-xs text-gray-500">
                ({version.stats.content.avgImagesPerChapter.toFixed(1)}/ch)
              </div>
            </div>

            <div className="text-center">
              <div className="text-lg font-semibold text-purple-600 dark:text-purple-400">
                {version.stats.content.totalFootnotes}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Footnotes</div>
              <div className="text-xs text-gray-500">
                ({version.stats.content.avgFootnotesPerChapter.toFixed(1)}/ch)
              </div>
            </div>

            <div className="text-center">
              <div className="text-lg font-semibold text-green-600 dark:text-green-400">
                {version.stats.content.totalTranslatedChapters}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Translated</div>
              <div className="text-xs text-gray-500">
                of {version.stats.content.totalRawChapters}
              </div>
            </div>

            <div className="text-center">
              <div className="text-lg font-semibold text-orange-600 dark:text-orange-400">
                {Math.round((version.stats.content.totalTranslatedChapters / version.stats.content.totalRawChapters) * 100)}%
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Complete</div>
            </div>
          </div>

          {/* Features */}
          {version.features.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {version.features.map(feature => (
                <span
                  key={feature}
                  className="px-2 py-1 text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded"
                >
                  {feature}
                </span>
              ))}
            </div>
          )}

          {/* Fork lineage */}
          {version.basedOn && (
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              Based on: <span className="font-mono">{version.basedOn}</span>
            </div>
          )}

          {/* Action */}
          <button
            onClick={() => onSelect(version)}
            className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Start Reading
          </button>
        </div>
      ))}
    </div>
  );
}

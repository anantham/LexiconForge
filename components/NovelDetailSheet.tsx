import React from 'react';
import { BookOpen, Star, X, ExternalLink, Globe, User } from 'lucide-react';
import type { NovelEntry, NovelVersion, ChapterCoverageStats, MediaCorrespondenceAnchor, MediaReference } from '../types/novel';
import { VersionPicker } from './VersionPicker';
import { CoverageDistribution } from './CoverageDistribution';

interface NovelDetailSheetProps {
  novel: NovelEntry | null;
  isOpen: boolean;
  onClose: () => void;
  onStartReading: (novel: NovelEntry, version?: NovelVersion) => void;
}

function computeCoverageStats(versions: NovelVersion[]): ChapterCoverageStats | null {
  if (!versions || versions.length <= 1) return null;

  // Build a map of chapter -> version count
  const coverageMap: { [chapter: number]: number } = {};

  versions.forEach(version => {
    const { from, to } = version.chapterRange;
    for (let ch = from; ch <= to; ch++) {
      coverageMap[ch] = (coverageMap[ch] || 0) + 1;
    }
  });

  const versionCounts = Object.values(coverageMap);
  const totalChapters = Object.keys(coverageMap).length;

  if (totalChapters === 0) return null;

  const chaptersWithMultipleVersions = versionCounts.filter(count => count > 1).length;
  const avgVersionsPerChapter = versionCounts.reduce((sum, count) => sum + count, 0) / totalChapters;

  const sortedCounts = [...versionCounts].sort((a, b) => a - b);
  const medianVersionsPerChapter = totalChapters % 2 === 0
    ? (sortedCounts[totalChapters / 2 - 1] + sortedCounts[totalChapters / 2]) / 2
    : sortedCounts[Math.floor(totalChapters / 2)];

  const maxVersionsForAnyChapter = Math.max(...versionCounts);

  return {
    chaptersWithMultipleVersions,
    avgVersionsPerChapter,
    medianVersionsPerChapter,
    maxVersionsForAnyChapter,
    coverageDistribution: coverageMap
  };
}

// Helper functions for checking if any anchor has data for a given medium
function hasAnyAnime(anchors: MediaCorrespondenceAnchor[]): boolean {
  return anchors.some(a => a.anime);
}

function hasAnyWebNovel(anchors: MediaCorrespondenceAnchor[]): boolean {
  return anchors.some(a => a.webNovel);
}

function hasAnyLightNovel(anchors: MediaCorrespondenceAnchor[]): boolean {
  return anchors.some(a => a.lightNovel);
}

function hasAnyManga(anchors: MediaCorrespondenceAnchor[]): boolean {
  return anchors.some(a => a.manga);
}

function hasAnyManhua(anchors: MediaCorrespondenceAnchor[]): boolean {
  return anchors.some(a => a.manhua);
}

function hasAnyDonghua(anchors: MediaCorrespondenceAnchor[]): boolean {
  return anchors.some(a => a.donghua);
}

// Component for rendering individual media cells
function MediaCell({ reference, type }: { reference: MediaReference; type: 'anime' | 'donghua' | 'chapters' | 'lightNovel' }) {
  return (
    <div>
      {(type === 'anime' || type === 'donghua') && reference.episodes && (
        <div>
          {reference.episodes.season && `S${reference.episodes.season} `}
          Ep {reference.episodes.from}
          {reference.episodes.to !== reference.episodes.from && `–${reference.episodes.to}`}
        </div>
      )}

      {type === 'chapters' && reference.chapters && (
        <div>
          Ch {reference.chapters.from}
          {reference.chapters.to !== reference.chapters.from && `–${reference.chapters.to}`}
        </div>
      )}

      {type === 'lightNovel' && (
        <div>
          Vol {reference.volume}
          {reference.chapters && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {' '}(Ch {reference.chapters.from}–{reference.chapters.to})
            </span>
          )}
        </div>
      )}

      {reference.notes && (
        <div className="text-xs text-gray-500 dark:text-gray-400 italic mt-1">
          {reference.notes}
        </div>
      )}

      {reference.startUrl && (
        <a
          href={reference.startUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-600 dark:text-blue-400 hover:underline mt-1 inline-block"
        >
          Start here →
        </a>
      )}
    </div>
  );
}

export function NovelDetailSheet({ novel, isOpen, onClose, onStartReading }: NovelDetailSheetProps) {
  if (!novel || !isOpen) return null;

  const coverageStats = novel.versions ? computeCoverageStats(novel.versions) : null;
  const totalChapters = novel.metadata.chapterCount ||
    (novel.versions ? Math.max(...novel.versions.map(v => v.chapterRange.to)) : 0);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="fixed inset-y-0 right-0 w-full sm:max-w-md md:max-w-lg lg:max-w-xl bg-white dark:bg-gray-900 shadow-2xl z-50 overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex justify-between items-start z-10">
          <div className="flex-1 pr-4">
            <div className="flex items-baseline gap-3 mb-1">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                {novel.title}
              </h2>
              {totalChapters > 0 && (
                <span className="text-sm font-medium text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">
                  {totalChapters} chapters
                </span>
              )}
            </div>
            {novel.metadata.author && (
              <p className="text-sm text-gray-600 dark:text-gray-400">
                by {novel.metadata.author}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex-shrink-0"
          >
            <X className="h-6 w-6 text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-6">
          {/* Cover + Quick Info */}
          <div className="sm:flex gap-6 mb-6">
            {/* Cover Image */}
            <div className="relative w-[180px] h-[270px] mx-auto sm:mx-0 mb-6 sm:mb-0 shadow-lg rounded-lg overflow-hidden flex-shrink-0">
              {novel.metadata.coverImageUrl ? (
                <img
                  src={novel.metadata.coverImageUrl}
                  alt={`Cover of ${novel.title}`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gray-200 dark:bg-gray-800">
                  <BookOpen className="h-16 w-16 text-gray-400 dark:text-gray-600" />
                </div>
              )}
            </div>

            {/* Quick Metadata */}
            <div className="flex-1">
              <div className="space-y-3">
                {/* Chapter Count */}
                <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <BookOpen className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                  <span>{novel.metadata.chapterCount} chapters</span>
                </div>

                {/* Language */}
                <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <Globe className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                  <span>
                    {novel.metadata.originalLanguage} → {novel.metadata.targetLanguage || (novel.versions && novel.versions.length > 0 ? novel.versions[0].targetLanguage : 'Multiple Languages')}
                  </span>
                </div>

                {/* Novel Updates Link */}
                {novel.metadata.sourceLinks?.novelUpdates && (
                  <a
                    href={novel.metadata.sourceLinks.novelUpdates}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    <ExternalLink className="h-4 w-4" />
                    View on Novel Updates
                  </a>
                )}
              </div>

            </div>
          </div>

          {/* Version Picker or Single Start Reading Button */}
          {novel.versions && novel.versions.length > 0 ? (
            <VersionPicker
              versions={novel.versions}
              totalNovelChapters={novel.metadata.chapterCount}
              onSelect={(version) => onStartReading(novel, version)}
            />
          ) : (
            <button
              onClick={() => onStartReading(novel)}
              className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold rounded-lg transition-all shadow-md hover:shadow-lg"
            >
              Start Reading
            </button>
          )}

          {/* Coverage Distribution - show when novel has multiple versions */}
          {coverageStats && (
            <div className="mt-6">
              <CoverageDistribution
                stats={coverageStats}
                totalChapters={totalChapters}
              />
            </div>
          )}

          {/* Cross-Media Correspondence Table */}
          {novel.metadata.mediaCorrespondence && novel.metadata.mediaCorrespondence.length > 0 && (
            <div className="mt-6">
              <h4 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100">
                Cross-Media Guide
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                See how different versions align at key story points
              </p>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-gray-100 dark:bg-gray-800">
                      <th className="border border-gray-300 dark:border-gray-700 px-3 py-2 text-left font-semibold text-gray-900 dark:text-gray-100">
                        Milestone
                      </th>
                      {hasAnyAnime(novel.metadata.mediaCorrespondence) && (
                        <th className="border border-gray-300 dark:border-gray-700 px-3 py-2 text-left font-semibold text-gray-900 dark:text-gray-100">
                          📺 Anime
                        </th>
                      )}
                      {hasAnyDonghua(novel.metadata.mediaCorrespondence) && (
                        <th className="border border-gray-300 dark:border-gray-700 px-3 py-2 text-left font-semibold text-gray-900 dark:text-gray-100">
                          📺 Donghua
                        </th>
                      )}
                      {hasAnyWebNovel(novel.metadata.mediaCorrespondence) && (
                        <th className="border border-gray-300 dark:border-gray-700 px-3 py-2 text-left font-semibold text-gray-900 dark:text-gray-100">
                          📖 Web Novel
                        </th>
                      )}
                      {hasAnyLightNovel(novel.metadata.mediaCorrespondence) && (
                        <th className="border border-gray-300 dark:border-gray-700 px-3 py-2 text-left font-semibold text-gray-900 dark:text-gray-100">
                          📚 Light Novel
                        </th>
                      )}
                      {hasAnyManga(novel.metadata.mediaCorrespondence) && (
                        <th className="border border-gray-300 dark:border-gray-700 px-3 py-2 text-left font-semibold text-gray-900 dark:text-gray-100">
                          🎨 Manga
                        </th>
                      )}
                      {hasAnyManhua(novel.metadata.mediaCorrespondence) && (
                        <th className="border border-gray-300 dark:border-gray-700 px-3 py-2 text-left font-semibold text-gray-900 dark:text-gray-100">
                          🎨 Manhua
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {novel.metadata.mediaCorrespondence.map((anchor) => (
                      <tr key={anchor.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <td className="border border-gray-300 dark:border-gray-700 px-3 py-2">
                          <div className="font-medium text-gray-900 dark:text-gray-100">
                            {anchor.label}
                          </div>
                          {anchor.description && (
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              {anchor.description}
                            </div>
                          )}
                        </td>

                        {hasAnyAnime(novel.metadata.mediaCorrespondence) && (
                          <td className="border border-gray-300 dark:border-gray-700 px-3 py-2 text-gray-700 dark:text-gray-300">
                            {anchor.anime ? (
                              <MediaCell reference={anchor.anime} type="anime" />
                            ) : (
                              <span className="text-gray-400 dark:text-gray-600">—</span>
                            )}
                          </td>
                        )}

                        {hasAnyDonghua(novel.metadata.mediaCorrespondence) && (
                          <td className="border border-gray-300 dark:border-gray-700 px-3 py-2 text-gray-700 dark:text-gray-300">
                            {anchor.donghua ? (
                              <MediaCell reference={anchor.donghua} type="donghua" />
                            ) : (
                              <span className="text-gray-400 dark:text-gray-600">—</span>
                            )}
                          </td>
                        )}

                        {hasAnyWebNovel(novel.metadata.mediaCorrespondence) && (
                          <td className="border border-gray-300 dark:border-gray-700 px-3 py-2 text-gray-700 dark:text-gray-300">
                            {anchor.webNovel ? (
                              <MediaCell reference={anchor.webNovel} type="chapters" />
                            ) : (
                              <span className="text-gray-400 dark:text-gray-600">—</span>
                            )}
                          </td>
                        )}

                        {hasAnyLightNovel(novel.metadata.mediaCorrespondence) && (
                          <td className="border border-gray-300 dark:border-gray-700 px-3 py-2 text-gray-700 dark:text-gray-300">
                            {anchor.lightNovel ? (
                              <MediaCell reference={anchor.lightNovel} type="lightNovel" />
                            ) : (
                              <span className="text-gray-400 dark:text-gray-600">—</span>
                            )}
                          </td>
                        )}

                        {hasAnyManga(novel.metadata.mediaCorrespondence) && (
                          <td className="border border-gray-300 dark:border-gray-700 px-3 py-2 text-gray-700 dark:text-gray-300">
                            {anchor.manga ? (
                              <MediaCell reference={anchor.manga} type="chapters" />
                            ) : (
                              <span className="text-gray-400 dark:text-gray-600">—</span>
                            )}
                          </td>
                        )}

                        {hasAnyManhua(novel.metadata.mediaCorrespondence) && (
                          <td className="border border-gray-300 dark:border-gray-700 px-3 py-2 text-gray-700 dark:text-gray-300">
                            {anchor.manhua ? (
                              <MediaCell reference={anchor.manhua} type="chapters" />
                            ) : (
                              <span className="text-gray-400 dark:text-gray-600">—</span>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Description */}
          <div className="mb-6">
            <h4 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100">
              Description
            </h4>
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
              {novel.metadata.description}
            </p>
          </div>

          {/* Genres */}
          <div className="mb-6">
            <h4 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100">
              Genres
            </h4>
            <div className="flex flex-wrap gap-2">
              {novel.metadata.genres.map((genre, index) => (
                <span
                  key={index}
                  className="text-xs px-3 py-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-full font-medium border border-blue-200 dark:border-blue-800"
                >
                  {genre}
                </span>
              ))}
            </div>
          </div>

          {/* Tags */}
          {novel.metadata.tags && novel.metadata.tags.length > 0 && (
            <div>
              <h4 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100">
                Tags
              </h4>
              <div className="flex flex-wrap gap-2">
                {novel.metadata.tags.map((tag, index) => (
                  <span
                    key={index}
                    className="text-xs px-3 py-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-full"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

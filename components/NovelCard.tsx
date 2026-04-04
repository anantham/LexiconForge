import React from 'react';
import { BookOpen, Star } from 'lucide-react';
import type { NovelEntry } from '../types/novel';
import { NovelCoverImage } from './NovelCoverImage';

interface NovelCardProps {
  novel: NovelEntry;
  onViewDetails: (novel: NovelEntry) => void;
  onSelect?: (novel: NovelEntry) => void;
  progressLabel?: string;
  badgeLabel?: string;
}

export const NovelCard: React.FC<NovelCardProps> = ({
  novel,
  onViewDetails,
  onSelect,
  progressLabel,
  badgeLabel,
}) => {
  const genres = novel.metadata.genres.slice(0, 2);

  return (
    <div
      className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden transition-all hover:shadow-2xl hover:-translate-y-1 flex flex-col h-full border border-gray-200 dark:border-gray-700 cursor-pointer group"
      onClick={() => (onSelect ?? onViewDetails)(novel)}
    >
      {/* Cover Image - Portrait aspect ratio (140% height) */}
      <div className="relative pt-[140%] bg-gray-100 dark:bg-gray-900">
        <NovelCoverImage
          src={novel.metadata.coverImageUrl}
          alt={`Cover of ${novel.title}`}
          imgClassName="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          placeholderClassName="absolute inset-0 flex items-center justify-center bg-gray-200 dark:bg-gray-800"
          iconClassName="h-16 w-16 text-gray-400 dark:text-gray-600"
        />
      </div>

      {/* Metadata */}
      <div className="p-4 flex-grow flex flex-col">
        {badgeLabel && (
          <div className="mb-2">
            <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-900 dark:bg-amber-900/40 dark:text-amber-100">
              {badgeLabel}
            </span>
          </div>
        )}

        {/* Title */}
        <h3 className="font-semibold text-sm line-clamp-2 mb-1 text-gray-900 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors duration-200">
          {novel.title}
        </h3>

        {/* Author */}
        {novel.metadata.author && (
          <p className="text-gray-600 dark:text-gray-400 text-xs mb-2">
            {novel.metadata.author}
          </p>
        )}

        {/* Language Info */}
        <p className="text-gray-500 dark:text-gray-500 text-xs mb-3">
          {novel.metadata.originalLanguage}
        </p>

        {/* Chapter Count */}
        <div className="flex items-center mb-3 text-xs text-gray-600 dark:text-gray-400">
          <BookOpen className="h-3.5 w-3.5 mr-1" />
          <span>{novel.metadata.chapterCount} chapters</span>
        </div>

        {progressLabel && (
          <p className="mb-3 text-xs font-medium text-amber-700 dark:text-amber-300">
            {progressLabel}
          </p>
        )}

        {/* Genre Tags */}
        <div className="flex flex-wrap gap-1.5 mt-auto">
          {genres.map((genre, index) => (
            <span
              key={index}
              className="text-[10px] px-2.5 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-full font-medium border border-blue-200 dark:border-blue-800"
            >
              {genre}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

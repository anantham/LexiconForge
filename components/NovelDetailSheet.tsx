import React, { useState } from 'react';
import { BookOpen, Star, X, ExternalLink, Globe, User } from 'lucide-react';
import type { NovelEntry } from '../types/novel';

interface NovelDetailSheetProps {
  novel: NovelEntry | null;
  isOpen: boolean;
  onClose: () => void;
  onStartReading: (novel: NovelEntry) => void;
}

export function NovelDetailSheet({ novel, isOpen, onClose, onStartReading }: NovelDetailSheetProps) {
  if (!novel || !isOpen) return null;

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
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-1">
              {novel.title}
            </h2>
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
                {/* Rating */}
                {novel.metadata.rating && (
                  <div className="flex items-center gap-2">
                    <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {novel.metadata.rating.toFixed(1)}
                    </span>
                  </div>
                )}

                {/* Chapter Count */}
                <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <BookOpen className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                  <span>{novel.metadata.chapterCount} chapters</span>
                </div>

                {/* Language */}
                <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <Globe className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                  <span>
                    {novel.metadata.originalLanguage} → {novel.metadata.targetLanguage}
                  </span>
                </div>

                {/* Translator */}
                {novel.metadata.translator && (
                  <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <User className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                    <span>Translated by {novel.metadata.translator}</span>
                  </div>
                )}

                {/* Source Link */}
                {novel.metadata.sourceUrl && (
                  <a
                    href={novel.metadata.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    <ExternalLink className="h-4 w-4" />
                    View on {novel.metadata.sourceName || 'source site'}
                  </a>
                )}
              </div>

              {/* Start Reading Button */}
              <button
                onClick={() => onStartReading(novel)}
                className="w-full sm:w-auto mt-6 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold rounded-lg transition-all shadow-md hover:shadow-lg"
              >
                Start Reading
              </button>
            </div>
          </div>

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

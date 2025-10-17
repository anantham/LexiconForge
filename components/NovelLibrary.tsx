import React, { useState } from 'react';
import { BookOpen } from 'lucide-react';
import { NovelGrid } from './NovelGrid';
import { NovelDetailSheet } from './NovelDetailSheet';
import { getAllNovels } from '../config/novelCatalog';
import { ImportService } from '../services/importService';
import { useAppStore } from '../store';
import type { NovelEntry } from '../types/novel';

interface NovelLibraryProps {
  onSessionLoaded?: () => void;
}

export function NovelLibrary({ onSessionLoaded }: NovelLibraryProps) {
  const [selectedNovel, setSelectedNovel] = useState<NovelEntry | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const setNotification = useAppStore(s => s.setNotification);

  const novels = getAllNovels();

  const handleViewDetails = (novel: NovelEntry) => {
    setSelectedNovel(novel);
  };

  const handleCloseDetails = () => {
    setSelectedNovel(null);
  };

  const handleStartReading = async (novel: NovelEntry) => {
    // Check if session URL exists
    if (!novel.sessionJsonUrl) {
      setNotification({
        type: 'error',
        message: `${novel.title} is not yet available. Check back soon!`
      });
      return;
    }

    setIsLoading(true);
    setNotification({
      type: 'info',
      message: `Loading ${novel.title}... (${novel.metadata.chapterCount} chapters)`
    });

    try {
      await ImportService.importFromUrl(novel.sessionJsonUrl);

      setNotification({
        type: 'success',
        message: `✅ Loaded ${novel.title} - ${novel.metadata.chapterCount} chapters ready!`
      });

      // Close the detail sheet
      setSelectedNovel(null);

      // Notify parent that session is loaded
      onSessionLoaded?.();
    } catch (error: any) {
      console.error('[NovelLibrary] Failed to load novel:', error);
      setNotification({
        type: 'error',
        message: `Failed to load ${novel.title}: ${error.message}`
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <div className="flex items-center justify-center mb-4">
          <BookOpen className="h-12 w-12 text-blue-600 dark:text-blue-400 mr-3" />
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white">
            Novel Library
          </h2>
        </div>
        <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
          Browse our curated collection of web novels. Each novel comes pre-loaded with chapters
          ready for AI translation, illustration generation, and EPUB export.
        </p>
      </div>

      {/* Novel Grid */}
      <NovelGrid novels={novels} onViewDetails={handleViewDetails} />

      {/* Loading Overlay */}
      {isLoading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-8 max-w-md mx-4">
            <div className="flex flex-col items-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
              <p className="text-gray-900 dark:text-gray-100 font-semibold">
                Loading novel session...
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                This may take a few moments
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Novel Detail Sheet */}
      <NovelDetailSheet
        novel={selectedNovel}
        isOpen={!!selectedNovel}
        onClose={handleCloseDetails}
        onStartReading={handleStartReading}
      />
    </div>
  );
}

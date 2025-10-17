import React from 'react';
import { NovelCard } from './NovelCard';
import type { NovelEntry } from '../types/novel';

interface NovelGridProps {
  novels: NovelEntry[];
  onViewDetails: (novel: NovelEntry) => void;
}

export function NovelGrid({ novels, onViewDetails }: NovelGridProps) {
  if (novels.length === 0) {
    return (
      <div className="text-center py-16 px-4">
        <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">No novels found</h3>
        <p className="mt-2 text-gray-600 dark:text-gray-400">Check back soon for curated novels!</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5 md:gap-6 lg:gap-8">
      {novels.map((novel) => (
        <NovelCard key={novel.id} novel={novel} onViewDetails={onViewDetails} />
      ))}
    </div>
  );
}

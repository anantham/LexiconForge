import type { NovelEntry } from '../../types/novel';
import occasion from '../../public/comics/the-occasion/metadata.json';

// Only curated, same-site readers are link targets. Remote registry metadata
// cannot supply executable URLs or turn a prose book into a different reader.
const illustratedBooks = [occasion];

export function getIllustratedBook(id: string) {
  return illustratedBooks.find(book => book.id === id);
}

export const ILLUSTRATED_BOOK_ENTRIES: NovelEntry[] = illustratedBooks.map(book => ({
  id: book.id,
  title: book.title,
  metadata: {
    originalLanguage: 'English',
    chapterCount: book.pageCount,
    genres: ['Comic', 'Speculative fiction'],
    description: book.description,
    coverImageUrl: book.coverImageUrl,
    lastUpdated: book.lastUpdated,
  },
}));

import { SettingsOps } from './db/operations';
import type { EnhancedChapter } from './stableIdService';
import { buildLibraryBookshelfKey } from './libraryScope';

export const BOOKSHELF_STATE_KEY = 'bookshelf-state';

export interface BookshelfEntry {
  novelId: string;
  versionId?: string;
  lastChapterId: string;
  lastChapterNumber?: number;
  lastReadAtIso: string;
}

export type BookshelfState = Record<string, BookshelfEntry>;

const normalizeBookshelfState = (value: unknown): BookshelfState => {
  if (!value || typeof value !== 'object') {
    return {};
  }

  return Object.entries(value as Record<string, unknown>).reduce<BookshelfState>((acc, [scopeKey, rawEntry]) => {
    if (!rawEntry || typeof rawEntry !== 'object') {
      return acc;
    }

    const entry = rawEntry as Partial<BookshelfEntry>;
    if (!entry.lastChapterId || !entry.lastReadAtIso) {
      return acc;
    }

    const novelId = typeof entry.novelId === 'string' ? entry.novelId : scopeKey;

    acc[scopeKey] = {
      novelId,
      lastChapterId: entry.lastChapterId,
      lastReadAtIso: entry.lastReadAtIso,
      ...(entry.versionId ? { versionId: entry.versionId } : {}),
      ...(typeof entry.lastChapterNumber === 'number'
        ? { lastChapterNumber: entry.lastChapterNumber }
        : {}),
    };
    return acc;
  }, {});
};

export class BookshelfStateService {
  static getEntryKey(novelId: string, versionId?: string | null): string {
    return buildLibraryBookshelfKey(novelId, versionId);
  }

  static async getState(): Promise<BookshelfState> {
    const raw = await SettingsOps.getKey<BookshelfState>(BOOKSHELF_STATE_KEY);
    return normalizeBookshelfState(raw);
  }

  static async getEntry(novelId: string, versionId?: string | null): Promise<BookshelfEntry | null> {
    const state = await this.getState();
    const scopedKey = this.getEntryKey(novelId, versionId);
    if (state[scopedKey]) {
      return state[scopedKey];
    }

    if (versionId) {
      return null;
    }

    return state[novelId] ?? null;
  }

  static async upsertEntry(entry: BookshelfEntry): Promise<BookshelfEntry> {
    const state = await this.getState();
    const scopedKey = this.getEntryKey(entry.novelId, entry.versionId);
    const nextState: BookshelfState = {
      ...state,
      [scopedKey]: entry,
    };
    await SettingsOps.set(BOOKSHELF_STATE_KEY, nextState);
    return entry;
  }

  static async listEntries(): Promise<BookshelfEntry[]> {
    const state = await this.getState();
    return Object.values(state).sort((a, b) => {
      return b.lastReadAtIso.localeCompare(a.lastReadAtIso);
    });
  }

  static resolveResumeChapterId(
    entry: BookshelfEntry | null,
    chapters: Map<string, EnhancedChapter>,
    fallbackChapterId: string | null
  ): string | null {
    if (!entry) {
      return fallbackChapterId;
    }

    if (chapters.has(entry.lastChapterId)) {
      return entry.lastChapterId;
    }

    if (typeof entry.lastChapterNumber === 'number') {
      const matched = Array.from(chapters.values()).find((chapter) => {
        return chapter.chapterNumber === entry.lastChapterNumber;
      });
      if (matched) {
        return matched.id;
      }
    }

    return fallbackChapterId;
  }
}

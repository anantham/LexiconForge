import React, { useEffect, useMemo, useState } from 'react';
import { ChevronRight, ChevronsDownUp, ChevronsUpDown, Play, Loader2, BookOpen } from 'lucide-react';
import {
  buildSectionTree,
  type ChapterIndexItem,
  type GroupLabeler,
  type SectionGroup,
} from '../../services/library/sectionGrouping';
import { fetchChapterIndex } from '../../services/library/chapterIndexService';

const SERIF = "'Cardo', 'Gentium Plus', 'Noto Serif', serif";

/**
 * Gītā-specific display sugar: adhyāya names aren't in the per-verse data, so
 * this 18-entry table supplies them. Anything outside 1–18 (or a future
 * non-Gītā grouped novel) falls back to a plain "Chapter N" label, so the tree
 * still renders correctly without this table.
 */
const GITA_CHAPTER_NAMES: Record<number, { sa: string; en: string }> = {
  1: { sa: 'Arjuna Viṣāda Yoga', en: "Arjuna's Despair" },
  2: { sa: 'Sāṅkhya Yoga', en: 'The Yoga of Knowledge' },
  3: { sa: 'Karma Yoga', en: 'The Yoga of Action' },
  4: { sa: 'Jñāna Karma Sannyāsa Yoga', en: 'Knowledge & the Renunciation of Action' },
  5: { sa: 'Karma Sannyāsa Yoga', en: 'The Yoga of Renunciation' },
  6: { sa: 'Dhyāna Yoga', en: 'The Yoga of Meditation' },
  7: { sa: 'Jñāna Vijñāna Yoga', en: 'Knowledge & Realization' },
  8: { sa: 'Akṣara Brahma Yoga', en: 'The Imperishable Absolute' },
  9: { sa: 'Rāja Vidyā Rāja Guhya Yoga', en: 'The Royal Knowledge & Secret' },
  10: { sa: 'Vibhūti Yoga', en: 'Divine Glories' },
  11: { sa: 'Viśvarūpa Darśana Yoga', en: 'The Vision of the Cosmic Form' },
  12: { sa: 'Bhakti Yoga', en: 'The Yoga of Devotion' },
  13: { sa: 'Kṣetra Kṣetrajña Vibhāga Yoga', en: 'The Field & its Knower' },
  14: { sa: 'Guṇatraya Vibhāga Yoga', en: 'The Three Guṇas' },
  15: { sa: 'Puruṣottama Yoga', en: 'The Supreme Person' },
  16: { sa: 'Daivāsura Sampad Vibhāga Yoga', en: 'Divine & Demoniac Natures' },
  17: { sa: 'Śraddhātraya Vibhāga Yoga', en: 'The Threefold Faith' },
  18: { sa: 'Mokṣa Sannyāsa Yoga', en: 'Liberation & Renunciation' },
};

const gitaLabeler: GroupLabeler = (group) => {
  const name = GITA_CHAPTER_NAMES[group];
  const shortLabel = `Chapter ${group}`;
  return {
    shortLabel,
    label: name ? `${shortLabel} · ${name.sa}` : shortLabel,
  };
};

export interface SectionTreePickerProps {
  /** Flat chapter list; the tree is derived from chapterNumber encoding. */
  chapters: ChapterIndexItem[];
  /** Open the reader at a specific verse (encoded chapterNumber, e.g. 2047). */
  onSelectVerse: (chapterNumber: number) => void;
  /** Groups to expand on first render (defaults to none — collapsed). */
  defaultExpandedGroups?: number[];
}

/**
 * Nested collapsible picker: top-level groups (Gītā chapters) expand to their
 * verses. Collapsed by default; a group's verse rows mount only while the group
 * is expanded, so a 700-verse novel stays cheap until the reader drills in.
 */
export function SectionTreePicker({ chapters, onSelectVerse, defaultExpandedGroups }: SectionTreePickerProps) {
  const groups = useMemo(() => buildSectionTree(chapters, gitaLabeler), [chapters]);

  const [expanded, setExpanded] = useState<Set<number>>(() => new Set(defaultExpandedGroups ?? []));

  const allExpanded = groups.length > 0 && expanded.size === groups.length;

  const toggleGroup = (group: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  };

  const expandAll = () => setExpanded(new Set(groups.map((g) => g.group)));
  const collapseAll = () => setExpanded(new Set());

  if (groups.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Chapters &amp; Verses
        </h3>
        <button
          type="button"
          onClick={allExpanded ? collapseAll : expandAll}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 rounded px-2 py-1 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors motion-reduce:transition-none"
          aria-label={allExpanded ? 'Collapse all chapters' : 'Expand all chapters'}
        >
          {allExpanded ? <ChevronsDownUp className="h-3.5 w-3.5" /> : <ChevronsUpDown className="h-3.5 w-3.5" />}
          {allExpanded ? 'Collapse all' : 'Expand all'}
        </button>
      </div>

      <ul className="rounded-lg border border-gray-200 dark:border-gray-700 divide-y divide-gray-200 dark:divide-gray-700 overflow-hidden">
        {groups.map((group) => (
          <GroupRow
            key={group.group}
            group={group}
            isExpanded={expanded.has(group.group)}
            onToggle={() => toggleGroup(group.group)}
            onSelectVerse={onSelectVerse}
          />
        ))}
      </ul>
    </div>
  );
}

interface GroupRowProps {
  group: SectionGroup;
  isExpanded: boolean;
  onToggle: () => void;
  onSelectVerse: (chapterNumber: number) => void;
}

const GroupRow: React.FC<GroupRowProps> = ({ group, isExpanded, onToggle, onSelectVerse }) => {
  const panelId = `section-group-${group.group}`;
  const englishName = GITA_CHAPTER_NAMES[group.group]?.en;
  const firstVerse = group.verses[0];
  const lastVerse = group.verses[group.verses.length - 1];
  const range =
    firstVerse && lastVerse
      ? firstVerse.ref === lastVerse.ref
        ? firstVerse.ref
        : `${firstVerse.ref}–${lastVerse.ref}`
      : '';

  return (
    <li className="bg-white dark:bg-gray-900">
      {/* Header: a flex row of two sibling buttons (never nested) —
          the disclosure toggle and a compact "open first verse" control. */}
      <div className="flex items-stretch">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={isExpanded}
          aria-controls={panelId}
          className="group flex flex-1 items-center gap-3 px-4 py-3 text-left hover:bg-amber-50/60 dark:hover:bg-amber-900/10 transition-colors motion-reduce:transition-none focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-500"
        >
          <ChevronRight
            className={`h-4 w-4 flex-shrink-0 text-gray-400 dark:text-gray-500 transition-transform motion-reduce:transition-none ${
              isExpanded ? 'rotate-90' : ''
            }`}
            aria-hidden="true"
          />
          <span className="flex-1 min-w-0">
            <span className="flex items-baseline gap-2">
              <span className="font-semibold text-sm text-gray-900 dark:text-gray-100">
                {group.shortLabel}
              </span>
              {GITA_CHAPTER_NAMES[group.group] && (
                <span
                  className="truncate text-sm text-amber-700 dark:text-amber-400"
                  style={{ fontFamily: SERIF }}
                >
                  {GITA_CHAPTER_NAMES[group.group].sa}
                </span>
              )}
            </span>
            {englishName && (
              <span className="block truncate text-xs text-gray-500 dark:text-gray-400 italic" style={{ fontFamily: SERIF }}>
                {englishName}
              </span>
            )}
          </span>
          <span className="flex-shrink-0 text-right text-xs font-medium text-gray-400 dark:text-gray-500 tabular-nums">
            <span className="block">
              {group.verses.length} {group.verses.length === 1 ? 'verse' : 'verses'}
            </span>
            {range && (
              <span className="hidden sm:block text-gray-300 dark:text-gray-600" style={{ fontFamily: SERIF }}>
                {range}
              </span>
            )}
          </span>
        </button>

        {firstVerse && (
          <button
            type="button"
            onClick={() => onSelectVerse(firstVerse.chapterNumber)}
            title={`Read ${group.shortLabel} from ${firstVerse.ref}`}
            aria-label={`Read from verse ${firstVerse.ref}`}
            className="flex-shrink-0 flex items-center px-3 text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors motion-reduce:transition-none focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500"
          >
            <Play className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Verse list mounts only while expanded — lazy per-group render. */}
      {isExpanded && (
        <ul
          id={panelId}
          className="bg-gray-50 dark:bg-gray-950/40 border-t border-gray-100 dark:border-gray-800 pl-10 pr-2 py-2 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1"
        >
          {group.verses.map((verse) => (
            <li key={verse.chapterNumber}>
              <button
                type="button"
                onClick={() => onSelectVerse(verse.chapterNumber)}
                title={verse.title ? `${verse.ref} — ${verse.title}` : `Read ${verse.ref}`}
                className="w-full flex items-baseline gap-1.5 rounded px-2.5 py-1.5 text-left hover:bg-amber-100/70 dark:hover:bg-amber-900/25 transition-colors motion-reduce:transition-none focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-500"
              >
                <span
                  className="text-sm text-gray-800 dark:text-gray-200 tabular-nums"
                  style={{ fontFamily: SERIF }}
                >
                  {verse.ref}
                </span>
                {verse.title && (
                  <span className="truncate text-xs text-gray-500 dark:text-gray-400">
                    {verse.title}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
};

export interface GroupedChapterPickerProps {
  /** Session URL to lazily fetch the chapter index from. */
  sessionJsonUrl: string;
  /** Open the reader at a specific verse (encoded chapterNumber). */
  onSelectVerse: (chapterNumber: number) => void;
}

/**
 * Loader wrapper for the modal: fetches the lightweight chapter index from the
 * version's session.json on mount, caches it (see chapterIndexService), and
 * renders the pure SectionTreePicker. Handles loading / error / empty states.
 */
export function GroupedChapterPicker({ sessionJsonUrl, onSelectVerse }: GroupedChapterPickerProps) {
  const [chapters, setChapters] = useState<ChapterIndexItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setChapters(null);
    setError(null);

    fetchChapterIndex(sessionJsonUrl)
      .then((items) => {
        if (!cancelled) setChapters(items);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      });

    return () => {
      cancelled = true;
    };
  }, [sessionJsonUrl]);

  if (error) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
        <BookOpen className="h-4 w-4 flex-shrink-0" />
        <span>Couldn&apos;t load the verse list ({error}). Use “Start Reading” to open at the beginning.</span>
      </div>
    );
  }

  if (chapters === null) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
        <Loader2 className="h-4 w-4 animate-spin motion-reduce:hidden" />
        <span>Loading verses…</span>
      </div>
    );
  }

  return <SectionTreePicker chapters={chapters} onSelectVerse={onSelectVerse} />;
}

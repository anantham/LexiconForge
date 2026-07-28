/**
 * Section grouping for "grouped" novels (e.g. the Bhagavad Gītā: 700 verses
 * across 18 adhyāyas). Pure, dependency-free logic so it is trivially unit-
 * testable and re-usable by the library detail modal's nested section picker.
 *
 * GROUPING CONVENTION (agreed with the content build): a groupable novel
 * encodes `chapterNumber = groupNumber * 1000 + itemNumber`. So chapterNumber
 * 2047 = group 2 (Gītā chapter 2), item 47 (verse 47), displayed as "2.47".
 *
 * A novel/version is "groupable" when its chapters all carry chapterNumber
 * >= 1000 AND the set spans more than one distinct Math.floor(n / 1000) group.
 * A single-section slice (e.g. just chapter 2, 2050–2072) is NOT groupable —
 * the existing flat "Start Reading" behaviour is kept for those, and for every
 * ordinary novel (Aithihyamala, etc.) whose chapters number 1, 2, 3, …
 */

export interface ChapterIndexItem {
  /** The encoded chapter number, e.g. 2047 for Gītā 2.47. */
  chapterNumber: number;
  /** Human title from the session, if any (e.g. "2.47" or a verse incipit). */
  title?: string;
  /** Optional stable id / canonical url, threaded through when known. */
  id?: string;
}

export interface SectionVerse {
  /** The encoded chapter number to open (e.g. 2047). */
  chapterNumber: number;
  /** The item within the group (e.g. 47). */
  item: number;
  /** Canonical "group.item" reference, e.g. "2.47". */
  ref: string;
  /** Display title from the session if it adds information beyond `ref`. */
  title?: string;
  id?: string;
}

export interface SectionGroup {
  /** The group number, e.g. 2. */
  group: number;
  /** Full label, e.g. "Chapter 2 · Sāṅkhya Yoga". */
  label: string;
  /** Short label, e.g. "Chapter 2". */
  shortLabel: string;
  verses: SectionVerse[];
}

const GROUP_BASE = 1000;

/**
 * 2047 -> { group: 2, item: 47 }. Defensive against non-finite input.
 */
export function parseGroupedChapterNumber(chapterNumber: number): { group: number; item: number } {
  if (!Number.isFinite(chapterNumber)) {
    return { group: 0, item: 0 };
  }
  const group = Math.floor(chapterNumber / GROUP_BASE);
  const item = chapterNumber - group * GROUP_BASE;
  return { group, item };
}

/**
 * Groupability from the actual chapter set: every chapter >= 1000 AND the set
 * spans more than one distinct group. Empty/absent sets are not groupable.
 */
export function isGroupableChapters(chapters: Array<{ chapterNumber?: number | null }>): boolean {
  const nums = chapters
    .map((c) => c.chapterNumber)
    .filter((n): n is number => typeof n === 'number' && Number.isFinite(n));

  if (nums.length === 0) return false;
  if (!nums.every((n) => n >= GROUP_BASE)) return false;

  const groups = new Set(nums.map((n) => Math.floor(n / GROUP_BASE)));
  return groups.size > 1;
}

/**
 * Cheap groupability probe from a version's `chapterRange` alone — no chapter
 * list needed. Because `from` is the minimum chapter number and `to` the
 * maximum, `from >= 1000` implies every chapter is >= 1000, and differing
 * Math.floor(·/1000) endpoints imply the set spans multiple groups. This lets
 * the modal decide whether to render the nested tree using only the metadata
 * it already holds, deferring the (potentially heavier) chapter-index fetch to
 * the groupable case.
 */
export function isGroupableRange(range: { from?: number | null; to?: number | null } | null | undefined): boolean {
  if (!range) return false;
  const { from, to } = range;
  if (typeof from !== 'number' || typeof to !== 'number') return false;
  if (!Number.isFinite(from) || !Number.isFinite(to)) return false;
  if (from < GROUP_BASE) return false;
  return Math.floor(from / GROUP_BASE) !== Math.floor(to / GROUP_BASE);
}

export type GroupLabeler = (group: number, verseCount: number) => { label: string; shortLabel: string };

const defaultGroupLabeler: GroupLabeler = (group) => ({
  label: `Chapter ${group}`,
  shortLabel: `Chapter ${group}`,
});

/**
 * Group a flat chapter list into an ascending tree of groups → verses. Verses
 * within a group are sorted by item number; groups by group number. A per-verse
 * title equal to the canonical "group.item" ref is dropped (it carries no extra
 * information over the ref the row already shows).
 */
export function buildSectionTree(
  chapters: ChapterIndexItem[],
  groupLabelFor: GroupLabeler = defaultGroupLabeler,
): SectionGroup[] {
  const byGroup = new Map<number, SectionVerse[]>();

  for (const ch of chapters) {
    if (typeof ch.chapterNumber !== 'number' || !Number.isFinite(ch.chapterNumber)) continue;
    const { group, item } = parseGroupedChapterNumber(ch.chapterNumber);
    const ref = `${group}.${item}`;
    const trimmedTitle = ch.title?.trim();
    const verse: SectionVerse = {
      chapterNumber: ch.chapterNumber,
      item,
      ref,
      ...(trimmedTitle && trimmedTitle !== ref ? { title: trimmedTitle } : {}),
      ...(ch.id ? { id: ch.id } : {}),
    };
    const bucket = byGroup.get(group);
    if (bucket) bucket.push(verse);
    else byGroup.set(group, [verse]);
  }

  return Array.from(byGroup.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([group, verses]) => {
      verses.sort((a, b) => a.item - b.item);
      const { label, shortLabel } = groupLabelFor(group, verses.length);
      return { group, label, shortLabel, verses };
    });
}

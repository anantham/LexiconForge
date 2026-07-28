/**
 * Section grouping for "grouped" novels (e.g. the Bhagavad Gītā: 700 verses
 * across 18 adhyāyas). Pure, dependency-free logic so it is trivially unit-
 * testable and re-usable by the library detail modal's nested section picker.
 *
 * GROUPING CONVENTION (agreed with the content build): a grouped novel encodes
 * `chapterNumber = groupNumber * 1000 + itemNumber`. So chapterNumber 2047 =
 * group 2 (Gītā chapter 2), item 47 (verse 47), displayed as "2.47".
 *
 * DETECTION is by an EXPLICIT metadata marker (`metadata.grouping.scheme ===
 * 'chapter-verse'`), NOT inferred from chapter numbering — a long web novel
 * numbered 1001, 1002, … must render flat unless it opts in. `isGroupableChapters`
 * below is a secondary safety assert on the fetched chapter shape, not the gate.
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

/** The only grouping scheme currently supported: chapterNumber = group*1000 + item. */
export const CHAPTER_VERSE_SCHEME = 'chapter-verse';

/**
 * PRIMARY detection gate: is this novel explicitly marked as chapter-verse
 * grouped? Driven by the metadata marker, never inferred from chapter numbers,
 * so a plain web novel numbered 1001+ stays flat. Accepts a structural shape so
 * this module stays dependency-free (the concrete type is `NovelGrouping`).
 */
export function isChapterVerseGrouping(
  grouping: { scheme?: string } | null | undefined,
): boolean {
  return grouping?.scheme === CHAPTER_VERSE_SCHEME;
}

/**
 * SECONDARY safety assert on the actual (fetched) chapter set: every chapter
 * >= 1000 AND the set spans more than one distinct group. Used to guard against
 * a mis-marked novel producing a garbage tree — it does NOT decide grouping on
 * its own (that is the metadata marker's job). Empty/absent sets fail it.
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

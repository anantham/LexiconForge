import type { SourceChapterRange, TranslationSourceChapter } from './translation-source-types';
import type {
  AlignmentEvidence,
  AlignmentMap,
  AlignmentSegment,
  AlignmentVerifier,
  ChapterProbe,
  DiscoveryContext,
  DiscoveryOptions,
} from './chapter-alignment-types';

const DEFAULT_CHECKPOINT_SIZE = 64;
const DEFAULT_SEARCH_WINDOW = 6;
const DEFAULT_MIN_CONFIDENCE = 0.8;
const EXCERPT_LENGTH = 450;

interface IndexedFanSource {
  exact: Map<number, TranslationSourceChapter>;
  merged: TranslationSourceChapter[];
}

interface CandidateMatch {
  kind: 'exact' | 'merged';
  english: TranslationSourceChapter;
  offset: number;
  rawRange: SourceChapterRange;
  judgment: Awaited<ReturnType<AlignmentVerifier['verify']>>;
}

const sourceChapterText = (chapter: TranslationSourceChapter): string => chapter.paragraphs
  .map((paragraph) => paragraph.text)
  .filter(Boolean)
  .join('\n\n');

const toProbe = (chapter: TranslationSourceChapter): ChapterProbe => ({
  chapterNumber: chapter.chapterNumber,
  title: chapter.title,
  excerpt: sourceChapterText(chapter).replace(/\s+/g, ' ').slice(0, EXCERPT_LENGTH),
});

const indexFanChapters = (chapters: TranslationSourceChapter[]): IndexedFanSource => {
  const exact = new Map<number, TranslationSourceChapter>();
  const merged: TranslationSourceChapter[] = [];

  for (const chapter of chapters) {
    const range = chapter.chapterRange;
    const isMerged = Boolean(range && range.to !== range.from);
    if (isMerged) {
      merged.push(chapter);
    } else {
      exact.set(chapter.chapterNumber, chapter);
    }
  }

  return { exact, merged };
};

const includesRaw = (range: SourceChapterRange, chapterNumber: number): boolean => (
  chapterNumber >= range.from && chapterNumber <= range.to
);

const buildEvidence = (
  rawChapterNumber: number,
  englishChapterNumber: number,
  judgment: CandidateMatch['judgment']
): AlignmentEvidence => ({
  rawChapterNumber,
  englishChapterNumber,
  confidence: judgment.confidence,
  rationale: judgment.rationale,
});

const verifyExactAtOffset = async (
  rawChapter: TranslationSourceChapter,
  expectedOffset: number,
  indexedFan: IndexedFanSource,
  verifier: AlignmentVerifier
): Promise<CandidateMatch | null> => {
  const englishChapterNumber = rawChapter.chapterNumber + expectedOffset;
  const englishChapter = indexedFan.exact.get(englishChapterNumber);
  if (!englishChapter) {
    return null;
  }

  const judgment = await verifier.verify(toProbe(rawChapter), toProbe(englishChapter));
  if (judgment.relation !== 'same') {
    return null;
  }

  return {
    kind: 'exact',
    english: englishChapter,
    offset: englishChapter.chapterNumber - rawChapter.chapterNumber,
    rawRange: { from: rawChapter.chapterNumber, to: rawChapter.chapterNumber },
    judgment,
  };
};

const findBestLocalCandidate = async (
  rawChapter: TranslationSourceChapter,
  currentOffset: number,
  indexedFan: IndexedFanSource,
  verifier: AlignmentVerifier,
  options: DiscoveryOptions
): Promise<CandidateMatch | null> => {
  const window = options.searchWindow ?? DEFAULT_SEARCH_WINDOW;
  const minConfidence = options.minConfidence ?? DEFAULT_MIN_CONFIDENCE;
  const expectedEnglish = rawChapter.chapterNumber + currentOffset;
  const candidates: TranslationSourceChapter[] = [];
  const seen = new Set<string>();

  for (let delta = -window; delta <= window; delta++) {
    const exact = indexedFan.exact.get(expectedEnglish + delta);
    if (exact) {
      const key = `exact:${exact.chapterNumber}`;
      if (!seen.has(key)) {
        candidates.push(exact);
        seen.add(key);
      }
    }
  }

  for (const merged of indexedFan.merged) {
    const range = merged.chapterRange!;
    if (range.to < expectedEnglish - window || range.from > expectedEnglish + window) {
      continue;
    }
    const key = `merged:${range.from}-${range.to}`;
    if (!seen.has(key)) {
      candidates.push(merged);
      seen.add(key);
    }
  }

  let best: CandidateMatch | null = null;
  for (const englishChapter of candidates) {
    const judgment = await verifier.verify(toProbe(rawChapter), toProbe(englishChapter));
    if (judgment.relation !== 'same' || judgment.confidence < minConfidence) {
      continue;
    }

    const englishRange = englishChapter.chapterRange || {
      from: englishChapter.chapterNumber,
      to: englishChapter.chapterNumber,
    };
    const rawRange = englishRange.to === englishRange.from
      ? { from: rawChapter.chapterNumber, to: rawChapter.chapterNumber }
      : {
          from: rawChapter.chapterNumber,
          to: rawChapter.chapterNumber + (englishRange.to - englishRange.from),
        };

    const candidate: CandidateMatch = {
      kind: englishRange.to === englishRange.from ? 'exact' : 'merged',
      english: englishChapter,
      offset: englishRange.from - rawRange.from,
      rawRange,
      judgment,
    };

    if (!best || candidate.judgment.confidence > best.judgment.confidence) {
      best = candidate;
    }
  }

  return best;
};

const binarySearchFirstMismatch = async (
  rawByNumber: Map<number, TranslationSourceChapter>,
  startChapter: number,
  endChapter: number,
  expectedOffset: number,
  indexedFan: IndexedFanSource,
  verifier: AlignmentVerifier
): Promise<number> => {
  let low = startChapter;
  let high = endChapter;

  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    const rawChapter = rawByNumber.get(mid);
    if (!rawChapter) {
      low = mid + 1;
      continue;
    }

    const match = await verifyExactAtOffset(rawChapter, expectedOffset, indexedFan, verifier);
    if (match) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }

  return low;
};

export const discoverAlignmentMap = async (
  context: DiscoveryContext,
  verifier: AlignmentVerifier,
  options: DiscoveryOptions
): Promise<AlignmentMap> => {
  const rawByNumber = new Map(context.rawChapters.map((chapter) => [chapter.chapterNumber, chapter]));
  const indexedFan = indexFanChapters(context.fanChapters);
  const startChapter = options.startChapter;
  const endChapter = options.endChapter;
  const checkpointSize = options.checkpointSize ?? DEFAULT_CHECKPOINT_SIZE;
  let currentOffset = options.initialOffset ?? 0;
  let cursor = startChapter;
  let segmentStart = startChapter;
  const segments: AlignmentSegment[] = [];

  while (cursor <= endChapter) {
    const checkpoint = Math.min(endChapter, cursor + checkpointSize - 1);
    const checkpointRaw = rawByNumber.get(checkpoint);
    if (!checkpointRaw) {
      cursor = checkpoint + 1;
      continue;
    }

    const checkpointMatch = await verifyExactAtOffset(checkpointRaw, currentOffset, indexedFan, verifier);
    if (checkpointMatch) {
      cursor = checkpoint + 1;
      continue;
    }

    const mismatchChapter = await binarySearchFirstMismatch(
      rawByNumber,
      cursor,
      checkpoint,
      currentOffset,
      indexedFan,
      verifier
    );

    if (mismatchChapter > segmentStart) {
      segments.push({
        kind: 'one_to_one',
        raw: { from: segmentStart, to: mismatchChapter - 1 },
        english: {
          from: segmentStart + currentOffset,
          to: mismatchChapter - 1 + currentOffset,
        },
        offset: currentOffset,
        confidence: 0.99,
        evidence: [],
      });
    }

    const rawMismatch = rawByNumber.get(mismatchChapter);
    if (!rawMismatch) {
      cursor = mismatchChapter + 1;
      segmentStart = cursor;
      continue;
    }

    const remap = await findBestLocalCandidate(rawMismatch, currentOffset, indexedFan, verifier, options);
    if (!remap) {
      segments.push({
        kind: 'unresolved',
        raw: { from: mismatchChapter, to: mismatchChapter },
        confidence: 0,
        evidence: [],
        notes: [`No verified English match found within search window for raw chapter ${mismatchChapter}.`],
      });
      cursor = mismatchChapter + 1;
      segmentStart = cursor;
      continue;
    }

    if (remap.kind === 'merged') {
      segments.push({
        kind: 'english_merged',
        raw: remap.rawRange,
        english: remap.english.chapterRange || {
          from: remap.english.chapterNumber,
          to: remap.english.chapterNumber,
        },
        offset: remap.offset,
        confidence: remap.judgment.confidence,
        evidence: [buildEvidence(mismatchChapter, remap.english.chapterNumber, remap.judgment)],
        notes: [`English source chapter ${remap.english.title} covers multiple raw chapters.`],
      });
      currentOffset = remap.offset;
      cursor = remap.rawRange.to + 1;
      segmentStart = cursor;
      continue;
    }

    currentOffset = remap.offset;
    cursor = mismatchChapter;
    segmentStart = mismatchChapter;
  }

  if (segmentStart <= endChapter) {
    segments.push({
      kind: 'one_to_one',
      raw: { from: segmentStart, to: endChapter },
      english: {
        from: segmentStart + currentOffset,
        to: endChapter + currentOffset,
      },
      offset: currentOffset,
      confidence: 0.99,
      evidence: [],
    });
  }

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    rawSourcePath: context.rawSourcePath,
    fanSourcePath: context.fanSourcePath,
    verifier: {
      kind: verifier.kind,
      ...(verifier.model ? { model: verifier.model } : {}),
    },
    segments,
  };
};

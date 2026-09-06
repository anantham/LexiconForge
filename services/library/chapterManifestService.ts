import type {
  ChapterArtifactReference,
  ChapterManifestContext,
  ChapterPublicationManifest,
  PublishedChapterIdentity,
} from '../../types/chapterManifest';

export class ChapterManifestIntegrityError extends Error {
  constructor(message: string) {
    super(`Chapter publication manifest integrity error: ${message}`);
    this.name = 'ChapterManifestIntegrityError';
  }
}

const fail = (message: string): never => {
  throw new ChapterManifestIntegrityError(message);
};

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const requireString = (value: unknown, field: string): string => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return fail(`${field} must be a non-empty string.`);
  }
  return value;
};

const requirePositiveInteger = (value: unknown, field: string): number => {
  if (!Number.isSafeInteger(value) || (value as number) <= 0) {
    return fail(`${field} must be a positive safe integer.`);
  }
  return value as number;
};

const validateArtifactReference = (
  value: unknown,
  field: string
): ChapterArtifactReference => {
  if (!isRecord(value)) {
    return fail(`${field} must be an object.`);
  }

  const sha256 = requireString(value.sha256, `${field}.sha256`);
  if (!/^[a-f0-9]{64}$/.test(sha256)) {
    return fail(`${field}.sha256 must be a lowercase 64-character SHA-256 digest.`);
  }

  return {
    url: requireString(value.url, `${field}.url`),
    sha256,
    byteLength: requirePositiveInteger(value.byteLength, `${field}.byteLength`),
  };
};

const validateChapterIdentity = (
  value: unknown,
  index: number
): PublishedChapterIdentity => {
  const field = `chapters[${index}]`;
  if (!isRecord(value)) {
    return fail(`${field} must be an object.`);
  }

  return {
    chapterNumber: requirePositiveInteger(value.chapterNumber, `${field}.chapterNumber`),
    stableId: requireString(value.stableId, `${field}.stableId`),
    canonicalUrl: requireString(value.canonicalUrl, `${field}.canonicalUrl`),
    ...(value.artifact === undefined
      ? {}
      : { artifact: validateArtifactReference(value.artifact, `${field}.artifact`) }),
  };
};

export const validateChapterManifest = (
  value: unknown,
  context: ChapterManifestContext = {}
): ChapterPublicationManifest => {
  if (!isRecord(value)) {
    return fail('document must be an object.');
  }
  if (value.format !== 'lexiconforge-chapter-manifest') {
    return fail(`format must be "lexiconforge-chapter-manifest"; received ${JSON.stringify(value.format)}.`);
  }
  if (value.version !== '1.0') {
    return fail(`version must be "1.0"; received ${JSON.stringify(value.version)}.`);
  }

  const novelId = requireString(value.novelId, 'novelId');
  const versionId = requireString(value.versionId, 'versionId');
  if (context.novelId && novelId !== context.novelId) {
    return fail(`expected novelId "${context.novelId}", received "${novelId}".`);
  }
  if (context.versionId && versionId !== context.versionId) {
    return fail(`expected versionId "${context.versionId}", received "${versionId}".`);
  }

  const generatedAt = requireString(value.generatedAt, 'generatedAt');
  if (Number.isNaN(Date.parse(generatedAt))) {
    return fail('generatedAt must be a valid date-time string.');
  }

  const expectedChapterCount = requirePositiveInteger(
    value.expectedChapterCount,
    'expectedChapterCount'
  );
  const publishedChapterCount = requirePositiveInteger(
    value.publishedChapterCount,
    'publishedChapterCount'
  );
  if (!Array.isArray(value.chapters)) {
    return fail('chapters must be an array.');
  }
  if (publishedChapterCount !== value.chapters.length) {
    return fail(
      `publishedChapterCount declares ${publishedChapterCount}, but chapters contains ${value.chapters.length} identities.`
    );
  }
  if (publishedChapterCount > expectedChapterCount) {
    return fail(
      `publishedChapterCount ${publishedChapterCount} exceeds expectedChapterCount ${expectedChapterCount}.`
    );
  }

  const chapters = value.chapters.map(validateChapterIdentity);
  const chapterNumbers = new Set<number>();
  const stableIds = new Set<string>();
  let previousChapterNumber = 0;
  for (const chapter of chapters) {
    if (chapterNumbers.has(chapter.chapterNumber)) {
      return fail(`duplicate chapter number ${chapter.chapterNumber}.`);
    }
    if (stableIds.has(chapter.stableId)) {
      return fail(`duplicate stable ID "${chapter.stableId}".`);
    }
    if (chapter.chapterNumber <= previousChapterNumber) {
      return fail(
        `chapters must be strictly ordered by chapterNumber; ${chapter.chapterNumber} follows ${previousChapterNumber}.`
      );
    }
    chapterNumbers.add(chapter.chapterNumber);
    stableIds.add(chapter.stableId);
    previousChapterNumber = chapter.chapterNumber;
  }

  const session = validateArtifactReference(value.session, 'session');
  if (context.sessionUrl && session.url !== context.sessionUrl) {
    return fail(`expected session URL "${context.sessionUrl}", received "${session.url}".`);
  }
  if (
    context.expectedChapterCount !== undefined &&
    expectedChapterCount !== context.expectedChapterCount
  ) {
    return fail(
      `expectedChapterCount ${expectedChapterCount} does not match metadata chapterCount ${context.expectedChapterCount}.`
    );
  }
  if (
    context.publishedChapterCount !== undefined &&
    publishedChapterCount !== context.publishedChapterCount
  ) {
    return fail(
      `publishedChapterCount ${publishedChapterCount} does not match metadata raw-chapter count ${context.publishedChapterCount}.`
    );
  }
  if (context.chapterRange) {
    const first = chapters[0]?.chapterNumber;
    const last = chapters[chapters.length - 1]?.chapterNumber;
    if (context.chapterRange.from !== first || context.chapterRange.to !== last) {
      return fail(
        `metadata chapterRange ${context.chapterRange.from}-${context.chapterRange.to} does not match manifest endpoints ${first}-${last}.`
      );
    }
  }
  if (
    context.completionStatus === 'Complete' &&
    publishedChapterCount !== expectedChapterCount
  ) {
    return fail(
      `version is Complete, but only ${publishedChapterCount} of ${expectedChapterCount} expected chapters are published.`
    );
  }

  return {
    format: 'lexiconforge-chapter-manifest',
    version: '1.0',
    novelId,
    versionId,
    generatedAt,
    expectedChapterCount,
    publishedChapterCount,
    session,
    chapters,
  };
};

export const fetchChapterManifest = async (
  url: string,
  context: ChapterManifestContext = {}
): Promise<ChapterPublicationManifest> => {
  let response: Response;
  try {
    response = await fetch(url);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new ChapterManifestIntegrityError(`failed to fetch ${url}: ${detail}`);
  }

  if (!response.ok) {
    throw new ChapterManifestIntegrityError(
      `failed to fetch ${url}: HTTP ${response.status} ${response.statusText}.`
    );
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new ChapterManifestIntegrityError(`failed to parse ${url}: ${detail}`);
  }

  return validateChapterManifest(payload, context);
};

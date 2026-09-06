import { createHash } from 'node:crypto';

import { validateChapterManifest } from '../../services/library/chapterManifestService';
import type { ChapterPublicationManifest } from '../../types/chapterManifest';
import type { NovelEntry, NovelVersion } from '../../types/novel';

interface PublicationChapter {
  chapterNumber: number;
  stableId: string;
  canonicalUrl: string;
}

interface PublicationSession {
  novel?: { id?: string };
  version?: { versionId?: string };
  chapters?: PublicationChapter[];
}

interface PublicationInputs {
  metadata: NovelEntry;
  session: PublicationSession;
  sessionJson: string;
}

interface CreatePublicationInputs extends PublicationInputs {
  generatedAt?: string;
}

interface ValidatePublicationInputs extends PublicationInputs {
  manifest: ChapterPublicationManifest;
}

const fail = (message: string): never => {
  throw new Error(`Library publication integrity error: ${message}`);
};

const sha256 = (value: string): string => createHash('sha256').update(value, 'utf8').digest('hex');

const resolveVersion = (
  metadata: NovelEntry,
  session: PublicationSession
): NovelVersion => {
  const sessionNovelId = session.novel?.id;
  if (!sessionNovelId || sessionNovelId !== metadata.id) {
    return fail(`metadata novelId "${metadata.id}" does not match session novelId "${sessionNovelId ?? ''}".`);
  }

  const sessionVersionId = session.version?.versionId;
  if (!sessionVersionId) {
    return fail('session.version.versionId is required.');
  }
  const version = metadata.versions?.find((candidate) => candidate.versionId === sessionVersionId);
  if (!version) {
    return fail(`metadata has no version matching session versionId "${sessionVersionId}".`);
  }
  return version;
};

const validateSessionIdentities = (
  session: PublicationSession
): PublicationChapter[] => {
  if (!Array.isArray(session.chapters) || session.chapters.length === 0) {
    return fail('session.chapters must contain at least one chapter.');
  }

  const chapterNumbers = new Set<number>();
  const stableIds = new Set<string>();
  let previousNumber = 0;
  for (const [index, chapter] of session.chapters.entries()) {
    if (!Number.isSafeInteger(chapter.chapterNumber) || chapter.chapterNumber <= 0) {
      return fail(`session.chapters[${index}].chapterNumber must be a positive safe integer.`);
    }
    if (typeof chapter.stableId !== 'string' || chapter.stableId.length === 0) {
      return fail(`session.chapters[${index}].stableId must be a non-empty string.`);
    }
    if (typeof chapter.canonicalUrl !== 'string' || chapter.canonicalUrl.length === 0) {
      return fail(`session.chapters[${index}].canonicalUrl must be a non-empty string.`);
    }
    if (chapterNumbers.has(chapter.chapterNumber)) {
      return fail(`duplicate chapter number ${chapter.chapterNumber} in session.`);
    }
    if (stableIds.has(chapter.stableId)) {
      return fail(`duplicate stable ID "${chapter.stableId}" in session.`);
    }
    if (chapter.chapterNumber <= previousNumber) {
      return fail(
        `session chapters must be strictly ordered by chapterNumber; ${chapter.chapterNumber} follows ${previousNumber}.`
      );
    }
    chapterNumbers.add(chapter.chapterNumber);
    stableIds.add(chapter.stableId);
    previousNumber = chapter.chapterNumber;
  }
  return session.chapters;
};

const validateMetadataCounts = (
  metadata: NovelEntry,
  version: NovelVersion,
  chapters: PublicationChapter[]
): void => {
  const expectedCount = metadata.metadata.chapterCount;
  if (!Number.isSafeInteger(expectedCount) || expectedCount <= 0) {
    return fail('metadata.metadata.chapterCount must be a positive safe integer.');
  }
  if (chapters.length > expectedCount) {
    return fail(`published chapter count ${chapters.length} exceeds expected work count ${expectedCount}.`);
  }

  const declaredPublished = version.stats?.content?.totalRawChapters;
  if (declaredPublished !== chapters.length) {
    return fail(
      `version stats declare ${declaredPublished} raw chapters, but session contains ${chapters.length}.`
    );
  }

  const first = chapters[0].chapterNumber;
  const last = chapters[chapters.length - 1].chapterNumber;
  if (version.chapterRange?.from !== first || version.chapterRange?.to !== last) {
    return fail(
      `version chapterRange ${version.chapterRange?.from}-${version.chapterRange?.to} does not match published endpoints ${first}-${last}.`
    );
  }
  if (version.completionStatus === 'Complete' && chapters.length !== expectedCount) {
    return fail(
      `version is Complete, but only ${chapters.length} of ${expectedCount} expected chapters are published.`
    );
  }
};

export const createPublicationManifest = ({
  metadata,
  session,
  sessionJson,
  generatedAt = new Date().toISOString(),
}: CreatePublicationInputs): ChapterPublicationManifest => {
  const version = resolveVersion(metadata, session);
  const chapters = validateSessionIdentities(session);
  validateMetadataCounts(metadata, version, chapters);

  const manifest: ChapterPublicationManifest = {
    format: 'lexiconforge-chapter-manifest',
    version: '1.0',
    novelId: metadata.id,
    versionId: version.versionId,
    generatedAt,
    expectedChapterCount: metadata.metadata.chapterCount,
    publishedChapterCount: chapters.length,
    session: {
      url: version.sessionJsonUrl,
      sha256: sha256(sessionJson),
      byteLength: Buffer.byteLength(sessionJson, 'utf8'),
    },
    chapters: chapters.map(({ chapterNumber, stableId, canonicalUrl }) => ({
      chapterNumber,
      stableId,
      canonicalUrl,
    })),
  };

  return validateChapterManifest(manifest, {
    novelId: metadata.id,
    versionId: version.versionId,
  });
};

export const validateLibraryPublication = ({
  metadata,
  session,
  sessionJson,
  manifest: manifestInput,
}: ValidatePublicationInputs): ChapterPublicationManifest => {
  const version = resolveVersion(metadata, session);
  const chapters = validateSessionIdentities(session);
  validateMetadataCounts(metadata, version, chapters);
  const manifest = validateChapterManifest(manifestInput, {
    novelId: metadata.id,
    versionId: version.versionId,
  });

  if (!version.chapterManifestUrl) {
    return fail(`version "${version.versionId}" must declare chapterManifestUrl.`);
  }
  if (manifest.session.url !== version.sessionJsonUrl) {
    return fail(
      `manifest session URL "${manifest.session.url}" does not match metadata session URL "${version.sessionJsonUrl}".`
    );
  }

  const actualByteLength = Buffer.byteLength(sessionJson, 'utf8');
  if (manifest.session.byteLength !== actualByteLength) {
    return fail(
      `manifest session byteLength ${manifest.session.byteLength} does not match ${actualByteLength}.`
    );
  }
  const actualSha256 = sha256(sessionJson);
  if (manifest.session.sha256 !== actualSha256) {
    return fail(`manifest session sha256 ${manifest.session.sha256} does not match ${actualSha256}.`);
  }
  if (manifest.expectedChapterCount !== metadata.metadata.chapterCount) {
    return fail(
      `manifest expectedChapterCount ${manifest.expectedChapterCount} does not match metadata chapterCount ${metadata.metadata.chapterCount}.`
    );
  }
  if (manifest.publishedChapterCount !== chapters.length) {
    return fail(
      `manifest publishedChapterCount ${manifest.publishedChapterCount} does not match session count ${chapters.length}.`
    );
  }

  chapters.forEach((chapter, index) => {
    const identity = manifest.chapters[index];
    if (identity.chapterNumber !== chapter.chapterNumber) {
      fail(`manifest chapterNumber does not match session chapter ${chapter.chapterNumber}.`);
    }
    if (identity.stableId !== chapter.stableId) {
      fail(`manifest stableId does not match session chapter ${chapter.chapterNumber}.`);
    }
    if (identity.canonicalUrl !== chapter.canonicalUrl) {
      fail(`manifest canonicalUrl does not match session chapter ${chapter.chapterNumber}.`);
    }
  });

  return manifest;
};

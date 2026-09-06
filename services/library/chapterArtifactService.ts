import type {
  ChapterArtifactDocument,
  ChapterArtifactReference,
  PublishedChapterIdentity,
} from '../../types/chapterManifest';

export const MAX_CHAPTER_ARTIFACT_BYTES = 64 * 1024 * 1024;

export class ChapterArtifactIntegrityError extends Error {
  constructor(message: string) {
    super(`Chapter artifact integrity error: ${message}`);
    this.name = 'ChapterArtifactIntegrityError';
  }
}

const fail = (message: string): never => {
  throw new ChapterArtifactIntegrityError(message);
};

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const hexDigest = (bytes: ArrayBuffer): Promise<string> => {
  if (!globalThis.crypto?.subtle) {
    return Promise.reject(new ChapterArtifactIntegrityError('Web Crypto SHA-256 is unavailable.'));
  }
  return globalThis.crypto.subtle.digest('SHA-256', bytes).then((digest) =>
    Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, '0')).join('')
  );
};

export interface ChapterArtifactContext {
  novelId: string;
  versionId: string;
  identity: PublishedChapterIdentity;
}

export const validateChapterArtifactDocument = (
  value: unknown,
  context: ChapterArtifactContext
): ChapterArtifactDocument => {
  if (!isRecord(value)) return fail('document must be an object.');
  if (value.format !== 'lexiconforge-chapter-artifact' || value.version !== '1.0') {
    return fail('format/version must be lexiconforge-chapter-artifact 1.0.');
  }
  if (value.novelId !== context.novelId || value.versionId !== context.versionId) {
    return fail('novel/version identity does not match the requested manifest context.');
  }
  if (!isRecord(value.chapter)) return fail('chapter must be an object.');

  const chapter = value.chapter;
  if ((chapter.novelId != null && chapter.novelId !== context.novelId)
    || (chapter.libraryVersionId != null && chapter.libraryVersionId !== context.versionId)) {
    return fail('chapter scope does not match the requested manifest context.');
  }
  if (
    chapter.chapterNumber !== context.identity.chapterNumber ||
    chapter.stableId !== context.identity.stableId ||
    chapter.canonicalUrl !== context.identity.canonicalUrl
  ) {
    return fail('chapter number/stable ID/canonical URL tuple does not match the manifest identity.');
  }
  if (typeof chapter.title !== 'string' || chapter.title.trim().length === 0) {
    return fail('chapter.title must be a non-empty string.');
  }
  if (typeof chapter.content !== 'string' || chapter.content.trim().length === 0) {
    return fail('chapter.content must be a non-empty string.');
  }

  return value as unknown as ChapterArtifactDocument;
};

export const fetchChapterArtifact = async (
  reference: ChapterArtifactReference,
  context: ChapterArtifactContext
): Promise<ChapterArtifactDocument> => {
  if (reference.byteLength > MAX_CHAPTER_ARTIFACT_BYTES) {
    return fail(
      `declared byte length ${reference.byteLength} exceeds the ${MAX_CHAPTER_ARTIFACT_BYTES}-byte browser limit.`
    );
  }

  let response: Response;
  try {
    response = await fetch(reference.url);
  } catch (error) {
    return fail(`failed to fetch ${reference.url}: ${error instanceof Error ? error.message : String(error)}.`);
  }
  if (!response.ok) {
    return fail(`failed to fetch ${reference.url}: HTTP ${response.status} ${response.statusText}.`);
  }

  let bytes: ArrayBuffer;
  try {
    const reader = response.body?.getReader();
    if (!reader) return fail(`empty response body from ${reference.url}.`);
    const buffer = new Uint8Array(reference.byteLength);
    let received = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (received + value.byteLength > reference.byteLength) {
          await reader.cancel();
          return fail(`downloaded more bytes than the manifest declares (${reference.byteLength}).`);
        }
        buffer.set(value, received);
        received += value.byteLength;
      }
    } finally {
      reader.releaseLock();
    }
    if (received !== reference.byteLength) {
      return fail(`downloaded ${received} bytes; manifest declares ${reference.byteLength}.`);
    }
    bytes = buffer.buffer;
  } catch (error) {
    return fail(`failed to read ${reference.url}: ${error instanceof Error ? error.message : String(error)}.`);
  }
  const digest = await hexDigest(bytes);
  if (digest !== reference.sha256) {
    return fail(`downloaded SHA-256 ${digest} does not match manifest ${reference.sha256}.`);
  }

  let value: unknown;
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    value = JSON.parse(text);
  } catch (error) {
    return fail(`verified bytes are not valid UTF-8 JSON: ${error instanceof Error ? error.message : String(error)}.`);
  }
  return validateChapterArtifactDocument(value, context);
};

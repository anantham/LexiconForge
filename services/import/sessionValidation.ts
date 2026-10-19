/** Finite browser import budgets. Large published sessions can exceed 272 MB. */
export const IMPORT_LIMITS = Object.freeze({
  bytes: 500 * 1024 * 1024,
  downloadMs: 120_000,
  chunks: 131_072,
  depth: 64,
  values: 2_000_000,
  arrayItems: 100_000,
  objectKeys: 4096,
  keyChars: 1024,
  fieldChars: 8 * 1024 * 1024,
  chapterChars: 16 * 1024 * 1024,
  envelopeFieldChars: 32 * 1024 * 1024,
  chapters: 10_000,
  translationsPerChapter: 1000,
});
export type ImportLimits = { readonly [K in keyof typeof IMPORT_LIMITS]: number };

export class ImportValidationError extends Error {
  constructor(message: string) {
    super(`Session import rejected: ${message}`);
    this.name = 'ImportValidationError';
  }
}

function reject(message: string): never { throw new ImportValidationError(message); }
const record = (value: unknown): value is Record<string, any> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

export function validateImportChapter(chapter: unknown): asserts chapter is Record<string, any> {
  if (!record(chapter)) reject('each chapter must be an object');
  for (const key of ['stableId', 'id', 'title', 'content', 'url', 'canonicalUrl', 'originalUrl',
    'nextUrl', 'prevUrl', 'fanTranslation', 'novelId', 'libraryVersionId']) {
    if (chapter[key] != null && typeof chapter[key] !== 'string') reject(`chapter ${key} must be a string`);
  }
  if (chapter.chapterNumber != null && (!Number.isSafeInteger(chapter.chapterNumber) || chapter.chapterNumber < 0)) {
    reject('chapterNumber must be a nonnegative safe integer');
  }
  if (chapter.translations != null && !Array.isArray(chapter.translations)) reject('translations must be an array');
  if ((chapter.translations?.length ?? 0) > IMPORT_LIMITS.translationsPerChapter) reject('too many translations in a chapter');
  const translations = [...(chapter.translations ?? []), ...(chapter.translationResult ? [chapter.translationResult] : [])];
  for (const translation of translations) {
    if (!record(translation)) reject('each translation must be an object');
    for (const key of ['translatedTitle', 'translation', 'provider', 'model', 'systemPrompt', 'promptId', 'promptName', 'customVersionLabel']) {
      if (translation[key] != null && typeof translation[key] !== 'string') reject(`translation ${key} must be a string`);
    }
    for (const key of ['footnotes', 'suggestedIllustrations']) {
      if (translation[key] != null && !Array.isArray(translation[key])) reject(`translation ${key} must be an array`);
    }
  }
}

type Frame = {
  kind: 'object' | 'array';
  state: 'keyOrEnd' | 'key' | 'colon' | 'valueOrEnd' | 'value' | 'commaOrEnd';
  key?: string;
  keys: Set<string>;
  count: number;
  rootField?: string;
  chapter?: boolean;
};
type Capture = { kind: string; start: number; parts: string[]; depth: number; limit: number };

/**
 * Incremental JSON grammar/schema preflight. It retains one bounded chapter or
 * envelope field, never the entire parsed session. Duplicate keys are rejected
 * so the preflight and the subsequent native JSON parse cannot disagree.
 */
export class SessionJsonValidator {
  metadata: Record<string, any> | null = null;
  version: Record<string, any> | null = null;
  oscilloscope: unknown;
  chapterCount = 0;
  private frames: Frame[] = [];
  private rootStarted = false;
  private rootDone = false;
  private values = 0;
  private position = 0;
  private capture: Capture | null = null;
  private captureOffset = 0;
  private token: 'string' | 'scalar' | null = null;
  private tokenText = '';
  private tokenStart = 0;
  private tokenIsKey = false;
  private escaped = false;
  private unicodeRemaining = 0;
  private sawChapters = false;

  constructor(private readonly onChapter?: (chapter: Record<string, any>) => void,
    private readonly limits: ImportLimits = IMPORT_LIMITS) {}

  feed(source: string): void {
    this.captureOffset = 0;
    for (let i = 0; i < source.length; i++, this.position++) {
      const char = source[i];
      if (this.capture && this.position - this.capture.start >= this.capture.limit) reject(`${this.capture.kind} exceeds its size limit`);
      if (this.token === 'string') {
        if (this.position - this.tokenStart > (this.tokenIsKey ? this.limits.keyChars : this.limits.fieldChars)) reject('JSON field exceeds its size limit');
        if (this.tokenIsKey) this.tokenText += char;
        if (this.unicodeRemaining) {
          if (!/[0-9a-f]/i.test(char)) reject('invalid JSON unicode escape');
          this.unicodeRemaining--;
        } else if (this.escaped) {
          if (char === 'u') this.unicodeRemaining = 4;
          else if (!'"\\/bfnrt'.includes(char)) reject('invalid JSON escape');
          this.escaped = false;
        } else if (char === '\\') this.escaped = true;
        else if (char === '"') {
          this.token = null;
          if (this.tokenIsKey) this.completeKey(JSON.parse(this.tokenText));
        } else if (char.charCodeAt(0) < 32) reject('unescaped JSON control character');
        continue;
      }
      if (this.token === 'scalar') {
        if (!/[\s,}\]]/.test(char)) {
          if (this.tokenText.length >= 128) reject('JSON scalar exceeds its size limit');
          this.tokenText += char;
          continue;
        }
        this.completeScalar();
      }
      if (/\s/.test(char)) {
        if (!' \n\r\t'.includes(char)) reject('invalid JSON whitespace');
        continue;
      }
      const frame = this.frames.at(-1);
      if (char === '}' || char === ']') {
        if (!frame || (char === '}') !== (frame.kind === 'object') || !['keyOrEnd', 'valueOrEnd', 'commaOrEnd'].includes(frame.state)) reject('invalid JSON closing delimiter');
        this.frames.pop();
        if (!this.frames.length) this.rootDone = true;
        if (this.capture?.depth === this.frames.length + 1) {
          this.capture.parts.push(source.slice(this.captureOffset, i + 1));
          this.completeCapture();
          this.captureOffset = i + 1;
        }
        continue;
      }
      if (char === ',') {
        if (!frame || frame.state !== 'commaOrEnd') reject('invalid JSON comma');
        frame.state = frame.kind === 'object' ? 'key' : 'value';
        continue;
      }
      if (char === ':') {
        if (!frame || frame.state !== 'colon') reject('invalid JSON colon');
        frame.state = 'value';
        continue;
      }
      if (char === '"' && frame?.kind === 'object' && ['key', 'keyOrEnd'].includes(frame.state)) {
        this.tokenIsKey = true;
        this.startString();
        continue;
      }
      this.startValue(char, i);
      if (char === '"') {
        this.tokenIsKey = false;
        this.startString();
      } else if (char !== '{' && char !== '[') {
        this.token = 'scalar';
        this.tokenText = char;
      }
    }
    if (this.capture) this.capture.parts.push(source.slice(this.captureOffset));
  }

  finish(): void {
    if (this.token === 'scalar') this.completeScalar();
    if (this.token || this.frames.length || !this.rootDone) reject('incomplete JSON document');
    if (!this.metadata || !this.sawChapters) reject('metadata and chapters are required');
  }

  private startString(): void {
    this.token = 'string';
    this.tokenText = '"';
    this.tokenStart = this.position;
    this.escaped = false;
    this.unicodeRemaining = 0;
  }

  private completeKey(key: string): void {
    const frame = this.frames.at(-1)!;
    if (['__proto__', 'prototype', 'constructor'].includes(key)) reject('unsafe JSON object key');
    if (frame.keys.has(key)) reject('duplicate JSON object key');
    frame.keys.add(key);
    if (frame.keys.size > this.limits.objectKeys) reject('too many object fields');
    frame.key = key;
    frame.state = 'colon';
  }

  private completeScalar(): void {
    try {
      const value = JSON.parse(this.tokenText);
      if (typeof value === 'object' && value !== null || typeof value === 'number' && !Number.isFinite(value)) reject('invalid JSON scalar');
    } catch { reject('invalid JSON scalar'); }
    this.token = null;
  }

  private startValue(char: string, offset: number): void {
    const parent = this.frames.at(-1);
    if (this.rootDone || parent && !['value', 'valueOrEnd'].includes(parent.state)) reject('unexpected JSON value');
    if (!parent && (this.rootStarted || char !== '{')) reject('session root must be an object');
    this.rootStarted = true;
    if (++this.values > this.limits.values) reject('too many JSON values');
    const rootField = this.frames.length === 1 ? parent?.key : undefined;
    const chapter = parent?.rootField === 'chapters' && parent.kind === 'array';
    if (rootField === 'chapters') {
      if (char !== '[') reject('chapters must be an array');
      this.sawChapters = true;
    }
    if (rootField === 'metadata' && char !== '{') reject('metadata must be an object');
    if (chapter && char !== '{') reject('each chapter must be an object');
    if (parent) {
      parent.state = 'commaOrEnd';
      if (parent.kind === 'array' && ++parent.count > (parent.rootField === 'chapters' ? this.limits.chapters : this.limits.arrayItems)) reject('too many array items');
    }
    if (char === '{' || char === '[') {
      if (this.frames.length >= this.limits.depth) reject('JSON nesting exceeds its depth limit');
      this.frames.push({ kind: char === '{' ? 'object' : 'array', state: char === '{' ? 'keyOrEnd' : 'valueOrEnd', keys: new Set(), count: 0, rootField, chapter });
      if (chapter || ['metadata', 'version', 'oscilloscope'].includes(rootField ?? '')) {
        this.capture = { kind: chapter ? 'chapter' : rootField!, start: this.position, parts: [], depth: this.frames.length,
          limit: chapter ? this.limits.chapterChars : this.limits.envelopeFieldChars };
        this.captureOffset = offset;
      }
    }
  }

  private completeCapture(): void {
    const { kind, parts } = this.capture!;
    this.capture = null;
    const value = JSON.parse(parts.join(''));
    if (kind === 'metadata') {
      if (!record(value) || !(['lexiconforge-session', 'lexiconforge-full-1'].includes(value.format)
        || typeof value.source === 'string' && value.source.includes('booktoki'))) reject('invalid session format');
      if (value.chapterCount != null && (!Number.isSafeInteger(value.chapterCount) || value.chapterCount < 0 || value.chapterCount > this.limits.chapters)) reject('invalid metadata chapter count');
      this.metadata = value;
    } else if (kind === 'chapter') {
      validateImportChapter(value);
      this.chapterCount++;
      this.onChapter?.(value);
    } else if (kind === 'version') this.version = record(value) ? value : null;
    else this.oscilloscope = value;
  }
}

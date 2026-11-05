// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { IMPORT_LIMITS, SessionJsonValidator, type ImportLimits } from '../../../services/import/sessionValidation';

const session = (chapter: unknown = { title: 'Chapter 1', content: 'Ordinary content', url: 'https://example.test/1' }) => ({
  metadata: { format: 'lexiconforge-session', chapterCount: 1 }, chapters: [chapter],
});
const validate = (text: string, limits: ImportLimits = IMPORT_LIMITS, chunkSize = 7) => {
  const chapters: unknown[] = [];
  const parser = new SessionJsonValidator(chapter => chapters.push(chapter), limits);
  for (let offset = 0; offset < text.length; offset += chunkSize) parser.feed(text.slice(offset, offset + chunkSize));
  parser.finish();
  return { parser, chapters };
};

describe('session JSON resource/schema preflight', () => {
  it.each([1, 2, 7, 64_000])('accepts ordinary multilingual data with chunk size %i', chunkSize => {
    const data = { ...session({ title: 'ഊരകം', content: 'Text with \\" escapes, {braces}, [arrays], and 日本語',
      canonicalUrl: 'https://example.test/1', translations: [{ translation: '<p>Hello</p>', footnotes: [] }] }),
      version: { versionId: 'v1' }, oscilloscope: { corpus: { versionId: 'v1' }, threads: [] },
      other: [null, true, false, 1.2e-3, { nested: [] }] };
    const { parser, chapters } = validate(JSON.stringify(data), IMPORT_LIMITS, chunkSize);
    expect(chapters).toEqual(data.chapters);
    expect(parser.metadata).toEqual(data.metadata);
    expect(parser.version).toEqual(data.version);
    expect(parser.oscilloscope).toEqual(data.oscilloscope);
  });

  it('accepts metadata after chapters and arbitrary top-level field ordering', () => {
    const data = session();
    expect(validate(JSON.stringify({ chapters: data.chapters, metadata: data.metadata })).chapters).toEqual(data.chapters);
  });

  it.each([
    '{', '{"metadata":', '{"metadata":{"format":"lexiconforge-session"},"chapters":[{}]',
    '{"metadata":{"format":"lexiconforge-session"},"chapters":[]} false',
    '{"metadata":{"format":"lexiconforge-session"},"chapters":[{},]}',
    '{"metadata":{"format":"lexiconforge-session"},"chapters":[],}',
    '{"metadata":{"format":"lexiconforge-session"},"chapters":[{"title":"\\q"}]}',
    '{"metadata":{"format":"lexiconforge-session"},"chapters":[{"title":"\\u0xx0"}]}',
    '{"metadata":{"format":"lexiconforge-session"},"chapters":[],"other":Infinity}',
    '{"metadata":{"format":"lexiconforge-session"},"chapters":[],"other":1e999}',
    '{"metadata":{"format":"lexiconforge-session"},"chapters":[],"other":01}',
    '[]',
  ])('rejects malformed/incomplete JSON before persistence: %s', text => {
    expect(() => validate(text)).toThrow(/rejected/i);
  });

  it.each(['__proto__', 'constructor', 'prototype'])('rejects hazardous own object key %s, including escapes', key => {
    const encodedKey = key.replace(key[0], `\\u${key.charCodeAt(0).toString(16).padStart(4, '0')}`);
    expect(() => validate(`{"metadata":{"format":"lexiconforge-session"},"chapters":[],"other":{"${encodedKey}":{}}}`)).toThrow('unsafe JSON object key');
    expect(({} as any).polluted).toBeUndefined();
  });

  it('rejects duplicate keys rather than letting streaming and native parses disagree', () => {
    expect(() => validate('{"metadata":{"format":"lexiconforge-session"},"chapters":[],"chapters":[{}]}')).toThrow('duplicate JSON object key');
  });

  it.each([
    { metadata: { format: 'lexiconforge-not-supported' }, chapters: [] },
    { metadata: { format: 'lexiconforge-session', chapterCount: -1 }, chapters: [] },
    { metadata: { format: 'lexiconforge-session', chapterCount: IMPORT_LIMITS.chapters + 1 }, chapters: [] },
    { metadata: {}, chapters: [] }, { chapters: [] }, { metadata: { format: 'lexiconforge-session' } },
    { metadata: { format: 'lexiconforge-session' }, chapters: {} },
    session(null), session({ title: {} }), session({ content: [] }), session({ chapterNumber: 1.5 }),
    session({ translations: {} }), session({ translations: [null] }), session({ translations: [{ translation: {} }] }),
    session({ translationResult: 'bad' }), session({ translations: [{ footnotes: {} }] }),
  ])('rejects unsupported or unsafe chapter/envelope shape %#', data => {
    expect(() => validate(JSON.stringify(data))).toThrow(/rejected/i);
  });

  it('accepts legacy full exports and BookToki conversion inputs', () => {
    expect(validate(JSON.stringify({ ...session(), metadata: { format: 'lexiconforge-full-1' } })).chapters).toHaveLength(1);
    expect(validate(JSON.stringify({ ...session(), metadata: { source: 'booktoki468.com' } })).chapters).toHaveLength(1);
  });

  it('bounds actual chapter count independent of advertised metadata', () => {
    const data = { metadata: { format: 'lexiconforge-session' }, chapters: [{}, {}, {}] };
    expect(() => validate(JSON.stringify(data), { ...IMPORT_LIMITS, chapters: 2 })).toThrow('too many array items');
  });

  it('bounds incomplete chapters while bytes are still arriving', () => {
    const parser = new SessionJsonValidator(undefined, { ...IMPORT_LIMITS, chapterChars: 32 });
    expect(() => parser.feed('{"metadata":{"format":"lexiconforge-session"},"chapters":[{"content":"' + 'x'.repeat(100)))
      .toThrow('chapter exceeds its size limit');
  });

  it.each([
    ['fieldChars', 'JSON field', { other: 'x'.repeat(80) }, 48],
    ['keyChars', 'JSON field', { ['x'.repeat(80)]: 1 }, 48],
    ['depth', 'depth limit', { other: [[[[[[]]]]]] }, 5],
    ['arrayItems', 'array items', { other: [1, 2, 3] }, 2],
    ['objectKeys', 'object fields', { other: { a: 1, b: 2, c: 3 } }, 2],
    ['values', 'JSON values', { other: [1, 2, 3] }, 7],
    ['envelopeFieldChars', 'metadata exceeds', {}, 24],
  ] as const)('enforces %s', (limit, message, extra, budget) => {
    expect(() => validate(JSON.stringify({ ...session(), ...extra }), { ...IMPORT_LIMITS, [limit]: budget })).toThrow(message);
  });

  it('bounds translation work per chapter', () => {
    expect(() => validate(JSON.stringify(session({ translations: Array.from({ length: 1001 }, () => ({ translation: 'x' })) }))))
      .toThrow('too many translations');
  });
});

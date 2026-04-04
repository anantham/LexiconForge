// @vitest-environment node

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  buildHostedLibraryArtifacts,
  resolveFanTranslationForChapter,
  updateRegistryJson,
  type LibraryBuildManifest,
  type LoadedSource,
} from '../../scripts/lib/library-session-builder';

const tempDirs: string[] = [];

const createTempDir = (): string => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lf-library-build-'));
  tempDirs.push(dir);
  return dir;
};

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe('library-session-builder', () => {
  it('resolves exact fan translations within configured ranges', () => {
    const sourceA: LoadedSource = {
      spec: { path: '/tmp/a.txt', label: 'A', ranges: [{ from: 1, to: 2 }] },
      source: {
        translatorId: 'a',
        translator: { name: 'A', language: 'English' },
        chapters: [
          { chapterNumber: 1, title: 'Chapter 1: A', paragraphs: [{ text: 'A1' }] },
          { chapterNumber: 2, title: 'Chapter 2: A', paragraphs: [{ text: 'A2' }] },
        ],
      },
    };
    const sourceB: LoadedSource = {
      spec: { path: '/tmp/b.txt', label: 'B', ranges: [{ from: 3, to: 4 }] },
      source: {
        translatorId: 'b',
        translator: { name: 'B', language: 'English' },
        chapters: [
          { chapterNumber: 3, title: 'Chapter 3: B', paragraphs: [{ text: 'B3' }] },
          { chapterNumber: 4, title: 'Chapter 4: B', paragraphs: [{ text: 'B4' }] },
        ],
      },
    };

    expect(resolveFanTranslationForChapter(1, [sourceA, sourceB]).match?.text).toBe('A1');
    expect(resolveFanTranslationForChapter(4, [sourceA, sourceB]).match?.text).toBe('B4');
  });

  it('reports ambiguous merged chapter ranges instead of silently attaching them', () => {
    const mergedSource: LoadedSource = {
      spec: { path: '/tmp/merged.epub', label: 'Merged', ranges: [{ from: 3269, to: 3269 }] },
      source: {
        translatorId: 'merged',
        translator: { name: 'Merged', language: 'English' },
        chapters: [
          {
            chapterNumber: 3269,
            chapterRange: { from: 3269, to: 3270 },
            title: 'Chapter 3269-3270',
            paragraphs: [{ text: 'merged text' }],
          },
        ],
      },
    };

    const result = resolveFanTranslationForChapter(3269, [mergedSource]);

    expect(result.match).toBeNull();
    expect(result.warnings[0]?.kind).toBe('ambiguous-range-match');
  });

  it('builds a hosted-library artifact from raw and ranged fan sources', async () => {
    const tempRoot = createTempDir();
    const rawPath = path.join(tempRoot, 'raw.txt');
    const fanOnePath = path.join(tempRoot, 'fan-one.txt');
    const fanTwoPath = path.join(tempRoot, 'fan-two.txt');

    fs.writeFileSync(rawPath, [
      '第1章 开始',
      '',
      '第一章正文。',
      '',
      '第2章 继续',
      '',
      '第二章正文。',
      '',
      '第3章 转折',
      '',
      '第三章正文。',
      '',
      '第4章 结束',
      '',
      '第四章正文。',
      '',
    ].join('\n'));

    fs.writeFileSync(fanOnePath, [
      'Chapter 1: Start',
      '',
      'English one.',
      '',
      'Chapter 2: Continue',
      '',
      'English two.',
      '',
    ].join('\n'));

    fs.writeFileSync(fanTwoPath, [
      'Chapter 3: Turn',
      '',
      'English three.',
      '',
      'Chapter 4: End',
      '',
      'English four.',
      '',
    ].join('\n'));

    const manifest: LibraryBuildManifest = {
      novel: {
        id: 'test-novel',
        title: 'Test Novel',
        originalLanguage: 'Chinese',
        targetLanguage: 'English',
        genres: ['Test'],
        description: 'Test build',
      },
      version: {
        versionId: 'v1',
        displayName: 'Composite',
        translator: { name: 'LexiconForge' },
        style: 'faithful',
        features: ['fan-translation'],
        completionStatus: 'Complete',
        targetLanguage: 'English',
      },
      sources: {
        raw: { path: rawPath },
        fan: [
          { path: fanOnePath, ranges: [{ from: 1, to: 2 }] },
          { path: fanTwoPath, ranges: [{ from: 3, to: 4 }] },
        ],
      },
      output: {
        novelsRoot: tempRoot,
        publicBaseUrl: 'https://example.com/novels',
      },
    };

    const result = await buildHostedLibraryArtifacts(manifest);

    expect(result.session.chapters).toHaveLength(4);
    expect(result.session.chapters[0].fanTranslation).toBe('English one.');
    expect(result.session.chapters[1].fanTranslation).toBe('English two.');
    expect(result.session.chapters[2].fanTranslation).toBe('English three.');
    expect(result.session.chapters[3].fanTranslation).toBe('English four.');
    expect(result.metadata.versions?.[0].sessionJsonUrl).toBe('https://example.com/novels/test-novel/session.json');
  });

  it('uses an alignment map to attach shifted fan chapters', async () => {
    const tempRoot = createTempDir();
    const rawPath = path.join(tempRoot, 'raw.txt');
    const shiftedFanPath = path.join(tempRoot, 'shifted-fan.txt');
    const alignmentMapPath = path.join(tempRoot, 'alignment-map.json');

    fs.writeFileSync(rawPath, [
      '第1章 开始',
      '',
      '第一章正文。',
      '',
      '第2章 继续',
      '',
      '第二章正文。',
      '',
    ].join('\n'));

    fs.writeFileSync(shiftedFanPath, [
      'Chapter 2: Start',
      '',
      'Shifted English one.',
      '',
      'Chapter 3: Continue',
      '',
      'Shifted English two.',
      '',
    ].join('\n'));

    fs.writeFileSync(alignmentMapPath, JSON.stringify({
      version: 1,
      generatedAt: '2026-03-29T00:00:00.000Z',
      rawSourcePath: rawPath,
      fanSourcePath: shiftedFanPath,
      verifier: { kind: 'fake', model: 'fake' },
      segments: [
        {
          kind: 'one_to_one',
          raw: { from: 1, to: 2 },
          english: { from: 2, to: 3 },
          offset: 1,
          confidence: 0.99,
          evidence: [],
        },
      ],
    }, null, 2));

    const manifest: LibraryBuildManifest = {
      novel: {
        id: 'shifted-novel',
        title: 'Shifted Novel',
        originalLanguage: 'Chinese',
        targetLanguage: 'English',
        genres: ['Test'],
        description: 'Shifted build',
      },
      version: {
        versionId: 'v1',
        displayName: 'Aligned',
        translator: { name: 'LexiconForge' },
        style: 'faithful',
        features: ['alignment-map'],
        completionStatus: 'Complete',
        targetLanguage: 'English',
      },
      sources: {
        raw: { path: rawPath },
        fan: [
          {
            path: shiftedFanPath,
            alignmentMapPath,
            ranges: [{ from: 1, to: 2 }],
          },
        ],
      },
      output: {
        novelsRoot: tempRoot,
        publicBaseUrl: 'https://example.com/novels',
      },
    };

    const result = await buildHostedLibraryArtifacts(manifest);

    expect(result.session.chapters[0].fanTranslation).toBe('Shifted English one.');
    expect(result.session.chapters[1].fanTranslation).toBe('Shifted English two.');
    expect(result.report.warnings).toHaveLength(0);
    expect(result.report.sources[1]?.alignmentMapPath).toBe(alignmentMapPath);
  });

  it('updates registry entries deterministically', () => {
    const manifest: LibraryBuildManifest = {
      novel: {
        id: 'forty-millenniums-of-cultivation',
        title: 'Forty Millenniums of Cultivation',
        originalLanguage: 'Chinese',
        targetLanguage: 'English',
        genres: ['Sci-Fi'],
        description: 'Composite build',
      },
      version: {
        versionId: 'v1',
        displayName: 'Composite',
        translator: { name: 'LexiconForge' },
        style: 'faithful',
        features: [],
        completionStatus: 'In Progress',
        targetLanguage: 'English',
      },
      sources: {
        raw: { path: '/tmp/raw.txt' },
        fan: [],
      },
      output: {
        novelsRoot: '/tmp/novels',
        publicBaseUrl: 'https://raw.githubusercontent.com/example/lexiconforge-novels/main/novels',
      },
    };

    const registry = {
      version: '1.0',
      lastUpdated: '2026-01-01',
      novels: [{ id: 'existing', metadataUrl: 'https://example.com/existing/metadata.json' }],
    };

    const updated = updateRegistryJson(registry, manifest);

    expect(updated.novels).toEqual([
      { id: 'existing', metadataUrl: 'https://example.com/existing/metadata.json' },
      {
        id: 'forty-millenniums-of-cultivation',
        metadataUrl: 'https://raw.githubusercontent.com/example/lexiconforge-novels/main/novels/forty-millenniums-of-cultivation/metadata.json',
      },
    ]);
  });
});

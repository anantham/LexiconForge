// @vitest-environment node

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChapterPublicationManifest } from '../../types/chapterManifest';
import type { LibraryBuildManifest } from '../../scripts/lib/library-session-builder';
import { RegistryService } from '../../services/registryService';
import { resolveExpectedChapterPublication } from '../../services/library/chapterPublicationResolver';

let root: string;
let manifest: LibraryBuildManifest;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'lf-publication-output-'));
  const rawPath = path.join(root, 'raw.txt');
  fs.writeFileSync(rawPath, 'Chapter 1: Start\n\nOriginal text.\n');
  manifest = {
    novel: {
      id: 'test-novel', title: 'Test Novel', originalLanguage: 'English',
      targetLanguage: 'English', genres: [], description: 'Publication regression',
    },
    version: {
      versionId: 'v1', displayName: 'Version 1', translator: { name: 'Test' },
      style: 'faithful', features: [], completionStatus: 'Complete', targetLanguage: 'English',
    },
    sources: { raw: { path: rawPath }, fan: [] },
    output: { novelsRoot: root, publicBaseUrl: 'https://example.com/novels' },
  };
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
  vi.unstubAllGlobals();
});

const publish = () => {
  const configPath = path.join(root, 'build.json');
  fs.writeFileSync(configPath, JSON.stringify(manifest));
  execFileSync(process.execPath, ['--import', 'tsx', 'scripts/build-library-session.ts', configPath], {
    stdio: 'pipe',
  });
  return JSON.parse(
    fs.readFileSync(path.join(root, 'test-novel/chapter-manifest.json'), 'utf8')
  ) as ChapterPublicationManifest;
};

describe('library publication output', () => {
  it('publishes default GitHub LFS URLs that survive registry normalization', async () => {
    delete manifest.output.publicBaseUrl;
    const publication = publish();
    const metadata = JSON.parse(fs.readFileSync(path.join(root, 'test-novel/metadata.json'), 'utf8'));
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(metadata)))
      .mockResolvedValueOnce(new Response(JSON.stringify(publication))));
    const normalized = await RegistryService.fetchNovelMetadata(
      'https://raw.githubusercontent.com/anantham/lexiconforge-novels/main/novels/test-novel/metadata.json'
    );
    await expect(resolveExpectedChapterPublication(normalized, 'v1')).resolves.toMatchObject({ numbers: [1] });
    expect(new URL(publication.chapters[0].artifact!.url).hostname).toBe('media.githubusercontent.com');
  }, 20_000);

  it('keeps old manifest downloads valid after content and version revisions', () => {
    const original = publish();
    const unchanged = publish();
    expect(unchanged.chapters[0].artifact).toEqual(original.chapters[0].artifact);

    fs.writeFileSync(manifest.sources.raw.path, 'Chapter 1: Start\n\nRevised text.\n');
    const revised = publish();
    manifest.version.versionId = 'v2';
    const nextVersion = publish();
    const publications = [original, revised, nextVersion];
    expect(new Set(publications.map(value => value.chapters[0].artifact!.url)).size).toBe(3);

    for (const publication of publications) {
      const reference = publication.chapters[0].artifact!;
      const relativePath = new URL(reference.url).pathname.replace('/novels/', '');
      const bytes = fs.readFileSync(path.join(root, relativePath));
      expect(bytes.byteLength).toBe(reference.byteLength);
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(reference.sha256);
      const document = JSON.parse(bytes.toString('utf8'));
      expect(document.versionId).toBe(publication.versionId);
      expect(document.chapter.stableId).toBe(publication.chapters[0].stableId);
    }
  }, 20_000);

  it('leaves published pointers unchanged when chapter artifact output fails', () => {
    publish();
    const pointerPaths = ['metadata.json', 'chapter-manifest.json', 'session.json']
      .map(name => path.join(root, 'test-novel', name));
    const previous = pointerPaths.map(file => fs.readFileSync(file, 'utf8'));
    fs.writeFileSync(manifest.sources.raw.path, 'Chapter 1: Start\n\nRevised text.\n');
    manifest.output.chapterArtifactDirectoryName = 'blocked';
    fs.writeFileSync(path.join(root, 'test-novel/blocked'), 'An existing file prevents directory creation.');

    expect(publish).toThrow(/Build failed.*blocked/);
    expect(pointerPaths.map(file => fs.readFileSync(file, 'utf8'))).toEqual(previous);
  }, 20_000);
});

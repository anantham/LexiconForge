#!/usr/bin/env node

import * as fs from 'node:fs';
import * as path from 'node:path';

import { validateLibraryPublication } from './lib/library-publication-integrity';
import type { ChapterPublicationManifest } from '../types/chapterManifest';
import type { NovelEntry } from '../types/novel';

const usage = (): string => (
  'Usage: npm run verify-library-publication -- <metadata.json> <session.json> <chapter-manifest.json>'
);

const readJson = <T>(filePath: string, label: string): { value: T; text: string } => {
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`${label} not found: ${resolved}`);
  }
  const text = fs.readFileSync(resolved, 'utf8');
  try {
    return { value: JSON.parse(text) as T, text };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`${label} is not valid JSON (${resolved}): ${detail}`, { cause: error });
  }
};

const main = (): void => {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    console.log(usage());
    return;
  }
  if (args.length !== 3) {
    throw new Error(usage());
  }

  const metadata = readJson<NovelEntry>(args[0], 'Metadata');
  const session = readJson<Record<string, unknown>>(args[1], 'Session');
  const manifest = readJson<ChapterPublicationManifest>(args[2], 'Chapter manifest');
  const validated = validateLibraryPublication({
    metadata: metadata.value,
    session: session.value,
    sessionJson: session.text,
    manifest: manifest.value,
  });

  console.log(
    `Verified ${validated.novelId}/${validated.versionId}: ` +
    `${validated.publishedChapterCount}/${validated.expectedChapterCount} chapters, ` +
    `session sha256 ${validated.session.sha256}.`
  );
};

try {
  main();
} catch (error) {
  const detail = error instanceof Error ? error.message : String(error);
  console.error(`Library publication verification failed: ${detail}`);
  process.exitCode = 1;
}

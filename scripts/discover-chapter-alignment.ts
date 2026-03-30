#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';

import { discoverAlignmentMap } from './lib/chapter-alignment-discovery';
import { OpenRouterAlignmentVerifier } from './lib/chapter-alignment-verifier';
import { normalizeSourceInput } from './lib/source-input';
import { findAdapter } from './lib/translation-sources';

interface CliOptions {
  rawPath: string;
  fanPath: string;
  outputPath: string;
  startChapter: number;
  endChapter: number;
  initialOffset: number;
  checkpointSize: number;
  searchWindow: number;
  minConfidence: number;
  model?: string;
}

const DEFAULTS = {
  initialOffset: 0,
  checkpointSize: 64,
  searchWindow: 6,
  minConfidence: 0.8,
};

const printUsage = (): void => {
  console.log(`
Discover Chapter Alignment

Usage:
  npm run discover-chapter-alignment -- \\
    --raw <raw-source-path> \\
    --fan <fan-source-path> \\
    --start <chapter> \\
    --end <chapter> \\
    --output <alignment-map.json> \\
    [--initial-offset 0] \\
    [--checkpoint-size 64] \\
    [--search-window 6] \\
    [--min-confidence 0.8] \\
    [--model openrouter/free]

Notes:
  - Raw and fan sources can be TXT, PDF, EPUB, or any adapter-supported format.
  - Uses OpenRouter to verify whether Chinese raw chapters and English fan chapters match.
  - Emits a JSON alignment map with one-to-one, merged, and unresolved segments.
`);
};

const readValue = (argv: string[], index: number, flag: string): string => {
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value for ${flag}`);
  }
  return value;
};

const parseNumber = (value: string, flag: string): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Expected a number for ${flag}, received "${value}"`);
  }
  return parsed;
};

const parseArgs = (argv: string[]): CliOptions => {
  const options: Partial<CliOptions> = {
    initialOffset: DEFAULTS.initialOffset,
    checkpointSize: DEFAULTS.checkpointSize,
    searchWindow: DEFAULTS.searchWindow,
    minConfidence: DEFAULTS.minConfidence,
  };

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    switch (arg) {
      case '--raw':
        options.rawPath = normalizeSourceInput(readValue(argv, index, arg));
        index += 1;
        break;
      case '--fan':
        options.fanPath = normalizeSourceInput(readValue(argv, index, arg));
        index += 1;
        break;
      case '--output':
      case '-o':
        options.outputPath = path.resolve(readValue(argv, index, arg));
        index += 1;
        break;
      case '--start':
        options.startChapter = parseNumber(readValue(argv, index, arg), arg);
        index += 1;
        break;
      case '--end':
        options.endChapter = parseNumber(readValue(argv, index, arg), arg);
        index += 1;
        break;
      case '--initial-offset':
        options.initialOffset = parseNumber(readValue(argv, index, arg), arg);
        index += 1;
        break;
      case '--checkpoint-size':
        options.checkpointSize = parseNumber(readValue(argv, index, arg), arg);
        index += 1;
        break;
      case '--search-window':
        options.searchWindow = parseNumber(readValue(argv, index, arg), arg);
        index += 1;
        break;
      case '--min-confidence':
        options.minConfidence = parseNumber(readValue(argv, index, arg), arg);
        index += 1;
        break;
      case '--model':
        options.model = readValue(argv, index, arg);
        index += 1;
        break;
      case '--help':
      case '-h':
        printUsage();
        process.exit(0);
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!options.rawPath || !options.fanPath || !options.outputPath) {
    throw new Error('Missing required arguments: --raw, --fan, and --output are required.');
  }
  if (typeof options.startChapter !== 'number' || typeof options.endChapter !== 'number') {
    throw new Error('Missing required arguments: --start and --end are required.');
  }

  return options as CliOptions;
};

const loadSource = async (sourcePath: string) => {
  const adapter = findAdapter(sourcePath);
  if (!adapter) {
    throw new Error(`No adapter found for ${sourcePath}`);
  }
  return adapter.extract(sourcePath);
};

const summarizeSegments = (segments: Array<{ kind: string; raw: { from: number; to: number }; english?: { from: number; to: number }; offset?: number }>): string[] => (
  segments.map((segment) => {
    const rawRange = segment.raw.from === segment.raw.to
      ? `${segment.raw.from}`
      : `${segment.raw.from}-${segment.raw.to}`;
    const englishRange = segment.english
      ? (segment.english.from === segment.english.to
        ? `${segment.english.from}`
        : `${segment.english.from}-${segment.english.to}`)
      : 'n/a';
    const offsetText = typeof segment.offset === 'number' ? ` offset=${segment.offset}` : '';
    return `${segment.kind}: raw ${rawRange} -> english ${englishRange}${offsetText}`;
  })
);

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    printUsage();
    process.exit(1);
  }

  const options = parseArgs(args);
  console.log('🔎 Discovering chapter alignment');
  console.log(`   Raw: ${options.rawPath}`);
  console.log(`   Fan: ${options.fanPath}`);
  console.log(`   Range: ${options.startChapter}-${options.endChapter}`);
  console.log(`   Output: ${options.outputPath}`);

  const [rawSource, fanSource] = await Promise.all([
    loadSource(options.rawPath),
    loadSource(options.fanPath),
  ]);

  const verifier = new OpenRouterAlignmentVerifier(options.model);
  const alignmentMap = await discoverAlignmentMap(
    {
      rawSourcePath: options.rawPath,
      fanSourcePath: options.fanPath,
      rawChapters: rawSource.chapters,
      fanChapters: fanSource.chapters,
    },
    verifier,
    {
      startChapter: options.startChapter,
      endChapter: options.endChapter,
      initialOffset: options.initialOffset,
      checkpointSize: options.checkpointSize,
      searchWindow: options.searchWindow,
      minConfidence: options.minConfidence,
    }
  );

  fs.mkdirSync(path.dirname(options.outputPath), { recursive: true });
  fs.writeFileSync(options.outputPath, JSON.stringify(alignmentMap, null, 2) + '\n');

  console.log('\n✅ Alignment discovery complete');
  console.log(`   Segments: ${alignmentMap.segments.length}`);
  for (const line of summarizeSegments(alignmentMap.segments)) {
    console.log(`   - ${line}`);
  }
}

main().catch((error: any) => {
  console.error(`\n❌ Alignment discovery failed: ${error.message}`);
  process.exit(1);
});

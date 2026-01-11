#!/usr/bin/env node
/**
 * Polyglot Merge CLI
 *
 * A unified tool for merging translations from multiple sources:
 * - EPUB files (84000, academic translations)
 * - TXT directories (fan translations)
 * - Polyglotta JSON (scraped parallel texts)
 * - Existing LexiconForge session JSON
 *
 * Creates a polyglot document with all translation versions aligned.
 *
 * Usage:
 *   npm run polyglot-merge <base-file> [source...] [-o output.json]
 *
 * Examples:
 *   # Merge EPUB into Polyglotta JSON
 *   npm run polyglot-merge polyglotta.json toh176.epub -o merged.json
 *
 *   # Merge multiple sources
 *   npm run polyglot-merge session.json ./fan-translations/ translation.epub
 *
 *   # Create fresh from EPUB only
 *   npm run polyglot-merge --create toh176.epub -o session.json
 */

import * as fs from 'fs';
import * as path from 'path';

import {
  findAdapter,
  EpubAdapter,
  TxtDirectoryAdapter,
  PolyglottaJsonAdapter,
  type TranslationSourceOutput,
  type TranslatorMetadata,
  type PolyglotDocument,
  type PolyglotChapter,
  type AlignedUnit,
} from './lib/translation-sources';

// Simple hash function (matching the browser version in stableIdService.ts)
const simpleHash = (str: string): string => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
};

const generateStableChapterId = (
  content: string,
  chapterNumber: number,
  title: string
): string => {
  const contentHash = simpleHash(content.substring(0, 1000));
  const titleHash = simpleHash(title);
  return `ch${chapterNumber}_${contentHash.substring(0, 8)}_${titleHash.substring(0, 4)}`;
};

// ========== ALIGNMENT STRATEGIES ==========

/**
 * Align by chapter number (simple 1:1 matching)
 */
function alignByChapterNumber(
  base: TranslationSourceOutput['chapters'],
  source: TranslationSourceOutput['chapters']
): Map<number, { baseIdx: number; sourceIdx: number }> {
  const alignments = new Map<number, { baseIdx: number; sourceIdx: number }>();

  for (let i = 0; i < base.length; i++) {
    const baseChapter = base[i];
    const sourceChapter = source.find(c => c.chapterNumber === baseChapter.chapterNumber);
    if (sourceChapter) {
      const sourceIdx = source.indexOf(sourceChapter);
      alignments.set(baseChapter.chapterNumber, { baseIdx: i, sourceIdx });
    }
  }

  return alignments;
}

/**
 * Align by paragraph ID (for paragraph-level granularity)
 */
function alignByParagraphId(
  baseParagraphs: Array<{ id?: string; text: string }>,
  sourceParagraphs: Array<{ id?: string; text: string }>
): Map<string, { baseIdx: number; sourceIdx: number }> {
  const alignments = new Map<string, { baseIdx: number; sourceIdx: number }>();

  // Build index of source paragraphs by ID
  const sourceIndex = new Map<string, number>();
  for (let i = 0; i < sourceParagraphs.length; i++) {
    const id = sourceParagraphs[i].id;
    if (id) {
      sourceIndex.set(id, i);
    }
  }

  // Match base paragraphs to source
  for (let i = 0; i < baseParagraphs.length; i++) {
    const id = baseParagraphs[i].id;
    if (id && sourceIndex.has(id)) {
      alignments.set(id, { baseIdx: i, sourceIdx: sourceIndex.get(id)! });
    }
  }

  return alignments;
}

// ========== MERGE FUNCTIONS ==========

interface MergeResult {
  polyglotDocument: PolyglotDocument;
  lexiconforgePayload: LexiconForgePayload;
  stats: {
    chaptersTotal: number;
    chaptersAligned: number;
    translatorsCount: number;
  };
}

interface LexiconForgePayload {
  metadata: {
    format: 'lexiconforge-full-1';
    generatedAt: string;
    polyglotMetadata?: any;
    [key: string]: any;
  };
  settings: null;
  navigation: {
    history: string[];
    lastActive: { id: string } | null;
  };
  urlMappings: Array<{
    url: string;
    stableId: string;
    isCanonical: boolean;
    dateAdded: string;
  }>;
  novels: Array<{
    id: string;
    title: string;
    source: string;
    chapterCount: number;
    dateAdded: string;
    lastAccessed: string;
  }>;
  chapters: Array<{
    stableId: string;
    canonicalUrl: string;
    title: string;
    content: string;
    fanTranslation: string | null;
    nextUrl: string | null;
    prevUrl: string | null;
    chapterNumber: number;
    translations: any[];
    feedback: any[];
    polyglotContent?: any[];  // Extended field for polyglot data
  }>;
  promptTemplates: any[];
  amendmentLogs: any[];
  diffResults: any[];
  telemetry: null;
}

/**
 * Merge multiple translation sources into a polyglot document
 */
async function mergeTranslationSources(
  baseSource: TranslationSourceOutput,
  additionalSources: TranslationSourceOutput[],
  metadata: { title: string; sourceLanguage?: string }
): Promise<MergeResult> {
  const generatedAt = new Date().toISOString();

  // Collect all translators
  const translators: Record<string, TranslatorMetadata> = {
    [baseSource.translatorId]: baseSource.translator,
  };

  for (const source of additionalSources) {
    translators[source.translatorId] = source.translator;
  }

  // Build aligned chapters
  const polyglotChapters: PolyglotChapter[] = [];
  let alignedCount = 0;

  for (const baseChapter of baseSource.chapters) {
    const units: AlignedUnit[] = [];

    // Add base paragraphs as units
    for (let i = 0; i < baseChapter.paragraphs.length; i++) {
      const para = baseChapter.paragraphs[i];
      const unitId = para.id || `p${i + 1}`;

      const versions: Record<string, { text: string; notes?: string[] }> = {
        [baseSource.translatorId]: {
          text: para.text,
          notes: para.notes,
        },
      };

      // Try to find matching paragraphs from additional sources
      for (const source of additionalSources) {
        const sourceChapter = source.chapters.find(
          c => c.chapterNumber === baseChapter.chapterNumber
        );

        if (sourceChapter) {
          // Try alignment by ID first
          const matchByIdIdx = sourceChapter.paragraphs.findIndex(p => p.id === para.id);
          if (matchByIdIdx >= 0) {
            versions[source.translatorId] = {
              text: sourceChapter.paragraphs[matchByIdIdx].text,
              notes: sourceChapter.paragraphs[matchByIdIdx].notes,
            };
            continue;
          }

          // Fall back to positional alignment (same index)
          if (i < sourceChapter.paragraphs.length) {
            versions[source.translatorId] = {
              text: sourceChapter.paragraphs[i].text,
              notes: sourceChapter.paragraphs[i].notes,
            };
          }
        }
      }

      units.push({
        id: unitId,
        versions,
      });
    }

    // Check if any additional sources aligned
    const hasAdditionalVersions = units.some(
      u => Object.keys(u.versions).length > 1
    );
    if (hasAdditionalVersions) {
      alignedCount++;
    }

    // Generate stable ID
    const content = baseChapter.paragraphs.map(p => p.text).join('\n\n');
    const stableId = generateStableChapterId(
      content,
      baseChapter.chapterNumber,
      baseChapter.title
    );

    polyglotChapters.push({
      chapterNumber: baseChapter.chapterNumber,
      stableId,
      title: baseChapter.title,
      units,
    });
  }

  // Build polyglot document
  const polyglotDocument: PolyglotDocument = {
    metadata: {
      title: metadata.title,
      sourceLanguage: metadata.sourceLanguage,
    },
    translators,
    chapters: polyglotChapters,
  };

  // Build LexiconForge-compatible payload
  const lexiconforgePayload: LexiconForgePayload = {
    metadata: {
      format: 'lexiconforge-full-1',
      generatedAt,
      importSource: 'polyglot-merge',
      polyglotMetadata: polyglotDocument.metadata,
      translators: Object.keys(translators),
    },
    settings: null,
    navigation: {
      history: polyglotChapters.map(c => c.stableId),
      lastActive: polyglotChapters.length > 0 ? { id: polyglotChapters[0].stableId } : null,
    },
    urlMappings: polyglotChapters.map(c => ({
      url: `polyglot://${c.stableId}`,
      stableId: c.stableId,
      isCanonical: true,
      dateAdded: generatedAt,
    })),
    novels: [{
      id: `polyglot_${simpleHash(metadata.title)}`,
      title: metadata.title,
      source: 'polyglot-merge',
      chapterCount: polyglotChapters.length,
      dateAdded: generatedAt,
      lastAccessed: generatedAt,
    }],
    chapters: polyglotChapters.map((ch, idx) => {
      // Primary content: use first translator's version
      const primaryTranslatorId = Object.keys(translators)[0];
      const content = ch.units
        .map(u => u.versions[primaryTranslatorId]?.text || '')
        .filter(t => t.length > 0)
        .join('\n\n');

      // Fan translation: use first English translator if different from primary
      const englishTranslatorId = Object.keys(translators).find(
        id => translators[id].language === 'English' && id !== primaryTranslatorId
      );
      const fanTranslation = englishTranslatorId
        ? ch.units
            .map(u => u.versions[englishTranslatorId]?.text || '')
            .filter(t => t.length > 0)
            .join('\n\n')
        : null;

      return {
        stableId: ch.stableId,
        canonicalUrl: `polyglot://${ch.stableId}`,
        title: ch.title,
        content,
        fanTranslation,
        nextUrl: idx < polyglotChapters.length - 1
          ? `polyglot://${polyglotChapters[idx + 1].stableId}`
          : null,
        prevUrl: idx > 0
          ? `polyglot://${polyglotChapters[idx - 1].stableId}`
          : null,
        chapterNumber: ch.chapterNumber,
        translations: [],
        feedback: [],
        polyglotContent: ch.units,  // Preserve full polyglot data
      };
    }),
    promptTemplates: [],
    amendmentLogs: [],
    diffResults: [],
    telemetry: null,
  };

  return {
    polyglotDocument,
    lexiconforgePayload,
    stats: {
      chaptersTotal: polyglotChapters.length,
      chaptersAligned: alignedCount,
      translatorsCount: Object.keys(translators).length,
    },
  };
}

// ========== CLI ==========

function printUsage(): void {
  console.log(`
Polyglot Merge CLI - Merge translation sources into aligned documents

Usage:
  npm run polyglot-merge <base-file> [source...] [-o output.json]
  npm run polyglot-merge --create <source> [-o output.json]

Options:
  -o, --output    Output file path (default: <base>-merged.json)
  --create        Create new document from single source (no base required)
  --title         Set document title (default: inferred from source)
  --format        Output format: 'lexiconforge' or 'polyglot' (default: lexiconforge)
  --help          Show this help message

Supported Source Types:
  .epub           EPUB files (84000, academic translations)
  directory/      Directories containing .txt files (fan translations)
  .json           Polyglotta scrape JSON or LexiconForge session

Examples:
  # Merge 84000 EPUB translation into Polyglotta JSON
  npm run polyglot-merge polyglotta.json import/toh176.epub -o vimalakirti-merged.json

  # Merge multiple fan translation folders
  npm run polyglot-merge session.json ./fan-v1/ ./fan-v2/ -o with-fans.json

  # Create from EPUB only
  npm run polyglot-merge --create import/toh176.epub -o session.json

  # Specify custom title
  npm run polyglot-merge polyglotta.json toh176.epub --title "Vimalakirti Study Edition"
`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    printUsage();
    process.exit(args.length === 0 ? 1 : 0);
  }

  // Parse arguments
  const sourceFiles: string[] = [];
  let outputPath: string | null = null;
  let createMode = false;
  let title: string | null = null;
  let format: 'lexiconforge' | 'polyglot' = 'lexiconforge';

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '-o' || arg === '--output') {
      outputPath = args[++i];
    } else if (arg === '--create') {
      createMode = true;
    } else if (arg === '--title') {
      title = args[++i];
    } else if (arg === '--format') {
      const fmt = args[++i];
      if (fmt === 'lexiconforge' || fmt === 'polyglot') {
        format = fmt;
      } else {
        console.error(`Unknown format: ${fmt}. Use 'lexiconforge' or 'polyglot'.`);
        process.exit(1);
      }
    } else if (!arg.startsWith('-')) {
      sourceFiles.push(arg);
    }
  }

  if (sourceFiles.length === 0) {
    console.error('Error: No source files provided.');
    printUsage();
    process.exit(1);
  }

  console.log('\n Polyglot Merge CLI\n');
  console.log('─'.repeat(50));

  // Load all sources
  const sources: TranslationSourceOutput[] = [];

  for (const sourcePath of sourceFiles) {
    const adapter = findAdapter(sourcePath);

    if (!adapter) {
      console.error(`❌ No adapter found for: ${sourcePath}`);
      console.error(`   Supported: .epub, .json (Polyglotta), or directory with .txt files`);
      process.exit(1);
    }

    console.log(`\nLoading: ${sourcePath}`);
    console.log(`   Adapter: ${adapter.name}`);

    try {
      const source = await adapter.extract(sourcePath);
      sources.push(source);
      console.log(`   Chapters: ${source.chapters.length}`);
      console.log(`   Translator: ${source.translator.name}`);
    } catch (error: any) {
      console.error(`❌ Failed to extract from ${sourcePath}: ${error.message}`);
      process.exit(1);
    }
  }

  if (sources.length === 0) {
    console.error('Error: No sources could be loaded.');
    process.exit(1);
  }

  // Determine base and additional sources
  const baseSource = sources[0];
  const additionalSources = sources.slice(1);

  // Infer title if not provided
  const documentTitle = title ||
    baseSource.translator.name ||
    path.basename(sourceFiles[0], path.extname(sourceFiles[0]));

  console.log('\n' + '─'.repeat(50));
  console.log(`\nMerging ${sources.length} source(s)...`);
  console.log(`   Base: ${baseSource.translator.name} (${baseSource.chapters.length} chapters)`);

  for (const source of additionalSources) {
    console.log(`   + ${source.translator.name} (${source.chapters.length} chapters)`);
  }

  // Perform merge
  const result = await mergeTranslationSources(
    baseSource,
    additionalSources,
    { title: documentTitle }
  );

  // Determine output path
  const finalOutputPath = outputPath ||
    (sourceFiles[0].endsWith('.json')
      ? sourceFiles[0].replace('.json', '-merged.json')
      : `${path.basename(sourceFiles[0], path.extname(sourceFiles[0]))}-merged.json`);

  // Write output
  const outputData = format === 'lexiconforge'
    ? result.lexiconforgePayload
    : result.polyglotDocument;

  fs.writeFileSync(finalOutputPath, JSON.stringify(outputData, null, 2));

  // Print summary
  console.log('\n' + '─'.repeat(50));
  console.log('\n Merge Complete!\n');
  console.log(`   Output: ${finalOutputPath}`);
  console.log(`   Format: ${format}`);
  console.log(`   Chapters: ${result.stats.chaptersTotal}`);
  console.log(`   Aligned: ${result.stats.chaptersAligned} chapters have multiple versions`);
  console.log(`   Translators: ${result.stats.translatorsCount}`);

  const translatorList = Object.entries(result.polyglotDocument.translators)
    .map(([id, t]) => `     - ${t.name} (${t.language})${t.era ? ` [${t.era}]` : ''}`)
    .join('\n');

  console.log(`\n   Included Versions:\n${translatorList}`);

  console.log('\n   Import with:');
  console.log(`     LexiconForge → Import → Import Session JSON → ${finalOutputPath}\n`);
}

main().catch((error) => {
  console.error(`\n❌ Fatal error: ${error.message}`);
  process.exit(1);
});

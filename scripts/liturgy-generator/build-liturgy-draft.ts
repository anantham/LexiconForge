#!/usr/bin/env node

/**
 * Build a draft `LiturgyDoc` TypeScript module from a structured generator
 * packet. The output is intentionally a draft: write it OUTSIDE
 * `data/liturgy/` (which is for reviewed, registered chants), verify any
 * machine-inferred alignment by hand, then move + register it.
 *
 * Usage:
 *   npm run build:liturgy-draft -- <input.json> --out drafts/<slug>.draft.ts
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { buildLiturgyDraft } from '../../services/liturgy-generator/pipeline';
import { emitLiturgyDocModule } from '../../services/liturgy-generator/emit';
import type { LiturgyGeneratorInput } from '../../services/liturgy-generator/types';

function printUsage(): void {
  console.log(`
Build Liturgy Draft

Usage:
  npm run build:liturgy-draft -- <input.json> --out <output.ts>

The input is a structured LiturgyGeneratorInput packet. Generated output is a
draft module, not an auto-registered chant — write it outside data/liturgy/,
review it, then move + register it.
`);
}

function parseArgs(args: string[]): { inputPath: string; outPath: string } {
  if (args.includes('--help') || args.includes('-h')) {
    printUsage();
    process.exit(0);
  }

  const inputPath = args[0];
  const outIndex = args.indexOf('--out');
  const outPath = outIndex >= 0 ? args[outIndex + 1] : '';

  if (!inputPath || !outPath) {
    printUsage();
    throw new Error('build-liturgy-draft: expected <input.json> and --out <output.ts>.');
  }

  return {
    inputPath: resolve(inputPath),
    outPath: resolve(outPath),
  };
}

async function main(): Promise<void> {
  const { inputPath, outPath } = parseArgs(process.argv.slice(2));
  const raw = await readFile(inputPath, 'utf-8');
  const input = JSON.parse(raw) as LiturgyGeneratorInput;
  const result = buildLiturgyDraft(input);

  for (const diagnostic of result.diagnostics) {
    const prefix = diagnostic.level.toUpperCase();
    const location = [diagnostic.sectionId, diagnostic.segmentId, diagnostic.witnessBy]
      .filter(Boolean)
      .join(' / ');
    console.warn(
      `[${prefix}] ${diagnostic.code}${location ? ` (${location})` : ''}: ${diagnostic.message}`
    );
  }

  if (result.stats.errorCount > 0) {
    throw new Error(
      `build-liturgy-draft: refusing to emit ${outPath}; ${result.stats.errorCount} validation error(s) found.`
    );
  }

  const moduleText = emitLiturgyDocModule(result.doc, result.exportName);
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, moduleText, 'utf-8');

  console.log(`Draft written: ${outPath}`);
  console.log(
    `Stats: ${result.stats.inferredAlignments} inferred alignments, ${result.stats.unmappedTokens} unmapped token(s), ${result.stats.warningCount} warning(s).`
  );

  if (result.stats.inferredAlignments > 0) {
    console.warn(
      `\n⚠ REVIEW REQUIRED: ${result.stats.inferredAlignments} witness alignment(s) were machine-inferred. ` +
        `Verify every arrow against the source by hand before registering this draft in data/liturgy/index.ts; ` +
        `then author the confirmed alignTo arrays so the witnesses use "preserve" mode.`
    );
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`build-liturgy-draft failed: ${message}`);
  process.exit(1);
});

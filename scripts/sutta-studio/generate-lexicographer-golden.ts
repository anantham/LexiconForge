#!/usr/bin/env npx tsx
/**
 * Generate Lexicographer Golden Data from demoPacket
 *
 * Extracts senses (word-level and segment-level) from demoPacket phases
 * and writes them to a golden test fixture.
 *
 * Usage: npx tsx scripts/sutta-studio/generate-lexicographer-golden.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { DEMO_PACKET_MN10 } from '../../components/sutta-studio/demoPacket';
import type {
  LexicographerPass,
  LexicographerEntry,
  LexicographerSegmentEntry,
  PhaseView,
} from '../../types/suttaStudio';

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

const OUTPUT_PATH = 'test-fixtures/sutta-studio-lexicographer-golden.json';

// Include ALL phases from demoPacket (no filtering)
const INCLUDE_ALL_PHASES = true;

// ─────────────────────────────────────────────────────────────────────────────
// Transformation Logic
// ─────────────────────────────────────────────────────────────────────────────

function transformPhaseToLexicographer(phase: PhaseView): LexicographerPass {
  const senses: LexicographerEntry[] = [];
  const segmentSenses: LexicographerSegmentEntry[] = [];

  for (const paliWord of phase.paliWords) {
    // Word-level senses
    if (paliWord.senses && paliWord.senses.length > 0) {
      senses.push({
        wordId: paliWord.id,
        wordClass: paliWord.wordClass || 'content',
        senses: paliWord.senses,
      });
    }

    // Segment-level senses (for compounds)
    for (const seg of paliWord.segments) {
      if (seg.senses && seg.senses.length > 0) {
        segmentSenses.push({
          segmentId: seg.id,
          senses: seg.senses,
        });
      }
    }
  }

  return {
    id: phase.id,
    senses,
    ...(segmentSenses.length > 0 && { segmentSenses }),
    handoff: { confidence: 'high', notes: 'Extracted from demoPacket' },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

function main() {
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('  Generate Lexicographer Golden from demoPacket');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  const phases = DEMO_PACKET_MN10.phases.filter((p) => INCLUDE_ALL_PHASES || ["phase-a"].includes(p.id));

  console.log(`Processing ${phases.length} phases from demoPacket...\n`);

  const lexicographerGoldens: Record<string, LexicographerPass> = {};
  const phaseMetadata: Array<{
    phaseId: string;
    wordSenseCount: number;
    segmentSenseCount: number;
  }> = [];

  for (const phase of phases) {
    const lexico = transformPhaseToLexicographer(phase);
    lexicographerGoldens[phase.id] = lexico;

    const meta = {
      phaseId: phase.id,
      wordSenseCount: lexico.senses.length,
      segmentSenseCount: lexico.segmentSenses?.length || 0,
    };
    phaseMetadata.push(meta);

    console.log(
      `  ${phase.id}: ${meta.wordSenseCount} word senses, ${meta.segmentSenseCount} segment senses`
    );
  }

  // Build output structure
  const output = {
    _description: 'Lexicographer golden data extracted from demoPacket for benchmarking',
    _generatedAt: new Date().toISOString(),
    _source: 'components/sutta-studio/demoPacket.ts',
    _phases: phaseMetadata,
    lexicographer: lexicographerGoldens,
  };

  // Write to file
  const outputPath = path.join(process.cwd(), OUTPUT_PATH);
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2) + '\n');

  console.log(`\n✅ Wrote ${OUTPUT_PATH}`);
  console.log(`   ${phases.length} phases, ${phaseMetadata.reduce((s, m) => s + m.wordSenseCount, 0)} total word senses`);
}

main();

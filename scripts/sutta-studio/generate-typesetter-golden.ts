#!/usr/bin/env npx tsx
/**
 * Generate Typesetter Golden Data from demoPacket
 *
 * Extracts layout blocks from demoPacket phases and writes them to a golden test fixture.
 *
 * Usage: npx tsx scripts/sutta-studio/generate-typesetter-golden.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { DEMO_PACKET_MN10 } from '../../components/sutta-studio/demoPacket';
import type { TypesetterPass, PhaseView } from '../../types/suttaStudio';

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

const OUTPUT_PATH = 'test-fixtures/sutta-studio-typesetter-golden.json';

// Include ALL phases from demoPacket (no filtering)
const INCLUDE_ALL_PHASES = true;

// ─────────────────────────────────────────────────────────────────────────────
// Transformation Logic
// ─────────────────────────────────────────────────────────────────────────────

function transformPhaseToTypesetter(phase: PhaseView): TypesetterPass {
  // Use existing layoutBlocks if present, otherwise create from paliWords order
  const layoutBlocks = phase.layoutBlocks || [phase.paliWords.map((w) => w.id)];

  return {
    id: phase.id,
    layoutBlocks,
    handoff: { confidence: 'high', notes: 'Extracted from demoPacket' },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

function main() {
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('  Generate Typesetter Golden from demoPacket');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  const phases = DEMO_PACKET_MN10.phases.filter((p) => INCLUDE_ALL_PHASES || ["phase-a"].includes(p.id));

  console.log(`Processing ${phases.length} phases from demoPacket...\n`);

  const typesetterGoldens: Record<string, TypesetterPass> = {};
  const phaseMetadata: Array<{
    phaseId: string;
    blockCount: number;
    totalWords: number;
  }> = [];

  for (const phase of phases) {
    const typesetter = transformPhaseToTypesetter(phase);
    typesetterGoldens[phase.id] = typesetter;

    const meta = {
      phaseId: phase.id,
      blockCount: typesetter.layoutBlocks.length,
      totalWords: typesetter.layoutBlocks.flat().length,
    };
    phaseMetadata.push(meta);

    const blocksStr = typesetter.layoutBlocks.map((b) => `[${b.join(',')}]`).join(' ');
    console.log(`  ${phase.id}: ${meta.blockCount} blocks, ${meta.totalWords} words → ${blocksStr}`);
  }

  // Build output structure
  const output = {
    _description: 'Typesetter golden data extracted from demoPacket for benchmarking',
    _generatedAt: new Date().toISOString(),
    _source: 'components/sutta-studio/demoPacket.ts',
    _phases: phaseMetadata,
    typesetter: typesetterGoldens,
  };

  // Write to file
  const outputPath = path.join(process.cwd(), OUTPUT_PATH);
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2) + '\n');

  const totalBlocks = phaseMetadata.reduce((s, m) => s + m.blockCount, 0);
  console.log(`\n✅ Wrote ${OUTPUT_PATH}`);
  console.log(`   ${phases.length} phases, ${totalBlocks} layout blocks`);
}

main();

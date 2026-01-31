#!/usr/bin/env npx tsx
/**
 * Generate Weaver Golden Data from demoPacket
 *
 * Extracts English token mappings (alignment lines, ghost words) from demoPacket phases
 * and writes them to a golden test fixture.
 *
 * Usage: npx tsx scripts/sutta-studio/generate-weaver-golden.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { DEMO_PACKET_MN10 } from '../../components/sutta-studio/demoPacket';
import type {
  WeaverPass,
  WeaverToken,
  PhaseView,
  EnglishToken,
} from '../../types/suttaStudio';

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

const OUTPUT_PATH = 'test-fixtures/sutta-studio-weaver-golden.json';

// Include ALL phases from demoPacket (no filtering)
const INCLUDE_ALL_PHASES = true;

// ─────────────────────────────────────────────────────────────────────────────
// Transformation Logic
// ─────────────────────────────────────────────────────────────────────────────

function transformPhaseToWeaver(phase: PhaseView): WeaverPass {
  const tokens: WeaverToken[] = [];

  if (phase.englishStructure) {
    phase.englishStructure.forEach((token: EnglishToken, index: number) => {
      const weaverToken: WeaverToken = {
        tokenIndex: index,
        text: token.label || token.id, // Use label if present, otherwise id
        isGhost: token.isGhost ?? false,
        ...(token.linkedSegmentId && { linkedSegmentId: token.linkedSegmentId }),
        ...(token.linkedPaliId && { linkedPaliId: token.linkedPaliId }),
        ...(token.ghostKind && { ghostKind: token.ghostKind }),
      };
      tokens.push(weaverToken);
    });
  }

  return {
    id: phase.id,
    tokens,
    handoff: { confidence: 'high', notes: 'Extracted from demoPacket' },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

function main() {
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('  Generate Weaver Golden from demoPacket');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  const phases = DEMO_PACKET_MN10.phases.filter((p) => INCLUDE_ALL_PHASES || ["phase-a"].includes(p.id));

  console.log(`Processing ${phases.length} phases from demoPacket...\n`);

  const weaverGoldens: Record<string, WeaverPass> = {};
  const phaseMetadata: Array<{
    phaseId: string;
    tokenCount: number;
    ghostCount: number;
    linkedCount: number;
  }> = [];

  for (const phase of phases) {
    const weaver = transformPhaseToWeaver(phase);
    weaverGoldens[phase.id] = weaver;

    const meta = {
      phaseId: phase.id,
      tokenCount: weaver.tokens.length,
      ghostCount: weaver.tokens.filter((t) => t.isGhost).length,
      linkedCount: weaver.tokens.filter((t) => t.linkedPaliId || t.linkedSegmentId).length,
    };
    phaseMetadata.push(meta);

    console.log(
      `  ${phase.id}: ${meta.tokenCount} tokens (${meta.ghostCount} ghosts, ${meta.linkedCount} linked)`
    );
  }

  // Build output structure
  const output = {
    _description: 'Weaver golden data extracted from demoPacket for benchmarking',
    _generatedAt: new Date().toISOString(),
    _source: 'components/sutta-studio/demoPacket.ts',
    _phases: phaseMetadata,
    weaver: weaverGoldens,
  };

  // Write to file
  const outputPath = path.join(process.cwd(), OUTPUT_PATH);
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2) + '\n');

  const totalTokens = phaseMetadata.reduce((s, m) => s + m.tokenCount, 0);
  const totalGhosts = phaseMetadata.reduce((s, m) => s + m.ghostCount, 0);
  console.log(`\n✅ Wrote ${OUTPUT_PATH}`);
  console.log(`   ${phases.length} phases, ${totalTokens} tokens, ${totalGhosts} ghosts`);
}

main();

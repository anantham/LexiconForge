#!/usr/bin/env npx tsx
/**
 * Generate Anatomist Golden Data from demoPacket
 *
 * Extracts anatomist-style data (words, segments, relations) from demoPacket phases
 * and writes them to a golden test fixture.
 *
 * Usage: npx tsx scripts/sutta-studio/generate-anatomist-golden.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { DEMO_PACKET_MN10 } from '../../components/sutta-studio/demoPacket';
import type {
  AnatomistPass,
  AnatomistWord,
  AnatomistSegment,
  AnatomistRelation,
  PhaseView,
} from '../../types/suttaStudio';

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

const OUTPUT_PATH = 'test-fixtures/sutta-studio-anatomist-golden.json';

// Include ALL phases from demoPacket (no filtering)
const INCLUDE_ALL_PHASES = true;

// ─────────────────────────────────────────────────────────────────────────────
// Transformation Logic
// ─────────────────────────────────────────────────────────────────────────────

function transformPhaseToAnatomist(phase: PhaseView): AnatomistPass {
  const words: AnatomistWord[] = [];
  const segments: AnatomistSegment[] = [];
  const relations: AnatomistRelation[] = [];
  let relationCounter = 1;

  for (const paliWord of phase.paliWords) {
    // Build surface text from segments
    const surface = paliWord.segments.map((s) => s.text).join('');

    // Create word entry
    const word: AnatomistWord = {
      id: paliWord.id,
      surface,
      wordClass: paliWord.wordClass || 'content',
      segmentIds: paliWord.segments.map((s) => s.id),
      ...(paliWord.isAnchor && { isAnchor: true }),
      ...(paliWord.refrainId && { refrainId: paliWord.refrainId }),
    };
    words.push(word);

    // Create segment entries
    for (const seg of paliWord.segments) {
      const segment: AnatomistSegment = {
        id: seg.id,
        wordId: paliWord.id,
        text: seg.text,
        type: seg.type,
        ...(seg.tooltips && seg.tooltips.length > 0 && { tooltips: seg.tooltips }),
        ...(seg.morph && { morph: seg.morph }),
      };
      segments.push(segment);

      // Extract relation if present
      if (seg.relation) {
        const relation: AnatomistRelation = {
          id: `r${relationCounter++}`,
          fromSegmentId: seg.id,
          type: seg.relation.type,
          label: seg.relation.label,
          ...(seg.relation.targetWordId && { targetWordId: seg.relation.targetWordId }),
          ...(seg.relation.targetSegmentId && { targetSegmentId: seg.relation.targetSegmentId }),
          status: 'confirmed',
        };
        relations.push(relation);
      }
    }
  }

  return {
    id: phase.id,
    words,
    segments,
    ...(relations.length > 0 && { relations }),
    handoff: { confidence: 'high', notes: 'Extracted from demoPacket' },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

function main() {
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('  Generate Anatomist Golden from demoPacket');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  const phases = INCLUDE_ALL_PHASES
    ? DEMO_PACKET_MN10.phases
    : DEMO_PACKET_MN10.phases.filter((p) => ['phase-a', 'phase-b', 'phase-c'].includes(p.id));

  console.log(`Processing ${phases.length} phases from demoPacket...\n`);

  const anatomistGoldens: Record<string, AnatomistPass> = {};
  const phaseMetadata: Array<{
    phaseId: string;
    canonicalSegmentIds: string[];
    wordCount: number;
    segmentCount: number;
    relationCount: number;
  }> = [];

  for (const phase of phases) {
    const anatomist = transformPhaseToAnatomist(phase);
    anatomistGoldens[phase.id] = anatomist;

    const meta = {
      phaseId: phase.id,
      canonicalSegmentIds: phase.canonicalSegmentIds || [],
      wordCount: anatomist.words.length,
      segmentCount: anatomist.segments.length,
      relationCount: anatomist.relations?.length || 0,
    };
    phaseMetadata.push(meta);

    console.log(
      `  ${phase.id}: ${meta.wordCount} words, ${meta.segmentCount} segments, ${meta.relationCount} relations`
    );
  }

  // Build output structure
  const output = {
    _description: 'Anatomist golden data extracted from demoPacket for benchmarking',
    _generatedAt: new Date().toISOString(),
    _source: 'components/sutta-studio/demoPacket.ts',
    _phases: phaseMetadata,
    anatomist: anatomistGoldens,
  };

  // Write to file
  const outputPath = path.join(process.cwd(), OUTPUT_PATH);
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2) + '\n');

  console.log(`\n✅ Wrote ${OUTPUT_PATH}`);
  console.log(`   ${phases.length} phases, ${phaseMetadata.reduce((s, m) => s + m.wordCount, 0)} total words`);

  // Also output a summary for quick reference
  console.log('\n───────────────────────────────────────────────────────────────────');
  console.log('  Phase Summary');
  console.log('───────────────────────────────────────────────────────────────────');

  for (const meta of phaseMetadata) {
    const segIds = meta.canonicalSegmentIds.join(', ') || '(none)';
    console.log(`  ${meta.phaseId.padEnd(10)} → ${segIds.padEnd(15)} | ${meta.wordCount}w ${meta.segmentCount}s ${meta.relationCount}r`);
  }
}

main();

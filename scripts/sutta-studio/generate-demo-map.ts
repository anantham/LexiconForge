#!/usr/bin/env npx tsx
/**
 * Generate demo-map.json from demoPacket.ts
 *
 * Extracts all phases and their segment mappings from the demo packet
 * to create the intermediate map file used by generate-golden-from-demo.ts
 */

import fs from 'fs/promises';
import path from 'path';
import { DEMO_PACKET_MN10 } from '../../components/sutta-studio/demoPacket';

const DEMO_PACKET = DEMO_PACKET_MN10;

type SkeletonPhase = {
  id: string;
  title?: string | null;
  segmentIds: string[];
  _sourceDemoPhases?: string[];
};

async function generateDemoMap() {
  const phases = DEMO_PACKET.phases;
  console.log(`[DemoMap] Found ${phases.length} phases in demoPacket`);

  // Collect all unique segments and build phase mapping
  const allSegmentIds = new Set<string>();
  const skeletonPhases: SkeletonPhase[] = [];

  for (const phase of phases) {
    const segmentIds = phase.canonicalSegmentIds || [];
    segmentIds.forEach(id => allSegmentIds.add(id));

    skeletonPhases.push({
      id: phase.id,
      title: null, // Will be filled in later if needed
      segmentIds,
      _sourceDemoPhases: [phase.id],
    });
  }

  console.log(`[DemoMap] ${allSegmentIds.size} unique segment IDs across ${skeletonPhases.length} phases`);

  const demoMap = {
    _description: 'Map of demo packet phases to canonical segment IDs',
    _sourceDemoPacket: 'components/sutta-studio/demoPacket.ts',
    _workId: DEMO_PACKET.source?.workId || 'mn10',
    _notes: `Generated ${new Date().toISOString()}`,
    skeletonPhases,
  };

  const outputPath = path.resolve('test-fixtures/sutta-studio-demo-map.json');
  await fs.writeFile(outputPath, JSON.stringify(demoMap, null, 2), 'utf8');
  console.log(`[DemoMap] Wrote ${outputPath}`);

  // Summary
  console.log('\n[DemoMap] Phases:');
  for (const phase of skeletonPhases) {
    console.log(`  ${phase.id}: ${phase.segmentIds.join(', ') || '(no segments)'}`);
  }
}

generateDemoMap().catch((error) => {
  console.error('[DemoMap] Failed:', error);
  process.exitCode = 1;
});

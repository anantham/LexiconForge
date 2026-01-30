#!/usr/bin/env npx tsx
/**
 * Lists all phases in demoPacket that are missing canonicalSegmentIds.
 * Share this list with whoever is adding segment IDs.
 */

import { DEMO_PACKET_MN10 } from '../../components/sutta-studio/demoPacket';

const missing = DEMO_PACKET_MN10.phases.filter(
  (p) => p.canonicalSegmentIds === undefined || p.canonicalSegmentIds.length === 0
);

console.log(`\nPhases missing canonicalSegmentIds (${missing.length} of ${DEMO_PACKET_MN10.phases.length}):\n`);

for (const phase of missing) {
  // Get first word to help identify the phase
  const firstWords = phase.paliWords
    .slice(0, 3)
    .map((w) => w.segments.map((s) => s.text).join(''))
    .join(' ');
  console.log(`  ${phase.id}: ${firstWords}...`);
}

console.log(`\n---\nPhases WITH canonicalSegmentIds (${DEMO_PACKET_MN10.phases.length - missing.length}):\n`);

const hasIds = DEMO_PACKET_MN10.phases.filter(
  (p) => p.canonicalSegmentIds && p.canonicalSegmentIds.length > 0
);

for (const phase of hasIds) {
  console.log(`  ${phase.id}: ${phase.canonicalSegmentIds?.join(', ')}`);
}

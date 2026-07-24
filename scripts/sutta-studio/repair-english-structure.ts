/**
 * Repair a committed packet's englishStructure at rest (reader-report II).
 *
 * Applies the SAME pure repair the view uses as its render backstop
 * (repairEnglishStructure in services/sutta-studio/utils.ts): drops english
 * tokens whose linked word/segment no longer exists, and collapses senseless
 * morpheme-token runs that would render one word's gloss repeatedly.
 *
 * Usage:
 *   npx tsx scripts/sutta-studio/repair-english-structure.ts <packet.json>            # dry run (report only)
 *   npx tsx scripts/sutta-studio/repair-english-structure.ts <packet.json> --write    # migrate + provenance note
 *
 * Dry-run first: its output IS the red proof that the classes exist in the
 * committed data before the migration claims to have removed them.
 */
import * as fs from 'node:fs';
import { repairEnglishStructure } from '../../services/sutta-studio/utils';

const path = process.argv[2];
const write = process.argv.includes('--write');
if (!path) {
  console.error('usage: repair-english-structure.ts <packet.json> [--write]');
  process.exit(1);
}

const packet = JSON.parse(fs.readFileSync(path, 'utf8'));
let dropped = 0;
let collapsed = 0;
let touchedPhases = 0;

for (const phase of packet.phases ?? []) {
  const { tokens, stats } = repairEnglishStructure(phase);
  if (stats.droppedDangling || stats.collapsedStutter) {
    touchedPhases += 1;
    dropped += stats.droppedDangling;
    collapsed += stats.collapsedStutter;
    if (write) phase.englishStructure = tokens;
  }
}

console.log(`${path}`);
console.log(`  phases touched:        ${touchedPhases}/${(packet.phases ?? []).length}`);
console.log(`  dangling links dropped: ${dropped}`);
console.log(`  stutter tokens collapsed: ${collapsed}`);

if (write) {
  packet.provenance = packet.provenance ?? {};
  packet.provenance.repairs = [
    ...(packet.provenance.repairs ?? []),
    {
      date: '2026-07-24',
      tool: 'repair-english-structure',
      droppedDanglingLinks: dropped,
      collapsedStutterTokens: collapsed,
      reason:
        'reader-report II: weaver emitted per-morpheme english tokens without segment senses (gloss stutter), and v1 surface repair renumbered words without remapping englishStructure (dangling links).',
    },
  ];
  fs.writeFileSync(path, JSON.stringify(packet));
  console.log('  WRITTEN (with provenance.repairs note)');
} else {
  console.log('  dry run — re-run with --write to migrate');
}

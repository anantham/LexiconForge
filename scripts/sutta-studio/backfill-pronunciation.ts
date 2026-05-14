#!/usr/bin/env npx tsx
/**
 * Backfill PaliWord.pronunciation for every word in demoPacket.json that
 * doesn't already have one — using the deterministic syllabifier post-pass.
 *
 * Idempotent: words with hand-curated pronunciation are left alone. Re-running
 * only affects words that have been added since the last run.
 *
 * Usage:
 *   tsx scripts/sutta-studio/backfill-pronunciation.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { syllabifyPaliWord } from '../../services/sutta-studio/postPasses/syllabify';

const PACKET_PATH = path.resolve('components/sutta-studio/demoPacket.json');

const packet = JSON.parse(fs.readFileSync(PACKET_PATH, 'utf-8'));

let added = 0;
let skipped = 0;
let alreadyHad = 0;
const examples: Array<{ surface: string; pronunciation: string }> = [];

for (const ph of packet.phases ?? []) {
  for (const w of ph.paliWords ?? []) {
    if (w.pronunciation) {
      alreadyHad++;
      continue;
    }
    const surface = (w.segments ?? []).map((s: any) => s.text).join('');
    if (!surface) {
      skipped++;
      continue;
    }
    const algo = syllabifyPaliWord(surface);
    if (!algo || algo.length === 0) {
      skipped++;
      continue;
    }
    w.pronunciation = algo;
    added++;
    if (examples.length < 8) examples.push({ surface, pronunciation: algo });
  }
}

fs.writeFileSync(PACKET_PATH, JSON.stringify(packet, null, 2) + '\n');

console.log(`\nBackfill complete:`);
console.log(`  Already had pronunciation:  ${alreadyHad}`);
console.log(`  Newly populated:            ${added}`);
console.log(`  Skipped (empty surface):    ${skipped}`);
console.log(`\nSample of newly added:`);
for (const ex of examples) {
  console.log(`  ${ex.surface.padEnd(24)}  →  ${ex.pronunciation}`);
}

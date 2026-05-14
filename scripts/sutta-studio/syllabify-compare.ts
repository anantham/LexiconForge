#!/usr/bin/env npx tsx
import { syllabifyPaliWord } from '../../services/sutta-studio/postPasses/syllabify';
import * as fs from 'fs';
import * as path from 'path';

const packet = JSON.parse(
  fs.readFileSync(path.resolve('components/sutta-studio/demoPacket.json'), 'utf-8')
);

const rows: Array<{ word: string; hand: string; algo: string; match: string }> = [];
for (const ph of packet.phases) {
  for (const w of (ph.paliWords || [])) {
    if (!w.pronunciation) continue;
    const surface = (w.segments || []).map((s: any) => s.text).join('');
    const algo = syllabifyPaliWord(surface);
    const handCore = w.pronunciation.split('  (')[0].split(' (')[0].trim();
    const lowerHand = handCore.replace(/[A-Z]/g, (c: string) => c.toLowerCase());
    const lowerAlgo = algo.replace(/[A-Z]/g, (c: string) => c.toLowerCase());
    const match = handCore === algo ? '✓' : (lowerHand === lowerAlgo ? '~stress' : '✗');
    rows.push({ word: surface, hand: handCore, algo, match });
  }
}

const matches = rows.filter(r => r.match === '✓').length;
const stressDiff = rows.filter(r => r.match === '~stress').length;
const segDiff = rows.filter(r => r.match === '✗').length;
console.log(`\nMATCH ${matches}/${rows.length}  |  STRESS DIFF ${stressDiff}  |  SEGMENTATION DIFF ${segDiff}\n`);

console.log('MISMATCHES:');
for (const r of rows) {
  if (r.match !== '✓') {
    console.log(`  ${r.match}  ${r.word.padEnd(20)}  hand="${r.hand}"  algo="${r.algo}"`);
  }
}

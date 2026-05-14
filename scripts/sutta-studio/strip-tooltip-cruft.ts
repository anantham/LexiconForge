#!/usr/bin/env npx tsx
/**
 * One-shot data cleanup: remove emoji + bracketed grammar prefixes from every
 * tooltip in demoPacket.json.
 *
 * Background: the V2 amendments (CURATION_PROTOCOL §3.4) prescribe plain-first
 * tooltip prose — no emoji, no bracketed grammar labels like "[Genitive Plural]".
 * The 11 V2-curated phases (a-h + 1-3) follow this. The other 40 phases still
 * carry v10-style content. Two settings toggles compensate at render time:
 *   - "Emoji in tooltips" toggles `stripEmoji()` at render
 *   - "Grammar terms" toggles `stripGrammarTerms()` at render
 *
 * This script applies those same regex strips at the SOURCE — the demoPacket.
 * After running:
 *   - Tooltips become V2-clean across all 51 phases
 *   - The render-time strip toggles become no-ops (no cruft left to strip)
 *   - The toggles can be safely deleted in a follow-up subtractive PR
 *
 * Pure subtraction: nothing added; characters removed.
 *
 * Usage:
 *   tsx scripts/sutta-studio/strip-tooltip-cruft.ts
 */

import * as fs from 'fs';
import * as path from 'path';

// Covers the full common-emoji ranges. Wider than services/utils.ts stripEmoji
// (which stops at U+1F9FF and would miss U+1FA70-U+1FAFF — e.g., 🪵 wood log).
// Acceptable here because this script is meant to strip more aggressively
// than the conservative render-time function.
const EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F680}-\u{1F6FF}]/gu;
// Same regex as services/utils.ts stripGrammarTerms — non-greedy [...] + trailing whitespace
const BRACKET_RE = /\[.*?\]\s*/g;

function stripCruft(s: string): string {
  return s.replace(BRACKET_RE, '').replace(EMOJI_RE, '').trim();
}

const PACKET_PATH = path.resolve('components/sutta-studio/demoPacket.json');
const packet = JSON.parse(fs.readFileSync(PACKET_PATH, 'utf-8'));

let modified = 0;
let removed = 0;
for (const ph of packet.phases ?? []) {
  for (const w of ph.paliWords ?? []) {
    for (const s of w.segments ?? []) {
      const tips: string[] = s.tooltips ?? [];
      const cleaned = tips
        .map((t: string) => stripCruft(t))
        .filter((t: string) => t.length > 0); // drop tooltips that became empty
      const droppedHere = tips.length - cleaned.length;
      removed += droppedHere;
      if (cleaned.length !== tips.length || cleaned.some((c, i) => c !== tips[i])) {
        modified += 1;
        if (cleaned.length === 0) {
          delete s.tooltips;
        } else {
          s.tooltips = cleaned;
        }
      }
    }
  }
}

fs.writeFileSync(PACKET_PATH, JSON.stringify(packet, null, 2) + '\n');

console.log(`\nStrip complete:`);
console.log(`  Segments with tooltips modified: ${modified}`);
console.log(`  Empty tooltips removed (became empty after strip): ${removed}`);

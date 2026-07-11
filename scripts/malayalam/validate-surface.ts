/**
 * Surface-law validator for Malayalam curated data (the SUTTA-025 rule,
 * applied to the Malayalam reader): a token's pieces MUST concatenate to the
 * token's exact written surface, and per-piece sounds must slice cleanly
 * against the letter-clusters. Run: npx tsx scripts/malayalam/validate-surface.ts
 *
 * Exit 1 on any violation — wire into CI alongside the other gates.
 */

import { URAKAM_SENTENCE_1 } from '../../data/malayalam/urakam-ammathiruvadi';
import { URAKAM_TIER1 } from '../../data/malayalam/urakam-tier1';
import { clustersOf, isMalayalamCluster, syllabify } from '../../services/malayalam/graphemes';

let failures = 0;
const fail = (msg: string) => {
  failures++;
  console.error(`✗ ${msg}`);
};

for (const seg of [...URAKAM_SENTENCE_1, ...URAKAM_TIER1]) {
  for (const r of seg.renderings) {
    if (!r.lang.startsWith('ml')) continue;
    for (const token of r.tokens) {
      // 1. Pieces concatenate to the exact written surface.
      if (token.segments?.length) {
        const joined = token.segments.map((s) => s.text).join('');
        if (joined !== token.text) {
          fail(`${seg.id}: pieces [${token.segments.map((s) => s.text).join('|')}] → "${joined}" ≠ surface "${token.text}"`);
        }
      }
      // 2. Every piece (or bare token) sound slices against its clusters —
      //    the etym glyph↔sound linkage depends on this.
      const pieces = token.segments?.length
        ? token.segments
        : [{ text: token.text, pronunciation: token.pronunciation }];
      for (const p of pieces) {
        if (!p.pronunciation) continue;
        // Count only Malayalam clusters — punctuation clusters carry no sound.
        const n = clustersOf(p.text).filter(isMalayalamCluster).length;
        if (!syllabify(p.pronunciation, n)) {
          fail(`${seg.id}: "${p.text}" (${n} clusters) ↮ sound "${p.pronunciation}" — syllabify fallback`);
        }
      }
    }
  }
}

if (failures) {
  console.error(`\n${failures} surface-law violation(s).`);
  process.exit(1);
}
console.log('✓ surface law holds: all Malayalam pieces reconstruct their written surface, all sounds slice cleanly.');

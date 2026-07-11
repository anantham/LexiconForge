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
  // 0. Alignment integrity: every token binding points at a real unit, and
  //    every unit is realized by at least one Malayalam token (no dead spine
  //    slots). English chunks must reconstruct the sentence gloss exactly.
  if (seg.units.length > 0) {
    const unitIds = new Set(seg.units.map((u) => u.id));
    const realized = new Set<string>();
    for (const r of seg.renderings) {
      for (const t of r.tokens) {
        for (const u of t.units) {
          if (!unitIds.has(u)) fail(`${seg.id}: token "${t.text}" binds unknown unit "${u}"`);
          if (r.lang.startsWith('ml')) realized.add(u);
        }
      }
    }
    for (const u of seg.units) {
      if (!realized.has(u.id)) fail(`${seg.id}: unit "${u.id}" realized by no Malayalam token`);
    }
    // Chunks-reconstruct-the-translation is the CONVERTER's contract (its
    // gloss IS the english.json sentence). Hand-curated segments carry clause
    // summaries as glosses — exempt (their ids are urk-title / urk-s1c*).
    const generated = /^urk-p\d/.test(seg.id);
    const enR = seg.renderings.find((r) => r.lang === 'en');
    if (generated && enR && seg.gloss && enR.tokens.length > 1) {
      const joined = enR.tokens.map((t) => t.text).join(' ').replace(/\s+/g, ' ').trim();
      const gloss = seg.gloss.replace(/\s+/g, ' ').trim();
      if (joined !== gloss) fail(`${seg.id}: en chunks join ≠ translation:\n  "${joined}"\n  "${gloss}"`);
    }
  }
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

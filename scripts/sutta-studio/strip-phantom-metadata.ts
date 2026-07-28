#!/usr/bin/env npx tsx
/**
 * One-shot subtractive cleanup: remove the four V2 metadata fields that
 * never render in default-on UI paths.
 *
 *   Sense.epistemicBasis     — rendered in LensPanel only, behind curator-badges
 *                              toggle that's OFF by default. Also: the LLM-
 *                              assigned values are confident-sounding
 *                              hallucinations; the model can't actually verify
 *                              whether a sense is DPD-attested vs curatorial
 *                              without doing the lookup.
 *   Sense.confidence         — same. high/medium/low levels are not grounded.
 *   Sense.sourceCitationIds  — never rendered. Redundant with the rendered
 *                              `citationIds` field.
 *   Segment.morph            — never rendered anywhere in the UI. Was study-
 *                              mode infrastructure without the study-mode
 *                              consumer.
 *
 * Why strip rather than keep dormant: the data lives in demoPacket.json which
 * is read every page load; carrying dead fields adds ~10% packet size for
 * zero reader value, AND signals to future agents that these fields matter,
 * inviting them to be reproduced or refilled.
 *
 * The schema definitions in types/suttaStudio.ts are NOT removed (separate
 * concern; can be deleted in a follow-up PR if confirmed unused). This
 * script only strips populated DATA.
 *
 * Idempotent — re-running on already-stripped data is a no-op.
 */

import * as fs from 'fs';
import * as path from 'path';

// ─────────────────────────────────────────────────────────────────────────────
// HALT (integrity scan 2026-07): DO NOT RUN.
// This May-era one-off targeted components/sutta-studio/demoPacket.json, which
// was DELETED 2026-05-19 — its content moved to content/references/sutta/mn10.json
// and has been HAND-CURATED since. Re-pointing this destructive field strip at
// the curated flagship packet would re-apply a one-shot migration to adjudicated
// data (e.g. morph fields are deliberately present again in curated phases).
// Do not repoint or re-enable without re-adjudicating the transform.
// ─────────────────────────────────────────────────────────────────────────────
const HALTED = true as boolean; // branch form so tsc keeps type-checking the code below
if (HALTED) {
  console.error(
    'HALTED: strip-phantom-metadata.ts is a May-era one-off whose target ' +
      '(components/sutta-studio/demoPacket.json) was deleted 2026-05-19. The packet now lives at ' +
      'content/references/sutta/mn10.json and is hand-curated — this transform must not run against ' +
      'it without re-adjudication. See the HALT comment at the top of this file.'
  );
  process.exit(1);
}

const PACKET_PATH = path.resolve('components/sutta-studio/demoPacket.json');
const packet = JSON.parse(fs.readFileSync(PACKET_PATH, 'utf-8'));

let strippedSenses = 0;
let strippedMorph = 0;

for (const ph of packet.phases ?? []) {
  for (const w of ph.paliWords ?? []) {
    for (const sn of w.senses ?? []) {
      let touched = false;
      if ('epistemicBasis' in sn) {
        delete sn.epistemicBasis;
        touched = true;
      }
      if ('confidence' in sn) {
        delete sn.confidence;
        touched = true;
      }
      if ('sourceCitationIds' in sn) {
        delete sn.sourceCitationIds;
        touched = true;
      }
      if (touched) strippedSenses++;
    }
    for (const seg of w.segments ?? []) {
      if ('morph' in seg) {
        delete seg.morph;
        strippedMorph++;
      }
    }
  }
}

fs.writeFileSync(PACKET_PATH, JSON.stringify(packet, null, 2) + '\n');

console.log(`Stripped phantom metadata:`);
console.log(`  Senses with epistemicBasis/confidence/sourceCitationIds removed: ${strippedSenses}`);
console.log(`  Segments with morph removed: ${strippedMorph}`);

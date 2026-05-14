/**
 * Apply the grounding pass to demoPacket.json.
 *
 * TypeScript successor to scripts/sutta-studio/apply-contested-terms.py.
 * Same semantics, same idempotency, single source of truth shared with
 * the in-app compiler pass.
 *
 * The Python script remains in the tree for now as historical reference
 * (and as the script that ran during Phase 1.5). Future runs should use
 * THIS script — it imports the canonical pass, so any improvement to the
 * pass flows here automatically.
 *
 * Per docs/sutta-studio/GROUNDING.md §"What's missing → Gap E" — this is
 * the production consumer of the pass for offline (build-time) grounding.
 * In-app compilation will eventually call runGroundingPass directly
 * inside the compiler pipeline.
 *
 * Usage:
 *     npx tsx scripts/sutta-studio/ground-packet.ts
 */

import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ContestedTermProvider } from '../../services/sutta-studio/grounding/contestedTermProvider';
import { runGroundingPass, applyGroundingToPhase } from '../../services/sutta-studio/passes/grounding';
import type { PhaseView, Citation } from '../../types/suttaStudio';

const __filename = fileURLToPath(import.meta.url);
const ROOT = resolve(__filename, '../../..');
const PACKET_PATH = resolve(ROOT, 'components/sutta-studio/demoPacket.json');
const REGISTRY_PATH = resolve(ROOT, 'data/sutta-studio/grounding/contested-terms.json');

type Packet = {
  phases?: PhaseView[];
  citations?: Citation[];
  [k: string]: unknown;
};

async function main(): Promise<number> {
  const [packetRaw, registryRaw] = await Promise.all([
    readFile(PACKET_PATH, 'utf-8'),
    readFile(REGISTRY_PATH, 'utf-8'),
  ]);

  const packet = JSON.parse(packetRaw) as Packet;
  const registry = JSON.parse(registryRaw);

  const provider = new ContestedTermProvider(registry);
  const providers = [provider];

  packet.citations ??= [];
  packet.phases ??= [];

  const existingCitationIds = new Set(packet.citations.map((c) => c.id));
  let citationsAdded = 0;
  let sensesTouched = 0;

  for (const phase of packet.phases) {
    const sensesBefore = countSensesWithCitations(phase);

    const result = await runGroundingPass(phase, providers);

    for (const cite of result.citationsAdded) {
      if (!existingCitationIds.has(cite.id)) {
        existingCitationIds.add(cite.id);
        packet.citations.push(cite);
        citationsAdded++;
      }
    }
    applyGroundingToPhase(phase, result);

    const sensesAfter = countSensesWithCitations(phase);
    sensesTouched += Math.max(0, sensesAfter - sensesBefore);

    if (result.matches.length > 0) {
      console.log(
        `  ${phase.id}: ${result.matches.length} matches, ` +
          `${result.citationIdsByWord.size} words wired`
      );
    }
  }

  if (citationsAdded === 0 && sensesTouched === 0) {
    console.log('Nothing changed — already grounded (idempotent).');
    return 0;
  }

  await writeFile(
    PACKET_PATH,
    JSON.stringify(packet, null, 2) + '\n',
    'utf-8'
  );

  console.log(
    `\nGrounded: ${citationsAdded} new citations added; ` +
      `${sensesTouched} additional senses gained chips.`
  );
  return 0;
}

function countSensesWithCitations(phase: PhaseView): number {
  let n = 0;
  for (const w of phase.paliWords ?? []) {
    for (const s of w.senses ?? []) {
      if (s.citationIds && s.citationIds.length > 0) n++;
    }
  }
  return n;
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error(err);
    process.exit(1);
  }
);

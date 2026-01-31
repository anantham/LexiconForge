#!/usr/bin/env npx tsx
/**
 * backfill-validation.ts
 *
 * Adds validation issues to existing packets that were created before the validator.
 * Run with: npx tsx scripts/sutta-studio/backfill-validation.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { validatePacket, attachValidationToPacket } from '../../services/suttaStudioPacketValidator';
import type { DeepLoomPacket } from '../../types/suttaStudio';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPORTS_DIR = path.join(__dirname, '../../reports/sutta-studio');

async function main() {
  console.log('Backfilling validation issues on existing packets...\n');

  let updated = 0;
  let skipped = 0;

  // Find all timestamp directories
  const entries = fs.readdirSync(REPORTS_DIR, { withFileTypes: true });
  const timestampDirs = entries
    .filter((e) => e.isDirectory() && /^\d{4}-\d{2}-\d{2}/.test(e.name))
    .map((e) => e.name);

  for (const timestamp of timestampDirs) {
    const outputsDir = path.join(REPORTS_DIR, timestamp, 'outputs');
    if (!fs.existsSync(outputsDir)) continue;

    const modelDirs = fs.readdirSync(outputsDir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name);

    for (const modelId of modelDirs) {
      const packetPath = path.join(outputsDir, modelId, 'packet.json');
      if (!fs.existsSync(packetPath)) continue;

      try {
        const packetJson = fs.readFileSync(packetPath, 'utf-8');
        const packet: DeepLoomPacket = JSON.parse(packetJson);

        // Skip if already has validation
        if (packet.compiler?.validationIssues !== undefined) {
          skipped++;
          continue;
        }

        // Run validation
        const result = validatePacket(packet, packet.canonicalSegments);

        // Attach validation to packet
        const updatedPacket = attachValidationToPacket(packet, result);

        // Write back
        fs.writeFileSync(packetPath, JSON.stringify(updatedPacket, null, 2));
        updated++;

        if (result.issues.length > 0) {
          console.log(`✓ ${modelId} (${timestamp}): ${result.issues.length} issues`);
        }
      } catch (e) {
        console.error(`✗ Error processing ${packetPath}:`, e);
      }
    }
  }

  console.log(`\nDone. Updated: ${updated}, Skipped (already had validation): ${skipped}`);
}

main().catch(console.error);

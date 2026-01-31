#!/usr/bin/env npx tsx
/**
 * validate-all-packets.ts
 *
 * Validates all existing benchmark packets and reports issues.
 * Run with: npx tsx scripts/sutta-studio/validate-all-packets.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { validatePacket, type ValidationResult } from '../../services/suttaStudioPacketValidator';
import type { DeepLoomPacket } from '../../types/suttaStudio';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPORTS_DIR = path.join(__dirname, '../../reports/sutta-studio');

type PacketValidation = {
  path: string;
  modelId: string;
  timestamp: string;
  result: ValidationResult;
};

async function main() {
  console.log('Scanning for packets in:', REPORTS_DIR);
  console.log('');

  const validations: PacketValidation[] = [];

  // Find all timestamp directories
  const entries = fs.readdirSync(REPORTS_DIR, { withFileTypes: true });
  const timestampDirs = entries
    .filter((e) => e.isDirectory() && /^\d{4}-\d{2}-\d{2}/.test(e.name))
    .map((e) => e.name);

  console.log(`Found ${timestampDirs.length} benchmark runs\n`);

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
        // Validate against the packet's stored source segments
        const result = validatePacket(packet, packet.canonicalSegments);

        validations.push({
          path: packetPath,
          modelId,
          timestamp,
          result,
        });
      } catch (e) {
        console.error(`Error reading ${packetPath}:`, e);
      }
    }
  }

  // Summary
  console.log('=' .repeat(80));
  console.log('VALIDATION SUMMARY');
  console.log('=' .repeat(80));
  console.log('');

  const withIssues = validations.filter((v) => v.result.issues.length > 0);
  const withErrors = validations.filter((v) => !v.result.valid);

  console.log(`Total packets validated: ${validations.length}`);
  console.log(`Packets with issues: ${withIssues.length}`);
  console.log(`Packets with errors: ${withErrors.length}`);
  console.log('');

  // Aggregate issue counts by type
  const issueCounts = new Map<string, number>();
  for (const v of validations) {
    for (const issue of v.result.issues) {
      const count = issueCounts.get(issue.code) ?? 0;
      issueCounts.set(issue.code, count + 1);
    }
  }

  if (issueCounts.size > 0) {
    console.log('Issue counts by type:');
    for (const [code, count] of [...issueCounts.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${code}: ${count}`);
    }
    console.log('');
  }

  // Per-model breakdown
  console.log('-'.repeat(80));
  console.log('PER-MODEL BREAKDOWN');
  console.log('-'.repeat(80));

  const modelStats = new Map<string, { total: number; issues: number; errors: number }>();
  for (const v of validations) {
    const stats = modelStats.get(v.modelId) ?? { total: 0, issues: 0, errors: 0 };
    stats.total++;
    if (v.result.issues.length > 0) stats.issues++;
    if (!v.result.valid) stats.errors++;
    modelStats.set(v.modelId, stats);
  }

  const sortedModels = [...modelStats.entries()].sort((a, b) => b[1].errors - a[1].errors);
  for (const [modelId, stats] of sortedModels) {
    const status = stats.errors > 0 ? '❌' : stats.issues > 0 ? '⚠️' : '✅';
    console.log(`${status} ${modelId}: ${stats.total} packets, ${stats.issues} with issues, ${stats.errors} with errors`);
  }
  console.log('');

  // Detailed issues for packets with errors
  if (withErrors.length > 0) {
    console.log('-'.repeat(80));
    console.log('DETAILED ERRORS');
    console.log('-'.repeat(80));

    for (const v of withErrors) {
      console.log(`\n${v.modelId} (${v.timestamp}):`);
      console.log(`  Phases: ${v.result.stats.totalPhases}`);
      console.log(`  Duplicate segments: ${v.result.stats.duplicateSegments}`);
      console.log(`  Duplicate mappings: ${v.result.stats.duplicateMappings}`);

      const errors = v.result.issues.filter((i) => i.level === 'error');
      if (errors.length > 0) {
        console.log(`  Errors (${errors.length}):`);
        for (const issue of errors.slice(0, 10)) {
          console.log(`    - ${issue.code}: ${issue.message}`);
        }
        if (errors.length > 10) {
          console.log(`    ... and ${errors.length - 10} more`);
        }
      }
    }
  }

  // Write detailed report to file
  const reportPath = path.join(REPORTS_DIR, 'validation-report.json');
  const report = {
    generatedAt: new Date().toISOString(),
    summary: {
      totalPackets: validations.length,
      packetsWithIssues: withIssues.length,
      packetsWithErrors: withErrors.length,
      issueCounts: Object.fromEntries(issueCounts),
    },
    validations: validations.map((v) => ({
      modelId: v.modelId,
      timestamp: v.timestamp,
      valid: v.result.valid,
      stats: v.result.stats,
      issueCount: v.result.issues.length,
      issues: v.result.issues,
    })),
  };

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\nDetailed report written to: ${reportPath}`);
}

main().catch(console.error);

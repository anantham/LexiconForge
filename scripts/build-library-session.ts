#!/usr/bin/env node

/**
 * Build a hosted-library metadata.json + session.json pair from a manifest.
 *
 * Usage:
 *   npm run build-library-session -- /absolute/path/to/manifest.json
 */

import * as fs from 'fs';
import * as path from 'path';

import {
  buildHostedLibraryArtifacts,
  updateRegistryJson,
  type LibraryBuildManifest,
} from './lib/library-session-builder';

function printUsage(): void {
  console.log(`
Build Library Session

Usage:
  npm run build-library-session -- <manifest.json>

Manifest responsibilities:
  - novel metadata
  - version metadata
  - raw source path
  - fan source paths + selected chapter ranges
  - output novels root and optional registry path
`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length !== 1 || args.includes('--help') || args.includes('-h')) {
    printUsage();
    process.exit(args.length === 1 ? 0 : 1);
  }

  const manifestPath = path.resolve(args[0]);
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Manifest not found: ${manifestPath}`);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as LibraryBuildManifest;
  const outputRoot = path.resolve(manifest.output.novelsRoot);
  const novelDir = path.join(outputRoot, manifest.novel.id);
  const metadataFileName = manifest.output.metadataFileName || 'metadata.json';
  const sessionFileName = manifest.output.sessionFileName || 'session.json';
  const reportFileName = manifest.output.reportFileName || 'build-report.json';

  console.log(`\n🏗️ Building hosted library artifact for ${manifest.novel.title}`);
  console.log(`   Output: ${novelDir}`);

  const { metadata, session, report } = await buildHostedLibraryArtifacts(manifest);

  fs.mkdirSync(novelDir, { recursive: true });

  const sessionPath = path.join(novelDir, sessionFileName);
  fs.writeFileSync(sessionPath, JSON.stringify(session, null, 2));
  const sessionSizeBytes = fs.statSync(sessionPath).size;

  if (metadata.versions?.[0]) {
    metadata.versions[0].stats.fileSize = `${(sessionSizeBytes / 1024 / 1024).toFixed(2)}MB`;
  }

  const metadataPath = path.join(novelDir, metadataFileName);
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

  const reportPath = path.join(novelDir, reportFileName);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  if (manifest.output.registryPath) {
    const registryPath = path.resolve(manifest.output.registryPath);
    const registry = JSON.parse(fs.readFileSync(registryPath, 'utf-8'));
    const updatedRegistry = updateRegistryJson(registry, manifest);
    fs.writeFileSync(registryPath, JSON.stringify(updatedRegistry, null, 2) + '\n');
  }

  console.log('\n✅ Build complete');
  console.log(`   Session: ${sessionPath}`);
  console.log(`   Metadata: ${metadataPath}`);
  console.log(`   Report: ${reportPath}`);
  console.log(`   Chapters: ${report.sessionChapterCount}`);
  console.log(`   Fan translations attached: ${report.translatedChapterCount}`);
  console.log(`   Warnings: ${report.warnings.length}`);
}

main().catch((error: any) => {
  console.error(`\n❌ Build failed: ${error.message}`);
  process.exit(1);
});

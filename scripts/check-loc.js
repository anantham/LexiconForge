#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const MAX_LINES = {
  services: 800,
  components: 500,
  default: 300,
};

const EXCLUDED_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'coverage',
  'public',
  'session-files',
  'docs',
]);

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const isTsFile = (filePath) => filePath.endsWith('.ts') || filePath.endsWith('.tsx');

const categorize = (relativePath) => {
  const [topLevel] = relativePath.split(path.sep);
  if (topLevel === 'services') return 'services';
  if (topLevel === 'components') return 'components';
  return 'default';
};

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const results = [];

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;

    const absolutePath = path.join(dir, entry.name);
    const relativePath = path.relative(ROOT_DIR, absolutePath);

    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry.name)) continue;
      results.push(...(await walk(absolutePath)));
    } else if (isTsFile(entry.name) && !relativePath.startsWith(`tests${path.sep}`)) {
      const content = await fs.readFile(absolutePath, 'utf8');
      const lines = content.split(/\r?\n/).length;
      const category = MAX_LINES[categorize(relativePath)];

      if (lines > category) {
        results.push({ relativePath, lines, limit: category });
      }
    }
  }

  return results;
}

(async () => {
  try {
    const oversizedFiles = await walk(ROOT_DIR);

    if (oversizedFiles.length === 0) {
      console.log('✅ All tracked files are within LOC limits');
      return;
    }

    console.log('⚠️  Files exceeding LOC guardrails:\n');
    oversizedFiles
      .sort((a, b) => b.lines - a.lines)
      .forEach(({ relativePath, lines, limit }) => {
        const over = lines - limit;
        const percent = ((over / limit) * 100).toFixed(1);
        console.log(`  ${relativePath}: ${lines} lines (limit ${limit}, +${over} / ${percent}% over)`);
      });

    console.log(`\nTotal oversized files: ${oversizedFiles.length}`);
    process.exitCode = 0; // Warning-only for now
  } catch (error) {
    console.error('Failed to run LOC check:', error);
    process.exitCode = 1;
  }
})();

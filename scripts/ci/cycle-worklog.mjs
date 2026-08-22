#!/usr/bin/env node
/**
 * WORKLOG archiver (invoked by scripts/cycle-worklog.sh).
 *
 * Fixes the 2026-08-22 audited failure: the old script anchored its date grep
 * on "^YYYY-MM" which can never match "### [YYYY-MM ..." headers, so it always
 * fell back to archiving the LAST 100 LINES — while agents append newer
 * entries at the bottom, i.e. it archived the newest work first.
 *
 * New semantics:
 * - Entry boundaries are "### [" header lines; each block carries the ISO date
 *   from its own header ("### [YYYY-MM-DD HH:MM ...]"). Content before the
 *   first block is preamble and always kept.
 * - Blocks strictly OLDER than KEEP_SINCE (default: first day of previous
 *   month) move to docs/archive/WORKLOG-<today>-archive.md in document order.
 * - Undated/unparseable blocks NEVER archive (loud warning instead).
 * - DRY-RUN BY DEFAULT. Pass --apply to actually rewrite WORKLOG.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const APPLY = process.argv.includes('--apply');
const ROOT = process.cwd();
const WORKLOG = join(ROOT, 'docs', 'WORKLOG.md');
const ARCHIVE_DIR = join(ROOT, 'docs', 'archive');

if (!existsSync(WORKLOG)) {
  console.error(`[cycle-worklog] ${WORKLOG} not found`);
  process.exit(0);
}

const raw = readFileSync(WORKLOG, 'utf8');
if (APPLY === false && !process.argv.includes('--dry-run') && !APPLY) {
  // unreachable; kept explicit below
}
const lines = raw.split('\n');

// Split into preamble + blocks.
let preambleEnd = lines.findIndex(l => l.startsWith('### ['));
if (preambleEnd === -1) {
  console.error('[cycle-worklog] No "### [" entry headers found — refusing to act.');
  process.exit(1);
}

// Retention boundary: first day of the previous month (local time).
const now = new Date();
const keepSince = new Date(now.getFullYear(), now.getMonth() - 1, 1);
console.log(`[cycle-worklog] Keeping entries dated >= ${keepSince.toISOString().slice(0, 10)}${APPLY ? '' : ' (DRY RUN)'}`);

const headerRe = /^### \[(\d{4})-(\d{2})-(\d{2})/;
const blocks = []; // {start, end, date}
for (let i = preambleEnd; i < lines.length; i++) {
  const m = lines[i].match(headerRe);
  if (m) {
    if (blocks.length) blocks[blocks.length - 1].end = i;
    blocks.push({ start: i, end: lines.length, date: new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) });
  }
}
if (blocks.length) blocks[blocks.length - 1].end = lines.length;

const stale = [], undated = [];
for (const b of blocks) {
  if (isNaN(b.date)) undated.push(b);
  else if (b.date < keepSince) stale.push(b);
}
undated.forEach(b => console.warn(`[cycle-worklog] WARNING: unparseable header kept in place: "${lines[b.start].slice(0, 60)}…"`));

if (!stale.length) {
  console.log('[cycle-worklog] Nothing to archive.');
  process.exit(0);
}

const archiveLines = [];
for (const b of stale) archiveLines.push(...lines.slice(b.start, b.end));
const keptLines = [
  ...lines.slice(0, preambleEnd),
  ...blocks.filter(b => !stale.includes(b)).flatMap(b => lines.slice(b.start, b.end)),
];

mkdirSync(ARCHIVE_DIR, { recursive: true });
const archiveName = `WORKLOG-${now.toISOString().slice(0, 10)}-archive.md`;
const archivePath = join(ARCHIVE_DIR, archiveName);

console.log(`[cycle-worklog] Would archive ${stale.length} entr${stale.length === 1 ? 'y' : 'ies'} (${archiveLines.length} lines) -> ${archivePath}`);
console.log(`[cycle-worklog] WORKLOG would go ${lines.length} -> ${keptLines.length + 2} lines`);

if (!APPLY) {
  console.log('[cycle-worklog] DRY RUN only — re-run with --apply to write.');
  process.exit(0);
}

// Append-only archive: never clobber an existing archive file.
if (existsSync(archivePath)) {
  console.error(`[cycle-worklog] Refusing to overwrite existing ${archivePath}; aborting.`);
  process.exit(1);
}
writeFileSync(archivePath, archiveLines.join('\n').replace(/\n{3,}/g, '\n\n') + '\n');
writeFileSync(WORKLOG, keptLines.join('\n').replace(/\n{3,}/g, '\n\n').replace(/\n*$/, '\n') +
  `\n--- Archived entries available at docs/archive/${archiveName} ---\n`);
console.log(`[cycle-worklog] Applied. Archive: ${archivePath}`);

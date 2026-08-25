#!/usr/bin/env node
/**
 * validate-coverage-policy — kills the phantom-glob class (CAP-006).
 * Every threshold glob in config/coverage-policy.json must match at least one
 * real file on disk; a policy entry that matches nothing is a silent lie.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const policy = JSON.parse(readFileSync('config/coverage-policy.json', 'utf8'));

function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.git', 'dist', 'coverage', 'tests'].includes(e.name)) continue;
    const p = join(dir, e.name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const files = walk('.').map(f => f.replace(/^\.\//, ''));

function globToRegex(glob) {
  const esc = glob.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  return new RegExp('^' + esc.replace(/\*\*/g, '::').replace(/\*/g, '[^/]*').replace(/::/g, '.*') + '$');
}

let failed = false;
for (const entry of policy.entries ?? []) {
  const re = globToRegex(entry.glob);
  const matches = files.filter(f => re.test(f));
  if (matches.length === 0) {
    console.error(`[coverage-policy] PHANTOM: "${entry.glob}" matches no file on disk (owner: ${entry.owner ?? 'unassigned'})`);
    failed = true;
  } else {
    console.log(`[coverage-policy] ${entry.glob} -> ${matches.length} file(s), floors L${entry.lines}/F${entry.functions}`);
  }
}

if (!policy.perFile) {
  console.error('[coverage-policy] perFile must be true — glob thresholds are otherwise aggregate lies');
  failed = true;
}

process.exit(failed ? 1 : 0);

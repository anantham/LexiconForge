#!/usr/bin/env node
/**
 * validate-coverage-policy — closes the phantom-glob class (CAP-006) without
 * reopening a fail-open variant: globs are matched against the EFFECTIVE
 * instrumented set (include roots minus excludes), not raw disk files, so a
 * floor on a real-but-uninstrumented file also fails loudly.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const policyPath = process.env.COVERAGE_POLICY_PATH || 'config/coverage-policy.json';
let policy;
try {
  policy = JSON.parse(readFileSync(policyPath, 'utf8'));
} catch (err) {
  console.error(`[coverage-policy] unreadable/invalid JSON at ${policyPath}: ${err.message}`);
  process.exit(1);
}

function walk(dir, out = []) {
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    if (['node_modules', '.git', 'dist', 'coverage'].includes(e.name)) continue;
    const p = join(dir, e.name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p.replace(/^\.\//, ''));
  }
  return out;
}

function globToRegex(glob) {
  const esc = glob.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  return new RegExp('^' + esc.replace(/\*\*/g, '::').replace(/\*/g, '[^/]*').replace(/::/g, '.*') + '$');
}

// Fail-closed structure checks.
const failures = [];
if (!Array.isArray(policy.entries) || policy.entries.length === 0) {
  console.error('[coverage-policy] FAIL: entries must be a non-empty array');
  process.exit(1);
}
for (const [i, e] of policy.entries.entries()) {
  if (typeof e.glob !== 'string' || !e.glob) failures.push(`entries[${i}].glob missing`);
  if (!Number.isFinite(e.lines) || !Number.isFinite(e.functions)) failures.push(`entries[${i}] floors must be numeric`);
}
if (Object.values(policy.global ?? {}).some(v => v > 0)) {
  failures.push('positive global floors need the aggregate enforcement mechanism (perFile:true makes them per-file); keep 0 until it exists');
}
if (failures.length) {
  console.error('[coverage-policy] FAIL:\n' + failures.map(f => '  - ' + f).join('\n'));
  process.exit(1);
}

// Effective instrumented set: include roots minus excludes (mirrors vitest.config.ts).
const includeRes = (policy.include ?? []).map(globToRegex);
const excludeRes = [
  /(^|\/)(node_modules|\.git|dist|coverage)\//,
  /\.d\.ts$/,
  /\.d\.cts$/,
  /services\/audio\/storage\/(cache|opfs)\.ts$/,
].map(r => r.source ? r : r);
const extraExcludes = [/tests\//];
const files = walk('.').filter(f =>
  includeRes.some(re => re.test(f)) &&
  !excludeRes.some(re => re.test(f)) &&
  !extraExcludes.some(re => re.test(f))
);

for (const entry of policy.entries) {
  const re = globToRegex(entry.glob);
  const matches = files.filter(f => re.test(f));
  if (matches.length === 0) {
    // Distinguish: phantom vs real-but-outside-instrumented-scope
    const onDiskRaw = walk('.').filter(f => re.test(f));
    if (onDiskRaw.length > 0) {
      console.error(`[coverage-policy] FAIL: "${entry.glob}" matches ${onDiskRaw.length} disk file(s) but NONE in the instrumented coverage set (outside include roots or excluded) — floor would silently enforce nothing (owner: ${entry.owner ?? 'unassigned'})`);
    } else {
      console.error(`[coverage-policy] PHANTOM: "${entry.glob}" matches no file on disk (owner: ${entry.owner ?? 'unassigned'})`);
    }
    process.exitCode = 1;
  } else {
    console.log(`[coverage-policy] ${entry.glob} -> ${matches.length} instrumented file(s), floors L${entry.lines}/F${entry.functions}`);
  }
}

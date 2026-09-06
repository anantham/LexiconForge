#!/usr/bin/env node
/** Validate earned floors against the fresh report produced by Vitest. */
import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import picomatch from 'picomatch';

const policyPath = process.env.COVERAGE_POLICY_PATH || 'config/coverage-policy.json';
let policy;
try {
  policy = JSON.parse(readFileSync(policyPath, 'utf8'));
} catch (err) {
  console.error(`[coverage-policy] unreadable/invalid JSON at ${policyPath}: ${err.message}`);
  process.exit(1);
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

// The measured report is authoritative. Do not predict its file set from a
// second include/exclude implementation. verify:test runs Vitest first.
const reportPath = process.env.COVERAGE_REPORT_PATH || 'coverage/coverage-final.json';
let coverage;
try {
  coverage = JSON.parse(readFileSync(reportPath, 'utf8'));
} catch (err) {
  console.error(`[coverage-policy] unreadable/invalid coverage report at ${reportPath}: ${err.message}. Run the coverage suite first.`);
  process.exit(1);
}
if (!coverage || Array.isArray(coverage) || typeof coverage !== 'object' || Object.keys(coverage).length === 0) {
  console.error(`[coverage-policy] FAIL: ${reportPath} must contain a non-empty measured coverage map`);
  process.exit(1);
}
const files = Object.keys(coverage).map(file => relative(process.cwd(), file).replace(/\\/g, '/'));
for (const entry of policy.entries) {
  // Same matcher and root-relative paths as Vitest's resolveThresholds.
  const matchesGlob = picomatch(entry.glob);
  const matches = files.filter(file => matchesGlob(file));
  if (matches.length === 0) {
    console.error(`[coverage-policy] FAIL: "${entry.glob}" matches no measured file in ${reportPath} — floor would enforce nothing (owner: ${entry.owner ?? 'unassigned'})`);
    process.exitCode = 1;
  } else {
    console.log(`[coverage-policy] ${entry.glob} -> ${matches.length} measured file(s), floors L${entry.lines}/F${entry.functions}`);
  }
}

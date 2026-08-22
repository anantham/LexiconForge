#!/usr/bin/env node
/**
 * verify:integrity — repository integrity gate (ADR CORE-013).
 *
 * 1. Repo-wide: no git conflict markers on any tracked file.
 * 2. If BASE_SHA is provided (pull_request events): two-tree whitespace/
 *    marker diff between the exact base commit and HEAD — no merge-base
 *    guessing, no shallow-clone assumptions (BASE_SHA is always fetched
 *    explicitly by the workflow).
 *
 * Exits non-zero with a printed finding list.
 */
import { execFileSync } from 'node:child_process';

const run = (cmd, args, opts = {}) =>
  execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opts });

let failed = false;

// 1. Conflict markers anywhere in tracked files.
try {
  const hits = run('git', ['grep', '-nE', '^(<{7}|>{7})']).trim();
  if (hits) {
    failed = true;
    console.error('Conflict markers found:\n' + hits);
  } else {
    console.log('integrity: no conflict markers');
  }
} catch (err) {
  // git grep exits 1 when there are zero matches — that is success.
  if (err.status !== 1) {
    console.error('integrity: marker grep failed to run:', err.message);
    process.exit(1);
  }
  console.log('integrity: no conflict markers');
}

// 2. Two-tree diff --check against the exact base SHA (PR events only).
const baseSha = process.env.BASE_SHA || '';
if (baseSha && /^[0-9a-f]{40}$/.test(baseSha)) {
  try {
    const out = run('git', ['diff', '--check', baseSha, 'HEAD']).trim();
    if (out) {
      failed = true;
      console.error(`Whitespace/marker errors vs base ${baseSha.slice(0, 12)}:\n` + out);
    } else {
      console.log(`integrity: two-tree diff --check clean vs ${baseSha.slice(0, 12)}`);
    }
  } catch (err) {
    failed = true;
    const outText = String(err.stdout ?? '').trim();
    if (outText) {
      console.error(`Whitespace/marker errors vs base ${baseSha.slice(0, 12)}:\n` + outText);
    } else {
      console.error('integrity: diff --check failed:', err.message);
    }
  }
} else {
  console.log('integrity: BASE_SHA absent (push event) — repo-wide marker grep only');
}

process.exit(failed ? 1 : 0);

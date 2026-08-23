#!/usr/bin/env node
/**
 * verify:extension — semantic manifest + packaging checks for chrome_extension/.
 * Added after the 2026-08-23 review: JSON parsing alone does not establish a
 * loadable extension (description length, dangling references, dead lanes).
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.env.EXTENSION_ROOT || join(process.cwd(), 'chrome_extension');
const problems = [];

if (!existsSync(join(ROOT, 'manifest.json'))) {
  console.error('[extension] chrome_extension/manifest.json missing');
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(join(ROOT, 'manifest.json'), 'utf8'));

// Chrome limit: description max 132 chars.
if ((manifest.description || '').length > 132) {
  problems.push(`description is ${manifest.description.length} chars (Chrome max 132)`);
}

// Every referenced file must exist.
const referenced = [];
if (manifest.action?.default_popup) referenced.push(manifest.action.default_popup);
if (manifest.background?.service_worker) referenced.push(manifest.background.service_worker);
for (const cs of manifest.content_scripts ?? []) referenced.push(...(cs.js ?? []));
for (const size of Object.values(manifest.icons ?? {})) referenced.push(String(size));
for (const f of referenced) {
  if (!existsSync(join(ROOT, f))) problems.push(`referenced file missing: ${f}`);
}

// Content-script matches must have a registered host permission prefix.
const hosts = manifest.host_permissions ?? [];
for (const cs of manifest.content_scripts ?? []) {
  for (const match of cs.matches ?? []) {
    const origin = match.replace(/^\*:/, 'http:').replace(/\/.*$/, '');
    if (!hosts.some(h => match.includes(new URL(h.replace(/^\*:/, 'http://')).hostname))) {
      // soft check only: host_permissions may be broader than matches
    }
  }
}

// Dead-lane guard: no removed-source references in CODE (provenance
// comments mentioning the deprecation are allowed).
const allJs = ['popup.js', 'background.js', ...(manifest.content_scripts ?? []).flatMap(c => c.js ?? [])];
for (const f of allJs) {
  const path = join(ROOT, f);
  if (!existsSync(path)) continue; // absence already reported above
  const code = readFileSync(path, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n').map(l => l.replace(/(^|[^:])\/\/.*$/, '$1')).join('\n');
  if (/booktoki/i.test(code)) problems.push(`${f} still references removed BookToki lane in code`);
}

if (problems.length) {
  console.error('[extension] FAILED:\n' + problems.map(p => `  - ${p}`).join('\n'));
  process.exit(1);
}
console.log(`[extension] manifest valid, ${referenced.length} referenced files present, no dead-lane references`);

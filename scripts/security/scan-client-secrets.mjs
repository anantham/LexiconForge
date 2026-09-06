import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCANNED_EXTENSIONS = new Set(['.css', '.html', '.js', '.json', '.map', '.mjs']);

export const SECRET_PATTERNS = [
  { id: 'private-tailnet-host', pattern: /\b(?:[a-z0-9-]+\.)+ts\.net\b/gi },
  { id: 'provider-sk-token', pattern: /\bsk-[A-Za-z0-9_-]{20,}\b/g },
  { id: 'google-api-key', pattern: /\bAIza[A-Za-z0-9_-]{30,}\b/g },
  { id: 'private-key-block', pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g },
];

async function listFiles(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) return listFiles(absolutePath);
    return SCANNED_EXTENSIONS.has(path.extname(entry.name)) ? [absolutePath] : [];
  }));
  return nested.flat();
}

export function scanText(text, file, canaries = []) {
  const findings = [];

  for (const detector of SECRET_PATTERNS) {
    const pattern = new RegExp(detector.pattern.source, detector.pattern.flags);
    for (const match of text.matchAll(pattern)) {
      findings.push({ file, detector: detector.id, offset: match.index ?? -1 });
    }
  }

  for (const canary of canaries.filter((value) => value.length >= 8)) {
    let offset = text.indexOf(canary);
    while (offset >= 0) {
      findings.push({ file, detector: 'build-canary', offset });
      offset = text.indexOf(canary, offset + canary.length);
    }
  }

  return findings;
}

export async function scanClientArtifacts(directory, canaries = []) {
  const files = await listFiles(directory);
  const findings = [];

  for (const file of files) {
    const text = await fs.readFile(file, 'utf8');
    findings.push(...scanText(text, path.relative(directory, file), canaries));
  }

  return findings;
}

async function main() {
  const directoryArg = process.argv.indexOf('--dir');
  const directory = path.resolve(
    directoryArg >= 0 ? process.argv[directoryArg + 1] : 'dist'
  );
  const canaries = (process.env.LF_CLIENT_SECRET_CANARIES || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  const findings = await scanClientArtifacts(directory, canaries);
  if (findings.length > 0) {
    console.error(`[client-secret-scan] Refusing release: ${findings.length} possible secret occurrence(s).`);
    for (const finding of findings) {
      console.error(`- ${finding.file}: ${finding.detector} at byte ${finding.offset}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(`[client-secret-scan] Passed: ${directory} contains no provider-key patterns, private Tailnet hosts or build canaries.`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((error) => {
    console.error('[client-secret-scan] Failed to inspect build artifacts:', error);
    process.exitCode = 1;
  });
}

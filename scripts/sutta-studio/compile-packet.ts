/**
 * Headless production-pipeline compile — the REAL compiler, not the benchmark shadow.
 *
 * Runs compileSuttaStudioPacket (skeleton → anatomist → lexicographer → weaver/
 * typesetter + morphology + retrievalContext + DPD grounding) for a sutta and
 * writes the resulting DeepLoomPacket to disk. This is what production (the
 * browser app) runs; use it to compile new suttas for publishing and to compare
 * candidate production models on identical input.
 *
 * DPD grounding: the browser bundles every data/dpd/<sutta>/ subset via Vite's
 * import.meta.glob; under tsx that loader silently returns {}. We inject the
 * fs-loaded equivalent so headless compiles match production. Build the subset
 * first if missing: npm run build:dpd -- <uid>
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/sutta-studio/compile-packet.ts \
 *     --uid mn117 --model google/gemini-3-flash-preview [--phase-limit 2] \
 *     [--author sujato] [--lang en] [--out reports/sutta-studio/<auto>]
 *
 * Completion contract: the LAST line on success is "COMPILE COMPLETE <uid> <model>".
 * Downstream steps must gate on that marker, never on a watcher timeout.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { compileSuttaStudioPacket } from '../../services/compiler/index';
import { loadAllDpdSubsetsFromFs } from '../../services/providers/dpd-loader-fs';
import { resolveSettingsForModel } from './benchmark-config';

const argValue = (flag: string): string | undefined => {
  const idx = process.argv.indexOf(flag);
  return idx >= 0 ? process.argv[idx + 1] : undefined;
};

const uid = argValue('--uid');
const modelSlug = argValue('--model');
const author = argValue('--author') ?? 'sujato';
const lang = argValue('--lang') ?? 'en';
const phaseLimitRaw = argValue('--phase-limit');
const phaseLimit = phaseLimitRaw ? Number(phaseLimitRaw) : undefined;

if (!uid || !modelSlug) {
  console.error('Usage: compile-packet.ts --uid <sutta> --model <openrouter-slug> [--phase-limit N] [--out <dir>]');
  process.exit(1);
}

const modelSafe = modelSlug.replace(/[^a-z0-9.-]+/gi, '-');
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const outDir = argValue('--out') ?? path.join('reports', 'sutta-studio', `${stamp}-compile-${uid}-${modelSafe}`);
fs.mkdirSync(outDir, { recursive: true });
const packetPath = path.join(outDir, 'packet.json');

const settings = {
  ...resolveSettingsForModel({
    id: modelSafe,
    provider: 'OpenRouter',
    model: modelSlug,
    apiKeyEnv: 'OPENROUTER_API_KEY',
  }),
  // compileSuttaStudioPacket applies applySuttaStudioModelOverride, which
  // replaces settings.model with suttaStudioModel ?? the hardcoded default
  // (gemini-3-flash). Set the override fields explicitly or every headless
  // run silently compiles with the default model regardless of --model.
  suttaStudioProvider: 'OpenRouter' as const,
  suttaStudioModel: modelSlug,
};

if (!settings.apiKeyOpenRouter) {
  console.error('OPENROUTER_API_KEY missing — run with: npx tsx --env-file=.env.local ...');
  process.exit(1);
}

const dpdData = loadAllDpdSubsetsFromFs();
const dpdSuttas = fs.readdirSync('data/dpd').filter((d) => fs.existsSync(path.join('data', 'dpd', d, 'headwords.json')));
console.log(`[compile-packet] uid=${uid} model=${modelSlug} author=${author} phaseLimit=${phaseLimit ?? 'all'}`);
console.log(`[compile-packet] DPD subsets loaded from fs: ${dpdSuttas.join(', ')} (${Object.keys(dpdData.headwords ?? {}).length} headwords)`);
console.log(`[compile-packet] out: ${packetPath}`);

let lastCheckpoint = 0;
const writePacket = (packet: unknown) => {
  const tmp = packetPath + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(packet, null, 2));
  fs.renameSync(tmp, packetPath);
};

const started = Date.now();
compileSuttaStudioPacket({
  uid,
  lang,
  author,
  settings,
  phaseLimit,
  dpdData,
  onProgress: ({ packet, stage, message }) => {
    const elapsed = Math.round((Date.now() - started) / 1000);
    const ready = packet.progress?.readyPhases ?? 0;
    const total = packet.progress?.totalPhases ?? 0;
    console.log(`[progress +${elapsed}s] stage=${stage} phases=${ready}/${total} ${message ?? ''}`);
    // Checkpoint at most every 15s so a crash/hang leaves recent evidence.
    if (Date.now() - lastCheckpoint > 15_000) {
      writePacket(packet);
      lastCheckpoint = Date.now();
    }
  },
})
  .then((packet) => {
    writePacket(packet);
    const mins = ((Date.now() - started) / 60000).toFixed(1);
    console.log(`[compile-packet] wrote ${packetPath} (${packet.phases?.length ?? 0} phases, ${mins} min)`);
    const issues = packet.compiler?.validationIssues ?? [];
    if (issues.length > 0) console.log(`[compile-packet] validation issues: ${issues.length}`);
    console.log(`COMPILE COMPLETE ${uid} ${modelSlug}`);
  })
  .catch((e) => {
    console.error(`[compile-packet] FAILED after ${((Date.now() - started) / 60000).toFixed(1)} min:`, e);
    process.exit(1);
  });

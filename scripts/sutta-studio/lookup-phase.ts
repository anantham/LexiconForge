#!/usr/bin/env node

/**
 * Hand-curation helper — look up every lemma in a phase across every
 * configured provider.
 *
 * Per ADR SUTTA-008 §Build order step 7: makes phase-by-phase drafting of
 * demoPacket.json grounded in real attestation rather than memory.
 *
 * Usage:
 *   npm run sutta:lookup -- --phase phase-a
 *   npm run sutta:lookup -- --lemmas evaṁ,me,sutaṁ
 *   npm run sutta:lookup -- --phase phase-a --sutta mn10
 *   npm run sutta:lookup -- --json --phase phase-a > /tmp/lookups.json
 *
 * For each lemma the script calls every provider in the registry
 * (SuttaCentralDictionaryProvider via the network, DpdProvider against the
 * committed data/dpd/<sutta>/ subset) and prints per-source blocks. The
 * curator then has every attestation in front of them when drafting the
 * Sense entries + Citation rows for the phase.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  LexiconProviderRegistry,
  SuttaCentralDictionaryProvider,
  DpdProvider,
  SuttaCentralBilaraVariantsProvider,
  SuttaCentralSuttaplexParallelProvider,
  type VariantReading,
  type SuttaplexParallelRef,
} from '../../services/providers';
import { loadDpdSubsetFromFs } from '../../services/providers/dpd-loader-fs';
import type { LexiconEntry } from '../../services/providers/types';
import type { DeepLoomPacket } from '../../types/suttaStudio';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..', '..');

// ─────────────────────────────────────────────────────────────────────────────
// CLI parsing
// ─────────────────────────────────────────────────────────────────────────────

interface CliArgs {
  phase?: string;
  lemmas?: string[];
  sutta?: string;       // override DPD subset; otherwise derived from demoPacket
  emitJson: boolean;
  demoPacketPath: string;
}

const parseArgs = (argv: string[]): CliArgs => {
  const out: CliArgs = {
    emitJson: false,
    demoPacketPath: path.join(REPO_ROOT, 'components', 'sutta-studio', 'demoPacket.json'),
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case '--phase':       out.phase = argv[++i]; break;
      case '--lemmas':      out.lemmas = (argv[++i] ?? '').split(',').map((s) => s.trim()).filter(Boolean); break;
      case '--sutta':       out.sutta = argv[++i]; break;
      case '--json':        out.emitJson = true; break;
      case '--demo-packet': out.demoPacketPath = argv[++i]; break;
      case '--help':
      case '-h':
        printUsage();
        process.exit(0);
      default:
        if (a.startsWith('--')) throw new Error(`unknown flag: ${a}`);
    }
  }
  return out;
};

const printUsage = (): void => {
  console.log(`
sutta-studio lookup-phase — grounded curation helper

Usage:
  npm run sutta:lookup -- --phase <phaseId>
  npm run sutta:lookup -- --lemmas <a>,<b>,<c>
  npm run sutta:lookup -- --phase <phaseId> --sutta <uid>

Modes:
  --phase <id>     Read every paliWord surface form from the named phase
                   in demoPacket.json and look each up.
  --lemmas <list>  Comma-separated lemmas/surfaces to look up directly.

Options:
  --sutta <uid>    DPD subset to load (default: derived from demoPacket
                   source.workId, falling back to "mn10").
  --json           Emit a structured JSON blob to stdout instead of the
                   human-readable report.
  --demo-packet <path>
                   Override the demoPacket location (default:
                   components/sutta-studio/demoPacket.json).
`);
};

// ─────────────────────────────────────────────────────────────────────────────
// Phase → surface-form extraction
// ─────────────────────────────────────────────────────────────────────────────

interface WordTarget {
  wordId: string;
  surface: string;
  wordClass?: string;
}

const extractPhaseTargets = (packet: DeepLoomPacket, phaseId: string): WordTarget[] => {
  const phase = packet.phases.find((p) => p.id === phaseId);
  if (!phase) {
    const known = packet.phases.map((p) => p.id).slice(0, 10).join(', ');
    throw new Error(`phase not found: ${phaseId}. Known (first 10): ${known}…`);
  }
  return phase.paliWords.map((w) => ({
    wordId: w.id,
    surface: (w.segments ?? []).map((s) => s.text).join(''),
    wordClass: w.wordClass,
  }));
};

const extractPhaseCanonicalSegments = (packet: DeepLoomPacket, phaseId: string): string[] => {
  const phase = packet.phases.find((p) => p.id === phaseId);
  return phase?.canonicalSegmentIds ?? [];
};

// ─────────────────────────────────────────────────────────────────────────────
// Lookup
// ─────────────────────────────────────────────────────────────────────────────

interface ProviderLookupResult {
  providerId: string;
  providerLabel: string;
  entries: LexiconEntry[];
  errored?: string;
}

interface LookupResult {
  wordId?: string;
  surface: string;
  wordClass?: string;
  perProvider: ProviderLookupResult[];
}

const lookupAll = async (
  registry: LexiconProviderRegistry,
  target: WordTarget,
): Promise<LookupResult> => {
  const perProvider: ProviderLookupResult[] = [];
  for (const provider of registry.list()) {
    try {
      const entries = await provider.lookup(target.surface);
      perProvider.push({ providerId: provider.id, providerLabel: provider.label, entries });
    } catch (e) {
      perProvider.push({
        providerId: provider.id,
        providerLabel: provider.label,
        entries: [],
        errored: e instanceof Error ? e.message : String(e),
      });
    }
  }
  return { wordId: target.wordId, surface: target.surface, wordClass: target.wordClass, perProvider };
};

// ─────────────────────────────────────────────────────────────────────────────
// Pretty-printing
// ─────────────────────────────────────────────────────────────────────────────

const truncate = (s: string, n: number): string =>
  s.length <= n ? s : s.slice(0, n - 1).trimEnd() + '…';

const renderProviderBlock = (p: ProviderLookupResult): string => {
  if (p.errored) return `  ✗ ${p.providerLabel} (errored): ${p.errored}`;
  if (p.entries.length === 0) return `  ✗ ${p.providerLabel}: (no entry)`;
  const lines: string[] = [`  ✓ ${p.providerLabel} (${p.entries.length} ${p.entries.length === 1 ? 'entry' : 'entries'}):`];
  for (const e of p.entries) {
    const firstSense = e.senses?.[0]?.english ?? '(no sense)';
    const pos = e.partOfSpeech ? ` [${e.partOfSpeech}]` : '';
    const morph = e.morphology ? ' ' + JSON.stringify(e.morphology) : '';
    lines.push(`     • ${e.lemma}${pos}: ${truncate(firstSense, 100)}${morph}`);
    if (e.senses && e.senses.length > 1) {
      for (const sense of e.senses.slice(1, 4)) {
        lines.push(`         · ${truncate(sense.english, 100)}${sense.nuance ? ` (${sense.nuance})` : ''}`);
      }
    }
    if (e.citationId) lines.push(`         citationId: ${e.citationId}`);
  }
  return lines.join('\n');
};

const renderTarget = (idx: number, r: LookupResult): string => {
  const head = `[${String(idx + 1).padStart(2)}] ${r.surface}${r.wordClass ? ` (${r.wordClass})` : ''}${r.wordId ? ` — wordId=${r.wordId}` : ''}`;
  const blocks = r.perProvider.map(renderProviderBlock).join('\n');
  return `${head}\n${blocks}`;
};

const renderSummary = (results: LookupResult[]): string => {
  const providerNames = results[0]?.perProvider.map((p) => p.providerLabel) ?? [];
  const coverage = providerNames.map((name) => {
    const hits = results.filter((r) =>
      r.perProvider.find((p) => p.providerLabel === name)?.entries.length! > 0,
    ).length;
    return `  ${name}: ${hits}/${results.length}`;
  }).join('\n');
  const noProvider = results.filter((r) => r.perProvider.every((p) => p.entries.length === 0)).length;
  return [
    '',
    'Summary',
    `  total surface forms: ${results.length}`,
    coverage,
    `  forms with NO provider answering: ${noProvider}`,
  ].join('\n');
};

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

const main = async (): Promise<void> => {
  const args = parseArgs(process.argv.slice(2));
  if (!args.phase && (!args.lemmas || args.lemmas.length === 0)) {
    printUsage();
    process.exit(1);
  }

  // Determine sutta UID + load DPD subset.
  let suttaUid = args.sutta;
  let targets: WordTarget[];
  let phaseSegmentIds: string[] = [];

  if (args.phase) {
    if (!fs.existsSync(args.demoPacketPath)) {
      throw new Error(`demoPacket not found: ${args.demoPacketPath}`);
    }
    const packet = JSON.parse(fs.readFileSync(args.demoPacketPath, 'utf8')) as DeepLoomPacket;
    if (!suttaUid) suttaUid = packet.source?.workId ?? 'mn10';
    targets = extractPhaseTargets(packet, args.phase);
    phaseSegmentIds = extractPhaseCanonicalSegments(packet, args.phase);
  } else {
    if (!suttaUid) suttaUid = 'mn10';
    targets = (args.lemmas ?? []).map((surface, i) => ({ wordId: `arg-${i}`, surface }));
  }

  // Build a fresh registry — never mutate defaultLexiconRegistry from a script.
  const registry = new LexiconProviderRegistry().register(new SuttaCentralDictionaryProvider());
  try {
    const dpdData = loadDpdSubsetFromFs(suttaUid, path.join(REPO_ROOT, 'data', 'dpd'));
    registry.register(new DpdProvider(dpdData));
  } catch (e) {
    console.warn(`[lookup-phase] DPD subset for ${suttaUid} not loaded: ${e instanceof Error ? e.message : e}`);
    console.warn(`[lookup-phase] continuing with SC dictionary_full only`);
  }

  // Phase-level providers (parallels + variants).
  const parallelProvider = new SuttaCentralSuttaplexParallelProvider();
  const variantsProvider = new SuttaCentralBilaraVariantsProvider();
  let allParallels: SuttaplexParallelRef[] = [];
  const phaseVariants: Record<string, VariantReading[]> = {};
  if (args.phase) {
    try {
      allParallels = await parallelProvider.getParallels(suttaUid);
    } catch (e) {
      console.warn(`[lookup-phase] suttaplex parallels failed: ${e instanceof Error ? e.message : e}`);
    }
    for (const segId of phaseSegmentIds) {
      try {
        const variants = await variantsProvider.getVariantsForSegment(segId);
        if (variants.length > 0) phaseVariants[segId] = variants;
      } catch {
        // Silent — missing variant files are normal for stable openings.
      }
    }
  }

  if (!args.emitJson) {
    console.log(`# Lookup report`);
    console.log(`sutta: ${suttaUid}`);
    if (args.phase) console.log(`phase: ${args.phase}`);
    console.log(`providers: ${registry.list().map((p) => p.label).join(', ')}, SC suttaplex, SC bilara variants`);
    console.log('');

    if (args.phase && (allParallels.length > 0 || Object.keys(phaseVariants).length > 0)) {
      console.log('## Phase-level evidence');
      if (allParallels.length > 0) {
        console.log(`  Parallels for ${suttaUid} (top 8 of ${allParallels.length}):`);
        for (const p of allParallels.slice(0, 8)) {
          const seg = p.segmentId ? ` @ ${p.segmentId}` : '';
          console.log(`    → ${p.workId}${seg}: ${p.note ?? ''}`);
        }
      }
      if (Object.keys(phaseVariants).length > 0) {
        console.log(`  Variant readings in this phase:`);
        for (const [segId, variants] of Object.entries(phaseVariants)) {
          for (const v of variants) {
            console.log(`    ${segId}: "${v.original}" → "${v.reading}" (witnesses: ${v.witnesses.join(', ')})`);
          }
        }
      } else if (phaseSegmentIds.length > 0) {
        console.log(`  Variant readings in this phase: (none for ${phaseSegmentIds.join(', ')} — stable across witnesses)`);
      }
      console.log('');
    }
  }

  const results: LookupResult[] = [];
  for (const t of targets) {
    const r = await lookupAll(registry, t);
    results.push(r);
    if (!args.emitJson) {
      console.log(renderTarget(results.length - 1, r));
      console.log('');
    }
  }

  if (args.emitJson) {
    process.stdout.write(JSON.stringify({
      sutta: suttaUid,
      phase: args.phase,
      results,
      parallels: allParallels,
      variants: phaseVariants,
    }, null, 2));
  } else {
    console.log(renderSummary(results));
  }
};

main().catch((e) => {
  console.error('[lookup-phase] FAILED:', e instanceof Error ? e.message : e);
  process.exit(1);
});

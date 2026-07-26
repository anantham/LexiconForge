/**
 * Enrich a committed packet's phases with v13 per-segment senses, at rest.
 *
 * For each requested phase: reconstruct the anatomist from the packet, run the
 * v13 lexicographer (which now asks for segmentSenses on meaningful parts
 * only), merge ONLY the returned segmentSenses onto the packet's segments
 * (existing word-level senses are never touched), and re-expand each enriched
 * word's collapsed English token into per-segment tokens — the morpheme-level
 * weave the production weaver always wanted to emit, now backed by the senses
 * that make it render correctly. repairEnglishStructure preserves exactly this
 * shape (segment links WITH segment senses), so the backstop and validator
 * stay green by construction.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/sutta-studio/enrich-segment-senses.ts \
 *     content/references/sutta/mn117.json phase-16 phase-30 [--write] [--model slug]
 *
 * Dry run prints what would change; --write persists + provenance note.
 */
import * as fs from 'node:fs';
import { runLexicographerPass } from '../../services/sutta-studio/passes/lexicographer';
import { repairEnglishStructure } from '../../services/sutta-studio/utils';
import type { AnatomistPass, CanonicalSegment } from '../../types/suttaStudio';

const args = process.argv.slice(2);
const write = args.includes('--write');
const modelIdx = args.indexOf('--model');
const model = modelIdx >= 0 ? args[modelIdx + 1] : 'google/gemini-3-flash-preview';
const positional = args.filter((a, i) => !a.startsWith('--') && (modelIdx < 0 || i !== modelIdx + 1));
const [packetPath, ...phaseIds] = positional;
if (!packetPath || phaseIds.length === 0) {
  console.error('usage: enrich-segment-senses.ts <packet.json> <phase-id>... [--write] [--model slug]');
  process.exit(1);
}
const key = process.env.OPENROUTER_API_KEY;
if (!key) {
  console.error('OPENROUTER_API_KEY missing (use --env-file=.env.local)');
  process.exit(2);
}

const packet = JSON.parse(fs.readFileSync(packetPath, 'utf8'));
const segsById = new Map<string, any>(
  (packet.canonicalSegments ?? []).map((s: any) => [s.ref.segmentId, s]),
);

const settings: any = {
  provider: 'OpenRouter',
  model,
  apiKeyOpenRouter: key,
  temperature: 0.2,
  maxOutputTokens: 8192,
  contextDepth: 2,
  preloadCount: 0,
  fontSize: 18,
  fontStyle: 'serif',
  lineHeight: 1.7,
  systemPrompt: '',
  imageModel: '',
};

const run = async () => {
  let totalSegSenses = 0;
  let totalExpandedTokens = 0;
  const enrichedPhases: string[] = [];

  for (const pid of phaseIds) {
    const phase = (packet.phases ?? []).find((p: any) => p.id === pid);
    if (!phase) {
      console.error(`  ${pid}: NOT FOUND in packet`);
      continue;
    }
    // Reconstruct the anatomist shape the lexicographer expects.
    const words: any[] = [];
    const segments: any[] = [];
    for (const w of phase.paliWords) {
      const segmentIds: string[] = [];
      for (const s of w.segments) {
        segmentIds.push(s.id);
        segments.push({ id: s.id, text: s.text, type: s.type ?? 'stem' });
      }
      words.push({
        id: w.id,
        surface: w.segments.map((s: any) => s.text).join(''),
        wordClass: w.wordClass ?? 'content',
        isAnchor: Boolean(w.isAnchor),
        segmentIds,
      });
    }
    const anatomist = { id: pid, words, segments } as unknown as AnatomistPass;
    const canonical: CanonicalSegment[] = (phase.canonicalSegmentIds ?? [])
      .map((id: string) => segsById.get(id))
      .filter(Boolean);

    const result = await runLexicographerPass({
      phaseId: pid,
      workId: packet.source?.workId ?? 'unknown',
      segments: canonical,
      anatomist,
      settings,
      structuredOutputs: true,
    });
    const segSenses: Array<{ segmentId: string; senses: any[] }> =
      (result.output as any)?.segmentSenses ?? [];
    if (!segSenses.length) {
      console.log(`  ${pid}: model returned no segmentSenses — leaving phase untouched`);
      continue;
    }

    // Merge senses onto the packet's segments; note which words gained them.
    const bySeg = new Map(segSenses.map((e) => [e.segmentId, e.senses]));
    const enrichedWordIds = new Set<string>();
    for (const w of phase.paliWords) {
      for (const s of w.segments) {
        const senses = bySeg.get(s.id);
        if (senses?.length) {
          s.senses = senses;
          enrichedWordIds.add(w.id);
          totalSegSenses += senses.length;
        }
      }
    }

    // Re-expand English tokens for enriched words: one token per SENSE-BEARING
    // segment, in segment order (the migration had collapsed these to a single
    // word-level token because the senses did not exist yet).
    const expanded: any[] = [];
    for (const t of phase.englishStructure ?? []) {
      const wid = t.linkedPaliId
        ?? (t.linkedSegmentId
          ? phase.paliWords.find((w: any) => w.segments.some((s: any) => s.id === t.linkedSegmentId))?.id
          : undefined);
      const word = wid ? phase.paliWords.find((w: any) => w.id === wid) : undefined;
      if (!t.isGhost && word && enrichedWordIds.has(word.id)) {
        const sensed = word.segments.filter((s: any) => s.senses?.length);
        if (sensed.length >= 2) {
          sensed.forEach((s: any, i: number) => {
            expanded.push({ id: `${t.id}m${i + 1}`, linkedSegmentId: s.id, isGhost: false });
          });
          totalExpandedTokens += sensed.length;
          continue;
        }
      }
      expanded.push(t);
    }
    phase.englishStructure = expanded;
    enrichedPhases.push(pid);

    // Prove the backstop preserves the new shape (no stutter, no dangling).
    const { stats } = repairEnglishStructure(phase);
    console.log(
      `  ${pid}: +${segSenses.length} segment-sense entries, tokens expanded; ` +
      `backstop check → dangling=${stats.droppedDangling} stutter=${stats.collapsedStutter} (want 0/0); ` +
      `cost=$${result.llm?.costUsd ?? '?'}`,
    );
    for (const e of segSenses) {
      console.log(`      ${e.segmentId}: ${e.senses.map((x: any) => x.english).join('; ')}`);
    }
  }

  if (write && enrichedPhases.length) {
    packet.provenance = packet.provenance ?? {};
    packet.provenance.repairs = [
      ...(packet.provenance.repairs ?? []),
      {
        date: new Date().toISOString().slice(0, 10),
        tool: 'enrich-segment-senses',
        model,
        phases: enrichedPhases,
        segmentSensesAdded: totalSegSenses,
        englishTokensExpanded: totalExpandedTokens,
        reason: 'v13 per-segment senses merged at rest; english tokens re-expanded to morpheme level for enriched words.',
      },
    ];
    fs.writeFileSync(packetPath, JSON.stringify(packet));
    console.log(`WRITTEN: ${enrichedPhases.length} phase(s) enriched`);
  } else if (!write) {
    console.log('dry run — re-run with --write to persist');
  }
};

run().catch((e) => {
  console.error('ENRICH FAILED:', e instanceof Error ? e.message : e);
  process.exit(1);
});

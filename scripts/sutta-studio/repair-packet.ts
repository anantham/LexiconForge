/**
 * Offline SUTTA-025 surface repair for already-compiled packets.
 *
 * The compiler now repairs anatomist surfaces in flight, but packets compiled
 * before that (e.g. the first full MN117 run: 100% word coverage, 77 mangled
 * surfaces) predate it. This tool applies the same canonical-text enforcement
 * at the packet level so paid-for compute becomes publishable.
 *
 * Alignment: phases are grouped by their sourceSpan segment tuple (wordRange
 * sub-splits of one segment share the tuple and tile it in phase order), the
 * group's words are matched positionally against the segments' tokens
 * (splitPaliTokens: whitespace + em-dash boundaries), and each mismatched
 * word gets the same three repair moves as the live path: surface fix,
 * single-segment text replace, or multi-segment collapse with the split's
 * pedagogy preserved in tooltips. Groups whose word count disagrees with the
 * token count are SKIPPED (never guess) and reported.
 *
 * Usage:
 *   npx tsx scripts/sutta-studio/repair-packet.ts <packet.json> [--out <path>]
 *   (no --out → writes <packet>.repaired.json next to the input)
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { splitPaliTokens } from '../../services/sutta-studio/utils';
import { validatePacket } from '../../services/suttaStudioPacketValidator';
import type { DeepLoomPacket, PhaseView, ValidationIssue } from '../../types/suttaStudio';

type PhaseWord = PhaseView['paliWords'][number];

const nfc = (s: string) => (s || '').normalize('NFC');

const input = process.argv[2];
if (!input) {
  console.error('Usage: repair-packet.ts <packet.json> [--out <path>]');
  process.exit(1);
}
const outIdx = process.argv.indexOf('--out');
const outPath = outIdx >= 0 ? process.argv[outIdx + 1] : input.replace(/\.json$/, '.repaired.json');

const packet = JSON.parse(fs.readFileSync(input, 'utf8')) as DeepLoomPacket;
const segPali = new Map<string, string>();
for (const seg of packet.canonicalSegments || []) segPali.set(seg.ref.segmentId, seg.pali || '');

// Group phases by their sourceSpan tuple, preserving phase order.
const groups = new Map<string, PhaseView[]>();
for (const phase of packet.phases || []) {
  const span = (phase.sourceSpan || []).map((r) => r.segmentId).join('+');
  const arr = groups.get(span) || [];
  arr.push(phase);
  groups.set(span, arr);
}

let repaired = 0;
let collapsed = 0;
const skips: string[] = [];
const repairIssues: ValidationIssue[] = [];

const repairWord = (word: PhaseWord, expected: string, phaseId: string): void => {
  const segs = word.segments || [];
  const concat = segs.map((s) => s.text || '').join('');
  // Rendered PhaseView words carry no surface field (that's AnatomistWord);
  // the segment concat IS the displayed text, so it alone decides repair.
  if (nfc(concat) === nfc(expected)) {
    if (typeof (word as { surface?: string }).surface === 'string') {
      (word as { surface?: string }).surface = expected;
    }
    return;
  }

  repaired += 1;
  repairIssues.push({
    level: 'warn',
    code: 'surface_repaired',
    phaseId,
    wordId: word.id,
    message: `"${concat}" → "${expected}" (offline SUTTA-025 repair)`,
  });
  if (typeof (word as { surface?: string }).surface === 'string') {
    (word as { surface?: string }).surface = expected;
  }

  if (segs.length <= 1) {
    if (segs[0]) segs[0].text = expected;
    return;
  }
  // Punctuation-only mismatch: absorb edge punctuation into the boundary
  // segments; never destroy a morpheme split for a comma. Mirrors
  // repairAnatomistSurfaces (services/sutta-studio/utils.ts).
  const edges = nfc(expected).match(/^([^a-zA-ZāīūṁṃṅñṭḍṇḷĀĪŪṀṂṄÑṬḌṆḶ]*)(.*?)([^a-zA-ZāīūṁṃṅñṭḍṇḷĀĪŪṀṂṄÑṬḌṆḶ]*)$/u);
  if (edges && nfc(concat) === edges[2]) {
    const [, lead, , trail] = edges;
    if (segs.length === 1) segs[0].text = lead + segs[0].text + trail;
    else {
      if (lead) segs[0].text = lead + segs[0].text;
      if (trail) segs[segs.length - 1].text = segs[segs.length - 1].text + trail;
    }
    return;
  }
  collapsed += 1;
  const seen = new Set<string>();
  const mergedTooltips = segs
    .flatMap((s) => s.tooltips || [])
    .filter((t) => (seen.has(t) ? false : (seen.add(t), true)));
  const analysisNote = `Underlying analysis: ${segs.map((s) => s.text).filter(Boolean).join(' + ')}`;
  const survivor = { ...segs[0], text: expected, tooltips: [...mergedTooltips, analysisNote].slice(0, 8) };
  word.segments = [survivor];
};

for (const [span, phases] of groups) {
  const paliText = span
    .split('+')
    .map((id) => segPali.get(id) || '')
    .join(' ');
  const tokens = splitPaliTokens(paliText);
  const words = phases.flatMap((ph) => ph.paliWords || []);
  if (tokens.length === 0) continue;
  if (words.length !== tokens.length) {
    skips.push(`${span}: ${words.length} words vs ${tokens.length} tokens (phases ${phases.map((p) => p.id).join(',')})`);
    continue;
  }
  words.forEach((word, i) => {
    const phase = phases.find((ph) => (ph.paliWords || []).includes(word))!;
    repairWord(word, tokens[i], phase.id);
  });
}

packet.compiler = packet.compiler
  ? { ...packet.compiler, validationIssues: [...(packet.compiler.validationIssues || []), ...repairIssues] }
  : packet.compiler;

const post = validatePacket(packet);
fs.writeFileSync(outPath, JSON.stringify(packet, null, 2));

console.log(`repaired words: ${repaired} (${collapsed} multi-segment collapses)`);
console.log(`skipped groups (never guessed): ${skips.length}`);
skips.slice(0, 8).forEach((s) => console.log('  skip:', s));
console.log(`residual surface mismatches after repair: ${post.stats.surfaceMismatches}`);
console.log(`wrote ${path.resolve(outPath)}`);
console.log(`REPAIR COMPLETE ${input}`);

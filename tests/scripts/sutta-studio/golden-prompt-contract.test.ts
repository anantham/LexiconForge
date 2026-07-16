// @vitest-environment node
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { BENCHMARK_CONFIG } from '../../../scripts/sutta-studio/benchmark-config';

/**
 * The phase/golden contract (review #1): the golden a phase is scored against must cover the SAME
 * Pāli word sequence the prompt shows the model. When it doesn't — because the golden is a slice of
 * a shared segment but the phase has no `wordRange` to slice the prompt to match — the model is
 * prompted with the whole segment yet graded on a fraction of it, so it can report 100% coverage
 * while ignoring most of what it was given.
 *
 * This derives the prompt sequence exactly as the runner does (getSegmentsForPhase +
 * applyWordRangeToSegments) and compares it, normalised, to the golden's word surfaces.
 */

const repo = process.cwd();
const anat = JSON.parse(fs.readFileSync(path.join(repo, 'test-fixtures/sutta-studio-anatomist-golden.json'), 'utf8'));
const segments: Record<string, { pali: string }> = Object.fromEntries(
  JSON.parse(fs.readFileSync(path.join(repo, 'test-fixtures/sutta-studio-golden-from-demo.json'), 'utf8'))
    .skeleton.canonicalSegments.map((s: any) => [s.ref.segmentId, s]),
);
const phaseMeta: Record<string, any> = Object.fromEntries(anat._phases.map((p: any) => [p.phaseId, p]));

// The contract compares the Pāli LETTER sequence: NFC, lowercase, drop everything that isn't a
// Pāli letter — punctuation AND quotes (the golden writes the quotative as `'ti` with an ASCII
// apostrophe while the source prints a curly ‘…’, so quotes must not count).
const norm = (w: string) =>
  w.normalize('NFC').toLowerCase().replace(/[^a-zāīūṁṃṅñṭḍṇḷ]/g, '');

const promptWords = (phaseId: string): string[] | null => {
  const meta = phaseMeta[phaseId];
  if (!meta) return null;
  const full = (meta.canonicalSegmentIds as string[])
    .map((id) => segments[id]?.pali ?? '')
    .join(' ')
    .split(/\s+/)
    .filter(Boolean);
  const wr = meta.wordRange as [number, number] | undefined;
  return wr ? full.slice(wr[0], wr[1]) : full;
};

const goldenWords = (phaseId: string): string[] | null =>
  anat.anatomist[phaseId] ? anat.anatomist[phaseId].words.map((w: any) => w.surface) : null;

/**
 * Phases still failing the contract, tracked so the debt is explicit rather than silently dropped.
 * NOW EMPTY: the sandhi/omission phases were reconciled under the operator-approved
 * one-word-per-whitespace-token policy — joined tokens are one word with the split moved to
 * morpheme segments; omitted words were added (see docs/roadmaps/GOLDEN-CONTRACT-REPAIR.md). Add a
 * phase here only if a real repair must be deferred.
 */
const KNOWN_SANDHI_PENDING = new Set<string>([]);

describe('golden/prompt contract — ranked phases', () => {
  it('every ranked phase either satisfies the contract or is a KNOWN pending sandhi case', () => {
    const violations: string[] = [];
    for (const phaseId of BENCHMARK_CONFIG.phasesToTest) {
      if (KNOWN_SANDHI_PENDING.has(phaseId)) continue;
      const pw = promptWords(phaseId);
      const gw = goldenWords(phaseId);
      if (!pw || !gw) { violations.push(`${phaseId}: missing prompt or golden`); continue; }
      const p = pw.map(norm).join(' ');
      const g = gw.map(norm).join(' ');
      if (p !== g) violations.push(`${phaseId}\n  prompt: ${pw.join(' ')}\n  golden: ${gw.join(' ')}`);
    }
    expect(violations).toEqual([]);
  });

  it('the pending list is honest — every listed phase actually still violates the contract', () => {
    // Keeps KNOWN_SANDHI_PENDING from rotting: if a golden is repaired, this fails until the phase
    // is removed from the list.
    const stillPending = BENCHMARK_CONFIG.phasesToTest.filter((phaseId) => {
      if (!KNOWN_SANDHI_PENDING.has(phaseId)) return false;
      const pw = promptWords(phaseId);
      const gw = goldenWords(phaseId);
      if (!pw || !gw) return true;
      return pw.map(norm).join(' ') !== gw.map(norm).join(' ');
    });
    // Only phases that ARE in phasesToTest are checked; some pending phases may not be ranked.
    const listedAndRanked = BENCHMARK_CONFIG.phasesToTest.filter((p) => KNOWN_SANDHI_PENDING.has(p));
    expect(stillPending.sort()).toEqual(listedAndRanked.sort());
  });
});

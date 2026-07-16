// @vitest-environment node
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { BENCHMARK_CONFIG } from '../../../scripts/sutta-studio/benchmark-config';
import {
  SUTTA_STUDIO_ANATOMIST_EXAMPLE,
  SUTTA_STUDIO_ANATOMIST_EXAMPLE_B,
  SUTTA_STUDIO_ANATOMIST_EXAMPLE_REFRAIN,
} from '../../../config/suttaStudioExamples';

/**
 * A ranked phase must not grade a Pāli sequence that the prompt teaches the model as a worked
 * example — otherwise that phase is scoring the answer key. Review #2 found phase-ad/ag/aj all
 * grading `ātāpī sampajāno satimā`, which phase-aa teaches verbatim (the satipaṭṭhāna refrain
 * recurs). This guard fails if any such leak is present in the ranked set.
 */
const seqOf = (pass: { words: Array<{ surface: string }> }) =>
  pass.words.map((w) => w.surface).join(' ');

describe('phase contract — the ranked set must not leak a worked example', () => {
  const golden = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), 'test-fixtures/sutta-studio-anatomist-golden.json'), 'utf8'),
  ).anatomist as Record<string, { words: Array<{ surface: string }> }>;

  // The three worked examples embedded in the Anatomist prompt (config/suttaStudioExamples), by the
  // sequence they teach. Derived from the actual example objects, so this can't drift from what the
  // model is shown.
  const exampleSeqs = new Map<string, string>([
    ['phase-a', seqOf(SUTTA_STUDIO_ANATOMIST_EXAMPLE)],
    ['phase-b', seqOf(SUTTA_STUDIO_ANATOMIST_EXAMPLE_B)],
    ['phase-aa', seqOf(SUTTA_STUDIO_ANATOMIST_EXAMPLE_REFRAIN)],
  ]);

  it('no ranked phase grades a sequence taught as a worked example', () => {
    const leaks: string[] = [];
    for (const phase of BENCHMARK_CONFIG.phasesToTest) {
      const g = golden[phase];
      if (!g) continue;
      const seq = seqOf(g);
      for (const [exName, exSeq] of exampleSeqs) {
        if (seq === exSeq) leaks.push(`${phase} grades "${seq}" — taught by ${exName}`);
      }
    }
    expect(leaks).toEqual([]);
  });

  it('the worked-example phrases themselves are excluded from the ranked set', () => {
    for (const example of ['phase-a', 'phase-b', 'phase-aa']) {
      expect(BENCHMARK_CONFIG.phasesToTest).not.toContain(example);
    }
  });

  it('every ranked phase has an anatomist golden to score against', () => {
    const missing = BENCHMARK_CONFIG.phasesToTest.filter((p) => !golden[p]);
    expect(missing).toEqual([]);
  });
});

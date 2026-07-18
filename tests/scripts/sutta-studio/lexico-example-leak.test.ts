// @vitest-environment node
//
// Audit C1 — the lexicographer PROMPT shows worked examples (SUTTA_STUDIO_LEXICO_EXAMPLE +
// SUTTA_STUDIO_LEXICO_RIPPLE_EXAMPLE). Any gloss taught there is an answer the model can copy, so
// no gloss may be a graded sense for any word in a RANKED benchmark phase — otherwise senseF1 (30%
// of the ranked score) is contaminated on the sense axis, the same leak class the anatomist guard
// (phase-contract) covers on the segmentation axis. This originally caught `viharati → "dwells"`,
// graded in 8 ranked phases; it was reglossed to `gacchati → "goes"` (absent from the ranked set).
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BENCHMARK_CONFIG } from '../../../scripts/sutta-studio/benchmark-config';
import {
  SUTTA_STUDIO_LEXICO_EXAMPLE,
  SUTTA_STUDIO_LEXICO_RIPPLE_EXAMPLE,
} from '../../../config/suttaStudioExamples';

const norm = (s: string): string => String(s).toLowerCase().trim();
const load = (f: string): any => JSON.parse(readFileSync(join(process.cwd(), 'test-fixtures', f), 'utf8'));
const glossOf = (s: any): string => norm(s?.english ?? s);

describe('lexicographer worked examples do not leak ranked answers (audit C1)', () => {
  it('no gloss taught in a lexico worked example is graded in any ranked phase', () => {
    // Every english gloss shown to the model in the prompt's two worked examples.
    const taught = new Set<string>();
    for (const ex of [SUTTA_STUDIO_LEXICO_EXAMPLE, SUTTA_STUDIO_LEXICO_RIPPLE_EXAMPLE]) {
      for (const entry of ex.senses ?? []) {
        for (const s of entry.senses ?? []) taught.add(glossOf(s));
      }
    }
    expect(taught.size, 'sanity: the examples must teach some glosses').toBeGreaterThan(0);

    const aroot = (() => { const a = load('sutta-studio-anatomist-golden.json'); return a.anatomist ?? a; })();
    const lroot = (() => { const l = load('sutta-studio-lexicographer-golden.json'); return l.lexicographer ?? l; })();
    const ranked: string[] = BENCHMARK_CONFIG.phasesToTest ?? [];
    expect(ranked.length, 'sanity: there must be a ranked phase set').toBeGreaterThan(0);

    const leaks: string[] = [];
    for (const pid of ranked) {
      const l = lroot[pid];
      const a = aroot[pid];
      if (!l || !a) continue;
      const id2surf: Record<string, string> = {};
      for (const w of a.words ?? []) id2surf[w.id] = w.surface;
      for (const entry of l.senses ?? []) {
        const surf = id2surf[entry.wordId] ?? entry.wordId;
        for (const s of entry.senses ?? entry.acceptedSenses ?? []) {
          if (taught.has(glossOf(s))) leaks.push(`${pid}:${surf} → "${glossOf(s)}"`);
        }
      }
    }

    expect(leaks, `worked-example glosses graded in ranked phases:\n${leaks.join('\n')}`).toEqual([]);
  });
});

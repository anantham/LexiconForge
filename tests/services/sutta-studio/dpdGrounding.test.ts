// @vitest-environment node
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  stripTokenEnds,
  extractAnatomistGroundingTokens,
  buildAnatomistGrounding,
} from '../../../services/sutta-studio/dpdGrounding';
import { DpdProvider } from '../../../services/providers/dpd';
import { loadDpdSubsetFromFs } from '../../../services/providers/dpd-loader-fs';

const seg = (pali: string) => ({ pali } as any);

describe('stripTokenEnds', () => {
  it('removes trailing daṇḍa / period / semicolon / comma', () => {
    expect(stripTokenEnds('Idha,')).toBe('Idha');
    expect(stripTokenEnds('abhijjhādomanassaṁ.')).toBe('abhijjhādomanassaṁ');
    expect(stripTokenEnds('abhijjhādomanassaṁ;')).toBe('abhijjhādomanassaṁ');
  });

  it('leaves a clean word untouched, and keeps interior marks', () => {
    expect(stripTokenEnds('kāyānupassī')).toBe('kāyānupassī');
    expect(stripTokenEnds("assasāmī'ti")).toBe("assasāmī'ti"); // interior apostrophe preserved
  });
});

describe('extractAnatomistGroundingTokens', () => {
  it('splits on whitespace, strips end punctuation, and dedupes', () => {
    const tokens = extractAnatomistGroundingTokens([
      seg('Idha, bhikkhave'),
      seg('bhikkhave abhijjhādomanassaṁ.'),
    ]);
    // `bhikkhave` appears twice but is deduped; punctuation is gone.
    expect(tokens.sort()).toEqual(['Idha', 'abhijjhādomanassaṁ', 'bhikkhave']);
  });

  it('collapses the same word that differed only in trailing punctuation', () => {
    // Raw whitespace split (the old behaviour) would keep these as two distinct misses.
    const tokens = extractAnatomistGroundingTokens([seg('x. x; x')]);
    expect(tokens).toEqual(['x']);
  });
});

describe('buildAnatomistGrounding', () => {
  it('returns {} and does not throw when there is no provider', async () => {
    expect(await buildAnatomistGrounding(null, [seg('anything')])).toEqual({});
  });

  // End-to-end hit-rate guard against the committed mn10 DPD subset + golden fixture. This is the
  // whole point of P2.1: the shared, punctuation-stripping tokenization must ground the anatomist
  // at a high rate. The benchmark's old raw whitespace split managed only ~59%.
  it('grounds the mn10 corpus at a high DPD hit rate (fix: ~59% → ~89%)', async () => {
    const repo = process.cwd();
    const fixture = JSON.parse(
      fs.readFileSync(path.join(repo, 'test-fixtures/sutta-studio-golden-from-demo.json'), 'utf8'),
    );
    const segments = fixture.skeleton.canonicalSegments;
    const provider = new DpdProvider(loadDpdSubsetFromFs('mn10', path.join(repo, 'data', 'dpd')));

    const tokens = extractAnatomistGroundingTokens(segments);
    const grounding = await buildAnatomistGrounding(provider, segments);
    const hitRate = Object.keys(grounding).length / tokens.length;

    // Measured 89.3%. Guard well below that so DPD-subset churn doesn't flake the test, but far
    // above the ~59% the raw split produced — this is what would regress if the strip were removed.
    expect(hitRate).toBeGreaterThan(0.8);

    // And the grounding is keyed by the cleaned surface word (how the prompt block labels it):
    // no key carries trailing punctuation.
    for (const key of Object.keys(grounding)) {
      expect(key).toBe(stripTokenEnds(key));
    }
  });
});

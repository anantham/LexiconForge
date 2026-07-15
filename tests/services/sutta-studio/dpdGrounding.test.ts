// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import type { CanonicalSegment } from '../../../types/suttaStudio';
import type { LexiconEntry } from '../../../services/providers/types';
import {
  stripTokenEnds,
  extractAnatomistGroundingTokens,
  buildAnatomistGrounding,
} from '../../../services/sutta-studio/dpdGrounding';
import { DpdProvider } from '../../../services/providers/dpd';
import { loadDpdSubsetFromFs } from '../../../services/providers/dpd-loader-fs';

const seg = (pali: string): CanonicalSegment => ({
  ref: { provider: 'suttacentral', workId: 'mn10', segmentId: 'mn10:test' },
  order: 0,
  pali,
});

const entry = (lemma: string): LexiconEntry => ({ lemma, senses: [{ english: lemma }] });

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

  it('keeps successful lookups and reports individual failures with token context', async () => {
    const lookup = vi.fn(async (token: string) => {
      if (token === 'bhikkhave') throw new Error('fixture lookup failed');
      return token === 'Idha' ? [entry('idha')] : [];
    });
    const warn = vi.fn();

    const result = await buildAnatomistGrounding(
      { lookup },
      [seg('Idha, bhikkhave.')],
      warn,
    );

    expect(result).toEqual({ Idha: [entry('idha')] });
    expect(lookup).toHaveBeenCalledWith('Idha');
    expect(lookup).toHaveBeenCalledWith('bhikkhave');
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('token "bhikkhave"'),
      expect.any(Error),
    );
  });
});

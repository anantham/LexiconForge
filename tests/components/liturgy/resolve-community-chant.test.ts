/**
 * Community-chant resolver — Option B unit tests.
 *
 * Verifies the two guarantees the resolver exists to provide:
 *  1. English witnesses POOL across communities, keyed by `phraseId`, deduped
 *     by `by` — so a reader can cycle every community's translation.
 *  2. Each community's `defaultWitnessBy` LEADS its segments (the renderer's
 *     page default is `witnesses[0]`), while word glosses / notes / section
 *     topology stay each community's own (no cross-community curation).
 *
 * Synthetic data only — no dependency on the real chant corpus, so this test
 * stays green through content migrations and pins the resolver contract.
 */

import { describe, it, expect } from 'vitest';
import { resolveCommunityChant, resolveAll } from '../../../data/liturgy/resolve';
import type { CommunityChant, TripleScriptWitnessSection } from '../../../types/liturgy';

function seg(phraseId: string, witnessBys: string[]) {
  return {
    id: `${phraseId}-seg`,
    phraseId,
    pali: phraseId,
    witnesses: witnessBys.map((by) => ({ by, text: `${by}: ${phraseId}` })),
    words: [{ form: phraseId, gloss: `gloss-for-${phraseId}` }],
  };
}

function community(slug: string, defaultWitnessBy: string, witnessBys: string[]): CommunityChant {
  return {
    contentId: 'demo-chant',
    defaultWitnessBy,
    slug: 'demo-chant',
    sangha: slug,
    title: `${slug} Demo Chant`,
    tradition: 'zen',
    sections: [
      {
        id: 'body',
        shape: 'triple-script-witness',
        segments: [seg('phrase-1', witnessBys), seg('phrase-2', witnessBys)],
      },
    ],
  };
}

const maple = community('maple', 'Soto Zen', ['Literal', 'Soto Zen', 'Red Cedar']);
const bodhi = community('bodhi-sangha', 'Bodhi Sangha', ['Bodhi Sangha']);

function tsw(doc: { sections: unknown[] }): TripleScriptWitnessSection {
  return doc.sections[0] as TripleScriptWitnessSection;
}

describe('resolveCommunityChant', () => {
  const content = { id: 'demo-chant', communities: [maple, bodhi] };

  it('pools witnesses from every community sharing the phraseId, deduped by `by`', () => {
    const resolved = resolveCommunityChant(bodhi, content);
    const bys = tsw(resolved).segments[0].witnesses.map((w) => w.by);
    // Bodhi authored only "Bodhi Sangha" but should now see MAPLE's three too.
    expect(new Set(bys)).toEqual(new Set(['Bodhi Sangha', 'Literal', 'Soto Zen', 'Red Cedar']));
    expect(bys.length).toBe(4); // no duplicates
  });

  it("leads each segment with the community's defaultWitnessBy", () => {
    expect(tsw(resolveCommunityChant(bodhi, content)).segments[0].witnesses[0].by).toBe('Bodhi Sangha');
    expect(tsw(resolveCommunityChant(bodhi, content)).segments[1].witnesses[0].by).toBe('Bodhi Sangha');

    const mapleResolved = resolveCommunityChant(maple, content);
    expect(tsw(mapleResolved).segments[0].witnesses[0].by).toBe('Soto Zen');
    // The page-level default (first unique witness across segments) is the default.
    expect(tsw(mapleResolved).segments[1].witnesses[0].by).toBe('Soto Zen');
  });

  it('keeps word glosses, topology, and framing per-community (only witnesses change)', () => {
    const resolved = resolveCommunityChant(bodhi, content);
    expect(resolved.title).toBe('bodhi-sangha Demo Chant');
    expect(tsw(resolved).segments[0].words).toEqual([{ form: 'phrase-1', gloss: 'gloss-for-phrase-1' }]);
    // contentId / defaultWitnessBy are stripped from the render view.
    expect('contentId' in resolved).toBe(false);
    expect('defaultWitnessBy' in resolved).toBe(false);
  });

  it('does not mutate the input community chant', () => {
    const before = bodhi.sections[0] as TripleScriptWitnessSection;
    const beforeLen = before.segments[0].witnesses.length;
    resolveCommunityChant(bodhi, content);
    expect((bodhi.sections[0] as TripleScriptWitnessSection).segments[0].witnesses.length).toBe(beforeLen);
    expect(beforeLen).toBe(1);
  });

  it('leaves segments without a phraseId pooling only their own witnesses', () => {
    const solo: CommunityChant = {
      contentId: 'solo',
      slug: 'solo',
      sangha: 'maple',
      title: 'Solo',
      tradition: 'zen',
      sections: [
        {
          id: 'body',
          shape: 'triple-script-witness',
          segments: [{ id: 's', pali: 'x', witnesses: [{ by: 'Only', text: 'x' }] }],
        },
      ],
    };
    const resolved = resolveCommunityChant(solo, { id: 'solo', communities: [solo] });
    expect(tsw(resolved).segments[0].witnesses.map((w) => w.by)).toEqual(['Only']);
  });
});

describe('resolveAll', () => {
  it('groups by contentId and resolves every community to a pooled view', () => {
    const docs = resolveAll([maple, bodhi]);
    expect(docs).toHaveLength(2);
    for (const doc of docs) {
      const bys = (doc.sections[0] as TripleScriptWitnessSection).segments[0].witnesses.map((w) => w.by);
      expect(bys.length).toBe(4); // both communities see the full pool
    }
  });
});

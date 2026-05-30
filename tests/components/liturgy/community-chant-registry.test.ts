/**
 * Community-chant registry guards — Option B, against the live registry.
 *
 * Two silent-failure classes the resolver could introduce, both made loud:
 *
 *  1. Route-topology drift. A `(sangha, slug)` route's section + segment IDs
 *     are snapshotted. Merging/migrating a chant must not silently drop a
 *     community's sections or leak another community's into it (the exact
 *     hazard Codex flagged for the Heart Sutra: MAPLE-only sections leaking
 *     into Bodhi). A deliberate change updates the snapshot in review; an
 *     accidental one fails here.
 *
 *  2. Default-witness coverage. The renderer's page default is the first
 *     unique witness (`witnesses[0]`), and a segment missing it silently
 *     falls back to its own first witness (TripleScriptWitness.tsx). So a
 *     community whose `defaultWitnessBy` is absent on some segment would show
 *     another translation as if it were the chosen one. Assert every TSW
 *     segment of a community chant carries that community's default.
 */

import { describe, it, expect } from 'vitest';
import { LITURGY_DOCS_BY_SANGHA, COMMUNITY_CHANTS } from '../../../data/liturgy';
import type {
  LiturgyDoc,
  TripleScriptWitnessSection,
} from '../../../types/liturgy';

function tswSections(doc: LiturgyDoc): TripleScriptWitnessSection[] {
  return doc.sections.filter(
    (s): s is TripleScriptWitnessSection => s.shape === 'triple-script-witness',
  );
}

describe('route topology', () => {
  it('every (sangha, slug) route has a stable section + segment id map', () => {
    const topology: Record<string, Record<string, string[]>> = {};
    for (const [sangha, docs] of Object.entries(LITURGY_DOCS_BY_SANGHA)) {
      for (const [slug, doc] of Object.entries(docs)) {
        const sections: Record<string, string[]> = {};
        for (const section of doc.sections) {
          sections[section.id] =
            section.shape === 'triple-script-witness'
              ? section.segments.map((seg) => seg.id)
              : [];
        }
        topology[`${sangha}/${slug}`] = sections;
      }
    }
    expect(topology).toMatchSnapshot();
  });
});

describe('default-witness coverage', () => {
  it("every community chant's defaultWitnessBy is present on all its TSW segments", () => {
    for (const cc of COMMUNITY_CHANTS) {
      if (!cc.defaultWitnessBy) continue;
      for (const section of tswSections(cc)) {
        for (const seg of section.segments) {
          const present = seg.witnesses.some((w) => w.by === cc.defaultWitnessBy);
          expect(
            present,
            `${cc.sangha}/${cc.slug} segment "${seg.id}" is missing default witness "${cc.defaultWitnessBy}" — the page default would silently fall back to "${seg.witnesses[0]?.by}"`,
          ).toBe(true);
        }
      }
    }
  });

  it('after resolution, each community route leads with its default witness', () => {
    // The page default is the first unique witness across the doc; the
    // resolver floats defaultWitnessBy to the front of each segment, so the
    // first segment's first witness must equal the default.
    for (const cc of COMMUNITY_CHANTS) {
      if (!cc.defaultWitnessBy) continue;
      const resolved = LITURGY_DOCS_BY_SANGHA[cc.sangha]?.[cc.slug];
      expect(resolved, `${cc.sangha}/${cc.slug} not in registry`).toBeTruthy();
      const firstSeg = tswSections(resolved!)[0]?.segments[0];
      expect(firstSeg?.witnesses[0]?.by).toBe(cc.defaultWitnessBy);
    }
  });
});

describe('witness pooling (Enmei pilot)', () => {
  it('pools all four communities-worth of Enmei translations onto each route', () => {
    const expected = new Set(['Literal English gloss', 'Soto Zen', 'Red Cedar Zen', 'Bodhi Sangha']);
    for (const sangha of ['maple', 'bodhi-sangha']) {
      const doc = LITURGY_DOCS_BY_SANGHA[sangha]['enmei-jikku-kannon-gyo'];
      // Take a phrase segment present in both communities (line 1 / kanzeon).
      const phraseSeg = tswSections(doc)
        .flatMap((s) => s.segments)
        .find((seg) => seg.phraseId === 'kan-ze-on');
      expect(phraseSeg, `${sangha} kan-ze-on segment`).toBeTruthy();
      const bys = new Set(phraseSeg!.witnesses.map((w) => w.by));
      expect(bys).toEqual(expected);
    }
  });
});

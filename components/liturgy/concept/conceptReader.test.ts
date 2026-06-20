// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { deriveAlignSegment } from './deriveAlignSegment';
import { heartSutraTitle } from '../../../data/liturgy/heart-sutra-title';
import { BIND, EN_BIND, SPLIT } from '../../../data/liturgy/heart-sutra-bindings';
import { getConcept } from '../../../data/concepts/lookup';
import { getLiturgyDoc } from '../../../data/liturgy';
import type { AlignSegment } from '../../../types/liturgyAlign';

/**
 * Contract test for the concept-aligned reader. The shipped Heart Sutra's
 * alignment depends on hand-curated binding tables (data/liturgy/heart-sutra-
 * bindings.ts) staying in sync with the chant data + the concept registry. These
 * checks fail loudly if a key goes stale, a concept id is renamed, the unit
 * spine drifts, or coverage collapses — before it ships to a public route.
 */

const doc = getLiturgyDoc('maple', 'heart-sutra')!;
const liveSegments = (doc.sections.flatMap((s: any) => s.segments ?? []) as any[]).filter(
  (s) => s.scripts?.length,
);
const derived: AlignSegment[] = liveSegments.map((s) => deriveAlignSegment(s));
const unitIdsOf = (seg: AlignSegment) => new Set(seg.units.map((u) => u.id));

describe('concept reader — binding/derivation contract', () => {
  it('every concept id in BIND, EN_BIND and SPLIT resolves in the registry', () => {
    const ids = new Set<string>();
    for (const list of [...Object.values(BIND), ...Object.values(EN_BIND)]) for (const id of list) ids.add(id);
    for (const pieces of Object.values(SPLIT)) for (const p of pieces) for (const id of p.concepts) ids.add(id);
    const missing = [...ids].filter((id) => !getConcept(id));
    expect(missing, `unknown concept ids in bindings: ${missing.join(', ')}`).toEqual([]);
  });

  it('every SPLIT compound concatenates back to its surface key', () => {
    for (const [surface, pieces] of Object.entries(SPLIT)) {
      const joined = pieces.map((p) => p.text).join('');
      expect(joined, `SPLIT["${surface}"] pieces join to "${joined}"`).toBe(surface);
    }
  });

  it('the hand-authored title is unit-consistent and references real concepts', () => {
    const ids = unitIdsOf(heartSutraTitle);
    for (const r of heartSutraTitle.renderings)
      for (const tok of r.tokens)
        for (const u of tok.units)
          expect(ids.has(u), `title token "${tok.text}" → unknown unit ${u}`).toBe(true);
    const missing = heartSutraTitle.units
      .filter((u) => u.conceptId && !getConcept(u.conceptId))
      .map((u) => u.conceptId);
    expect(missing, `title units name unknown concepts: ${missing.join(', ')}`).toEqual([]);
  });

  it('every derived segment binds tokens only to units present in its own spine', () => {
    for (const seg of derived) {
      const ids = unitIdsOf(seg);
      expect(seg.renderings.length, `segment ${seg.id} has no renderings`).toBeGreaterThan(0);
      for (const r of seg.renderings)
        for (const tok of r.tokens)
          for (const u of tok.units)
            expect(ids.has(u), `segment ${seg.id} token "${tok.text}" → unit ${u} not in spine`).toBe(true);
    }
  });

  it('keeps cross-script coverage above the floor (catches binding drift)', () => {
    let tok = 0;
    let hit = 0;
    for (const seg of derived)
      for (const r of seg.renderings) {
        if (r.lang === 'en') continue;
        for (const t of r.tokens) {
          tok++;
          if (t.units.length) hit++;
        }
      }
    // Healthy value is ~0.40 (the rest are particles/function words with no
    // concept). Floor at 0.30 catches a real collapse (a stale key or renamed
    // concept tanks coverage) without false-failing on small legit changes.
    const cov = hit / tok;
    expect(cov, `cross-script coverage ${(cov * 100).toFixed(0)}% — bindings may have drifted`).toBeGreaterThan(0.3);
  });

  it('aligns the opening prajñāpāramitā compound to wisdom + perfection + practice', () => {
    const units =
      derived
        .flatMap((s) => s.renderings)
        .flatMap((r) => r.tokens)
        .find((t) => t.text === 'प्रज्ञापारमिताचर्यां')?.units ?? [];
    expect(units).toEqual(
      expect.arrayContaining(['concept.wisdom-prajna', 'concept.perfection-paramita', 'concept.practice-carya']),
    );
  });

  it('renders the Sanskrit row as Devanāgarī for every segment (consistent rail)', () => {
    for (const seg of derived) {
      const langs = seg.renderings.map((r) => r.lang);
      expect(langs.includes('sa-Deva'), `segment ${seg.id} fell back to IAST`).toBe(true);
      expect(langs.includes('sa-Latn'), `segment ${seg.id} kept an IAST row (rail inconsistent)`).toBe(false);
    }
  });

  it('per-akshara minimal cut: the compound has प्र·ज्ञा bound to wisdom only', () => {
    const tok = derived
      .flatMap((s) => s.renderings)
      .flatMap((r) => r.tokens)
      .find((t) => t.text === 'प्रज्ञापारमिताचर्यां');
    const wisdomAksharas = (tok?.segments ?? []).filter((p) => p.units?.includes('concept.wisdom-prajna'));
    expect(wisdomAksharas.map((p) => p.text)).toEqual(['प्र', 'ज्ञा']);
  });
});

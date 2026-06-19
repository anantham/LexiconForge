/**
 * Proves the concept-aligned model resolves every token — the property the
 * shipped Sanskrit-centric renderer fails (63% of Tibetan tokens dead).
 *
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import { openingPracticeAligned as seg } from './opening-practice-aligned';
import { getConcept } from '../../concepts/lookup';

describe('concept-aligned phrase: heart-sutra/opening-practice', () => {
  const unitIds = new Set(seg.units.map((u) => u.id));

  it('every token binds to at least one declared unit (NO dead tokens)', () => {
    const dead: string[] = [];
    for (const r of seg.renderings) {
      for (const t of r.tokens) {
        const ok = t.units.length > 0 && t.units.every((u) => unitIds.has(u));
        if (!ok) dead.push(`${r.lang}:"${t.text}"→[${t.units.join(',')}]`);
      }
    }
    expect(dead).toEqual([]);
  });

  it('the Tibetan rendering resolves all 9 tokens (was 63% dead before)', () => {
    const tib = seg.renderings.find((r) => r.lang === 'bo-Tibt')!;
    expect(tib.tokens).toHaveLength(9);
    const resolved = tib.tokens.filter((t) => t.units.length > 0);
    expect(resolved).toHaveLength(9);
  });

  it('grammatical glue is glossed, not dropped (ghost units have plain text)', () => {
    const ghosts = seg.units.filter((u) => u.ghost);
    expect(ghosts.length).toBeGreaterThan(0);
    for (const g of ghosts) {
      expect(g.gloss.trim().length).toBeGreaterThan(0);
      // CURATION_PROTOCOL §3.4 — no grammar jargon in reader text.
      expect(g.gloss).not.toMatch(/genitive|accusative|nominative|locative|ablative|dative|vocative/i);
    }
  });

  it('handles the cases the 1:1 model cannot', () => {
    const sa = seg.renderings.find((r) => r.lang === 'sa-Deva')!;
    // one Sanskrit compound token realizes multiple units (1 → many)
    const compound = sa.tokens.find((t) => t.text === 'प्रज्ञापारमिताचर्यां')!;
    expect(compound.units.length).toBeGreaterThanOrEqual(3);
    // repeated surface token bound to DISTINCT units (no collision)
    const tib = seg.renderings.find((r) => r.lang === 'bo-Tibt')!;
    const spyod = tib.tokens.filter((t) => t.text === 'སྤྱོད་པ');
    expect(spyod).toHaveLength(2);
    expect(spyod[0].units).not.toEqual(spyod[1].units);
  });

  it('content units are attested in ≥2 languages (real cross-language alignment)', () => {
    for (const u of seg.units.filter((u) => !u.ghost)) {
      const langs = seg.renderings.filter((r) => r.tokens.some((t) => t.units.includes(u.id)));
      expect(langs.length, `unit ${u.id} should align across ≥2 languages`).toBeGreaterThanOrEqual(2);
    }
  });

  it('unit.conceptId references resolve in the live concept registry', () => {
    for (const u of seg.units) {
      if (u.conceptId) expect(getConcept(u.conceptId), `${u.conceptId} missing`).toBeTruthy();
    }
  });
});

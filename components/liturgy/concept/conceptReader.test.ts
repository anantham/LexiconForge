// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { deriveAlignSegment } from './deriveAlignSegment';
import { heartSutraTitle } from '../../../data/liturgy/heart-sutra-title';
import { BIND, EN_BIND, SPLIT, SEGMENT_BIND } from '../../../data/liturgy/heart-sutra-bindings';
import { getConcept } from '../../../data/concepts/lookup';
import { WEB_SOURCES } from '../../../data/concepts/heart-sutra-web-sources';
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
  it('every concept id in BIND, EN_BIND, SPLIT and SEGMENT_BIND resolves in the registry', () => {
    const ids = new Set<string>();
    for (const list of [...Object.values(BIND), ...Object.values(EN_BIND)]) for (const id of list) ids.add(id);
    for (const pieces of Object.values(SPLIT)) for (const p of pieces) for (const id of p.concepts) ids.add(id);
    for (const seg of Object.values(SEGMENT_BIND)) for (const list of Object.values(seg)) for (const id of list) ids.add(id);
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

  it('context-scoped overrides fix homograph collisions (no faked meaning on sacred text)', () => {
    const segById = (id: string) => derived.find((s) => s.id === id)!;
    const tok = (id: string, lang: string, text: string) =>
      segById(id).renderings.find((r) => r.lang === lang)?.tokens.find((t) => t.text === text);

    // 滅 in 苦集滅道 is nirodha, a Noble Truth — not the "cease" (anirodha) of 不生不滅.
    expect(tok('middle-no-four-truths', 'zh-Hant', '滅')?.units).toEqual(['concept.four-truths']);
    // 行 in 受想行識 is the saṃskāra aggregate — not caryā (practice).
    expect(tok('middle-no-other-skandhas', 'zh-Hant', '行')?.units).toEqual(['concept.skandha-aggregate']);
    // Tibetan རིག inside མ་རིག་པ is ignorance — not vidyā / mantra.
    expect(tok('middle-no-ignorance', 'bo-Tibt', 'རིག')?.units).toEqual(['concept.ignorance-avidya']);

    // The verb 知 "to know" (≠ the noun jñāna) carries no concept here, but does
    // get its literal word-gloss ("to know") — never the jñāna concept.
    const zhi = tok('mantra-therefore-know', 'zh-Hant', '知');
    expect(zhi?.units).toEqual([]);
    expect(zhi?.gloss).toBe('to know');

    // English "cognition" (= vijñāna / manas, the sixth dhātu) binds to six-faculties, not jñāna.
    const cognition = segById('middle-no-dhatus').renderings
      .find((r) => r.lang === 'en')
      ?.tokens.find((t) => t.text === 'cognition;');
    expect(cognition?.units).toEqual(['concept.six-faculties']);
  });

  it('closes cross-script asymmetries (content words lit in every script that has them)', () => {
    const segById = (id: string) => derived.find((s) => s.id === id)!;
    const tok = (id: string, lang: string, text: string) =>
      segById(id).renderings.find((r) => r.lang === lang)?.tokens.find((t) => t.text === text);

    // English: MAPLE's idiosyncratic skandha words now bind like their siblings.
    expect(tok('emptiness-is-form', 'en', 'preference,')?.units).toEqual(['concept.skandha-aggregate']);
    expect(tok('emptiness-is-form', 'en', 'information,')?.units).toEqual(['concept.skandha-aggregate']);
    expect(tok('middle-no-aging-death', 'en', 'aging')?.units).toEqual(['concept.aging-death-jaramarana']);
    expect(tok('mantra-prajna-spoken', 'en', 'mantra')?.units).toEqual(['concept.mantra-vidya']);

    // Chinese: the rest of a registered phrase, not just its head character.
    expect(tok('result-far-from-inversion', 'zh-Hant', '遠離')?.units).toEqual(['concept.inverted-view-viparyasa']);
    expect(tok('result-ultimate-nirvana', 'zh-Hant', '究竟')?.units).toEqual(['concept.nirvana-extinguishing']);

    // Tibetan: syllable-split rows are regrouped into whole words that bind.
    expect(tok('middle-emptiness-no-form', 'bo-Tibt', 'སྟོང་པ་ཉིད')?.units).toEqual(['concept.emptiness-sunyata']);
    expect(tok('middle-shariputra', 'bo-Tibt', 'ཤཱ་རིའི་བུ')?.units).toEqual(['concept.sariputra-addressee']);
    expect(tok('middle-no-wisdom-no-attainment', 'bo-Tibt', 'ཡེ་ཤེས')?.units).toEqual(['concept.knowledge-jnana']);
    expect(tok('opening-seeing', 'bo-Tibt', 'རྣམ་པར་བལྟའོ')?.units).toEqual(['concept.seeing-vyavalokita']);
  });

  it('unbound tokens make no claim — no "(not aligned yet)" gloss anywhere', () => {
    const glosses = derived
      .flatMap((s) => s.renderings)
      .flatMap((r) => r.tokens)
      .map((t) => t.gloss)
      .filter(Boolean);
    expect(glosses).not.toContain('(not aligned yet)');
  });

  it('web-source citations are merged onto real concepts; Wiktionary titles are native script only', () => {
    for (const [id, cites] of Object.entries(WEB_SOURCES)) {
      const concept = getConcept(id);
      expect(concept, `WEB_SOURCES id ${id} is not a real concept`).toBeTruthy();
      // the registry actually carries them (assembly merge worked)
      const provs = (concept!.citations ?? []).map((c) => c.provenance);
      expect(provs.some((p) => p === 'wiktionary' || p === 'dpd'), `${id} missing merged web source`).toBe(true);
      // Wiktionary entries must be native script (Devanāgarī / Han) — never IAST,
      // which collides with English words (e.g. "gate"). Guards the verification.
      for (const c of cites.filter((x) => x.provenance === 'wiktionary')) {
        expect(/[ऀ-ॿ㐀-鿿]/.test(c.query ?? ''), `${c.short} is not native script`).toBe(true);
      }
    }
  });

  it('every Sanskrit/Chinese word shows a gloss (concept or literal) — no blank hovers', () => {
    const blank: string[] = [];
    for (const seg of derived) {
      for (const r of seg.renderings) {
        if (r.lang !== 'sa-Deva' && r.lang !== 'zh-Hant') continue;
        for (const t of r.tokens) {
          const hasConcept = (t.units ?? []).length > 0;
          const isSeparator = /^[·:।॥.,]+$/u.test(t.text);
          if (!hasConcept && !t.gloss && !isSeparator) blank.push(`${r.lang}:${t.pronunciation ?? t.text}`);
        }
      }
    }
    expect(blank, `words with no tooltip: ${blank.join(', ')}`).toEqual([]);
  });
});

// @vitest-environment node
/**
 * Regression suite for the deterministic Malayalam engine
 * (`services/malayalam/graphemes.ts`). Every case here is a bug or contract
 * discovered during the 2026-07-11 build session — if one fails, a real
 * behavior regressed, not a style preference.
 *
 * The data-level twin of this suite is `scripts/malayalam/validate-surface.ts`
 * (surface law over the full curated + generated corpus); this file guards
 * the ENGINE, that script guards the DATA.
 */

import { describe, it, expect } from 'vitest';
import {
  clustersOf,
  romanizeWord,
  syllabify,
  clusterTip,
  isMalayalamCluster,
  endsVocalic,
  malayalamEtymFacets,
} from '../../services/malayalam/graphemes';

describe('romanizeWord — deterministic practical romanization', () => {
  // The 15 hand-written sounds from the curated pilot sentence: the engine
  // must reproduce them EXACTLY (this was the acceptance bar for Tier-1).
  const HAND: [string, string][] = [
    ['തിരുവടി', 'thiruvadi'], // intervocalic ട softening
    ['ഊരകത്ത്', 'oorakathu'], // word-final ് whispers half-u; geminate-digraph collapse
    ['പണ്ടൊരു', 'pandoru'], // post-nasal voicing (ണ്ട → nd)
    ['മേനോന്മാരിൽ', 'menonmaaril'],
    ['ഒരാൾക്ക്', 'oraalkku'], // chillu + geminate + final half-u
    ['ആദ്യം', 'aadyam'], // ദ practical override (not 'dhya')
    ['നടകാവലും', 'nadakaavalum'],
    ['പിന്നീടു', 'pinneedu'], // geminate ന്ന must not triple (was 'pinnneedu')
    ['കണക്കെഴുത്തുമുണ്ടായിരുന്നു', 'kanakkezhuthumundaayirunnu'],
    ['വാഴപ്പിള്ളി', 'vaazhappilli'], // zha; geminates പ്പ/ള്ള double single-letter sounds
    ['കാലത്തു', 'kaalathu'], // ത്ത digraph-geminate collapses to one 'th'
    ['ക്ഷേത്രത്തിൽ', 'kshethrathil'],
    ['അമ്മ', 'amma'], // was 'ammma' before the geminate fix
    ['ദേവസ്വം', 'devaswam'], // welded വ reads w
    ['ഭഗവതി', 'bhagavathi'],
  ];
  for (const [ml, sound] of HAND) {
    it(`${ml} → ${sound}`, () => expect(romanizeWord(ml)).toBe(sound));
  }

  it('geminated ട്ട does not soften (ഉൾപ്പെട്ട keeps tta)', () => {
    expect(romanizeWord('ഉൾപ്പെട്ട')).toContain('tta');
    expect(romanizeWord('ഉൾപ്പെട്ട')).not.toContain('dta');
  });

  it('voiced-aspirate weld ദ്ധ yields ddha, not dddha (വൃദ്ധ)', () => {
    expect(romanizeWord('വൃദ്ധ')).toBe('vruddha');
  });
});

describe('clustersOf — akshara segmentation', () => {
  it('grows conjuncts through the virama (ക്ഷേ|ത്ര)', () => {
    expect(clustersOf('ക്ഷേത്ര')).toEqual(['ക്ഷേ', 'ത്ര']);
  });

  it('chillu attaches as syllable coda (ഒ|രാൾ, not ഒ|രാ|ൾ)', () => {
    expect(clustersOf('ഒരാൾ')).toEqual(['ഒ', 'രാൾ']);
    expect(clustersOf('മുൻപിൽ')).toEqual(['മുൻ', 'പിൽ']);
  });

  it('ZWNJ breaks the cluster instead of gluing through it (ശേ‌ഷം)', () => {
    // The Wikisource corpus carries invisible ZWNJs; before the fix this
    // came back as ONE cluster and desynced every downstream pairing.
    expect(clustersOf('ശേ‌ഷം').length).toBe(2);
  });

  it('word-final virama stays attached (ത്ത് is one cluster)', () => {
    expect(clustersOf('ഊരകത്ത്')).toEqual(['ഊ', 'ര', 'ക', 'ത്ത്']);
  });
});

describe('syllabify — sound slices pair with clusters', () => {
  it('CV chains split 1:1 (thi|ru|va|di)', () => {
    expect(syllabify('thiruvadi', 4)).toEqual(['thi', 'ru', 'va', 'di']);
  });

  it('consonant-only leftover becomes its own final slice when counts ask for it', () => {
    expect(syllabify('oraal', 2)).toEqual(['o', 'raal']);
  });

  it('returns null on irreconcilable counts — caller falls back, never mis-pairs', () => {
    expect(syllabify('thiruvadi', 7)).toBeNull();
  });

  it('welded clusters keep their full onset (u|ndaa|yi|ru|nnu)', () => {
    expect(syllabify('undaayirunnu', 5)).toEqual(['u', 'ndaa', 'yi', 'ru', 'nnu']);
  });
});

describe('clusterTip — honest assembly stories', () => {
  it('മ്മ: names the doubled weld AND that the crescent is swallowed', () => {
    const tip = clusterTip('മ്മ');
    expect(tip.primary).toContain('മ (ma)');
    expect(tip.primary).not.toContain('chandrakkala'); // internal ് is not drawn
    expect(tip.secondary).toMatch(/swallow|not.*drawn|nothing extra/i);
    expect(tip.secondary).toContain('mma');
  });

  it('ത്ത്: the trailing ് IS the visible crescent', () => {
    const tip = clusterTip('ത്ത്');
    expect(tip.primary).toContain('chandrakkala');
    expect(tip.secondary).toMatch(/visible/i);
  });

  it('names intervocalic softening only after a vowel (ടി)', () => {
    expect(clusterTip('ടി', true).secondary).toMatch(/soften/i);
    expect(clusterTip('ടി', false).secondary || '').not.toMatch(/soften/i);
  });

  it('exploded parts ship for multi-symbol clusters only', () => {
    expect(clusterTip('ണ്ടാ').parts?.length).toBeGreaterThan(2);
    expect(clusterTip('ഴ').parts).toBeUndefined();
  });
});

describe('cluster classification helpers', () => {
  it('isMalayalamCluster rejects bare punctuation (trailing "." clusters)', () => {
    expect(isMalayalamCluster('.')).toBe(false);
    expect(isMalayalamCluster('ത്ത്')).toBe(true);
  });

  it('endsVocalic: consonant carries inherent a; chillu and ം do not', () => {
    expect(endsVocalic('ക')).toBe(true);
    expect(endsVocalic('കാ')).toBe(true);
    expect(endsVocalic('കൾ')).toBe(false);
    expect(endsVocalic('ം')).toBe(false);
  });
});

describe('malayalamEtymFacets — never a dead hover', () => {
  it('multi-cluster word yields a cluster map + one story per cluster', () => {
    const facets = malayalamEtymFacets('അമ്മ');
    expect(facets.length).toBeGreaterThanOrEqual(3); // map + അ + മ്മ
    expect(facets[0].primary).toContain('·');
  });
});

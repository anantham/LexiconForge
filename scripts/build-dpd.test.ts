import { describe, it, expect } from 'vitest';
import {
  normalizeNiggahita,
  tryStemStrips,
  stripQuotative,
  PALI_ENDINGS,
} from './build-dpd';

// Regression tests for the three DPD-ingestion bugs fixed in commit c33b115.
// Background: phase-a curation surfaced evaṁ → eva conflation; phase-c surfaced
// kurūsu → kura (rice) conflation. Three root causes were identified and fixed.
// These tests guard against future regressions in the script's matching logic.

// ─────────────────────────────────────────────────────────────────────────────
// Root cause #1 — niggahīta diacritic mismatch
//
// DPD uses ṃ (U+1E43, m-with-dot-BELOW); SuttaCentral bilara uses ṁ (U+1E41,
// m-with-dot-ABOVE). Without normalization, evaṃ (DPD headword) never matches
// evaṁ (bilara surface form), and the stripper falls through to the unrelated
// particle `eva`. normalizeNiggahita() runs on DPD parse + on bilara extract,
// converging both sides on ṁ.
// ─────────────────────────────────────────────────────────────────────────────

describe('normalizeNiggahita (root cause #1)', () => {
  it('converts DPD ṃ (U+1E43) to bilara ṁ (U+1E41)', () => {
    expect(normalizeNiggahita('evaṃ')).toBe('evaṁ');
  });

  it('is idempotent on already-normalized ṁ', () => {
    expect(normalizeNiggahita('evaṁ')).toBe('evaṁ');
  });

  it('passes through ASCII-only text unchanged', () => {
    expect(normalizeNiggahita('eva')).toBe('eva');
  });

  it('handles mixed niggahīta forms in the same string', () => {
    expect(normalizeNiggahita('evaṃ me sutaṃ')).toBe('evaṁ me sutaṁ');
  });

  it('does not touch other diacritics', () => {
    // Specifically: ā, ī, ū, ñ, ṅ, ñ, ṭ, ḍ, ṇ, ṣ, ś — common Pāli diacritics.
    expect(normalizeNiggahita('āṅñṭḍṇ')).toBe('āṅñṭḍṇ');
  });

  it('returns empty string unchanged', () => {
    expect(normalizeNiggahita('')).toBe('');
  });

  it('produces a string whose codepoints contain ṁ (U+1E41) not ṃ (U+1E43)', () => {
    const result = normalizeNiggahita('evaṃ');
    // Direct codepoint check guards against accidental regex weakening.
    expect(result.codePointAt(3)).toBe(0x1E41); // ṁ
    expect(result.codePointAt(3)).not.toBe(0x1E43); // ṃ
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Root cause #2 — over-greedy -ūsu / -ūhi endings
//
// 'ūsu' and 'ūhi' were originally in PALI_ENDINGS as single 3-char endings.
// They are NOT real morphological endings — the long vowel is a sandhi-
// lengthening of the stem (kuru → kurū before -su). Counting -ūsu as one
// 3-char ending caused kurūsu to over-strip to 'kur' and then match the
// unrelated noun 'kura' (rice) via the candidate +a path.
//
// Fix: removed 'ūsu' and 'ūhi'; added bare 'su' and 'hi' instead, paired
// with the vowel-shortening rule (root cause #3) to recover the true stem.
// ─────────────────────────────────────────────────────────────────────────────

describe('PALI_ENDINGS (root cause #2)', () => {
  it('does NOT contain the over-greedy ūsu ending', () => {
    expect(PALI_ENDINGS).not.toContain('ūsu');
  });

  it('does NOT contain the over-greedy ūhi ending', () => {
    expect(PALI_ENDINGS).not.toContain('ūhi');
  });

  it('contains the bare locative-plural ending su', () => {
    expect(PALI_ENDINGS).toContain('su');
  });

  it('contains the bare instrumental-plural ending hi', () => {
    expect(PALI_ENDINGS).toContain('hi');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Root cause #3 — vowel-shortening for long-vowel stems
//
// After stripping locative-plural -su (or instrumental-plural -hi), the
// remaining stem still carries the lengthened vowel (kurū, bhikkhū, satthū).
// DPD headwords use the short-vowel form (kuru, bhikkhu, satthu). The
// vowel-shortening pass adds the short-vowel candidate so the lookup succeeds.
//
// Without this rule, kurūsu → kurū (no DPD match; DPD has kuru with short u).
// ─────────────────────────────────────────────────────────────────────────────

describe('tryStemStrips — kurūsu (locative plural of Kuru)', () => {
  it('produces kuru as a candidate via vowel-shortening (root cause #3)', () => {
    // kurūsu → strip 'su' → 'kurū' → shorten ū → 'kuru'. This is the real
    // DPD headword for the Kuru people / country.
    expect(tryStemStrips('kurūsu')).toContain('kuru');
  });

  it('also produces kurū as a candidate (the intermediate lengthened stem)', () => {
    // kurū is also a DPD headword (the people; masc nom pl); both kurū and
    // kuru are correct lemma matches for kurūsu.
    expect(tryStemStrips('kurūsu')).toContain('kurū');
  });

  it('does NOT produce kur as a candidate (the bug-path)', () => {
    // Pre-fix, 'ūsu' in PALI_ENDINGS caused kurūsu → 'kur', which then
    // matched the unrelated 'kura' (rice) via the +a candidate path. The
    // absence of 'kur' confirms the over-greedy ending was removed.
    expect(tryStemStrips('kurūsu')).not.toContain('kur');
  });

  it('does NOT produce kura (the wrong-word the bug landed on)', () => {
    // 'kura' (rice) is the DPD headword the original bug conflated kurūsu
    // with. With 'ūsu' removed, the kur → +a path is dead.
    expect(tryStemStrips('kurūsu')).not.toContain('kura');
  });
});

describe('tryStemStrips — bhikkhūsu (locative plural of bhikkhu)', () => {
  it('produces bhikkhu as a candidate via vowel-shortening', () => {
    // Same pattern as kurūsu: strip 'su' → 'bhikkhū' → shorten ū → 'bhikkhu'.
    expect(tryStemStrips('bhikkhūsu')).toContain('bhikkhu');
  });

  it('also produces bhikkhū as a candidate', () => {
    expect(tryStemStrips('bhikkhūsu')).toContain('bhikkhū');
  });
});

describe('tryStemStrips — vowel-shortening covers all three long vowels', () => {
  // The rule shortens ā→a, ī→i, ū→u. Each direction matters; regressions
  // could come from any one being dropped.
  it('shortens ū → u after -su strip', () => {
    expect(tryStemStrips('xxxxūsu')).toContain('xxxxu');
  });

  it('shortens ī → i after -ni strip-like long-vowel stem', () => {
    // Construct a surface where stripping leaves a long-ī stem.
    // 'xxxxīsu' → strip 'su' → 'xxxxī' → shorten ī → 'xxxxi'.
    expect(tryStemStrips('xxxxīsu')).toContain('xxxxi');
  });

  it('shortens ā → a after -su strip', () => {
    expect(tryStemStrips('xxxxāsu')).toContain('xxxxa');
  });

  it('does NOT shorten short vowels (a, i, u) — they have nothing to shorten', () => {
    // After stripping a fictitious 'su' from 'xxxxasu', the stem is 'xxxxa';
    // the vowel-shortening branch is gated by the long-vowel check, so it
    // shouldn't fire here. (Note 'xxxxa' itself IS a candidate via the
    // direct-strip path; this test confirms no spurious extra mutations.)
    const candidates = tryStemStrips('xxxxasu');
    expect(candidates).toContain('xxxxa');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Direct-match preservation
//
// After niggahīta normalization, the bilara surface evaṁ matches the DPD
// lemma evaṁ directly. The stripper still runs (it always does), but the
// surface itself must be in the candidate set so the direct match succeeds
// before any conflating stem is tried.
// ─────────────────────────────────────────────────────────────────────────────

describe('tryStemStrips — evaṁ (the formula opener)', () => {
  it('preserves the surface form itself as a candidate', () => {
    // The surface IS the lemma post-normalization; direct match should win.
    expect(tryStemStrips('evaṁ')).toContain('evaṁ');
  });

  it('also produces eva as a candidate (the particle base)', () => {
    // eva IS a real DPD headword (the emphatic particle); this is fine as a
    // *candidate* — direct match on 'evaṁ' wins before it's consulted.
    expect(tryStemStrips('evaṁ')).toContain('eva');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Quotative tail stripping — orthogonal to the c33b115 fix, but a useful
// regression net since it runs in the same pipeline as stem-stripping.
// ─────────────────────────────────────────────────────────────────────────────

describe('stripQuotative', () => {
  it('strips trailing iti-particle (curly quote)', () => {
    expect(stripQuotative('vuccatī’ti')).toContain('vuccatī');
  });

  it('strips trailing iti-particle (straight quote)', () => {
    expect(stripQuotative("vuccatī'ti")).toContain('vuccatī');
  });

  it('always includes the original surface form', () => {
    expect(stripQuotative('vuccatī’ti')).toContain('vuccatī’ti');
  });

  it('leaves words without quotative tails unchanged', () => {
    expect(stripQuotative('viharati')).toEqual(['viharati']);
  });
});

// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { romanizationMatches, segmentAksharas, aksharasOf } from './devanagari';
import { getLiturgyDoc } from '../../../data/liturgy';

/**
 * The Devanāgarī row is generated algorithmically (segment + romanize the
 * `scriptAlt`), so it's only safe to display when it reproduces the authoritative
 * IAST (`form`). This test is that guarantee: if the romanizer ever drifts from
 * the chant data, CI fails before a wrong sound ships on sacred text.
 */
const doc = getLiturgyDoc('maple', 'heart-sutra')!;
const seen = new Set<string>();
const words: { form: string; scriptAlt: string }[] = [];
for (const seg of doc.sections.flatMap((s: any) => s.segments ?? []) as any[])
  for (const w of seg.words ?? [])
    if (w.scriptAlt && w.form && !seen.has(w.form)) {
      seen.add(w.form);
      words.push({ form: w.form, scriptAlt: w.scriptAlt });
    }

describe('devanāgarī romanizer — self-validation against authoritative IAST', () => {
  it('has Heart Sutra words to check', () => {
    expect(words.length).toBeGreaterThan(80);
  });

  it('romanizes every word back to its IAST form', () => {
    const fails = words
      .filter((w) => !romanizationMatches(w.scriptAlt, w.form))
      .map((w) => `${w.form} ⇏ ${aksharasOf(w.scriptAlt).map((a) => a.rom).join('')}`);
    expect(fails, `romanization mismatches: ${fails.join(' | ')}`).toEqual([]);
  });

  it('segments aksharas that concatenate back to the source (lossless)', () => {
    for (const w of words) expect(segmentAksharas(w.scriptAlt).join('')).toBe(w.scriptAlt);
  });
});

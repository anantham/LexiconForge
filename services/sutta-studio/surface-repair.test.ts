// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { repairAnatomistSurfaces } from './utils';
import type { AnatomistPass } from '../../types/suttaStudio';

/**
 * Real corruption cases from the first full MN117 production compile
 * (2026-07-03, gemini-3-flash, 6.1% of words):
 *   - "sāsavā" split as sa|āsavā (morphological re-expansion; concat ≠ surface)
 *   - "atthi," rewritten as "asthi," (Sanskritized single segment)
 *   - "lokuttarā" split as loka|uttarā (sandhi vowel re-expanded)
 * The repair forces canonical surfaces; the analysis survives in tooltips.
 */

const pass = (words: AnatomistPass['words'], segments: AnatomistPass['segments'], relations: AnatomistPass['relations'] = []): AnatomistPass => ({
  id: 'phase-t',
  words,
  segments,
  relations,
});

describe('repairAnatomistSurfaces', () => {
  it('collapses a multi-segment word whose concat re-expands sandhi', () => {
    const input = pass(
      [
        { id: 'p1', surface: 'sammādiṭṭhi', wordClass: 'content', segmentIds: ['p1s1'] },
        { id: 'p2', surface: 'saāsavā', wordClass: 'content', segmentIds: ['p2s1', 'p2s2'] },
      ],
      [
        { id: 'p1s1', wordId: 'p1', text: 'sammādiṭṭhi', type: 'stem', tooltips: ['right view'] },
        { id: 'p2s1', wordId: 'p2', text: 'sa', type: 'prefix', tooltips: ['sa-: with / together'] },
        { id: 'p2s2', wordId: 'p2', text: 'āsavā', type: 'stem', tooltips: ['āsava: taints / defilements'] },
      ],
      [{ id: 'r1', fromSegmentId: 'p2s2', targetWordId: 'p1', type: 'action', label: 'Modifier', status: 'confirmed' }]
    );

    const { pass: repaired, repairs, skippedReason } = repairAnatomistSurfaces(input, 'sammādiṭṭhi sāsavā');

    expect(skippedReason).toBeUndefined();
    expect(repairs).toEqual([{ wordId: 'p2', from: 'saāsavā', to: 'sāsavā', collapsed: true }]);
    const word = repaired.words.find((w) => w.id === 'p2')!;
    expect(word.surface).toBe('sāsavā');
    expect(word.segmentIds).toEqual(['p2s1']);
    const survivor = repaired.segments.find((s) => s.id === 'p2s1')!;
    expect(survivor.text).toBe('sāsavā');
    expect(survivor.tooltips).toContain('sa-: with / together');
    expect(survivor.tooltips).toContain('āsava: taints / defilements');
    expect(survivor.tooltips?.some((t) => t.includes('Underlying analysis: sa + āsavā'))).toBe(true);
    expect(repaired.segments.find((s) => s.id === 'p2s2')).toBeUndefined();
    // relation pointing at the removed segment is remapped to the survivor
    expect(repaired.relations?.[0].fromSegmentId).toBe('p2s1');
  });

  it('rewrites a single-segment word the model Sanskritized', () => {
    const input = pass(
      [{ id: 'p1', surface: 'asthi,', wordClass: 'function', segmentIds: ['p1s1'] }],
      [{ id: 'p1s1', wordId: 'p1', text: 'asthi,', type: 'stem', tooltips: ['there is'] }]
    );

    const { pass: repaired, repairs } = repairAnatomistSurfaces(input, 'atthi,');

    expect(repairs).toEqual([{ wordId: 'p1', from: 'asthi,', to: 'atthi,', collapsed: false }]);
    expect(repaired.words[0].surface).toBe('atthi,');
    expect(repaired.segments[0].text).toBe('atthi,');
    expect(repaired.segments[0].tooltips).toEqual(['there is']);
  });

  it('leaves surface-faithful words untouched', () => {
    const input = pass(
      [{ id: 'p1', surface: 'lokuttarā', wordClass: 'content', segmentIds: ['p1s1', 'p1s2'] }],
      [
        { id: 'p1s1', wordId: 'p1', text: 'lok', type: 'stem', tooltips: ['loka: world'] },
        { id: 'p1s2', wordId: 'p1', text: 'uttarā', type: 'suffix', tooltips: ['uttara: beyond'] },
      ]
    );

    const { pass: repaired, repairs } = repairAnatomistSurfaces(input, 'lokuttarā');

    expect(repairs).toEqual([]);
    expect(repaired).toBe(input);
  });

  it('fixes word.surface alone when segments already concat correctly', () => {
    const input = pass(
      [{ id: 'p1', surface: 'sutaṁ', wordClass: 'content', segmentIds: ['p1s1', 'p1s2'] }],
      [
        { id: 'p1s1', wordId: 'p1', text: 'suta', type: 'root', tooltips: [] },
        { id: 'p1s2', wordId: 'p1', text: 'ṁ.', type: 'suffix', tooltips: [] },
      ]
    );

    const { pass: repaired, repairs } = repairAnatomistSurfaces(input, 'sutaṁ.');

    expect(repairs).toEqual([{ wordId: 'p1', from: 'sutaṁ', to: 'sutaṁ.', collapsed: false }]);
    expect(repaired.words[0].surface).toBe('sutaṁ.');
    expect(repaired.segments).toHaveLength(2);
  });

  it('skips (never guesses) when word count disagrees with token count', () => {
    const input = pass(
      [{ id: 'p1', surface: 'evaṁ', wordClass: 'function', segmentIds: ['p1s1'] }],
      [{ id: 'p1s1', wordId: 'p1', text: 'evaṁ', type: 'stem', tooltips: [] }]
    );

    const { pass: repaired, repairs, skippedReason } = repairAnatomistSurfaces(input, 'evaṁ me sutaṁ');

    expect(skippedReason).toContain('mismatch');
    expect(repairs).toEqual([]);
    expect(repaired).toBe(input);
  });

  it('absorbs edge punctuation without destroying a morpheme split', () => {
    // Model dropped the trailing comma and the leading quote; the split
    // itself is correct and must survive.
    const input = pass(
      [{ id: 'p1', surface: 'vuccati', wordClass: 'content', segmentIds: ['p1s1', 'p1s2'] }],
      [
        { id: 'p1s1', wordId: 'p1', text: 'vucca', type: 'root', tooltips: ['√vac: to say'] },
        { id: 'p1s2', wordId: 'p1', text: 'ti', type: 'suffix', tooltips: ['passive ending'] },
      ]
    );

    const { pass: repaired, repairs } = repairAnatomistSurfaces(input, '“vuccati,');

    expect(repairs).toEqual([{ wordId: 'p1', from: 'vuccati', to: '“vuccati,', collapsed: false }]);
    expect(repaired.words[0].segmentIds).toEqual(['p1s1', 'p1s2']);
    const segTexts = repaired.segments.map((s) => s.text);
    expect(segTexts).toEqual(['“vucca', 'ti,']);
    expect(repaired.segments[0].tooltips).toEqual(['√vac: to say']);
  });

  it('treats em-dash-joined canonical words as separate tokens (dash stays left)', () => {
    // bilara joins list items: "seyyathidaṁ—sammādiṭṭhi" is ONE whitespace
    // token, but models correctly render two words. Repair must align 2↔2
    // and reattach the dash to the left word.
    const input = pass(
      [
        { id: 'p1', surface: 'seyyathidaṁ', wordClass: 'function', segmentIds: ['p1s1'] },
        { id: 'p2', surface: 'sammādiṭṭhi', wordClass: 'content', segmentIds: ['p2s1'] },
      ],
      [
        { id: 'p1s1', wordId: 'p1', text: 'seyyathidaṁ', type: 'stem', tooltips: [] },
        { id: 'p2s1', wordId: 'p2', text: 'sammādiṭṭhi', type: 'stem', tooltips: [] },
      ]
    );

    const { pass: repaired, repairs, skippedReason } = repairAnatomistSurfaces(input, 'seyyathidaṁ—sammādiṭṭhi');

    expect(skippedReason).toBeUndefined();
    expect(repairs).toEqual([{ wordId: 'p1', from: 'seyyathidaṁ', to: 'seyyathidaṁ—', collapsed: false }]);
    expect(repaired.words[0].surface).toBe('seyyathidaṁ—');
    expect(repaired.words[1].surface).toBe('sammādiṭṭhi');
  });

  it('handles NFD-encoded model output against NFC canonical text', () => {
    const nfd = 'sāsavā'.normalize('NFD');
    const input = pass(
      [{ id: 'p1', surface: nfd, wordClass: 'content', segmentIds: ['p1s1'] }],
      [{ id: 'p1s1', wordId: 'p1', text: nfd, type: 'stem', tooltips: [] }]
    );

    const { repairs } = repairAnatomistSurfaces(input, 'sāsavā');

    // NFC-equal → no repair needed, no false positive
    expect(repairs).toEqual([]);
  });
});

// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { validatePacket } from './suttaStudioPacketValidator';
import type { DeepLoomPacket } from '../types/suttaStudio';

/**
 * Check 0 (surface integrity): rendered words must equal an exact canonical
 * whitespace-token (letters-only). Guards the two failure modes seen in the
 * first MN117 production compile AND the looseness codex flagged in review:
 * a substring check over the whole text lets a corruption ride on another
 * word ("atthi" inside "natthi") or across a word boundary.
 */

const packet = (paliWords: Array<{ id: string; surface: string }>, canonical: string[]): DeepLoomPacket =>
  ({
    packetId: 'test',
    source: { provider: 'suttacentral', workId: 'mnTEST' },
    canonicalSegments: canonical.map((pali, i) => ({
      ref: { provider: 'suttacentral', workId: 'mnTEST', segmentId: `mnTEST:1.${i + 1}` },
      order: i,
      pali,
    })),
    phases: [
      {
        id: 'phase-1',
        paliWords: paliWords.map((w) => ({
          id: w.id,
          surface: w.surface,
          wordClass: 'content',
          senses: [],
          segments: [{ id: `${w.id}s1`, wordId: w.id, text: w.surface, type: 'stem' }],
        })),
        englishStructure: [],
      },
    ],
    citations: [],
  } as unknown as DeepLoomPacket);

describe('validatePacket surface integrity (check 0)', () => {
  it('passes words that match canonical tokens exactly (punctuation-insensitive)', () => {
    const r = validatePacket(packet([{ id: 'p1', surface: 'atthi,' }, { id: 'p2', surface: 'sāsavā' }], ['atthi, bhikkhave,', 'sammādiṭṭhi sāsavā;']));
    expect(r.stats.surfaceMismatches).toBe(0);
  });

  it('flags a mangled word (sandhi re-expansion)', () => {
    const r = validatePacket(packet([{ id: 'p1', surface: 'saāsavā' }], ['sammādiṭṭhi sāsavā']));
    expect(r.stats.surfaceMismatches).toBe(1);
    expect(r.issues.some((i) => i.code === 'surface_mismatch' && i.wordId === 'p1')).toBe(true);
  });

  it('flags a corruption that would ride across a word boundary under a substring check', () => {
    // letters-only concat of "deva ānanda" contains "vaā" — exact-token
    // membership must still reject it.
    const r = validatePacket(packet([{ id: 'p1', surface: 'vaā' }], ['deva ānanda']));
    expect(r.stats.surfaceMismatches).toBe(1);
  });

  it('flags a corruption that is a substring of a different canonical word', () => {
    // "atthi" ⊂ "natthi" — substring membership would pass it; token equality must not.
    const r = validatePacket(packet([{ id: 'p1', surface: 'atthi' }], ['natthi loke']));
    expect(r.stats.surfaceMismatches).toBe(1);
  });

  it('accepts words the model split at an em-dash join', () => {
    const r = validatePacket(
      packet(
        [{ id: 'p1', surface: 'seyyathidaṁ' }, { id: 'p2', surface: 'sammādiṭṭhi,' }],
        ['seyyathidaṁ—sammādiṭṭhi, sammāsaṅkappo;']
      )
    );
    expect(r.stats.surfaceMismatches).toBe(0);
  });

  it('accepts consecutive words that jointly spell one canonical token (pedagogical sub-splits)', () => {
    // quotative ti and sandhi compounds: "Bhikkhavo"ti → Bhikkhavo + ti,
    // etadavoca → etad + avoca — the flagship's 46 false flags.
    const r = validatePacket(
      packet(
        [
          { id: 'p1', surface: 'Bhikkhavo' },
          { id: 'p2', surface: 'ti' },
          { id: 'p3', surface: 'etad' },
          { id: 'p4', surface: 'avoca' },
        ],
        ['"Bhikkhavo"ti bhagavā, etadavoca:']
      )
    );
    expect(r.stats.surfaceMismatches).toBe(0);
  });

  it('a corrupt word is flagged without stranding its sound neighbours', () => {
    const r = validatePacket(
      packet(
        [
          { id: 'p1', surface: 'etad' },
          { id: 'p2', surface: 'XXcorruptXX' },
          { id: 'p3', surface: 'avoca' },
        ],
        ['etadavoca bhagavā'] // etad+avoca only spell a token TOGETHER; the corrupt word sits between
      )
    );
    // etad and avoca are separated by the corrupt word, so they cannot form
    // the token as CONSECUTIVE words — all three flag. The DP never invents
    // non-adjacent groupings.
    expect(r.stats.surfaceMismatches).toBe(3);
    const r2 = validatePacket(
      packet(
        [
          { id: 'p1', surface: 'etad' },
          { id: 'p2', surface: 'avoca' },
          { id: 'p3', surface: 'XXcorruptXX' },
        ],
        ['etadavoca bhagavā']
      )
    );
    expect(r2.stats.surfaceMismatches).toBe(1); // only the corrupt word
  });

  it('summarizes beyond the report cap instead of flooding issues', () => {
    const words = Array.from({ length: 30 }, (_, i) => ({ id: `p${i + 1}`, surface: `zzz${i}` }));
    const r = validatePacket(packet(words, ['atthi bhikkhave']));
    expect(r.stats.surfaceMismatches).toBe(30);
    const surfaceIssues = r.issues.filter((i) => i.code === 'surface_mismatch');
    expect(surfaceIssues).toHaveLength(26); // 25 individual + 1 summary
  });
});

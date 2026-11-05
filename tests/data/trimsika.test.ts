// @vitest-environment node
import { describe, it, expect } from 'vitest';
import packetJson from '../../content/references/sutta/trimsika.json';
import source from '../../data/trimsika/source.json';
import annotations from '../../data/trimsika/annotations.json';
import provenance from '../../data/trimsika/provenance.json';
import { buildTrimsika, type VerseDraft } from '../../data/trimsika/build';
import { validatePacket } from '../../services/suttaStudioPacketValidator';
import { validatePacketIds, validatePhase } from '../../services/suttaStudioValidator';
import type { DeepLoomPacket, Provenance } from '../../types/suttaStudio';

const packet = packetJson as DeepLoomPacket;
const drafts = annotations as VerseDraft[];
const prov = provenance as Provenance;

describe('Triṃśikā study packet', () => {
  it('rebuilds exactly, offline, using the existing DeepLoom wire schema', () => {
    expect(buildTrimsika(source, drafts, prov)).toEqual(packet);
    expect(packet.source).toMatchObject({ provider: 'local-edition', language: 'sa' });
    expect(validatePacket(packet).issues).toEqual([]);
    expect(validatePacketIds(packet).issues).toEqual([]);
    for (const phase of packet.phases) expect(validatePhase(phase).issues).toEqual([]);
  });
  it('covers exactly verses 1–30 and reconstructs every Sanskrit character without a Pāli alphabet filter', () => {
    expect(source.map(s => s.verse)).toEqual(Array.from({ length: 30 }, (_, i) => i + 1));
    expect(packet.phases).toHaveLength(30);
    const ids = new Set<string>();
    for (const [i, phase] of packet.phases.entries()) {
      const s = source[i];
      expect(phase.canonicalSegmentIds).toEqual([`trimsika:${i + 1}`]);
      expect(phase.paliWords.map(w => w.segments.map(p => p.text).join('')).join(' ')).toBe(s.text);
      expect(s.text).toBe(s.metricalText.replace(' | ', ' ').replace(/ \|\|$/, ''));
      expect(packet.canonicalSegments[i].pali).toBe(s.text);
      for (const word of phase.paliWords) for (const id of [word.id, ...word.segments.map(p => p.id)]) {
        expect(ids.has(id), id).toBe(false); ids.add(id);
      }
    }
  });
  it('keeps short contiguous groups without dropping, repeating or splitting written words', () => {
    const groups = packet.phases.flatMap(phase => phase.layoutBlocks!);
    expect(groups.reduce((n, block) => n + block.length, 0)).toBe(307);
    expect(groups.every(block => block.length >= 1 && block.length <= 5)).toBe(true);
    expect(groups.reduce((n, block) => n + block.length, 0) / groups.length).toBeLessThan(3.5);
    for (const phase of packet.phases) {
      expect(phase.layoutBlocks!.flat()).toEqual(phase.paliWords.map(word => word.id));
      for (const token of phase.englishStructure.filter(t => t.layoutWordId)) {
        expect(token.isGhost).toBe(true);
        expect(token.linkedPaliId).toBeUndefined();
        expect(phase.paliWords.some(w => w.id === token.layoutWordId)).toBe(true);
      }
    }
  });
  it('rejects oversized, incomplete, repeated or fractional line ends and dangling ghost anchors', () => {
    for (const ends of [[6, 11], [3, 6], [3, 3, 6, 11], [2.5, 6, 11], []]) {
      const bad = structuredClone(drafts); bad[0].lineEnds = ends;
      expect(() => buildTrimsika(source, bad, prov)).toThrow(/line (ends|groups)/);
    }
    const bad = structuredClone(drafts);
    bad[0].order!.push({ ghost: 'the', kind: 'article', layoutWith: 999 });
    expect(() => buildTrimsika(source, bad, prov)).toThrow('ghost layout anchor');
  });
  it('closes all word/English/grammar/citation/ripple references and makes every supplied token a typed ghost', () => {
    const citationIds = new Set(packet.citations.map(c => c.id));
    for (const phase of packet.phases) {
      const words = new Set(phase.paliWords.map(w => w.id));
      const tokens = phase.englishStructure;
      expect(tokens.filter(t => t.linkedPaliId).map(t => t.linkedPaliId).sort()).toEqual([...words].sort());
      for (const token of tokens) {
        if (token.linkedPaliId) expect(words.has(token.linkedPaliId)).toBe(true);
        else { expect(token.isGhost).toBe(true); expect(token.ghostKind).toBeTruthy(); expect(token.label).toBeTruthy(); }
      }
      for (const word of phase.paliWords) {
        for (const segment of word.segments) {
          expect(segment.tooltips?.length).toBeGreaterThan(0);
          if (segment.relation) expect(words.has(segment.relation.targetWordId!)).toBe(true);
        }
        for (const sense of word.senses) {
          expect(sense.english.trim()).not.toBe('');
          expect(sense.notes).toContain('Curator inference');
          for (const id of sense.citationIds ?? []) expect(citationIds.has(id)).toBe(true);
          for (const id of Object.keys(sense.ripples ?? {})) expect(tokens.find(t => t.id === id)?.isGhost).toBe(true);
        }
      }
    }
    expect(packet.renderDefaults.ghostOpacity).toBe(0.3);
    expect(packet.phases[16].paliWords[2].senses[1].ripples).toEqual({ v17g1: 'is an' });
  });
  it('retains edition-specific readings and explicitly discloses the v13 emendation', () => {
    expect(source[11].text).toContain('krodhopanahane');
    expect(source[12].text).toContain('uddhavaḥ');
    expect(source[25].text).toContain('nāvatiṣṭhati');
    expect(source[27].text).toContain('vijñānamātratve');
    expect(source[27].text).toContain('grāhyābhāve');
    expect(source[28].text).toContain("'nupalambho");
    expect(prov.unknowns?.join(' ')).toContain('v. 13 emendation');
    expect(prov.translation?.translator).toContain('unreviewed');
  });
  it('refuses dropped verses, wrong Sanskrit consonants, duplicate alignment and dangling relations', () => {
    expect(() => buildTrimsika(source.slice(1), drafts, prov)).toThrow('exactly verses');
    const wrong = structuredClone(drafts); wrong[0].words[5].text = 'vijñānapariṇāma';
    expect(() => buildTrimsika(source, wrong, prov)).toThrow('exact normalized source');
    const lost = structuredClone(drafts); lost[0].order = [1, 1];
    expect(() => buildTrimsika(source, lost, prov)).toThrow('each word exactly once');
    const dangling = structuredClone(drafts); dangling[0].words[1].relation = { target: 999, type: 'action', label: 'BY' };
    expect(() => buildTrimsika(source, dangling, prov)).toThrow('dangling relation');
  });
  it('rejects misleading grammar slices and incomplete alternate-ripple drafts', () => {
    const split = structuredClone(drafts); split[0].words[0].morph = { case: 'nom' };
    expect(() => buildTrimsika(source, split, prov)).toThrow('whole-token grammar');
    const orphan = structuredClone(drafts); delete orphan[16].words[2].alternative;
    expect(() => buildTrimsika(source, orphan, prov)).toThrow('ripple requires');
    const blank = structuredClone(drafts); blank[0].words[0].alternative = '  ';
    expect(() => buildTrimsika(source, blank, prov)).toThrow('blank alternative');
    const ghost = structuredClone(drafts); ghost[0].order!.push({ ghost: ' ', kind: 'copula' });
    expect(() => buildTrimsika(source, ghost, prov)).toThrow('blank ghost');
    const self = structuredClone(drafts); self[0].words[1].relation = { target: 2, type: 'action', label: 'BY' };
    expect(() => buildTrimsika(source, self, prov)).toThrow('self-relation');
    for (const phase of packet.phases) for (const word of phase.paliWords) {
      if (word.segments.some(s => s.morph || s.relation)) expect(word.segments).toHaveLength(1);
    }
  });
});

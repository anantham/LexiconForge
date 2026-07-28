/**
 * canonicalSegmentIds — integrity item 3 (2026-07).
 *
 * Production compiled packets (rehydratePhase / buildDegradedPhaseView) never
 * set phase.canonicalSegmentIds, so the rich packet validator's segment
 * checks (#1/#2/#5 iterate `phase.canonicalSegmentIds ?? []`) passed
 * VACUOUSLY on every compiled packet.
 *
 * RED-PROOFED against the pre-fix code:
 *   - rehydratePhase omitted canonicalSegmentIds (first test failed)
 *   - the fully-covered packet reported every segment missing (second test)
 *   - the pali-mismatch check never fired on compiled shapes (fourth test)
 *   - check 2a (canonical_segment_ids_missing) did not exist (fifth test)
 */
import { describe, it, expect } from 'vitest';
import { rehydratePhase, buildDegradedPhaseView } from '../../../services/suttaStudioRehydrator';
import { validatePacket } from '../../../services/suttaStudioPacketValidator';
import type { CanonicalSegment, DeepLoomPacket, PhaseView, SourceRef } from '../../../types/suttaStudio';

const ref = (segmentId: string): SourceRef => ({ provider: 'suttacentral', workId: 'mn1', segmentId });

const segment = (segmentId: string, pali: string, baseEnglish: string, order = 0): CanonicalSegment => ({
  ref: ref(segmentId),
  order,
  pali,
  baseEnglish,
});

/** Compiled-shape phase: exactly what production rehydration emits. */
const compiledPhase = (phaseId: string, segmentId: string, surface: string, gloss: string): PhaseView =>
  rehydratePhase({
    phaseId,
    title: phaseId,
    sourceSpan: [ref(segmentId)],
    anatomist: {
      id: phaseId,
      words: [{ id: 'p1', surface, wordClass: 'content', segmentIds: ['p1s1'] }],
      segments: [{ id: 'p1s1', text: surface, type: 'stem', tooltips: [] }],
      relations: [],
    } as any,
    lexicographer: {
      id: phaseId,
      senses: [{ wordId: 'p1', wordClass: 'content', senses: [{ english: gloss, nuance: 'n' }] }],
    } as any,
  });

const packetWith = (phases: PhaseView[], canonicalSegments: CanonicalSegment[]): DeepLoomPacket => ({
  packetId: 'test-packet',
  source: { provider: 'suttacentral', workId: 'mn1' },
  canonicalSegments,
  phases,
  citations: [],
  progress: {},
  renderDefaults: { ghostOpacity: 0.3, englishVisible: true, studyToggleDefault: true },
} as unknown as DeepLoomPacket);

describe('rehydrator populates canonicalSegmentIds (production shape)', () => {
  it('rehydratePhase carries sourceSpan segment ids into canonicalSegmentIds', () => {
    const phase = compiledPhase('phase-1', 'mn1:1.1', 'sutaṁ', 'heard');
    expect(phase.canonicalSegmentIds).toEqual(['mn1:1.1']);
  });

  it('rehydratePhase dedupes repeated segment ids (wordRange slices)', () => {
    const phase = rehydratePhase({
      phaseId: 'phase-1',
      sourceSpan: [ref('mn1:1.1'), ref('mn1:1.1'), ref('mn1:1.2')],
      anatomist: {
        id: 'phase-1',
        words: [{ id: 'p1', surface: 'sutaṁ', wordClass: 'content', segmentIds: ['p1s1'] }],
        segments: [{ id: 'p1s1', text: 'sutaṁ', type: 'stem', tooltips: [] }],
        relations: [],
      } as any,
      lexicographer: { id: 'phase-1', senses: [{ wordId: 'p1', wordClass: 'content', senses: [{ english: 'heard', nuance: 'n' }] }] } as any,
    });
    expect(phase.canonicalSegmentIds).toEqual(['mn1:1.1', 'mn1:1.2']);
  });

  it('buildDegradedPhaseView carries segment ids too', () => {
    const degraded = buildDegradedPhaseView({
      phaseId: 'phase-x',
      sourceSpan: [ref('mn1:9.9')],
      paliTexts: [{ surface: 'evaṁ' }],
      englishTexts: ['Thus'],
      reason: 'test',
    });
    expect(degraded.canonicalSegmentIds).toEqual(['mn1:9.9']);
    expect(degraded.degraded).toBe(true);
  });
});

describe('validatePacket on compiled-shape packets (no longer vacuous)', () => {
  it('a fully-covered compiled packet reports NO missing segments', () => {
    const seg = segment('mn1:1.1', 'sutaṁ', 'heard');
    const packet = packetWith([compiledPhase('phase-1', 'mn1:1.1', 'sutaṁ', 'heard')], [seg]);
    const result = validatePacket(packet, [seg]);
    expect(result.issues.filter((i) => i.code === 'canonical_segment_missing')).toHaveLength(0);
    expect(result.issues.filter((i) => i.code === 'canonical_segment_ids_missing')).toHaveLength(0);
  });

  it('a compiled packet MISSING a source segment fails validation with exactly that segment', () => {
    const covered = segment('mn1:1.1', 'sutaṁ', 'heard');
    const missing = segment('mn1:1.2', 'maggo', 'path', 1);
    const packet = packetWith([compiledPhase('phase-1', 'mn1:1.1', 'sutaṁ', 'heard')], [covered, missing]);
    const result = validatePacket(packet, [covered, missing]);
    const missingIssues = result.issues.filter((i) => i.code === 'canonical_segment_missing');
    // Pre-fix this was TWO issues (every source segment "missing" because no
    // phase carried ids); the check could not distinguish real gaps.
    expect(missingIssues).toHaveLength(1);
    expect(missingIssues[0].canonicalSegmentId).toBe('mn1:1.2');
    expect(result.valid).toBe(false);
  });

  it('pali corruption in a compiled phase is now caught (check #5 was vacuous)', () => {
    const seg = segment('mn1:1.1', 'sutaṁ', 'heard');
    // Compiled phase whose rendered pali does NOT match the canonical text.
    const corrupted = compiledPhase('phase-1', 'mn1:1.1', 'saāsavā', 'heard');
    const packet = packetWith([corrupted], [seg]);
    const result = validatePacket(packet, [seg]);
    expect(result.issues.some((i) => i.code === 'pali_text_mismatch' && i.canonicalSegmentId === 'mn1:1.1')).toBe(true);
  });

  it('a non-degraded phase with NEITHER canonicalSegmentIds nor sourceSpan is an ERROR (check 2a)', () => {
    const bare: PhaseView = {
      id: 'phase-bare',
      paliWords: [{ id: 'p1', segments: [{ id: 'p1s1', text: 'x', type: 'stem' }], senses: [{ english: 'x', nuance: 'n' }] }],
      englishStructure: [],
    };
    const packet = packetWith([bare], []);
    const result = validatePacket(packet);
    const blind = result.issues.filter((i) => i.code === 'canonical_segment_ids_missing');
    expect(blind).toHaveLength(1);
    expect(blind[0].level).toBe('error');
    expect(result.valid).toBe(false);
  });

  it('degraded phases are exempt from check 2a (they already error as phase_degraded)', () => {
    const degraded = buildDegradedPhaseView({
      phaseId: 'phase-d',
      sourceSpan: [],
      paliTexts: [{ surface: 'x' }],
      reason: 'test',
    });
    const packet = packetWith([degraded], []);
    const result = validatePacket(packet);
    expect(result.issues.filter((i) => i.code === 'canonical_segment_ids_missing')).toHaveLength(0);
    expect(result.issues.some((i) => i.code === 'phase_degraded')).toBe(true);
  });
});

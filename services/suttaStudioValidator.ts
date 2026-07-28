import type { DeepLoomPacket, PhaseView, ValidationIssue, WordSegment } from '../types/suttaStudio';
import { repairEnglishStructure } from './sutta-studio/utils';

type PhaseValidationOptions = {
  fallbackSegments?: Map<string, WordSegment[]>;
};

export const validatePhase = (
  phase: PhaseView,
  options: PhaseValidationOptions = {}
): { phase: PhaseView; issues: ValidationIssue[] } => {
  const issues: ValidationIssue[] = [];
  const wordIds = new Set<string>();
  const segmentIds = new Set<string>();
  const wordIdDuplicates = new Set<string>();

  phase.paliWords.forEach((word) => {
    if (wordIds.has(word.id)) wordIdDuplicates.add(word.id);
    wordIds.add(word.id);
    word.segments?.forEach((seg) => { if (seg.id) segmentIds.add(seg.id); });
  });

  wordIdDuplicates.forEach((id) => {
    issues.push({
      level: 'warn',
      code: 'word_id_duplicate',
      message: `Duplicate word id "${id}" in phase.`,
      phaseId: phase.id,
      wordId: id,
    });
  });

  const cleanedWords = phase.paliWords.map((word) => {
    let segments = Array.isArray(word.segments) ? word.segments : [];
    if (segments.length === 0) {
      const fallback = options.fallbackSegments?.get(word.id);
      if (fallback && fallback.length) {
        segments = fallback;
      } else {
        segments = [{ id: `${word.id}s1`, text: '…', type: 'stem' }];
      }
      issues.push({
        level: 'warn',
        code: 'segments_empty',
        message: 'Word had no segments; inserted fallback stem.',
        phaseId: phase.id,
        wordId: word.id,
      });
    }

    const cleanedSegments = segments.map((seg, index) => {
      if (seg.relation) {
        const targetId = seg.relation.targetWordId ?? seg.relation.targetSegmentId;
        if (!targetId || (!wordIds.has(targetId) && !segmentIds.has(targetId))) {
          issues.push({
            level: 'warn',
            code: 'relation_target_missing',
            message: `Relation target "${targetId ?? '(none)'}" missing; relation removed.`,
            phaseId: phase.id,
            wordId: word.id,
            segmentIndex: index,
          });
          const { relation, ...rest } = seg;
          return rest;
        }
      }
      return seg;
    });

    let senses = Array.isArray(word.senses) ? word.senses : [];
    if (senses.length === 0) {
      senses = [{ english: '…', nuance: 'unspecified' }];
      issues.push({
        level: 'warn',
        code: 'senses_empty',
        message: 'Word had no senses; inserted placeholder sense.',
        phaseId: phase.id,
        wordId: word.id,
      });
    }

    return {
      ...word,
      segments: cleanedSegments,
      senses,
    };
  });

  // English-structure integrity delegates to repairEnglishStructure — the
  // SAME pure repair the renderer applies as its backstop and the packet
  // validator (check 4b) reports through, so the two repair layers cannot
  // disagree. The previous inline version stripped a dangling link but KEPT
  // the token, leaving an unlinked empty pill the backstop could no longer
  // detect (it keys on the link being present). A dangling-linked token is
  // now DROPPED entirely, and english_link_dangling counts it here.
  // (Segment-level links were the historical blind spot: MN117 shipped 59
  // dangling linkedSegmentId refs while only linkedPaliId was checked,
  // 2026-07-24.)
  const cleanedWordIds = new Set(cleanedWords.map((w) => w.id));
  const cleanedSegmentIds = new Set(
    cleanedWords.flatMap((w) => (w.segments ?? []).map((s) => s.id)).filter(Boolean)
  );
  const danglingTokenIds = (phase.englishStructure ?? [])
    .filter((token) => !token.isGhost && (
      (token.linkedPaliId && !cleanedWordIds.has(token.linkedPaliId)) ||
      (!token.linkedPaliId && token.linkedSegmentId && !cleanedSegmentIds.has(token.linkedSegmentId))
    ))
    .map((token) => token.id);
  const { tokens: repairedTokens, stats: englishRepairStats } = repairEnglishStructure({
    paliWords: cleanedWords,
    englishStructure: phase.englishStructure ?? [],
  });
  const cleanedEnglish = repairedTokens as PhaseView['englishStructure'];
  if (englishRepairStats.droppedDangling > 0) {
    issues.push({
      level: 'warn',
      code: 'english_link_dangling',
      message: `${englishRepairStats.droppedDangling} English token(s) linked words/segments that do not exist; dropped: ${danglingTokenIds.slice(0, 8).join(', ')}${danglingTokenIds.length > 8 ? ' …' : ''}`,
      phaseId: phase.id,
    });
  }
  if (englishRepairStats.collapsedStutter > 0) {
    issues.push({
      level: 'warn',
      code: 'english_gloss_stutter',
      message: `${englishRepairStats.collapsedStutter} repeat gloss token(s) collapsed (segment-level links without segment senses).`,
      phaseId: phase.id,
    });
  }

  const tokenIds = new Set<string>();
  const tokenDuplicates = new Set<string>();
  cleanedEnglish.forEach((token) => {
    if (tokenIds.has(token.id)) tokenDuplicates.add(token.id);
    tokenIds.add(token.id);
  });
  tokenDuplicates.forEach((id) => {
    issues.push({
      level: 'warn',
      code: 'english_token_duplicate',
      message: `Duplicate english token id "${id}" detected.`,
      phaseId: phase.id,
      tokenId: id,
    });
  });

  return {
    phase: {
      ...phase,
      paliWords: cleanedWords,
      englishStructure: cleanedEnglish,
    },
    issues,
  };
};

/**
 * ID-level packet check ONLY (duplicate phase ids). Renamed from
 * `validatePacket` — that name oversold it and collided with the RICH
 * packet validator (services/suttaStudioPacketValidator.validatePacket),
 * which checks segment coverage, surface integrity, english links, etc.
 * The compiler runs BOTH at compile end; this one stays cheap and pure.
 */
export const validatePacketIds = (
  packet: DeepLoomPacket
): { packet: DeepLoomPacket; issues: ValidationIssue[] } => {
  const issues: ValidationIssue[] = [];
  const phaseIds = new Set<string>();
  const duplicatePhaseIds = new Set<string>();

  packet.phases.forEach((phase) => {
    if (phaseIds.has(phase.id)) duplicatePhaseIds.add(phase.id);
    phaseIds.add(phase.id);
  });

  duplicatePhaseIds.forEach((id) => {
    issues.push({
      level: 'warn',
      code: 'phase_id_duplicate',
      message: `Duplicate phase id "${id}" detected.`,
      phaseId: id,
    });
  });

  return { packet, issues };
};

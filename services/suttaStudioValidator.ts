import type { DeepLoomPacket, PhaseView, ValidationIssue, WordSegment } from '../types/suttaStudio';

type PhaseValidationOptions = {
  fallbackSegments?: Map<string, WordSegment[]>;
};

export const validatePhase = (
  phase: PhaseView,
  options: PhaseValidationOptions = {}
): { phase: PhaseView; issues: ValidationIssue[] } => {
  const issues: ValidationIssue[] = [];
  const wordIds = new Set<string>();
  const wordIdDuplicates = new Set<string>();

  phase.paliWords.forEach((word) => {
    if (wordIds.has(word.id)) wordIdDuplicates.add(word.id);
    wordIds.add(word.id);
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
        segments = [{ text: '…', type: 'stem' }];
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
      if (seg.relation && !wordIds.has(seg.relation.targetId)) {
        issues.push({
          level: 'warn',
          code: 'relation_target_missing',
          message: `Relation target "${seg.relation.targetId}" missing; relation removed.`,
          phaseId: phase.id,
          wordId: word.id,
          segmentIndex: index,
        });
        const { relation, ...rest } = seg;
        return rest;
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

  const cleanedEnglish = (phase.englishStructure ?? []).map((token) => {
    if (token.linkedPaliId && !wordIds.has(token.linkedPaliId)) {
      issues.push({
        level: 'warn',
        code: 'linked_pali_missing',
        message: `English token linked to missing word "${token.linkedPaliId}"; link removed.`,
        phaseId: phase.id,
        tokenId: token.id,
      });
      const { linkedPaliId, ...rest } = token;
      return rest;
    }
    return token;
  });

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

export const validatePacket = (
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

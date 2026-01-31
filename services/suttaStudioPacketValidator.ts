/**
 * suttaStudioPacketValidator.ts
 *
 * Post-assembly validation to ensure pipeline output matches source data.
 * Catches structural issues like duplicate segments, missing content, or text mismatches.
 */

import type {
  CanonicalSegment,
  DeepLoomPacket,
  PhaseView,
  ValidationIssue,
} from '../types/suttaStudio';

const VALIDATOR_VERSION = '1.0.0';

const log = (message: string, ...args: unknown[]) =>
  console.log(`[PacketValidator] ${message}`, ...args);

export type ValidationResult = {
  valid: boolean;
  issues: ValidationIssue[];
  stats: {
    totalPhases: number;
    duplicateSegments: number;
    missingSegments: number;
    duplicateMappings: number;
  };
};

/**
 * Validate a DeepLoomPacket against its source data.
 * Returns validation issues but does not modify the packet.
 */
export function validatePacket(
  packet: DeepLoomPacket,
  sourceSegments?: CanonicalSegment[]
): ValidationResult {
  const issues: ValidationIssue[] = [];
  const stats = {
    totalPhases: packet.phases.length,
    duplicateSegments: 0,
    missingSegments: 0,
    duplicateMappings: 0,
  };

  // 1. Check for duplicate canonical segments across phases
  const segmentToPhases = new Map<string, string[]>();
  for (const phase of packet.phases) {
    const segmentIds = phase.canonicalSegmentIds ?? [];
    for (const segId of segmentIds) {
      const existing = segmentToPhases.get(segId) ?? [];
      existing.push(phase.id);
      segmentToPhases.set(segId, existing);
    }
  }

  for (const [segId, phaseIds] of segmentToPhases) {
    if (phaseIds.length > 1) {
      stats.duplicateSegments++;
      // Note: This is often intentional sub-segment splitting (long verses split into multiple display phases)
      // Downgraded to 'warn' since the golden fixtures use this pattern by design
      issues.push({
        level: 'warn',
        code: 'canonical_segment_duplicate',
        message: `Segment ${segId} appears in ${phaseIds.length} phases (may be intentional sub-segment split): ${phaseIds.join(', ')}`,
        canonicalSegmentId: segId,
      });
    }
  }

  // 2. Check for missing segments (if source provided)
  if (sourceSegments) {
    const outputSegmentIds = new Set(segmentToPhases.keys());
    for (const seg of sourceSegments) {
      if (!outputSegmentIds.has(seg.ref.segmentId)) {
        stats.missingSegments++;
        issues.push({
          level: 'error',
          code: 'canonical_segment_missing',
          message: `Source segment ${seg.ref.segmentId} not found in output`,
          canonicalSegmentId: seg.ref.segmentId,
        });
      }
    }
  }

  // 3. Check for degraded phases
  for (const phase of packet.phases) {
    if (phase.degraded) {
      issues.push({
        level: 'error',
        code: 'phase_degraded',
        message: `Phase ${phase.id} is degraded: ${phase.degradedReason || 'unknown reason'}`,
        phaseId: phase.id,
      });
    }
  }

  // 4. Check for duplicate English mappings within each phase
  for (const phase of packet.phases) {
    if (phase.degraded) continue; // Skip degraded phases
    const duplicates = findDuplicateEnglishMappings(phase);
    for (const dup of duplicates) {
      stats.duplicateMappings++;
      issues.push({
        level: 'warn',
        code: 'english_mapping_duplicate',
        message: `Segment ${dup.segmentId} is linked by ${dup.count} English tokens in phase ${phase.id}`,
        phaseId: phase.id,
        canonicalSegmentId: dup.segmentId,
      });
    }
  }

  // 5. Check Pali/English integrity - combine sliced segments before comparing
  if (sourceSegments) {
    // Group source segments by ID (they may be sliced by wordRange)
    const sourceBySegId = new Map<string, { pali: string[]; english: string[] }>();
    for (const seg of sourceSegments) {
      const segId = seg.ref.segmentId;
      const existing = sourceBySegId.get(segId) ?? { pali: [], english: [] };
      if (seg.pali) existing.pali.push(seg.pali);
      if (seg.baseEnglish && !existing.english.includes(seg.baseEnglish)) {
        existing.english.push(seg.baseEnglish);
      }
      sourceBySegId.set(segId, existing);
    }

    // Group phases by canonical segment
    const phasesBySegId = new Map<string, PhaseView[]>();
    for (const phase of packet.phases) {
      if (phase.degraded) continue; // Skip degraded phases
      for (const segId of phase.canonicalSegmentIds ?? []) {
        const phases = phasesBySegId.get(segId) ?? [];
        phases.push(phase);
        phasesBySegId.set(segId, phases);
      }
    }

    // Check each unique canonical segment
    for (const [segId, source] of sourceBySegId) {
      const phases = phasesBySegId.get(segId) ?? [];
      if (phases.length === 0) continue;

      // PALI CHECK: Combined output must match combined source (1:1)
      const combinedSourcePali = normalizePali(source.pali.join(''));
      const combinedOutputPali = normalizePali(
        phases.flatMap((p) => p.paliWords.flatMap((w) => w.segments.map((s) => s.text))).join('')
      );

      if (combinedOutputPali !== combinedSourcePali && combinedSourcePali.length > 0) {
        issues.push({
          level: 'error',
          code: 'pali_text_mismatch',
          message: `Pali mismatch for ${segId}: got "${combinedOutputPali.slice(0, 40)}" expected "${combinedSourcePali.slice(0, 40)}"`,
          canonicalSegmentId: segId,
        });
      }

      // ENGLISH CHECK: All source English words must exist in artifact (superset allowed)
      const sourceEnglishWords = new Set(source.english.flatMap((e) => extractWords(e)));
      const outputEnglishWords = new Set(
        phases.flatMap((p) =>
          (p.englishStructure ?? [])
            .filter((t) => !t.isGhost)
            .flatMap((t) => extractWords(t.label || ''))
        )
      );

      const missingEnglish = [...sourceEnglishWords].filter((w) => !outputEnglishWords.has(w));
      if (missingEnglish.length > 0 && sourceEnglishWords.size > 0) {
        issues.push({
          level: 'warn',
          code: 'english_content_missing',
          message: `Missing ${missingEnglish.length}/${sourceEnglishWords.size} English words for ${segId}: ${missingEnglish.slice(0, 3).join(', ')}...`,
          canonicalSegmentId: segId,
        });
      }
    }
  }

  const valid = issues.filter((i) => i.level === 'error').length === 0;

  if (issues.length > 0) {
    log(`Validation complete: ${issues.length} issues (${stats.duplicateSegments} duplicate segments, ${stats.duplicateMappings} duplicate mappings)`);
  }

  return { valid, issues, stats };
}

/**
 * Find segments that are linked by multiple English tokens in a phase.
 */
function findDuplicateEnglishMappings(phase: PhaseView): { segmentId: string; count: number }[] {
  const segmentLinkCounts = new Map<string, number>();

  for (const token of phase.englishStructure ?? []) {
    if (token.linkedSegmentId) {
      const count = segmentLinkCounts.get(token.linkedSegmentId) ?? 0;
      segmentLinkCounts.set(token.linkedSegmentId, count + 1);
    }
  }

  const duplicates: { segmentId: string; count: number }[] = [];
  for (const [segmentId, count] of segmentLinkCounts) {
    if (count > 1) {
      duplicates.push({ segmentId, count });
    }
  }

  return duplicates;
}


/**
 * Normalize Pali text for exact comparison.
 * Removes punctuation and whitespace, lowercases.
 */
function normalizePali(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[.,;:!?'"()—\-–…""''«»‹›]/g, '');
}

/**
 * Extract words from English text for comparison.
 */
function extractWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[.,;:!?'"()—\-–…""''«»‹›]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 0);
}

/**
 * Calculate similarity between two strings (0-1).
 * Uses simple character overlap for efficiency.
 */
function calculateSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length === 0 || b.length === 0) return 0;

  const longer = a.length > b.length ? a : b;
  const shorter = a.length > b.length ? b : a;

  let matches = 0;
  const longerChars = [...longer];
  for (const char of shorter) {
    const idx = longerChars.indexOf(char);
    if (idx !== -1) {
      matches++;
      longerChars.splice(idx, 1);
    }
  }

  return matches / longer.length;
}

/**
 * Add validation results to a packet's compiler metadata.
 */
export function attachValidationToPacket(
  packet: DeepLoomPacket,
  result: ValidationResult
): DeepLoomPacket {
  return {
    ...packet,
    compiler: {
      ...packet.compiler!,
      validatorVersion: VALIDATOR_VERSION,
      validationIssues: result.issues.length > 0 ? result.issues : undefined,
    },
  };
}

/**
 * Diff Analysis Quality Scorer
 *
 * Computes precision, recall, and F1 scores for diff analysis results
 * against human-labeled golden data.
 *
 * Anti-Goodhart properties:
 * - Tests construct (semantic accuracy), not just schema
 * - Requires ground truth, can't be faked
 * - Calibrated: F1 score maps to real quality
 */

import type { DiffMarker, DiffReason } from '../../../services/diff/types';

export interface GoldenCase {
  id: string;
  description: string;
  aiTranslation: string;
  fanTranslation: string;
  rawText: string;
  expectedMarkers: ExpectedMarker[];
}

export interface ExpectedMarker {
  chunkId: string; // Can be regex pattern
  reasons: DiffReason[];
  colors: string[];
  explanationPattern: string | null; // Regex to match explanation text
}

export interface ScorerMetrics {
  precision: number;
  recall: number;
  f1: number;
  truePositives: number;
  falsePositives: number;
  falseNegatives: number;
  details: {
    matched: MatchedMarker[];
    missing: ExpectedMarker[];
    spurious: DiffMarker[];
  };
}

interface MatchedMarker {
  expected: ExpectedMarker;
  actual: DiffMarker;
  reasonMatch: boolean;
  explanationMatch: boolean;
}

/**
 * Score diff analysis results against golden dataset
 */
export class DiffScorer {
  /**
   * Compute F1 score for a single case
   */
  score(expected: ExpectedMarker[], actual: DiffMarker[]): ScorerMetrics {
    const matched: MatchedMarker[] = [];
    const missing: ExpectedMarker[] = [];
    const spurious: DiffMarker[] = [];

    // Track which actual markers have been matched
    const usedActual = new Set<number>();

    // For each expected marker, try to find a matching actual marker
    for (const exp of expected) {
      const chunkIdRegex = new RegExp(exp.chunkId);
      let foundMatch = false;

      for (let i = 0; i < actual.length; i++) {
        if (usedActual.has(i)) continue;

        const act = actual[i];

        // Check if chunk ID matches (using regex)
        if (!chunkIdRegex.test(act.chunkId)) continue;

        // Check if reasons overlap
        const reasonMatch = this.hasReasonOverlap(exp.reasons, act.reasons);

        // Check if explanation matches pattern (if pattern provided)
        const explanationMatch = exp.explanationPattern
          ? this.matchesExplanation(exp.explanationPattern, act.explanations)
          : true; // No pattern = don't check

        // We consider it a match if reasons overlap
        // (explanation is a soft requirement for quality, not for correctness)
        if (reasonMatch) {
          matched.push({
            expected: exp,
            actual: act,
            reasonMatch,
            explanationMatch,
          });
          usedActual.add(i);
          foundMatch = true;
          break;
        }
      }

      if (!foundMatch) {
        missing.push(exp);
      }
    }

    // Any actual markers not matched are spurious (false positives)
    for (let i = 0; i < actual.length; i++) {
      if (!usedActual.has(i)) {
        spurious.push(actual[i]);
      }
    }

    const truePositives = matched.length;
    const falsePositives = spurious.length;
    const falseNegatives = missing.length;

    const precision = truePositives + falsePositives > 0
      ? truePositives / (truePositives + falsePositives)
      : 0;

    const recall = truePositives + falseNegatives > 0
      ? truePositives / (truePositives + falseNegatives)
      : 0;

    const f1 = precision + recall > 0
      ? (2 * precision * recall) / (precision + recall)
      : 0;

    return {
      precision,
      recall,
      f1,
      truePositives,
      falsePositives,
      falseNegatives,
      details: {
        matched,
        missing,
        spurious,
      }
    };
  }

  /**
   * Check if there's overlap between expected and actual reasons
   */
  private hasReasonOverlap(expected: DiffReason[], actual: DiffReason[]): boolean {
    if (expected.length === 0 || actual.length === 0) return false;

    for (const exp of expected) {
      if (actual.includes(exp)) return true;
    }

    return false;
  }

  /**
   * Check if any explanation matches the pattern
   */
  private matchesExplanation(pattern: string, explanations: string[] | undefined): boolean {
    if (!explanations || explanations.length === 0) return false;

    const regex = new RegExp(pattern, 'i'); // Case-insensitive

    for (const explanation of explanations) {
      if (regex.test(explanation)) return true;
    }

    return false;
  }

  /**
   * Format metrics for console output
   */
  formatMetrics(metrics: ScorerMetrics, caseName: string): string {
    const lines: string[] = [];

    lines.push(`\n=== ${caseName} ===`);
    lines.push(`Precision: ${(metrics.precision * 100).toFixed(1)}%`);
    lines.push(`Recall:    ${(metrics.recall * 100).toFixed(1)}%`);
    lines.push(`F1 Score:  ${(metrics.f1 * 100).toFixed(1)}%`);
    lines.push(`TP/FP/FN:  ${metrics.truePositives}/${metrics.falsePositives}/${metrics.falseNegatives}`);

    if (metrics.details.missing.length > 0) {
      lines.push(`\nMissing markers (False Negatives):`);
      for (const miss of metrics.details.missing) {
        lines.push(`  - ${miss.chunkId}: ${miss.reasons.join(', ')}`);
      }
    }

    if (metrics.details.spurious.length > 0) {
      lines.push(`\nSpurious markers (False Positives):`);
      for (const spur of metrics.details.spurious) {
        lines.push(`  - ${spur.chunkId}: ${spur.reasons.join(', ')}`);
      }
    }

    if (metrics.details.matched.length > 0) {
      const weakMatches = metrics.details.matched.filter(m => !m.explanationMatch);
      if (weakMatches.length > 0) {
        lines.push(`\nWeak matches (correct reason, poor explanation):`);
        for (const weak of weakMatches) {
          lines.push(`  - ${weak.actual.chunkId}: ${weak.actual.reasons.join(', ')}`);
          lines.push(`    Explanation: ${weak.actual.explanations?.join('; ') || 'none'}`);
        }
      }
    }

    return lines.join('\n');
  }

  /**
   * Compute aggregate metrics across multiple cases
   */
  scoreMultiple(results: Array<{ caseId: string; expected: ExpectedMarker[]; actual: DiffMarker[] }>): {
    overall: ScorerMetrics;
    perCase: Map<string, ScorerMetrics>;
  } {
    const perCase = new Map<string, ScorerMetrics>();

    let totalTP = 0;
    let totalFP = 0;
    let totalFN = 0;

    for (const result of results) {
      const metrics = this.score(result.expected, result.actual);
      perCase.set(result.caseId, metrics);

      totalTP += metrics.truePositives;
      totalFP += metrics.falsePositives;
      totalFN += metrics.falseNegatives;
    }

    const precision = totalTP + totalFP > 0 ? totalTP / (totalTP + totalFP) : 0;
    const recall = totalTP + totalFN > 0 ? totalTP / (totalTP + totalFN) : 0;
    const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

    return {
      overall: {
        precision,
        recall,
        f1,
        truePositives: totalTP,
        falsePositives: totalFP,
        falseNegatives: totalFN,
        details: { matched: [], missing: [], spurious: [] }, // Aggregated details not provided
      },
      perCase,
    };
  }
}

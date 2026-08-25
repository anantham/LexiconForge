import type {
  LiturgyDoc,
  TripleScriptWitnessSegment,
  WordGloss,
} from '../../types/liturgy';
import { resolveAlignmentTargets } from './alignmentTargets';
import { tokenizeEnglish, tokenizeSegmentPali } from './validation';

export type LiturgyRouteDoc = {
  route: string;
  doc: LiturgyDoc;
};

export type FineTargetReviewIssue = {
  code: 'fine_target_review_required';
  route: string;
  sectionId: string;
  segmentId: string;
  witnessBy: string;
  paliIndex: number;
  paliForm: string;
  englishTokens: string[];
  morphemes: string[];
  unreviewedEnglishTokens: string[];
};

export type AlignmentAuditSummary = {
  routes: number;
  sections: number;
  segments: number;
  sourceWordRecords: number;
  surfaceMorphemeWordRecords: number;
  layeredAnalysisWordRecords: number;
  witnesses: number;
  alignedWitnesses: number;
  englishTokens: number;
  alignedEnglishTokens: number;
  explicitReviewedTargets: number;
  fineTargetReviewGroups: number;
};

export type AlignmentAuditResult = {
  summary: AlignmentAuditSummary;
  issues: FineTargetReviewIssue[];
  issuesByRoute: Record<string, number>;
};

function createSummary(): AlignmentAuditSummary {
  return {
    routes: 0,
    sections: 0,
    segments: 0,
    sourceWordRecords: 0,
    surfaceMorphemeWordRecords: 0,
    layeredAnalysisWordRecords: 0,
    witnesses: 0,
    alignedWitnesses: 0,
    englishTokens: 0,
    alignedEnglishTokens: 0,
    explicitReviewedTargets: 0,
    fineTargetReviewGroups: 0,
  };
}

function normalizedSurface(value: string): string {
  return value.normalize('NFC').toLocaleLowerCase();
}

function wordForSurface(
  segment: TripleScriptWitnessSegment,
  surface: string | undefined
): WordGloss | undefined {
  if (!surface) return undefined;
  const normalized = normalizedSurface(surface);
  return segment.words?.find((word) => normalizedSurface(word.form) === normalized);
}

/**
 * Exhaustively traverse every registered source-word record and witness token.
 * The audit reports only the dangerous review class: several English tokens
 * share a multi-morpheme word while one or more tokens lack an explicit fine
 * target (or an explicit reviewed whole-word decision).
 */
export function auditLiturgyAlignments(routes: readonly LiturgyRouteDoc[]): AlignmentAuditResult {
  const summary = createSummary();
  const issues: FineTargetReviewIssue[] = [];

  for (const { route, doc } of routes) {
    summary.routes += 1;
    for (const section of doc.sections) {
      if (section.shape !== 'triple-script-witness') continue;
      summary.sections += 1;

      for (const segment of section.segments) {
        summary.segments += 1;
        summary.sourceWordRecords += segment.words?.length ?? 0;
        summary.surfaceMorphemeWordRecords +=
          segment.words?.filter((word) => (word.morphemes?.length ?? 0) > 0).length ?? 0;
        summary.layeredAnalysisWordRecords +=
          segment.words?.filter((word) => word.analysis !== undefined).length ?? 0;

        const paliTokens = tokenizeSegmentPali(segment);
        for (const witness of segment.witnesses) {
          summary.witnesses += 1;
          const englishTokens = tokenizeEnglish(witness.text);
          summary.englishTokens += englishTokens.length;
          if (!witness.alignTo) continue;

          summary.alignedWitnesses += 1;
          const resolved = resolveAlignmentTargets({
            alignTo: witness.alignTo,
            morphemeAlignTo: witness.morphemeAlignTo,
            tokenAlignTo: witness.tokenAlignTo,
          });
          const grouped = new Map<number, number[]>();

          witness.alignTo.forEach((paliIndex, englishIndex) => {
            if (paliIndex < 0) return;
            summary.alignedEnglishTokens += 1;
            const target = resolved[englishIndex];
            if (target && (target.kind !== 'word' || target.reviewed)) {
              summary.explicitReviewedTargets += 1;
            }
            const indices = grouped.get(paliIndex) ?? [];
            indices.push(englishIndex);
            grouped.set(paliIndex, indices);
          });

          for (const [paliIndex, englishIndices] of grouped) {
            if (englishIndices.length < 2) continue;
            const paliForm = paliTokens[paliIndex];
            const word = wordForSurface(segment, paliForm);
            if (!word?.morphemes || word.morphemes.length < 2) continue;

            const unreviewedIndices = englishIndices.filter((englishIndex) => {
              const target = resolved[englishIndex];
              return target?.kind === 'word' && !target.reviewed;
            });
            if (unreviewedIndices.length === 0) continue;

            issues.push({
              code: 'fine_target_review_required',
              route,
              sectionId: section.id,
              segmentId: segment.id,
              witnessBy: witness.by,
              paliIndex,
              paliForm: paliForm ?? `word-${paliIndex}`,
              englishTokens: englishIndices.map(
                (englishIndex) => englishTokens[englishIndex] ?? `token-${englishIndex}`
              ),
              morphemes: word.morphemes.map((morpheme) => morpheme.text),
              unreviewedEnglishTokens: unreviewedIndices.map(
                (englishIndex) => englishTokens[englishIndex] ?? `token-${englishIndex}`
              ),
            });
          }
        }
      }
    }
  }

  summary.fineTargetReviewGroups = issues.length;
  const issuesByRoute: Record<string, number> = {};
  for (const issue of issues) {
    issuesByRoute[issue.route] = (issuesByRoute[issue.route] ?? 0) + 1;
  }

  return { summary, issues, issuesByRoute };
}

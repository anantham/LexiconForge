/**
 * Skeleton-pass prompt builder.
 *
 * Groups SuttaCentral segments into small study phases (~3-8 Pali words each).
 * No semantic analysis — pure segmentation work.
 *
 * Inputs: canonical segments + boundary notes (which works/chapters start where) +
 *         flag for whether cross-chapter phases are allowed.
 * Output: array of `{ id, title, segmentIds }` phase descriptors.
 *
 * The Skeleton pass receives no V2 amendments — its concern is phase grouping,
 * which doesn't intersect with tooltip register, sense metadata, or anchor
 * selection.
 */

import type { CanonicalSegment } from '../../../types/suttaStudio';
import { SUTTA_STUDIO_BASE_CONTEXT, SUTTA_STUDIO_SKELETON_CONTEXT } from '../../../config/suttaStudioPromptContext';
import { SUTTA_STUDIO_SKELETON_EXAMPLE_JSON } from '../../../config/suttaStudioExamples';
import { buildBoundaryContext, type BoundaryNote } from '../../compiler/utils';

export const buildSkeletonPrompt = (
  segments: CanonicalSegment[],
  options: { exampleSegmentId?: string; boundaries?: BoundaryNote[]; allowCrossChapter?: boolean }
) => {
  const lines = segments.map((seg) => {
    const english = seg.baseEnglish ? ` | english: ${seg.baseEnglish}` : '';
    return `${seg.ref.segmentId} | pali: ${seg.pali}${english}`;
  });
  const exampleSegment = options.exampleSegmentId || segments[0]?.ref.segmentId || 'mn1:1.1';
  const examplePrefix = exampleSegment.split(':')[0] || 'mn1';
  const boundaryContext = options.boundaries
    ? buildBoundaryContext(options.boundaries, Boolean(options.allowCrossChapter))
    : '';

  return `You are DeepLoomCompiler.\n\n${SUTTA_STUDIO_BASE_CONTEXT}\n\n${SUTTA_STUDIO_SKELETON_CONTEXT}\n${boundaryContext}\nTask: Group the following SuttaCentral segments into SMALL study phases.\n\nCRITICAL RULES:\n- MAXIMUM 8 Pali words per phase (count space-separated tokens).\n- Typical phase: 1-3 segments only.\n- Title/header segments get their own phase.\n- Opening formulas get their own phase.\n- Each segment must appear exactly once.\n- Keep the original order.\n\nReturn JSON ONLY with this shape:\n{\n  "phases": [\n    { "id": "phase-1", "title": "<short title or empty>", "segmentIds": ["${examplePrefix}:1.1", "${examplePrefix}:1.2"] }\n  ]\n}\n\nEXAMPLE (do NOT copy ids):\n${SUTTA_STUDIO_SKELETON_EXAMPLE_JSON}\n\nSegments:\n${lines.join('\n')}`;
};

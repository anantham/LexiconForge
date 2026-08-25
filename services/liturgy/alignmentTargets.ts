import type { TokenAlignmentTarget } from '../../types/liturgy';

export type ResolvedAlignmentTarget =
  | { kind: 'word'; paliIdx: number; reviewed: boolean }
  | { kind: 'morpheme'; paliIdx: number; morphemeIdx: number }
  | { kind: 'analysis'; paliIdx: number; unitId: string };

export type ResolveAlignmentTargetsInput = {
  alignTo: number[] | undefined;
  /** Legacy explicit surface-morpheme targets. */
  morphemeAlignTo?: (number | null)[];
  /** New reviewed word/morpheme/layered targets. */
  tokenAlignTo?: (TokenAlignmentTarget | null)[];
};

function resolveExplicitTarget(
  paliIdx: number,
  target: TokenAlignmentTarget
): ResolvedAlignmentTarget {
  switch (target.kind) {
    case 'word':
      return { kind: 'word', paliIdx, reviewed: true };
    case 'morpheme':
      return { kind: 'morpheme', paliIdx, morphemeIdx: target.index };
    case 'analysis':
      return { kind: 'analysis', paliIdx, unitId: target.unitId };
  }
}

/**
 * Resolve every English token to its most specific authored target.
 *
 * This function deliberately contains no positional heuristic. When the
 * curator has not named a finer target, the token stays at the whole Pāli
 * word. That makes incomplete curation visible without drawing a false claim.
 */
export function resolveAlignmentTargets({
  alignTo,
  morphemeAlignTo,
  tokenAlignTo,
}: ResolveAlignmentTargetsInput): Array<ResolvedAlignmentTarget | null> {
  if (!alignTo) return [];

  return alignTo.map((paliIdx, englishIndex) => {
    if (paliIdx < 0) return null;

    const explicit = tokenAlignTo?.[englishIndex];
    if (explicit) return resolveExplicitTarget(paliIdx, explicit);

    const legacyMorphemeIndex = morphemeAlignTo?.[englishIndex];
    if (typeof legacyMorphemeIndex === 'number') {
      return { kind: 'morpheme', paliIdx, morphemeIdx: legacyMorphemeIndex };
    }

    return { kind: 'word', paliIdx, reviewed: false };
  });
}

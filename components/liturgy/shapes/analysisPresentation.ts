import type {
  WordAnalysisStatus,
  WordAnalysisUnit,
  WordGloss,
} from '../../../types/liturgy';

const STATUS_PRIORITY: Record<WordAnalysisStatus, number> = {
  confirmed: 0,
  alternative: 1,
  'needs-review': 2,
};

export const ANALYSIS_STATUS_LABEL: Record<WordAnalysisStatus, string> = {
  confirmed: 'confirmed',
  alternative: 'alternative reading',
  'needs-review': 'needs review',
};

export const ANALYSIS_STATUS_CLASS: Record<WordAnalysisStatus, string> = {
  confirmed: 'border-solid border-emerald-500/70 hover:border-emerald-300',
  alternative: 'border-dotted border-amber-400/80 hover:border-amber-200',
  'needs-review': 'border-dashed border-rose-400/90 hover:border-rose-200',
};

export type SurfaceAnalysisPresentation = {
  unitIds: string[];
  status: WordAnalysisStatus;
  tooltip: string;
};

function effectiveStatus(
  units: WordAnalysisUnit[],
  fallback: WordAnalysisStatus
): WordAnalysisStatus {
  return units.reduce<WordAnalysisStatus>((current, unit) => {
    const candidate = unit.status ?? fallback;
    return STATUS_PRIORITY[candidate] > STATUS_PRIORITY[current] ? candidate : current;
  }, fallback);
}

/**
 * Describe the layered evidence carried by one exact surface morpheme.
 * The most cautious unit status controls presentation so mixed evidence can
 * never be made to look more certain than its least-settled contribution.
 */
export function presentSurfaceAnalysis(
  word: WordGloss,
  morphemeIndex: number
): SurfaceAnalysisPresentation | null {
  const analysis = word.analysis;
  if (!analysis) return null;
  const units = analysis.units.filter((unit) =>
    unit.surfaceMorphemeIndices.includes(morphemeIndex)
  );
  if (units.length === 0) return null;

  const status = effectiveStatus(units, analysis.status);
  const identities = units
    .map((unit) => `${unit.layer} ${unit.label}: ${unit.gloss}`)
    .join('; ');
  return {
    unitIds: units.map((unit) => unit.id),
    status,
    tooltip: `Layered analysis (${ANALYSIS_STATUS_LABEL[status]}): ${identities}`,
  };
}

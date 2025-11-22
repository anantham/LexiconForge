import type { DiffMarker, DiffReason } from '../../services/diff/types';
import type { DiffMarkerVisibilitySettings } from '../../types';

export const DEFAULT_DIFF_MARKER_VISIBILITY: DiffMarkerVisibilitySettings = {
  fan: true,
  rawLoss: true,
  rawGain: true,
  sensitivity: true,
  stylistic: true,
};

type DiffDisplayCategory = 'fan' | 'rawLoss' | 'rawGain' | 'sensitivity' | 'stylistic';
type DiffDisplayColor = 'red' | 'orange' | 'blue' | 'purple' | 'grey';

export interface UiDiffMarker extends DiffMarker {
  displayColors: DiffDisplayColor[];
  displayReasons: DiffReason[];
  displayExplanations: string[];
}

const COLOR_BY_CATEGORY: Record<DiffDisplayCategory, DiffDisplayColor> = {
  fan: 'blue',
  rawLoss: 'red',
  rawGain: 'orange',
  sensitivity: 'purple',
  stylistic: 'grey',
};

const reasonToCategory = (reason: DiffReason): DiffDisplayCategory => {
  switch (reason) {
    case 'missing-context':
    case 'plot-omission':
    case 'raw-divergence':
      return 'rawLoss';
    case 'added-detail':
    case 'hallucination':
      return 'rawGain';
    case 'fan-divergence':
      return 'fan';
    case 'sensitivity-filter':
      return 'sensitivity';
    case 'stylistic-choice':
    case 'no-change':
      return 'stylistic';
    default:
      return 'fan';
  }
};

export const resolveMarkerVisibility = (
  visibility?: DiffMarkerVisibilitySettings | Record<string, any>
): DiffMarkerVisibilitySettings => {
  const incoming = visibility ?? {};
  const normalized: DiffMarkerVisibilitySettings = {
    ...DEFAULT_DIFF_MARKER_VISIBILITY,
    ...(incoming as Record<string, boolean>),
  };

  if (Object.prototype.hasOwnProperty.call(incoming, 'raw')) {
    const legacyRaw = (incoming as Record<string, boolean>).raw;
    if (typeof legacyRaw === 'boolean') {
      normalized.rawLoss = legacyRaw;
      normalized.rawGain = legacyRaw;
    }
  }

  return normalized;
};

export const mapMarkerForVisibility = (
  marker: DiffMarker,
  visibility: DiffMarkerVisibilitySettings
): UiDiffMarker | null => {
  const displayColors: DiffDisplayColor[] = [];
  const displayReasons: DiffReason[] = [];
  const displayExplanations: string[] = [];
  const seenColors = new Set<DiffDisplayColor>();

  const reasons = marker.reasons || [];
  const explanations = marker.explanations || [];

  for (let index = 0; index < reasons.length; index++) {
    const reason = reasons[index];
    const category = reasonToCategory(reason);
    let isEnabled = true;
    switch (category) {
      case 'fan':
        isEnabled = visibility.fan !== false;
        break;
      case 'rawLoss':
        isEnabled = visibility.rawLoss !== false;
        break;
      case 'rawGain':
        isEnabled = visibility.rawGain !== false;
        break;
      case 'sensitivity':
        isEnabled = visibility.sensitivity !== false;
        break;
      case 'stylistic':
        isEnabled = visibility.stylistic === true;
        break;
      default:
        isEnabled = true;
    }

    if (!isEnabled) {
      continue;
    }

    const color = COLOR_BY_CATEGORY[category];
    if (!seenColors.has(color)) {
      displayColors.push(color);
      seenColors.add(color);
    }
    displayReasons.push(reason);
    const explanationRaw = explanations[index];
    const normalizedExplanation = typeof explanationRaw === 'string' ? explanationRaw.trim() : '';
    displayExplanations.push(normalizedExplanation);
  }

  if (displayColors.length === 0) {
    return null;
  }

  return {
    ...marker,
    displayColors,
    displayReasons,
    displayExplanations,
  };
};

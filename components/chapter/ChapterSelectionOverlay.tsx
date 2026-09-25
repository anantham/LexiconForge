import React from 'react';
import { SelectionOverlay } from './SelectionOverlay';
import type { SelectionFeedback } from '../../types';

interface Props {
  selection: { text: string; rect: DOMRect } | null;
  viewMode: 'original' | 'fan' | 'english';
  isTouch: boolean;
  inlineEditActive: boolean;
  canCompare: boolean;
  comparisonLoading: boolean;
  beginInlineEdit: () => void;
  handleCompareRequest: () => void;
  handleFeedbackSubmit: (feedback: SelectionFeedback) => void;
  clearSelection: () => void;
  viewRef: React.RefObject<HTMLDivElement | null>;
  onSelfInsert?: () => void;
  enableSillyTavern?: boolean;
}

const ChapterSelectionOverlay: React.FC<Props> = (props) => {
  if (!props.selection) {
    return null;
  }

  return <SelectionOverlay {...props} />;
};

export default ChapterSelectionOverlay;

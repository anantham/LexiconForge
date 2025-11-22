import React from 'react';
import { SelectionOverlay } from './SelectionOverlay';

interface Props {
  selection: { text: string; rect: DOMRect } | null;
  viewMode: 'original' | 'fan' | 'english';
  isTouch: boolean;
  inlineEditActive: boolean;
  canCompare: boolean;
  comparisonLoading: boolean;
  beginInlineEdit: () => void;
  handleCompareRequest: () => void;
  handleFeedbackSubmit: (feedback: { type: string; selection: string }) => void;
  clearSelection: () => void;
  viewRef: React.RefObject<HTMLDivElement>;
}

const ChapterSelectionOverlay: React.FC<Props> = (props) => {
  if (!props.selection) {
    return null;
  }

  return <SelectionOverlay {...props} />;
};

export default ChapterSelectionOverlay;

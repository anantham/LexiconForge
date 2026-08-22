import React from 'react';
import type { FeedbackItem } from '../../types';
import FeedbackPopover from '../FeedbackPopover';
import { MobileSelectionSheet } from './MobileSelectionSheet';

type SelectionInfo = {
  text: string;
  rect: DOMRect;
};

interface SelectionOverlayProps {
  selection: SelectionInfo | null;
  viewMode: 'original' | 'fan' | 'english';
  isTouch: boolean;
  inlineEditActive: boolean;
  canCompare: boolean;
  comparisonLoading: boolean;
  beginInlineEdit: () => void;
  handleCompareRequest: () => void;
  handleFeedbackSubmit: (_feedback: { type: FeedbackItem['type']; selection: string; comment?: string }) => void;
  clearSelection: () => void;
  viewRef: React.RefObject<HTMLDivElement>;
  onSelfInsert?: () => void | Promise<void>;
  enableSillyTavern?: boolean;
}

export const SelectionOverlay: React.FC<SelectionOverlayProps> = ({
  selection,
  viewMode,
  isTouch,
  inlineEditActive,
  canCompare,
  comparisonLoading,
  beginInlineEdit,
  handleCompareRequest,
  handleFeedbackSubmit,
  clearSelection,
  viewRef,
  onSelfInsert,
  enableSillyTavern,
}) => {
  if (viewMode === 'original' || !selection || inlineEditActive) {
    return null;
  }

  if (isTouch) {
    return (
      <MobileSelectionSheet
        selectedText={selection.text}
        canCompare={canCompare}
        isComparing={comparisonLoading}
        onSelfInsert={onSelfInsert}
        enableSillyTavern={enableSillyTavern}
        onReact={(emoji, comment) => {
          if (emoji === '✏️') {
            beginInlineEdit();
          } else if (emoji === '🔍') {
            handleCompareRequest();
          } else {
            handleFeedbackSubmit({ type: emoji, selection: selection.text, comment });
          }
        }}
        onCopy={async () => {
          try {
            await navigator.clipboard?.writeText(selection.text);
          } catch {
            // Clipboard permission failures should not dismiss the selection.
          }
        }}
        onClose={clearSelection}
      />
    );
  }

  return (
    <FeedbackPopover
      selectionText={selection.text}
      position={selection.rect}
      positioningParentRef={viewRef}
      onFeedback={handleFeedbackSubmit}
      onEdit={beginInlineEdit}
      onCompare={handleCompareRequest}
      canCompare={canCompare && !comparisonLoading}
      onSelfInsert={onSelfInsert}
      enableSillyTavern={enableSillyTavern}
    />
  );
};

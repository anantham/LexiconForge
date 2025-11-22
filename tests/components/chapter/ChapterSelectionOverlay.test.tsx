import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ChapterSelectionOverlay from '../../../components/chapter/ChapterSelectionOverlay';

const selection = { text: 'hello', rect: new DOMRect() };
const baseProps = {
  selection,
  viewMode: 'english' as const,
  isTouch: true,
  inlineEditActive: false,
  canCompare: true,
  comparisonLoading: false,
  beginInlineEdit: vi.fn(),
  handleCompareRequest: vi.fn(),
  handleFeedbackSubmit: vi.fn(),
  clearSelection: vi.fn(),
  viewRef: { current: document.createElement('div') },
};

describe('ChapterSelectionOverlay', () => {
  it('renders SelectionOverlay when selection exists', () => {
    render(<ChapterSelectionOverlay {...baseProps} />);
    expect(screen.getByText('Copy')).toBeInTheDocument();
  });

  it('returns null without selection', () => {
    const { container } = render(<ChapterSelectionOverlay {...baseProps} selection={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});

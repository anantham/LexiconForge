import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { SelectionOverlay } from '../../../components/chapter/SelectionOverlay';

const baseSelection = {
  text: 'Test passage',
  rect: new DOMRect(0, 0, 10, 10),
};

const createProps = () => ({
  selection: baseSelection,
  viewMode: 'english' as const,
  isTouch: false,
  inlineEditActive: false,
  canCompare: true,
  comparisonLoading: false,
  beginInlineEdit: vi.fn(),
  handleCompareRequest: vi.fn(),
  handleFeedbackSubmit: vi.fn(),
  clearSelection: vi.fn(),
  viewRef: { current: document.createElement('div') },
});

describe('SelectionOverlay', () => {
  it('renders nothing when selection is absent', () => {
    const props = createProps();
    const { container } = render(<SelectionOverlay {...props} selection={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders FeedbackPopover when on desktop', () => {
    const props = createProps();
    document.body.appendChild(props.viewRef.current!);
    render(<SelectionOverlay {...props} />);
    expect(screen.getByTitle('Edit selection')).toBeInTheDocument();
  });

  it('renders SelectionSheet on touch devices', () => {
    const props = createProps();
    render(
      <SelectionOverlay
        {...props}
        isTouch
      />
    );
    expect(screen.getByText('Copy')).toBeInTheDocument();
  });
});

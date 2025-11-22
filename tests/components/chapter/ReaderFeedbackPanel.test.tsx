import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import ReaderFeedbackPanel from '../../../components/chapter/ReaderFeedbackPanel';

const feedback = [
  { id: '1', type: '👍', selection: 'Line A', comment: 'Nice!', chapterId: 'c1', timestamp: 0, text: '', category: '' },
];

describe('ReaderFeedbackPanel', () => {
  it('renders feedback and forwards handlers in english mode', () => {
    const onDelete = vi.fn();
    const onUpdate = vi.fn();
    const onScroll = vi.fn();
    render(
      <ReaderFeedbackPanel
        feedback={feedback}
        viewMode="english"
        onDelete={onDelete}
        onUpdate={onUpdate}
        onScrollToText={onScroll}
      />
    );

    expect(screen.getByRole('heading', { name: /reader feedback/i })).toBeInTheDocument();
    screen.getByTitle('Delete feedback').click();
    expect(onDelete).toHaveBeenCalledWith('1');
  });

  it('returns null outside english mode or without feedback', () => {
    const { rerender, container } = render(
      <ReaderFeedbackPanel
        feedback={[]}
        viewMode="english"
        onDelete={vi.fn()}
        onUpdate={vi.fn()}
        onScrollToText={vi.fn()}
      />
    );
    expect(container).toBeEmptyDOMElement();

    rerender(
      <ReaderFeedbackPanel
        feedback={feedback}
        viewMode="original"
        onDelete={vi.fn()}
        onUpdate={vi.fn()}
        onScrollToText={vi.fn()}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });
});

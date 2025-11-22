import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import FootnotesPanel from '../../../components/chapter/FootnotesPanel';

describe('FootnotesPanel', () => {
  const footnotes = [
    { marker: '[1]', text: 'Note one' },
    { marker: '[2]', text: 'Note two' },
  ];

  it('renders nothing when no footnotes provided', () => {
    const { container } = render(<FootnotesPanel chapterId="ch1" footnotes={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders ordered list of footnotes', () => {
    render(<FootnotesPanel chapterId="ch1" footnotes={footnotes as any} />);
    expect(screen.getByText('Note one')).toBeInTheDocument();
    expect(screen.getAllByText('↑')).toHaveLength(2);
  });
});

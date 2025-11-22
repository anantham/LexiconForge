import React, { useRef } from 'react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import { useFootnoteNavigation } from '../../hooks/useFootnoteNavigation';

const createTarget = (id: string, spy: () => void) => {
  const node = document.createElement('div');
  node.id = id;
  (node as any).scrollIntoView = spy;
  document.body.appendChild(node);
  return node;
};

const TestComponent: React.FC<{ viewMode: 'original' | 'fan' | 'english'; chapterId: string | null }>
= ({ viewMode, chapterId }) => {
  const ref = useRef<HTMLDivElement>(null);
  useFootnoteNavigation(ref, viewMode, chapterId);
  return (
    <div ref={ref}>
      <a href="#footnote-test">Jump</a>
    </div>
  );
};

describe('useFootnoteNavigation', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    window.location.hash = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('scrolls to footnote when anchor clicked', () => {
    const scrollSpy = vi.fn();
    createTarget('footnote-test', scrollSpy);
    const { getByText } = render(<TestComponent viewMode="english" chapterId="c1" />);
    fireEvent.click(getByText('Jump'));
    expect(scrollSpy).toHaveBeenCalledTimes(1);
  });

  it('responds to hash changes and initial hash', () => {
    const scrollSpy = vi.fn();
    createTarget('footnote-init', scrollSpy);
    window.location.hash = '#footnote-init';
    render(<TestComponent viewMode="english" chapterId="c2" />);
    expect(scrollSpy).toHaveBeenCalledTimes(1);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    expect(scrollSpy).toHaveBeenCalledTimes(2);
  });
});

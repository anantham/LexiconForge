import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import ComparisonPortal from '../../../components/chapter/ComparisonPortal';
import type { ComparisonChunk } from '../../../hooks/useComparisonPortal';

const chunk: ComparisonChunk = {
  selection: 'Sample text',
  fanExcerpt: 'Fan excerpt',
  fanContextBefore: null,
  fanContextAfter: null,
  rawExcerpt: 'Raw excerpt',
  rawContextBefore: null,
  rawContextAfter: null,
  confidence: 0.8,
};

const createPortalNode = () => {
  const div = document.createElement('div');
  document.body.appendChild(div);
  return div;
};

describe('ComparisonPortal', () => {
  let portalNode: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = '';
    portalNode = createPortalNode();
  });

  it('renders expanded view with controls', () => {
    const setExpanded = vi.fn();
    const setShowRaw = vi.fn();
    const dismiss = vi.fn();
    render(
      <ComparisonPortal
        viewMode="english"
        comparisonChunk={chunk}
        comparisonPortalNode={portalNode}
        comparisonExpanded
        setComparisonExpanded={setExpanded}
        comparisonLoading={false}
        comparisonError={null}
        showRawComparison={false}
        setShowRawComparison={setShowRaw}
        dismissComparison={dismiss}
      />
    );
    expect(portalNode.textContent).toContain('Comparison with fan translation');
    fireEvent.click(document.querySelector('button[title="Show raw text"]')!);
    expect(setShowRaw).toHaveBeenCalledWith(true);
    fireEvent.click(document.querySelector('button:nth-of-type(3)')!);
    expect(dismiss).toHaveBeenCalledTimes(1);
  });

  it('renders collapsed state when not expanded', () => {
    const setExpanded = vi.fn();
    render(
      <ComparisonPortal
        viewMode="english"
        comparisonChunk={chunk}
        comparisonPortalNode={portalNode}
        comparisonExpanded={false}
        setComparisonExpanded={setExpanded}
        comparisonLoading={false}
        comparisonError={null}
        showRawComparison={false}
        setShowRawComparison={vi.fn()}
        dismissComparison={vi.fn()}
      />
    );
    fireEvent.click(portalNode.querySelector('button')!);
    expect(setExpanded).toHaveBeenCalledWith(true);
  });
});

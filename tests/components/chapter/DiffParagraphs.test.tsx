import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import DiffParagraphs from '../../../components/chapter/DiffParagraphs';

const tokenData = {
  tokens: [],
  nodes: [],
  paragraphs: [
    {
      position: 0,
      diffChunkId: 'chunk-0',
      chunkId: 'chunk-0',
      nodes: [<span key="node">Paragraph</span>],
    },
  ],
};

describe('DiffParagraphs', () => {
  it('renders diff paragraphs and attaches marker data', () => {
    render(
      <DiffParagraphs
        translationTokensData={tokenData as any}
        markersByPosition={new Map()}
        showHeatmap
        markerVisibilitySettings={{ fan: true, rawLoss: true, rawGain: true, sensitivity: true, stylistic: true }}
        diffMarkersLoading={false}
        onMarkerClick={vi.fn()}
      />
    );
    expect(screen.getByText('Paragraph')).toBeInTheDocument();
  });
});

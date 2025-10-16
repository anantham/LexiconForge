import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DiffGutter } from '../../../components/diff/DiffGutter';
import type { DiffMarker } from '../../../services/diff/types';

describe('DiffGutter', () => {
  const mockMarkers: DiffMarker[] = [
    { chunkId: 'para-0-abc', colors: ['orange'], reasons: ['raw-divergence'], aiRange: { start: 0, end: 50 }, position: 0 },
    { chunkId: 'para-1-def', colors: ['red', 'grey'], reasons: ['missing-context', 'stylistic-choice'], aiRange: { start: 52, end: 120 }, position: 1 }
  ];

  it('should render markers in gutter', () => {
    render(<DiffGutter markers={mockMarkers} onMarkerClick={() => {}} />);
    const pips = screen.getAllByRole('button');
    expect(pips.length).toBeGreaterThanOrEqual(2); // At least 2 markers
  });

  it('should position markers based on scroll percentage', () => {
    const { container } = render(<DiffGutter markers={mockMarkers} onMarkerClick={() => {}} />);
    const gutterMarkers = container.querySelectorAll('[data-position]');
    expect(gutterMarkers.length).toBe(2);
  });

  it('should not render when markers array is empty', () => {
    const { container } = render(<DiffGutter markers={[]} onMarkerClick={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  it('should call onMarkerClick when a marker is clicked', () => {
    const handleClick = vi.fn();
    render(<DiffGutter markers={[mockMarkers[0]]} onMarkerClick={handleClick} />);
    const pip = screen.getByRole('button');
    pip.click();
    expect(handleClick).toHaveBeenCalledWith(mockMarkers[0]);
  });
});

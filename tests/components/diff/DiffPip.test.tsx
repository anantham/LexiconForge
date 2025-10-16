import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DiffPip } from '../../../components/diff/DiffPip';

describe('DiffPip', () => {
  it('should render single color pip', () => {
    render(<DiffPip colors={['orange']} onClick={() => {}} />);
    const pip = screen.getByRole('button');
    expect(pip).toHaveStyle({ backgroundColor: 'var(--diff-orange)' });
  });

  it('should render stacked pips for 2 colors', () => {
    render(<DiffPip colors={['orange', 'red']} onClick={() => {}} />);
    const pips = screen.getAllByRole('button');
    expect(pips).toHaveLength(2);
  });

  it('should show halo for 3+ colors', () => {
    render(<DiffPip colors={['orange', 'red', 'green']} onClick={() => {}} />);
    const container = screen.getByTestId('diff-pip-container');
    // CSS modules hash the class names, so check if className contains hasHalo
    expect(container.className).toMatch(/hasHalo/);
  });

  it('should call onClick when clicked', () => {
    const handleClick = vi.fn();
    render(<DiffPip colors={['grey']} onClick={handleClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('should sort colors by priority (orange first)', () => {
    render(<DiffPip colors={['grey', 'orange']} onClick={() => {}} />);
    const pips = screen.getAllByRole('button');
    // First pip should be orange (higher priority)
    expect(pips[0]).toHaveStyle({ backgroundColor: 'var(--diff-orange)' });
  });
});

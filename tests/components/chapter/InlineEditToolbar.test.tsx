import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import InlineEditToolbar from '../../../components/chapter/InlineEditToolbar';

const createToolbar = () => ({
  inlineEditState: { chunkId: '1', element: document.createElement('div'), originalText: 'text', saveAsNewVersion: false },
  toolbarCoords: { top: 10, left: 20 },
  onSave: vi.fn(),
  onCancel: vi.fn(),
  onToggleNewVersion: vi.fn(),
});

describe('InlineEditToolbar', () => {
  it('fires callbacks for save/cancel/toggle', () => {
    const props = createToolbar();
    render(<InlineEditToolbar {...props} />);
    fireEvent.click(screen.getByText('Save'));
    fireEvent.click(screen.getByText('Cancel'));
    fireEvent.click(screen.getByLabelText(/New version/));
    expect(props.onSave).toHaveBeenCalled();
    expect(props.onCancel).toHaveBeenCalled();
    expect(props.onToggleNewVersion).toHaveBeenCalled();
  });
});

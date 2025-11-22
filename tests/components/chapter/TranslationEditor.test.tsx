import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import TranslationEditor from '../../../components/chapter/TranslationEditor';

const settings = {
  contextDepth: 1,
  preloadCount: 1,
  fontSize: 16,
  fontStyle: 'serif' as const,
  lineHeight: 1.5,
};

describe('TranslationEditor', () => {
  it('calls onChange when text updates', () => {
    const onChange = vi.fn();
    render(<TranslationEditor value="Hello" onChange={onChange} settings={settings as any} />);
    fireEvent.change(screen.getByPlaceholderText(/Edit the translation/i), { target: { value: 'Updated' } });
    expect(onChange).toHaveBeenCalledWith('Updated');
  });
});

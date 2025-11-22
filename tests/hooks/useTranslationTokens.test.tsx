import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useTranslationTokens } from '../../hooks/useTranslationTokens';

const HookProbe: React.FC<{ viewMode: 'original' | 'fan' | 'english'; text: string }>
= ({ viewMode, text }) => {
  const { translationTokensData } = useTranslationTokens(viewMode, text, 'ch1');
  return <div data-testid="count">{translationTokensData.tokens.length}</div>;
};

describe('useTranslationTokens', () => {
  it('returns empty tokens outside english mode', () => {
    render(<HookProbe viewMode="fan" text="Hello" />);
    expect(screen.getByTestId('count').textContent).toBe('0');
  });

  it('tokenizes content in english mode', () => {
    render(<HookProbe viewMode="english" text={'First paragraph'} />);
    expect(Number(screen.getByTestId('count').textContent)).toBeGreaterThan(0);
  });
});

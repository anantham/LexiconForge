import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EnglishWordEngine } from '../../../components/sutta-studio/EnglishWord';
import type { PaliWord } from '../../../types/suttaStudio';

// A Pāli word with two senses: the English token linked to it gets one dot per sense.
const paliWords: PaliWord[] = [{
  id: 'w1',
  segments: [],
  senses: [
    { english: 'thus', nuance: 'manner of speaking' },
    { english: 'in this way', nuance: 'manner of acting' },
  ],
}];

const renderWord = (showCycleDots?: boolean) => render(
  <EnglishWordEngine
    phaseId="p1"
    structure={{ id: 'e1', linkedPaliId: 'w1' }}
    paliWords={paliWords}
    activeIndices={{}}
    hovered={null}
    setHovered={vi.fn()}
    cycle={vi.fn()}
    ghostOpacity={0.3}
    showCycleDots={showCycleDots}
  />,
);

describe('EnglishWordEngine cycle dots', () => {
  it('shows one dot per alternative rendering by default', () => {
    renderWord();
    expect(screen.getByLabelText('2 alternative renderings')).toBeTruthy();
  });

  it('hides the dots when the reader turns the setting off', () => {
    renderWord(false);
    expect(screen.queryByLabelText('2 alternative renderings')).toBeNull();
    expect(screen.getByText('thus')).toBeTruthy();
  });
});

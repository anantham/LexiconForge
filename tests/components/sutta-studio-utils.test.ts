import { describe, it, expect } from 'vitest';
import {
  safeSlug,
  wordDomId,
  segDomId,
  segmentIdToDomId,
  targetDomId,
  buildPaliText,
  resolveSenseId,
  resolveSegmentTooltip,
  stripEmoji,
  stripGrammarTerms,
  formatDuration,
  resolvePhaseNumber,
  getWordColor,
} from '../../components/sutta-studio/utils';
import type { PaliWord, WordSegment } from '../../types/suttaStudio';

// ---------------------------------------------------------------------------
// DOM ID helpers
// ---------------------------------------------------------------------------

describe('DOM ID helpers', () => {
  it('wordDomId joins phaseId and wordId', () => {
    expect(wordDomId('ph1', 'w1')).toBe('ph1-w1');
  });

  it('segDomId includes segment index', () => {
    expect(segDomId('ph1', 'w1', 0)).toBe('ph1-w1-seg-0');
    expect(segDomId('ph1', 'w1', 3)).toBe('ph1-w1-seg-3');
  });

  it('segmentIdToDomId uses segment ID directly', () => {
    expect(segmentIdToDomId('ph1', 'p1s1')).toBe('ph1-seg-p1s1');
  });

  it('targetDomId prefixes with target', () => {
    expect(targetDomId('ph1', 'e0')).toBe('ph1-target-e0');
  });
});

// ---------------------------------------------------------------------------
// safeSlug
// ---------------------------------------------------------------------------

describe('safeSlug', () => {
  it('lowercases and replaces non-alphanumeric with hyphens', () => {
    expect(safeSlug('Hello World!')).toBe('hello-world');
  });

  it('trims leading/trailing hyphens', () => {
    expect(safeSlug('--foo--')).toBe('foo');
  });

  it('collapses consecutive non-alphanumeric chars', () => {
    expect(safeSlug('a   b___c')).toBe('a-b-c');
  });

  it('handles empty string', () => {
    expect(safeSlug('')).toBe('');
  });
});

// ---------------------------------------------------------------------------
// buildPaliText
// ---------------------------------------------------------------------------

describe('buildPaliText', () => {
  it('joins segment text fields', () => {
    const word = {
      id: 'w1',
      segments: [
        { id: 's1', text: 'sati', type: 'root' as const },
        { id: 's2', text: 'paṭṭhāna', type: 'root' as const },
      ],
      senses: [],
    } as unknown as PaliWord;
    expect(buildPaliText(word)).toBe('satipaṭṭhāna');
  });
});

// ---------------------------------------------------------------------------
// resolveSenseId
// ---------------------------------------------------------------------------

describe('resolveSenseId', () => {
  it('returns sense.id when present', () => {
    const word = {
      id: 'w1',
      segments: [],
      senses: [{ id: 'sense-custom', english: 'Mindfulness' }],
    } as unknown as PaliWord;
    expect(resolveSenseId(word, 0)).toBe('sense-custom');
  });

  it('generates fallback id from word id, index, and english', () => {
    const word = {
      id: 'w1',
      segments: [],
      senses: [{ english: 'Mindfulness' }],
    } as unknown as PaliWord;
    expect(resolveSenseId(word, 0)).toBe('w1-0-mindfulness');
  });
});

// ---------------------------------------------------------------------------
// resolveSegmentTooltip
// ---------------------------------------------------------------------------

describe('resolveSegmentTooltip', () => {
  it('prefers tooltipsBySense match', () => {
    const seg = {
      id: 's1',
      text: 'sati',
      type: 'root',
      tooltipsBySense: { 'sense-a': 'by-sense tooltip' },
      tooltip: 'fallback',
      tooltips: ['arr-0'],
    } as unknown as WordSegment;
    expect(resolveSegmentTooltip(seg, 'sense-a', 0)).toBe('by-sense tooltip');
  });

  it('falls back to tooltip field', () => {
    const seg = {
      id: 's1',
      text: 'sati',
      type: 'root',
      tooltip: 'single tooltip',
      tooltips: ['arr-0'],
    } as unknown as WordSegment;
    expect(resolveSegmentTooltip(seg, 'sense-x', 0)).toBe('single tooltip');
  });

  it('falls back to tooltips array at activeIndex', () => {
    const seg = {
      id: 's1',
      text: 'sati',
      type: 'root',
      tooltips: ['tip-0', 'tip-1', 'tip-2'],
    } as unknown as WordSegment;
    expect(resolveSegmentTooltip(seg, 'sense-x', 1)).toBe('tip-1');
  });

  it('falls back to tooltips[0] when activeIndex out of range', () => {
    const seg = {
      id: 's1',
      text: 'sati',
      type: 'root',
      tooltips: ['only-one'],
    } as unknown as WordSegment;
    expect(resolveSegmentTooltip(seg, 'sense-x', 5)).toBe('only-one');
  });

  it('returns empty string when no tooltips available', () => {
    const seg = { id: 's1', text: 'sati', type: 'root' } as unknown as WordSegment;
    expect(resolveSegmentTooltip(seg, 'sense-x', 0)).toBe('');
  });
});

// ---------------------------------------------------------------------------
// stripEmoji / stripGrammarTerms
// ---------------------------------------------------------------------------

describe('stripEmoji', () => {
  it('removes emoji characters', () => {
    expect(stripEmoji('hello 🌟 world')).toBe('hello  world');
  });

  it('leaves non-emoji text intact', () => {
    expect(stripEmoji('plain text')).toBe('plain text');
  });
});

describe('stripGrammarTerms', () => {
  it('removes [bracketed] terms', () => {
    expect(stripGrammarTerms('[nom.sg] mindfulness')).toBe('mindfulness');
  });

  it('removes multiple bracketed terms', () => {
    expect(stripGrammarTerms('[case:nom] [num:sg] word')).toBe('word');
  });

  it('leaves text without brackets intact', () => {
    expect(stripGrammarTerms('no brackets here')).toBe('no brackets here');
  });
});

// ---------------------------------------------------------------------------
// formatDuration
// ---------------------------------------------------------------------------

describe('formatDuration', () => {
  it('returns null for null/undefined', () => {
    expect(formatDuration(null)).toBeNull();
    expect(formatDuration(undefined)).toBeNull();
  });

  it('formats seconds only', () => {
    expect(formatDuration(5000)).toBe('5s');
  });

  it('formats minutes and seconds', () => {
    expect(formatDuration(125000)).toBe('2m 5s');
  });

  it('handles negative durations', () => {
    expect(formatDuration(-5000)).toBe('-5s');
  });

  it('handles zero', () => {
    expect(formatDuration(0)).toBe('0s');
  });
});

// ---------------------------------------------------------------------------
// resolvePhaseNumber
// ---------------------------------------------------------------------------

describe('resolvePhaseNumber', () => {
  it('returns null for zero/negative totalPhases', () => {
    expect(resolvePhaseNumber({ totalPhases: 0, readyPhases: 0 })).toBeNull();
    expect(resolvePhaseNumber({ totalPhases: -1, readyPhases: 0 })).toBeNull();
  });

  it('returns next building phase when state is building', () => {
    expect(resolvePhaseNumber({ totalPhases: 5, readyPhases: 2, state: 'building' })).toBe(3);
  });

  it('returns 1 when building with no ready phases', () => {
    expect(resolvePhaseNumber({ totalPhases: 5, readyPhases: 0, state: 'building' })).toBe(1);
  });

  it('returns readyPhases capped at totalPhases when not building', () => {
    expect(resolvePhaseNumber({ totalPhases: 5, readyPhases: 5 })).toBe(5);
    expect(resolvePhaseNumber({ totalPhases: 5, readyPhases: 10 })).toBe(5);
  });

  it('returns 1 when no ready phases and not building', () => {
    expect(resolvePhaseNumber({ totalPhases: 5, readyPhases: 0 })).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// getWordColor
// ---------------------------------------------------------------------------

describe('getWordColor', () => {
  it('returns emerald for content words', () => {
    expect(getWordColor('content')).toBe('text-emerald-400');
  });

  it('returns slate for function words', () => {
    expect(getWordColor('function')).toBe('text-slate-200');
  });

  it('returns yellow for vocative words', () => {
    expect(getWordColor('vocative')).toBe('text-yellow-400');
  });

  it('returns fallback color when provided', () => {
    expect(getWordColor(undefined, 'text-red-500')).toBe('text-red-500');
  });

  it('defaults to white when no wordClass or fallback', () => {
    expect(getWordColor()).toBe('text-white');
    expect(getWordColor(undefined)).toBe('text-white');
  });
});

/**
 * Test suite for multi-paragraph HTML tag balancing
 *
 * These tests verify that formatting tags (<i>, <b>) that span multiple
 * paragraphs are properly balanced so each paragraph has matching open/close tags.
 */

import { describe, it, expect } from 'vitest';

// Test helpers to simulate the tag balancing logic
const findOpenedTags = (html: string): string[] => {
  const opened: string[] = [];
  const openTagRegex = /<(i|b)>/g;
  let match: RegExpExecArray | null;

  while ((match = openTagRegex.exec(html)) !== null) {
    opened.push(match[1]);
  }

  return opened;
};

const findClosedTags = (html: string): string[] => {
  const closed: string[] = [];
  const closeTagRegex = /<\/(i|b)>/g;
  let match: RegExpExecArray | null;

  while ((match = closeTagRegex.exec(html)) !== null) {
    closed.push(match[1]);
  }

  return closed;
};

const balanceTagsAcrossSegments = (segments: Array<{ raw: string }>): Array<{ raw: string }> => {
  const openTags: string[] = [];

  return segments.map(segment => {
    const original = segment.raw;

    // Find what tags are opened and closed in the ORIGINAL segment text
    const originallyOpened = findOpenedTags(original);
    const originallyClosed = findClosedTags(original);

    // Start building the balanced segment
    let balanced = original;

    // Prepend any tags that were left open from previous paragraphs
    // Prepend in reverse order so outermost tags are added last
    for (let i = openTags.length - 1; i >= 0; i--) {
      balanced = `<${openTags[i]}>${balanced}`;
    }

    // Update the open tags stack based on the ORIGINAL segment
    for (const tag of originallyOpened) {
      openTags.push(tag);
    }

    for (const tag of originallyClosed) {
      const lastIndex = openTags.lastIndexOf(tag);
      if (lastIndex !== -1) {
        openTags.splice(lastIndex, 1);
      }
    }

    // Close any tags still open at end of this segment
    for (let i = openTags.length - 1; i >= 0; i--) {
      balanced = `${balanced}</${openTags[i]}>`;
    }

    return { raw: balanced };
  });
};

describe('Multi-paragraph HTML tag balancing', () => {
  it('should balance italic tags across 3 paragraphs', () => {
    const input = [
      { raw: '<i>First paragraph' },
      { raw: 'Middle paragraph' },
      { raw: 'Last paragraph</i>' }
    ];

    const result = balanceTagsAcrossSegments(input);

    expect(result[0].raw).toBe('<i>First paragraph</i>');
    expect(result[1].raw).toBe('<i>Middle paragraph</i>');
    expect(result[2].raw).toBe('<i>Last paragraph</i>');
  });

  it('should handle single paragraph with complete tags', () => {
    const input = [
      { raw: '<i>Complete paragraph</i>' }
    ];

    const result = balanceTagsAcrossSegments(input);

    expect(result[0].raw).toBe('<i>Complete paragraph</i>');
  });

  it('should handle bold tags across paragraphs', () => {
    const input = [
      { raw: '<b>Bold start' },
      { raw: 'Bold end</b>' }
    ];

    const result = balanceTagsAcrossSegments(input);

    expect(result[0].raw).toBe('<b>Bold start</b>');
    expect(result[1].raw).toBe('<b>Bold end</b>');
  });

  it('should handle nested tags across paragraphs', () => {
    const input = [
      { raw: '<i><b>Nested start' },
      { raw: 'Still nested</b></i>' }
    ];

    const result = balanceTagsAcrossSegments(input);

    expect(result[0].raw).toBe('<i><b>Nested start</b></i>');
    expect(result[1].raw).toBe('<i><b>Still nested</b></i>');
  });

  it('should handle paragraphs with no formatting', () => {
    const input = [
      { raw: 'Plain text paragraph 1' },
      { raw: 'Plain text paragraph 2' }
    ];

    const result = balanceTagsAcrossSegments(input);

    expect(result[0].raw).toBe('Plain text paragraph 1');
    expect(result[1].raw).toBe('Plain text paragraph 2');
  });

  it('should handle mixed formatted and plain paragraphs', () => {
    const input = [
      { raw: '<i>Italic start' },
      { raw: 'Still italic' },
      { raw: 'End italic</i>' },
      { raw: 'Plain paragraph' },
      { raw: '<b>Bold paragraph</b>' }
    ];

    const result = balanceTagsAcrossSegments(input);

    expect(result[0].raw).toBe('<i>Italic start</i>');
    expect(result[1].raw).toBe('<i>Still italic</i>');
    expect(result[2].raw).toBe('<i>End italic</i>');
    expect(result[3].raw).toBe('Plain paragraph');
    expect(result[4].raw).toBe('<b>Bold paragraph</b>');
  });

  it('should handle complex nesting with interleaved tags', () => {
    const input = [
      { raw: '<i>Italic' },
      { raw: '<b>Italic and bold' },
      { raw: 'Still both</b>' },
      { raw: 'Just italic</i>' }
    ];

    const result = balanceTagsAcrossSegments(input);

    expect(result[0].raw).toBe('<i>Italic</i>');
    expect(result[1].raw).toBe('<i><b>Italic and bold</b></i>');
    expect(result[2].raw).toBe('<i><b>Still both</b></i>');
    expect(result[3].raw).toBe('<i>Just italic</i>');
  });

  it('should handle real-world example from user', () => {
    const input = [
      { raw: '<i>In the seventy-second year of Great Song, a man appeared...' },
      { raw: 'In the eighty-fifth year of Great Song, in the bustling district...' },
      { raw: 'In the ninety-first year of Great Song, fifteen travelers disappeared...' },
      { raw: 'In the ninety-fifth year of Great Song, the proprietor of a music house...' },
      { raw: 'In the one hundred and sixteenth year of Great Song, a child\'s cry was heard...</i>' }
    ];

    const result = balanceTagsAcrossSegments(input);

    // All paragraphs should be italicized
    result.forEach(segment => {
      expect(segment.raw).toMatch(/^<i>.*<\/i>$/);
    });
  });
});

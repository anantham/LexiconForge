import { describe, expect, it } from 'vitest';
import { buildChapterDisplayLabel } from '../../hooks/useChapterDropdownOptions';

describe('buildChapterDisplayLabel', () => {
  it('does not prepend Ch N when the title already starts with the same chapter number', () => {
    expect(buildChapterDisplayLabel('Chapter 610: Great Horn Again!', 610)).toBe(
      'Chapter 610: Great Horn Again!'
    );
    expect(buildChapterDisplayLabel('Ch 610: Great Horn Again!', 610)).toBe(
      'Ch 610: Great Horn Again!'
    );
  });

  it('prepends Ch N when the title does not already start with that number', () => {
    expect(buildChapterDisplayLabel('Great Horn Again!', 610)).toBe(
      'Ch 610: Great Horn Again!'
    );
  });

  it('returns the title unchanged when there is no display number', () => {
    expect(buildChapterDisplayLabel('Great Horn Again!', null)).toBe('Great Horn Again!');
  });

  it('returns title unchanged for zero or negative display numbers', () => {
    expect(buildChapterDisplayLabel('Some Title', 0)).toBe('Some Title');
    expect(buildChapterDisplayLabel('Some Title', -1)).toBe('Some Title');
  });

  it('handles Chapter with period abbreviation', () => {
    expect(buildChapterDisplayLabel('Ch. 42: The Answer', 42)).toBe(
      'Ch. 42: The Answer'
    );
  });

  it('does not match a different chapter number in the title', () => {
    expect(buildChapterDisplayLabel('Chapter 5: The Beginning', 42)).toBe(
      'Ch 42: Chapter 5: The Beginning'
    );
  });
});

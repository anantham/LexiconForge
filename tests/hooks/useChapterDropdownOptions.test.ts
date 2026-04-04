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

  // Internally-duplicated title tests
  it('deduplicates "Chapter N: Name Chapter N: Name" pattern', () => {
    expect(buildChapterDisplayLabel('Chapter 304: Foggy Booth Chapter 304: Foggy Booth', 304)).toBe(
      'Chapter 304: Foggy Booth'
    );
  });

  it('deduplicates title with longer name', () => {
    expect(buildChapterDisplayLabel('Chapter 299: I Love You Chapter 299: I Love You', 299)).toBe(
      'Chapter 299: I Love You'
    );
  });

  it('does not deduplicate a title that is not actually doubled', () => {
    expect(buildChapterDisplayLabel('Chapter 305: Grand Entrance', 305)).toBe(
      'Chapter 305: Grand Entrance'
    );
  });

  it('deduplicates even without a chapter number prefix', () => {
    expect(buildChapterDisplayLabel('Foggy Booth Foggy Booth', 304)).toBe(
      'Ch 304: Foggy Booth'
    );
  });

  it('does not false-positive on repeated words within a title', () => {
    expect(buildChapterDisplayLabel('Chapter 306: Seafood Fried Rice and Egg Fried Rice', 306)).toBe(
      'Chapter 306: Seafood Fried Rice and Egg Fried Rice'
    );
  });
});

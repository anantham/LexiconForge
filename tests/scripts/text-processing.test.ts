// @vitest-environment node

import { describe, expect, it } from 'vitest';

import {
  decodeTextBuffer,
  splitTextIntoParagraphs,
} from '../../scripts/lib/text-processing';

describe('text-processing', () => {
  it('decodes gb18030 monolithic text correctly', () => {
    const gb18030Buffer = Buffer.from(
      'b5da31d5c220b7a8b1a6b7d8c4b90a0ab5dad2bbb6cea1a30a0ab5da32d5c220b9e2c4bbd2c70a0ab5dab6feb6cea1a30a',
      'hex'
    );

    const decoded = decodeTextBuffer(gb18030Buffer);

    expect(decoded.encoding).toBe('gb18030');
    expect(decoded.text).toContain('第1章 法宝坟墓');
    expect(decoded.text).toContain('第2章 光幕仪');
  });

  it('collapses wrapped PDF lines and normalizes ligatures', () => {
    const paragraphs = splitTextIntoParagraphs(
      'The Reﬁners\nare here.\n\nA three-\ndimensional array.',
      { collapseSoftWraps: true }
    );

    expect(paragraphs).toEqual([
      { text: 'The Refiners are here.' },
      { text: 'A three-dimensional array.' },
    ]);
  });
});

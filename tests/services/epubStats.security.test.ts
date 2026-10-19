import { describe, expect, it } from 'vitest';
import { calculateTranslationStats } from '../../services/epubService/data/stats';
import { generateStatsAndAcknowledgments } from '../../services/epubService/generators/statsPage';
import type { ChapterForEpub } from '../../services/epubService/types';

function chapter(label: string): ChapterForEpub {
  return {
    title: 'Synthetic chapter', content: '', originalUrl: 'https://example.com/1',
    translatedTitle: 'Synthetic chapter', images: [],
    usageMetrics: {
      provider: label, model: label, totalTokens: 5, promptTokens: 2,
      completionTokens: 3, estimatedCost: 0.01, requestTime: 1,
    },
  };
}

describe('EPUB imported metrics labels', () => {
  it('treats prototype-shaped labels as own data without changing global prototypes', () => {
    const prototypeBefore = Object.getOwnPropertyDescriptors(Object.prototype);
    const functionBefore = Object.getOwnPropertyDescriptors(Object);
    const labels = ['__proto__', 'constructor', 'prototype', 'toString', 'hasOwnProperty'];
    const stats = calculateTranslationStats(labels.flatMap(label => [chapter(label), chapter(label)]));
    expect(Object.getPrototypeOf(stats.providerBreakdown)).toBeNull();
    expect(Object.getPrototypeOf(stats.modelBreakdown)).toBeNull();
    expect(Object.keys(stats.providerBreakdown)).toEqual(labels);
    for (const label of labels) {
      expect(stats.providerBreakdown[label]).toEqual({ chapters: 2, cost: 0.02, time: 2, tokens: 10 });
      expect(stats.modelBreakdown[label]).toEqual(stats.providerBreakdown[label]);
    }
    expect(Object.getOwnPropertyDescriptors(Object.prototype)).toEqual(prototypeBefore);
    expect(Object.getOwnPropertyDescriptors(Object)).toEqual(functionBefore);
    const rendered = generateStatsAndAcknowledgments(stats, {});
    for (const label of labels) expect(rendered).toContain(label);
  });
});

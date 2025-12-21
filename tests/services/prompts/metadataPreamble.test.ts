import { describe, expect, it } from 'vitest';
import { buildMetadataPreamble, buildPreambleFromSettings } from '../../../services/prompts/metadataPreamble';

describe('metadataPreamble', () => {
  it('builds a preamble with glossary table and context', () => {
    const text = buildMetadataPreamble({
      projectName: 'Project X',
      sourceLanguage: 'Korean',
      targetLanguage: 'English',
      chapterTitle: 'Ch. 1',
      tags: ['fantasy', 'dark'],
      glossary: [
        { source: '호감도', target: 'Affection', note: 'game stat' },
        { source: '악명', target: 'Notoriety' },
      ],
      styleNotes: 'Preserve UI tone',
      footnotePolicy: 'Cultural terms only',
    });

    expect(text).toContain('Project: Project X');
    expect(text).toContain('Korean → English');
    expect(text).toContain('Ch. 1');
    expect(text).toContain('fantasy, dark');
    expect(text).toContain('| Source term | Translation | Notes |');
    expect(text).toContain('| 호감도 | Affection | game stat |');
    expect(text).toContain('| 악명 | Notoriety |  |');
    expect(text).toContain('Footnote policy: Cultural terms only');
  });

  it('handles missing glossary with fallback', () => {
    const text = buildMetadataPreamble({
      projectName: null,
      sourceLanguage: null,
      targetLanguage: null,
      glossary: [],
    });
    expect(text).toContain('Project: Unspecified');
    expect(text).toContain('Unknown → Unknown');
    expect(text).toContain('Glossary: none');
  });

  it('builds from settings when provided', () => {
    const text = buildPreambleFromSettings(
      {
        provider: 'Gemini',
        model: 'gpt',
        temperature: 0.7,
        contextDepth: 2,
        preloadCount: 0,
        fontSize: 16,
        fontStyle: 'serif',
        lineHeight: 1.6,
        systemPrompt: 'x',
        imageModel: 'none',
        showDiffHeatmap: false,
        maxSessionSize: 10,
        targetLanguage: 'English',
      } as any,
      {
        sourceLanguage: 'Korean',
        glossary: [{ source: '테스트', target: 'test' }],
      }
    );

    expect(text).toContain('Korean → English');
    expect(text).toContain('| 테스트 | test |');
  });
});

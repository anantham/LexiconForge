import { describe, it, expect } from 'vitest';
import { tokenizeTranslation } from '../../../components/chapter/translationTokens';

/**
 * Integrity-scan guard: the tokenizer's marker grammar must be the canonical
 * one (services/ai/illustrationMarkers). Its previous private copy had no
 * letter-suffix support, so a marker that passed validation ([ILLUSTRATION-2b])
 * fell through the token split and rendered as literal bracket text — a
 * validation-passing chapter shipping an unrenderable image.
 */
describe('tokenizeTranslation marker grammar', () => {
  it('tokenizes a letter-suffixed marker that validation accepts', () => {
    const { tokens } = tokenizeTranslation('Before [ILLUSTRATION-2b] after', 'ch1');
    const illustrations = tokens.filter((t) => t.type === 'illustration');
    expect(illustrations).toHaveLength(1);
    expect((illustrations[0] as { marker: string }).marker).toBe('ILLUSTRATION-2b');
  });

  it('still tokenizes plain numeric markers', () => {
    const { tokens } = tokenizeTranslation('X [ILLUSTRATION-1] y', 'ch1');
    expect(tokens.filter((t) => t.type === 'illustration')).toHaveLength(1);
  });
});

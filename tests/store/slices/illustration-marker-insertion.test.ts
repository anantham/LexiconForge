/**
 * Tests for illustration marker insertion in translations.
 *
 * The core issue: When users select text in the rendered HTML view,
 * they get plain text (e.g., "The knight raised his sword"), but the
 * translation stored in the database is HTML (e.g., "<p>The knight raised his sword</p>").
 *
 * The marker insertion must handle HTML-aware matching to insert markers correctly.
 */

import { describe, it, expect } from 'vitest';

/**
 * Re-implementation of the marker insertion logic for testing.
 * This mirrors the logic in translationsSlice.ts generateIllustrationForSelection
 */
function insertMarkerIntoHtml(translation: string, selection: string, marker: string): string {
  const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Create pattern that allows optional HTML tags between any characters
  const selectionChars = selection.split('');
  const htmlTagPattern = '(?:<[^>]*>)*';
  const regexPattern = selectionChars
    .map((char, i) => {
      const escaped = escapeRegex(char);
      return i < selectionChars.length - 1 ? escaped + htmlTagPattern : escaped;
    })
    .join('');

  try {
    const regex = new RegExp(`(${regexPattern})`, 'i');
    const match = translation.match(regex);

    if (match && match.index !== undefined) {
      const matchEnd = match.index + match[0].length;
      return (
        translation.slice(0, matchEnd) +
        ` ${marker}` +
        translation.slice(matchEnd)
      );
    }

    // Fallback: simple replace
    const simpleUpdated = translation.replace(selection, `${selection} ${marker}`);
    if (simpleUpdated !== translation) {
      return simpleUpdated;
    }

    // Neither approach worked
    return translation;
  } catch {
    // Regex error fallback
    return translation.replace(selection, `${selection} ${marker}`);
  }
}

describe('Illustration Marker Insertion', () => {
  const marker = '[ILLUSTRATION-1]';

  describe('Plain text matching (no HTML)', () => {
    it('should insert marker after exact match in plain text', () => {
      const translation = 'The knight raised his sword.';
      const selection = 'raised his sword';

      const result = insertMarkerIntoHtml(translation, selection, marker);

      expect(result).toBe('The knight raised his sword [ILLUSTRATION-1].');
    });

    it('should insert marker at end of sentence', () => {
      const translation = 'The battle was fierce.';
      const selection = 'The battle was fierce.';

      const result = insertMarkerIntoHtml(translation, selection, marker);

      expect(result).toBe('The battle was fierce. [ILLUSTRATION-1]');
    });

    it('should handle selection at the beginning', () => {
      const translation = 'Warriors clashed in the dawn.';
      const selection = 'Warriors clashed';

      const result = insertMarkerIntoHtml(translation, selection, marker);

      expect(result).toBe('Warriors clashed [ILLUSTRATION-1] in the dawn.');
    });
  });

  describe('HTML-wrapped content', () => {
    it('should insert marker when text is inside paragraph tags', () => {
      const translation = '<p>The knight raised his sword.</p>';
      const selection = 'raised his sword';

      const result = insertMarkerIntoHtml(translation, selection, marker);

      expect(result).toBe('<p>The knight raised his sword [ILLUSTRATION-1].</p>');
    });

    it('should insert marker when text spans multiple paragraphs selection', () => {
      const translation = '<p>First paragraph.</p><p>Second paragraph with the scene.</p>';
      const selection = 'the scene';

      const result = insertMarkerIntoHtml(translation, selection, marker);

      expect(result).toContain('the scene [ILLUSTRATION-1]');
    });

    it('should handle nested div and p tags', () => {
      const translation = '<div><p>The warrior stood tall.</p></div>';
      const selection = 'stood tall';

      const result = insertMarkerIntoHtml(translation, selection, marker);

      expect(result).toBe('<div><p>The warrior stood tall [ILLUSTRATION-1].</p></div>');
    });
  });

  describe('Inline HTML tags within selection', () => {
    it('should match when selection text contains <em> tags', () => {
      const translation = '<p>The <em>knight</em> raised his sword.</p>';
      const selection = 'The knight raised';

      const result = insertMarkerIntoHtml(translation, selection, marker);

      expect(result).toContain('[ILLUSTRATION-1]');
      // The marker should be inserted after "raised"
      expect(result).toBe('<p>The <em>knight</em> raised [ILLUSTRATION-1] his sword.</p>');
    });

    it('should match when selection text contains <strong> tags', () => {
      const translation = '<p>A <strong>fierce</strong> battle ensued.</p>';
      const selection = 'A fierce battle';

      const result = insertMarkerIntoHtml(translation, selection, marker);

      expect(result).toContain('[ILLUSTRATION-1]');
    });

    it('should match when selection text contains <span> with class', () => {
      const translation = '<p>The <span class="highlight">ancient</span> sword gleamed.</p>';
      const selection = 'The ancient sword';

      const result = insertMarkerIntoHtml(translation, selection, marker);

      expect(result).toContain('[ILLUSTRATION-1]');
    });

    it('should handle multiple inline tags within selection', () => {
      const translation = '<p>The <em>brave</em> and <strong>noble</strong> knight.</p>';
      const selection = 'brave and noble knight';

      const result = insertMarkerIntoHtml(translation, selection, marker);

      expect(result).toContain('[ILLUSTRATION-1]');
    });
  });

  describe('Special characters in selection', () => {
    it('should handle regex special characters in selection', () => {
      const translation = '<p>The cost was $100 (or more).</p>';
      const selection = '$100 (or more)';

      const result = insertMarkerIntoHtml(translation, selection, marker);

      expect(result).toContain('[ILLUSTRATION-1]');
    });

    it('should handle brackets in selection', () => {
      const translation = '<p>See [Chapter 1] for details.</p>';
      const selection = '[Chapter 1]';

      const result = insertMarkerIntoHtml(translation, selection, marker);

      expect(result).toContain('[ILLUSTRATION-1]');
    });

    it('should handle asterisks in selection', () => {
      const translation = '<p>*Note* this important point.</p>';
      const selection = '*Note*';

      const result = insertMarkerIntoHtml(translation, selection, marker);

      expect(result).toContain('[ILLUSTRATION-1]');
    });
  });

  describe('Edge cases', () => {
    it('should not insert marker if selection is not found', () => {
      const translation = '<p>Completely different text.</p>';
      const selection = 'nonexistent text';

      const result = insertMarkerIntoHtml(translation, selection, marker);

      expect(result).toBe(translation); // Unchanged
      expect(result).not.toContain('[ILLUSTRATION-1]');
    });

    it('should handle empty selection gracefully', () => {
      const translation = '<p>Some text here.</p>';
      const selection = '';

      const result = insertMarkerIntoHtml(translation, selection, marker);

      // Empty selection matches at position 0
      expect(result).toContain('[ILLUSTRATION-1]');
    });

    it('should handle case-insensitive matching', () => {
      const translation = '<p>THE WARRIOR STOOD TALL.</p>';
      const selection = 'the warrior';

      const result = insertMarkerIntoHtml(translation, selection, marker);

      expect(result).toContain('[ILLUSTRATION-1]');
    });

    it('should handle <br> tags within selection area', () => {
      const translation = '<p>Line one.<br>Line two continues.</p>';
      const selection = 'Line one.';

      const result = insertMarkerIntoHtml(translation, selection, marker);

      expect(result).toContain('Line one. [ILLUSTRATION-1]');
    });

    it('should handle self-closing tags', () => {
      const translation = '<p>Before<br/>after the break.</p>';
      const selection = 'Before';

      const result = insertMarkerIntoHtml(translation, selection, marker);

      expect(result).toContain('Before [ILLUSTRATION-1]');
    });
  });

  describe('Multiple marker insertions', () => {
    it('should insert different markers for different selections', () => {
      let translation = '<p>First scene here. Second scene there.</p>';

      const result1 = insertMarkerIntoHtml(translation, 'First scene', '[ILLUSTRATION-1]');
      expect(result1).toContain('First scene [ILLUSTRATION-1]');

      const result2 = insertMarkerIntoHtml(result1, 'Second scene', '[ILLUSTRATION-2]');
      expect(result2).toContain('First scene [ILLUSTRATION-1]');
      expect(result2).toContain('Second scene [ILLUSTRATION-2]');
    });
  });

  describe('Real-world translation HTML patterns', () => {
    it('should handle typical novel translation HTML', () => {
      const translation = `<p>「そうか……」</p>
<p>The emperor nodded slowly, his eyes fixed on the young knight before him.</p>
<p>"You have proven yourself worthy," he declared.</p>`;
      const selection = 'The emperor nodded slowly';

      const result = insertMarkerIntoHtml(translation, selection, marker);

      expect(result).toContain('The emperor nodded slowly [ILLUSTRATION-1]');
    });

    it('should handle italicized dialogue tags', () => {
      const translation = '<p>"I understand," she whispered, <i>her voice trembling</i>.</p>';
      const selection = 'her voice trembling';

      const result = insertMarkerIntoHtml(translation, selection, marker);

      expect(result).toContain('[ILLUSTRATION-1]');
    });
  });
});

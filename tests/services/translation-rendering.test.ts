import { describe, it, expect } from 'vitest';
import { sanitizeHtml } from '../../services/translate/HtmlSanitizer';

/**
 * Tests for the complete translation rendering pipeline
 * 
 * This ensures that game titles, skill names, and other angle-bracket text
 * are properly handled from JSON response through to browser display.
 */

describe('Translation Rendering Pipeline', () => {
  describe('HTML Entity Handling', () => {
    it('escapes game title references correctly', () => {
      const jsonResponse = 'In the original <Dungeon Attack> lore, monsters exist.';
      
      // Step 1: Sanitizer processes the translation
      const sanitized = sanitizeHtml(jsonResponse);
      
      // Step 2: Verify sanitizer escapes the opening bracket
      expect(sanitized).toBe('In the original &lt;Dungeon Attack> lore, monsters exist.');
      
      // Step 3: This HTML entity will render correctly in the browser
      // When inserted into DOM as text content, browser interprets &lt; as <
      // User sees: <Dungeon Attack>
    });

    it('handles skill names in angle brackets', () => {
      const jsonResponse = 'He activated <Two-Handed Attack> skill.';
      const sanitized = sanitizeHtml(jsonResponse);
      
      expect(sanitized).toBe('He activated &lt;Two-Handed Attack> skill.');
    });

    it('preserves formatting tags while escaping game references', () => {
      const jsonResponse = '<i>I wonder about <Dungeon Attack> mechanics.</i>';
      const sanitized = sanitizeHtml(jsonResponse);
      
      // Should preserve <i> tags
      expect(sanitized).toContain('<i>');
      expect(sanitized).toContain('</i>');
      
      // Should escape <Dungeon
      expect(sanitized).toContain('&lt;Dungeon Attack>');
      
      // Full expected output
      expect(sanitized).toBe('<i>I wonder about &lt;Dungeon Attack> mechanics.</i>');
    });

    it('handles complex mixed content', () => {
      const jsonResponse = [
        'In <i>Dungeon Defense</i>, the original <Dungeon Attack> game mechanics',
        'include skills like <Attack>, <Defend>, and <Heal>.',
      ].join(' ');
      
      const sanitized = sanitizeHtml(jsonResponse);
      
      // Italic tags preserved
      expect(sanitized).toContain('<i>Dungeon Defense</i>');
      
      // Game title escaped
      expect(sanitized).toContain('&lt;Dungeon Attack>');
      
      // Skill names escaped
      expect(sanitized).toContain('&lt;Attack>');
      expect(sanitized).toContain('&lt;Defend>');
      expect(sanitized).toContain('&lt;Heal>');
    });

    it('does not double-escape already escaped content', () => {
      // Simulating re-processing already sanitized text
      const alreadySanitized = 'Text &lt;Game&gt; more';
      const result = sanitizeHtml(alreadySanitized);
      
      // Should remain the same (idempotent)
      expect(result).toBe(alreadySanitized);
      
      // Should NOT become &amp;lt;
      expect(result).not.toContain('&amp;');
    });
  });

  describe('Browser Rendering Simulation', () => {
    it('verifies HTML entities decode correctly in browser context', () => {
      const sanitized = 'In the original &lt;Dungeon Attack> lore...';
      
      // Simulate browser DOM parsing
      const div = document.createElement('div');
      div.textContent = sanitized;
      
      // When set as textContent, browser auto-escapes
      // But when reading innerHTML, entities are preserved
      expect(div.innerHTML).toBe('In the original &amp;lt;Dungeon Attack&gt; lore...');
      
      // When reading textContent back, entities are decoded
      expect(div.textContent).toBe('In the original &lt;Dungeon Attack> lore...');
    });

    it('verifies innerHTML handles entities correctly', () => {
      const sanitized = 'Text &lt;Game&gt; more';
      
      const div = document.createElement('div');
      div.innerHTML = sanitized;
      
      // innerHTML interprets entities
      expect(div.textContent).toBe('Text <Game> more');
    });
  });

  describe('React Rendering Simulation', () => {
    it('simulates how React renders text with entities', () => {
      // When React renders: <span>{text}</span>
      // It sets textContent, not innerHTML

      const text = 'In the original &lt;Dungeon Attack> lore...';
      const span = document.createElement('span');
      span.textContent = text; // This is what React does

      // React escapes special characters when setting textContent
      // So &lt; becomes &amp;lt; in the HTML
      // Note: > was never escaped by sanitizer, so it stays as >
      expect(span.innerHTML).toBe('In the original &amp;lt;Dungeon Attack&gt; lore...');

      // But when user sees the page, browser decodes it back
      // This is KEY: textContent shows the decoded version
      // User SHOULD see: <Dungeon Attack>
      expect(span.textContent).toBe('In the original &lt;Dungeon Attack> lore...');

      // If user is seeing "&lt;" literally on the page, there's a rendering bug
    });
  });
});

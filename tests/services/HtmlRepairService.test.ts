import { describe, it, expect, vi } from 'vitest';
import { HtmlRepairService } from '../../services/translate/HtmlRepairService';

const repair = (input: string) => HtmlRepairService.repair(input, { enabled: true, verbose: false }).html;

describe('HtmlRepairService.repair', () => {
  it('lowercases capital italic tags (formatting issue #1)', () => {
    const input = 'loud <I>thump</I>, as if struck by an earthquake.';
    const output = repair(input);
    expect(output).toContain('<i>thump</i>');
    expect(output).not.toContain('<I>');
  });

  it('normalizes and deduplicates hr tags (formatting issue #2)', () => {
    const input = '<hr /><hr /><hr><hr />';
    const output = repair(input);
    // Should normalize variants AND remove duplicates
    expect(output).toBe('<hr>');
  });

  it('wraps bare illustration markers in brackets (formatting issue #3)', () => {
    const input = "ILLUSTRATION-1\nScene continues.";
    const output = repair(input);
    expect(output).toContain('[ILLUSTRATION-1]');
  });

  it('converts triple dashes to scene break hr (formatting issue #3 sample)', () => {
    const input = `---\nThe man wore a pitying expression.`;
    const output = repair(input);
    expect(output.startsWith('<hr>')).toBe(true);
  });

  it('fixes short dangling closing italics with length constraint', () => {
    // We now fix short dangling closers (<50 chars) safely
    // This balances fixing legitimate errors without creating large italic chunks
    const input = '</i>Status!</i> The crowd gasped.';
    const output = repair(input);
    // Should now be fixed since it's short
    expect(output).toContain('<i>Status!</i>');
  });

  it('does not break properly formed italic tags after closing tag', () => {
    const input = "emotion was transmitted to me.<br><br>'<i>Hm? What's this?</i>'<br>";
    const output = repair(input);
    expect(output).toContain("'<i>Hm? What's this?</i>'");
    expect(output).not.toContain("'</i>Hm?");
  });

  it('does not break consecutive italic sections', () => {
    const input = "He thought: <i>This is strange.</i> Then: '<i>Or is it?</i>' He wondered.";
    const output = repair(input);
    expect(output).toContain("<i>This is strange.</i>");
    expect(output).toContain("'<i>Or is it?</i>'");
  });

  it('fixes short dangling closing tags (formatting issue #8)', () => {
    const input = "A </i>'Ding!'</i> rang out, and the door opened.";
    const output = repair(input);
    expect(output).toContain("<i>'Ding!'</i>");
    expect(output).not.toContain("</i>'Ding!'</i>");
  });

  it('only fixes dangling closers for short content (<50 chars)', () => {
    // Short content - should be fixed
    const shortInput = "</i>Status!</i> The crowd gasped.";
    const shortOutput = repair(shortInput);
    expect(shortOutput).toContain("<i>Status!</i>");

    // Long content - should NOT be fixed to avoid creating large italic chunks
    const longInput = "</i>This is a very long piece of text that goes on and on for more than fifty characters and should not be converted to italics</i>";
    const longOutput = repair(longInput);
    expect(longOutput).toBe(longInput); // Should be unchanged
  });

  it('fixes dangling closers for multiple tag types', () => {
    const input = "He said </b>boldly</b> and </em>emphasized</em> the point.";
    const output = repair(input);
    expect(output).toContain("<b>boldly</b>");
    expect(output).toContain("<em>emphasized</em>");
  });

  it('adds spacing around hr tags touching text on both sides', () => {
    const input = '"…Haa." Somehow Laura sighed.<hr>The battle ended in defeat.';
    const output = repair(input);
    // Should add <br><br> before and after the <hr>
    expect(output).toContain('sighed.<br><br><hr><br><br>The battle');
  });

  it('adds spacing around hr tag touching text at start', () => {
    const input = 'beyond my comprehension.<hr>The work of Laura';
    const output = repair(input);
    expect(output).toContain('comprehension.<br><br><hr>');
    // Should have spacing after the period
  });

  it('adds spacing around hr tag touching text at end', () => {
    const input = 'Laura sighed.<hr>Now the only potential';
    const output = repair(input);
    expect(output).toContain('.<br><br><hr><br><br>Now');
  });

  it('handles hr tags with surrounding whitespace gracefully', () => {
    const input = 'Text before.  <hr>  Text after.';
    const output = repair(input);
    // Should still add spacing even if there's already some whitespace
    expect(output).toContain('<hr>');
  });

  it('normalizes hr variants and adds spacing in one pass', () => {
    const input = 'Laura sighed.<hr />The battle ended.';
    const output = repair(input);
    // First normalizes <hr /> to <hr>, then adds spacing
    expect(output).toContain('sighed.<br><br><hr><br><br>The battle');
  });
});


/**
 * Behavior coverage added 2026-08-23 (CI PR-2): earns the 75% per-file floor
 * by exercising public API paths that had zero coverage — disabled rules,
 * verbose logging, validate/preview/rules-list helpers, hr edge spacing, and
 * entity decoding. Note: decode-html-entities' comment says "DISABLED BY
 * DEFAULT" but it runs like every rule; tests pin ACTUAL behavior until that
 * discrepancy is adjudicated.
 */
describe('HtmlRepairService — API surface behavior', () => {
  it('skips rules listed in disabledRules', () => {
    const input = 'text<hr>more';
    const enabled = HtmlRepairService.repair(input);
    expect(enabled.stats.applied.join(' ')).toContain('hr');
    const disabled = HtmlRepairService.repairWithDisabledRules(input, ['space-hr-edges', 'space-hr-tags', 'normalize-hr', 'dedupe-hr-tags']);
    expect(disabled.stats.applied.join(' ')).not.toMatch(/\bhr\b/i);
    expect(disabled.html).toBe(input);
  });

  it('verbose mode logs applied repairs', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      const { stats } = HtmlRepairService.repair('text<hr>more', { enabled: true, verbose: true });
      expect(stats.applied.length).toBeGreaterThan(0);
      expect(logSpy).toHaveBeenCalled();
    } finally {
      logSpy.mockRestore();
    }
  });

  it('validate reports repairs without returning html', () => {
    const stats = HtmlRepairService.validate('<hr>');
    expect(stats.applied.length).toBeGreaterThan(0);
  });

  it('getRepairPreview reports clean and dirty HTML distinctly', () => {
    expect(HtmlRepairService.getRepairPreview('<p>clean</p>')).toContain('No issues found');
    expect(HtmlRepairService.getRepairPreview('<p>a</p><hr><p>b</p>')).toContain('Repairs that will be applied');
  });

  it('getAvailableRules returns the expected rule names', () => {
    const names = HtmlRepairService.getAvailableRules().map(r => r.name);
    for (const expected of ['space-hr-tags', 'space-hr-edges', 'fix-short-dangling-closers', 'decode-html-entities']) {
      expect(names).toContain(expected);
    }
  });

  it('adds spacing when <hr> sits at a line edge (before branch)', () => {
    expect(repair('end of text<hr>')).toContain('end of text<br><br><hr>');
  });

  it('adds spacing when <hr> precedes text (after branch)', () => {
    expect(repair('<hr>Start of text')).toContain('<hr><br><br>Start of text');
  });

  it('decodes HTML entities and records the count', () => {
    const { html, stats } = HtmlRepairService.repair('&lt;b&gt;bold&lt;/b&gt; &amp; more');
    expect(html).toContain('<b>bold</b> & more');
    expect(stats.applied.some(a => a.includes('HTML entities'))).toBe(true);
  });

  it('decoding is skippable via disabledRules', () => {
    const out = HtmlRepairService.repairWithDisabledRules('&lt;i&gt;x&lt;/i&gt;', ['decode-html-entities']);
    expect(out.html).toContain('&lt;');
  });
});

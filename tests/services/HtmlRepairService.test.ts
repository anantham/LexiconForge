import { describe, it, expect } from 'vitest';
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
});

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

  it('normalizes hr variants (formatting issue #2)', () => {
    const input = '<hr /><hr /><hr><hr />';
    const output = repair(input);
    expect(output).toBe('<hr><hr><hr><hr>');
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

  it('fixes dangling closing italics (formatting issue #5)', () => {
    const input = '</i>Status!</i> The crowd gasped.';
    const output = repair(input);
    expect(output.startsWith('<i>Status!</i>')).toBe(true);
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
});

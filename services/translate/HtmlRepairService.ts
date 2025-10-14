/**
 * HtmlRepairService - Gracefully repairs common HTML formatting mistakes from AI models
 *
 * Instead of trying to force models to follow strict rules through prompts,
 * this service adaptively fixes common mistakes in a forgiving way.
 *
 * Philosophy: Be liberal in what you accept, strict in what you output.
 */

export interface RepairStats {
  applied: string[];      // List of repairs that were applied
  warnings: string[];     // Non-critical issues found
}

export interface RepairOptions {
  enabled: boolean;
  verbose?: boolean;      // Log each repair
}

export class HtmlRepairService {

  /**
   * Main repair function - applies all repair rules to HTML content
   */
  static repair(html: string, options: RepairOptions = { enabled: true }): { html: string; stats: RepairStats } {
    if (!options.enabled) {
      return { html, stats: { applied: [], warnings: [] } };
    }

    const stats: RepairStats = { applied: [], warnings: [] };
    let repairedHtml = html;

    // Apply each repair rule in sequence
    const repairs = [
      this.repairCapitalItalicTags,
      this.repairSelfClosingHr,
      this.repairIllustrationMarkers,
      this.repairTripleDashes,
      this.repairNestedSameTags,      // Fix nested tags BEFORE unclosed tags
      this.repairDanglingClosingTags,
      this.repairUnclosedTags,
      this.repairExtraSpacesInTags,
      this.repairBoldWithAsterisks,
      this.repairMultipleBrTags,
    ];

    for (const repairFn of repairs) {
      const result = repairFn.call(this, repairedHtml, stats, options);
      repairedHtml = result;
    }

    if (options.verbose && stats.applied.length > 0) {
      console.log('[HtmlRepair] Applied repairs:', stats.applied);
    }

    return { html: repairedHtml, stats };
  }

  /**
   * Issue #1: Capital <I> tags instead of lowercase <i>
   * Example: <I>text</I> → <i>text</i>
   */
  private static repairCapitalItalicTags(html: string, stats: RepairStats, options: RepairOptions): string {
    const pattern = /<I>(.*?)<\/I>/gi;
    const matches = html.match(pattern);

    if (matches && matches.length > 0) {
      stats.applied.push(`Fixed ${matches.length} capital <I> tags to lowercase <i>`);
      return html.replace(pattern, '<i>$1</i>');
    }

    return html;
  }

  /**
   * Issue #2: Self-closing <hr /> instead of just <hr>
   * Also handles extra spaces: <hr />, <hr/>, < hr >
   */
  private static repairSelfClosingHr(html: string, stats: RepairStats, options: RepairOptions): string {
    const patterns = [
      /<hr\s*\/>/gi,      // <hr />, <hr/>
      /<\s*hr\s*>/gi,     // < hr >
    ];

    let repaired = html;
    let count = 0;

    for (const pattern of patterns) {
      const matches = repaired.match(pattern);
      if (matches) {
        count += matches.length;
        repaired = repaired.replace(pattern, '<hr>');
      }
    }

    if (count > 0) {
      stats.applied.push(`Normalized ${count} <hr> tags`);
    }

    return repaired;
  }

  /**
   * Issue #3: Illustration markers without brackets
   * Example: ILLUSTRATION-1 → [ILLUSTRATION-1]
   * Also handles: illustration-1, Illustration-1
   */
  private static repairIllustrationMarkers(html: string, stats: RepairStats, options: RepairOptions): string {
    // Match ILLUSTRATION-N not already in brackets
    const pattern = /(?<!\[)(ILLUSTRATION-\d+)(?!\])/gi;
    const matches = html.match(pattern);

    if (matches && matches.length > 0) {
      stats.applied.push(`Wrapped ${matches.length} illustration markers in brackets`);
      return html.replace(pattern, '[$1]');
    }

    return html;
  }

  /**
   * Issue #4: Triple/multiple dashes for scene breaks
   * Example: --- → <hr> or *** → <hr>
   * Only converts when dashes/asterisks are on their own line
   */
  private static repairTripleDashes(html: string, stats: RepairStats, options: RepairOptions): string {
    // Match 3+ dashes or asterisks on their own line (with optional whitespace)
    const pattern = /^\s*([-*]{3,})\s*$/gm;
    const matches = html.match(pattern);

    if (matches && matches.length > 0) {
      stats.applied.push(`Converted ${matches.length} dash/asterisk separators to <hr>`);
      return html.replace(pattern, '<hr>');
    }

    return html;
  }

  /**
   * Issue #5: Unclosed or mismatched tags
   * Example: <i>text<i> → <i>text</i>
   *
   * IMPORTANT: Only match if there's NO closing tag in between.
   * This prevents matching across properly closed tags like:
   * <i>word</i> more '<i>other</i>' → should NOT match
   */
  private static repairUnclosedTags(html: string, stats: RepairStats, options: RepairOptions): string {
    let repaired = html;
    let fixCount = 0;

    // Fix <i>text<i> where text doesn't contain </i>
    // Use negative lookahead to prevent matching across closed tags
    const iPattern = /<i>((?:(?!<\/?i>).)*?)<i>/gi;
    const iMatches = repaired.match(iPattern);
    if (iMatches) {
      fixCount += iMatches.length;
      repaired = repaired.replace(iPattern, '<i>$1</i>');
    }

    // Fix <b>text<b> where text doesn't contain </b>
    const bPattern = /<b>((?:(?!<\/?b>).)*?)<b>/gi;
    const bMatches = repaired.match(bPattern);
    if (bMatches) {
      fixCount += bMatches.length;
      repaired = repaired.replace(bPattern, '<b>$1</b>');
    }

    if (fixCount > 0) {
      stats.applied.push(`Fixed ${fixCount} unclosed/mismatched tags`);
    }

    return repaired;
  }

  /**
   * Issue #6: Nested same tags (redundant)
   * Example: <i><i>text</i></i> → <i>text</i>
   */
  private static repairNestedSameTags(html: string, stats: RepairStats, options: RepairOptions): string {
    let repaired = html;
    let fixCount = 0;

    // Remove nested <i><i>...</i></i>
    const iPattern = /<i>\s*<i>(.*?)<\/i>\s*<\/i>/gi;
    const iMatches = repaired.match(iPattern);
    if (iMatches) {
      fixCount += iMatches.length;
      repaired = repaired.replace(iPattern, '<i>$1</i>');
    }

    // Remove nested <b><b>...</b></b>
    const bPattern = /<b>\s*<b>(.*?)<\/b>\s*<\/b>/gi;
    const bMatches = repaired.match(bPattern);
    if (bMatches) {
      fixCount += bMatches.length;
      repaired = repaired.replace(bPattern, '<b>$1</b>');
    }

    if (fixCount > 0) {
      stats.applied.push(`Removed ${fixCount} redundant nested tags`);
    }

    return repaired;
  }

  /**
   * Issue #6b: Dangling closing tags preceding text
   * Example: </i>Text</i> → <i>Text</i>
   *
   * SIMPLIFIED APPROACH: The pattern already ensures content has no angle brackets,
   * so it's safe to repair all matches. The conservative lookahead was too restrictive.
   */
  private static repairDanglingClosingTags(html: string, stats: RepairStats, options: RepairOptions): string {
    // Match </TAG> content </TAG> where content has NO angle brackets at all
    // The [^<]+ ensures we don't match across legitimate tags
    const pattern = /<\/\s*(i|b|em|strong)\s*>\s*([^<]+?)\s*<\/\s*\1\s*>/gi;

    let repaired = html;
    const matches = html.match(pattern);

    if (matches && matches.length > 0) {
      stats.applied.push(`Fixed ${matches.length} dangling closing tags`);
      // Replace all matches: </i>content</i> → <i>content</i>
      repaired = html.replace(pattern, (_match, tag, content) => `<${tag}>${content.trim()}</${tag}>`);
    }

    return repaired;
  }

  /**
   * Issue #7: Extra spaces inside tags
   * Example: < i >text< /i > → <i>text</i>
   */
  private static repairExtraSpacesInTags(html: string, stats: RepairStats, options: RepairOptions): string {
    let repaired = html;
    let fixCount = 0;

    // Fix spaces in opening tags: < i > → <i>
    const openPattern = /<\s+([ibu])\s+>/gi;
    const openMatches = repaired.match(openPattern);
    if (openMatches) {
      fixCount += openMatches.length;
      repaired = repaired.replace(openPattern, '<$1>');
    }

    // Fix spaces in closing tags: < /i > → </i>
    const closePattern = /<\s*\/\s*([ibu])\s*>/gi;
    const closeMatches = repaired.match(closePattern);
    if (closeMatches) {
      fixCount += closeMatches.length;
      repaired = repaired.replace(closePattern, '</$1>');
    }

    if (fixCount > 0) {
      stats.applied.push(`Removed spaces from ${fixCount} tags`);
    }

    return repaired;
  }

  /**
   * Issue #8: Bold text using **text** instead of <b>text</b>
   * Only converts if not already inside HTML tags
   */
  private static repairBoldWithAsterisks(html: string, stats: RepairStats, options: RepairOptions): string {
    // Match **text** but not if inside existing tags
    // Negative lookbehind for < and positive lookahead for >
    const pattern = /(?<!<[^>]*)\*\*([^*]+?)\*\*(?![^<]*>)/g;
    const matches = html.match(pattern);

    if (matches && matches.length > 0) {
      stats.applied.push(`Converted ${matches.length} **bold** to <b>bold</b>`);
      return html.replace(pattern, '<b>$1</b>');
    }

    return html;
  }

  /**
   * Issue #9: Multiple consecutive <br> tags with varying formats
   * Example: <br><br><br> → <br><br> (max 2 for paragraph breaks)
   */
  private static repairMultipleBrTags(html: string, stats: RepairStats, options: RepairOptions): string {
    // Normalize all br variations first: <br/>, <br />, <BR> → <br>
    let repaired = html.replace(/<br\s*\/?>/gi, '<br>');

    // Replace 3+ consecutive <br> with just 2
    const pattern = /(<br>\s*){3,}/gi;
    const matches = repaired.match(pattern);

    if (matches && matches.length > 0) {
      stats.applied.push(`Normalized ${matches.length} excessive <br> sequences to <br><br>`);
      repaired = repaired.replace(pattern, '<br><br>');
    }

    return repaired;
  }

  /**
   * Validate and report issues without fixing them
   * Useful for debugging or understanding what would be fixed
   */
  static validate(html: string): RepairStats {
    const { stats } = this.repair(html, { enabled: true, verbose: false });
    return stats;
  }

  /**
   * Get a summary report of repairs that would be applied
   */
  static getRepairPreview(html: string): string {
    const stats = this.validate(html);

    if (stats.applied.length === 0 && stats.warnings.length === 0) {
      return 'No issues found - HTML is clean!';
    }

    let report = '';

    if (stats.applied.length > 0) {
      report += '✓ Repairs that will be applied:\n';
      stats.applied.forEach(item => {
        report += `  - ${item}\n`;
      });
    }

    if (stats.warnings.length > 0) {
      report += '\n⚠ Warnings:\n';
      stats.warnings.forEach(item => {
        report += `  - ${item}\n`;
      });
    }

    return report;
  }
}

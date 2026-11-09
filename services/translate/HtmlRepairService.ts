/**
 * Repairs model-generated HTML with individually selectable pattern rules.
 * Keep repairs bounded to avoid changing intentional formatting or source text.
 */

import { ILLUSTRATION_MARKER_INNER } from '../ai/illustrationMarkers';

export interface RepairStats {
  applied: string[];      // List of repairs that were applied
  warnings: string[];     // Non-critical issues found
}

export interface RepairOptions {
  enabled: boolean;
  verbose?: boolean;      // Log each repair
  disabledRules?: string[]; // Rules to skip by name
}

/**
 * Simple pattern-based repair rule
 */
interface SimpleRule {
  name: string;
  description: string;
  pattern: RegExp;
  replacement: string | ((match: string, ...groups: any[]) => string);
  test?: (html: string) => boolean; // Optional pre-check to skip rule
}

/**
 * Complex repair function for cases that need custom logic
 */
interface ComplexRule {
  name: string;
  description: string;
  apply: (html: string, stats: RepairStats) => string;
}

type RepairRule = SimpleRule | ComplexRule;

/**
 * REPAIR RULES - Ordered list of fixes to apply
 *
 * SAFETY PRINCIPLE: Only fix patterns that are UNAMBIGUOUSLY wrong.
 * Avoid "helpful" fixes that might break intentional formatting.
 */
const REPAIR_RULES: RepairRule[] = [
  {
    name: 'lowercase-italic-tags',
    description: 'Convert capital <I> to lowercase <i>',
    pattern: /<I>(.*?)<\/I>/gi,
    replacement: '<i>$1</i>'
  },

  {
    name: 'normalize-hr',
    description: 'Normalize <hr /> and < hr > to <hr>',
    pattern: /<hr\s*\/?>|<\s*hr\s*>/gi,
    replacement: '<hr>'
  },

  // Preserve letter suffixes when bracketing markers such as ILLUSTRATION-2b.
  {
    name: 'bracket-illustrations',
    description: 'Wrap ILLUSTRATION-N in brackets',
    pattern: new RegExp(String.raw`(?<!\[)(${ILLUSTRATION_MARKER_INNER})(?!\])`, 'g'),
    replacement: '[$1]'
  },

  {
    name: 'scene-break-dashes',
    description: 'Convert --- or *** on own line to <hr>',
    pattern: /^\s*([-*]{3,})\s*$/gm,
    replacement: '<hr>'
  },

  {
    name: 'trim-tag-spaces',
    description: 'Remove spaces from < i > and < /i >',
    pattern: /<\s+([ibu])\s+>|<\s*\/\s*([ibu])\s*>/gi,
    replacement: (match, openTag, closeTag) => openTag ? `<${openTag}>` : `</${closeTag}>`
  },

  {
    name: 'limit-br-tags',
    description: 'Reduce 3+ consecutive <br> to <br><br>',
    pattern: /(<br\s*\/?>\s*){3,}/gi,
    replacement: '<br><br>'
  },

  {
    name: 'dedupe-hr-tags',
    description: 'Remove duplicate <hr> tags',
    pattern: /(<hr>\s*){2,}/gi,
    replacement: '<hr>'
  },

  {
    name: 'space-hr-tags',
    description: 'Add line breaks before and after <hr> tags',
    pattern: /([^\s>])\s*<hr>\s*([^\s<])/gi,
    replacement: '$1<br><br><hr><br><br>$2'
  },

  {
    name: 'space-hr-edges',
    description: 'Add line breaks around <hr> at line edges',
    pattern: /([^\s>])\s*<hr>|<hr>\s*([^\s<])/gi,
    replacement: (match, before, after) => {
      if (before) return `${before}<br><br><hr>`;
      if (after) return `<hr><br><br>${after}`;
      return match;
    }
  },

  // Fixes patterns like </i>'Ding!'</i> → <i>'Ding!'</i>
  // Only matches content < 50 chars to avoid creating large unwanted italic chunks
  {
    name: 'fix-short-dangling-closers',
    description: 'Fix dangling closing tags for short content (<50 chars)',
    pattern: /<\/\s*(i|b|em|strong)\s*>([^<]{1,50}?)<\/\s*\1\s*>/gi,
    replacement: '<$1>$2</$1>'
  },

  // Callers preserving intentional escaping must disable decode-html-entities.
  {
    name: 'decode-html-entities',
    description: 'Decode &lt; &gt; &amp; etc.',
    apply: (html: string, stats: RepairStats) => {
      const entities = [
        { pattern: /&lt;/g, replacement: '<' },
        { pattern: /&gt;/g, replacement: '>' },
        { pattern: /&amp;/g, replacement: '&' },
        { pattern: /&quot;/g, replacement: '"' },
        { pattern: /&#39;|&apos;/g, replacement: "'" },
      ];

      let repaired = html;
      let count = 0;

      for (const entity of entities) {
        const matches = repaired.match(entity.pattern);
        if (matches) {
          count += matches.length;
          repaired = repaired.replace(entity.pattern, entity.replacement);
        }
      }

      if (count > 0) {
        stats.applied.push(`Decoded ${count} HTML entities`);
      }

      return repaired;
    }
  }
];

export class HtmlRepairService {
  /**
   * Main repair function - applies all enabled repair rules
   */
  static repair(html: string, options: RepairOptions = { enabled: true }): { html: string; stats: RepairStats } {
    if (!options.enabled) {
      return { html, stats: { applied: [], warnings: [] } };
    }

    const stats: RepairStats = { applied: [], warnings: [] };
    let repairedHtml = html;

    const disabledRules = new Set(options.disabledRules || []);

    for (const rule of REPAIR_RULES) {
      if (disabledRules.has(rule.name)) {
        continue;
      }

      // Complex rule with custom logic
      if ('apply' in rule) {
        repairedHtml = rule.apply(repairedHtml, stats);
        continue;
      }

      // Simple pattern-based rule
      const simpleRule = rule as SimpleRule;

      // Skip if test function says so
      if (simpleRule.test && !simpleRule.test(repairedHtml)) {
        continue;
      }

      const matches = repairedHtml.match(simpleRule.pattern);
      if (matches && matches.length > 0) {
        stats.applied.push(`${simpleRule.description} (${matches.length} occurrences)`);
        repairedHtml = repairedHtml.replace(simpleRule.pattern, simpleRule.replacement as any);
      }
    }

    if (options.verbose && stats.applied.length > 0) {
      console.log('[HtmlRepair] Applied repairs:', stats.applied);
    }

    return { html: repairedHtml, stats };
  }

  /**
   * Validate and report issues without fixing them
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

  /**
   * Get list of all available repair rules
   */
  static getAvailableRules(): Array<{ name: string; description: string }> {
    return REPAIR_RULES.map(rule => ({
      name: rule.name,
      description: rule.description
    }));
  }

  /**
   * Apply repair with specific rules disabled
   */
  static repairWithDisabledRules(html: string, disabledRules: string[]): { html: string; stats: RepairStats } {
    return this.repair(html, { enabled: true, disabledRules });
  }
}

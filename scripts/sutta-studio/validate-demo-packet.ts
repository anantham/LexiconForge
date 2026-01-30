#!/usr/bin/env npx tsx
/**
 * DemoPacket Validator
 *
 * Validates demoPacket.ts against ADR SUTTA-003 requirements:
 * 1. Text integrity: concatenated segments match canonical text
 * 2. Bracket consistency: grammar terms in [brackets]
 * 3. Refrain consistency: same refrainId words have consistent segmentation
 * 4. Relation validity: relations point to existing words/segments
 * 5. ID uniqueness: no duplicate IDs
 *
 * Usage: npx tsx scripts/sutta-studio/validate-demo-packet.ts
 */

import { DEMO_PACKET_MN10 } from '../../components/sutta-studio/demoPacket';
import type { PhaseView, PaliWord, WordSegment } from '../../types/suttaStudio';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type Severity = 'error' | 'warning' | 'info';

type ValidationResult = {
  rule: string;
  severity: Severity;
  phaseId: string;
  wordId?: string;
  segmentId?: string;
  message: string;
  details?: string;
};

type RefrainEntry = {
  phaseId: string;
  wordId: string;
  segmentTexts: string[];
  tooltipCount: number;
  firstTooltip?: string;
  rootTexts?: string[];
};

// ─────────────────────────────────────────────────────────────────────────────
// Validation Rules
// ─────────────────────────────────────────────────────────────────────────────

const results: ValidationResult[] = [];

function addResult(result: ValidationResult) {
  results.push(result);
}

/**
 * Rule 1: Text Integrity
 * Concatenated segments must match surface text (when we have canonical data)
 */
function validateTextIntegrity(phase: PhaseView) {
  for (const word of phase.paliWords) {
    const concatenated = word.segments.map((s) => s.text).join('');
    // We don't have canonical text per word, but we can check for common issues

    // Check for suspicious single-character segments that should be merged
    const singleCharSegments = word.segments.filter(
      (s) => s.text.length === 1 && s.type !== 'suffix' && s.type !== 'prefix'
    );
    if (singleCharSegments.length > 0) {
      addResult({
        rule: 'text-integrity',
        severity: 'warning',
        phaseId: phase.id,
        wordId: word.id,
        message: `Single-char non-affix segments may indicate over-segmentation`,
        details: `Segments: ${word.segments.map((s) => `"${s.text}"`).join(' + ')} → "${concatenated}"`,
      });
    }
  }
}

/**
 * Rule 2: Bracket Consistency
 * Grammar terms should be in [brackets] for toggle functionality
 */
function validateBracketConsistency(phase: PhaseView) {
  const grammarTerms = [
    'Nominative', 'Accusative', 'Genitive', 'Dative', 'Locative', 'Instrumental', 'Vocative',
    'Singular', 'Plural', 'Prefix', 'Suffix', 'Stem', 'Root',
    'Present', 'Past', 'Future', 'Aorist', 'Participle',
    'Masculine', 'Feminine', 'Neuter',
    'Indeclinable', 'Compound', 'Emphatic', 'Demonstrative',
    'Adjective', 'Adverb', 'Pronoun',
  ];

  const grammarPattern = new RegExp(`\\b(${grammarTerms.join('|')})\\b`, 'i');
  const bracketedPattern = /\[([^\]]+)\]/;

  for (const word of phase.paliWords) {
    for (const segment of word.segments) {
      if (!segment.tooltips) continue;

      for (const tooltip of segment.tooltips) {
        const hasGrammarTerm = grammarPattern.test(tooltip);
        const hasBracket = bracketedPattern.test(tooltip);

        if (hasGrammarTerm && !hasBracket) {
          // Check if the grammar term is at the start (likely needs bracket)
          const match = tooltip.match(grammarPattern);
          if (match && tooltip.toLowerCase().startsWith(match[1].toLowerCase())) {
            addResult({
              rule: 'bracket-consistency',
              severity: 'warning',
              phaseId: phase.id,
              wordId: word.id,
              segmentId: segment.id,
              message: `Grammar term "${match[1]}" should be in [brackets]`,
              details: `Tooltip: "${tooltip}"`,
            });
          }
        }
      }
    }
  }
}

/**
 * Rule 3: Refrain Consistency
 * Words with same refrainId should have consistent ROOT segmentation and tooltips.
 * Suffixes are allowed to vary (case/number changes: bhagavā vs bhagavato).
 */
function validateRefrainConsistency(phases: PhaseView[]) {
  const refrainMap = new Map<string, RefrainEntry[]>();

  for (const phase of phases) {
    for (const word of phase.paliWords) {
      if (!word.refrainId) continue;

      // Extract just the root/stem segments (ignore suffix variations)
      const rootSegments = word.segments.filter((s) => s.type === 'root' || s.type === 'stem');
      const rootTexts = rootSegments.map((s) => s.text.toLowerCase()); // case-insensitive

      const entry: RefrainEntry = {
        phaseId: phase.id,
        wordId: word.id,
        segmentTexts: word.segments.map((s) => s.text),
        tooltipCount: word.segments.reduce((sum, s) => sum + (s.tooltips?.length || 0), 0),
        firstTooltip: word.segments[0]?.tooltips?.[0],
        rootTexts, // for comparison
      };

      if (!refrainMap.has(word.refrainId)) {
        refrainMap.set(word.refrainId, []);
      }
      refrainMap.get(word.refrainId)!.push(entry);
    }
  }

  for (const [refrainId, entries] of refrainMap) {
    if (entries.length < 2) continue;

    const first = entries[0];
    const firstRootKey = (first as RefrainEntry & { rootTexts: string[] }).rootTexts?.join('|') || '';

    for (let i = 1; i < entries.length; i++) {
      const current = entries[i];
      const currentRootKey = (current as RefrainEntry & { rootTexts: string[] }).rootTexts?.join('|') || '';

      // Only warn if ROOT segments differ (suffix variations are OK)
      if (currentRootKey !== firstRootKey && firstRootKey && currentRootKey) {
        addResult({
          rule: 'refrain-consistency',
          severity: 'warning',
          phaseId: current.phaseId,
          wordId: current.wordId,
          message: `Refrain "${refrainId}" has inconsistent ROOT segmentation`,
          details: `First (${first.phaseId}): [${first.segmentTexts.join(' + ')}], This: [${current.segmentTexts.join(' + ')}]`,
        });
      }

      // Check tooltip consistency on root segments (info only)
      if (current.tooltipCount !== first.tooltipCount) {
        addResult({
          rule: 'refrain-consistency',
          severity: 'info',
          phaseId: current.phaseId,
          wordId: current.wordId,
          message: `Refrain "${refrainId}" has different tooltip count`,
          details: `First (${first.phaseId}): ${first.tooltipCount} tooltips, This: ${current.tooltipCount} tooltips`,
        });
      }
    }
  }
}

/**
 * Rule 4: Relation Validity
 * Relations must point to existing words/segments
 */
function validateRelations(phase: PhaseView) {
  const wordIds = new Set(phase.paliWords.map((w) => w.id));
  const segmentIds = new Set(
    phase.paliWords.flatMap((w) => w.segments.map((s) => s.id))
  );

  for (const word of phase.paliWords) {
    for (const segment of word.segments) {
      if (!segment.relation) continue;

      const { targetWordId, targetSegmentId } = segment.relation;

      if (targetWordId && !wordIds.has(targetWordId)) {
        addResult({
          rule: 'relation-validity',
          severity: 'error',
          phaseId: phase.id,
          wordId: word.id,
          segmentId: segment.id,
          message: `Relation points to non-existent word "${targetWordId}"`,
          details: `Relation: ${segment.text} → ${segment.relation.label} → ${targetWordId}`,
        });
      }

      if (targetSegmentId && !segmentIds.has(targetSegmentId)) {
        addResult({
          rule: 'relation-validity',
          severity: 'error',
          phaseId: phase.id,
          wordId: word.id,
          segmentId: segment.id,
          message: `Relation points to non-existent segment "${targetSegmentId}"`,
          details: `Relation: ${segment.text} → ${segment.relation.label} → ${targetSegmentId}`,
        });
      }
    }
  }
}

/**
 * Rule 5: ID Uniqueness
 * No duplicate word or segment IDs within a phase
 */
function validateIdUniqueness(phase: PhaseView) {
  const wordIds = new Map<string, number>();
  const segmentIds = new Map<string, number>();

  for (const word of phase.paliWords) {
    wordIds.set(word.id, (wordIds.get(word.id) || 0) + 1);

    for (const segment of word.segments) {
      segmentIds.set(segment.id, (segmentIds.get(segment.id) || 0) + 1);
    }
  }

  for (const [id, count] of wordIds) {
    if (count > 1) {
      addResult({
        rule: 'id-uniqueness',
        severity: 'error',
        phaseId: phase.id,
        wordId: id,
        message: `Duplicate word ID "${id}" appears ${count} times`,
      });
    }
  }

  for (const [id, count] of segmentIds) {
    if (count > 1) {
      addResult({
        rule: 'id-uniqueness',
        severity: 'error',
        phaseId: phase.id,
        segmentId: id,
        message: `Duplicate segment ID "${id}" appears ${count} times`,
      });
    }
  }
}

/**
 * Rule 6: Sense Coverage
 * Content words should have senses, segments should have tooltips
 */
function validateSenseCoverage(phase: PhaseView) {
  for (const word of phase.paliWords) {
    if (word.wordClass === 'content' && (!word.senses || word.senses.length === 0)) {
      addResult({
        rule: 'sense-coverage',
        severity: 'warning',
        phaseId: phase.id,
        wordId: word.id,
        message: `Content word has no senses`,
        details: `Word: ${word.segments.map((s) => s.text).join('')}`,
      });
    }

    for (const segment of word.segments) {
      if (!segment.tooltips || segment.tooltips.length === 0) {
        addResult({
          rule: 'sense-coverage',
          severity: 'info',
          phaseId: phase.id,
          wordId: word.id,
          segmentId: segment.id,
          message: `Segment has no tooltips`,
          details: `Segment: "${segment.text}" (${segment.type})`,
        });
      }
    }
  }
}

/**
 * Rule 7: English Structure Validity
 * English tokens should link to existing Pali words/segments
 */
function validateEnglishStructure(phase: PhaseView) {
  const wordIds = new Set(phase.paliWords.map((w) => w.id));
  const segmentIds = new Set(
    phase.paliWords.flatMap((w) => w.segments.map((s) => s.id))
  );

  for (const token of phase.englishStructure) {
    if (token.isGhost) continue;

    if (token.linkedPaliId && !wordIds.has(token.linkedPaliId)) {
      addResult({
        rule: 'english-structure',
        severity: 'error',
        phaseId: phase.id,
        message: `English token links to non-existent word "${token.linkedPaliId}"`,
        details: `Token ID: ${token.id}, Label: ${token.label || '(no label)'}`,
      });
    }

    if (token.linkedSegmentId && !segmentIds.has(token.linkedSegmentId)) {
      addResult({
        rule: 'english-structure',
        severity: 'error',
        phaseId: phase.id,
        message: `English token links to non-existent segment "${token.linkedSegmentId}"`,
        details: `Token ID: ${token.id}, Label: ${token.label || '(no label)'}`,
      });
    }
  }
}

/**
 * Rule 8: Canonical Segment IDs Present
 * Phases should have canonicalSegmentIds for pipeline integration
 */
function validateCanonicalSegmentIds(phase: PhaseView) {
  if (!phase.canonicalSegmentIds || phase.canonicalSegmentIds.length === 0) {
    addResult({
      rule: 'canonical-segment-ids',
      severity: 'warning',
      phaseId: phase.id,
      message: `Phase missing canonicalSegmentIds`,
      details: `Required for pipeline integration. Add e.g., canonicalSegmentIds: ['mn10:1.1']`,
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Validation
// ─────────────────────────────────────────────────────────────────────────────

function validate() {
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('  DemoPacket Validator - ADR SUTTA-003 Compliance Check');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  const phases = DEMO_PACKET_MN10.phases;
  console.log(`Validating ${phases.length} phases...\n`);

  // Run per-phase validations
  for (const phase of phases) {
    validateTextIntegrity(phase);
    validateBracketConsistency(phase);
    validateRelations(phase);
    validateIdUniqueness(phase);
    validateSenseCoverage(phase);
    validateEnglishStructure(phase);
    validateCanonicalSegmentIds(phase);
  }

  // Run cross-phase validations
  validateRefrainConsistency(phases);

  // Report results
  const errors = results.filter((r) => r.severity === 'error');
  const warnings = results.filter((r) => r.severity === 'warning');
  const infos = results.filter((r) => r.severity === 'info');

  console.log('───────────────────────────────────────────────────────────────────');
  console.log('  SUMMARY');
  console.log('───────────────────────────────────────────────────────────────────');
  console.log(`  🔴 Errors:   ${errors.length}`);
  console.log(`  🟡 Warnings: ${warnings.length}`);
  console.log(`  🔵 Info:     ${infos.length}`);
  console.log(`  📊 Total:    ${results.length}`);
  console.log('───────────────────────────────────────────────────────────────────\n');

  // Print errors first
  if (errors.length > 0) {
    console.log('🔴 ERRORS (must fix):\n');
    for (const r of errors) {
      console.log(`  [${r.rule}] ${r.phaseId}${r.wordId ? '/' + r.wordId : ''}${r.segmentId ? '/' + r.segmentId : ''}`);
      console.log(`    ${r.message}`);
      if (r.details) console.log(`    → ${r.details}`);
      console.log();
    }
  }

  // Print warnings
  if (warnings.length > 0) {
    console.log('🟡 WARNINGS (should fix):\n');

    // Group by rule for readability
    const byRule = new Map<string, ValidationResult[]>();
    for (const r of warnings) {
      if (!byRule.has(r.rule)) byRule.set(r.rule, []);
      byRule.get(r.rule)!.push(r);
    }

    for (const [rule, ruleWarnings] of byRule) {
      console.log(`  [${rule}] (${ruleWarnings.length} issues)`);
      // Show first 5 examples
      for (const r of ruleWarnings.slice(0, 5)) {
        console.log(`    • ${r.phaseId}${r.wordId ? '/' + r.wordId : ''}: ${r.message}`);
        if (r.details) console.log(`      → ${r.details}`);
      }
      if (ruleWarnings.length > 5) {
        console.log(`    ... and ${ruleWarnings.length - 5} more`);
      }
      console.log();
    }
  }

  // Print info (collapsed)
  if (infos.length > 0) {
    console.log(`🔵 INFO (${infos.length} items, run with --verbose to see all)\n`);
    if (process.argv.includes('--verbose')) {
      for (const r of infos) {
        console.log(`  [${r.rule}] ${r.phaseId}${r.wordId ? '/' + r.wordId : ''}: ${r.message}`);
      }
      console.log();
    }
  }

  // Exit code
  if (errors.length > 0) {
    console.log('❌ Validation FAILED - please fix errors before proceeding.\n');
    process.exit(1);
  } else if (warnings.length > 0) {
    console.log('⚠️  Validation PASSED with warnings.\n');
    process.exit(0);
  } else {
    console.log('✅ Validation PASSED!\n');
    process.exit(0);
  }
}

validate();

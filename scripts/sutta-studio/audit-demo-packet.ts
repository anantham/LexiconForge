#!/usr/bin/env npx tsx
/**
 * Audit script for demoPacket.ts
 * Checks all phases for quality issues across all settings-driven features.
 */

import { DEMO_PACKET_MN10 } from '../../components/sutta-studio/demoPacket';
import type { PhaseView, PaliWord, EnglishToken } from '../../types/suttaStudio';

type Issue = {
  phaseId: string;
  category: string;
  severity: 'error' | 'warn';
  message: string;
};

const issues: Issue[] = [];

// Known refrain words that should have refrainIds
const REFRAIN_PATTERNS: Record<string, string> = {
  'bhagavā': 'bhagava',
  'bhagavato': 'bhagava',
  'bhikkhave': 'bhikkhu',
  'bhikkhu': 'bhikkhu',
  'bhikkhū': 'bhikkhu',
  'ātāpī': 'formula-ardent',
  'sampajāno': 'formula-ardent',
  'satimā': 'formula-ardent',
  'vineyya': 'formula-removing',
  'loke': 'formula-removing',
  'abhijjhādomanassaṁ': 'formula-removing',
};

// Genitive/locative suffixes that often need relations
const RELATION_SUFFIXES = ['ānaṁ', 'ssa', 'assa', 'āya', 'smiṁ', 'mhi'];

// Grammar terms that should be in [brackets]
// Excludes common terms like "Present/Past tense" which everyone understands
const GRAMMAR_TERMS = [
  'Nominative', 'Accusative', 'Genitive', 'Dative', 'Locative', 'Vocative', 'Instrumental',
  'Singular', 'Plural', 'Masculine', 'Feminine', 'Neuter',
  // 'Present', 'Past', 'Future' - too common when followed by "tense"
  'Aorist', 'Optative', 'Imperative',
  'Prefix', 'Suffix', 'Root', 'Stem',
  'Agent', 'Absolutive', 'Gerund', 'Participle', 'Infinitive',
  // 'Emphatic' - common descriptive word
  // 'Adverbial' - often used descriptively: "adverbial sense"
  'Causative',
];

function auditPhase(phase: PhaseView) {
  const phaseId = phase.id;

  // 1. Check canonicalSegmentIds
  if (!phase.canonicalSegmentIds || phase.canonicalSegmentIds.length === 0) {
    issues.push({
      phaseId,
      category: 'canonicalSegmentIds',
      severity: 'error',
      message: 'Missing canonicalSegmentIds',
    });
  }

  // 2. Check each word
  for (const word of phase.paliWords) {
    const surface = word.segments.map(s => s.text).join('');

    // 2a. Check sense counts
    const senseCount = word.senses?.length ?? 0;
    if (word.wordClass === 'content' && senseCount < 3) {
      issues.push({
        phaseId,
        category: 'polysemy',
        severity: 'warn',
        message: `Content word "${surface}" (${word.id}) has only ${senseCount} sense(s), expected 3`,
      });
    }
    if (word.wordClass === 'function' && senseCount === 0) {
      issues.push({
        phaseId,
        category: 'polysemy',
        severity: 'error',
        message: `Function word "${surface}" (${word.id}) has no senses`,
      });
    }

    // 2b. Check refrainIds
    const expectedRefrainId = REFRAIN_PATTERNS[surface];
    if (expectedRefrainId && word.refrainId !== expectedRefrainId) {
      issues.push({
        phaseId,
        category: 'refrainId',
        severity: 'warn',
        message: `Word "${surface}" (${word.id}) should have refrainId: '${expectedRefrainId}', has: '${word.refrainId || 'none'}'`,
      });
    }

    // 2c. Check segments for relations and tooltips
    for (const seg of word.segments) {
      // Check if suffix might need a relation
      if (seg.type === 'suffix') {
        const needsRelation = RELATION_SUFFIXES.some(suf => seg.text.includes(suf) || seg.text === suf.slice(-1));
        // Only flag if it's a genitive-looking suffix without relation
        if (seg.text.match(/^(ānaṁ|ssa|assa|āya)$/) && !seg.relation) {
          issues.push({
            phaseId,
            category: 'relations',
            severity: 'warn',
            message: `Suffix "${seg.text}" in "${surface}" (${seg.id}) may need a relation (genitive/dative)`,
          });
        }
      }

      // Check tooltips for unbracketed grammar terms used as LABELS
      // (not descriptive uses like "Past tense" or "more emphatic")
      if (seg.tooltips) {
        for (const tooltip of seg.tooltips) {
          for (const term of GRAMMAR_TERMS) {
            // Only flag if term is used as a label at the start of tooltip:
            // - Starts with term: "Nominative — ..." or "Nominative: ..."
            // - Starts with emoji then term: "📢 Vocative"
            const labelPattern = new RegExp(`^(📢\\s*)?${term}\\b`, 'i');
            const hasBracketedTerm = tooltip.includes(`[${term}`);
            if (labelPattern.test(tooltip) && !hasBracketedTerm) {
              issues.push({
                phaseId,
                category: 'brackets',
                severity: 'warn',
                message: `Tooltip "${tooltip.slice(0, 40)}..." has unbracketed grammar label "${term}"`,
              });
              break; // Only report once per tooltip
            }
          }
        }
      }

      // Check for empty tooltips
      if (!seg.tooltips || seg.tooltips.length === 0) {
        if (seg.type !== 'stem') { // stems sometimes don't need tooltips
          issues.push({
            phaseId,
            category: 'tooltips',
            severity: 'warn',
            message: `Segment "${seg.text}" (${seg.id}) has no tooltips`,
          });
        }
      }
    }

    // 2d. Check wordClass is set
    if (!word.wordClass) {
      issues.push({
        phaseId,
        category: 'wordClass',
        severity: 'error',
        message: `Word "${surface}" (${word.id}) missing wordClass`,
      });
    }
  }

  // 3. Check englishStructure
  if (phase.englishStructure) {
    const paliWordIds = new Set(phase.paliWords.map(w => w.id));
    const paliSegmentIds = new Set(phase.paliWords.flatMap(w => w.segments.map(s => s.id)));

    let hasGhost = false;
    for (const token of phase.englishStructure) {
      // Check ghost words
      if (token.isGhost) {
        hasGhost = true;
        if (!token.ghostKind) {
          issues.push({
            phaseId,
            category: 'ghostWords',
            severity: 'warn',
            message: `Ghost token "${token.label || token.id}" missing ghostKind`,
          });
        }
      }

      // Check linked IDs are valid
      if (token.linkedPaliId && !paliWordIds.has(token.linkedPaliId)) {
        issues.push({
          phaseId,
          category: 'englishStructure',
          severity: 'error',
          message: `Token ${token.id} links to invalid paliId: ${token.linkedPaliId}`,
        });
      }
      if (token.linkedSegmentId && !paliSegmentIds.has(token.linkedSegmentId)) {
        issues.push({
          phaseId,
          category: 'englishStructure',
          severity: 'error',
          message: `Token ${token.id} links to invalid segmentId: ${token.linkedSegmentId}`,
        });
      }
    }
  } else {
    issues.push({
      phaseId,
      category: 'englishStructure',
      severity: 'error',
      message: 'Missing englishStructure',
    });
  }
}

// Run audit on all phases
console.log('\n🔍 SUTTA STUDIO DEMO PACKET AUDIT\n');
console.log(`Scanning ${DEMO_PACKET_MN10.phases.length} phases...\n`);

for (const phase of DEMO_PACKET_MN10.phases) {
  auditPhase(phase);
}

// Group issues by category
const byCategory: Record<string, Issue[]> = {};
for (const issue of issues) {
  if (!byCategory[issue.category]) byCategory[issue.category] = [];
  byCategory[issue.category].push(issue);
}

// Print summary
console.log('=' .repeat(60));
console.log('SUMMARY BY CATEGORY');
console.log('=' .repeat(60));

const categories = Object.keys(byCategory).sort();
for (const cat of categories) {
  const catIssues = byCategory[cat];
  const errors = catIssues.filter(i => i.severity === 'error').length;
  const warns = catIssues.filter(i => i.severity === 'warn').length;
  console.log(`\n📁 ${cat.toUpperCase()} (${catIssues.length} issues: ${errors} errors, ${warns} warnings)`);

  // Show first 5 examples
  const examples = catIssues.slice(0, 5);
  for (const ex of examples) {
    const icon = ex.severity === 'error' ? '❌' : '⚠️';
    console.log(`   ${icon} [${ex.phaseId}] ${ex.message}`);
  }
  if (catIssues.length > 5) {
    console.log(`   ... and ${catIssues.length - 5} more`);
  }
}

// Print totals
const totalErrors = issues.filter(i => i.severity === 'error').length;
const totalWarns = issues.filter(i => i.severity === 'warn').length;

console.log('\n' + '=' .repeat(60));
console.log(`TOTAL: ${issues.length} issues (${totalErrors} errors, ${totalWarns} warnings)`);
console.log('=' .repeat(60));

// Exit with error code if there are errors
if (totalErrors > 0) {
  process.exit(1);
}

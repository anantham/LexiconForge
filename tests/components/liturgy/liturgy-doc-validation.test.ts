/**
 * Corpus-wide data-quality gate.
 *
 * Runs the shared `validateLiturgyDoc` (services/liturgy/validation.ts) over
 * every registered chant. This is the SAME validator the generator runs over
 * its drafts, so a generated sheet and a hand-authored one are held to one
 * standard. It also extends checks the per-word suites never applied to the
 * corpus — notably `morphemeAlignTo` parallelism and prose-commentary body
 * register — to the shipped sheets.
 */

import { describe, it, expect } from 'vitest';
import { LITURGY_DOCS_BY_SANGHA } from '../../../data/liturgy';
import type { LiturgyDoc } from '../../../types/liturgy';
import { validateLiturgyDoc, type LiturgyDiagnostic } from '../../../services/liturgy/validation';

const ALL_DOCS: LiturgyDoc[] = Object.values(LITURGY_DOCS_BY_SANGHA).flatMap(
  (docsForSangha) => Object.values(docsForSangha)
);

function format(diagnostics: LiturgyDiagnostic[]): string {
  if (diagnostics.length === 0) return '';
  return (
    '\n' +
    diagnostics
      .map(
        (d) =>
          `  [${d.level}] ${d.code} @ ${d.sectionId ?? '?'}/${d.segmentId ?? '?'}` +
          `${d.witnessBy ? ` (${d.witnessBy})` : ''}: ${d.message}`
      )
      .join('\n')
  );
}

for (const doc of ALL_DOCS) {
  describe(`liturgy doc validation: ${doc.sangha}/${doc.slug}`, () => {
    const diagnostics = validateLiturgyDoc(doc);
    const errors = diagnostics.filter((d) => d.level === 'error');

    it('emits no error-level data-quality diagnostics', () => {
      expect(errors.length, format(errors)).toBe(0);
    });
  });
}

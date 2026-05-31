import type { LiturgyDoc } from '../../types/liturgy';
import { validateLiturgyDoc } from '../liturgy/validation';
import type { LiturgyGeneratorDiagnostic } from './types';

/**
 * Validate a generated draft against the shared liturgy invariants
 * (services/liturgy/validation.ts — the same checker the corpus tests run).
 *
 * This is a thin adapter: it delegates to `validateLiturgyDoc` and namespaces
 * the bare diagnostic codes into the generator's `liturgy_generator.*` stream
 * so callers (the CLI's refuse-to-emit gate, pipeline stats) see a consistent
 * code space. The actual invariants live in the shared module so a generated
 * sheet and a hand-authored one are held to exactly one standard.
 */
export function validateLiturgyDraft(doc: LiturgyDoc): LiturgyGeneratorDiagnostic[] {
  return validateLiturgyDoc(doc).map((diagnostic) => ({
    level: diagnostic.level,
    code: `liturgy_generator.${diagnostic.code}`,
    message: diagnostic.message,
    stage: 'validation',
    sectionId: diagnostic.sectionId,
    segmentId: diagnostic.segmentId,
    witnessBy: diagnostic.witnessBy,
    path: diagnostic.path,
  }));
}

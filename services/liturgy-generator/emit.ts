import type { LiturgyDoc } from '../../types/liturgy';
import { stableExportName } from './tokenize';

// Emit names are code, not document data. Keep them to one unambiguous binding.
const RESERVED_BINDINGS = new Set((
  'await break case catch class const continue debugger default delete do else enum export extends ' +
  'false finally for function if implements import in instanceof interface let new null package ' +
  'private protected public return static super switch this throw true try typeof var void while ' +
  'with yield eval arguments LiturgyDoc'
).split(' '));
const isSafeBinding = (name: string): boolean =>
  /^[A-Za-z_$][A-Za-z0-9_$]{0,127}$/.test(name) && !RESERVED_BINDINGS.has(name);

export function resolveExportName(doc: Pick<LiturgyDoc, 'slug'>, override?: string): string {
  if (override !== undefined && typeof override !== 'string') {
    throw new Error('Liturgy exportName must be a TypeScript identifier.');
  }
  const explicitName = override?.trim();
  if (explicitName) {
    if (!isSafeBinding(explicitName)) {
      throw new Error('Liturgy exportName must be a non-reserved ASCII TypeScript identifier (max 128 characters).');
    }
    return explicitName;
  }
  const generatedName = stableExportName(doc.slug);
  return isSafeBinding(generatedName) ? generatedName : 'generatedLiturgyDoc';
}

export function emitLiturgyDocModule(doc: LiturgyDoc, exportNameOverride?: string): string {
  const exportName = resolveExportName(doc, exportNameOverride);
  const body = JSON.stringify(doc, null, 2);
  return [
    "import type { LiturgyDoc } from '../../types/liturgy';",
    '',
    `export const ${exportName}: LiturgyDoc = ${body};`,
    '',
    `export default ${exportName};`,
    '',
  ].join('\n');
}

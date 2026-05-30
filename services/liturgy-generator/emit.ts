import type { LiturgyDoc } from '../../types/liturgy';
import { stableExportName } from './tokenize';

export function resolveExportName(doc: Pick<LiturgyDoc, 'slug'>, override?: string): string {
  return override?.trim() || stableExportName(doc.slug);
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

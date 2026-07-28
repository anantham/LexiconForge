/**
 * Overwrite guard for the generate-*-golden scripts.
 *
 * Integrity finding (2026-07 scan, P0): all four generate-*-golden scripts
 * unconditionally `fs.writeFileSync` their fixture path. The checked-in
 * fixtures have accumulated months of hand curation SINCE they were first
 * generated (acceptedSenses layers, adjudicated senses, KNOWN_FP annotations),
 * so a casual re-run would silently clobber curation that only exists in the
 * fixture files. Regeneration must now be an explicit decision: refuse when
 * the output file already exists unless `--force` is passed, and say what
 * would be destroyed (mtime + any curation markers found).
 */
import * as fs from 'node:fs';

export type GoldenWriteGuardResult = { allowed: boolean; message: string };

const DEFAULT_CURATION_MARKERS = ['acceptedSenses', '_acceptedSensesFrom'];

export const guardGoldenOverwrite = (params: {
  outputPath: string;
  argv: string[];
  /** Substrings whose presence in the existing file indicates hand curation. */
  curationMarkers?: string[];
}): GoldenWriteGuardResult => {
  const { outputPath, argv } = params;
  const markers = params.curationMarkers ?? DEFAULT_CURATION_MARKERS;

  if (!fs.existsSync(outputPath)) {
    return { allowed: true, message: `Creating new golden fixture: ${outputPath}` };
  }

  const stat = fs.statSync(outputPath);
  let markersFound: string[] = [];
  try {
    const existing = fs.readFileSync(outputPath, 'utf8');
    markersFound = markers.filter((m) => existing.includes(m));
  } catch {
    // Unreadable existing file: stay conservative, report no markers but still guard.
  }

  const description =
    `${outputPath}\n  (last modified ${stat.mtime.toISOString()}, ` +
    `${stat.size} bytes${markersFound.length ? `; curation markers present: ${markersFound.join(', ')}` : ''})`;

  if (argv.includes('--force')) {
    return {
      allowed: true,
      message: `--force: OVERWRITING existing ${description}. Hand curation in the old file is NOT preserved.`,
    };
  }

  return {
    allowed: false,
    message:
      `REFUSING to overwrite existing ${description}.\n` +
      `Regenerating from demoPacket would destroy any hand curation applied to the fixture since ` +
      `it was generated. Re-run with --force only if that is the explicit intent.`,
  };
};
